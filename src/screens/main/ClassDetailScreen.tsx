import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  InteractionManager,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { getGroupsByClass, joinGroup } from '@/services/groupService';
import { createOrGetGroupConversation } from '@/services/chatService';
import { getCurrentSemester, getCurrentWeek, type SerializedSemester } from '@/services/semesterService';
import { showError, showInfo, showSuccess } from '@/utils/toast';
import type { Group } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';

// ==================== Types ====================

interface ClassGroup extends Group {
  members?: { user_id: string; full_name: string; role: string }[];
  topic?: { id: string; name: string } | null;
}

// ==================== Memoized Components ====================

const GroupCard = React.memo(
  ({
    item,
    onPress,
    onJoin,
    onChat,
    isMine,
    chatLoading,
    interactionDisabled,
  }: {
    item: ClassGroup;
    onPress: (id: string) => void;
    onJoin: (id: string, name: string) => void;
    onChat: (id: string) => void;
    isMine: boolean;
    chatLoading: boolean;
    interactionDisabled: boolean;
  }) => {
    const isEmpty = item.members_count === 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(item.id)}
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-bold text-white">{item.name}</Text>
            {item.topic && (
              <View className="mt-1 flex-row items-center gap-1.5">
                <Feather name="book-open" size={12} color="#64748B" />
                <Text className="text-xs text-gray-400">{item.topic.name}</Text>
              </View>
            )}
            {item.project_name && (
              <Text className="mt-0.5 text-sm text-gray-400">{item.project_name}</Text>
            )}
          </View>
          {isMine && (
            <View className="rounded-lg bg-[#7C3AED]/20 px-2.5 py-1">
              <Text className="text-[10px] font-bold text-[#A78BFA]">Your Group</Text>
            </View>
          )}
        </View>

        {/* Members preview */}
        {(item.members?.length ?? 0) > 0 && (
          <View className="mt-3 gap-1">
            {item.members?.slice(0, 3).map((m) => (
              <View key={m.user_id} className="flex-row items-center gap-2">
                <View className="h-5 w-5 items-center justify-center rounded-full bg-[#243447]">
                  <Text className="text-[9px] font-bold text-white">
                    {m.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text className="text-xs text-gray-300">{m.full_name}</Text>
                <Text className="text-[10px] text-gray-600">{m.role}</Text>
              </View>
            ))}
            {(item.members?.length ?? 0) > 3 && (
              <Text className="ml-7 text-[10px] text-gray-500">
                +{(item.members?.length ?? 0) - 3} more
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-3">
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="group" size={16} color="#64748B" />
            <Text className="text-xs text-gray-400">
              {item.members_count} member{item.members_count !== 1 ? 's' : ''}
            </Text>
          </View>
          {isMine ? (
            <TouchableOpacity
              onPress={() => onChat(item.id)}
              disabled={chatLoading || interactionDisabled}
              activeOpacity={0.8}
              className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
                interactionDisabled ? 'bg-[#334155]' : 'bg-[#243447]'
              }`}>
              {chatLoading ? (
                <ActivityIndicator size="small" color="#A78BFA" />
              ) : (
                <Feather name="message-circle" size={14} color="#A78BFA" />
              )}
              <Text className="text-xs font-semibold text-[#A78BFA]">Group Chat</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              disabled={interactionDisabled}
              onPress={() => onJoin(item.id, item.name)}
              activeOpacity={0.8}
              className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
                interactionDisabled ? 'bg-[#334155]' : isEmpty ? 'bg-[#7C3AED]' : 'bg-[#243447]'
              }`}>
              <Feather
                name={isEmpty ? 'log-in' : 'user-plus'}
                size={14}
                color={isEmpty ? '#fff' : '#A78BFA'}
              />
              <Text
                className={`text-xs font-semibold ${
                  interactionDisabled ? 'text-white' : isEmpty ? 'text-white' : 'text-[#A78BFA]'
                }`}>
                {interactionDisabled ? 'Locked' : 'Join'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

// ==================== Main Component ====================

const ClassDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
  const { classId } = route.params;

  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatLoadingGroupId, setChatLoadingGroupId] = useState<string | null>(null);
  const currentUser = useUserStore((s) => s.userInfo);

  const isGroupInteractionLocked = useCallback(
    (groupItem: ClassGroup | null | undefined) => {
      if (!groupItem || !currentSemester) return false;

      if (currentSemester.status !== 'ACTIVE') return true;

      const groupSemester = groupItem.semester?.trim().toUpperCase();
      const currentCode = currentSemester.code?.trim().toUpperCase();
      if (!groupSemester || !currentCode) return false;

      return groupSemester !== currentCode;
    },
    [currentSemester]
  );

  // Check if user joined any group → filter to only show their group
  const myGroup = groups.find((g) => g.members?.some((m) => m.user_id === currentUser?.id));
  const displayGroups = myGroup ? [myGroup] : groups;

  // ── Fetch ────────────────────────────────────────

  const fetchGroups = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const [data, semester] = await Promise.all([
          getGroupsByClass(classId),
          getCurrentSemester().catch(() => null),
        ]);
        setGroups(data as ClassGroup[]);
        setCurrentSemester(semester);
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to load groups');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classId]
  );

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchGroups();
      });
      return () => task.cancel();
    }, [fetchGroups])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups(true);
  }, [fetchGroups]);

  // ── Actions ──────────────────────────────────────

  const handleGroupPress = useCallback(
    (groupId: string) => {
      navigation.navigate('GroupDetail', { groupId });
    },
    [navigation]
  );

  const handleJoinGroup = useCallback(
    async (groupId: string, groupName: string) => {
      const targetGroup = groups.find((g) => g.id === groupId) ?? null;
      if (isGroupInteractionLocked(targetGroup)) {
        showInfo('This group is outside the current active semester. Join is read-only.');
        return;
      }

      try {
        const result = await joinGroup(groupId);
        showSuccess(`Joined ${groupName} as ${result.role_assigned}`, 'Welcome! 🎉');
        fetchGroups(true);
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to join group');
      }
    },
    [fetchGroups, groups, isGroupInteractionLocked]
  );

  // ── Chat with Group ──────────────────────────────

  const handleChatWithGroup = useCallback(
    async (groupId: string) => {
      if (!currentUser) return;

      const targetGroup = groups.find((g) => g.id === groupId) ?? null;
      if (isGroupInteractionLocked(targetGroup)) {
        showInfo('This group is outside the current active semester. Chat is read-only.');
        return;
      }

      setChatLoadingGroupId(groupId);
      try {
        const { semester } = await getCurrentWeek();
        if (!semester) {
          showError('No active semester found');
          return;
        }
        const group = groups.find((g) => g.id === groupId);
        const conversation = await createOrGetGroupConversation({
          semester_id: semester.id,
          class_id: classId,
          group_id: groupId,
        });
        navigation.navigate('ChatDetail', {
          conversationId: conversation.id,
          title: group?.name ?? conversation.groupName ?? 'Group Chat',
        });
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Unable to open group chat');
      } finally {
        setChatLoadingGroupId(null);
      }
    },
    [classId, currentUser, groups, navigation, isGroupInteractionLocked]
  );

  // ── Render ───────────────────────────────────────

  const renderGroup = useCallback(
    ({ item }: { item: ClassGroup }) => {
      const isMine = item.members?.some((m) => m.user_id === currentUser?.id) ?? false;
      return (
        <GroupCard
          item={item}
          onPress={handleGroupPress}
          onJoin={handleJoinGroup}
          onChat={handleChatWithGroup}
          isMine={isMine}
          chatLoading={chatLoadingGroupId === item.id}
          interactionDisabled={isGroupInteractionLocked(item)}
        />
      );
    },
    [
      handleGroupPress,
      handleJoinGroup,
      handleChatWithGroup,
      chatLoadingGroupId,
      currentUser,
      isGroupInteractionLocked,
    ]
  );

  const hasReadOnlySemesterItems = displayGroups.some((item) => isGroupInteractionLocked(item));

  const keyExtractor = useCallback((item: ClassGroup) => item.id, []);

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold text-white">Class Groups</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {myGroup
              ? 'You are in a group'
              : `${groups.length} group${groups.length !== 1 ? 's' : ''} available`}
          </Text>
        </View>
      </View>

      {hasReadOnlySemesterItems && (
        <View className="mx-4 mb-3 mt-1 flex-row items-start gap-2 rounded-xl bg-amber-900/30 px-3 py-2.5">
          <Feather name="clock" size={14} color="#FCD34D" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-amber-300">
            Some groups are outside the current active semester. Join/chat actions are disabled.
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={displayGroups}
          renderItem={renderGroup}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <MaterialIcons name="groups" size={48} color="#64748B" />
              <Text className="mt-3 text-base text-gray-400">No groups in this class yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ClassDetailScreen;
