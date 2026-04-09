import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getGroups, joinGroup } from '@/services/groupService';
import { getCurrentSemester, type SerializedSemester } from '@/services/semesterService';
import { showError, showInfo, showSuccess } from '@/utils/toast';
import type { Group, GroupStatus } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const STATUS_CONFIG: Record<GroupStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/15' },
  ARCHIVED: { label: 'Archived', color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  COMPLETED: { label: 'Completed', color: 'text-blue-400', bg: 'bg-blue-500/15' },
};

// ==================== Memoized Components ====================

/**
 * Card shown when user is browsing available public groups.
 * Shows group name, status, member count, and a "Request to Join" button.
 */
const PublicGroupCard = React.memo(
  ({
    item,
    onJoinRequest,
    onPress,
    interactionDisabled,
  }: {
    item: Group;
    onJoinRequest: (group: Group) => void;
    onPress: (id: string) => void;
    interactionDisabled: boolean;
  }) => {
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ACTIVE;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(item.id)}
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        {/* Header */}
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="mb-1.5 flex-row items-center gap-2">
              <View className={`rounded-md px-2 py-0.5 ${statusCfg.bg}`}>
                <Text className={`text-[10px] font-semibold ${statusCfg.color}`}>
                  {statusCfg.label}
                </Text>
              </View>
              {item.semester && <Text className="text-xs text-gray-500">{item.semester}</Text>}
            </View>
            <Text className="text-lg font-bold text-white">{item.name}</Text>
            {item.project_name && (
              <Text className="mt-0.5 text-sm text-gray-400">{item.project_name}</Text>
            )}
          </View>
        </View>

        {/* Integration Tags */}
        <View className="mt-3 flex-row gap-1.5">
          {item.jira_project_key && (
            <View className="rounded-lg bg-[#0052CC]/15 px-2.5 py-1">
              <Text className="text-xs font-medium text-[#4C9AFF]">
                Jira: {item.jira_project_key}
              </Text>
            </View>
          )}
          {item.github_repo_url && (
            <View className="rounded-lg bg-[#7C3AED]/15 px-2.5 py-1">
              <Text className="text-xs font-medium text-[#7C3AED]">GitHub</Text>
            </View>
          )}
        </View>

        {/* Footer Row */}
        <View className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-3">
          <View className="flex-row items-center gap-1">
            <MaterialIcons name="group" size={16} color="#64748B" />
            <Text className="text-xs text-gray-400">
              {item.members_count} member{item.members_count !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            disabled={interactionDisabled}
            onPress={() => onJoinRequest(item)}
            activeOpacity={0.8}
            className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
              interactionDisabled ? 'bg-[#334155]' : 'bg-[#7C3AED]'
            }`}>
            <Feather name="user-plus" size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">
              {interactionDisabled ? 'Locked' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }
);

/** Memoized empty state for public groups */
const EmptyState = React.memo(() => (
  <View className="items-center py-16">
    <MaterialIcons name="search-off" size={48} color="#64748B" />
    <Text className="mt-3 text-base text-gray-400">No groups available</Text>
    <Text className="mt-1 px-8 text-center text-sm text-gray-500">
      Ask your instructor or class leader to create a group
    </Text>
  </View>
));

// ==================== Main Component ====================

const GroupsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── State ────────────────────────────────────────
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const isMounted = useRef(true);

  const isGroupInteractionLocked = useCallback(
    (groupItem: Group | null | undefined) => {
      if (!groupItem || !currentSemester) return false;

      if (currentSemester.status !== 'ACTIVE') return true;

      const itemSemester = groupItem.semester?.trim().toUpperCase();
      const currentCode = currentSemester.code?.trim().toUpperCase();
      if (!itemSemester || !currentCode) return false;

      return itemSemester !== currentCode;
    },
    [currentSemester]
  );

  const isCreateLocked = !!currentSemester && currentSemester.status !== 'ACTIVE';

  // ── Fetch Groups ─────────────────────────────────

  const fetchGroups = useCallback(
    async (pageNum = 1, isRefresh = false) => {
      try {
        if (pageNum === 1 && !isRefresh) setLoading(true);

        const result = await getGroups({
          page: pageNum,
          limit: 20,
          search: searchQuery.trim() || undefined,
        });
        const semester = await getCurrentSemester().catch(() => null);

        if (!isMounted.current) return;

        if (pageNum === 1) {
          setPublicGroups(result.data);
        } else {
          setPublicGroups((prev) => [...prev, ...result.data]);
        }

        setPage(pageNum);
        setTotalPages(result.meta.total_pages);
        setCurrentSemester(semester);
      } catch (error: any) {
        if (!isMounted.current) return;
        showError(error.response?.data?.message || 'Failed to load groups');
      } finally {
        if (isMounted.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [searchQuery]
  );

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      const task = InteractionManager.runAfterInteractions(() => {
        fetchGroups(1);
      });
      return () => {
        isMounted.current = false;
        task.cancel();
      };
    }, [fetchGroups])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups(1, true);
  }, [fetchGroups]);

  const onLoadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    fetchGroups(page + 1);
  }, [loadingMore, page, totalPages, fetchGroups]);

  // ── Actions ──────────────────────────────────────

  const handleGroupPress = useCallback(
    (groupId: string) => {
      navigation.navigate('GroupDetail', { groupId });
    },
    [navigation]
  );

  const handleJoinRequest = useCallback(
    async (groupItem: Group) => {
      if (isGroupInteractionLocked(groupItem)) {
        showInfo('This group is outside the current active semester. Join is read-only.');
        return;
      }

      try {
        await joinGroup(groupItem.id);
        showSuccess(`Joined ${groupItem.name} successfully`, 'Enrolled 🎉');
        fetchGroups(1, true);
      } catch (error: any) {
        showError(error.response?.data?.message || 'Failed to join group');
      }
    },
    [fetchGroups, isGroupInteractionLocked]
  );

  const handleCreatePress = useCallback(() => {
    if (isCreateLocked) {
      showInfo('Current semester is not ACTIVE. Group creation is read-only.');
      return;
    }

    navigation.navigate('CreateGroup');
  }, [navigation, isCreateLocked]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // ── FlatList callbacks ───────────────────────────

  const renderPublicGroup = useCallback(
    ({ item }: { item: Group }) => (
      <PublicGroupCard
        item={item}
        onJoinRequest={handleJoinRequest}
        onPress={handleGroupPress}
        interactionDisabled={isGroupInteractionLocked(item)}
      />
    ),
    [handleGroupPress, handleJoinRequest, isGroupInteractionLocked]
  );

  const hasReadOnlySemesterItems = useMemo(() => {
    if (!currentSemester) return false;
    return publicGroups.some((item) => isGroupInteractionLocked(item));
  }, [publicGroups, currentSemester, isGroupInteractionLocked]);

  const keyExtractor = useCallback((item: Group) => item.id, []);

  const ListFooter = useMemo(
    () =>
      loadingMore ? (
        <ActivityIndicator size="small" color="#7C3AED" style={{ paddingVertical: 16 }} />
      ) : null,
    [loadingMore]
  );

  const ListEmpty = useMemo(() => <EmptyState />, []);

  // ── Main Render ──────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="text-2xl font-bold text-white">Groups</Text>
          <Text className="mt-0.5 text-sm text-gray-400">Browse and join a team</Text>
        </View>
        <TouchableOpacity
          disabled={isCreateLocked}
          onPress={handleCreatePress}
          activeOpacity={0.8}
          className={`h-10 w-10 items-center justify-center rounded-xl ${
            isCreateLocked ? 'bg-[#334155]' : 'bg-[#7C3AED]'
          }`}>
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {hasReadOnlySemesterItems && (
        <View className="mx-4 mb-3 mt-1 flex-row items-start gap-2 rounded-xl bg-amber-900/30 px-3 py-2.5">
          <Feather name="clock" size={14} color="#FCD34D" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-amber-300">
            Some groups are outside the current active semester. You can view them, but joining is
            disabled.
          </Text>
        </View>
      )}

      {/* Search (only when browsing public groups or always visible) */}
      <View className="mb-3 px-4">
        <View
          className={`h-12 flex-row items-center rounded-xl border bg-[#1A2332] px-3 ${
            searchFocused ? 'border-[#7C3AED]' : 'border-white/10'
          }`}>
          <Feather name="search" size={18} color={searchFocused ? '#7C3AED' : '#64748B'} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onSubmitEditing={() => fetchGroups(1)}
            returnKeyType="search"
            placeholder="Search groups..."
            placeholderTextColor="#64748B"
            className="ml-2 flex-1 text-sm text-white"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={publicGroups}
          renderItem={renderPublicGroup}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          // Performance
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          // Features
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={ListEmpty}
        />
      )}
    </SafeAreaView>
  );
};

export default GroupsScreen;
