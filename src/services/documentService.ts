import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export type DocumentStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'GRADED';

export interface DocumentSubmissionVersionRef {
  id: string;
  version_number: number;
  title: string;
}

export interface DocumentSubmission {
  id: string;
  group_id: string;
  base_submission_id?: string | null;
  version_number?: number;
  submitted_by_id: string;
  submitted_by_name?: string | null;
  title: string;
  document_url: string | null;
  reference?: string | null;
  change_summary?: string | null;
  content_markdown?: string | null;
  status: DocumentStatus;
  score?: number | null;
  feedback?: string | null;
  created_at: string;
  updated_at?: string;
  base_submission?: DocumentSubmissionVersionRef | null;
}

export interface SubmitDocumentPayload {
  title: string;
  document_url?: string;
  reference?: string;
  change_summary?: string;
  content_markdown?: string;
  base_submission_id?: string;
}

export interface UpdateDocumentVersionPayload {
  title?: string;
  document_url?: string;
  reference?: string;
  change_summary?: string;
  content_markdown?: string;
}

export const buildSrsTemplateMarkdown = (title: string) => {
  return `# ${title}\n\n## 1. Introduction\n- Purpose\n- Scope\n- Definitions\n\n## 2. Overall Description\n- Product perspective\n- User classes\n- Constraints\n\n## 3. Functional Requirements\n- FR-01:\n- FR-02:\n\n## 4. Non-Functional Requirements\n- Performance\n- Security\n- Availability\n\n## 5. Use Cases\n- UC-01:\n- UC-02:\n\n## 6. Data Model\n- Entities\n- Relationships\n\n## 7. UI/UX Notes\n- Key screens\n- Navigation flow\n\n## 8. Risks & Assumptions\n- Risks\n- Assumptions\n`;
};

const toDocumentSubmission = (raw: any): DocumentSubmission => {
  return {
    id: String(raw?.id || ''),
    group_id: String(raw?.group_id || ''),
    base_submission_id: raw?.base_submission_id ?? null,
    version_number:
      typeof raw?.version_number === 'number' ? raw.version_number : undefined,
    submitted_by_id: String(raw?.submitted_by_id || ''),
    submitted_by_name:
      raw?.submittedBy?.full_name ?? raw?.submittedBy?.email ?? null,
    title: String(raw?.title || ''),
    document_url: raw?.document_url ?? null,
    reference: raw?.reference ?? null,
    change_summary: raw?.change_summary ?? null,
    content_markdown: raw?.content_markdown ?? null,
    status: raw?.status || 'PENDING',
    score: typeof raw?.score === 'number' ? raw.score : null,
    feedback: raw?.feedback ?? null,
    created_at: String(raw?.created_at || ''),
    updated_at: raw?.updated_at,
    base_submission: raw?.baseSubmission
      ? {
          id: String(raw.baseSubmission.id),
          version_number: Number(raw.baseSubmission.version_number || 0),
          title: String(raw.baseSubmission.title || ''),
        }
      : null,
  };
};

/**
 * Get all submissions of a group.
 * GET /api/documents/group/:groupId
 */
export const getGroupSubmissions = async (groupId: string): Promise<DocumentSubmission[]> => {
  const response = await axiosClient.get<any[]>(
    ENDPOINTS.DOCUMENTS.GROUP_VERSIONS(groupId)
  );
  return Array.isArray(response.data) ? response.data.map(toDocumentSubmission) : [];
};

/**
 * Submit a new group document.
 * POST /api/documents/group/:groupId
 */
export const submitGroupDocument = async (
  groupId: string,
  payload: SubmitDocumentPayload
): Promise<DocumentSubmission> => {
  const response = await axiosClient.post<any>(
    ENDPOINTS.DOCUMENTS.SUBMIT_FOR_GROUP(groupId),
    payload
  );
  return toDocumentSubmission(response.data);
};

export const saveGroupDraftVersion = async (
  groupId: string,
  payload: SubmitDocumentPayload
): Promise<DocumentSubmission> => {
  const response = await axiosClient.post<any>(
    ENDPOINTS.DOCUMENTS.SAVE_DRAFT_FOR_GROUP(groupId),
    payload
  );
  return toDocumentSubmission(response.data);
};

export const updateDocumentVersion = async (
  submissionId: string,
  payload: UpdateDocumentVersionPayload
): Promise<DocumentSubmission> => {
  const response = await axiosClient.patch<any>(
    ENDPOINTS.DOCUMENTS.UPDATE_VERSION(submissionId),
    payload
  );
  return toDocumentSubmission(response.data);
};

export const submitDocumentVersion = async (submissionId: string): Promise<DocumentSubmission> => {
  const response = await axiosClient.patch<any>(ENDPOINTS.DOCUMENTS.SUBMIT_VERSION(submissionId));
  return toDocumentSubmission(response.data);
};
