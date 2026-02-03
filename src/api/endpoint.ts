const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    PROFILE: '/auth/me',
    UPDATE: '/auth/update',
    LINK_GITHUB: '/auth/github',
    LINK_JIRA: '/auth/jira',
    LINKED_ACCOUNTS: '/auth/linked-accounts',
    UNLINK: (provider: string) => `/auth/unlink/${provider}`,
  },

  PROJECT: {
    LIST: '/projects',
    CREATE: '/projects',
    DETAILS: (id: string | number) => `/projects/${id}`,
    ADD_MEMBER: (id: string | number) => `/projects/${id}/members`,
  },

  INTEGRATION: {
    TEST_JIRA: '/integration/jira/test',
    TEST_GITHUB: '/integration/github/test',
  },
} as const;

export default ENDPOINTS;
