import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  InteractionManager,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showError, showInfo } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getProfile } from '@/services/authService';
import { getAccessToken } from '@/utils/auth/session';
import { getMyGroups } from '@/services/studentService';
import { getNotifications } from '@/services/notificationService';
import { getJiraProjects } from '@/services/jiraService';
import { getTasks, type TaskItem } from '@/services/taskService';
import { getCurrentSemester, type SerializedSemester } from '@/services/semesterService';
import type { Group } from '@/types/group';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  TO_DO: '#64748B',
  IN_PROGRESS: '#0EA5E9',
  DONE: '#22C55E',
  BLOCKED: '#EF4444',
};

const STATUS_LABEL: Record<string, string> = {
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#64748B',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
};

const getValidJiraSiteOrigin = (rawUrl?: string | null): string | null => {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('.atlassian.net')) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const normalizeNamePart = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const GroupCard = React.memo(
  ({
    group,
    isActive,
    onOpen,
    onOpenJira,
  }: {
    group: Group;
    isActive: boolean;
    onOpen: () => void;
    onOpenJira: () => void;
  }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onOpen}
      className={`mr-3 rounded-3xl p-4 ${isActive ? 'bg-[#21334A]' : 'bg-[#1A2332]'}`}
      style={{ width: Math.min(Dimensions.get('window').width - 48, 320) }}>
      <View className="flex-row items-center justify-between">
        <View className="rounded-lg bg-[#0EA5E9]/20 px-2.5 py-1">
          <Text className="text-xs font-semibold text-[#7DD3FC]">
            {group.semester || 'Current Semester'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View
            className={`h-2 w-2 rounded-full ${group.status === 'ACTIVE' ? 'bg-green-400' : 'bg-slate-500'}`}
          />
          <Text
            className={`text-xs ${group.status === 'ACTIVE' ? 'text-green-300' : 'text-slate-400'}`}>
            {group.status === 'ACTIVE' ? 'Active' : group.status}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-xl font-bold text-white" numberOfLines={1}>
        {group.name}
      </Text>
      <Text className="mt-1 text-sm text-[#CBD5E1]" numberOfLines={1}>
        {group.project_name || 'No project title yet'}
      </Text>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="people" size={14} color="#94A3B8" />
          <Text className="text-xs text-[#94A3B8]">{group.members_count} members</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {!!group.jira_project_key && (
            <TouchableOpacity
              className="rounded-lg bg-[#1D4ED8]/30 px-2 py-0.5"
              activeOpacity={0.8}
              onPress={(event) => {
                event.stopPropagation();
                onOpenJira();
              }}>
              <Text className="text-[10px] font-semibold text-[#93C5FD]">
                JIRA · {group.jira_project_key}
              </Text>
            </TouchableOpacity>
          )}
          {!!group.github_repo_url && (
            <View className="rounded-lg bg-white/10 px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-slate-300">GitHub</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
);

const StatChip = ({ label, count, color }: { label: string; count: number; color: string }) => (
  <View className="flex-1 items-center rounded-xl bg-[#0F172A] px-2 py-3">
    <Text className="text-xl font-black text-white">{count}</Text>
    <View className="mt-1 flex-row items-center gap-1">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-[10px] font-medium text-slate-400">{label}</Text>
    </View>
  </View>
);

const TaskRow = ({ task, onPress }: { task: TaskItem; onPress: () => void }) => {
  const now = new Date();
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const isOverdue = dueDate && dueDate < now && task.status !== 'DONE';
  const isDueSoon =
    dueDate &&
    !isOverdue &&
    dueDate.getTime() - now.getTime() < 48 * 60 * 60 * 1000 &&
    task.status !== 'DONE';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="flex-row items-center gap-3 border-b border-white/5 py-3">
      {/* Priority bar */}
      <View
        className="h-10 w-1 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[task.priority] ?? '#64748B' }}
      />

      <View className="flex-1">
        <Text className="text-sm font-semibold text-white" numberOfLines={1}>
          {task.title}
        </Text>
        {dueDate && (
          <Text
            className={`mt-0.5 text-xs ${isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-slate-500'}`}>
            {isOverdue ? '⚠ Overdue · ' : isDueSoon ? '⏰ Due soon · ' : ''}
            {dueDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
          </Text>
        )}
      </View>

      {/* Status chip */}
      <View
        className="rounded-md px-2 py-0.5"
        style={{ backgroundColor: (STATUS_COLOR[task.status] ?? '#64748B') + '30' }}>
        <Text
          className="text-[10px] font-bold"
          style={{ color: STATUS_COLOR[task.status] ?? '#64748B' }}>
          {STATUS_LABEL[task.status] ?? task.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

const DashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userInfo = useUserStore((state) => state.userInfo);
  const loginToStore = useUserStore((state) => state.login);
  const logout = useUserStore((state) => state.logout);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [groupTasks, setGroupTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [jiraSiteByKey, setJiraSiteByKey] = useState<Record<string, string>>({});
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const displayName = (
    userInfo?.fullName ||
    ((userInfo as unknown as { full_name?: string } | null)?.full_name ?? '') ||
    userInfo?.email?.split('@')?.[0] ||
    ''
  ).trim();

  const firstName = normalizeNamePart(
    displayName ? displayName.split(/\s+/).pop() || displayName : 'bạn'
  );
  const cardWidth = Math.min(Dimensions.get('window').width - 48, 320);

  const activeGroup = groups[activeIndex] ?? null;

  useEffect(() => {
    let active = true;

    const hydrateMissingUser = async () => {
      if (userInfo) return;

      const token = await getAccessToken();
      if (!token) {
        return;
      }

      try {
        const profile = await getProfile();

        if (!active) return;

        await loginToStore({
          access_token: token,
          user: profile,
        });
      } catch {
        await logout();

        if (active) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'SignIn' }],
          });
        }
      }
    };

    hydrateMissingUser();

    return () => {
      active = false;
    };
  }, [userInfo, loginToStore, logout, navigation]);

  // ── Task stats derived from groupTasks ──
  const { todoCount, inProgressCount, doneCount, totalCount, progressPct } = useMemo(() => {
    const todo = groupTasks.filter((t) => t.status === 'TO_DO').length;
    const inProgress = groupTasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const done = groupTasks.filter((t) => t.status === 'DONE').length;
    const total = groupTasks.length;

    return {
      todoCount: todo,
      inProgressCount: inProgress,
      doneCount: done,
      totalCount: total,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [groupTasks]);

  // ── My tasks: assigned to current user, not done, sorted by due_at ──
  const myTasks = useMemo(
    () =>
      groupTasks
        .filter((t) => {
          if (t.status === 'DONE') return false;
          return t.assignee_id === userInfo?.id;
        })
        .sort((a, b) => {
          if (!a.due_at && !b.due_at) return 0;
          if (!a.due_at) return 1;
          if (!b.due_at) return -1;
          return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        })
        .slice(0, 4),
    [groupTasks, userInfo?.id]
  );

  const loadTasksForGroup = useCallback(async (groupId: string) => {
    setTasksLoading(true);
    try {
      const tasks = await getTasks({ group_id: groupId, limit: 100 });
      setGroupTasks(tasks);
    } catch {
      setGroupTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      const shouldBlock = !options?.silent || !hasBootstrapped;
      try {
        if (shouldBlock) setLoading(true);

        const [allGroups, notifications, semester] = await Promise.all([
          getMyGroups(),
          getNotifications().catch(() => []),
          getCurrentSemester().catch(() => null),
        ]);
        setCurrentSemester(semester);

        setGroups(allGroups);
        setUnreadCount(notifications.filter((n) => !n.is_read).length);

        const groupProjectKeys = allGroups
          .map((group) => group.jira_project_key?.trim().toUpperCase())
          .filter((key): key is string => !!key);

        if (groupProjectKeys.length > 0) {
          getJiraProjects()
            .then((projects) => {
              const keySet = new Set(groupProjectKeys);
              const nextSiteMap: Record<string, string> = {};

              for (const project of projects) {
                const key = project.key?.trim().toUpperCase();
                if (!key || !keySet.has(key)) continue;

                const siteOrigin =
                  getValidJiraSiteOrigin(project.siteUrl) || getValidJiraSiteOrigin(project.self);

                if (siteOrigin) {
                  nextSiteMap[key] = siteOrigin;
                }
              }

              if (Object.keys(nextSiteMap).length > 0) {
                setJiraSiteByKey((prev) => ({ ...prev, ...nextSiteMap }));
              }
            })
            .catch(() => {
              // Non-blocking: fallback URL still works.
            });
        }

        if (allGroups.length === 0) {
          setGroupTasks([]);
          setActiveIndex(0);
          return;
        }

        const currentIndex = Math.min(activeIndex, allGroups.length - 1);
        setActiveIndex(currentIndex);
        await loadTasksForGroup(allGroups[currentIndex].id);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load dashboard');
      } finally {
        if (shouldBlock) setLoading(false);
        if (!hasBootstrapped) setHasBootstrapped(true);
      }
    },
    [activeIndex, hasBootstrapped, loadTasksForGroup]
  );

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]).start();
        loadData({ silent: true });
      });
      return () => {
        task.cancel();
        fadeAnim.setValue(0);
        slideAnim.setValue(20);
      };
    }, [fadeAnim, slideAnim, loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const onGroupSliderEnd = useCallback(
    async (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const index = Math.round(x / (cardWidth + 12));
      if (index !== activeIndex && index >= 0 && index < groups.length) {
        setActiveIndex(index);
        await loadTasksForGroup(groups[index].id);
      }
    },
    [activeIndex, cardWidth, groups, loadTasksForGroup]
  );

  const openGroupDetail = useCallback(
    (groupId?: string) => {
      const id = groupId ?? activeGroup?.id;
      if (id) navigation.navigate('GroupDetail', { groupId: id });
    },
    [navigation, activeGroup]
  );

  const openJiraProject = useCallback(
    async (group: Group) => {
      const projectKey = group.jira_project_key?.trim();
      if (!projectKey) {
        showError('Jira project key is missing');
        return;
      }

      const normalizedKey = projectKey.toUpperCase();
      const jiraSiteUrl = getValidJiraSiteOrigin(jiraSiteByKey[normalizedKey]);
      const projectUrl = jiraSiteUrl
        ? `${jiraSiteUrl}/jira/software/projects/${encodeURIComponent(projectKey)}/summary`
        : null;
      const fallbackUrl = 'https://start.atlassian.com';

      try {
        if (projectUrl) {
          const canOpenProjectUrl = await Linking.canOpenURL(projectUrl);
          if (canOpenProjectUrl) {
            await Linking.openURL(projectUrl);
            return;
          }
        }

        await Linking.openURL(fallbackUrl);
        showInfo('Could not resolve project site, opened Atlassian home instead.');
      } catch {
        showError('Cannot open Jira URL');
      }
    },
    [jiraSiteByKey]
  );

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <Animated.View
        className="flex-row items-center justify-between px-4 pb-1 pt-2"
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View>
          <Text className="text-sm text-sky-300">Welcome, {firstName} 👋</Text>
          <Text className="mt-0.5 text-2xl font-black text-white">Team Board</Text>
        </View>
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full bg-[#1A2332]"
          // onPress={() => navigation.navigate('LinkedAccounts')}
        >
          <Feather name="bell" size={20} color="#94A3B8" />
          {unreadCount > 0 && (
            <View className="absolute right-1.5 top-1.5 h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1">
              <Text className="text-[9px] font-bold text-white">{Math.min(unreadCount, 99)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Semester UPCOMING banner (Task 1) ───────────────────── */}
      {currentSemester?.status === 'UPCOMING' && (
        <View className="mx-4 mb-1 mt-2 flex-row items-start gap-3 rounded-2xl bg-amber-900/30 px-4 py-3">
          <Feather name="clock" size={16} color="#FCD34D" style={{ marginTop: 1 }} />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-amber-300">
              Học kỳ {currentSemester.name} chưa bắt đầu
            </Text>
            <Text className="mt-0.5 text-xs text-amber-400/80">
              Sẽ bắt đầu vào{' '}
              {new Date(currentSemester.start_date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              . Hiện tại đang ở chế độ xem trước — một số thao tác bị tạm khóa.
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0EA5E9"
            colors={['#0EA5E9']}
          />
        }>
        {/* ── Groups Carousel ─────────────────────────────────────── */}
        <Animated.View
          className="mt-4"
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View className="mb-3 flex-row items-center justify-between px-4">
            <Text className="text-base font-bold text-white">
              Your Groups
              {groups.length > 0 && (
                <Text className="font-normal text-slate-500"> · {groups.length}</Text>
              )}
            </Text>
            {groups.length > 1 && <Text className="text-xs text-slate-400">Swipe to switch</Text>}
          </View>

          {groups.length > 0 ? (
            <>
              <FlatList
                horizontal
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <GroupCard
                    group={item}
                    isActive={index === activeIndex}
                    onOpen={() => openGroupDetail(item.id)}
                    onOpenJira={() => openJiraProject(item)}
                  />
                )}
                snapToInterval={cardWidth + 12}
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                onMomentumScrollEnd={onGroupSliderEnd}
              />

              {/* Pagination dots */}
              {groups.length > 1 && (
                <View className="mt-3 flex-row justify-center gap-1.5">
                  {groups.map((g, index) => (
                    <View
                      key={g.id}
                      className={`rounded-full ${index === activeIndex ? 'h-2 w-5 bg-sky-400' : 'h-2 w-2 bg-slate-600'}`}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View className="mx-4 items-center rounded-2xl border border-dashed border-white/10 bg-[#1A2332] p-6">
              <MaterialIcons name="group-add" size={44} color="#475569" />
              <Text className="mb-4 mt-3 text-center text-gray-400">
                You are not part of any group yet. Join or create a group to get started!
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Classes' as never)}
                className="rounded-xl bg-sky-600 px-5 py-3">
                <Text className="font-semibold text-white">Explore Groups</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* ── Active Group Overview ────────────────────────────────── */}
        {!!activeGroup && (
          <Animated.View className="mt-5 px-4" style={{ opacity: fadeAnim }}>
            <View className="rounded-2xl border border-[#1E3A5F] bg-[#13263B] p-4">
              {/* Title row */}
              <View className="mb-3 flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                    Active Group
                  </Text>
                  <Text className="mt-0.5 text-lg font-bold text-white" numberOfLines={1}>
                    {activeGroup.name}
                  </Text>
                  {!!activeGroup.project_name && (
                    <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1}>
                      {activeGroup.project_name}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => openGroupDetail()}
                  className="flex-row items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2">
                  <Text className="text-xs font-semibold text-white">Open</Text>
                  <Feather name="arrow-right" size={12} color="white" />
                </TouchableOpacity>
              </View>

              {/* Task progress bar */}
              {tasksLoading ? (
                <ActivityIndicator size="small" color="#0EA5E9" className="my-2" />
              ) : totalCount > 0 ? (
                <>
                  <View className="mb-1.5 flex-row items-center justify-between">
                    <Text className="text-xs text-slate-400">Task Progress</Text>
                    <Text className="text-xs font-bold text-sky-300">
                      {doneCount}/{totalCount} done · {progressPct}%
                    </Text>
                  </View>
                  <View className="mb-4 h-2 overflow-hidden rounded-full bg-[#0F172A]">
                    <View
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </View>

                  {/* Stat chips */}
                  <View className="flex-row gap-2">
                    <StatChip label="To Do" count={todoCount} color="#64748B" />
                    <StatChip label="In Progress" count={inProgressCount} color="#0EA5E9" />
                    <StatChip label="Done" count={doneCount} color="#22C55E" />
                  </View>
                </>
              ) : (
                <View className="flex-row items-center gap-2 rounded-xl bg-[#0F172A] p-3">
                  <MaterialIcons name="check-circle-outline" size={16} color="#475569" />
                  <Text className="text-xs text-slate-500">
                    No tasks yet — open group to create the first one
                  </Text>
                </View>
              )}

              {/* Integration chips */}
              {(!!activeGroup.jira_project_key || !!activeGroup.github_repo_url) && (
                <View className="mt-3 flex-row gap-2 border-t border-white/5 pt-3">
                  {!!activeGroup.jira_project_key && (
                    <TouchableOpacity
                      className="flex-row items-center gap-1.5 rounded-lg bg-[#1D4ED8]/20 px-3 py-2"
                      activeOpacity={0.8}
                      onPress={() => openJiraProject(activeGroup)}>
                      <MaterialIcons name="link" size={12} color="#93C5FD" />
                      <Text className="text-xs font-semibold text-[#93C5FD]">
                        Jira · {activeGroup.jira_project_key}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {!!activeGroup.github_repo_url && (
                    <TouchableOpacity
                      className="flex-row items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2"
                      onPress={() =>
                        activeGroup.github_repo_url && Linking.openURL(activeGroup.github_repo_url)
                      }>
                      <Feather name="github" size={12} color="#CBD5E1" />
                      <Text className="text-xs font-semibold text-slate-300">GitHub</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── My Tasks (assigned to me, not done) ─────────────────── */}
        {!!activeGroup && !tasksLoading && myTasks.length > 0 && (
          <Animated.View className="mt-5 px-4" style={{ opacity: fadeAnim }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-white">My Tasks</Text>
              <TouchableOpacity onPress={() => openGroupDetail()}>
                <Text className="text-xs font-semibold text-sky-400">View all →</Text>
              </TouchableOpacity>
            </View>

            <View className="rounded-2xl border border-[#243447] bg-[#1A2332] px-4 py-1">
              {myTasks.map((task) => (
                <TaskRow key={task.id} task={task} onPress={() => openGroupDetail()} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Quick Actions ────────────────────────────────────────── */}
        {!!activeGroup && (
          <Animated.View className="mt-5 px-4" style={{ opacity: fadeAnim }}>
            <Text className="mb-3 text-base font-bold text-white">Quick Access</Text>

            <View className="flex-row gap-3">
              {/* Reports */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Reports', { groupId: activeGroup.id })}
                className="flex-1 items-center rounded-2xl border border-[#243447] bg-[#1A2332] p-4"
                activeOpacity={0.85}>
                <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
                  <MaterialIcons name="assessment" size={20} color="#A78BFA" />
                </View>
                <Text className="text-xs font-semibold text-white">Reports</Text>
              </TouchableOpacity>

              {/* Documents */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Documents', { groupId: activeGroup.id })}
                className="flex-1 items-center rounded-2xl border border-[#243447] bg-[#1A2332] p-4"
                activeOpacity={0.85}>
                <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                  <MaterialIcons name="assignment" size={20} color="#6EE7B7" />
                </View>
                <Text className="text-xs font-semibold text-white">Documents</Text>
              </TouchableOpacity>

              {/* Topic Lab */}
              <TouchableOpacity
                onPress={() => navigation.navigate('TopicLab', { groupId: activeGroup.id })}
                className="flex-1 items-center rounded-2xl border border-[#243447] bg-[#1A2332] p-4"
                activeOpacity={0.85}>
                <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <MaterialIcons name="task" size={20} color="#FCD34D" />
                </View>
                <Text className="text-xs font-semibold text-white">Topic Lab</Text>
              </TouchableOpacity>

              {/* Evaluation */}
              <TouchableOpacity
                onPress={() => navigation.navigate('Evaluation', { groupId: activeGroup.id })}
                className="flex-1 items-center rounded-2xl border border-[#243447] bg-[#1A2332] p-4"
                activeOpacity={0.85}>
                <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20">
                  <MaterialIcons name="star" size={20} color="#FDA4AF" />
                </View>
                <Text className="text-xs font-semibold text-white">Evaluation</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
