import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SerializedSemester {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'UPCOMING' | 'CLOSED';
  current_week: number;
  start_date: string;
  end_date: string;
}

export interface CurrentWeekResponse {
  semester: SerializedSemester | null;
  can_override_week: boolean;
}

// Compliance / warnings

export interface StudentWarning {
  code: 'WEEK1_NO_GROUP' | 'WEEK2_TOPIC_NOT_FINALIZED';
  severity: 'warning';
  class_id: string;
  class_code: string;
  class_name: string;
  group_id?: string;
  group_name?: string;
  message: string;
}

export interface ComplianceGroupSummary {
  group_id: string;
  group_name: string;
  topic_name: string | null;
  has_finalized_topic: boolean;
  week2_status: 'PASS' | 'FAIL';
}

export interface ComplianceClassSummary {
  class_id: string;
  class_code: string;
  class_name: string;
  has_group: boolean;
  week1_status: 'PASS' | 'FAIL';
  groups: ComplianceGroupSummary[];
}

export interface StudentWarningResponse {
  semester: SerializedSemester | null;
  warnings: StudentWarning[];
  classes: ComplianceClassSummary[];
}

// Review status

export interface ReviewMilestoneContext {
  code: 'REVIEW_1' | 'PROGRESS_TRACKING' | 'REVIEW_2' | 'REVIEW_3';
  label: string;
  week_start: number;
  week_end: number;
}

export interface ReviewScores {
  task_progress_score: number | null;
  commit_contribution_score: number | null;
  review_milestone_score: number | null;
  total_score: number | null;
  auto_score?: number | null;
  final_score?: number | null;
  override_reason?: string | null;
}

export interface ReviewSnapshot {
  task_total: number;
  task_done: number;
  commit_total: number | null;
  commit_contributors: number | null;
  repository: string | null;
  captured_at: string | null;
}

export interface ReviewGroup {
  class_id: string;
  class_code: string;
  class_name: string;
  group_id: string;
  group_name: string;
  topic_name: string | null;
  review_status: 'PENDING' | 'REVIEWED';
  scores: ReviewScores;
  snapshot: ReviewSnapshot;
  warnings: string[];
  lecturer_note: string | null;
  milestone: ReviewMilestoneContext | null;
  review_sessions?: ReviewSessionTimelineItem[];
  review_session_summary?: ReviewSessionSummary | null;
}

export interface StudentReviewStatusResponse {
  semester: SerializedSemester | null;
  milestone: ReviewMilestoneContext | null;
  groups: ReviewGroup[];
}

export interface ReviewSessionParticipantSummary {
  id: string;
  title: string;
  status: string;
  note: string | null;
}

export interface ReviewSessionAttendanceSummary {
  user_id: string;
  user_name: string | null;
  present: boolean;
}

export interface ReviewSessionTimelineItem {
  id: string;
  title: string;
  review_date: string;
  review_day: string;
  milestone_code: string;
  status: string;
  lecturer_note: string | null;
  what_done_since_last_review: string | null;
  next_plan_until_next_review: string | null;
  previous_problem_followup: string | null;
  attendance_ratio: number | null;
  attendance_records: ReviewSessionAttendanceSummary[];
  previous_session_id: string | null;
  current_problems: ReviewSessionParticipantSummary[];
  version_count?: number;
  latest_action?: string | null;
}

export interface ReviewSessionSummary {
  total_sessions: number;
  present_count: number;
  absent_count: number;
  contributor_count: number;
  latest_review_date: string | null;
  latest_note: string | null;
}

export interface GroupReviewSessionsResponse {
  semester: SerializedSemester | null;
  group: {
    group_id: string;
    group_name: string;
    class_id: string;
    class_code: string;
  } | null;
  sessions: ReviewSessionTimelineItem[];
}

export interface ReviewSessionHistoryEntry {
  id: string;
  review_session_id: string | null;
  action: string;
  version_number: number;
  actor_user_id: string | null;
  created_at: string;
  milestone_code: string;
  snapshot: Record<string, unknown>;
}

export interface GroupReviewSessionHistoryResponse {
  semester: SerializedSemester | null;
  history: ReviewSessionHistoryEntry[];
}

export interface StudentPublishedScoreMilestone {
  milestone: {
    code: string;
    label: string;
    week_start: number;
    week_end: number;
    description?: string | null;
  };
  groups: {
    group_id: string;
    group_name: string;
    topic_name: string | null;
    scores: ReviewScores;
    lecturer_note: string | null;
  }[];
}

export interface StudentCheckpointScores {
  checkpoint_1: number | null;
  checkpoint_2: number | null;
  checkpoint_3: number | null;
}

export interface StudentPublishedScoreGroup {
  group_id: string;
  group_name: string;
  topic_name: string | null;
  checkpoints: StudentCheckpointScores;
  total_score: number | null;
}

export interface StudentPublishedScoresResponse {
  semester: SerializedSemester | null;
  groups: StudentPublishedScoreGroup[];
  milestones?: StudentPublishedScoreMilestone[];
}

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeCheckpointGroup = (rawGroup: any): StudentPublishedScoreGroup => {
  const checkpoints = rawGroup?.checkpoints || {};

  return {
    group_id: String(rawGroup?.group_id || ''),
    group_name: String(rawGroup?.group_name || 'Unknown group'),
    topic_name: rawGroup?.topic_name ? String(rawGroup.topic_name) : null,
    checkpoints: {
      checkpoint_1: toNullableNumber(checkpoints?.checkpoint_1),
      checkpoint_2: toNullableNumber(checkpoints?.checkpoint_2),
      checkpoint_3: toNullableNumber(checkpoints?.checkpoint_3),
    },
    total_score: toNullableNumber(rawGroup?.total_score),
  };
};

const normalizeStudentScoresPayload = (raw: any): StudentPublishedScoresResponse => {
  const semester = raw?.semester ?? null;

  if (Array.isArray(raw?.groups)) {
    return {
      semester,
      groups: raw.groups.map(normalizeCheckpointGroup),
      milestones: Array.isArray(raw?.milestones) ? raw.milestones : undefined,
    };
  }

  // Backward compatibility: derive checkpoint-centric groups from milestone payload.
  if (!Array.isArray(raw?.milestones)) {
    return { semester, groups: [] };
  }

  const groupMap = new Map<string, StudentPublishedScoreGroup>();

  raw.milestones.forEach((entry: StudentPublishedScoreMilestone) => {
    const code = entry?.milestone?.code;
    entry?.groups?.forEach((group) => {
      const existing =
        groupMap.get(group.group_id) ||
        {
          group_id: group.group_id,
          group_name: group.group_name,
          topic_name: group.topic_name,
          checkpoints: {
            checkpoint_1: null,
            checkpoint_2: null,
            checkpoint_3: null,
          },
          total_score: null,
        };

      if (code === 'REVIEW_1') {
        existing.checkpoints.checkpoint_1 = toNullableNumber(group.scores?.total_score);
      } else if (code === 'REVIEW_2') {
        existing.checkpoints.checkpoint_2 = toNullableNumber(group.scores?.total_score);
      } else if (code === 'REVIEW_3') {
        existing.checkpoints.checkpoint_3 = toNullableNumber(group.scores?.total_score);
      } else if (code === 'FINAL_SCORE') {
        existing.total_score = toNullableNumber(group.scores?.total_score);
      }

      if (existing.total_score === null) {
        existing.total_score = toNullableNumber(group.scores?.total_score);
      }

      groupMap.set(group.group_id, existing);
    });
  });

  return {
    semester,
    groups: Array.from(groupMap.values()),
    milestones: raw.milestones,
  };
};

// ── API calls ──────────────────────────────────────────────────────────────────

export const getCurrentSemester = async (): Promise<SerializedSemester> => {
  const res = await axiosClient.get<SerializedSemester>(ENDPOINTS.SEMESTERS.CURRENT);
  return res.data;
};

export const getCurrentWeek = async (): Promise<CurrentWeekResponse> => {
  const res = await axiosClient.get<CurrentWeekResponse>(ENDPOINTS.SEMESTERS.CURRENT_WEEK);
  return res.data;
};

export const getStudentWarnings = async (): Promise<StudentWarningResponse> => {
  const res = await axiosClient.get<StudentWarningResponse>(ENDPOINTS.SEMESTERS.STUDENT_WARNINGS);
  return res.data;
};

export const getStudentReviewStatus = async (): Promise<StudentReviewStatusResponse> => {
  const res = await axiosClient.get<StudentReviewStatusResponse>(
    ENDPOINTS.SEMESTERS.STUDENT_REVIEW_STATUS
  );
  return res.data;
};

export const getStudentPublishedScores = async (): Promise<StudentPublishedScoresResponse> => {
  const res = await axiosClient.get<any>(ENDPOINTS.SEMESTERS.STUDENT_REVIEW_SCORES);
  return normalizeStudentScoresPayload(res.data);
};

export const getGroupReviewSessions = async (
  groupId: string
): Promise<GroupReviewSessionsResponse> => {
  const res = await axiosClient.get<GroupReviewSessionsResponse>(
    ENDPOINTS.SEMESTERS.GROUP_REVIEW_SESSIONS(groupId)
  );
  return res.data;
};

export const getGroupReviewSessionHistory = async (
  groupId: string,
  milestoneCode?: string
): Promise<GroupReviewSessionHistoryResponse> => {
  const res = await axiosClient.get<GroupReviewSessionHistoryResponse>(
    ENDPOINTS.SEMESTERS.GROUP_REVIEW_SESSION_HISTORY(groupId),
    {
      params: milestoneCode ? { milestone_code: milestoneCode } : undefined,
    }
  );
  return res.data;
};
