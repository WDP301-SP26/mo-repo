import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StatusBar,
    ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showSuccess, showError } from '../../utils/toast';
import { useUserStore } from '../../utils/stores/userStore';
import { getGitHubAuthUrl, getJiraAuthUrl, getProfile } from '../../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'LinkThirdParty'>;

// Warm-up browser for faster OAuth on Android
WebBrowser.maybeCompleteAuthSession();

// === CONSTANTS ===
const REDIRECT_CONFIG = {
    scheme: 'jihub',
    path: 'auth/callback'
} as const;

// === COMPONENTS ===
interface AccountCardProps {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isLinked: boolean;
    onConnect: () => void;
    buttonColor?: string;
}

const AccountCard = ({ title, subtitle, icon, isLinked, onConnect, buttonColor = '#137fec' }: AccountCardProps) => (
    <View className="bg-[#1c2630] rounded-2xl p-5 mb-6 border border-[#324d67]">
        <View className="flex-row items-center justify-between mb-4">
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
            className={`rounded-xl h-11 items-center justify-center ${isLinked
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : ''
                }`}
            style={!isLinked ? { backgroundColor: buttonColor } : undefined}
            activeOpacity={0.8}
        >
            <Text className={`text-sm font-bold ${isLinked ? 'text-emerald-400' : 'text-white'}`}>
                {isLinked ? '✓ Connected' : `Connect ${title}`}
            </Text>
        </TouchableOpacity>
    </View>
);

const StatusBadge = ({ isLinked }: { isLinked: boolean }) => (
    <View className={`px-2 py-1 rounded-md border ${isLinked
        ? 'bg-emerald-500/10 border-emerald-500/20'
        : 'bg-slate-800 border-slate-700'
        }`}>
        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isLinked ? 'text-emerald-400' : 'text-slate-400'
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

    // Generic OAuth handler to reduce duplication
    const handleOAuthConnect = async (
        provider: 'github' | 'jira',
        getAuthUrl: (token?: string) => string,
        setLinked: (value: boolean) => void
    ) => {
        if (isLoading) return;

        const redirectUri = AuthSession.makeRedirectUri(REDIRECT_CONFIG);
        console.log(`[${provider.toUpperCase()}] Redirect URI:`, redirectUri);

        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('access_token');
            const authUrl = getAuthUrl(token || undefined);

            console.log(`[${provider.toUpperCase()}] Opening auth session:`, authUrl);

            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

            if (result.type === 'success' && result.url) {
                await handleOAuthSuccess(result.url, provider, setLinked);
            } else if (result.type === 'cancel') {
                console.log(`[${provider.toUpperCase()}] Auth cancelled by user`);
            } else if (result.type === 'dismiss') {
                console.log(`[${provider.toUpperCase()}] Auth dismissed`);
            }
        } catch (error) {
            console.error(`[${provider.toUpperCase()}] OAuth error:`, error);
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
            console.log(`[${provider.toUpperCase()}] Callback URL:`, url);

            // Safely parse URL
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch (parseError) {
                console.error('Failed to parse callback URL:', parseError);
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
                user: profile
            });

            setLinked(true);
            showSuccess('Success', `${provider} account linked successfully!`);
        } catch (error) {
            console.error(`[${provider.toUpperCase()}] Error processing callback:`, error);
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
            <View className="flex-row items-center justify-between px-4 py-2 border-b border-[#324d67]/30">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-full active:bg-white/5"
                >
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-white flex-1 text-center">
                    Link Accounts
                </Text>
                <TouchableOpacity onPress={handleSkip}>
                    <Text className="text-[#137fec] text-sm font-medium">Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Progress Indicator */}
            <View className="items-center py-4">
                <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-[#137fec]/40" />
                    <View className="h-2 w-12 rounded-full bg-[#137fec]" />
                    <View className="h-2 w-2 rounded-full bg-slate-700" />
                </View>
                <Text className="mt-2 text-xs font-medium text-slate-400">
                    Step 2 of 3
                </Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Text */}
                <View className="pt-2 mb-6">
                    <Text className="text-2xl font-bold text-white">
                        Connect your tools
                    </Text>
                    <Text className="text-slate-400 mt-1 text-sm">
                        Link your GitHub and Jira accounts to enable automatic project tracking.
                    </Text>
                </View>

                {/* GitHub Card */}
                <AccountCard
                    title="GitHub"
                    subtitle="Source code management"
                    icon={
                        <View className="w-12 h-12 rounded-xl bg-slate-900 items-center justify-center">
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
                        <View className="w-12 h-12 rounded-xl bg-[#0052CC] items-center justify-center">
                            <Feather name="trello" size={28} color="white" />
                        </View>
                    }
                    isLinked={jiraLinked}
                    onConnect={handleConnectJira}
                    buttonColor="#253240"
                />

                {/* Info Box */}
                <View className="flex-row items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <MaterialIcons name="info" size={16} color="#eab308" style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-xs text-yellow-400 leading-relaxed">
                        Both accounts are required to proceed. You can manage these connections later in settings.
                    </Text>
                </View>
            </ScrollView>

            {/* Sticky Footer */}
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-[#101922]/95 border-t border-[#324d67]">
                <TouchableOpacity
                    onPress={handleCompleteSetup}
                    disabled={!canComplete || isLoading}
                    className={`rounded-xl h-12 items-center justify-center ${canComplete ? 'bg-[#137fec]' : 'bg-slate-800'
                        }`}
                    activeOpacity={0.9}
                >
                    <Text className={`text-base font-bold ${canComplete ? 'text-white' : 'text-slate-500'}`}>
                        {isLoading ? 'Connecting...' : 'Complete Setup'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default LinkThirdPartyScreen;