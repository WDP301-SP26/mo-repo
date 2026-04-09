import { Feather } from '@/components/icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
    getGroupSubmissions,
    saveGroupDraftVersion,
    submitDocumentVersion,
    updateDocumentVersion,
    type DocumentSubmission,
} from '@/services/documentService';
import { generateSrsReport } from '@/services/reportService';
import { showError, showSuccess } from '@/utils/toast';
import { documentSubmissionSchema, getZodErrorMessage } from '@/utils/validation/formSchemas';

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#64748B',
  PENDING: '#EAB308',
  APPROVED: '#22C55E',
  REJECTED: '#EF4444',
  GRADED: '#3B82F6',
};

const normalizeUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const hasHttpScheme = (value?: string | null) => /^https?:\/\//i.test(value || '');

const isTrivialSrsMarkdown = (markdown: string) => {
  const normalized = markdown.trim().toLowerCase();
  if (!normalized) return true;

  const placeholderSignals = [
    '- fr-01:',
    '- fr-02:',
    '- uc-01:',
    '- uc-02:',
    '- purpose',
    '- scope',
    '- definitions',
    '- entities',
    '- relationships',
    '- key screens',
    '- navigation flow',
  ];

  const matchedSignals = placeholderSignals.filter((signal) => normalized.includes(signal));
  return matchedSignals.length >= 5;
};

const StatusBadge = ({ status }: { status: string }) => (
  <View
    className="rounded-md border px-2 py-1"
    style={{
      borderColor: `${STATUS_COLOR[status] || '#64748B'}30`,
      backgroundColor: `${STATUS_COLOR[status] || '#64748B'}25`,
    }}>
    <Text className="text-[10px] font-bold" style={{ color: STATUS_COLOR[status] || '#64748B' }}>
      {status}
    </Text>
  </View>
);

const DocumentSubmissionsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Documents'>>();
  const { groupId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [reference, setReference] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [items, setItems] = useState<DocumentSubmission[]>([]);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [submittingVersionId, setSubmittingVersionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const fetchSubmissions = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setLoadError('');
        const data = await getGroupSubmissions(groupId);
        setItems(data || []);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Failed to load submissions';
        setLoadError(message);
        showError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [groupId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchSubmissions();
    }, [fetchSubmissions])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubmissions(true);
  }, [fetchSubmissions]);

  const handleSubmit = useCallback(async () => {
    const normalizedUrl = normalizeUrl(url);
    const parsed = documentSubmissionSchema.safeParse({
      title,
      documentUrl: normalizedUrl,
      reference: reference.trim() || undefined,
      changeSummary: changeSummary.trim() || undefined,
      contentMarkdown,
    });

    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error));
      return;
    }

    try {
      setSubmitting(true);
      if (editingVersionId) {
        await updateDocumentVersion(editingVersionId, {
          title: parsed.data.title,
          document_url: parsed.data.documentUrl || undefined,
          reference: parsed.data.reference || undefined,
          change_summary: parsed.data.changeSummary || undefined,
          content_markdown: contentMarkdown.trim() || undefined,
        });
      } else {
        const baseSubmissionId = items[0]?.id;
        await saveGroupDraftVersion(groupId, {
          title: parsed.data.title,
          document_url: parsed.data.documentUrl || undefined,
          reference: parsed.data.reference || undefined,
          change_summary: parsed.data.changeSummary || undefined,
          content_markdown: contentMarkdown.trim() || undefined,
          base_submission_id: baseSubmissionId,
        });
      }
      setTitle('');
      setUrl('');
      setReference('');
      setChangeSummary('');
      setContentMarkdown('');
      setEditingVersionId(null);
      showSuccess(editingVersionId ? 'Draft updated successfully' : 'Draft version saved successfully');
      fetchSubmissions(true);
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to submit document');
    } finally {
      setSubmitting(false);
    }
  }, [
    changeSummary,
    contentMarkdown,
    editingVersionId,
    fetchSubmissions,
    groupId,
    items,
    reference,
    title,
    url,
  ]);

  const handleEditDraft = useCallback((item: DocumentSubmission) => {
    setEditingVersionId(item.id);
    setTitle(item.title || '');
    setUrl(item.document_url || '');
    setReference(item.reference || '');
    setChangeSummary(item.change_summary || '');
    setContentMarkdown(item.content_markdown || '');
  }, []);

  const handleSubmitToLecturer = useCallback(
    async (submissionId: string) => {
      try {
        setSubmittingVersionId(submissionId);
        await submitDocumentVersion(submissionId);
        showSuccess('Version submitted to lecturer');
        fetchSubmissions(true);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to submit version');
      } finally {
        setSubmittingVersionId(null);
      }
    },
    [fetchSubmissions]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingVersionId(null);
    setTitle('');
    setUrl('');
    setReference('');
    setChangeSummary('');
    setContentMarkdown('');
  }, []);

  const handleGenerateDraft = useCallback(async () => {
    try {
      setSubmitting(true);
      const nextVersion = (items[0]?.version_number || 0) + 1;
      const nextTitle = title.trim() || `SRS Version ${nextVersion}`;

      const aiResponse = await generateSrsReport(groupId);
      const generatedMarkdown = String(aiResponse?.markdown || '').trim();

      if (isTrivialSrsMarkdown(generatedMarkdown)) {
        throw new Error('AI output is still a placeholder template. Please enrich topic/Jira data and generate again.');
      }

      const baseSubmissionId = items[0]?.id;
      const created = await saveGroupDraftVersion(groupId, {
        title: nextTitle,
        reference: reference.trim() || undefined,
        change_summary: changeSummary.trim() || 'AI-generated SRS draft from topic and Jira context',
        content_markdown: generatedMarkdown,
        base_submission_id: baseSubmissionId,
      });

      setEditingVersionId(created.id);
      setTitle(created.title || nextTitle);
      setUrl(created.document_url || '');
      setReference(created.reference || '');
      setChangeSummary(created.change_summary || 'AI-generated SRS draft from topic and Jira context');
      setContentMarkdown(created.content_markdown || generatedMarkdown);

      showSuccess('Generated AI SRS draft successfully');
      fetchSubmissions(true);
    } catch (error: any) {
      showError(error?.response?.data?.message || error?.message || 'Failed to generate AI SRS draft');
    } finally {
      setSubmitting(false);
    }
  }, [changeSummary, fetchSubmissions, groupId, items, reference, title]);

  const handleOpenUrl = useCallback(async (rawUrl?: string | null) => {
    if (!rawUrl) {
      showError('No link to open');
      return;
    }

    const normalizedUrl = normalizeUrl(rawUrl);

    if (!normalizedUrl) {
      showError('Invalid document URL');
      return;
    }

    try {
      const supported = await Linking.canOpenURL(normalizedUrl);
      if (!supported) {
        showError('Cannot open this URL');
        return;
      }

      await Linking.openURL(normalizedUrl);
    } catch {
      showError('Failed to open URL');
    }
  }, []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="ml-3">
          <Text className="text-lg font-bold text-white">Document Versions</Text>
          <Text className="text-xs text-gray-500">Track changes and submit safely</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
            colors={['#7C3AED']}
          />
        }>
        {!!loadError && (
          <View className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
            <Text className="text-sm font-semibold text-red-300">Cannot load versions right now</Text>
            <Text className="mt-1 text-xs text-red-200">{loadError}</Text>
            <TouchableOpacity
              onPress={() => fetchSubmissions(true)}
              className="mt-3 self-start rounded-lg bg-red-500/20 px-3 py-2"
              activeOpacity={0.8}>
              <Text className="text-xs font-semibold text-red-200">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="mb-4 rounded-2xl border border-white/5 bg-[#1A2332] p-4">
          <View className="mb-2 flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#243447]">
              <Feather name="edit-3" size={14} color="#A78BFA" />
            </View>
            <Text className="text-base font-semibold text-white">
              {editingVersionId ? 'Edit Draft Version' : 'Create New Draft Version'}
            </Text>
          </View>
          <Text className="mb-3 text-xs leading-5 text-gray-500">
            Title is required. Reference, URL, markdown content and change summary are optional.
          </Text>

          <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Title
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (e.g. SRS version 3)"
            placeholderTextColor="#64748B"
            className="mb-3 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
          />

          <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Document URL (Optional)
          </Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Document URL (optional)"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            className="mb-3 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
          />

          <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Reference (Optional)
          </Text>
          <TextInput
            value={reference}
            onChangeText={setReference}
            placeholder="Reference (optional, e.g. docs link / branch / note)"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            className="mb-3 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
          />

          <Text className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Change Summary (Optional)
          </Text>
          <TextInput
            value={changeSummary}
            onChangeText={setChangeSummary}
            placeholder="Change summary (optional)"
            placeholderTextColor="#64748B"
            className="rounded-xl border border-white/10 bg-[#101922] px-4 py-3 text-white"
            multiline
            style={{ minHeight: 86, textAlignVertical: 'top' }}
          />

          <Text className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Content Markdown (Optional)
          </Text>
          <TextInput
            value={contentMarkdown}
            onChangeText={setContentMarkdown}
            placeholder="Write SRS markdown here..."
            placeholderTextColor="#64748B"
            className="rounded-xl border border-white/10 bg-[#101922] px-4 py-3 text-white"
            multiline
            style={{ minHeight: 140, textAlignVertical: 'top' }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            className={`mt-4 items-center rounded-xl py-3.5 ${submitting ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
            activeOpacity={0.8}>
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-semibold text-white">
                {editingVersionId ? 'Update Draft' : 'Save Draft'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleGenerateDraft}
            disabled={submitting || !!editingVersionId}
            className={`mt-2 items-center rounded-xl border border-white/10 py-3 ${submitting || !!editingVersionId ? 'opacity-50' : ''}`}
            activeOpacity={0.8}>
            <Text className="font-semibold text-gray-200">Generate SRS Draft</Text>
          </TouchableOpacity>
          {editingVersionId && (
            <TouchableOpacity
              onPress={handleCancelEdit}
              disabled={submitting}
              className="mt-2 items-center rounded-xl border border-white/10 py-3"
              activeOpacity={0.8}>
              <Text className="font-semibold text-gray-300">Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#243447]">
            <Feather name="layers" size={14} color="#A78BFA" />
          </View>
          <Text className="text-base font-semibold text-white">Version History</Text>
        </View>
        {items.length === 0 ? (
          <View className="items-center rounded-2xl border border-white/5 bg-[#1A2332] p-6">
            <Feather name="file-text" size={30} color="#475569" />
            <Text className="mt-2 text-gray-500">No versions yet</Text>
            <Text className="mt-1 text-center text-xs text-gray-600">
              Create the first draft above to start your document history.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} className="mb-3 rounded-2xl border border-white/5 bg-[#1A2332] p-4">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 font-semibold text-white" numberOfLines={1}>
                  {item.title}
                </Text>
                <View className="ml-2 flex-row items-center gap-2">
                  {typeof item.version_number === 'number' && (
                    <View className="rounded-md border border-[#7C3AED]/30 bg-[#7C3AED]/20 px-2 py-1">
                      <Text className="text-[10px] font-bold text-[#A78BFA]">v{item.version_number}</Text>
                    </View>
                  )}
                  <StatusBadge status={item.status} />
                </View>
              </View>

              {!!item.base_submission?.version_number && (
                <Text className="mt-1 text-xs text-gray-500">
                  Based on v{item.base_submission.version_number}
                </Text>
              )}

              <Text className="mt-1 text-xs text-gray-500">
                {new Date(item.created_at).toLocaleString('vi-VN')}
              </Text>

              {!!item.reference && (
                <View className="mt-2 rounded-lg bg-[#243447] px-3 py-2">
                  <Text className="text-[10px] uppercase tracking-wider text-gray-500">Reference</Text>
                  {hasHttpScheme(item.reference) ? (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleOpenUrl(item.reference)}>
                      <Text className="mt-1 text-xs text-[#93C5FD] underline" numberOfLines={2}>
                        {item.reference}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text className="mt-1 text-xs text-gray-300">{item.reference}</Text>
                  )}
                </View>
              )}

              {!!item.document_url && (
                <View className="mt-2 rounded-lg bg-[#243447] px-3 py-2">
                  <Text className="text-[10px] uppercase tracking-wider text-gray-500">Legacy URL</Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => handleOpenUrl(item.document_url)}>
                    <Text className="mt-1 text-xs text-[#93C5FD] underline" numberOfLines={2}>
                      {item.document_url}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {!!item.change_summary && (
                <View className="mt-2 rounded-lg bg-[#243447] px-3 py-2">
                  <Text className="text-[10px] uppercase tracking-wider text-gray-500">Change Summary</Text>
                  <Text className="mt-1 text-xs text-gray-300">{item.change_summary}</Text>
                </View>
              )}

              {!!item.content_markdown && (
                <View className="mt-2 rounded-lg bg-[#243447] px-3 py-2">
                  <Text className="text-[10px] uppercase tracking-wider text-gray-500">Content Preview</Text>
                  <Text className="mt-1 text-xs text-gray-300" numberOfLines={5}>
                    {item.content_markdown}
                  </Text>
                </View>
              )}

              {item.status === 'DRAFT' && (
                <View className="mt-3 flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => handleEditDraft(item)}
                    className="flex-1 items-center rounded-lg bg-[#243447] py-2.5"
                    activeOpacity={0.8}>
                    <Text className="text-xs font-semibold text-[#A78BFA]">Edit Draft</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSubmitToLecturer(item.id)}
                    disabled={submittingVersionId === item.id}
                    className="flex-1 items-center rounded-lg bg-[#7C3AED] py-2.5"
                    activeOpacity={0.8}>
                    {submittingVersionId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text className="text-xs font-semibold text-white">Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {item.feedback ? (
                <Text className="mt-2 text-xs text-gray-400">Feedback: {item.feedback}</Text>
              ) : null}
              {typeof item.score === 'number' ? (
                <Text className="mt-1 text-xs text-green-400">Score: {item.score}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default DocumentSubmissionsScreen;
