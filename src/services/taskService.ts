import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export type TaskStatus = 'TO_DO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TaskItem {
  id: string;
  key?: string;
  jira_issue_key?: string;
  group_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  assignee_name?: string;
  jira_sync_status?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  jira_sync_reason?: string;
  due_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface PaginatedTasksResponse {
  data: TaskItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

type BeTaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
type BeTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface BeTaskItem {
  id: string;
  key?: string | null;
  jira_issue_key?: string | null;
  group_id: string;
  title: string;
  description?: string | null;
  status: BeTaskStatus;
  priority: BeTaskPriority;
  assignee_id?: string | null;
  assignee_name?: string | null;
  jira_sync_status?: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  jira_sync_reason?: string | null;
  due_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BePaginatedTasksResponse {
  data: BeTaskItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface CreateTaskPayload {
  group_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_at?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_at?: string;
}

export interface GetTasksQuery {
  group_id: string;
  status?: TaskStatus;
  assignee_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const mapStatusFromBe = (status: BeTaskStatus): TaskStatus => {
  if (status === 'TODO') return 'TO_DO';
  if (status === 'DONE') return 'DONE';
  return 'IN_PROGRESS';
};

const mapStatusToBe = (status?: TaskStatus): BeTaskStatus | undefined => {
  if (!status) return undefined;
  if (status === 'TO_DO') return 'TODO';
  return status as BeTaskStatus;
};

const mapPriorityFromBe = (priority: BeTaskPriority): TaskPriority => {
  if (priority === 'URGENT') return 'CRITICAL';
  return priority;
};

const mapPriorityToBe = (priority?: TaskPriority): BeTaskPriority | undefined => {
  if (!priority) return undefined;
  if (priority === 'CRITICAL') return 'URGENT';
  return priority;
};

const normalizeDueAtForRequest = (dueAt?: string): string | undefined => {
  if (!dueAt) return undefined;
  const trimmed = dueAt.trim();
  if (!trimmed) return undefined;

  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (dateOnlyMatch) {
    return `${trimmed}T00:00:00.000Z`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString();
};

const mapTaskFromBe = (task: BeTaskItem): TaskItem => ({
  id: task.id,
  key: task.key || undefined,
  jira_issue_key: task.jira_issue_key || undefined,
  group_id: task.group_id,
  title: task.title,
  description: task.description || undefined,
  status: mapStatusFromBe(task.status),
  priority: mapPriorityFromBe(task.priority),
  assignee_id: task.assignee_id || undefined,
  assignee_name: task.assignee_name || undefined,
  jira_sync_status: task.jira_sync_status || undefined,
  jira_sync_reason: task.jira_sync_reason || undefined,
  due_at: task.due_at || undefined,
  created_at: task.created_at,
  updated_at: task.updated_at,
});

const mapCreatePayloadToBe = (payload: CreateTaskPayload) => ({
  ...payload,
  status: mapStatusToBe(payload.status),
  priority: mapPriorityToBe(payload.priority),
  due_at: normalizeDueAtForRequest(payload.due_at),
});

const mapUpdatePayloadToBe = (payload: UpdateTaskPayload) => ({
  ...payload,
  status: mapStatusToBe(payload.status),
  priority: mapPriorityToBe(payload.priority),
  due_at: normalizeDueAtForRequest(payload.due_at),
});

/**
 * List tasks by group and optional filters.
 * GET /api/tasks
 */
export const getTasks = async (query: GetTasksQuery): Promise<TaskItem[]> => {
  const response = await axiosClient.get<BeTaskItem[] | BePaginatedTasksResponse>(
    ENDPOINTS.TASKS.LIST,
    {
      params: {
        ...query,
        status: mapStatusToBe(query.status),
      },
      expectedErrorStatuses: [404],
    } as any
  );

  const payload = response.data;
  if (Array.isArray(payload)) {
    return payload.map(mapTaskFromBe);
  }

  return (payload?.data || []).map(mapTaskFromBe);
};

/**
 * List tasks with backend pagination metadata.
 * GET /api/tasks
 */
export const getTasksPaginated = async (query: GetTasksQuery): Promise<PaginatedTasksResponse> => {
  const response = await axiosClient.get<BePaginatedTasksResponse>(ENDPOINTS.TASKS.LIST, {
    params: {
      ...query,
      status: mapStatusToBe(query.status),
    },
    expectedErrorStatuses: [404],
  } as any);

  return {
    data: (response.data?.data || []).map(mapTaskFromBe),
    meta: response.data?.meta || {
      total: 0,
      page: query.page || 1,
      limit: query.limit || 20,
      total_pages: 0,
    },
  };
};

/**
 * Create a task.
 * POST /api/tasks
 */
export const createTask = async (payload: CreateTaskPayload): Promise<TaskItem> => {
  const response = await axiosClient.post<BeTaskItem>(
    ENDPOINTS.TASKS.CREATE,
    mapCreatePayloadToBe(payload),
    {
      expectedErrorStatuses: [400, 401, 403, 404],
    } as any
  );

  return mapTaskFromBe(response.data);
};

/**
 * Update a task.
 * PATCH /api/tasks/:id
 */
export const updateTask = async (taskId: string, payload: UpdateTaskPayload): Promise<TaskItem> => {
  const response = await axiosClient.patch<BeTaskItem>(
    ENDPOINTS.TASKS.UPDATE(taskId),
    mapUpdatePayloadToBe(payload),
    {
      expectedErrorStatuses: [400, 401, 403, 404],
    } as any
  );

  return mapTaskFromBe(response.data);
};

/**
 * Delete a task.
 * DELETE /api/tasks/:id
 */
export const deleteTask = async (taskId: string): Promise<void> => {
  await axiosClient.delete(ENDPOINTS.TASKS.DELETE(taskId), {
    expectedErrorStatuses: [404],
  } as any);
};
