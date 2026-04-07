import axios from 'axios';
import { API_URL } from '@env';
import { clearAccessToken, getAccessToken } from '@/utils/auth/session';

// ==================== Create Axios Instance ====================

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ==================== Request Interceptor ====================

/**
 * Automatically attaches the JWT token from AsyncStorage
 * to every outgoing request as a Bearer token.
 */
axiosClient.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ==================== Response Interceptor ====================

/**
 * Handles API errors:
 * - On 401 (Unauthorized): clears the stored token → forces re-login
 */
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      // Token expired or invalid → auto logout
      if (error.response.status === 401) {
        const provider = error.response?.data?.provider;
        const isIntegration401 = provider === 'JIRA' || provider === 'GITHUB';

        if (!isIntegration401) {
          await clearAccessToken();
          // The app will redirect to SignIn on next navigation or re-render
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
