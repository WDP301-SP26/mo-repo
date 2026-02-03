import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
    Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useUserStore } from '../../utils/stores/userStore';
import { login, getGitHubAuthUrl, getJiraAuthUrl, getProfile } from '../../services/authService';
import { showError, showSuccess } from '../../utils/toast';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const SignInScreen = ({ navigation }: Props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const saveUserToStore = useUserStore((state) => state.login);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleSignIn = async () => {
        try {
            const data = await login({ email, password });
            await saveUserToStore(data);
            showSuccess(`Welcome back, ${data.user.full_name}`, 'Login Successful');
            navigation.navigate('MainTabs');
        } catch (error: any) {
            showError('Email or password is incorrect', 'Login Failed');
        }
    };

    const handleGitHubSignIn = async () => {
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'jihub', path: '/auth/github/callback' });
        const baseAuthUrl = getGitHubAuthUrl();
        const authUrl = `${baseAuthUrl}?mobile_redirect=${encodeURIComponent(redirectUri)}`;

        try {
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            if (result.type === 'success' && result.url) {
                const url = new URL(result.url);
                const token = url.searchParams.get('token');
                const error = url.searchParams.get('error');

                if (error) { showError(decodeURIComponent(error), 'Login Failed'); return; }
                if (token) {
                    await AsyncStorage.setItem('access_token', token);
                    const profile = await getProfile();
                    await saveUserToStore({ access_token: token, user: profile });
                    showSuccess(`Welcome back, ${profile.full_name}!`, 'Login Successful');
                    navigation.navigate('MainTabs');
                }
            }
        } catch (error) {
            showError('Could not open GitHub authentication session', 'Login Failed');
        }
    };

    const handleJiraSignIn = async () => {
        const redirectUri = AuthSession.makeRedirectUri({ scheme: 'jihub', path: '/auth/jira/callback' });
        const baseAuthUrl = getJiraAuthUrl();
        const authUrl = `${baseAuthUrl}?mobile_redirect=${encodeURIComponent(redirectUri)}`;

        try {
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            if (result.type === 'success' && result.url) {
                const url = new URL(result.url);
                const token = url.searchParams.get('token');
                const error = url.searchParams.get('error');

                if (error) { showError(decodeURIComponent(error), 'Login Failed'); return; }
                if (token) {
                    await AsyncStorage.setItem('access_token', token);
                    const profile = await getProfile();
                    await saveUserToStore({ access_token: token, user: profile });
                    showSuccess(`Welcome back, ${profile.full_name}!`, 'Login Successful');
                    navigation.navigate('MainTabs');
                }
            }
        } catch (error) {
            showError('Could not open Jira authentication session', 'Login Failed');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]">
            <StatusBar barStyle="light-content" backgroundColor="#101922" />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="flex-1 px-6 pt-10">

                        {/* Logo & Title */}
                        <View className="items-center mb-10">
                            <View className="mb-6">
                                <Image source={require('../../../public/Jihub.jpg')} className="w-20 h-20 rounded-2xl" resizeMode="cover" />
                            </View>
                            <Text className="text-white text-3xl font-bold mb-2">Welcome Back</Text>
                            <Text className="text-gray-400 text-base text-center">Sign in to continue managing your projects</Text>
                        </View>

                        {/* Email Input */}
                        <View className="mb-4">
                            <Text className="text-white text-sm font-medium mb-2 ml-1">Email</Text>
                            <View className={`flex-row items-center bg-[#1A2332] rounded-xl px-4 h-14 border gap-3 ${emailFocused ? 'border-[#7C3AED]' : 'border-[#334155]'
                                }`}>
                                <Feather name="mail" size={20} color={emailFocused ? '#7C3AED' : '#64748B'} />
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#64748B"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    className="flex-1 text-white text-base"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View className="mb-2">
                            <Text className="text-white text-sm font-medium mb-2 ml-1">Password</Text>
                            <View className={`flex-row items-center bg-[#1A2332] rounded-xl px-4 h-14 border gap-3 ${passwordFocused ? 'border-[#7C3AED]' : 'border-[#334155]'
                                }`}>
                                <Feather name="lock" size={20} color={passwordFocused ? '#7C3AED' : '#64748B'} />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#64748B"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    className="flex-1 text-white text-base"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <Feather name={showPassword ? 'eye' : 'eye-off'} size={20} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity className="self-end mb-2">
                            <Text className="text-[#7C3AED] text-sm font-medium">Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Sign In Button */}
                        <TouchableOpacity onPress={handleSignIn} activeOpacity={0.8} className="mt-3 bg-[#7C3AED] rounded-xl py-4 items-center">
                            <Text className="text-white text-base font-semibold">Sign In</Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View className="flex-row items-center my-6">
                            <View className="flex-1 h-px bg-[#334155]" />
                            <Text className="text-gray-500 text-sm mx-4">Or continue with</Text>
                            <View className="flex-1 h-px bg-[#334155]" />
                        </View>

                        {/* OAuth Buttons */}
                        <View className="flex-row gap-3 mb-8">
                            <TouchableOpacity onPress={handleGitHubSignIn} activeOpacity={0.8} className="flex-1 flex-row items-center justify-center bg-[#1A2332] rounded-xl py-4 gap-2 border border-[#334155]">
                                <AntDesign name="github" size={22} color="#fff" />
                                <Text className="text-white text-sm font-medium">GitHub</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleJiraSignIn} activeOpacity={0.8} className="flex-1 flex-row items-center justify-center bg-[#1A2332] rounded-xl py-4 gap-2 border border-[#334155]">
                                <Feather name="trello" size={22} color="#0052CC" />
                                <Text className="text-white text-sm font-medium">Jira</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Sign Up Link */}
                        <View className="flex-row justify-center pb-6">
                            <Text className="text-gray-400 text-sm">Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                                <Text className="text-[#7C3AED] text-sm font-semibold">Sign Up</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignInScreen;