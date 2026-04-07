import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@/components/icons';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { chatSocket } from '@/services/chatSocket';
import type { LocalChatMessage } from '@/types/chat';
import { useChatStore } from '@/utils/stores/chatStore';
import { useUserStore } from '@/utils/stores/userStore';
import { showError } from '@/utils/toast';

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
};

const EMPTY_MESSAGES: LocalChatMessage[] = [];

const ChatDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChatDetail'>>();

  const conversationId = route.params.conversationId;
  const title = route.params.title;

  const me = useUserStore((s) => s.userInfo);
  const messages = useChatStore((s) => s.messagesByConversation[conversationId] ?? EMPTY_MESSAGES);
  const typing = useChatStore((s) => s.typingByConversation[conversationId]);
  const page = useChatStore((s) => s.paginationByConversation[conversationId]);
  const loadingMessages = useChatStore((s) => s.loadingMessagesByConversation[conversationId]);
  const connectionState = useChatStore((s) => s.connectionState);

  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const retryFailedMessage = useChatStore((s) => s.retryFailedMessage);
  const markConversationAsRead = useChatStore((s) => s.markConversationAsRead);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList<LocalChatMessage>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayData = useMemo(() => [...messages].reverse(), [messages]);

  // Auto-scroll to the newest message whenever the latest message changes.
  // We track by the last item's id so pagination (which adds to the front)
  // does not trigger a scroll.
  const latestMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!latestMessageId) return;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [latestMessageId]);

  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);

      // Immediately join the conversation room via socket so we receive
      // chat:new events. This is especially important for conversations
      // created after the socket connected (BE only joins rooms at connect time).
      chatSocket.sendRead(conversationId);

      // Always reload messages on focus to pick up any missed messages.
      loadMessages(conversationId, { reset: true }).catch(() => {
        showError('Failed to load chat history');
      });

      markConversationAsRead(conversationId);

      return () => {
        setActiveConversation(null);
      };
    }, [conversationId, loadMessages, markConversationAsRead, setActiveConversation])
  );

  useEffect(() => {
    if (!conversationId) return;
    if (!messages.length) return;

    const latest = messages[messages.length - 1];
    if (latest.senderId !== me?.id) {
      markConversationAsRead(conversationId);
    }
  }, [conversationId, markConversationAsRead, me?.id, messages]);

  useEffect(() => {
    if (!conversationId) return;
    if (connectionState !== 'connected') return;

    // If focus happened before socket connected, this ensures the client
    // joins the conversation room immediately after reconnect.
    chatSocket.sendRead(conversationId);
  }, [connectionState, conversationId]);

  const handleTyping = (text: string) => {
    setInput(text);
    if (!conversationId) return;

    chatSocket.sendTypingStart(conversationId);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      chatSocket.sendTypingStop(conversationId);
    }, 900);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setInput('');
    chatSocket.sendTypingStop(conversationId);

    try {
      await sendMessage(conversationId, content);
    } catch {
      showError('Unable to send message right now');
    } finally {
      setIsSending(false);
    }
  };

  const loadOlder = useCallback(() => {
    if (!page?.hasMore || loadingMessages) return;
    loadMessages(conversationId, { reset: false }).catch(() => {
      // Keep quiet, user can retry by scrolling again.
    });
  }, [conversationId, loadMessages, loadingMessages, page?.hasMore]);

  const renderMessage = useCallback(
    ({ item }: { item: LocalChatMessage }) => {
      const mine = item.senderId === me?.id;
      return (
        <TouchableOpacity
          activeOpacity={item.localStatus === 'failed' ? 0.7 : 1}
          onPress={() => {
            if (item.localStatus === 'failed' && item.localTempId) {
              retryFailedMessage(conversationId, item.localTempId);
            }
          }}
          className={`mx-3 mb-2 ${mine ? 'items-end' : 'items-start'}`}>
          <View
            className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? 'bg-[#7C3AED]' : 'bg-[#1A2332]'}`}>
            <Text className="text-sm leading-5 text-white">{item.content}</Text>
            <View className="mt-1 flex-row items-center justify-end gap-1">
              {item.localStatus === 'failed' && (
                <Text className="text-[10px] text-[#FCA5A5]">Tap to retry</Text>
              )}
              {item.localStatus === 'sending' && (
                <Text className="text-[10px] text-white/80">Sending...</Text>
              )}
              <Text className="text-[10px] text-white/70">{formatMessageTime(item.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [conversationId, me?.id, retryFailedMessage]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="h-14 flex-row items-center border-b border-[#1A2332] px-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Feather name="arrow-left" size={20} color="#E2E8F0" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-semibold text-white" numberOfLines={1}>
            {title || 'Conversation'}
          </Text>
          <Text className="text-xs text-gray-400">
            {connectionState === 'connected' ? 'Online' : 'Reconnecting...'}
          </Text>
        </View>
      </View>

      {connectionState !== 'connected' && (
        <View className="mx-4 mt-3 rounded-lg border border-[#4B5563] bg-[#1F2937] px-3 py-2">
          <Text className="text-xs text-gray-200">
            Connection is unstable. Messages will retry automatically when network is back.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 82 : 0}>
        {loadingMessages && messages.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#A78BFA" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayData}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 12 }}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            removeClippedSubviews={true}
            onEndReachedThreshold={0.15}
            onEndReached={loadOlder}
            ListFooterComponent={
              loadingMessages ? (
                <View className="py-3">
                  <ActivityIndicator size="small" color="#A78BFA" />
                </View>
              ) : null
            }
          />
        )}

        {typing && (
          <View className="px-4 pb-2">
            <Text className="text-xs text-gray-400">
              {typing.fullName || 'Someone'} is typing...
            </Text>
          </View>
        )}

        <View className="flex-row items-end border-t border-[#1A2332] bg-[#101922] px-3 py-2">
          <TextInput
            value={input}
            onChangeText={handleTyping}
            placeholder="Type your message"
            placeholderTextColor="#64748B"
            className="max-h-28 flex-1 rounded-2xl bg-[#1A2332] px-4 py-3 text-white"
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            className={`ml-2 h-11 w-11 items-center justify-center rounded-full ${
              input.trim() ? 'bg-[#A78BFA]' : 'bg-[#334155]'
            }`}
            onPress={handleSend}
            disabled={!input.trim() || isSending}>
            <Feather name="arrow-right" size={18} color={input.trim() ? '#101922' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatDetailScreen;
