import React, { useState, useCallback, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
  InteractionManager,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import DatePickerModal from '@/components/DatePickerModal';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import {
  getGroupById,
  leaveGroup,
  removeMember,
  updateMemberRole,
  deleteGroup,
  getGroupRepos,
} from '@/services/groupService';
import { getJiraProjects, checkJiraProjectAssignable } from '@/services/jiraService';
import { getContributorStats, getCommits, getRepositories } from '@/services/githubService';
import {
  createTask,
  deleteTask,
  getTasksPaginated,
  updateTask,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
} from '@/services/taskService';
import { getCurrentSemester, type SerializedSemester } from '@/services/semesterService';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import type { GroupDetail, GroupMember, MembershipRole } from '@/types/group';
import type { ContributorStat, GroupRepo } from '@/types/github';
import type { JiraTaskStatus } from '@/types/activity';
import { JIRA_STATUS_CONFIG } from '@/types/activity';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';
import { getZodErrorMessage, taskFormSchema } from '@/utils/validation/formSchemas';

// ==================== Constants ====================

/** Role hierarchy — higher number = higher rank */
const ROLE_RANK: Record<string, number> = {
  MEMBER: 0,
  MENTOR: 1,
  LEADER: 2,
};

/** Role badge display config */
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  LEADER: { label: 'Leader', color: '#7C3AED' },
  MENTOR: { label: 'Mentor', color: '#06B6D4' },
  MEMBER: { label: 'Member', color: '#64748B' },
};

/** Status indicator colors */
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22C55E',
  ARCHIVED: '#EAB308',
  COMPLETED: '#3B82F6',
};

const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
// Status options for EDIT only — create status is controlled by BE based on assignee
const EDIT_STATUS_OPTIONS: TaskStatus[] = ['IN_PROGRESS', 'DONE'];
const TASK_PAGE_SIZE = 30;

// Quick move: IN_PROGRESS → DONE → IN_PROGRESS (reopen)
// TO_DO tasks (unassigned) advance to IN_PROGRESS by quick-assign logic
const getNextStatus = (status: TaskStatus): TaskStatus => {
  if (status === 'TO_DO') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'DONE';
  if (status === 'DONE') return 'IN_PROGRESS'; // reopen
  return 'IN_PROGRESS'; // BLOCKED → unblock
};

const getValidJiraSiteOrigin = (rawUrl?: string | null): string | null => {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.toLowerCase().endsWith('.atlassian.net')) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

const resolveMemberUserId = (member: any): string => {
  const candidate = member?.id || member?.user_id || '';
  return typeof candidate === 'string' ? candidate : String(candidate || '');
};

const resolveMemberRole = (member: any): MembershipRole | undefined => {
  const role = member?.role_in_group || member?.role;
  if (role === 'LEADER' || role === 'MENTOR' || role === 'MEMBER') {
    return role;
  }
  return undefined;
};

const getApiErrorMessage = (error: any, fallback: string): string => {
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message)) {
    const joined = message.filter((m) => typeof m === 'string').join('\n');
    if (joined.trim()) {
      return joined;
    }
  }

  const errorText = error?.response?.data?.error;
  if (typeof errorText === 'string' && errorText.trim()) {
    return errorText;
  }

  return fallback;
};

// ==================== Component ====================

const GroupDetailScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'GroupDetail'>>();
  const { groupId } = route.params;

  const currentUser = useUserStore((s) => s.userInfo);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);
  const [checkingEditIntegrations, setCheckingEditIntegrations] = useState(false);
  const [jiraSiteUrl, setJiraSiteUrl] = useState<string | null>(null);
  const [memberJiraAccess, setMemberJiraAccess] = useState<boolean | null>(null);

  // GitHub linked repos & contributor stats
  const [linkedRepos, setLinkedRepos] = useState<GroupRepo[]>([]);
  const [contributorStats, setContributorStats] = useState<ContributorStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [groupTasks, setGroupTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [taskFallbackWarning, setTaskFallbackWarning] = useState('');
  const [taskSyncWarning, setTaskSyncWarning] = useState('');
  const [crudEnabled, setCrudEnabled] = useState(true);
  const [isTaskFormVisible, setTaskFormVisible] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formStatus, setFormStatus] = useState<TaskStatus>('IN_PROGRESS');
  const [formDueDate, setFormDueDate] = useState('');
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);
  const [formAssigneeId, setFormAssigneeId] = useState<string | null>(null);
  const [taskFormError, setTaskFormError] = useState('');
  const fetchRequestIdRef = useRef(0);

  // ── Derived State ───────────────────────────────

  const currentMember = group?.members.find((m: any) => {
    const memberUserId = resolveMemberUserId(m);
    if (currentUser?.id && memberUserId === currentUser.id) return true;
    if (currentUser?.email && m?.email && m.email === currentUser.email) return true;
    return false;
  });
  const currentMemberRole = resolveMemberRole(currentMember);
  const isLeader = currentMemberRole === 'LEADER';
  const isAdmin = currentMemberRole === 'MENTOR';
  const currentRank = ROLE_RANK[currentMemberRole || 'MEMBER'] ?? 0;
  const isUpcomingSemester = (() => {
    if (!currentSemester) return false;
    if (currentSemester.status !== 'ACTIVE') return true;

    const groupSemester = group?.semester?.trim().toUpperCase();
    const currentCode = currentSemester.code?.trim().toUpperCase();
    if (!groupSemester || !currentCode) return false;

    return groupSemester !== currentCode;
  })();

  const blockUpcomingAction = () => {
    if (!isUpcomingSemester) return false;
    showInfo('This group is outside the current active semester. Action is read-only.');
    return true;
  };

  const isIntegrationLinkError = (error: any): boolean => {
    const payload = error?.response?.data;
    const code = payload?.code;
    const message = payload?.message;

    if (
      code === 'ACCOUNT_NOT_LINKED' ||
      code === 'TOKEN_EXPIRED' ||
      code === 'INSUFFICIENT_SCOPE' ||
      payload?.reconnectRequired
    ) {
      return true;
    }

    const messageText = Array.isArray(message)
      ? message.filter((m) => typeof m === 'string').join(' ')
      : typeof message === 'string'
        ? message
        : '';

    return /link|not linked|reconnect|token|oauth|github|jira/i.test(messageText);
  };

  const handleEditGroupPress = async () => {
    if (blockUpcomingAction()) return;
    if (checkingEditIntegrations) return;

    try {
      setCheckingEditIntegrations(true);

      const [githubCheck, jiraCheck] = await Promise.allSettled([getRepositories(), getJiraProjects()]);

      const missingProviders: string[] = [];

      if (githubCheck.status === 'rejected' && isIntegrationLinkError(githubCheck.reason)) {
        missingProviders.push('GitHub');
      }

      if (jiraCheck.status === 'rejected' && isIntegrationLinkError(jiraCheck.reason)) {
        missingProviders.push('Jira');
      }

      if (missingProviders.length > 0) {
        showError(`Please link ${missingProviders.join(' and ')} before editing this group.`);
        return;
      }

      navigation.navigate('EditGroup', { groupId: group!.id });
    } catch {
      showError('Unable to verify linked accounts. Please try again.');
    } finally {
      setCheckingEditIntegrations(false);
    }
  };

  /** Check if current user outranks a target member */
  const canRemove = (target: GroupMember) =>
    currentRank > (ROLE_RANK[resolveMemberRole(target) || 'MEMBER'] ?? 0);

  const fetchTasks = useCallback(
    async (reset: boolean, jiraProjectKey?: string) => {
      const targetPage = reset ? 1 : taskPage + 1;

      if (!reset) {
        if (loadingMoreTasks || !hasMoreTasks || !crudEnabled) return;
        setLoadingMoreTasks(true);
      } else {
        setLoadingTasks(true);
        setTaskFallbackWarning('');
      }

      try {
        const paginated = await getTasksPaginated({
          group_id: groupId,
          page: targetPage,
          limit: TASK_PAGE_SIZE,
        });

        setCrudEnabled(true);
        setTaskFallbackWarning('');
        setTaskSyncWarning('');
        setTaskPage(paginated.meta.page);
        setHasMoreTasks(paginated.meta.page < paginated.meta.total_pages);
        setGroupTasks((prev) => (reset ? paginated.data : [...prev, ...paginated.data]));

        if (reset && jiraProjectKey) {
          const hasUnlinkedTasks = paginated.data.some((task) => {
            const key = task.key?.trim();
            return !key || !key.includes('-');
          });
          // Only warn if some tasks are missing Jira key (e.g. created before sync was enabled)
          if (hasUnlinkedTasks && paginated.data.length > 0) {
            setTaskSyncWarning(
              'Some tasks predate Jira sync — they will be linked to Jira on next update.'
            );
          }
        }
      } catch (taskError: any) {
        if (reset) {
          setGroupTasks([]);
          setCrudEnabled(false);
          setTaskPage(1);
          setHasMoreTasks(false);
          setTaskSyncWarning('');
        }

        showError(taskError?.response?.data?.message || 'Failed to load tasks');
      } finally {
        if (reset) {
          setLoadingTasks(false);
        } else {
          setLoadingMoreTasks(false);
        }
      }
    },
    [crudEnabled, groupId, hasMoreTasks, loadingMoreTasks, taskPage]
  );

  // ── Fetch Data ──────────────────────────────────

  const fetchGroup = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      setLoading(true);
      const [data, semester] = await Promise.all([
        getGroupById(groupId),
        getCurrentSemester().catch(() => null),
      ]);

      if (requestId !== fetchRequestIdRef.current) return;

      setGroup(data);
      setCurrentSemester(semester);
      setLoading(false);

      // Primary UI is ready now. Load secondary data in background.
      void fetchTasks(true, data.jira_project_key);

      // Fetch Jira site URL for deep-link badge (fire-and-forget)
      // Uses project.self which contains the actual Jira site URL
      // e.g. https://yoursite.atlassian.net/rest/api/3/project/10000
      if (data.jira_project_key) {
        void getJiraProjects()
          .then((projects) => {
            if (requestId !== fetchRequestIdRef.current) return;

            const normalizedProjectKey = data.jira_project_key?.trim().toUpperCase();
            const match = projects.find(
              (p) => p.key?.trim().toUpperCase() === normalizedProjectKey
            );

            const siteOrigin =
              getValidJiraSiteOrigin(match?.siteUrl) || getValidJiraSiteOrigin(match?.self);

            if (siteOrigin) {
              setJiraSiteUrl(siteOrigin);
              return;
            }
          })
          .catch(() => {});

        // Check if current user is assignable in the Jira project (fire-and-forget)
        // Only check non-leaders — leaders are expected to manage the project themselves
        const memberInData = data.members?.find((m: any) => {
          const mid = m?.id || m?.user_id || '';
          return (
            (currentUser?.id && mid === currentUser.id) ||
            (currentUser?.email && m?.email === currentUser.email)
          );
        });
        const roleInData = memberInData?.role_in_group;
        if (roleInData !== 'LEADER') {
          setMemberJiraAccess(null);
          checkJiraProjectAssignable(data.jira_project_key)
            .then((assignable) => {
              if (requestId !== fetchRequestIdRef.current) return;
              setMemberJiraAccess(assignable);
            })
            .catch(() => {
              if (requestId !== fetchRequestIdRef.current) return;
              setMemberJiraAccess(null);
            });
        } else {
          setMemberJiraAccess(true);
        }
      }

      // Fetch linked repos + stats
      void (async () => {
        try {
          const repos = await getGroupRepos(groupId);
          if (requestId !== fetchRequestIdRef.current) return;

          setLinkedRepos(repos);

          // Determine which repo to fetch stats for
          let owner = '';
          let repoName = '';

          const primaryRepo = repos.find((r) => r.is_primary) || repos[0];
          if (primaryRepo) {
            owner = primaryRepo.repo_owner;
            repoName = primaryRepo.repo_name;
          } else if (data.github_repo_url) {
            // Fallback: parse owner/repo from github_repo_url field
            const match = data.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (match) {
              owner = match[1];
              repoName = match[2].replace(/\.git$/, '');
            }
          }

          if (!owner || !repoName) {
            setContributorStats([]);
            setLoadingStats(false);
            return;
          }

          setLoadingStats(true);

          // Fetch both: commits for accurate count, stats for LOC
          const [commits, stats] = await Promise.all([
            getCommits(owner, repoName).catch(() => []),
            getContributorStats(owner, repoName).catch(() => []),
          ]);

          if (requestId !== fetchRequestIdRef.current) return;

          // Count commits per author from commits API
          const commitCountMap: Record<string, number> = {};
          for (const c of commits) {
            const key = c.author || 'Unknown';
            commitCountMap[key] = (commitCountMap[key] || 0) + 1;
          }

          // Merge: use commit count from commits API, LOC from stats API
          const mergedStats: ContributorStat[] = stats.map((s) => ({
            ...s,
            commits: commitCountMap[s.author] ?? s.commits,
          }));

          // Add authors from commits API not in stats
          for (const [author, count] of Object.entries(commitCountMap)) {
            if (!stats.some((s) => s.author === author)) {
              mergedStats.push({
                author,
                developer_id: 0,
                commits: count,
                lines_added: 0,
                lines_deleted: 0,
                net_change: 0,
              });
            }
          }

          setContributorStats(mergedStats);
        } catch {
          // Non-blocking — repos/stats may not be available
        } finally {
          if (requestId === fetchRequestIdRef.current) {
            setLoadingStats(false);
          }
        }
      })();
    } catch (error: any) {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
      showError(getApiErrorMessage(error, 'Failed to load group'));
      navigation.goBack();
    }
  }, [currentUser?.email, currentUser?.id, fetchTasks, groupId, navigation]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchGroup();
      });
      return () => task.cancel();
    }, [fetchGroup])
  );

  // ── Actions ─────────────────────────────────────

  /** Open GitHub repo URL in system browser */
  const handleOpenRepo = () => {
    if (group?.github_repo_url) {
      Linking.openURL(group.github_repo_url).catch(() => showError('Cannot open this URL'));
    }
  };

  /** Open Jira project board in system browser */
  const handleOpenJira = async () => {
    const projectKey = group?.jira_project_key?.trim();
    if (!projectKey) {
      showError('Jira project key is missing');
      return;
    }

    const validJiraSiteUrl = getValidJiraSiteOrigin(jiraSiteUrl);
    const projectUrl = validJiraSiteUrl
      ? `${validJiraSiteUrl}/jira/software/projects/${encodeURIComponent(projectKey)}/summary`
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
  };

  const openCreateTaskModal = () => {
    if (blockUpcomingAction()) return;

    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('MEDIUM');
    setFormStatus('IN_PROGRESS');
    setFormDueDate('');
    setDueDatePickerVisible(false);
    setFormAssigneeId(null);
    setTaskFormError('');
    setTaskFormVisible(true);
  };

  const openEditTaskModal = (task: TaskItem) => {
    if (blockUpcomingAction()) return;

    if (task.status === 'DONE') {
      showInfo('Completed tasks cannot be edited.');
      return;
    }

    setEditingTask(task);
    setFormTitle(task.title || '');
    setFormDescription(task.description || '');
    setFormPriority(task.priority || 'MEDIUM');
    // Normalise: TO_DO is auto, so default edit status to IN_PROGRESS if task is unassigned TODO
    setFormStatus(task.status === 'TO_DO' ? 'IN_PROGRESS' : task.status || 'IN_PROGRESS');
    setFormDueDate(task.due_at ? task.due_at.slice(0, 10) : '');
    // Pre-fill assignee from current task assignee_name lookup
    const matched = group?.members.find(
      (m) => m.full_name === task.assignee_name || m.email === task.assignee_name
    );
    setFormAssigneeId(matched?.id ?? null);
    setTaskFormError('');
    setTaskFormVisible(true);
  };

  const handleSaveTask = async () => {
    if (blockUpcomingAction()) return;

    if (editingTask?.status === 'DONE') {
      setTaskFormError('Completed tasks cannot be edited.');
      return;
    }

    const parsed = taskFormSchema.safeParse({
      title: formTitle,
      description: formDescription,
      dueDate: formDueDate,
      assigneeId: formAssigneeId ?? '',
    });

    if (!parsed.success) {
      setTaskFormError(getZodErrorMessage(parsed.error));
      return;
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDate = new Date(parsed.data.dueDate);
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    if (dueDateStart < todayStart) {
      setTaskFormError('Due date cannot be in the past.');
      return;
    }

    try {
      setSavingTask(true);
      setTaskFormError('');

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: parsed.data.title,
          description: parsed.data.description,
          priority: formPriority,
          status: formStatus,
          assignee_id: parsed.data.assigneeId,
          due_at: parsed.data.dueDate,
        });
        showSuccess(
          group?.jira_project_key ? 'Task updated & synced to Jira' : 'Task updated successfully'
        );
      } else {
        await createTask({
          group_id: groupId,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: formPriority,
          assignee_id: parsed.data.assigneeId,
          due_at: parsed.data.dueDate,
          // status intentionally omitted — BE auto-sets based on assignee
        });
        showSuccess(
          group?.jira_project_key
            ? `Task created & Jira issue opened${formAssigneeId ? ' · assigned' : ''}`
            : 'Task created successfully'
        );
      }

      setTaskFormVisible(false);
      fetchTasks(true);
    } catch (error: any) {
      setTaskFormError(getApiErrorMessage(error, 'Failed to save task.'));
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTask = (task: TaskItem) => {
    if (blockUpcomingAction()) return;
    if (!crudEnabled) return;

    Alert.alert('Delete task', `Delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task.id);
            showSuccess('Task deleted successfully');
            fetchTasks(true);
          } catch (error: any) {
            showError(error?.response?.data?.message || 'Failed to delete task');
          }
        },
      },
    ]);
  };

  const handleQuickMoveTask = async (task: TaskItem) => {
    if (blockUpcomingAction()) return;

    const next = getNextStatus(task.status);
    try {
      await updateTask(task.id, { status: next });
      showSuccess(
        group?.jira_project_key
          ? `Moved to ${next.replace('_', ' ')} · Jira synced`
          : `Moved to ${next.replace('_', ' ')}`
      );
      fetchTasks(true);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update task status');
    }
  };

  const alertJiraAccessRequired = () => {
    Alert.alert(
      'Jira Access Required',
      `You are not a member of the Jira project "${group?.jira_project_key}". Ask your leader to add you on Jira before performing this action.`,
      [{ text: 'OK' }]
    );
  };

  const handleMemberMarkDone = async (task: TaskItem) => {
    if (blockUpcomingAction()) return;

    if (group?.jira_project_key) {
      if (memberJiraAccess === false) {
        alertJiraAccessRequired();
        return;
      }
      if (memberJiraAccess !== true) {
        showInfo('Checking Jira assignment permission. Please try again in a moment.');
        return;
      }
    }
    try {
      await updateTask(task.id, { status: 'DONE' });
      showSuccess(group?.jira_project_key ? 'Marked done · Jira synced' : 'Task marked as done');
      fetchTasks(true);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to update task');
    }
  };

  const handleClaimTask = async (task: TaskItem) => {
    if (blockUpcomingAction()) return;

    if (!currentUser?.id) return;
    if (group?.jira_project_key) {
      if (memberJiraAccess === false) {
        alertJiraAccessRequired();
        return;
      }
      if (memberJiraAccess !== true) {
        showInfo('Checking Jira assignment permission. Please try again in a moment.');
        return;
      }
    }
    try {
      await updateTask(task.id, { assignee_id: currentUser.id });
      showSuccess('Task claimed');
      fetchTasks(true);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to claim task');
    }
  };

  const handleLoadMoreTasks = () => {
    fetchTasks(false);
  };

  // ── Modal State Machine ─────────────────────────
  // Instead of native Alert.alert, we use a single modal with different configs.
  type ModalConfig = {
    icon: string;
    iconColor: string;
    title: string;
    subtitle: string;
    confirmText: string;
    confirmColor: string;
    onConfirm: () => Promise<void>;
  };

  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const selectedMemberRef = useRef<GroupMember | null>(null);

  const closeModal = () => setModalConfig(null);

  /** Leave group */
  const handleLeaveGroup = () => {
    if (blockUpcomingAction()) return;

    setModalConfig({
      icon: 'log-out',
      iconColor: '#F97316',
      title: 'Leave group?',
      subtitle: 'You will lose access to this group and its resources.',
      confirmText: 'Leave',
      confirmColor: '#F97316',
      onConfirm: async () => {
        try {
          await leaveGroup(groupId);
          showSuccess('You have left the group');
          navigation.goBack();
        } catch (error: any) {
          showError(error.response?.data?.message || 'Failed to leave group');
        }
      },
    });
  };

  /** Delete group (leader only) */
  const handleDeleteGroup = () => {
    if (blockUpcomingAction()) return;

    setModalConfig({
      icon: 'trash-2',
      iconColor: '#EF4444',
      title: 'Delete group?',
      subtitle: 'This action cannot be undone. All data will be permanently removed.',
      confirmText: 'Delete',
      confirmColor: '#EF4444',
      onConfirm: async () => {
        try {
          await deleteGroup(groupId);
          showSuccess('Group deleted');
          navigation.goBack();
        } catch (error: any) {
          showError(error.response?.data?.message || 'Failed to delete group');
        }
      },
    });
  };

  /** Remove member */
  const handleRemoveMember = (member: GroupMember) => {
    if (blockUpcomingAction()) return;

    setShowActionSheet(false);
    setTimeout(() => {
      setModalConfig({
        icon: 'user-minus',
        iconColor: '#EF4444',
        title: `Remove ${member.full_name}?`,
        subtitle: 'They will lose access to this group immediately.',
        confirmText: 'Remove',
        confirmColor: '#EF4444',
        onConfirm: async () => {
          try {
            await removeMember(groupId, member.id);
            showSuccess(`${member.full_name} has been removed`);
            fetchGroup();
          } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to remove member');
          }
        },
      });
    }, 300);
  };

  /** Change role */
  const handleChangeRole = async (member: GroupMember, newRole: MembershipRole) => {
    if (blockUpcomingAction()) return;

    setShowActionSheet(false);
    try {
      await updateMemberRole(groupId, member.id, newRole);
      const roleLabel = newRole.charAt(0) + newRole.slice(1).toLowerCase();
      showSuccess(`${member.full_name} is now ${roleLabel}`);
      fetchGroup();
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to update role');
    }
  };

  /** Open member action sheet */
  const openMemberActions = (member: GroupMember) => {
    selectedMemberRef.current = member;
    setShowActionSheet(true);
  };

  // ── Render: Member Row ──────────────────────────

  const renderMember = (member: GroupMember, index: number) => {
    const role = resolveMemberRole(member) || 'MEMBER';
    const roleCfg = ROLE_CONFIG[role] || ROLE_CONFIG.MEMBER;
    const isCurrentUser = resolveMemberUserId(member) === currentUser?.id;
    const isLast = index === (group?.members.length ?? 0) - 1;

    return (
      <View
        key={member.id}
        className={`flex-row items-center justify-between py-3.5 ${
          !isLast ? 'border-b border-white/5' : ''
        }`}>
        {/* Avatar + Info */}
        <View className="flex-1 flex-row items-center">
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} className="h-10 w-10 rounded-full" />
          ) : (
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[#243447]">
              <Text className="text-sm font-bold text-white">
                {member.full_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          <View className="ml-3 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                {member.full_name}
              </Text>
              {isCurrentUser && <Text className="text-[11px] text-gray-500">(you)</Text>}
            </View>
            <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
              {member.email}
            </Text>
          </View>
        </View>

        {/* Role Badge + Actions */}
        <View className="flex-row items-center gap-2">
          <View
            className="rounded-lg px-2.5 py-1"
            style={{ backgroundColor: roleCfg.color + '20' }}>
            <Text style={{ color: roleCfg.color }} className="text-[10px] font-bold">
              {roleCfg.label}
            </Text>
          </View>

          {/* Show ⋮ menu for leader/admin on lower-rank members only */}
          {!isCurrentUser && (isLeader || isAdmin) && canRemove(member) && !isUpcomingSemester && (
            <TouchableOpacity onPress={() => openMemberActions(member)} className="p-1">
              <Feather name="more-vertical" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Loading State ───────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  if (!group) return null;

  const statusColor = STATUS_COLORS[group.status] || '#64748B';

  // ── Main Render ─────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* ── Header ──────────────────────────────── */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        <View className="ml-3 flex-1">
          <Text className="text-lg font-bold text-white" numberOfLines={1}>
            {group.name}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
            <Text className="text-xs text-gray-400">{group.status}</Text>
          </View>
        </View>

        {isLeader && (
          <TouchableOpacity
            disabled={isUpcomingSemester || checkingEditIntegrations}
            onPress={handleEditGroupPress}
            className={`h-10 w-10 items-center justify-center rounded-xl ${
              isUpcomingSemester || checkingEditIntegrations ? 'bg-[#334155]' : 'bg-[#1A2332]'
            }`}>
            {checkingEditIntegrations ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Feather name="edit-2" size={18} color="#7C3AED" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {isUpcomingSemester && (
        <View className="mx-4 mb-3 mt-1 flex-row items-start gap-2 rounded-xl bg-amber-900/30 px-3 py-2.5">
          <Feather name="clock" size={14} color="#FCD34D" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-amber-300">
            This group is outside the current active semester. Actions are in read-only mode.
          </Text>
        </View>
      )}

      {/* ── Body ────────────────────────────────── */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>
        {/* ── Group Info Card ───────────────────── */}
        <View className="mx-4 mt-3 rounded-2xl bg-[#1A2332] p-4">
          {group.project_name && (
            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">
                Project
              </Text>
              <Text className="text-[15px] font-semibold text-white">{group.project_name}</Text>
            </View>
          )}

          {group.topic?.name && (
            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Topic</Text>
              <Text className="text-[15px] font-semibold text-white">{group.topic.name}</Text>
              {!!group.topic.description && (
                <Text className="mt-1 text-sm leading-5 text-gray-400">
                  {group.topic.description}
                </Text>
              )}
            </View>
          )}

          {group.description && (
            <View className="mb-3">
              <Text className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">
                Description
              </Text>
              <Text className="text-sm leading-5 text-gray-300">{group.description}</Text>
            </View>
          )}

          {/* Meta Info */}
          <View className="flex-row flex-wrap gap-3">
            {group.semester && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="calendar" size={13} color="#64748B" />
                <Text className="text-sm text-gray-400">{group.semester}</Text>
              </View>
            )}
            <View className="flex-row items-center gap-1.5">
              <MaterialIcons name="group" size={14} color="#64748B" />
              <Text className="text-sm text-gray-400">
                {group.members_count} member
                {group.members_count !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Integration Tags */}
          {(group.jira_project_key || group.github_repo_url) && (
            <View className="mt-4 flex-row gap-2 border-t border-white/5 pt-3">
              {group.jira_project_key && (
                <TouchableOpacity
                  onPress={handleOpenJira}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1.5 rounded-xl bg-[#0052CC]/15 px-3 py-2">
                  <MaterialIcons name="dashboard" size={14} color="#4C9AFF" />
                  <Text className="text-xs font-semibold text-[#4C9AFF]">
                    {group.jira_project_key}
                  </Text>
                  <Feather name="external-link" size={11} color="#4C9AFF" />
                </TouchableOpacity>
              )}
              {group.github_repo_url && (
                <TouchableOpacity
                  onPress={handleOpenRepo}
                  activeOpacity={0.7}
                  className="flex-row items-center gap-1.5 rounded-xl bg-[#7C3AED]/15 px-3 py-2">
                  <Feather name="github" size={14} color="#A855F7" />
                  <Text className="text-xs font-semibold text-[#A855F7]">Repository</Text>
                  <Feather name="external-link" size={11} color="#A855F7" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Actions */}
          <View className="mt-4 flex-row gap-2 border-t border-white/5 pt-3">
            {isLeader && (
              <TouchableOpacity
                disabled={isUpcomingSemester}
                onPress={() => navigation.navigate('TopicLab', { groupId: group.id })}
                className={`flex-1 items-center rounded-xl py-2.5 ${
                  isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                }`}
                activeOpacity={0.8}>
                <Text className="text-xs font-semibold text-[#F59E0B]">Topic Lab</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('Documents', { groupId: group.id })}
              className="flex-1 items-center rounded-xl bg-[#243447] py-2.5"
              activeOpacity={0.8}>
              <Text className="text-xs font-semibold text-[#93C5FD]">Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Reports', { groupId: group.id })}
              className="flex-1 items-center rounded-xl bg-[#243447] py-2.5"
              activeOpacity={0.8}>
              <Text className="text-xs font-semibold text-[#A78BFA]">Reports</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── GitHub Contributions (Real Data) ───── */}
        {(linkedRepos.length > 0 ||
          contributorStats.length > 0 ||
          loadingStats ||
          group.github_repo_url) && (
          <View className="mx-4 mt-4">
            <View className="mb-3 flex-row items-center gap-2">
              <Feather name="git-commit" size={18} color="#A855F7" />
              <Text className="text-base font-bold text-white">Contributions</Text>
              {linkedRepos.length > 1 && (
                <Text className="text-xs text-gray-500">({linkedRepos.length} repos)</Text>
              )}
            </View>

            <View className="rounded-2xl bg-[#1A2332] p-4">
              {loadingStats ? (
                <ActivityIndicator size="small" color="#A855F7" style={{ paddingVertical: 16 }} />
              ) : contributorStats.length > 0 ? (
                <>
                  {contributorStats.map((stat, idx) => {
                    const maxCommits = Math.max(...contributorStats.map((s) => s.commits), 1);
                    const isLast = idx === contributorStats.length - 1;
                    const contributorKey = `contrib-${stat.developer_id ?? 'na'}-${stat.author ?? 'unknown'}-${idx}`;
                    return (
                      <View
                        key={contributorKey}
                        className={`flex-row items-center justify-between py-3 ${!isLast ? 'border-b border-white/5' : ''}`}>
                        <View className="flex-1 flex-row items-center">
                          {stat.avatar_url ? (
                            <Image
                              source={{ uri: stat.avatar_url }}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-[#243447]">
                              <Text className="text-xs font-bold text-white">
                                {stat.author?.charAt(0)?.toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View className="ml-2.5 flex-1">
                            <Text className="text-sm text-white" numberOfLines={1}>
                              {stat.author}
                            </Text>
                            <Text className="text-[10px] text-gray-500">
                              +{stat.lines_added.toLocaleString()} / -
                              {stat.lines_deleted.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <View className="items-center">
                            <Text className="text-sm font-bold text-white">{stat.commits}</Text>
                            <Text className="text-[9px] text-gray-500">commits</Text>
                          </View>
                          <View className="h-1.5 w-16 overflow-hidden rounded-full bg-[#243447]">
                            <View
                              className="h-full rounded-full bg-[#A855F7]"
                              style={{ width: `${Math.round((stat.commits / maxCommits) * 100)}%` }}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <Text className="py-4 text-center text-sm text-gray-500">
                  No contribution data yet
                </Text>
              )}

              {/* Linked repos list */}
              <View className="mt-3 gap-2 border-t border-white/5 pt-3">
                {linkedRepos.length > 0
                  ? linkedRepos.map((repo) => (
                      <TouchableOpacity
                        key={repo.id}
                        onPress={() =>
                          Linking.openURL(repo.repo_url).catch(() =>
                            showError('Cannot open this URL')
                          )
                        }
                        activeOpacity={0.8}
                        className="flex-row items-center justify-between rounded-xl bg-[#243447] px-3 py-2.5">
                        <View className="flex-1 flex-row items-center gap-2">
                          <Feather name="github" size={14} color="#A855F7" />
                          <Text className="text-sm font-semibold text-[#A855F7]" numberOfLines={1}>
                            {repo.repo_owner}/{repo.repo_name}
                          </Text>
                        </View>
                        <Feather name="external-link" size={11} color="#A855F7" />
                      </TouchableOpacity>
                    ))
                  : group.github_repo_url && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(group.github_repo_url!).catch(() =>
                            showError('Cannot open this URL')
                          )
                        }
                        activeOpacity={0.8}
                        className="flex-row items-center justify-center gap-2 rounded-xl bg-[#243447] py-2.5">
                        <Feather name="github" size={14} color="#A855F7" />
                        <Text className="text-sm font-semibold text-[#A855F7]">View on GitHub</Text>
                        <Feather name="external-link" size={11} color="#A855F7" />
                      </TouchableOpacity>
                    )}
              </View>
            </View>
          </View>
        )}

        {/* ── Task Tracker Section ─────────────── */}
        <View className="mx-4 mt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="task" size={18} color="#4C9AFF" />
              <Text className="text-base font-bold text-white">Group Tasks</Text>
            </View>
            {isLeader && (
              <TouchableOpacity
                onPress={openCreateTaskModal}
                disabled={!crudEnabled || isUpcomingSemester}
                className={`rounded-lg px-3 py-2 ${
                  !crudEnabled || isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#4C9AFF]/20'
                }`}
                activeOpacity={0.8}>
                <Text
                  className={`text-xs font-semibold ${
                    !crudEnabled || isUpcomingSemester ? 'text-gray-400' : 'text-[#93C5FD]'
                  }`}>
                  + New Task
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="rounded-2xl bg-[#1A2332] p-4">
            {!!taskSyncWarning && crudEnabled && (
              <View className="mb-4 rounded-xl border border-[#334155] bg-[#1E293B] p-3">
                <Text className="text-xs font-semibold text-[#FCD34D]">Jira sync notice</Text>
                <Text className="mt-1 text-xs text-gray-400">{taskSyncWarning}</Text>
              </View>
            )}

            {!crudEnabled && (
              <View className="mb-4 rounded-xl border border-[#334155] bg-[#243447] p-3">
                <Text className="text-xs font-semibold text-[#FCD34D]">Read-only mode</Text>
                <Text className="mt-1 text-xs text-gray-400">
                  {taskFallbackWarning ||
                    'BE task CRUD endpoints are not available yet. Showing Jira report data only.'}
                </Text>
              </View>
            )}

            {/* Summary bar: count per status */}
            <View className="mb-4 flex-row gap-2">
              {(['TO_DO', 'IN_PROGRESS', 'DONE'] as JiraTaskStatus[]).map((status) => {
                const cfg = JIRA_STATUS_CONFIG[status];
                const count = groupTasks.filter((t) => t.status === status).length;
                return (
                  <View key={status} className="flex-1 items-center rounded-xl bg-[#243447] py-2.5">
                    <View
                      className="mb-1 h-2 w-2 rounded-full"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <Text className="text-sm font-bold text-white">{count}</Text>
                    <Text className="text-[9px] text-gray-500">{cfg.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Task list */}
            {loadingTasks ? (
              <ActivityIndicator size="small" color="#4C9AFF" style={{ paddingVertical: 12 }} />
            ) : groupTasks.length > 0 ? (
              groupTasks.map((task, idx) => {
                const cfg =
                  JIRA_STATUS_CONFIG[task.status as JiraTaskStatus] ??
                  JIRA_STATUS_CONFIG.IN_PROGRESS;
                const hasJiraKey = !!task.key?.includes('-');
                return (
                  <View
                    key={task.id}
                    className={`flex-row items-center justify-between py-3 ${idx < groupTasks.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <View className="mr-3 flex-1">
                      {/* Key + status row */}
                      <View className="mb-1 flex-row flex-wrap items-center gap-2">
                        {hasJiraKey ? (
                          <View className="rounded bg-[#0052CC]/20 px-1.5 py-0.5">
                            <Text className="font-mono text-[10px] font-bold text-[#4C9AFF]">
                              {task.key}
                            </Text>
                          </View>
                        ) : group?.jira_project_key ? (
                          <View className="flex-row items-center gap-1 rounded bg-[#F59E0B]/20 px-1.5 py-0.5">
                            <MaterialIcons name="sync-problem" size={10} color="#F59E0B" />
                            <Text className="text-[10px] font-semibold text-[#F59E0B]">
                              Not synced to Jira
                            </Text>
                          </View>
                        ) : null}
                        <View
                          className="rounded-md px-2 py-0.5"
                          style={{ backgroundColor: cfg.color + '25' }}>
                          <Text className="text-[10px] font-bold" style={{ color: cfg.color }}>
                            {cfg.label}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm font-medium text-white" numberOfLines={1}>
                        {task.title}
                      </Text>
                      <View className="mt-1 flex-row items-center gap-1.5">
                        <MaterialIcons
                          name="person"
                          size={11}
                          color={task.assignee_name ? '#60A5FA' : '#475569'}
                        />
                        <Text
                          className={`text-[11px] ${task.assignee_name ? 'text-blue-400' : 'text-gray-600'}`}
                          numberOfLines={1}>
                          {task.assignee_name || 'Unassigned'}
                        </Text>
                      </View>
                    </View>
                    {isLeader ? (
                      <View className="gap-1">
                        {/* Quick move — label changes based on current status */}
                        {task.status !== 'DONE' && (
                          <TouchableOpacity
                            disabled={isUpcomingSemester}
                            onPress={() => handleQuickMoveTask(task)}
                            className={`h-8 w-8 items-center justify-center rounded-lg ${
                              isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                            }`}
                            activeOpacity={0.8}>
                            <Feather
                              name={task.status === 'IN_PROGRESS' ? 'rotate-ccw' : 'arrow-right'}
                              size={14}
                              color="#A78BFA"
                            />
                          </TouchableOpacity>
                        )}
                        {task.status !== 'DONE' && (
                          <TouchableOpacity
                            disabled={isUpcomingSemester}
                            onPress={() => openEditTaskModal(task)}
                            className={`h-8 w-8 items-center justify-center rounded-lg ${
                              isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                            }`}
                            activeOpacity={0.8}>
                            <Feather name="edit-2" size={14} color="#93C5FD" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          disabled={isUpcomingSemester}
                          onPress={() => handleDeleteTask(task)}
                          className={`h-8 w-8 items-center justify-center rounded-lg ${
                            isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                          }`}
                          activeOpacity={0.8}>
                          <Feather name="trash-2" size={14} color="#F87171" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="gap-1">
                        {/* Mark done — only if assigned to current user and not yet done */}
                        {(task.assignee_id
                          ? task.assignee_id === currentUser?.id
                          : task.assignee_name &&
                            (task.assignee_name === currentMember?.full_name ||
                              task.assignee_name === currentMember?.email)) &&
                          task.status === 'IN_PROGRESS' && (
                            <TouchableOpacity
                              disabled={isUpcomingSemester}
                              onPress={() => handleMemberMarkDone(task)}
                              className={`h-8 w-8 items-center justify-center rounded-lg ${
                                isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                              }`}
                              activeOpacity={0.8}>
                              <Feather name="check" size={14} color="#22C55E" />
                            </TouchableOpacity>
                          )}
                        {/* Claim — only if unassigned TODO */}
                        {!task.assignee_id && !task.assignee_name && task.status === 'TO_DO' && (
                          <TouchableOpacity
                            disabled={isUpcomingSemester}
                            onPress={() => handleClaimTask(task)}
                            className={`h-8 w-8 items-center justify-center rounded-lg ${
                              isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#243447]'
                            }`}
                            activeOpacity={0.8}>
                            <Feather name="user-plus" size={14} color="#60A5FA" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View className="mt-1 flex-row items-center gap-2 rounded-xl bg-[#243447] p-3">
                <MaterialIcons name="info-outline" size={14} color="#64748B" />
                <Text className="flex-1 text-xs text-gray-500">
                  No tasks available for this group yet.
                </Text>
              </View>
            )}

            {crudEnabled && hasMoreTasks && (
              <TouchableOpacity
                onPress={handleLoadMoreTasks}
                className="mt-4 items-center rounded-xl bg-[#243447] py-2.5"
                activeOpacity={0.8}
                disabled={loadingMoreTasks}>
                {loadingMoreTasks ? (
                  <ActivityIndicator size="small" color="#93C5FD" />
                ) : (
                  <Text className="text-xs font-semibold text-[#93C5FD]">Load more tasks</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Members Section ──────────────────── */}
        <View className="mx-4 mt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-white">Members ({group.members.length})</Text>
          </View>

          <View className="rounded-2xl bg-[#1A2332] px-4">
            {group.members.map((member, index) => renderMember(member, index))}
          </View>
        </View>

        {/* ── Leader Actions ───────────────────── */}
        <View className="mx-4 mt-6 gap-3">
          {/* Evaluation Button — all members can view; label differs by role */}
          {currentMember && (
            <TouchableOpacity
              disabled={isUpcomingSemester}
              onPress={() => navigation.navigate('Evaluation', { groupId: group.id })}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                isUpcomingSemester ? 'bg-[#334155]' : 'bg-[#7C3AED]'
              }`}>
              <MaterialIcons name="assessment" size={18} color="#fff" />
              <Text className="font-semibold text-white">
                {isLeader ? 'Evaluate Members' : 'View Evaluations'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Semester Status — all members */}
          {currentMember && (
            <TouchableOpacity
              onPress={() => navigation.navigate('SemesterStatus', { groupId: group.id })}
              activeOpacity={0.8}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1A2332] py-3.5">
              <MaterialIcons name="school" size={18} color="#7C3AED" />
              <Text className="font-semibold text-white">Semester Status</Text>
            </TouchableOpacity>
          )}

          {/* Leave — any member (including leader) can leave */}
          {currentMember && (
            <TouchableOpacity
              disabled={isUpcomingSemester}
              onPress={handleLeaveGroup}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                isUpcomingSemester ? 'bg-[#334155]' : 'bg-red-500/10'
              }`}>
              <Feather name="log-out" size={16} color="#EF4444" />
              <Text className="font-semibold text-red-400">Leave Group</Text>
            </TouchableOpacity>
          )}

          {isLeader && (
            <TouchableOpacity
              disabled={isUpcomingSemester}
              onPress={handleDeleteGroup}
              activeOpacity={0.8}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                isUpcomingSemester ? 'bg-[#334155]' : 'bg-red-500/10'
              }`}>
              <Feather name="trash-2" size={16} color="#EF4444" />
              <Text className="font-semibold text-red-400">Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={isTaskFormVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setTaskFormError('');
          setTaskFormVisible(false);
        }}>
        <View className="flex-1 justify-end bg-black/60">
          <ScrollView
            className="rounded-t-3xl border-t border-white/10 bg-[#101922]"
            contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-white">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </Text>
                {!!group?.jira_project_key && (
                  <Text className="mt-0.5 text-[11px] text-[#4C9AFF]">
                    Will sync to Jira · {group.jira_project_key}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setTaskFormError('');
                  setTaskFormVisible(false);
                }}
                className="p-2">
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text className="mb-1 text-xs text-gray-400">Title *</Text>
            <TextInput
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Task title"
              placeholderTextColor="#64748B"
              className="mb-3 h-11 rounded-xl bg-[#1A2332] px-4 text-sm text-white"
            />

            {/* Description */}
            <Text className="mb-1 text-xs text-gray-400">Description *</Text>
            <TextInput
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Task details"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="mb-3 min-h-[72px] rounded-xl bg-[#1A2332] px-4 py-3 text-sm text-white"
            />

            {/* Assignee picker */}
            <Text className="mb-2 text-xs text-gray-400">
              Assign to *
              {!editingTask && (
                <Text className="text-gray-600"> · status auto-set by assignee</Text>
              )}
            </Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {/* Unassign option */}
              <TouchableOpacity
                onPress={() => setFormAssigneeId(null)}
                className={`rounded-lg border px-3 py-2 ${!formAssigneeId ? 'border-slate-400 bg-slate-400/15' : 'border-white/10 bg-[#1A2332]'}`}
                activeOpacity={0.8}>
                <Text
                  className={`text-xs font-semibold ${!formAssigneeId ? 'text-slate-300' : 'text-gray-500'}`}>
                  None
                </Text>
              </TouchableOpacity>
              {group?.members.map((m) => {
                const selected = formAssigneeId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setFormAssigneeId(m.id)}
                    className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-2 ${selected ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                    activeOpacity={0.8}>
                    <View className="h-4 w-4 items-center justify-center rounded-full bg-[#243447]">
                      <Text className="text-[8px] font-bold text-white">
                        {m.full_name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      className={`text-xs font-semibold ${selected ? 'text-[#93C5FD]' : 'text-gray-300'}`}
                      numberOfLines={1}>
                      {m.full_name?.split(' ').pop()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status — edit only, create is controlled by BE */}
            {!!editingTask && (
              <>
                <Text className="mb-2 text-xs text-gray-400">Status</Text>
                <View className="mb-3 flex-row gap-2">
                  {EDIT_STATUS_OPTIONS.map((s: TaskStatus) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setFormStatus(s)}
                      className={`flex-1 items-center rounded-lg border py-2 ${formStatus === s ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                      activeOpacity={0.8}>
                      <Text
                        className={`text-xs font-semibold ${formStatus === s ? 'text-[#93C5FD]' : 'text-gray-300'}`}>
                        {s.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Priority */}
            <Text className="mb-2 text-xs text-gray-400">Priority</Text>
            <View className="mb-3 flex-row flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((priority) => (
                <TouchableOpacity
                  key={priority}
                  onPress={() => setFormPriority(priority)}
                  className={`rounded-lg border px-3 py-2 ${formPriority === priority ? 'border-[#4C9AFF] bg-[#4C9AFF]/20' : 'border-white/10 bg-[#1A2332]'}`}
                  activeOpacity={0.8}>
                  <Text
                    className={`text-xs font-semibold ${formPriority === priority ? 'text-[#93C5FD]' : 'text-gray-300'}`}>
                    {priority}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Due Date */}
            <Text className="mb-1 text-xs text-gray-400">Due Date *</Text>
            <TouchableOpacity
              onPress={() => setDueDatePickerVisible(true)}
              activeOpacity={0.7}
              className="mb-5 flex-row items-center rounded-xl bg-[#1A2332] px-4"
              style={{
                height: 44,
                borderWidth: formDueDate ? 1 : 0,
                borderColor: formDueDate ? 'rgba(74,144,255,0.4)' : 'transparent',
              }}>
              <Feather
                name="calendar"
                size={15}
                color={formDueDate ? '#93C5FD' : '#64748B'}
                style={{ marginRight: 10 }}
              />
              <Text
                className="flex-1 text-sm"
                style={{ color: formDueDate ? '#E2E8F0' : '#64748B' }}>
                {formDueDate
                  ? new Date(formDueDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Select due date'}
              </Text>
              {formDueDate ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setFormDueDate('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x-circle" size={15} color="#64748B" />
                </TouchableOpacity>
              ) : (
                <Feather name="chevron-right" size={15} color="#475569" />
              )}
            </TouchableOpacity>

            {!!taskFormError && (
              <View className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5">
                <Text className="text-xs font-medium text-red-300">{taskFormError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSaveTask}
              disabled={savingTask}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${savingTask ? 'bg-[#334155]' : 'bg-[#2563EB]'}`}
              activeOpacity={0.8}>
              {savingTask ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name={editingTask ? 'save' : 'plus'} size={16} color="#fff" />
                  <Text className="font-semibold text-white">
                    {editingTask ? 'Save Changes' : 'Create Task'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Due Date Picker */}
      <DatePickerModal
        visible={dueDatePickerVisible}
        value={formDueDate ? new Date(formDueDate) : null}
        minDate={new Date()}
        title="Select Due Date"
        onConfirm={(date) => {
          setFormDueDate(date.toISOString().slice(0, 10));
          setDueDatePickerVisible(false);
        }}
        onCancel={() => setDueDatePickerVisible(false)}
      />

      {/* ═══════════════════════════════════════════════════
                Confirm Modal (leave / delete / remove member)
               ═══════════════════════════════════════════════════ */}
      <Modal visible={!!modalConfig} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable
          onPress={closeModal}
          className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="w-full rounded-2xl bg-[#1A2332] p-6">
            {/* Icon */}
            <View className="mb-4 items-center">
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: (modalConfig?.iconColor || '#EF4444') + '20' }}>
                <Feather
                  name={(modalConfig?.icon as any) || 'alert-circle'}
                  size={28}
                  color={modalConfig?.iconColor || '#EF4444'}
                />
              </View>
            </View>

            <Text className="mb-2 text-center text-xl font-bold text-white">
              {modalConfig?.title}
            </Text>
            <Text className="mb-6 text-center text-sm text-gray-400">{modalConfig?.subtitle}</Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={closeModal}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-xl bg-white/5 py-3.5">
                <Text className="font-semibold text-white">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await modalConfig?.onConfirm();
                  closeModal();
                }}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-xl py-3.5"
                style={{ backgroundColor: modalConfig?.confirmColor || '#EF4444' }}>
                <Text className="font-semibold text-white">{modalConfig?.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══════════════════════════════════════════════════
                Member Action Sheet (change role / remove)
               ═══════════════════════════════════════════════════ */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}>
        <Pressable
          onPress={() => setShowActionSheet(false)}
          className="flex-1 justify-end bg-black/60">
          <Pressable onPress={() => {}} className="rounded-t-3xl bg-[#1A2332] px-4 pb-8 pt-3">
            {/* Handle Bar */}
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-white/20" />

            <Text className="mb-1 text-lg font-bold text-white">
              {selectedMemberRef.current?.full_name}
            </Text>
            <Text className="mb-4 text-sm text-gray-500">
              Current role: {resolveMemberRole(selectedMemberRef.current)}
            </Text>

            {/* Role Options */}
            <Text className="mb-2 ml-1 text-xs font-semibold text-gray-600">CHANGE ROLE</Text>
            {(['MEMBER', 'LEADER'] as MembershipRole[])
              .filter((r) => r !== resolveMemberRole(selectedMemberRef.current))
              .map((role) => (
                <TouchableOpacity
                  key={role}
                  onPress={() =>
                    selectedMemberRef.current && handleChangeRole(selectedMemberRef.current, role)
                  }
                  activeOpacity={0.7}
                  className="mb-2 flex-row items-center rounded-xl bg-white/5 px-3 py-3.5">
                  <Feather
                    name={role === 'LEADER' ? 'star' : role === 'MENTOR' ? 'award' : 'user'}
                    size={18}
                    color="#A78BFA"
                  />
                  <Text className="ml-3 font-medium text-white">
                    Set as {role.charAt(0) + role.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}

            {/* Remove — only if current user outranks the selected member */}
            {selectedMemberRef.current && canRemove(selectedMemberRef.current) && (
              <TouchableOpacity
                onPress={() =>
                  selectedMemberRef.current && handleRemoveMember(selectedMemberRef.current)
                }
                activeOpacity={0.7}
                className="mt-2 flex-row items-center rounded-xl bg-red-500/10 px-3 py-3.5">
                <Feather name="user-minus" size={18} color="#EF4444" />
                <Text className="ml-3 font-medium text-red-400">Remove from Group</Text>
              </TouchableOpacity>
            )}

            {/* Cancel */}
            <TouchableOpacity
              onPress={() => setShowActionSheet(false)}
              activeOpacity={0.8}
              className="mt-4 items-center rounded-xl bg-white/5 py-3.5">
              <Text className="font-semibold text-white">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default GroupDetailScreen;
