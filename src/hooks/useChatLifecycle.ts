import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { chatSocket } from '@/services/chatSocket';
import { getAccessToken } from '@/utils/auth/session';
import { mapChatErrorToMessage } from '@/utils/chat/errorMap';
import { useChatStore } from '@/utils/stores/chatStore';
import { useUserStore } from '@/utils/stores/userStore';
import { showWarning } from '@/utils/toast';

export const useChatLifecycle = () => {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const logout = useUserStore((s) => s.logout);
  const connectingRef = useRef(false);

  useEffect(() => {
    const unsubscribers = [
      chatSocket.onConnectionStateChange((state) => {
        useChatStore.getState().setConnectionState(state);
      }),
      chatSocket.onNewMessage((message) => {
        useChatStore.getState().receiveSocketMessage(message);
      }),
      chatSocket.onMessageRead((event) => {
        useChatStore.getState().receiveSocketMessageRead(event);
      }),
      chatSocket.onTyping((event) => {
        useChatStore.getState().receiveSocketTyping(event);
      }),
      chatSocket.onError(async (event) => {
        const msg = mapChatErrorToMessage(event);

        if (event?.code === 'unauthorized') {
          await logout();
          return;
        }

        showWarning(msg, 'Chat Connection');
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [logout]);

  useEffect(() => {
    if (!isAuthenticated) {
      chatSocket.disconnect();
      useChatStore.getState().resetChatState();
      return;
    }

    let disposed = false;

    const connect = async () => {
      if (disposed || AppState.currentState !== 'active') return;
      if (connectingRef.current) return;
      if (chatSocket.state === 'connected' || chatSocket.state === 'connecting') return;

      connectingRef.current = true;

      try {
        const token = await getAccessToken();
        if (!token) {
          await logout();
          return;
        }

        await chatSocket.connect(token);

        if (!disposed) {
          await useChatStore.getState().loadConversations();
          await useChatStore.getState().retryAllFailedMessages();
        }
      } catch (error) {
        if (!disposed) {
          showWarning(mapChatErrorToMessage(error), 'Chat Connection');
        }
      } finally {
        connectingRef.current = false;
      }
    };

    connect();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        connect();
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        chatSocket.disconnect();
      }
    });

    const typingGc = setInterval(() => {
      useChatStore.getState().cleanupExpiredTyping();
    }, 1_500);

    return () => {
      disposed = true;
      connectingRef.current = false;
      appStateSub.remove();
      clearInterval(typingGc);
      chatSocket.disconnect();
    };
  }, [isAuthenticated, logout]);
};
