import { API_URL, CHAT_SOCKET_NAMESPACE, CHAT_WS_URL } from '@env';
import { io, Socket } from 'socket.io-client';
import { normalizeChatMessage } from '@/services/chatService';
import type { ChatMessage, MessageReadEvent, TypingEvent } from '@/types/chat';

export type ChatConnectionState = 'disconnected' | 'connecting' | 'connected';

type ChatErrorPayload = {
  code?: string;
  message?: string;
};

type ConnectionListener = (state: ChatConnectionState) => void;
type NewMessageListener = (message: ChatMessage) => void;
type ReadListener = (event: MessageReadEvent) => void;
type TypingListener = (event: TypingEvent) => void;
type ErrorListener = (event: ChatErrorPayload) => void;

class ChatSocketManager {
  private socket: Socket | null = null;
  private connectionState: ChatConnectionState = 'disconnected';
  private token: string | null = null;

  private connectionListeners = new Set<ConnectionListener>();
  private newMessageListeners = new Set<NewMessageListener>();
  private readListeners = new Set<ReadListener>();
  private typingListeners = new Set<TypingListener>();
  private errorListeners = new Set<ErrorListener>();

  get state() {
    return this.connectionState;
  }

  isConnected() {
    return this.connectionState === 'connected' && !!this.socket?.connected;
  }

  async connect(accessToken: string): Promise<void> {
    if (!accessToken) {
      throw new Error('Missing access token for chat socket');
    }

    this.token = accessToken;

    if (this.socket?.connected) {
      return;
    }

    this.setConnectionState('connecting');

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const origin = CHAT_WS_URL || API_URL;
    const namespace = CHAT_SOCKET_NAMESPACE || '/chat';
    const url = `${origin}${namespace}`;

    this.socket = io(url, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,
      auth: {
        token: accessToken,
      },
      extraHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    this.bindListeners(this.socket);

    await new Promise<void>((resolve, reject) => {
      const activeSocket = this.socket;
      if (!activeSocket) {
        reject(new Error('Unable to create chat socket'));
        return;
      }

      const onConnected = () => {
        cleanup();
        this.setConnectionState('connected');
        resolve();
      };

      const onError = (error: any) => {
        cleanup();
        this.setConnectionState('disconnected');
        reject(error instanceof Error ? error : new Error('Socket connection failed'));
      };

      const cleanup = () => {
        activeSocket.off('connect', onConnected);
        activeSocket.off('connect_error', onError);
      };

      activeSocket.once('connect', onConnected);
      activeSocket.once('connect_error', onError);
      activeSocket.connect();
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionState('disconnected');
  }

  // Force the server to re-run handleConnection so it re-joins any new conversation
  // rooms that were created after the initial connect. Reuses the existing socket
  // instance so event listeners stay intact.
  rejoinRooms() {
    const socket = this.socket;
    if (!socket || this.connectionState === 'connecting') return;
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  }

  // BE auto-joins conversation rooms on connect and on each chat:send/read/typing event.
  // No explicit join/leave needed from client.

  sendTypingStart(conversationId: string) {
    if (!this.socket?.connected || !conversationId) return;
    this.socket.emit('chat:typing:start', { conversation_id: conversationId });
  }

  sendTypingStop(conversationId: string) {
    if (!this.socket?.connected || !conversationId) return;
    this.socket.emit('chat:typing:stop', { conversation_id: conversationId });
  }

  sendRead(conversationId: string) {
    if (!this.socket?.connected || !conversationId) return;
    this.socket.emit('chat:read', { conversation_id: conversationId });
  }

  sendMessage(payload: {
    conversationId: string;
    content: string;
    clientMessageId: string;
  }): Promise<ChatMessage> {
    if (!this.socket?.connected) {
      return Promise.reject(new Error('Chat socket is not connected'));
    }

    return new Promise((resolve, reject) => {
      const data = {
        conversation_id: payload.conversationId,
        content: payload.content,
        type: 'TEXT',
        client_id: payload.clientMessageId,
      };

      this.socket?.timeout(7_000).emit('chat:send', data, (error: unknown, response: any) => {
        if (error) {
          reject(error instanceof Error ? error : new Error('Message send timeout'));
          return;
        }

        if (!response) {
          reject(new Error('Empty message acknowledgement'));
          return;
        }

        if (response.code) {
          // BE returned an error object
          reject(new Error(response.message || 'Send failed'));
          return;
        }

        const raw = response.data || response.message || response;
        resolve(normalizeChatMessage(raw));
      });
    });
  }

  onConnectionStateChange(listener: ConnectionListener) {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onNewMessage(listener: NewMessageListener) {
    this.newMessageListeners.add(listener);
    return () => this.newMessageListeners.delete(listener);
  }

  onMessageRead(listener: ReadListener) {
    this.readListeners.add(listener);
    return () => this.readListeners.delete(listener);
  }

  onTyping(listener: TypingListener) {
    this.typingListeners.add(listener);
    return () => this.typingListeners.delete(listener);
  }

  onError(listener: ErrorListener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setConnectionState(state: ChatConnectionState) {
    this.connectionState = state;
    this.connectionListeners.forEach((listener) => listener(state));
  }

  private bindListeners(socket: Socket) {
    socket.on('connect', () => {
      this.setConnectionState('connected');
    });

    socket.on('disconnect', () => {
      this.setConnectionState('disconnected');
    });

    socket.on('connect_error', (error: any) => {
      this.setConnectionState('disconnected');

      const rawMessage = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
      const isUnauthorized =
        rawMessage.includes('unauthorized') ||
        rawMessage.includes('jwt') ||
        rawMessage.includes('forbidden');

      this.errorListeners.forEach((listener) =>
        listener({
          code: isUnauthorized ? 'unauthorized' : 'socket_connect_error',
          message: error?.message || 'Socket connection failed',
        })
      );
    });

    // BE emits 'chat:new' when a new message arrives
    socket.on('chat:new', (payload: any) => {
      const raw = payload?.data || payload?.message || payload;
      if (!raw) return;
      this.newMessageListeners.forEach((listener) => listener(normalizeChatMessage(raw)));
    });

    // BE emits 'chat:read' with { conversation_id, read_count, read_at }
    socket.on('chat:read', (payload: any) => {
      const event: MessageReadEvent = {
        conversationId: payload?.conversation_id ?? payload?.conversationId ?? '',
        readCount: payload?.read_count ?? payload?.readCount ?? 0,
        readAt: payload?.read_at ?? payload?.readAt ?? new Date().toISOString(),
      };
      if (!event.conversationId) return;
      this.readListeners.forEach((listener) => listener(event));
    });

    // BE emits 'chat:typing' with { conversation_id, sender_id, is_typing }
    socket.on('chat:typing', (payload: any) => {
      const event: TypingEvent = {
        conversationId: payload?.conversation_id ?? payload?.conversationId ?? '',
        userId: payload?.sender_id ?? payload?.senderId ?? '',
        isTyping: Boolean(payload?.is_typing ?? payload?.isTyping),
      };
      if (!event.conversationId || !event.userId) return;
      this.typingListeners.forEach((listener) => listener(event));
    });

    socket.on('chat:error', (payload: ChatErrorPayload) => {
      this.errorListeners.forEach((listener) => listener(payload || {}));
    });
  }
}

export const chatSocket = new ChatSocketManager();
