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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import {
  getWeeklyGrades,
  createWeeklyGrade,
  updateWeeklyGrade,
  approvePresentationGroup,
  type WeeklyGrade,
} from '@/services/weeklyGradeService';
import { showError, showSuccess } from '@/utils/toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TOTAL_WEEKS = 10;
const PASSING_THRESHOLD = 5.0;

const calcFinalScore = (grades: WeeklyGrade[]) => {
  if (grades.length === 0) return null;
  const avg = (key: keyof Pick<WeeklyGrade, 'task_score' | 'commit_score' | 'attitude_score'>) =>
    grades.reduce((sum, g) => sum + g[key], 0) / grades.length;
  const avgTask = avg('task_score');
  const avgCommit = avg('commit_score');
  const avgAttitude = avg('attitude_score');
  const total = avgTask * 0.4 + avgCommit * 0.3 + avgAttitude * 0.3;
  return { avgTask, avgCommit, avgAttitude, total, can_approve: total >= PASSING_THRESHOLD };
};

const scoreColor = (v: number) => {
  if (v >= 8) return '#22C55E';
  if (v >= 6) return '#EAB308';
  return '#EF4444';
};

// ── Grade Form Modal ───────────────────────────────────────────────────────────

interface GradeFormProps {
  visible: boolean;
  weekNumber: number;
  existing?: WeeklyGrade;
  semesterId: string;
  groupId: string;
  onClose: () => void;
  onSaved: () => void;
}

const GradeFormModal = ({
  visible,
  weekNumber,
  existing,
  semesterId,
  groupId,
  onClose,
  onSaved,
}: GradeFormProps) => {
  const [taskScore, setTaskScore] = useState(existing ? String(existing.task_score) : '');
  const [commitScore, setCommitScore] = useState(existing ? String(existing.commit_score) : '');
  const [attitudeScore, setAttitudeScore] = useState(
    existing ? String(existing.attitude_score) : ''
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);

  const validateScore = (v: string) => {
    const n = parseFloat(v);
    return !Number.isNaN(n) && n >= 0 && n <= 10;
  };

  const handleSave = async () => {
    if (!validateScore(taskScore) || !validateScore(commitScore) || !validateScore(attitudeScore)) {
      showError('Scores must be numbers between 0 and 10');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        task_score: parseFloat(taskScore),
        commit_score: parseFloat(commitScore),
        attitude_score: parseFloat(attitudeScore),
        note: note.trim() || undefined,
      };

      if (existing) {
        await updateWeeklyGrade(existing.id, payload);
      } else {
        await createWeeklyGrade({ ...payload, group_id: groupId, semester_id: semesterId, week_number: weekNumber });
      }
      showSuccess(`Week ${weekNumber} grade saved`);
      onSaved();
      onClose();
    } catch (error: any) {
      showError(error?.response?.data?.message || 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-3xl bg-[#1A2332] px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">Grade Week {weekNumber}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {[
            { label: 'Task completion (0–10)', value: taskScore, set: setTaskScore },
            { label: 'Commit / GitHub (0–10)', value: commitScore, set: setCommitScore },
            { label: 'Attitude (0–10)', value: attitudeScore, set: setAttitudeScore },
          ].map((field) => (
            <View key={field.label} className="mb-3">
              <Text className="mb-1 text-xs text-gray-400">{field.label}</Text>
              <TextInput
                value={field.value}
                onChangeText={field.set}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor="#64748B"
                className="h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-white"
              />
            </View>
          ))}

          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-400">Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Remarks for this week..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={2}
              className="rounded-xl border border-white/10 bg-[#101922] px-4 py-3 text-white"
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className={`items-center rounded-xl py-4 ${saving ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
            activeOpacity={0.8}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Save Grade</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────

const WeeklyGradeScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'WeeklyGrade'>>();
  const { groupId, groupName, semesterId, currentWeek, isLecturer } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [grades, setGrades] = useState<WeeklyGrade[]>([]);
  const [modalWeek, setModalWeek] = useState<number | null>(null);
  const [approvingPresentation, setApprovingPresentation] = useState(false);

  const gradeByWeek = Object.fromEntries(grades.map((g) => [g.week_number, g]));
  const finalScore = calcFinalScore(grades);

  // ── Load ────────────────────────────────────────────────────────────────────

  const fetchGrades = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await getWeeklyGrades(groupId);
        setGrades(data);
      } catch (error: any) {
        showError(error?.response?.data?.message || 'Failed to load grades');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [groupId]
  );

  useFocusEffect(
    useCallback(() => {
      fetchGrades();
    }, [fetchGrades])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGrades(true);
  }, [fetchGrades]);

  // ── Approve Presentation ─────────────────────────────────────────────────

  const handleApprove = useCallback(
    (approve: boolean) => {
      if (!isLecturer) return;

      Alert.prompt(
        approve ? 'Approve Presentation' : 'Reject Presentation',
        approve
          ? 'Add a reason or note (optional):'
          : 'Please provide a reason for rejection:',
        async (reason) => {
          try {
            setApprovingPresentation(true);
            await approvePresentationGroup(groupId, {
              approved: approve,
              reason: reason?.trim() || undefined,
            });
            showSuccess(approve ? 'Group approved to present!' : 'Group rejected. Notified.');
            fetchGrades(true);
          } catch (error: any) {
            showError(error?.response?.data?.message || 'Action failed');
          } finally {
            setApprovingPresentation(false);
          }
        },
        'plain-text'
      );
    },
    [groupId, isLecturer, fetchGrades]
  );

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  const selectedGrade = modalWeek != null ? gradeByWeek[modalWeek] : undefined;

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
            Weekly Grades
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {groupName}
          </Text>
        </View>
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

        {/* ── Final score summary ─────────────────────────────── */}
        {finalScore && (
          <View className="mb-5 rounded-2xl bg-[#1A2332] p-4">
            <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Average Summary ({grades.length}/{TOTAL_WEEKS} weeks graded)
            </Text>
            <View className="flex-row gap-2">
              {[
                { label: 'Tasks', value: finalScore.avgTask },
                { label: 'Commits', value: finalScore.avgCommit },
                { label: 'Attitude', value: finalScore.avgAttitude },
                { label: 'Total', value: finalScore.total },
              ].map((s) => (
                <View key={s.label} className="flex-1 items-center rounded-xl bg-[#243447] py-2">
                  <Text
                    className="text-base font-bold"
                    style={{ color: scoreColor(s.value) }}>
                    {s.value.toFixed(1)}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-gray-500">{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Approve/Reject — only at week 10, only for lecturer */}
            {isLecturer && grades.length >= TOTAL_WEEKS && (
              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => handleApprove(false)}
                  disabled={approvingPresentation}
                  className="flex-1 items-center rounded-xl border border-red-800 py-3"
                  activeOpacity={0.8}>
                  <Text className="text-sm font-semibold text-red-400">Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleApprove(true)}
                  disabled={approvingPresentation || !finalScore.can_approve}
                  className={`flex-1 items-center rounded-xl py-3 ${
                    finalScore.can_approve ? 'bg-green-700' : 'bg-[#334155]'
                  }`}
                  activeOpacity={0.8}>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: finalScore.can_approve ? '#fff' : '#64748B' }}>
                    {finalScore.can_approve ? 'Approve Present' : `Below ${PASSING_THRESHOLD}`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Student badge */}
            {!isLecturer && grades.length >= TOTAL_WEEKS && (
              <View
                className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-3"
                style={{
                  backgroundColor: finalScore.can_approve ? '#14532d' : '#7f1d1d',
                }}>
                <Feather
                  name={finalScore.can_approve ? 'check-circle' : 'x-circle'}
                  size={16}
                  color={finalScore.can_approve ? '#4ade80' : '#f87171'}
                />
                <Text
                  className="font-semibold"
                  style={{ color: finalScore.can_approve ? '#4ade80' : '#f87171' }}>
                  {finalScore.can_approve ? 'Eligible to Present' : 'Not Yet Qualified'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Week timeline ───────────────────────────────────── */}
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Week Progress
        </Text>

        {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
          const grade = gradeByWeek[week];
          const isCurrent = week === currentWeek;
          const isFuture = week > currentWeek;

          return (
            <TouchableOpacity
              key={week}
              activeOpacity={isLecturer && !isFuture ? 0.8 : 1}
              onPress={() => {
                if (isLecturer && !isFuture) setModalWeek(week);
              }}
              className="mb-2 overflow-hidden rounded-2xl bg-[#1A2332]">
              <View className="flex-row items-center p-4">
                {/* Week number */}
                <View
                  className="mr-4 h-10 w-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: grade
                      ? `${scoreColor(
                          (grade.task_score + grade.commit_score + grade.attitude_score) / 3
                        )}20`
                      : isCurrent
                        ? '#1D4ED820'
                        : '#24344720',
                  }}>
                  <Text
                    className="text-sm font-bold"
                    style={{
                      color: grade
                        ? scoreColor(
                            (grade.task_score + grade.commit_score + grade.attitude_score) / 3
                          )
                        : isCurrent
                          ? '#93C5FD'
                          : '#64748B',
                    }}>
                    {week}
                  </Text>
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-semibold text-white">Week {week}</Text>
                    {isCurrent && (
                      <View className="rounded-md bg-[#1D4ED8]/30 px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-sky-300">Current</Text>
                      </View>
                    )}
                  </View>

                  {grade ? (
                    <View className="mt-1 flex-row gap-3">
                      <Text className="text-xs text-gray-400">
                        T:{' '}
                        <Text style={{ color: scoreColor(grade.task_score) }}>
                          {grade.task_score.toFixed(1)}
                        </Text>
                      </Text>
                      <Text className="text-xs text-gray-400">
                        C:{' '}
                        <Text style={{ color: scoreColor(grade.commit_score) }}>
                          {grade.commit_score.toFixed(1)}
                        </Text>
                      </Text>
                      <Text className="text-xs text-gray-400">
                        A:{' '}
                        <Text style={{ color: scoreColor(grade.attitude_score) }}>
                          {grade.attitude_score.toFixed(1)}
                        </Text>
                      </Text>
                    </View>
                  ) : (
                    <Text className="mt-0.5 text-xs text-gray-600">
                      {isFuture ? 'Not reached yet' : 'Not graded yet'}
                    </Text>
                  )}

                  {grade?.note ? (
                    <Text className="mt-1 text-xs italic text-gray-500" numberOfLines={1}>
                      "{grade.note}"
                    </Text>
                  ) : null}
                </View>

                {/* Action icon */}
                {isLecturer && !isFuture && (
                  <Feather
                    name={grade ? 'edit-2' : 'plus-circle'}
                    size={18}
                    color={grade ? '#7C3AED' : '#475569'}
                  />
                )}

                {grade && !isLecturer && (
                  <Feather name="check-circle" size={18} color="#22C55E" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grade Form Modal */}
      {modalWeek != null && (
        <GradeFormModal
          visible
          weekNumber={modalWeek}
          existing={selectedGrade}
          semesterId={semesterId}
          groupId={groupId}
          onClose={() => setModalWeek(null)}
          onSaved={() => fetchGrades(true)}
        />
      )}
    </SafeAreaView>
  );
};

export default WeeklyGradeScreen;
