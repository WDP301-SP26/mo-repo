import axiosClient from '@/api/axiosConfig';
import ENDPOINTS from '@/api/endpoint';
import type { ChatConversation, ChatMessage, ChatMessagePage, ChatParticipant } from '@/types/chat';

export type GetOrCreateGroupConversationParams = {
  semester_id: string;
  class_id: string;
  group_id: string;
  lecturer_id?: string;
};

type RawChatParticipant = {
  id: string;
  full_name?: string | null;
  email?: string;
  role?: string;
};

type RawChatMessage = {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  sender_id?: string;
  senderId?: string;
  content: string;
  type?: string;
  client_id?: string;
  read_by_recipient_at?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

type RawChatConversation = {
  id: string;
  is_group_room?: boolean;
  group_id?: string | null;
  group_name?: string | null;
  counterpart?: RawChatParticipant | null;
  class_code?: string;
  classCode?: string;
  semester_name?: string;
  semesterName?: string;
  status?: string;
  unread_count?: number;
  unreadCount?: number;
  last_message?: RawChatMessage | null;
  lastMessage?: RawChatMessage | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

type RawCursorMeta = {
  next_cursor?: string | null;
  nextCursor?: string | null;
  has_more?: boolean;
  hasMore?: boolean;
};

type RawPaged<T> = {
  data?: T[];
  items?: T[];
  meta?: RawCursorMeta;
};

const toISO = (value?: string | null): string => value || new Date().toISOString();

export const normalizeChatParticipant = (raw: RawChatParticipant): ChatParticipant => ({
  id: raw.id,
  fullName: raw.full_name ?? raw.email ?? 'Unknown user',
  role: raw.role || 'STUDENT',
});

export const normalizeChatMessage = (raw: RawChatMessage): ChatMessage => ({
  id: raw.id,
  conversationId: raw.conversation_id ?? raw.conversationId ?? '',
  senderId: raw.sender_id ?? raw.senderId ?? '',
  content: raw.content,
  createdAt: toISO(raw.created_at ?? raw.createdAt),
  updatedAt: raw.updated_at ?? raw.updatedAt,
  readAt: raw.read_by_recipient_at ?? null,
  clientMessageId: raw.client_id,
});

export const normalizeChatConversation = (raw: RawChatConversation): ChatConversation => {
  const lastMessageRaw = raw.last_message ?? raw.lastMessage ?? undefined;
  const normalizedLastMessage = lastMessageRaw ? normalizeChatMessage(lastMessageRaw) : undefined;

  return {
    id: raw.id,
    isGroupRoom: raw.is_group_room ?? false,
    groupId: raw.group_id ?? null,
    groupName: raw.group_name ?? null,
    counterpart: raw.counterpart ? normalizeChatParticipant(raw.counterpart) : null,
    classCode: raw.class_code ?? raw.classCode ?? '',
    semesterName: raw.semester_name ?? raw.semesterName ?? '',
    status: raw.status ?? 'ACTIVE',
    unreadCount: raw.unread_count ?? raw.unreadCount ?? 0,
    lastMessage: normalizedLastMessage,
    lastMessagePreview: raw.last_message_preview ?? null,
    lastMessageAt: raw.last_message_at ?? null,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt:
      raw.updated_at ??
      raw.updatedAt ??
      normalizedLastMessage?.createdAt ??
      new Date().toISOString(),
  };
};

const normalizeMessagePage = (
  raw: RawPaged<RawChatMessage> | RawChatMessage[]
): ChatMessagePage => {
  if (Array.isArray(raw)) {
    return {
      data: raw.map(normalizeChatMessage),
      nextCursor: null,
      hasMore: false,
    };
  }

  const rows = (raw.data ?? raw.items ?? []).map(normalizeChatMessage);
  return {
    data: rows,
    nextCursor: raw.meta?.next_cursor ?? raw.meta?.nextCursor ?? null,
    hasMore: raw.meta?.has_more ?? raw.meta?.hasMore ?? false,
  };
};

export const listConversations = async (): Promise<ChatConversation[]> => {
  const response = await axiosClient.get<RawPaged<RawChatConversation>>(
    ENDPOINTS.CHAT.LIST_CONVERSATIONS
  );

  const rows = Array.isArray(response.data)
    ? response.data
    : (response.data.data ?? response.data.items ?? []);

  return rows.map(normalizeChatConversation);
};

export const createOrGetGroupConversation = async (
  params: GetOrCreateGroupConversationParams
): Promise<ChatConversation> => {
  const response = await axiosClient.post<RawChatConversation>(
    ENDPOINTS.CHAT.CREATE_GROUP_CONVERSATION,
    params
  );
  return normalizeChatConversation(response.data);
};

export const listMessages = async (
  conversationId: string,
  cursor?: string | null,
  limit = 20
): Promise<ChatMessagePage> => {
  const response = await axiosClient.get<RawPaged<RawChatMessage> | RawChatMessage[]>(
    ENDPOINTS.CHAT.LIST_MESSAGES(conversationId),
    {
      params: {
        cursor: cursor || undefined,
        limit,
      },
    }
  );

  return normalizeMessagePage(response.data);
};

export const sendMessageRest = async (
  conversationId: string,
  content: string,
  clientId?: string
): Promise<ChatMessage> => {
  const response = await axiosClient.post<RawChatMessage>(
    ENDPOINTS.CHAT.SEND_MESSAGE(conversationId),
    {
      content,
      type: 'TEXT',
      ...(clientId ? { client_id: clientId } : {}),
    }
  );
  return normalizeChatMessage(response.data);
};

export const markConversationRead = async (conversationId: string): Promise<void> => {
  await axiosClient.patch(ENDPOINTS.CHAT.MARK_READ(conversationId));
};
