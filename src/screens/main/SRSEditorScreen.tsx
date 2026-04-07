import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getSRSByGroup,
  createSRSDocument,
  getSRSVersions,
  saveNewSRSVersion,
  submitSRSDocument,
  type SRSDocument,
  type SRSVersion,
} from '@/services/srsService';
import { showError, showSuccess } from '@/utils/toast';
import { useUserStore } from '@/utils/stores/userStore';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#EAB308',
  SUBMITTED: '#3B82F6',
  GRADED: '#22C55E',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  GRADED: 'Graded',
};

// ── Version Detail Modal ───────────────────────────────────────────────────────

const VersionDetailModal = ({
  version,
  onClose,
  onSubmit,
  canSubmit,
}: {
  version: SRSVersion;
  onClose: () => void;
  onSubmit: (versionId: string) => void;
  canSubmit: boolean;
}) => (
  <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={onClose}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-white">Version {version.version_number}</Text>
          <Text className="text-xs text-gray-500">
            {new Date(version.created_at).toLocaleString('vi-VN')}
            {version.created_by_name ? ` · ${version.created_by_name}` : ''}
          </Text>
        </View>
        {canSubmit && (
          <TouchableOpacity
            onPress={() => onSubmit(version.id)}
            className="rounded-xl bg-blue-600 px-4 py-2">
            <Text className="text-sm font-semibold text-white">Submit this</Text>
          </TouchableOpacity>
        )}
      </View>

      {version.change_summary ? (
        <View className="mx-4 mt-3 rounded-xl bg-[#1A2332] px-4 py-3">
          <Text className="text-xs text-gray-400">
            Change summary: <Text className="text-gray-300">{version.change_summary}</Text>
          </Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="text-sm leading-6 text-gray-200">{version.content}</Text>
      </ScrollView>
    </SafeAreaView>
  </Modal>
);

// ── Save Version Modal ─────────────────────────────────────────────────────────

const SaveVersionModal = ({
  visible,
  initialContent,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string, summary: string) => Promise<void>;
}) => {
  const [content, setContent] = useState(initialContent);
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setContent(initialContent);
      setSummary('');
    }
  }, [visible, initialContent]);

  const handleSave = async () => {
    if (!content.trim()) {
      showError('Content cannot be empty');
      return;
    }
    setSaving(true);
    await onSave(content, summary);
    setSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-row items-center border-b border-white/10 px-4 py-3">
            <TouchableOpacity
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
            <Text className="ml-3 flex-1 text-base font-bold text-white">Write / Edit SRS</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`rounded-xl px-4 py-2 ${saving ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-sm font-semibold text-white">Save Version</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="mx-4 mt-3">
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="Change summary (e.g. Updated use case diagram)"
              placeholderTextColor="#64748B"
              className="h-11 rounded-xl border border-white/10 bg-[#1A2332] px-4 text-sm text-white"
            />
          </View>

          <ScrollView className="flex-1 mx-4 mt-3" keyboardShouldPersistTaps="handled">
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Write your SRS content here (Markdown supported)..."
              placeholderTextColor="#64748B"
              multiline
              scrollEnabled={false}
              className="rounded-xl border border-white/10 bg-[#1A2332] p-4 text-sm text-white"
              style={{ minHeight: 400, textAlignVertical: 'top', lineHeight: 22 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────

const SRSEditorScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SRSEditor'>>();
  const { groupId } = route.params;

  const userInfo = useUserStore((s) => s.userInfo);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [document, setDocument] = useState<SRSDocument | null>(null);
  const [versions, setVersions] = useState<SRSVersion[]>([]);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<SRSVersion | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const latestVersion = versions.length > 0 ? versions[0] : null;

  // ── Load ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const doc = await getSRSByGroup(groupId);
        setDocument(doc);

        if (doc) {
          const v = await getSRSVersions(doc.id);
          // Sort newest first
          setVersions([...v].sort((a, b) => b.version_number - a.version_number));
        } else {
          setVersions([]);
        }
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load SRS');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [groupId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // ── Create document ──────────────────────────────────────────────────────

  const handleCreateDoc = useCallback(async () => {
    if (!docTitle.trim()) {
      showError('Please enter a document title');
      return;
    }
    try {
      setCreatingDoc(true);
      const doc = await createSRSDocument(groupId, { title: docTitle.trim() });
      setDocument(doc);
      setDocTitle('');
      showSuccess('SRS document created');
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to create SRS');
    } finally {
      setCreatingDoc(false);
    }
  }, [groupId, docTitle]);

  // ── Save new version ─────────────────────────────────────────────────────

  const handleSaveVersion = useCallback(
    async (content: string, summary: string) => {
      if (!document) return;
      try {
        await saveNewSRSVersion(document.id, {
          content,
          change_summary: summary || undefined,
        });
        showSuccess('New version saved');
        setShowEditor(false);
        await fetchData(true);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to save version');
      }
    },
    [document, fetchData]
  );

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (versionId: string) => {
      if (!document) return;
      Alert.alert(
        'Submit SRS',
        'Submit this version to your lecturer for review?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Submit',
            onPress: async () => {
              try {
                setSubmitting(true);
                const updated = await submitSRSDocument(document.id, versionId);
                setDocument(updated);
                setSelectedVersion(null);
                showSuccess('SRS submitted successfully!');
                await fetchData(true);
              } catch (error: any) {
                showError(error?.response?.data?.message || 'Failed to submit');
              } finally {
                setSubmitting(false);
              }
            },
          },
        ]
      );
    },
    [document, fetchData]
  );

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const statusColor = document ? STATUS_COLOR[document.status] ?? '#64748B' : '#64748B';
  const canSubmit = document?.status === 'DRAFT' || document?.status === 'GRADED';

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
        <View className="ml-3 flex-1">
          <Text className="text-base font-bold text-white" numberOfLines={1}>
            {document ? document.title : 'SRS Document'}
          </Text>
          {document && (
            <View className="flex-row items-center gap-1.5">
              <View
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <Text className="text-xs" style={{ color: statusColor }}>
                {STATUS_LABEL[document.status] ?? document.status}
              </Text>
            </View>
          )}
        </View>
        {document && (
          <TouchableOpacity
            onPress={() => setShowEditor(true)}
            disabled={document.status === 'SUBMITTED'}
            className={`rounded-xl px-3 py-2 ${document.status === 'SUBMITTED' ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}>
            <Text
              className="text-sm font-semibold"
              style={{ color: document.status === 'SUBMITTED' ? '#64748B' : '#fff' }}>
              + Version
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
            colors={['#7C3AED']}
          />
        }>

        {/* ── No document yet ─────────────────────────────────── */}
        {!document ? (
          <View className="mt-12 items-center gap-4">
            <Feather name="file-text" size={48} color="#334155" />
            <Text className="text-center text-gray-500">No SRS document yet.</Text>
            <Text className="text-center text-xs text-gray-600">
              Create a document to start writing your Software Requirements Specification.
            </Text>

            <View className="mt-2 w-full">
              <TextInput
                value={docTitle}
                onChangeText={setDocTitle}
                placeholder="Document title (e.g. SRS – Project X)"
                placeholderTextColor="#64748B"
                className="mb-3 h-12 rounded-xl border border-white/10 bg-[#1A2332] px-4 text-white"
              />
              <TouchableOpacity
                onPress={handleCreateDoc}
                disabled={creatingDoc}
                className={`items-center rounded-xl py-3.5 ${creatingDoc ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
                activeOpacity={0.8}>
                {creatingDoc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Create SRS Document</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* ── Document info card ──────────────────────────── */}
            <View className="mb-4 rounded-2xl bg-[#1A2332] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-white">{document.title}</Text>
                <View
                  className="rounded-lg px-2.5 py-1"
                  style={{ backgroundColor: `${statusColor}20` }}>
                  <Text className="text-xs font-bold" style={{ color: statusColor }}>
                    {STATUS_LABEL[document.status] ?? document.status}
                  </Text>
                </View>
              </View>

              {document.score != null && (
                <View className="mt-3 flex-row items-center gap-2">
                  <Feather name="star" size={14} color="#EAB308" />
                  <Text className="text-sm font-bold text-yellow-400">Score: {document.score}</Text>
                </View>
              )}
              {document.feedback ? (
                <View className="mt-2 rounded-xl bg-[#243447] p-3">
                  <Text className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                    Lecturer Feedback
                  </Text>
                  <Text className="text-xs leading-5 text-gray-300">{document.feedback}</Text>
                </View>
              ) : null}

              {submitting && (
                <View className="mt-3 flex-row items-center justify-center gap-2">
                  <ActivityIndicator size="small" color="#7C3AED" />
                  <Text className="text-sm text-gray-400">Submitting...</Text>
                </View>
              )}
            </View>

            {/* ── Versions list ───────────────────────────────── */}
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Version History ({versions.length})
            </Text>

            {versions.length === 0 ? (
              <View className="items-center rounded-2xl bg-[#1A2332] p-6">
                <Feather name="layers" size={32} color="#334155" />
                <Text className="mt-2 text-center text-gray-500">No versions yet.</Text>
                <Text className="mt-1 text-center text-xs text-gray-600">
                  Tap "+ Version" to write the first draft.
                </Text>
              </View>
            ) : (
              versions.map((v) => {
                const isSubmitted = document.submitted_version_id === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => setSelectedVersion(v)}
                    activeOpacity={0.85}
                    className="mb-2 rounded-2xl bg-[#1A2332] p-4">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center gap-2">
                          <View className="rounded-lg bg-[#7C3AED]/20 px-2 py-0.5">
                            <Text className="text-xs font-bold text-[#A78BFA]">
                              v{v.version_number}
                            </Text>
                          </View>
                          {isSubmitted && (
                            <View className="rounded-lg bg-blue-900/40 px-2 py-0.5">
                              <Text className="text-[10px] font-bold text-sky-300">
                                Submitted
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="mt-1 text-xs text-gray-500">
                          {new Date(v.created_at).toLocaleString('vi-VN')}
                          {v.created_by_name ? ` · ${v.created_by_name}` : ''}
                        </Text>
                        {v.change_summary ? (
                          <Text className="mt-1 text-xs text-gray-400" numberOfLines={1}>
                            {v.change_summary}
                          </Text>
                        ) : null}
                      </View>
                      <Feather name="chevron-right" size={18} color="#475569" />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Version Detail Modal */}
      {selectedVersion && (
        <VersionDetailModal
          version={selectedVersion}
          onClose={() => setSelectedVersion(null)}
          onSubmit={handleSubmit}
          canSubmit={!!canSubmit}
        />
      )}

      {/* Editor Modal */}
      <SaveVersionModal
        visible={showEditor}
        initialContent={latestVersion?.content ?? ''}
        onClose={() => setShowEditor(false)}
        onSave={handleSaveVersion}
      />
    </SafeAreaView>
  );
};

export default SRSEditorScreen;
