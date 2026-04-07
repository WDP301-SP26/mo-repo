import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  semester_id: string;
  class_id?: string | null;
  title: string;
  description: string;
  week_start: number;
  week_end: number;
  created_by_id: string;
  created_at: string;
}

export interface CreateCheckpointPayload {
  semester_id: string;
  class_id?: string;
  title: string;
  description: string;
  week_start: number;
  week_end: number;
}

export interface UpdateCheckpointPayload {
  title?: string;
  description?: string;
  week_start?: number;
  week_end?: number;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const getCheckpoints = async (semesterId?: string): Promise<Checkpoint[]> => {
  const params = semesterId ? { semesterId } : undefined;
  const res = await axiosClient.get<Checkpoint[]>(ENDPOINTS.CHECKPOINTS.LIST, { params });
  return res.data;
};

export const createCheckpoint = async (payload: CreateCheckpointPayload): Promise<Checkpoint> => {
  const res = await axiosClient.post<Checkpoint>(ENDPOINTS.CHECKPOINTS.CREATE, payload);
  return res.data;
};

export const updateCheckpoint = async (
  id: string,
  payload: UpdateCheckpointPayload
): Promise<Checkpoint> => {
  const res = await axiosClient.patch<Checkpoint>(ENDPOINTS.CHECKPOINTS.UPDATE(id), payload);
  return res.data;
};

export const deleteCheckpoint = async (id: string): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.CHECKPOINTS.DELETE(id));
};
