import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WeeklyGrade {
  id: string;
  group_id: string;
  semester_id: string;
  week_number: number;
  graded_by_id: string;
  graded_by_name?: string;
  task_score: number;
  commit_score: number;
  attitude_score: number;
  note: string | null;
  graded_at: string;
}

export interface CreateWeeklyGradePayload {
  group_id: string;
  semester_id: string;
  week_number: number;
  task_score: number;
  commit_score: number;
  attitude_score: number;
  note?: string;
}

export interface UpdateWeeklyGradePayload {
  task_score?: number;
  commit_score?: number;
  attitude_score?: number;
  note?: string;
}

export interface PresentationApproval {
  id: string;
  group_id: string;
  semester_id: string;
  total_score: number;
  is_approved: boolean;
  approved_by_id: string;
  reason: string | null;
  approved_at: string;
}

export interface FinalScoreSummary {
  avg_task: number;
  avg_commit: number;
  avg_attitude: number;
  total: number;
  can_approve: boolean;
  weeks_graded: number;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const getWeeklyGrades = async (groupId: string): Promise<WeeklyGrade[]> => {
  const res = await axiosClient.get<WeeklyGrade[]>(ENDPOINTS.WEEKLY_GRADES.LIST(groupId));
  return res.data;
};

export const createWeeklyGrade = async (
  payload: CreateWeeklyGradePayload
): Promise<WeeklyGrade> => {
  const res = await axiosClient.post<WeeklyGrade>(ENDPOINTS.WEEKLY_GRADES.CREATE, payload);
  return res.data;
};

export const updateWeeklyGrade = async (
  id: string,
  payload: UpdateWeeklyGradePayload
): Promise<WeeklyGrade> => {
  const res = await axiosClient.patch<WeeklyGrade>(ENDPOINTS.WEEKLY_GRADES.UPDATE(id), payload);
  return res.data;
};

export const approvePresentationGroup = async (
  groupId: string,
  payload: { approved: boolean; reason?: string }
): Promise<PresentationApproval> => {
  const res = await axiosClient.post<PresentationApproval>(
    ENDPOINTS.WEEKLY_GRADES.APPROVE_PRESENTATION(groupId),
    payload
  );
  return res.data;
};
