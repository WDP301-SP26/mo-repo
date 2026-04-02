const FRIENDLY_TASK_ERROR_MAP: Record<string, string> = {
  JIRA_MEMBERSHIP_REQUIRED:
    'You must be part of the linked Jira project team before claiming or updating this task.',
  JIRA_ASSIGN_FAILED:
    'Jira rejected the assignee update. The task was not changed.',
  JIRA_TRANSITION_FAILED:
    'Jira rejected the status update. The task was not changed.',
  JIRA_ACCOUNT_NOT_LINKED:
    'Your Jira account is not linked or needs to be reconnected before this action can continue.',
};

export const mapTaskActionErrorToMessage = (
  input: unknown,
  fallback: string
): string => {
  if (!input) return fallback;

  const maybeObj = input as {
    code?: string;
    message?: string;
    response?: {
      status?: number;
      data?: {
        code?: string;
        message?: string;
        reconnectRequired?: boolean;
      };
    };
  };

  const code = maybeObj.response?.data?.code || maybeObj.code;
  if (code && FRIENDLY_TASK_ERROR_MAP[code]) {
    return FRIENDLY_TASK_ERROR_MAP[code];
  }

  if (typeof maybeObj.response?.data?.message === 'string') {
    return maybeObj.response.data.message;
  }

  if (typeof maybeObj.message === 'string') {
    return maybeObj.message;
  }

  return fallback;
};

export const getTaskActionErrorCode = (input: unknown): string | undefined => {
  const maybeObj = input as {
    code?: string;
    response?: { data?: { code?: string } };
  };

  return maybeObj?.response?.data?.code || maybeObj?.code;
};
