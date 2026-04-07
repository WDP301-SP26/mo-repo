import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { createGroup, updateGroup, getGroupById, linkRepoToGroup } from '@/services/groupService';
import { getRepositories, createRepository, type GitHubRepo } from '@/services/githubService';
import { getJiraProjects, linkJiraProject, type JiraProject } from '@/services/jiraService';
import { getCurrentSemester, type SerializedSemester } from '@/services/semesterService';
import { showSuccess, showError, showInfo } from '@/utils/toast';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  createRepoSchema,
  getZodErrorMessage,
  groupFormSchema,
} from '@/utils/validation/formSchemas';

// ==================== Types ====================

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  icon: string;
  isSelect?: boolean;
}

// ==================== Constants ====================

const FORM_FIELDS: FormField[] = [
  {
    key: 'name',
    label: 'Group Name',
    placeholder: 'e.g. Team Alpha',
    required: true,
    maxLength: 100,
    icon: 'users',
  },
  {
    key: 'project_name',
    label: 'Project Name',
    placeholder: 'e.g. E-Commerce Platform',
    required: true,
    maxLength: 100,
    icon: 'briefcase',
  },
  {
    key: 'description',
    label: 'Description',
    placeholder: 'Briefly describe your group or project...',
    required: true,
    multiline: true,
    maxLength: 500,
    icon: 'align-left',
  },
  {
    key: 'semester',
    label: 'Semester',
    placeholder: 'Select semester',
    required: true,
    maxLength: 20,
    icon: 'calendar',
    isSelect: true,
  },
  {
    key: 'github_repo_url',
    label: 'GitHub Repository',
    placeholder: 'Select or create a repository',
    required: true,
    maxLength: 255,
    icon: 'github',
    isSelect: true,
  },
  {
    key: 'jira_project_key',
    label: 'Jira Project Key',
    placeholder: 'e.g. ECOM',
    required: true,
    maxLength: 50,
    icon: 'trello',
    isSelect: true,
  },
];

type FormData = Record<string, string>;

const parseGithubFullNameFromUrl = (url?: string): string | null => {
  if (!url) return null;

  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  return `${owner}/${repo}`;
};

const parseIntegrationError = (
  error: any,
  fallback: string
): { message: string; reconnectRequired: boolean } => {
  const payload = error?.response?.data;
  const rawMessage = payload?.message;
  const providerMessage = payload?.details?.providerMessage;

  const code = payload?.code;
  const readableRawMessage = Array.isArray(rawMessage)
    ? rawMessage.join(', ')
    : typeof rawMessage === 'string'
      ? rawMessage
      : '';

  // Prefer provider message for Jira errors because backend generic messages
  // (e.g. "Failed to fetch Jira projects") hide the real Atlassian reason.
  const message =
    typeof providerMessage === 'string' && providerMessage.trim().length > 0
      ? providerMessage
      : readableRawMessage || fallback;

  const reconnectByCode =
    code === 'ACCOUNT_NOT_LINKED' || code === 'TOKEN_EXPIRED' || code === 'INSUFFICIENT_SCOPE';

  return {
    message,
    reconnectRequired: Boolean(payload?.reconnectRequired) || reconnectByCode,
  };
};

// ==================== Component ====================

const CreateGroupScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditGroup'>>();

  // If groupId exists, we are in edit mode
  const editGroupId = route.params?.groupId;
  const isEditMode = !!editGroupId;

  const [formData, setFormData] = useState<FormData>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Semester picker state
  const [isSemesterModalVisible, setSemesterModalVisible] = useState(false);
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // GitHub repos state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [isRepoModalVisible, setRepoModalVisible] = useState(false);
  const [isJiraModalVisible, setJiraModalVisible] = useState(false);

  // Selected repo metadata (for linking after group creation)
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([]);
  const [loadingJiraProjects, setLoadingJiraProjects] = useState(false);
  const [selectedJiraProject, setSelectedJiraProject] = useState<JiraProject | null>(null);
  const [jiraDisplayFallback, setJiraDisplayFallback] = useState<string>('');
  const [jiraProjectsError, setJiraProjectsError] = useState('');
  const [jiraReconnectRequired, setJiraReconnectRequired] = useState(false);

  // Create new repo state
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);

  const isFormComplete =
    !!formData.name?.trim() &&
    !!formData.project_name?.trim() &&
    !!formData.description?.trim() &&
    !!formData.semester?.trim() &&
    !!formData.github_repo_url?.trim() &&
    !!formData.jira_project_key?.trim();

  // ── Load Current Semester ───────────────

  useEffect(() => {
    const fetchSemester = async () => {
      try {
        setLoadingSemesters(true);
        const semester = await getCurrentSemester();
        setCurrentSemester(semester);
      } catch (error) {
        console.error('Failed to load current semester:', error);
      } finally {
        setLoadingSemesters(false);
      }
    };
    fetchSemester();
  }, []);

  // ── Load Group (edit mode) ──────────────

  useEffect(() => {
    if (isEditMode && editGroupId) {
      const loadGroup = async () => {
        try {
          setLoadingGroup(true);
          const group = await getGroupById(editGroupId);
          setFormData({
            name: group.name || '',
            project_name: group.project_name || '',
            description: group.description || '',
            semester: group.semester || '',
            github_repo_url: group.github_repo_url || '',
            jira_project_key: group.jira_project_key || '',
          });
          setJiraDisplayFallback(group.jira_project_key || '');
        } catch (error: any) {
          showError(error.response?.data?.message || 'Failed to load group');
          navigation.goBack();
        } finally {
          setLoadingGroup(false);
        }
      };
      loadGroup();
    }
  }, [isEditMode, editGroupId, navigation]);

  // ── Load User Repositories ──────────────

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoadingRepos(true);
        const data = await getRepositories();
        setRepos(data.repositories || []);
      } catch (error) {
        console.error('Failed to load GitHub repos:', error);
      } finally {
        setLoadingRepos(false);
      }
    };
    fetchRepos();
  }, []);

  const fetchJiraProjects = useCallback(async () => {
    try {
      setLoadingJiraProjects(true);
      setJiraProjectsError('');
      setJiraReconnectRequired(false);
      const projects = await getJiraProjects();
      setJiraProjects(projects || []);
    } catch (error: any) {
      // User may not have linked Jira yet; keep picker empty but show reason.
      const parsed = parseIntegrationError(
        error,
        'Unable to load Jira projects. Please link Jira account first.'
      );
      setJiraProjects([]);
      setJiraProjectsError(parsed.message);
      setJiraReconnectRequired(parsed.reconnectRequired);
    } finally {
      setLoadingJiraProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchJiraProjects();
  }, [fetchJiraProjects]);

  useEffect(() => {
    if (!isJiraModalVisible) return;
    if (loadingJiraProjects) return;
    if (jiraProjects.length > 0) return;

    fetchJiraProjects();
  }, [fetchJiraProjects, isJiraModalVisible, jiraProjects.length, loadingJiraProjects]);

  useEffect(() => {
    if (!formData.github_repo_url || repos.length === 0 || selectedRepo) return;

    const normalized = formData.github_repo_url.trim().toLowerCase();
    const matched = repos.find((repo) => repo.html_url?.trim().toLowerCase() === normalized);
    if (matched) {
      setSelectedRepo(matched);
    }
  }, [formData.github_repo_url, repos, selectedRepo]);

  useEffect(() => {
    if (!formData.jira_project_key || jiraProjects.length === 0) return;
    if (selectedJiraProject?.key === formData.jira_project_key) return;

    const normalized = formData.jira_project_key.trim().toLowerCase();
    const matched = jiraProjects.find(
      (project) =>
        project.key.trim().toLowerCase() === normalized ||
        project.id.trim().toLowerCase() === normalized
    );
    if (matched) {
      setSelectedJiraProject(matched);
      setJiraDisplayFallback('');
    }
  }, [formData.jira_project_key, jiraProjects, selectedJiraProject]);

  // ── Create New Repository ───────────────

  const handleCreateRepo = async () => {
    const parsed = createRepoSchema.safeParse({
      name: newRepoName,
      description: newRepoDesc,
    });

    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error));
      return;
    }

    try {
      setCreatingRepo(true);
      const result = await createRepository({
        name: parsed.data.name,
        description: parsed.data.description,
      });

      // Add to local repos list
      const newRepo: GitHubRepo = {
        id: result.id,
        name: result.name,
        full_name: result.full_name,
        private: result.private,
        html_url: result.html_url,
        updated_at: new Date().toISOString(),
      };
      setRepos((prev) => [newRepo, ...prev]);

      // Select it
      setSelectedRepo(newRepo);
      updateField('github_repo_url', newRepo.html_url);

      showSuccess(`Repository "${result.name}" created!`);
      setShowCreateRepo(false);
      setRepoModalVisible(false);
      setNewRepoName('');
      setNewRepoDesc('');
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to create repository');
    } finally {
      setCreatingRepo(false);
    }
  };

  // ── Select Existing Repo ────────────────

  const handleSelectRepo = (repo: GitHubRepo | null) => {
    if (!repo || repo.id === -1) {
      setSelectedRepo(null);
      updateField('github_repo_url', '');
    } else {
      setSelectedRepo(repo);
      updateField('github_repo_url', repo.html_url);
    }
    setRepoModalVisible(false);
  };

  const handleSelectJiraProject = (project: JiraProject | null) => {
    if (!project) {
      setSelectedJiraProject(null);
      updateField('jira_project_key', '');
      setJiraDisplayFallback('');
    } else {
      setSelectedJiraProject(project);
      updateField('jira_project_key', project.key);
      setJiraDisplayFallback('');
    }

    setJiraModalVisible(false);
  };

  // ── Submit ──────────────────────────────────────

  const handleSubmit = async () => {
    const parsed = groupFormSchema.safeParse({
      name: formData.name || '',
      project_name: formData.project_name || '',
      description: formData.description || '',
      semester: formData.semester || '',
      github_repo_url: formData.github_repo_url || '',
      jira_project_key: formData.jira_project_key || '',
    });

    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error));
      return;
    }

    const payload: Record<string, string> = {
      name: parsed.data.name,
      project_name: parsed.data.project_name,
      description: parsed.data.description,
      semester: parsed.data.semester,
      github_repo_url: parsed.data.github_repo_url,
      jira_project_key: parsed.data.jira_project_key,
    };

    try {
      setSubmitting(true);

      if (isEditMode && editGroupId) {
        await updateGroup(editGroupId, payload);

        // Link the newly selected repo if one was chosen (not previously linked)
        if (selectedRepo) {
          try {
            const [owner, repoName] = selectedRepo.full_name.split('/');
            await linkRepoToGroup(editGroupId, {
              repo_url: selectedRepo.html_url,
              repo_name: repoName || selectedRepo.name,
              repo_owner: owner || '',
            });
          } catch {
            showInfo('Group updated, but failed to link selected repository.');
          }
        }

        const repoFullName =
          selectedRepo?.full_name || parseGithubFullNameFromUrl(payload.github_repo_url);

        if (selectedJiraProject && repoFullName) {
          try {
            await linkJiraProject({
              github_repo_full_name: repoFullName,
              jira_project_id: selectedJiraProject.id,
            });
          } catch (jiraError: any) {
            showError(
              jiraError?.response?.data?.message || 'Group updated, but failed to link Jira project'
            );
          }
        } else if (selectedJiraProject && !repoFullName) {
          showError(
            'Group updated, but Jira was not linked. Please select a GitHub repository first.'
          );
        }

        showSuccess('Group updated successfully');
      } else {
        const group = await createGroup(payload as any);

        // Auto-link repo to group if one is selected
        if (selectedRepo && group?.id) {
          try {
            const [owner, repoName] = selectedRepo.full_name.split('/');
            await linkRepoToGroup(group.id, {
              repo_url: selectedRepo.html_url,
              repo_name: repoName || selectedRepo.name,
              repo_owner: owner || '',
            });
          } catch {
            showInfo('Group created, but failed to link selected repository.');
          }
        }

        const repoFullName =
          selectedRepo?.full_name || parseGithubFullNameFromUrl(payload.github_repo_url);
        if (selectedJiraProject && repoFullName) {
          try {
            await linkJiraProject({
              github_repo_full_name: repoFullName,
              jira_project_id: selectedJiraProject.id,
            });
          } catch (jiraError: any) {
            showError(
              jiraError?.response?.data?.message || 'Group created, but failed to link Jira project'
            );
          }
        } else if (selectedJiraProject && !repoFullName) {
          showError(
            'Group created, but Jira was not linked. Please select a GitHub repository first.'
          );
        }

        showSuccess('Group created successfully');
      }

      navigation.goBack();
    } catch (error: any) {
      const message =
        error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} group`;
      showError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // ── Render ──────────────────────────────────────

  if (loadingGroup) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="ml-3 text-lg font-bold text-white">
          {isEditMode ? 'Edit Group' : 'Create Group'}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {FORM_FIELDS.map((field) => {
            const isFocused = focusedField === field.key;
            const isGitHub = field.isSelect && field.key === 'github_repo_url';
            const isJira = field.isSelect && field.key === 'jira_project_key';
            const isSemester = field.isSelect && field.key === 'semester';

            return (
              <View key={field.key} className="mb-4">
                <View className="mb-2 flex-row items-center gap-1.5">
                  <Feather
                    name={field.icon as any}
                    size={14}
                    color={isFocused ? '#7C3AED' : '#64748B'}
                  />
                  <Text
                    className={`text-sm font-medium ${
                      isFocused ? 'text-[#7C3AED]' : 'text-gray-400'
                    }`}>
                    {field.label}
                    {field.required && <Text className="text-red-400"> *</Text>}
                  </Text>
                </View>

                {isSemester ? (
                  // Semester selector button
                  <TouchableOpacity
                    onPress={() => setSemesterModalVisible(true)}
                    className={`h-12 justify-center rounded-xl border bg-[#1A2332] px-4 ${isFocused ? 'border-[#7C3AED]' : 'border-white/10'}`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-sm ${formData[field.key] ? 'text-white' : 'text-[#475569]'}`}>
                        {formData[field.key] || field.placeholder}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#64748B" />
                    </View>
                  </TouchableOpacity>
                ) : isGitHub ? (
                  // GitHub repo selector button
                  <TouchableOpacity
                    onPress={() => setRepoModalVisible(true)}
                    className={`h-12 justify-center rounded-xl border bg-[#1A2332] px-4 ${
                      isFocused ? 'border-[#7C3AED]' : 'border-white/10'
                    }`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-sm ${
                          formData[field.key] ? 'text-white' : 'text-[#475569]'
                        }`}
                        numberOfLines={1}>
                        {selectedRepo
                          ? selectedRepo.full_name
                          : parseGithubFullNameFromUrl(formData.github_repo_url)
                            ? parseGithubFullNameFromUrl(formData.github_repo_url)!
                            : field.placeholder}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#64748B" />
                    </View>
                  </TouchableOpacity>
                ) : isJira ? (
                  // Jira project selector button
                  <TouchableOpacity
                    onPress={() => setJiraModalVisible(true)}
                    className={`h-12 justify-center rounded-xl border bg-[#1A2332] px-4 ${
                      isFocused ? 'border-[#7C3AED]' : 'border-white/10'
                    }`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-sm ${
                          formData[field.key] ? 'text-white' : 'text-[#475569]'
                        }`}
                        numberOfLines={1}>
                        {selectedJiraProject
                          ? `${selectedJiraProject.key} - ${selectedJiraProject.name}`
                          : jiraDisplayFallback
                            ? jiraDisplayFallback
                            : field.placeholder}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#64748B" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    value={formData[field.key] || ''}
                    onChangeText={(value) => updateField(field.key, value)}
                    onFocus={() => setFocusedField(field.key)}
                    onBlur={() => setFocusedField(null)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#475569"
                    maxLength={field.maxLength}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 4 : 1}
                    textAlignVertical={field.multiline ? 'top' : 'center'}
                    className={`rounded-xl border bg-[#1A2332] px-4 text-sm text-white ${
                      isFocused ? 'border-[#7C3AED]' : 'border-white/10'
                    } ${field.multiline ? 'min-h-[100px] py-3' : 'h-12'}`}
                    autoCapitalize="none"
                  />
                )}

                {field.maxLength && formData[field.key]?.length > 0 && !field.isSelect && (
                  <Text className="mt-1 text-right text-[10px] text-gray-600">
                    {formData[field.key].length}/{field.maxLength}
                  </Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Submit Button */}
        <View className="border-t border-white/10 px-4 pb-4 pt-2">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !formData.name?.trim()}
            activeOpacity={0.8}
            className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              submitting || !formData.name?.trim() ? 'bg-[#334155]' : 'bg-[#7C3AED]'
            }`}>
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name={isEditMode ? 'check' : 'plus'} size={18} color="#fff" />
                <Text className="text-base font-bold text-white">
                  {isEditMode ? 'Save Changes' : 'Create Group'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ═══════ Semester Selection Modal ═══════ */}
      <Modal
        visible={isSemesterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSemesterModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border-t border-white/10 bg-[#101922]"
            style={{ maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between border-b border-white/10 p-4">
              <Text className="text-lg font-bold text-white">Select Semester</Text>
              <TouchableOpacity onPress={() => setSemesterModalVisible(false)} className="p-2">
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {loadingSemesters ? (
              <View className="items-center justify-center py-10">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <FlatList
                data={[null, ...(currentSemester ? [currentSemester] : [])]}
                keyExtractor={(item, index) => (item ? item.id : `none-${index}`)}
                contentContainerStyle={{ padding: 16 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = item ? formData.semester === item.code : !formData.semester;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        updateField('semester', item ? item.code : '');
                        setSemesterModalVisible(false);
                      }}
                      className={`flex-row items-center justify-between border-b border-white/5 py-4 ${isSelected ? 'opacity-100' : 'opacity-70'}`}>
                      <View className="flex-1">
                        <Text
                          className={`text-base ${item ? 'text-white' : 'italic text-gray-400'}`}>
                          {item ? item.code : 'None'}
                        </Text>
                        {item && <Text className="mt-0.5 text-xs text-gray-400">{item.name}</Text>}
                      </View>
                      {isSelected && <Feather name="check" size={20} color="#7C3AED" />}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════ GitHub Repo Selection Modal ═══════ */}
      <Modal
        visible={isRepoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setRepoModalVisible(false);
          setShowCreateRepo(false);
        }}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border-t border-white/10 bg-[#101922]"
            style={{ maxHeight: '85%' }}>
            {/* Modal Header */}
            <View className="flex-row items-center justify-between border-b border-white/10 p-4">
              <Text className="text-lg font-bold text-white">
                {showCreateRepo ? 'Create Repository' : 'Select Repository'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setRepoModalVisible(false);
                  setShowCreateRepo(false);
                }}
                className="p-2">
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {showCreateRepo ? (
              // ── Create New Repo Form ──
              <View className="p-4">
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-gray-400">
                    Repository Name <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    value={newRepoName}
                    onChangeText={setNewRepoName}
                    placeholder="e.g. my-project"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    className="h-12 rounded-xl border border-white/10 bg-[#1A2332] px-4 text-sm text-white"
                  />
                </View>

                <View className="mb-6">
                  <Text className="mb-2 text-sm font-medium text-gray-400">Description</Text>
                  <TextInput
                    value={newRepoDesc}
                    onChangeText={setNewRepoDesc}
                    placeholder="Optional description..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="min-h-[80px] rounded-xl border border-white/10 bg-[#1A2332] px-4 py-3 text-sm text-white"
                  />
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowCreateRepo(false)}
                    className="flex-1 items-center rounded-xl bg-white/5 py-3.5">
                    <Text className="font-semibold text-white">Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateRepo}
                    disabled={creatingRepo || !newRepoName.trim() || !newRepoDesc.trim()}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                      creatingRepo || !newRepoName.trim() || !newRepoDesc.trim()
                        ? 'bg-[#334155]'
                        : 'bg-[#7C3AED]'
                    }`}>
                    {creatingRepo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="plus" size={16} color="#fff" />
                        <Text className="font-semibold text-white">Create</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                </View>
            ) : (
              // ── Repo List ──
              <>
                {/* Create New Repo Button */}
                <TouchableOpacity
                  onPress={() => setShowCreateRepo(true)}
                  className="mx-4 mb-2 mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-[#7C3AED]/15 py-3.5">
                  <Feather name="plus-circle" size={18} color="#7C3AED" />
                  <Text className="font-semibold text-[#7C3AED]">Create New Repository</Text>
                </TouchableOpacity>

                {loadingRepos ? (
                  <View className="items-center justify-center py-10">
                    <ActivityIndicator size="large" color="#7C3AED" />
                  </View>
                ) : (
                  <FlatList
                    data={[{ id: -1, name: 'None', full_name: '', html_url: '' } as any, ...repos]}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 16, paddingTop: 8 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const isSelected =
                        item.id === -1 ? !selectedRepo : selectedRepo?.id === item.id;

                      return (
                        <TouchableOpacity
                          onPress={() => handleSelectRepo(item.id === -1 ? null : item)}
                          className={`flex-row items-center justify-between border-b border-white/5 py-4 ${
                            isSelected ? 'opacity-100' : 'opacity-70'
                          }`}>
                          <View className="mr-3 flex-1">
                            <Text
                              className={`text-base ${
                                item.id === -1 ? 'italic text-gray-400' : 'text-white'
                              }`}>
                              {item.id === -1 ? 'None' : item.full_name || item.name}
                            </Text>
                            {item.id !== -1 && item.private !== undefined && (
                              <Text className="mt-0.5 text-xs text-gray-500">
                                {item.private ? '🔒 Private' : '🌐 Public'}
                              </Text>
                            )}
                          </View>
                          {isSelected && <Feather name="check" size={20} color="#7C3AED" />}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══════ Jira Project Selection Modal ═══════ */}
      <Modal
        visible={isJiraModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJiraModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl border-t border-white/10 bg-[#101922]"
            style={{ maxHeight: '80%' }}>
            <View className="flex-row items-center justify-between border-b border-white/10 p-4">
              <Text className="text-lg font-bold text-white">Select Jira Project</Text>
              <TouchableOpacity onPress={() => setJiraModalVisible(false)} className="p-2">
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loadingJiraProjects ? (
              <View className="items-center justify-center py-10">
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <>
                {!!jiraProjectsError && (
                  <View className="mx-4 mt-4 rounded-xl border border-[#EA580C]/40 bg-[#7C2D12]/25 p-3">
                    <Text className="text-xs text-orange-200">{jiraProjectsError}</Text>
                    <View className="mt-2 flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={fetchJiraProjects}
                        className="self-start rounded-lg bg-[#EA580C]/20 px-3 py-1.5">
                        <Text className="text-xs font-semibold text-orange-200">Retry</Text>
                      </TouchableOpacity>

                      {jiraReconnectRequired && (
                        <TouchableOpacity
                          onPress={() => {
                            setJiraModalVisible(false);
                            navigation.navigate('LinkedAccounts');
                          }}
                          className="self-start rounded-lg bg-[#1D4ED8]/30 px-3 py-1.5">
                          <Text className="text-xs font-semibold text-sky-200">Reconnect Jira</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                <FlatList
                  data={[null, ...jiraProjects]}
                  keyExtractor={(item, index) => (item ? item.id : `none-${index}`)}
                  contentContainerStyle={{ padding: 16 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="items-center py-10">
                      <Text className="text-center text-sm text-gray-500">
                        No Jira projects found. Link Jira account first.
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = item
                      ? selectedJiraProject?.id === item.id
                      : !selectedJiraProject;

                    return (
                      <TouchableOpacity
                        onPress={() => handleSelectJiraProject(item)}
                        className={`flex-row items-center justify-between border-b border-white/5 py-4 ${
                          isSelected ? 'opacity-100' : 'opacity-70'
                        }`}>
                        <View className="mr-3 flex-1">
                          {item ? (
                            <>
                              <Text className="text-base font-semibold text-white">{item.key}</Text>
                              <Text className="mt-0.5 text-xs text-gray-400" numberOfLines={1}>
                                {item.name}
                              </Text>
                            </>
                          ) : (
                            <Text className="text-base italic text-gray-400">None</Text>
                          )}
                        </View>
                        {isSelected && <Feather name="check" size={20} color="#7C3AED" />}
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CreateGroupScreen;
