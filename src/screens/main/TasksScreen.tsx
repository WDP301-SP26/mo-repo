import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { getMyGroups } from '@/services/studentService';
import { getTasks, type TaskItem, type TaskPriority, type TaskStatus } from '@/services/taskService';
import { getCheckpoints, type Checkpoint } from '@/services/checkpointService';
import { getCurrentSemester } from '@/services/semesterService';
import type { Group } from '@/types/group';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { showError } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';

type FilterKey = 'ACTIVE' | 'OVERDUE' | 'DONE' | 'ALL';

interface AssignedTask {
  task: TaskItem;
  group: Group;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TO_DO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string }> = {
  TO_DO: { bg: '#334155', text: '#CBD5E1' },
  IN_PROGRESS: { bg: '#1D4ED8', text: '#BFDBFE' },
  DONE: { bg: '#166534', text: '#BBF7D0' },
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string }> = {
  LOW: { bg: '#334155', text: '#CBD5E1' },
  MEDIUM: { bg: '#4C1D95', text: '#DDD6FE' },
  HIGH: { bg: '#9A3412', text: '#FDBA74' },
  CRITICAL: { bg: '#7F1D1D', text: '#FECACA' },
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'DONE', label: 'Done' },
  { key: 'ALL', label: 'All' },
];

const getDueInfo = (dueAt?: string, status?: TaskStatus) => {
  if (!dueAt) {
    return { label: 'No due date', color: '#64748B', overdue: false };
  }

  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) {
    return { label: dueAt, color: '#94A3B8', overdue: false };
  }

  const overdue = parsed.getTime() < Date.now() && status !== 'DONE';

  return {
    label: parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    color: overdue ? '#F87171' : '#93C5FD',
    overdue,
  };
};

const sortAssignedTasks = (items: AssignedTask[]) => {
  return [...items].sort((a, b) => {
    const aDue = a.task.due_at ? new Date(a.task.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.task.due_at ? new Date(b.task.due_at).getTime() : Number.POSITIVE_INFINITY;

    if (aDue !== bDue) return aDue - bDue;
    return a.task.title.localeCompare(b.task.title);
  });
};

const TasksScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const currentUser = useUserStore((s) => s.userInfo);

  const [groups, setGroups] = useState<Group[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [groupByCheckpoint, setGroupByCheckpoint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ACTIVE');

  const fetchAssignedTasks = useCallback(async () => {
    if (!currentUser?.id) {
      setGroups([]);
      setAssignedTasks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const [data, semester] = await Promise.all([
        getMyGroups(),
        getCurrentSemester().catch(() => null),
      ]);
      setGroups(data);

      if (data.length === 0) {
        setAssignedTasks([]);
        return;
      }

      const taskBatches = await Promise.all(
        data.map(async (group) => {
          const tasks = await getTasks({
            group_id: group.id,
            assignee_id: currentUser.id,
            limit: 100,
          });

          return tasks.map((task) => ({ task, group }));
        })
      );

      setAssignedTasks(sortAssignedTasks(taskBatches.flat()));

      if (semester) {
        const cps = await getCheckpoints(semester.id).catch(() => []);
        setCheckpoints(cps);
      }
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to load your tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);

  const summary = useMemo(() => {
    const total = assignedTasks.length;
    const done = assignedTasks.filter((item) => item.task.status === 'DONE').length;
    const active = assignedTasks.filter((item) => item.task.status !== 'DONE').length;
    const overdue = assignedTasks.filter((item) => {
      if (!item.task.due_at || item.task.status === 'DONE') return false;
      const due = new Date(item.task.due_at);
      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    }).length;

    return { total, done, active, overdue };
  }, [assignedTasks]);

  const visibleTasks = useMemo(() => {
    if (activeFilter === 'ALL') return assignedTasks;

    if (activeFilter === 'DONE') {
      return assignedTasks.filter((item) => item.task.status === 'DONE');
    }

    if (activeFilter === 'ACTIVE') {
      return assignedTasks.filter((item) => item.task.status !== 'DONE');
    }

    return assignedTasks.filter((item) => {
      if (!item.task.due_at || item.task.status === 'DONE') return false;
      const due = new Date(item.task.due_at);
      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    });
  }, [activeFilter, assignedTasks]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchAssignedTasks();
      });
      return () => task.cancel();
    }, [fetchAssignedTasks])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignedTasks();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-black text-white">My Tasks</Text>
          {checkpoints.length > 0 && (
            <TouchableOpacity
              onPress={() => setGroupByCheckpoint((v) => !v)}
              className={`flex-row items-center gap-1.5 rounded-xl px-3 py-2 ${groupByCheckpoint ? 'bg-[#7C3AED]' : 'bg-[#1A2332]'}`}
              activeOpacity={0.8}>
              <Feather name="flag" size={13} color={groupByCheckpoint ? '#fff' : '#94A3B8'} />
              <Text className="text-xs font-semibold" style={{ color: groupByCheckpoint ? '#fff' : '#94A3B8' }}>
                Checkpoints
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text className="mt-1 text-sm text-gray-400">
          {summary.active} active of {summary.total} assigned tasks.
        </Text>
      </View>

      <View className="mx-4 mb-3 mt-2 flex-row gap-2">
        <View className="flex-1 rounded-xl bg-[#1A2332] p-3">
          <Text className="text-xs uppercase tracking-wide text-gray-400">Active</Text>
          <Text className="mt-1 text-xl font-extrabold text-sky-300">{summary.active}</Text>
        </View>

        <View className="flex-1 rounded-xl bg-[#1A2332] p-3">
          <Text className="text-xs uppercase tracking-wide text-gray-400">Overdue</Text>
          <Text className="mt-1 text-xl font-extrabold text-red-300">{summary.overdue}</Text>
        </View>

        <View className="flex-1 rounded-xl bg-[#1A2332] p-3">
          <Text className="text-xs uppercase tracking-wide text-gray-400">Done</Text>
          <Text className="mt-1 text-xl font-extrabold text-emerald-300">{summary.done}</Text>
        </View>
      </View>

      {!groupByCheckpoint && (
        <View className="mb-2 flex-row px-4">
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter.key;

            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.85}
                className="mr-2 rounded-full px-3 py-2"
                style={{ backgroundColor: selected ? '#1D4ED8' : '#1A2332' }}>
                <Text className="text-xs font-semibold" style={{ color: selected ? '#DBEAFE' : '#94A3B8' }}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Checkpoint grouped view ──────────────────────────────── */}
      {groupByCheckpoint ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }>
          {checkpoints.map((cp) => {
            const cpTasks = assignedTasks.filter(
              (item) => (item.task as any).checkpoint_id === cp.id
            );
            const done = cpTasks.filter((i) => i.task.status === 'DONE').length;
            const pct = cpTasks.length > 0 ? Math.round((done / cpTasks.length) * 100) : 0;

            return (
              <View key={cp.id} className="mb-4 mx-4">
                {/* Checkpoint header */}
                <View className="mb-2 rounded-2xl bg-[#1A2332] px-4 py-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-bold text-white">{cp.title}</Text>
                      <View className="mt-0.5 flex-row items-center gap-1.5">
                        <Feather name="calendar" size={11} color="#7C3AED" />
                        <Text className="text-xs text-[#A78BFA]">
                          Week {cp.week_start}–{cp.week_end}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs font-bold text-gray-400">
                      {done}/{cpTasks.length}
                    </Text>
                  </View>
                  {cpTasks.length > 0 && (
                    <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#243447]">
                      <View
                        className="h-full rounded-full bg-[#7C3AED]"
                        style={{ width: `${pct}%` }}
                      />
                    </View>
                  )}
                  {!!cp.description && (
                    <Text className="mt-2 text-xs leading-4 text-gray-500" numberOfLines={2}>
                      {cp.description}
                    </Text>
                  )}
                </View>

                {cpTasks.length === 0 ? (
                  <View className="items-center rounded-2xl bg-[#1A2332] py-4">
                    <Text className="text-xs text-gray-500">No tasks in this checkpoint yet.</Text>
                  </View>
                ) : (
                  cpTasks.map((item) => {
                    const due = getDueInfo(item.task.due_at, item.task.status);
                    return (
                      <TouchableOpacity
                        key={item.task.id}
                        onPress={() => navigation.navigate('GroupDetail', { groupId: item.group.id })}
                        activeOpacity={0.85}
                        className="mb-2 rounded-2xl bg-[#1A2332] p-4">
                        <Text className="text-sm font-bold text-white" numberOfLines={1}>
                          {item.task.title}
                        </Text>
                        <View className="mt-1.5 flex-row items-center gap-2">
                          <View
                            className="rounded-md px-2 py-0.5"
                            style={{ backgroundColor: STATUS_STYLES[item.task.status].bg }}>
                            <Text className="text-[10px] font-semibold" style={{ color: STATUS_STYLES[item.task.status].text }}>
                              {STATUS_LABELS[item.task.status]}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Feather name="calendar" size={11} color={due.color} />
                            <Text className="text-xs" style={{ color: due.color }}>
                              {due.label}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            );
          })}

          {/* Uncategorized tasks */}
          {(() => {
            const uncategorized = assignedTasks.filter(
              (item) => !(item.task as any).checkpoint_id
            );
            if (uncategorized.length === 0) return null;
            return (
              <View className="mb-4 mx-4">
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Uncategorized
                </Text>
                {uncategorized.map((item) => {
                  const due = getDueInfo(item.task.due_at, item.task.status);
                  return (
                    <TouchableOpacity
                      key={item.task.id}
                      onPress={() => navigation.navigate('GroupDetail', { groupId: item.group.id })}
                      activeOpacity={0.85}
                      className="mb-2 rounded-2xl bg-[#1A2332] p-4">
                      <Text className="text-sm font-bold text-white" numberOfLines={1}>
                        {item.task.title}
                      </Text>
                      <View className="mt-1.5 flex-row items-center gap-2">
                        <View
                          className="rounded-md px-2 py-0.5"
                          style={{ backgroundColor: STATUS_STYLES[item.task.status].bg }}>
                          <Text className="text-[10px] font-semibold" style={{ color: STATUS_STYLES[item.task.status].text }}>
                            {STATUS_LABELS[item.task.status]}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Feather name="calendar" size={11} color={due.color} />
                          <Text className="text-xs" style={{ color: due.color }}>{due.label}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })()}
        </ScrollView>
      ) : (

      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.task.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
        renderItem={({ item }) => {
          const due = getDueInfo(item.task.due_at, item.task.status);

          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.group.id })}
              activeOpacity={0.85}
              className="mx-4 mb-3 rounded-2xl bg-[#1A2332] p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-base font-bold text-white" numberOfLines={1}>
                    {item.task.title}
                  </Text>

                  <Text className="mt-1 text-xs text-gray-400" numberOfLines={1}>
                    Group: {item.group.name}
                  </Text>

                  <View className="mt-2 flex-row items-center gap-2">
                    <View
                      className="rounded-md px-2 py-1"
                      style={{ backgroundColor: STATUS_STYLES[item.task.status].bg }}>
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: STATUS_STYLES[item.task.status].text }}>
                        {STATUS_LABELS[item.task.status]}
                      </Text>
                    </View>

                    <View
                      className="rounded-md px-2 py-1"
                      style={{ backgroundColor: PRIORITY_STYLES[item.task.priority].bg }}>
                      <Text
                        className="text-[10px] font-semibold"
                        style={{ color: PRIORITY_STYLES[item.task.priority].text }}>
                        {PRIORITY_LABELS[item.task.priority]}
                      </Text>
                    </View>

                    {item.task.key && (
                      <View className="rounded-md bg-[#0F172A] px-2 py-1">
                        <Text className="text-[10px] font-semibold text-[#93C5FD]">{item.task.key}</Text>
                      </View>
                    )}
                  </View>

                  {!!item.task.description && (
                    <Text className="mt-2 text-xs leading-5 text-gray-400" numberOfLines={2}>
                      {item.task.description}
                    </Text>
                  )}

                  <View className="mt-2 flex-row items-center gap-1">
                    <Feather name="calendar" size={13} color={due.color} />
                    <Text className="text-xs font-semibold" style={{ color: due.color }}>
                      {due.overdue ? `Overdue • ${due.label}` : `Due ${due.label}`}
                    </Text>
                  </View>
                </View>

                <Feather name="chevron-right" size={18} color="#64748B" />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center px-8 py-16">
            <MaterialIcons
              name={groups.length === 0 ? 'group-off' : 'assignment-turned-in'}
              size={48}
              color="#475569"
            />
            <Text className="mt-3 text-center text-gray-400">
              {groups.length === 0
                ? 'You have not joined any group yet.'
                : 'No tasks found for this filter.'}
            </Text>
            {groups.length > 0 && (
              <Text className="mt-1 text-center text-xs text-gray-500">
                Pull down to refresh or switch filter.
              </Text>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      )}
    </SafeAreaView>
  );
};

export default TasksScreen;
