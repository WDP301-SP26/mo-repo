import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse } from '../../services/authService';
interface UserState {
  userInfo: AuthResponse['user'] | null;
  isAuthenticated: boolean;

  // Actions
  login: (data: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userInfo: null,
      isAuthenticated: false,

      // --- LOGIC LƯU TRỮ Ở ĐÂY ---
      login: async (data: AuthResponse) => {
        await AsyncStorage.setItem('access_token', data.access_token);
        set({
          userInfo: data.user,
          isAuthenticated: true,
        });
      },

      logout: async () => {
        await AsyncStorage.removeItem('access_token');
        set({ userInfo: null, isAuthenticated: false });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        userInfo: state.userInfo,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
