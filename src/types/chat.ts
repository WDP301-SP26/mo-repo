export type ChatParticipantRole = 'STUDENT' | 'LECTURER' | string;

export interface ChatParticipant {
  id: string;
  fullName: string;
  role: ChatParticipantRole;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  readAt?: string | null;
  clientMessageId?: string;
}

export type LocalMessageStatus = 'sending' | 'sent' | 'failed';

export interface LocalChatMessage extends ChatMessage {
  localStatus?: LocalMessageStatus;
  localError?: string;
  localTempId?: string;
}

export interface ChatConversation {
  id: string;
  isGroupRoom: boolean;
  groupId?: string | null;
  groupName?: string | null;
  counterpart?: ChatParticipant | null;
  classCode: string;
  semesterName: string;
  status: string;
  lastMessage?: ChatMessage;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  updatedAt: string;
  createdAt?: string;
}

export interface ChatMessagePage {
  data: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Emitted by BE's chat:read event: { conversation_id, read_count, read_at }
export interface MessageReadEvent {
  conversationId: string;
  readCount: number;
  readAt: string;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  fullName?: string;
  isTyping: boolean;
}
