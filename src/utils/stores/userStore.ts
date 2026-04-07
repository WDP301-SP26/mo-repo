import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, UserProfile } from '../../services/authService';
import { clearAccessToken, saveAccessToken } from '@/utils/auth/session';

// ==================== Types ====================

interface UserState {
  /** Current user info (null = not logged in) */
  userInfo: UserProfile | null;

  /** True if user has an active session */
  isAuthenticated: boolean;

  /** Save user data after login/OAuth */
  login: (data: AuthResponse) => Promise<void>;

  /** Clear all session data */
  logout: () => Promise<void>;
}

// ==================== Store ====================

/**
 * Zustand store for user authentication state.
 * Persisted to AsyncStorage so user stays logged in between app restarts.
 * JWT token is stored separately in AsyncStorage under 'access_token'.
 */
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userInfo: null,
      isAuthenticated: false,

      login: async (data: AuthResponse) => {
        // Save JWT token for axios interceptor
        await saveAccessToken(data.access_token);
        set({
          userInfo: data.user,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        await clearAccessToken();
        set({ userInfo: null, isAuthenticated: false });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist these fields (not functions)
      partialize: (state) => ({
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
