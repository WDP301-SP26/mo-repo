import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LinkThirdPartyScreen from '../screens/auth/LinkThirdPartyScreen';
import LinkedAccountsScreen from '../screens/main/LinkedAccountsScreen';
import MainTabNavigator from './MainTabNavigator';
import GroupDetailScreen from '../screens/main/GroupDetailScreen';
import ClassDetailScreen from '../screens/main/ClassDetailScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import EvaluationScreen from '../screens/main/EvaluationScreen';
import DocumentSubmissionsScreen from '../screens/main/DocumentSubmissionsScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import TopicLabScreen from '../screens/main/TopicLabScreen';
import SemesterStatusScreen from '../screens/main/SemesterStatusScreen';
import ChatDetailScreen from '../screens/main/ChatDetailScreen';
import CheckpointManageScreen from '../screens/main/CheckpointManageScreen';
import WeeklyGradeScreen from '../screens/main/WeeklyGradeScreen';
import SRSEditorScreen from '../screens/main/SRSEditorScreen';
import { getProfile } from '../services/authService';
import { getAccessToken } from '@/utils/auth/session';
import { useUserStore } from '../utils/stores/userStore';

// ==================== Route Types ====================

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  LinkThirdParty: undefined;
  LinkedAccounts: undefined;
  ClassDetail: { classId: string; lecturerId?: string };
  GroupDetail: { groupId: string };
  CreateGroup: undefined;
  EditGroup: { groupId: string };
  AddMember: { groupId: string };
  Evaluation: { groupId: string };
  Documents: { groupId: string };
  Reports: { groupId: string };
  TopicLab: { groupId: string };
  SemesterStatus: { groupId: string };
  ChatDetail: { conversationId: string; title?: string };
  // Task 3 — Checkpoint management (Lecturer)
  CheckpointManage: { semesterId: string; classId: string };
  // Task 2 — Weekly grading
  WeeklyGrade: {
    groupId: string;
    groupName: string;
    semesterId: string;
    currentWeek: number;
    isLecturer: boolean;
  };
  // Task 4 — SRS versioning
  SRSEditor: { groupId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Dark background on all screens to prevent white flash during transitions */
const DARK_CONTENT_STYLE = { backgroundColor: '#101922' };

// ==================== Component ====================

export default function AppNavigator() {
  const [checking, setChecking] = useState(true);
  const sessionCheckRanRef = useRef(false);

  const login = useUserStore((s) => s.login);
  const logout = useUserStore((s) => s.logout);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);

  /**
   * Auto-login check on app start.
   * 1. Check if token exists in AsyncStorage
   * 2. Validate it by calling GET /api/auth/me
   * 3. If valid → go to MainTabs, if expired → go to SignIn
   */
  useEffect(() => {
    if (sessionCheckRanRef.current) return;
    sessionCheckRanRef.current = true;

    const checkSession = async () => {
      try {
        const token = await getAccessToken();

        if (!token) {
          // No saved token → show login
          if (useUserStore.getState().isAuthenticated) {
            await logout();
          }
          setChecking(false);
          return;
        }

        // Validate token by fetching profile
        const profile = await getProfile();

        // Token is valid → update store and go to main app
        await login({ access_token: token, user: profile });
      } catch {
        // Token expired or invalid → clear and show login
        if (useUserStore.getState().isAuthenticated) {
          await logout();
        }
      } finally {
        setChecking(false);
      }
    };

    checkSession();
  }, [login, logout]);

  // Show loading spinner while checking session
  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#101922',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }
  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'MainTabs' : 'SignIn'}
      screenOptions={{
        headerShown: false,
        // Removed forced 'slide_from_right' to let iOS use native modal/slide
        // and Android use default fade scaling for better performance.
        animation: 'default',
        contentStyle: DARK_CONTENT_STYLE,
      }}>
      {!isAuthenticated ? (
        <>
          {/* Auth Flow */}
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="LinkThirdParty" component={LinkThirdPartyScreen} />
        </>
      ) : (
        <>
          {/* Main App with Bottom Tabs */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabNavigator}
            options={{ animation: 'fade' }}
          />

          {/* Account */}
          <Stack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />

          {/* Class & Group Screens */}
          <Stack.Screen name="ClassDetail" component={ClassDetailScreen} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
          <Stack.Screen name="EditGroup" component={CreateGroupScreen} />
          <Stack.Screen name="Evaluation" component={EvaluationScreen} />
          <Stack.Screen name="Documents" component={DocumentSubmissionsScreen} />
          <Stack.Screen name="Reports" component={ReportsScreen} />
          <Stack.Screen name="TopicLab" component={TopicLabScreen} />
          <Stack.Screen name="SemesterStatus" component={SemesterStatusScreen} />
          <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
          <Stack.Screen name="CheckpointManage" component={CheckpointManageScreen} />
          <Stack.Screen name="WeeklyGrade" component={WeeklyGradeScreen} />
          <Stack.Screen name="SRSEditor" component={SRSEditorScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
