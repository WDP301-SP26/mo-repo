import axiosClient from '../api/axiosConfig';
import ENDPOINTS from '../api/endpoint';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  studentId: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    student_id: string;
    role?: string;
    created_at?: string;
  };
}

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, payload);
  return response.data;
};

export const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>(ENDPOINTS.AUTH.REGISTER, payload);
  return response.data;
};

export const getProfile = async (): Promise<AuthResponse['user']> => {
  const response = await axiosClient.get<AuthResponse['user']>(ENDPOINTS.AUTH.PROFILE);
  return response.data;
};

export const updateProfile = async (
  data: Partial<AuthResponse['user']>
): Promise<AuthResponse['user']> => {
  const response = await axiosClient.put<AuthResponse['user']>(ENDPOINTS.AUTH.UPDATE, data);
  return response.data;
};

export const linkAccount = async (payload: { provider: string; token: string }): Promise<void> => {
  await axiosClient.post(ENDPOINTS.AUTH.LINKED_ACCOUNTS, payload);
};

// === Linked Accounts ===
export interface LinkedAccount {
  provider: 'github' | 'jira';
  linked: boolean;
  username?: string;
  email?: string;
}

export interface LinkedAccountsResponse {
  github: boolean;
  jira: boolean;
  accounts?: LinkedAccount[];
}

export const getLinkedAccounts = async (): Promise<LinkedAccountsResponse> => {
  const response = await axiosClient.get<LinkedAccountsResponse>(ENDPOINTS.AUTH.LINKED_ACCOUNTS);
  return response.data;
};

/**
 * Get GitHub OAuth URL from backend
 * This is the endpoint that initiates the OAuth flow
 */
/**
 * Get GitHub OAuth URL from backend
 * This is the endpoint that initiates the OAuth flow
 * @param token Optional access token for linking accounts
 */
export const getGitHubAuthUrl = (token?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}${ENDPOINTS.AUTH.LINK_GITHUB}`;
  return token ? `${baseUrl}?token=${token}` : baseUrl;
};

/**
 * Get Jira OAuth URL from backend
 * This is the endpoint that initiates the OAuth flow
 * @param token Optional access token for linking accounts
 */
export const getJiraAuthUrl = (token?: string): string => {
  const baseUrl = `${axiosClient.defaults.baseURL}${ENDPOINTS.AUTH.LINK_JIRA}`;
  return token ? `${baseUrl}?token=${token}` : baseUrl;
};
