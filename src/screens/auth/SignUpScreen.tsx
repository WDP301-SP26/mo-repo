// src/screens/auth/Sign UpScreen.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { register } from '../../services/authService';
import { showError, showInfo } from '../../utils/toast';
import { useUserStore } from '../../utils/stores/userStore';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

// Password strength calculator
const calculatePasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    return strength;
};

const SignUpScreen = ({ navigation }: Props) => {
    const [fullName, setFullName] = useState('');
    const [studentId, setStudentId] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const saveUserToStore = useUserStore((state) => state.login);

    const passwordStrength = calculatePasswordStrength(password);

    const getStrengthText = () => {
        if (passwordStrength === 0) return 'Very weak';
        if (passwordStrength === 1) return 'Weak';
        if (passwordStrength === 2) return 'Medium';
        if (passwordStrength === 3) return 'Good';
        return 'Strong';
    };

    const getStrengthColor = () => {
        if (passwordStrength === 0) return '#ef4444';
        if (passwordStrength === 1) return '#f97316';
        if (passwordStrength === 2) return '#eab308';
        if (passwordStrength === 3) return '#10b981';
        return '#059669';
    };

    const handleSignUp = async () => {
        if (!email || !password || !fullName || !studentId) {
            showInfo('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường.');
            return;
        }
        try {
            setIsLoading(true);
            const data = await register({ email, password, fullName, studentId });
            console.log('Sign Up:', data);
            await saveUserToStore(data);
            navigation.navigate('LinkThirdParty');
        } catch (error) {
            console.log(error);
            showError('Failed Sign Up', 'Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogIn = () => {
        navigation.navigate('SignIn');
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]">
            <StatusBar barStyle="light-content" backgroundColor="#101922" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View className="flex-1 px-6 pt-8">
                        {/* Back Button */}
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            className="mb-6 w-12 h-12 items-center justify-center rounded-full active:bg-white/10"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Feather name="arrow-left" size={24} color="white" />
                        </TouchableOpacity>

                        {/* Header */}
                        <View className="mb-8">
                            <Text className="text-white text-[32px] font-bold mb-2">
                                Create your account
                            </Text>
                            <Text className="text-[#92adc9] text-base">
                                Join your SWP391 capstone team. Connect Jira and GitHub in the next step.
                            </Text>
                        </View>

                        {/* Full Name Input */}
                        <View className="mb-5">
                            <Text className="text-white text-base font-medium mb-2">
                                Full Name
                            </Text>
                            <View className="flex-row items-center bg-[#192633] rounded-lg border border-[#324d67] px-4 h-14">
                                <Feather name="user" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                                <TextInput
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="e.g. Nguyen Van A"
                                    placeholderTextColor="#92adc9"
                                    autoCapitalize="words"
                                    className="flex-1 text-white text-base"
                                />
                            </View>
                        </View>

                        {/* Student ID Input */}
                        <View className="mb-5">
                            <Text className="text-white text-base font-medium mb-2">
                                Student ID
                            </Text>
                            <View className="flex-row items-center bg-[#192633] rounded-lg border border-[#324d67] px-4 h-14">
                                <MaterialIcons name="badge" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                                <TextInput
                                    value={studentId}
                                    onChangeText={(text) => setStudentId(text.toUpperCase())}
                                    placeholder="e.g. SE123456"
                                    placeholderTextColor="#92adc9"
                                    autoCapitalize="characters"
                                    className="flex-1 text-white text-base uppercase"
                                />
                            </View>
                            <Text className="text-[#92adc9] text-xs mt-2 pl-1">
                                Must start with SE followed by 6 digits
                            </Text>
                        </View>

                        {/* Email Input */}
                        <View className="mb-5">
                            <Text className="text-white text-base font-medium mb-2">
                                Email Address
                            </Text>
                            <View className="flex-row items-center bg-[#192633] rounded-lg border border-[#324d67] px-4 h-14">
                                <Feather name="mail" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="student@university.edu.vn"
                                    placeholderTextColor="#92adc9"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    className="flex-1 text-white text-base"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View className="mb-5">
                            <Text className="text-white text-base font-medium mb-2">
                                Password
                            </Text>
                            <View className="flex-row items-center bg-[#192633] rounded-lg border border-[#324d67] px-4 h-14">
                                <Feather name="lock" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Password"
                                    placeholderTextColor="#92adc9"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    className="flex-1 text-white text-base"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Feather
                                        name={showPassword ? 'eye' : 'eye-off'}
                                        size={20}
                                        color="#92adc9"
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Password Strength Indicator */}
                            {password.length > 0 && (
                                <>
                                    <View className="flex-row gap-1 h-1 mt-3 px-1">
                                        {[0, 1, 2, 3].map((index) => (
                                            <View
                                                key={index}
                                                className="h-full flex-1 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        index < passwordStrength
                                                            ? getStrengthColor()
                                                            : '#374151',
                                                }}
                                            />
                                        ))}
                                    </View>
                                    <Text className="text-[#92adc9] text-xs mt-2 pl-1">
                                        {getStrengthText()} strength
                                    </Text>
                                </>
                            )}
                        </View>

                        <View className="h-4" />

                        {/* Sign Up Button */}
                        <TouchableOpacity
                            onPress={handleSignUp}
                            disabled={isLoading}
                            className={`bg-[#137fec] rounded-lg h-14 flex-row items-center justify-center gap-2 active:scale-[0.98] ${isLoading ? 'opacity-70' : ''}`}
                            activeOpacity={0.9}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Text className="text-white text-base font-bold">
                                        Sign Up &amp; Continue
                                    </Text>
                                    <Feather name="arrow-right" size={20} color="white" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Already a member */}
                        <View className="flex-row items-center justify-center mt-6">
                            <Text className="text-[#92adc9] text-sm">
                                Already a member?{' '}
                            </Text>
                            <TouchableOpacity onPress={handleLogIn}>
                                <Text className="text-[#137fec] text-sm font-semibold">
                                    Log In
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Integration Hints */}
                        <View className="mt-8 pt-6 border-t border-white/10">
                            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider text-center mb-3">
                                Integrates seamlessly with
                            </Text>
                            <View className="flex-row items-center justify-center gap-6 opacity-60">
                                {/* Jira */}
                                <View className="flex-row items-center gap-2">
                                    <MaterialIcons name="task" size={20} color="#9ca3af" />
                                    <Text className="text-gray-400 text-sm font-bold">
                                        Jira
                                    </Text>
                                </View>
                                {/* GitHub */}
                                <View className="flex-row items-center gap-2">
                                    <Feather name="code" size={20} color="#9ca3af" />
                                    <Text className="text-gray-400 text-sm font-bold">
                                        GitHub
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View className="h-8" />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default SignUpScreen;