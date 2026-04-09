import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  listConversations,
  listMessages,
  markConversationRead,
  sendMessageRest,
} from '@/services/chatService';
import type { ChatConnectionState } from '@/services/chatSocket';
import { chatSocket } from '@/services/chatSocket';
import type {
  ChatConversation,
  ChatMessage,
  LocalChatMessage,
  MessageReadEvent,
  TypingEvent,
} from '@/types/chat';
import { mapChatErrorToMessage } from '@/utils/chat/errorMap';
import { useUserStore } from '@/utils/stores/userStore';

type PaginationState = {
  nextCursor: string | null;
  hasMore: boolean;
};

type TypingState = {
  userId: string;
  fullName?: string;
  expiresAt: number;
};

interface ChatState {
  conversations: ChatConversation[];
  messagesByConversation: Record<string, LocalChatMessage[]>;
  paginationByConversation: Record<string, PaginationState>;
  typingByConversation: Record<string, TypingState>;
  connectionState: ChatConnectionState;
  loadingConversations: boolean;
  loadingMessagesByConversation: Record<string, boolean>;
  activeConversationId: string | null;

  setConnectionState: (state: ChatConnectionState) => void;
  setActiveConversation: (conversationId: string | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (
    conversationId: string,
    options?: { reset?: boolean; limit?: number }
  ) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  retryFailedMessage: (conversationId: string, localTempId: string) => Promise<void>;
  retryAllFailedMessages: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  receiveSocketMessage: (message: ChatMessage) => void;
  receiveSocketMessageRead: (event: MessageReadEvent) => void;
  receiveSocketTyping: (event: TypingEvent) => void;
  cleanupExpiredTyping: () => void;
  resetChatState: () => void;
}

const CHAT_CACHE_KEY = 'chat-storage';

const sortByCreatedAtAsc = (messages: LocalChatMessage[]) =>
  [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const mergeMessages = (items: LocalChatMessage[]): LocalChatMessage[] => {
  const seen = new Map<string, LocalChatMessage>();

  items.forEach((item) => {
    const key = item.id || item.localTempId;
    if (!key) return;

    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, item);
      return;
    }

    seen.set(key, {
      ...prev,
      ...item,
      localStatus: item.localStatus ?? prev.localStatus,
      localError: item.localError ?? prev.localError,
    });
  });

  return sortByCreatedAtAsc(Array.from(seen.values()));
};

const sortConversations = (rows: ChatConversation[]) =>
  [...rows].sort(
    (a, b) =>
      new Date(b.updatedAt || b.lastMessage?.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.lastMessage?.createdAt || 0).getTime()
  );

const updateConversationSummary = (
  conversations: ChatConversation[],
  input: {
    conversationId: string;
    message?: ChatMessage;
    unreadCount?: number;
  }
): ChatConversation[] => {
  const idx = conversations.findIndex((item) => item.id === input.conversationId);

  if (idx === -1) {
    return conversations;
  }

  const current = conversations[idx];
  const nextConversation: ChatConversation = {
    ...current,
    lastMessage: input.message ?? current.lastMessage,
    unreadCount: typeof input.unreadCount === 'number' ? input.unreadCount : current.unreadCount,
    updatedAt: input.message?.createdAt || current.updatedAt,
  };

  const cloned = [...conversations];
  cloned[idx] = nextConversation;
  return sortConversations(cloned);
};

const getCurrentUserId = () => useUserStore.getState().userInfo?.id || '';

const optimisticMessage = (
  conversationId: string,
  content: string,
  senderId: string,
  localTempId: string
): LocalChatMessage => ({
  id: localTempId,
  conversationId,
  senderId,
  content,
  createdAt: new Date().toISOString(),
  clientMessageId: localTempId,
  localStatus: 'sending',
  localTempId,
});

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messagesByConversation: {},
      paginationByConversation: {},
      typingByConversation: {},
      connectionState: 'disconnected',
      loadingConversations: false,
      loadingMessagesByConversation: {},
      activeConversationId: null,

      setConnectionState: (state) => set({ connectionState: state }),

      setActiveConversation: (conversationId) => {
        set({ activeConversationId: conversationId });
      },

      loadConversations: async () => {
        if (get().loadingConversations) return;

        const prevIds = new Set(get().conversations.map((c) => c.id));

        set({ loadingConversations: true });
        try {
          const rows = await listConversations();
          set({ conversations: sortConversations(rows) });

          // If new conversation rooms appeared since the socket last connected,
          // the socket is not in those rooms and won't receive chat:new events.
          // Force a reconnect so handleConnection re-joins all current rooms.
          // Skip if the user is currently in an active chat to avoid a brief
          // disconnect that could drop incoming messages.
          const hasNewConversations = rows.some((r) => !prevIds.has(r.id));
          const isInActiveChat = !!get().activeConversationId;
          if (hasNewConversations && chatSocket.isConnected() && !isInActiveChat) {
            chatSocket.rejoinRooms();
          }
        } finally {
          set({ loadingConversations: false });
        }
      },

      loadMessages: async (conversationId, options) => {
        const reset = options?.reset ?? false;
        const limit = options?.limit ?? 20;

        if (!conversationId) return;
        if (get().loadingMessagesByConversation[conversationId]) return;

        const page = get().paginationByConversation[conversationId];

        if (!reset && page && !page.hasMore) {
          return;
        }

        set((state) => ({
          loadingMessagesByConversation: {
            ...state.loadingMessagesByConversation,
            [conversationId]: true,
          },
        }));

        try {
          const cursor = reset ? null : page?.nextCursor;
          const response = await listMessages(conversationId, cursor, limit);
          const incoming = sortByCreatedAtAsc(
            response.data.map((item) => ({
              ...item,
              localStatus: 'sent',
            }))
          );

          set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const merged = reset
              ? mergeMessages(incoming)
              : mergeMessages([...incoming, ...current]);

            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: merged,
              },
              paginationByConversation: {
                ...state.paginationByConversation,
                [conversationId]: {
                  nextCursor: response.nextCursor,
                  hasMore: response.hasMore,
                },
              },
            };
          });
        } finally {
          set((state) => ({
            loadingMessagesByConversation: {
              ...state.loadingMessagesByConversation,
              [conversationId]: false,
            },
          }));
        }
      },

      sendMessage: async (conversationId, rawContent) => {
        const senderId = getCurrentUserId();
        const content = rawContent.trim();

        if (!conversationId || !content || !senderId) {
          return;
        }

        const tempId = `tmp_${conversationId}_${Date.now()}`;
        const pending = optimisticMessage(conversationId, content, senderId, tempId);

        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: mergeMessages([
              ...(state.messagesByConversation[conversationId] || []),
              pending,
            ]),
          },
          conversations: updateConversationSummary(state.conversations, {
            conversationId,
            message: pending,
          }),
        }));

        const replacePendingWith = (
          message: ChatMessage,
          status: LocalChatMessage['localStatus']
        ) => {
          set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            const replaced = current.map((item) => {
              if (item.localTempId !== tempId) return item;
              return {
                ...message,
                localStatus: status,
                localTempId: tempId,
                localError: undefined,
              };
            });

            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: mergeMessages(replaced),
              },
              conversations: updateConversationSummary(state.conversations, {
                conversationId,
                message,
              }),
            };
          });
        };

        const markPendingAsFailed = (message: string) => {
          set((state) => {
            const current = state.messagesByConversation[conversationId] || [];
            return {
              messagesByConversation: {
                ...state.messagesByConversation,
                [conversationId]: current.map((item) =>
                  item.localTempId === tempId
                    ? {
                        ...item,
                        localStatus: 'failed',
                        localError: message,
                      }
                    : item
                ),
              },
            };
          });
        };

        try {
          const sentMessage = chatSocket.isConnected()
            ? await chatSocket.sendMessage({
                conversationId,
                content,
                clientMessageId: tempId,
              })
            : await sendMessageRest(conversationId, content, tempId);

          replacePendingWith(sentMessage, 'sent');
        } catch (socketError) {
          try {
            const sentMessage = await sendMessageRest(conversationId, content, tempId);
            replacePendingWith(sentMessage, 'sent');
          } catch (restError) {
            markPendingAsFailed(mapChatErrorToMessage(restError || socketError));
          }
        }
      },

      retryFailedMessage: async (conversationId, localTempId) => {
        const current = get().messagesByConversation[conversationId] || [];
        const target = current.find((item) => item.localTempId === localTempId);

        if (!target) return;

        set((state) => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: (state.messagesByConversation[conversationId] || []).map((item) =>
              item.localTempId === localTempId
                ? {
                    ...item,
                    localStatus: 'sending',
                    localError: undefined,
                  }
                : item
            ),
          },
        }));

        try {
          const sent = await sendMessageRest(conversationId, target.content, localTempId);
          set((state) => ({
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: mergeMessages(
                (state.messagesByConversation[conversationId] || []).map((item) =>
                  item.localTempId === localTempId
                    ? {
                        ...sent,
                        localStatus: 'sent',
                        localTempId,
                      }
                    : item
                )
              ),
            },
            conversations: updateConversationSummary(state.conversations, {
              conversationId,
              message: sent,
            }),
          }));
        } catch (error) {
          set((state) => ({
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: (state.messagesByConversation[conversationId] || []).map((item) =>
                item.localTempId === localTempId
                  ? {
                      ...item,
                      localStatus: 'failed',
                      localError: mapChatErrorToMessage(error),
                    }
                  : item
              ),
            },
          }));
        }
      },

      retryAllFailedMessages: async () => {
        const byConversation = get().messagesByConversation;
        for (const [conversationId, rows] of Object.entries(byConversation)) {
          const failed = rows.filter((item) => item.localStatus === 'failed' && item.localTempId);
          for (const item of failed) {
            if (!item.localTempId) continue;
            await get().retryFailedMessage(conversationId, item.localTempId);
          }
        }
      },

      markConversationAsRead: async (conversationId) => {
        if (!conversationId) return;

        set((state) => ({
          conversations: updateConversationSummary(state.conversations, {
            conversationId,
            unreadCount: 0,
          }),
        }));

        try {
          await markConversationRead(conversationId);

          chatSocket.sendRead(conversationId);
        } catch {
          // Ignore because next refresh from source-of-truth will correct unread state.
        }
      },

      receiveSocketMessage: (message) => {
        if (!message?.conversationId || !message.id) return;

        const currentUserId = getCurrentUserId();
        const isMine = message.senderId === currentUserId;

        const isNewConversation = !get().conversations.find(
          (item) => item.id === message.conversationId
        );

        set((state) => {
          const current = state.messagesByConversation[message.conversationId] || [];
          const merged = mergeMessages([
            ...current,
            {
              ...message,
              localStatus: 'sent',
            },
          ]);

          const active = state.activeConversationId === message.conversationId;
          const unreadCount =
            active || isMine
              ? 0
              : (state.conversations.find((item) => item.id === message.conversationId)
                  ?.unreadCount || 0) + 1;

          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [message.conversationId]: merged,
            },
            conversations: updateConversationSummary(state.conversations, {
              conversationId: message.conversationId,
              message,
              unreadCount,
            }),
          };
        });

        // If a lecturer started a brand-new conversation, refetch the list so
        // it appears immediately without requiring a manual refresh.
        if (isNewConversation) {
          get().loadConversations();
        }

        if (get().activeConversationId === message.conversationId && !isMine) {
          get().markConversationAsRead(message.conversationId);
        }
      },

      receiveSocketMessageRead: (event) => {
        if (!event.conversationId) return;

        // BE sends { conversation_id, read_count, read_at } — mark all messages
        // created at or before readAt as read by the recipient.
        const readAtMs = new Date(event.readAt).getTime();

        set((state) => {
          const current = state.messagesByConversation[event.conversationId] || [];
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [event.conversationId]: current.map((item) =>
                !item.readAt && new Date(item.createdAt).getTime() <= readAtMs
                  ? { ...item, readAt: event.readAt }
                  : item
              ),
            },
          };
        });
      },

      receiveSocketTyping: (event) => {
        if (!event.conversationId || !event.userId) return;

        set((state) => {
          const current = state.typingByConversation[event.conversationId];

          if (!event.isTyping) {
            if (!current || current.userId !== event.userId) return state;
            const cloned = { ...state.typingByConversation };
            delete cloned[event.conversationId];
            return { typingByConversation: cloned };
          }

          return {
            typingByConversation: {
              ...state.typingByConversation,
              [event.conversationId]: {
                userId: event.userId,
                fullName: event.fullName,
                expiresAt: Date.now() + 3_500,
              },
            },
          };
        });
      },

      cleanupExpiredTyping: () => {
        const now = Date.now();
        const typing = get().typingByConversation;
        let changed = false;

        const next: Record<string, TypingState> = {};
        Object.entries(typing).forEach(([conversationId, value]) => {
          if (value.expiresAt > now) {
            next[conversationId] = value;
            return;
          }
          changed = true;
        });

        if (changed) {
          set({ typingByConversation: next });
        }
      },

      resetChatState: () => {
        set({
          conversations: [],
          messagesByConversation: {},
          paginationByConversation: {},
          typingByConversation: {},
          connectionState: 'disconnected',
          loadingConversations: false,
          loadingMessagesByConversation: {},
          activeConversationId: null,
        });
      },
    }),
    {
      name: CHAT_CACHE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const cappedMessages: Record<string, LocalChatMessage[]> = {};

        Object.entries(state.messagesByConversation).forEach(([conversationId, rows]) => {
          cappedMessages[conversationId] = rows.slice(-40);
        });

        return {
          conversations: state.conversations,
          messagesByConversation: cappedMessages,
          paginationByConversation: state.paginationByConversation,
        };
      },
    }
  )
);
