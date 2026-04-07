import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getCheckpoints,
  createCheckpoint,
  deleteCheckpoint,
  type Checkpoint,
} from '@/services/checkpointService';
import { showError, showSuccess } from '@/utils/toast';

// ── Component ──────────────────────────────────────────────────────────────────

const CheckpointManageScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CheckpointManage'>>();
  const { semesterId, classId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');

  // ── Load ────────────────────────────────────────────────────────────────────

  const fetchCheckpoints = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await getCheckpoints(semesterId);
        // Filter to checkpoints for this class (or global ones with no class)
        const filtered = data.filter(
          (cp) => !cp.class_id || cp.class_id === classId
        );
        setCheckpoints(filtered);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load checkpoints');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [semesterId, classId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchCheckpoints();
    }, [fetchCheckpoints])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCheckpoints(true);
  }, [fetchCheckpoints]);

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const ws = parseInt(weekStart, 10);
    const we = parseInt(weekEnd, 10);

    if (!title.trim()) {
      showError('Title is required');
      return;
    }
    if (Number.isNaN(ws) || ws < 1 || ws > 10) {
      showError('Week start must be between 1 and 10');
      return;
    }
    if (Number.isNaN(we) || we < ws || we > 10) {
      showError('Week end must be ≥ week start and ≤ 10');
      return;
    }

    try {
      setSubmitting(true);
      await createCheckpoint({
        semester_id: semesterId,
        class_id: classId,
        title: title.trim(),
        description: description.trim(),
        week_start: ws,
        week_end: we,
      });
      setTitle('');
      setDescription('');
      setWeekStart('');
      setWeekEnd('');
      setShowForm(false);
      showSuccess('Checkpoint created');
      fetchCheckpoints(true);
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to create checkpoint');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, weekStart, weekEnd, semesterId, classId, fetchCheckpoints]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    (cp: Checkpoint) => {
      Alert.alert(
        'Delete Checkpoint',
        `Delete "${cp.title}"? This cannot be undone if no tasks are linked.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteCheckpoint(cp.id);
                showSuccess('Checkpoint deleted');
                fetchCheckpoints(true);
              } catch (error: any) {
                showError(error?.response?.data?.message || 'Failed to delete checkpoint');
              }
            },
          },
        ]
      );
    },
    [fetchCheckpoints]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

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

      {/* Header */}
      <View className="flex-row items-center border-b border-white/10 px-4 py-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="ml-3 flex-1 text-lg font-bold text-white">Manage Checkpoints</Text>
        <TouchableOpacity
          onPress={() => setShowForm((v) => !v)}
          className="h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]">
          <Feather name={showForm ? 'x' : 'plus'} size={20} color="#fff" />
        </TouchableOpacity>
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
        {/* ── Create form ─────────────────────────────────────── */}
        {showForm && (
          <View className="mb-5 rounded-2xl bg-[#1A2332] p-4">
            <Text className="mb-3 text-sm font-bold text-white">New Checkpoint</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title (e.g. Week 1–3: Form groups)"
              placeholderTextColor="#64748B"
              className="mb-3 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description / requirements for students"
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
              className="mb-3 rounded-xl border border-white/10 bg-[#101922] px-4 py-3 text-white"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View className="mb-4 flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-1 text-xs text-gray-400">Week start</Text>
                <TextInput
                  value={weekStart}
                  onChangeText={setWeekStart}
                  placeholder="1"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  className="h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-gray-400">Week end</Text>
                <TextInput
                  value={weekEnd}
                  onChangeText={setWeekEnd}
                  placeholder="3"
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  className="h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCreate}
              disabled={submitting}
              className={`items-center rounded-xl py-3.5 ${submitting ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
              activeOpacity={0.8}>
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="font-semibold text-white">Create Checkpoint</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Checkpoint list ─────────────────────────────────── */}
        {checkpoints.length === 0 ? (
          <View className="mt-12 items-center gap-3">
            <Feather name="flag" size={40} color="#334155" />
            <Text className="text-center text-gray-500">No checkpoints yet.</Text>
            <Text className="text-center text-xs text-gray-600">
              Tap + to create the first milestone for your class.
            </Text>
          </View>
        ) : (
          checkpoints.map((cp) => (
            <View key={cp.id} className="mb-3 rounded-2xl bg-[#1A2332] p-4">
              <View className="mb-1 flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-white">{cp.title}</Text>
                  <View className="mt-1 flex-row items-center gap-1.5">
                    <Feather name="calendar" size={12} color="#7C3AED" />
                    <Text className="text-xs font-semibold text-[#A78BFA]">
                      Week {cp.week_start}–{cp.week_end}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(cp)}
                  className="h-9 w-9 items-center justify-center rounded-xl bg-red-900/30">
                  <Feather name="trash-2" size={15} color="#F87171" />
                </TouchableOpacity>
              </View>
              {!!cp.description && (
                <Text className="mt-2 text-xs leading-5 text-gray-400">{cp.description}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CheckpointManageScreen;
