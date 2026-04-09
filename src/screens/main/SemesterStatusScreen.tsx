import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import {
  getCurrentWeek,
  getStudentPublishedScores,
  getStudentWarnings,
  getStudentReviewStatus,
  type ReviewSessionTimelineItem,
  type SerializedSemester,
  type StudentPublishedScoreGroup,
  type StudentWarning,
  type ComplianceClassSummary,
  type ReviewGroup,
  type ReviewMilestoneContext,
} from '@/services/semesterService';
import type { RootStackParamList } from '@/navigation/AppNavigator';

// ── Helpers ────────────────────────────────────────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
  REVIEW_1: 'Review 1',
  PROGRESS_TRACKING: 'Progress Tracking',
  REVIEW_2: 'Review 2',
  REVIEW_3: 'Review 3',
};

const WARNING_COLORS: Record<string, string> = {
  WEEK1_NO_GROUP: '#EAB308',
  WEEK2_TOPIC_NOT_FINALIZED: '#F97316',
};

const WARNING_ICONS: Record<string, string> = {
  WEEK1_NO_GROUP: 'users',
  WEEK2_TOPIC_NOT_FINALIZED: 'book-open',
};

const WEEK_STATUS_COLOR = (status: 'PASS' | 'FAIL') => (status === 'PASS' ? '#22C55E' : '#EF4444');

const formatDate = (value?: string | null) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
};

const sortSessionsNewestFirst = (sessions: ReviewSessionTimelineItem[]) => {
  return [...sessions].sort(
    (a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
  );
};

const SectionHeader = ({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon: string;
}) => (
  <View className="mb-2 flex-row items-center justify-between">
    <View className="flex-row items-center gap-2">
      <View className="h-7 w-7 items-center justify-center rounded-lg bg-[#243447]">
        <Feather name={icon} size={14} color="#A78BFA" />
      </View>
      <View>
        <Text className="text-xs uppercase tracking-wider text-gray-300">{title}</Text>
        {!!subtitle && <Text className="text-[11px] text-gray-500">{subtitle}</Text>}
      </View>
    </View>
  </View>
);

// ── Component ──────────────────────────────────────────────────────────────────

const SemesterStatusScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SemesterStatus'>>();
  const { groupId } = route.params;

  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState<SerializedSemester | null>(null);
  const [warnings, setWarnings] = useState<StudentWarning[]>([]);
  const [complianceClasses, setComplianceClasses] = useState<ComplianceClassSummary[]>([]);
  const [milestone, setMilestone] = useState<ReviewMilestoneContext | null>(null);
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [publishedScoresByGroup, setPublishedScoresByGroup] = useState<StudentPublishedScoreGroup[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [weekRes, warningRes, reviewRes, scoreRes] = await Promise.allSettled([
        getCurrentWeek(),
        getStudentWarnings(),
        getStudentReviewStatus(),
        getStudentPublishedScores(),
      ]);

      if (weekRes.status === 'fulfilled') {
        setSemester(weekRes.value.semester);
      }
      if (warningRes.status === 'fulfilled') {
        // Only keep the class that contains this specific group
        const filteredClasses = warningRes.value.classes
          .filter((cls) => cls.groups.some((g) => g.group_id === groupId))
          .map((cls) => ({
            ...cls,
            groups: cls.groups.filter((g) => g.group_id === groupId),
          }));

        // Only keep warnings that explicitly belong to this group
        const filteredWarnings = warningRes.value.warnings.filter((w) => w.group_id === groupId);

        setWarnings(filteredWarnings);
        setComplianceClasses(filteredClasses);
        if (warningRes.value.semester) {
          setSemester((current) => current ?? warningRes.value.semester);
        }
      }
      if (reviewRes.status === 'fulfilled') {
        setMilestone(reviewRes.value.milestone);
        // Only show review for this specific group
        setReviewGroups(reviewRes.value.groups.filter((g) => g.group_id === groupId));
      }

      if (scoreRes.status === 'fulfilled') {
        setPublishedScoresByGroup(scoreRes.value.groups.filter((g) => g.group_id === groupId));
      } else {
        setPublishedScoresByGroup([]);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#101922]">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  // ── No semester ───────────────────────────────────────────────────────────────

  if (!semester) {
    return (
      <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#101922" />
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="h-10 w-10 items-center justify-center rounded-xl bg-[#1A2332]">
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text className="ml-3 text-lg font-bold text-white">Semester Status</Text>
        </View>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <MaterialIcons name="school" size={52} color="#334155" />
          <Text className="text-center text-base text-gray-500">No active semester found.</Text>
          <Text className="text-center text-sm text-gray-600">
            Check back when a new semester starts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    semester.status === 'ACTIVE'
      ? '#22C55E'
      : semester.status === 'UPCOMING'
        ? '#EAB308'
        : '#64748B';

  const activeReviewGroup = reviewGroups[0] || null;
  const activePublishedScore = publishedScoresByGroup[0] || null;
  const reviewSessions = sortSessionsNewestFirst(activeReviewGroup?.review_sessions || []);

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
          <Text className="text-lg font-bold text-white">Semester Status</Text>
          <Text className="text-xs text-gray-500">{semester.name}</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}>
        {/* ── Semester Info Card ──────────────────────────────── */}
        <View className="mb-4 mt-2 rounded-2xl border border-white/5 bg-[#1A2332] p-4">
          <SectionHeader title="Semester Overview" subtitle="Your current timeline" icon="calendar" />

          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
              <Text className="text-base font-bold text-white">{semester.code}</Text>
            </View>
            <View
              className="rounded-lg px-2.5 py-1"
              style={{ backgroundColor: `${statusColor}20` }}>
              <Text className="text-xs font-semibold" style={{ color: statusColor }}>
                {semester.status}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-4">
            <View className="flex-1">
              <Text className="mb-0.5 text-xs text-gray-500">Current Week</Text>
              <Text className="text-2xl font-bold text-white">
                Week {semester.current_week}
                <Text className="text-base font-normal text-gray-500"> / 10</Text>
              </Text>
            </View>
            <View className="flex-1">
              <Text className="mb-0.5 text-xs text-gray-500">Period</Text>
              <Text className="text-xs text-gray-300">
                {new Date(semester.start_date).toLocaleDateString()} –
              </Text>
              <Text className="text-xs text-gray-300">
                {new Date(semester.end_date).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Week progress bar */}
          <View className="mt-3">
            <View className="h-2 overflow-hidden rounded-full bg-[#243447]">
              <View
                className="h-full rounded-full bg-[#7C3AED]"
                style={{ width: `${Math.min((semester.current_week / 10) * 100, 100)}%` }}
              />
            </View>
          </View>
        </View>

        {/* ── Active Warnings ─────────────────────────────────── */}
        {warnings.length > 0 && (
          <View className="mb-4">
            <SectionHeader
              title="Action Required"
              subtitle="Items that may block your weekly progress"
              icon="alert-triangle"
            />
            {warnings.map((w, i) => (
              <View
                key={i}
                className="mb-2 flex-row items-start gap-3 rounded-2xl border border-white/5 p-4"
                style={{ backgroundColor: `${WARNING_COLORS[w.code] || '#EAB308'}18` }}>
                <Feather
                  name={(WARNING_ICONS[w.code] || 'alert-triangle') as any}
                  size={18}
                  color={WARNING_COLORS[w.code] || '#EAB308'}
                />
                <View className="flex-1">
                  <Text
                    className="mb-0.5 text-sm font-semibold"
                    style={{ color: WARNING_COLORS[w.code] || '#EAB308' }}>
                    {w.class_code}
                    {w.group_name ? ` · ${w.group_name}` : ''}
                  </Text>
                  <Text className="text-xs leading-4 text-gray-300">{w.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Compliance / Week Checkpoints ───────────────────── */}
        {complianceClasses.length > 0 && (
          <View className="mb-4">
            <SectionHeader
              title="Weekly Checkpoints"
              subtitle="Week 1 and Week 2 readiness checks"
              icon="check-square"
            />
            {complianceClasses.map((cls) => (
              <View key={cls.class_id} className="mb-3 rounded-2xl border border-white/5 bg-[#1A2332] p-4">
                <Text className="mb-3 text-sm font-bold text-white">
                  {cls.class_code}
                  <Text className="font-normal text-gray-500"> · {cls.class_name}</Text>
                </Text>

                {/* Week 1 checkpoint */}
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Feather
                      name={cls.week1_status === 'PASS' ? 'check-circle' : 'circle'}
                      size={16}
                      color={WEEK_STATUS_COLOR(cls.week1_status)}
                    />
                    <Text className="text-sm text-gray-300">Week 1 · Joined a group</Text>
                  </View>
                  <Text
                    className="text-xs font-bold"
                    style={{ color: WEEK_STATUS_COLOR(cls.week1_status) }}>
                    {cls.week1_status}
                  </Text>
                </View>

                {/* Week 2 per group */}
                {cls.groups.map((g) => (
                  <View
                    key={g.group_id}
                    className="mb-2 flex-row items-center justify-between pl-2">
                    <View className="flex-1 flex-row items-center gap-2">
                      <Feather
                        name={g.week2_status === 'PASS' ? 'check-circle' : 'circle'}
                        size={16}
                        color={WEEK_STATUS_COLOR(g.week2_status)}
                      />
                      <View className="flex-1">
                        <Text className="text-sm text-gray-300" numberOfLines={1}>
                          Week 2 · Topic finalized
                        </Text>
                        <Text className="text-xs text-gray-600" numberOfLines={1}>
                          {g.group_name}
                          {g.topic_name ? ` · ${g.topic_name}` : ' · No topic yet'}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="ml-2 text-xs font-bold"
                      style={{ color: WEEK_STATUS_COLOR(g.week2_status) }}>
                      {g.week2_status}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Published Checkpoint Scores (checkpoint-centric) ─ */}
        <View className="mb-4 rounded-2xl border border-[#7C3AED]/20 bg-[#1A2332] p-4">
          <SectionHeader
            title="Published Checkpoint Scores"
            subtitle="Official scores visible to students"
            icon="award"
          />

          <View className="mb-2 mt-2 flex-row gap-2">
            <ScoreBadge label="CP1" value={activePublishedScore?.checkpoints.checkpoint_1 ?? null} />
            <ScoreBadge label="CP2" value={activePublishedScore?.checkpoints.checkpoint_2 ?? null} />
            <ScoreBadge label="CP3" value={activePublishedScore?.checkpoints.checkpoint_3 ?? null} />
            <ScoreBadge label="Total" value={activePublishedScore?.total_score ?? null} highlight />
          </View>

          {!activePublishedScore && (
            <Text className="text-xs text-gray-500">
              No published checkpoint scores yet. Values will appear as each checkpoint is published.
            </Text>
          )}
        </View>

        {/* ── Review Milestone ────────────────────────────────── */}
        {milestone && reviewGroups.length > 0 && (
          <View className="mb-4">
            <View className="mb-2 flex-row items-center justify-between rounded-xl bg-[#1A2332] px-3 py-2">
              <Text className="text-xs uppercase tracking-wider text-gray-300">Review Status</Text>
              <View className="rounded-lg bg-[#7C3AED]/20 px-2.5 py-1">
                <Text className="text-xs font-semibold text-[#7C3AED]">
                  {MILESTONE_LABELS[milestone.code] || milestone.code}
                </Text>
              </View>
            </View>
            <Text className="mb-3 text-xs text-gray-600">
              Week {milestone.week_start}–{milestone.week_end}
            </Text>

            {reviewGroups.map((g) => (
              <ReviewGroupCard key={g.group_id} group={g} />
            ))}
          </View>
        )}

        {/* ── Review Timeline (tracking only) ─────────────────── */}
        {(activeReviewGroup || reviewSessions.length > 0) && (
          <View className="mb-4 rounded-2xl border border-white/5 bg-[#1A2332] p-4">
            <SectionHeader
              title="Review Timeline"
              subtitle="Progress tracking from your lecturer"
              icon="clock"
            />

            {reviewSessions.length === 0 ? (
              <Text className="text-xs text-gray-500">
                No review sessions captured yet for this group.
              </Text>
            ) : (
              <View className="mt-2 rounded-xl bg-[#243447] p-3">
                {reviewSessions.slice(0, 4).map((session) => (
                  <View
                    key={session.id}
                    className="mb-2 rounded-lg border border-white/5 bg-[#1A2332] p-2.5">
                    <View className="flex-row items-start justify-between">
                      <View className="mr-2 flex-1">
                        <Text className="text-xs font-semibold text-white">
                          {session.title || MILESTONE_LABELS[session.milestone_code] || session.milestone_code}
                        </Text>
                        <Text className="mt-0.5 text-[11px] text-gray-400">
                          {formatDate(session.review_date)} · {session.status}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-gray-500">{session.review_day}</Text>
                    </View>

                    {!!session.lecturer_note && (
                      <Text className="mt-1 text-xs text-gray-300" numberOfLines={3}>
                        {session.lecturer_note}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* No data fallback */}
        {warnings.length === 0 &&
          complianceClasses.length === 0 &&
          !milestone &&
          !activePublishedScore &&
          reviewSessions.length === 0 && (
          <View className="mt-16 items-center justify-center gap-3">
            <Feather name="check-circle" size={44} color="#334155" />
            <Text className="text-center text-sm text-gray-500">Everything looks good.</Text>
            <Text className="text-center text-xs text-gray-600">
              No warnings or active review milestone this week.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Review Group Card ──────────────────────────────────────────────────────────

const ReviewGroupCard = ({ group }: { group: ReviewGroup }) => {
  const isReviewed = group.review_status === 'REVIEWED';
  const statusColor = isReviewed ? '#22C55E' : '#64748B';

  return (
    <View className="mb-3 rounded-2xl bg-[#1A2332] p-4">
      {/* Group header */}
      <View className="mb-3 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-bold text-white" numberOfLines={1}>
            {group.group_name}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500" numberOfLines={1}>
            {group.class_code} · {group.topic_name || 'No topic'}
          </Text>
        </View>
        <View className="rounded-lg px-2.5 py-1" style={{ backgroundColor: `${statusColor}20` }}>
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>
            {isReviewed ? 'Reviewed' : 'Pending'}
          </Text>
        </View>
      </View>

      {isReviewed ? (
        <>
          {/* Snapshot */}
          <View className="flex-row gap-4 rounded-xl bg-[#243447] p-3">
            <View className="flex-1 items-center">
              <Text className="text-base font-bold text-white">
                {group.snapshot.task_done}/{group.snapshot.task_total}
              </Text>
              <Text className="mt-0.5 text-[10px] text-gray-500">Tasks Done</Text>
            </View>
            {group.snapshot.commit_total !== null && (
              <View className="flex-1 items-center">
                <Text className="text-base font-bold text-white">
                  {group.snapshot.commit_total}
                </Text>
                <Text className="mt-0.5 text-[10px] text-gray-500">Commits</Text>
              </View>
            )}
            {group.snapshot.commit_contributors !== null && (
              <View className="flex-1 items-center">
                <Text className="text-base font-bold text-white">
                  {group.snapshot.commit_contributors}
                </Text>
                <Text className="mt-0.5 text-[10px] text-gray-500">Contributors</Text>
              </View>
            )}
          </View>

          {/* Lecturer note */}
          {!!group.lecturer_note && (
            <View className="mt-3 rounded-xl bg-[#243447] p-3">
              <Text className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">
                Lecturer Note
              </Text>
              <Text className="text-xs leading-4 text-gray-300">{group.lecturer_note}</Text>
            </View>
          )}
        </>
      ) : (
        /* Pending state */
        <View className="flex-row items-center gap-2 rounded-xl bg-[#243447] p-3">
          <Feather name="clock" size={14} color="#64748B" />
          <Text className="text-xs text-gray-500">Waiting for lecturer review this milestone.</Text>
        </View>
      )}

      {/* Warnings */}
      {group.warnings.filter((w) => w !== 'REVIEW_NOT_CAPTURED').length > 0 && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {group.warnings
            .filter((w) => w !== 'REVIEW_NOT_CAPTURED')
            .map((w) => (
              <View key={w} className="rounded-md bg-[#7C2D12]/30 px-2 py-0.5">
                <Text className="text-[10px] text-orange-300">
                  {w === 'NO_TASK_EVIDENCE' ? 'No task evidence' : 'No commit evidence'}
                </Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
};

const ScoreBadge = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string | null | undefined;
  highlight?: boolean;
}) => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;

  const displayValue =
    numericValue !== null && Number.isFinite(numericValue) ? numericValue.toFixed(1) : '–';

  return (
    <View
      className={`flex-1 items-center rounded-xl border py-2.5 ${highlight ? 'border-[#7C3AED]/30 bg-[#7C3AED]/20' : 'border-white/5 bg-[#243447]'}`}>
      <Text className={`text-sm font-bold ${highlight ? 'text-[#7C3AED]' : 'text-white'}`}>
        {displayValue}
      </Text>
      <Text className="mt-0.5 text-[10px] font-semibold text-gray-500">{label}</Text>
    </View>
  );
};

export default SemesterStatusScreen;
