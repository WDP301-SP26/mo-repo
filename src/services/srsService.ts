import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

// ── Types ──────────────────────────────────────────────────────────────────────

export type SRSStatus = 'DRAFT' | 'SUBMITTED' | 'GRADED';

export interface SRSVersion {
  id: string;
  document_id: string;
  version_number: number;
  content: string;
  created_by_id: string;
  created_by_name?: string;
  created_at: string;
  change_summary: string | null;
}

export interface SRSDocument {
  id: string;
  group_id: string;
  title: string;
  created_by_id: string;
  submitted_version_id: string | null;
  submitted_version?: SRSVersion | null;
  status: SRSStatus;
  score: number | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSRSDocumentPayload {
  title: string;
}

export interface CreateSRSVersionPayload {
  content: string;
  change_summary?: string;
}

export interface GradeSRSPayload {
  score: number;
  feedback?: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const getSRSByGroup = async (groupId: string): Promise<SRSDocument | null> => {
  try {
    const res = await axiosClient.get<SRSDocument>(ENDPOINTS.SRS.BY_GROUP(groupId));
    return res.data;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

export const createSRSDocument = async (
  groupId: string,
  payload: CreateSRSDocumentPayload
): Promise<SRSDocument> => {
  const res = await axiosClient.post<SRSDocument>(ENDPOINTS.SRS.CREATE(groupId), payload);
  return res.data;
};

export const getSRSVersions = async (documentId: string): Promise<SRSVersion[]> => {
  const res = await axiosClient.get<SRSVersion[]>(ENDPOINTS.SRS.VERSIONS(documentId));
  return res.data;
};

export const getSRSVersionDetail = async (
  documentId: string,
  versionId: string
): Promise<SRSVersion> => {
  const res = await axiosClient.get<SRSVersion>(
    ENDPOINTS.SRS.VERSION_DETAIL(documentId, versionId)
  );
  return res.data;
};

export const saveNewSRSVersion = async (
  documentId: string,
  payload: CreateSRSVersionPayload
): Promise<SRSVersion> => {
  const res = await axiosClient.post<SRSVersion>(ENDPOINTS.SRS.VERSIONS(documentId), payload);
  return res.data;
};

export const submitSRSDocument = async (
  documentId: string,
  versionId: string
): Promise<SRSDocument> => {
  const res = await axiosClient.post<SRSDocument>(ENDPOINTS.SRS.SUBMIT(documentId), {
    version_id: versionId,
  });
  return res.data;
};

export const gradeSRSDocument = async (
  documentId: string,
  payload: GradeSRSPayload
): Promise<SRSDocument> => {
  const res = await axiosClient.patch<SRSDocument>(ENDPOINTS.SRS.GRADE(documentId), payload);
  return res.data;
};
