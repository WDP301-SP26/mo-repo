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
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { getAccessToken } from '@/utils/auth/session';
import { login, register } from '../../services/authService';
import { showError, showInfo } from '../../utils/toast';
import { useUserStore } from '../../utils/stores/userStore';
import { getZodErrorMessage, signUpSchema } from '@/utils/validation/formSchemas';

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
    const parsed = signUpSchema.safeParse({
      fullName,
      studentId,
      email,
      password,
    });

    if (!parsed.success) {
      showInfo('Invalid Input', getZodErrorMessage(parsed.error));
      return;
    }

    try {
      setIsLoading(true);
      // Step 1: Register the account
      await register(parsed.data);
      // Step 2: Auto-login to get token + user profile
      const authData = await login({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      await saveUserToStore(authData);

      const savedToken = await getAccessToken();
      if (!savedToken) {
        throw new Error('Token was not persisted after signup auto-login');
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (error) {
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
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-6 pt-8">
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mb-6 h-12 w-12 items-center justify-center rounded-full active:bg-white/10"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="arrow-left" size={24} color="white" />
            </TouchableOpacity>

            {/* Header */}
            <View className="mb-8">
              <Text className="mb-2 text-[32px] font-bold text-white">Create your account</Text>
              <Text className="text-base text-[#92adc9]">
                Join your SWP391 capstone team and start collaborating right away.
              </Text>
            </View>

            {/* Full Name Input */}
            <View className="mb-5">
              <Text className="mb-2 text-base font-medium text-white">Full Name</Text>
              <View className="h-14 flex-row items-center rounded-lg border border-[#324d67] bg-[#192633] px-4">
                <Feather name="user" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="e.g. Nguyen Van A"
                  placeholderTextColor="#92adc9"
                  autoCapitalize="words"
                  className="flex-1 text-base text-white"
                />
              </View>
            </View>

            {/* Student ID Input */}
            <View className="mb-5">
              <Text className="mb-2 text-base font-medium text-white">Student ID</Text>
              <View className="h-14 flex-row items-center rounded-lg border border-[#324d67] bg-[#192633] px-4">
                <MaterialIcons name="badge" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                <TextInput
                  value={studentId}
                  onChangeText={(text) => setStudentId(text.toUpperCase())}
                  placeholder="e.g. SE123456"
                  placeholderTextColor="#92adc9"
                  autoCapitalize="characters"
                  className="flex-1 text-base uppercase text-white"
                />
              </View>
              <Text className="mt-2 pl-1 text-xs text-[#92adc9]">
                Must start with SE followed by 6 digits
              </Text>
            </View>

            {/* Email Input */}
            <View className="mb-5">
              <Text className="mb-2 text-base font-medium text-white">Email Address</Text>
              <View className="h-14 flex-row items-center rounded-lg border border-[#324d67] bg-[#192633] px-4">
                <Feather name="mail" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="student@university.edu.vn"
                  placeholderTextColor="#92adc9"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-base text-white"
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-5">
              <Text className="mb-2 text-base font-medium text-white">Password</Text>
              <View className="h-14 flex-row items-center rounded-lg border border-[#324d67] bg-[#192633] px-4">
                <Feather name="lock" size={20} color="#92adc9" style={{ marginRight: 12 }} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#92adc9"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 text-base text-white"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  {showPassword ? (
                    <Feather name="eye" size={20} color="#92adc9" />
                  ) : (
                    <Feather name="eye-off" size={20} color="#92adc9" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <>
                  <View className="mt-3 h-1 flex-row gap-1 px-1">
                    {[0, 1, 2, 3].map((index) => (
                      <View
                        key={index}
                        className="h-full flex-1 rounded-full"
                        style={{
                          backgroundColor:
                            index < passwordStrength ? getStrengthColor() : '#374151',
                        }}
                      />
                    ))}
                  </View>
                  <Text className="mt-2 pl-1 text-xs text-[#92adc9]">
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
              className={`h-14 flex-row items-center justify-center gap-2 rounded-lg bg-[#137fec] active:scale-[0.98] ${isLoading ? 'opacity-70' : ''}`}
              activeOpacity={0.9}>
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Text className="text-base font-bold text-white">Sign Up</Text>
                  <Feather name="arrow-right" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>

            {/* Already a member */}
            <View className="mt-6 flex-row items-center justify-center">
              <Text className="text-sm text-[#92adc9]">Already a member? </Text>
              <TouchableOpacity onPress={handleLogIn}>
                <Text className="text-sm font-semibold text-[#137fec]">Log In</Text>
              </TouchableOpacity>
            </View>

            <View className="h-8" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;
