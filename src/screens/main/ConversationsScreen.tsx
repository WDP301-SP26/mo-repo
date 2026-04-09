import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@/components/icons';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import type { ChatConversation } from '@/types/chat';
import { useChatStore } from '@/utils/stores/chatStore';
import { showError } from '@/utils/toast';

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
};

const ConversationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.loadingConversations);
  const loadConversations = useChatStore((s) => s.loadConversations);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [conversations]
  );

  useFocusEffect(
    useCallback(() => {
      loadConversations().catch((error) => {
        showError(error?.response?.data?.message || 'Unable to load conversations');
      });
    }, [loadConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadConversations();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Unable to refresh conversations');
    } finally {
      setRefreshing(false);
    }
  }, [loadConversations]);

  const renderItem = useCallback(
    ({ item }: { item: ChatConversation }) => {
      const displayName = item.isGroupRoom
        ? (item.groupName ?? 'Group Chat')
        : (item.counterpart?.fullName ?? 'Unknown user');
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          className="mx-4 mb-3 rounded-2xl bg-[#1A2332] p-4"
          onPress={() =>
            navigation.navigate('ChatDetail', {
              conversationId: item.id,
              title: displayName,
            })
          }>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-semibold text-white" numberOfLines={1}>
                  {displayName}
                </Text>
                {item.isGroupRoom && (
                  <View className="rounded-md bg-[#7C3AED]/20 px-1.5 py-0.5">
                    <Text className="text-[9px] font-bold text-[#A78BFA]">GROUP</Text>
                  </View>
                )}
              </View>
              <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
                {item.classCode} · {item.semesterName}
              </Text>
              <Text className="mt-1 text-sm text-gray-400" numberOfLines={1}>
                {item.lastMessage?.content || 'No messages yet'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-500">{formatTime(item.updatedAt)}</Text>
              {item.unreadCount > 0 && (
                <View className="mt-2 h-6 min-w-6 items-center justify-center rounded-full bg-[#A78BFA] px-2">
                  <Text className="text-xs font-bold text-[#101922]">
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="px-4 py-3">
        <Text className="text-2xl font-black text-white">Chats</Text>
        <Text className="mt-1 text-sm text-gray-400">
          {unreadTotal > 0
            ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}`
            : 'All caught up'}
        </Text>
      </View>
      {loading && conversations.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#A78BFA"
              colors={['#A78BFA']}
            />
          }
          ListEmptyComponent={
            <View className="items-center px-8 py-20">
              <Feather name="message-circle" size={46} color="#475569" />
              <Text className="mt-3 text-center text-gray-400">No conversations yet</Text>
              <Text className="mt-1 text-center text-xs text-gray-600">
                Go to a class, open your group and tap Group Chat to start
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ConversationsScreen;
