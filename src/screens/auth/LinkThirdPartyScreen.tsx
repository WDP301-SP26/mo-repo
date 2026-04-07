import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OAUTH_REDIRECT_URI } from '@env';
import { showSuccess, showError, showInfo } from '../../utils/toast';
import { useUserStore } from '../../utils/stores/userStore';
import {
  getGitHubAuthUrl,
  getJiraAuthUrl,
  getLinkedAccounts,
  getProfile,
} from '../../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkThirdParty'>;

// Warm-up browser for faster OAuth on Android
WebBrowser.maybeCompleteAuthSession();

// === CONSTANTS ===
const REDIRECT_CONFIG = {
  scheme: 'jihub',
  path: 'auth/callback',
} as const;

const getOAuthRedirectUri = () => {
  const configuredRedirectUri = OAUTH_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return AuthSession.makeRedirectUri({
    ...REDIRECT_CONFIG,
    native: 'jihub://auth/callback',
  });
};

// === COMPONENTS ===
interface AccountCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isLinked: boolean;
  onConnect: () => void;
  buttonColor?: string;
}

const AccountCard = ({
  title,
  subtitle,
  icon,
  isLinked,
  onConnect,
  buttonColor = '#137fec',
}: AccountCardProps) => (
  <View className="mb-6 rounded-2xl border border-[#324d67] bg-[#1c2630] p-5">
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        {icon}
        <View>
          <Text className="text-base font-bold text-white">{title}</Text>
          <Text className="text-xs text-slate-400">{subtitle}</Text>
        </View>
      </View>
      <StatusBadge isLinked={isLinked} />
    </View>
    <TouchableOpacity
      onPress={onConnect}
      disabled={isLinked}
      className={`h-11 items-center justify-center rounded-xl ${
        isLinked ? 'border border-emerald-500/30 bg-emerald-500/20' : ''
      }`}
      style={!isLinked ? { backgroundColor: buttonColor } : undefined}
      activeOpacity={0.8}>
      <Text className={`text-sm font-bold ${isLinked ? 'text-emerald-400' : 'text-white'}`}>
        {isLinked ? '✓ Connected' : `Connect ${title}`}
      </Text>
    </TouchableOpacity>
  </View>
);

const StatusBadge = ({ isLinked }: { isLinked: boolean }) => (
  <View
    className={`rounded-md border px-2 py-1 ${
      isLinked ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'
    }`}>
    <Text
      className={`text-[10px] font-bold uppercase tracking-wider ${
        isLinked ? 'text-emerald-400' : 'text-slate-400'
      }`}>
      {isLinked ? 'Linked' : 'Not Linked'}
    </Text>
  </View>
);

// === MAIN COMPONENT ===
const LinkThirdPartyScreen = ({ navigation }: Props) => {
  const [githubLinked, setGithubLinked] = useState(false);
  const [jiraLinked, setJiraLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const saveUserToStore = useUserStore((state) => state.login);

  const syncLinkedStatus = async (
    provider: 'github' | 'jira',
    setLinked: (value: boolean) => void
  ) => {
    try {
      const linkedAccounts = await getLinkedAccounts();
      const targetProvider = provider.toUpperCase();
      const isLinked = linkedAccounts.some((acc) => acc.provider === targetProvider);

      if (isLinked) {
        setLinked(true);
        showSuccess('Success', `${provider} account linked successfully!`);
      }
    } catch (error) {
      showError('Error', `Failed to refresh ${provider} link status`);
    }
  };

  // Generic OAuth handler to reduce duplication
  const handleOAuthConnect = async (
    provider: 'github' | 'jira',
    getAuthUrl: (token?: string, redirectUri?: string) => string,
    setLinked: (value: boolean) => void
  ) => {
    if (isLoading) return;

    const redirectUri = getOAuthRedirectUri();

    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      const authUrl = getAuthUrl(token || undefined, redirectUri);

      if (provider === 'jira') {
        // Jira flow can end on a non-app callback URL; avoid waiting for deep-link callback.
        await WebBrowser.openBrowserAsync(authUrl);
        await syncLinkedStatus(provider, setLinked);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        await handleOAuthSuccess(result.url, provider, setLinked);
      } else if (result.type === 'cancel') {
        showInfo('Info', `${provider} connection was cancelled`);
        await syncLinkedStatus(provider, setLinked);
      } else if (result.type === 'dismiss') {
        showInfo('Info', `${provider} connection was dismissed`);
        await syncLinkedStatus(provider, setLinked);
      }
    } catch (error) {
      showError('Error', `Failed to connect ${provider} account`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSuccess = async (
    url: string,
    provider: string,
    setLinked: (value: boolean) => void
  ) => {
    try {
      // Safely parse URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        showError('Error', 'Invalid callback URL received');
        return;
      }

      const newToken = parsedUrl.searchParams.get('token');
      const error = parsedUrl.searchParams.get('error');

      if (error) {
        showError('Error', decodeURIComponent(error));
        return;
      }

      if (!newToken) {
        showError('Error', 'No token received from authentication');
        return;
      }

      // Save token first
      await AsyncStorage.setItem('access_token', newToken);

      // Fetch fresh user profile
      const profile = await getProfile();

      await saveUserToStore({
        access_token: newToken,
        user: profile,
      });

      setLinked(true);
      showSuccess('Success', `${provider} account linked successfully!`);
    } catch {
      showError('Error', 'Failed to process authentication response');
    }
  };

  const handleConnectGitHub = () => handleOAuthConnect('github', getGitHubAuthUrl, setGithubLinked);
  const handleConnectJira = () => handleOAuthConnect('jira', getJiraAuthUrl, setJiraLinked);

  const handleCompleteSetup = () => {
    if (githubLinked && jiraLinked) {
      navigation.navigate('MainTabs');
    }
  };

  const handleSkip = () => {
    navigation.navigate('MainTabs');
  };

  const canComplete = githubLinked && jiraLinked;

  return (
    <SafeAreaView className="flex-1 bg-[#101922]">
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-[#324d67]/30 px-4 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-white/5">
          <Feather name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-white">Link Accounts</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-sm font-medium text-[#137fec]">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View className="items-center py-4">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-[#137fec]/40" />
          <View className="h-2 w-12 rounded-full bg-[#137fec]" />
          <View className="h-2 w-2 rounded-full bg-slate-700" />
        </View>
        <Text className="mt-2 text-xs font-medium text-slate-400">Step 2 of 3</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>
        {/* Header Text */}
        <View className="mb-6 pt-2">
          <Text className="text-2xl font-bold text-white">Connect your tools</Text>
          <Text className="mt-1 text-sm text-slate-400">
            Link your GitHub and Jira accounts to enable automatic project tracking.
          </Text>
        </View>

        {/* GitHub Card */}
        <AccountCard
          title="GitHub"
          subtitle="Source code management"
          icon={
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
              <Feather name="github" size={28} color="white" />
            </View>
          }
          isLinked={githubLinked}
          onConnect={handleConnectGitHub}
        />

        {/* Jira Card */}
        <AccountCard
          title="Jira"
          subtitle="Project tracking"
          icon={
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#0052CC]">
              <Feather name="trello" size={28} color="white" />
            </View>
          }
          isLinked={jiraLinked}
          onConnect={handleConnectJira}
          buttonColor="#253240"
        />

        {/* Info Box */}
        <View className="flex-row items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <MaterialIcons name="info" size={16} color="#eab308" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-xs leading-relaxed text-yellow-400">
            Both accounts are required to proceed. You can manage these connections later in
            settings.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-[#324d67] bg-[#101922]/95 p-4">
        <TouchableOpacity
          onPress={handleCompleteSetup}
          disabled={!canComplete || isLoading}
          className={`h-12 items-center justify-center rounded-xl ${
            canComplete ? 'bg-[#137fec]' : 'bg-slate-800'
          }`}
          activeOpacity={0.9}>
          <Text className={`text-base font-bold ${canComplete ? 'text-white' : 'text-slate-500'}`}>
            {isLoading ? 'Connecting...' : 'Complete Setup'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default LinkThirdPartyScreen;
