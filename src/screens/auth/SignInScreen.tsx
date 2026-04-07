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
import { Feather } from '@/components/icons';
import { getAccessToken } from '@/utils/auth/session';
import { useUserStore } from '../../utils/stores/userStore';
import { login } from '../../services/authService';
import { showError, showSuccess } from '../../utils/toast';
import { getZodErrorMessage, signInSchema } from '@/utils/validation/formSchemas';

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
  }, [fadeAnim, slideAnim]);

  const handleSignIn = async () => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error), 'Login Failed');
      return;
    }

    try {
      const data = await login(parsed.data);
      await saveUserToStore(data);

      const savedToken = await getAccessToken();
      if (!savedToken) {
        throw new Error('Token was not persisted after login');
      }

      showSuccess(`Welcome back, ${data.user.fullName}`, 'Login Successful');
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch {
      showError('Email or password is incorrect', 'Login Failed');
    }
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
          <Animated.View
            style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
            className="flex-1 px-6 pt-10">
            {/* Logo & Title */}
            <View className="mb-10 items-center">
              <View className="mb-6">
                <Image
                  source={require('../../../public/Jihub.jpg')}
                  className="h-20 w-20 rounded-2xl"
                  resizeMode="cover"
                />
              </View>
              <Text className="mb-2 text-3xl font-bold text-white">Welcome Back</Text>
              <Text className="text-center text-base text-gray-400">
                Sign in to continue managing your projects
              </Text>
            </View>

            {/* Email Input */}
            <View className="mb-4">
              <Text className="mb-2 ml-1 text-sm font-medium text-white">Email</Text>
              <View
                className={`h-14 flex-row items-center gap-3 rounded-xl border bg-[#1A2332] px-4 ${
                  emailFocused ? 'border-[#7C3AED]' : 'border-white/10'
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
                  className="flex-1 text-base text-white"
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-2">
              <Text className="mb-2 ml-1 text-sm font-medium text-white">Password</Text>
              <View
                className={`h-14 flex-row items-center gap-3 rounded-xl border bg-[#1A2332] px-4 ${
                  passwordFocused ? 'border-[#7C3AED]' : 'border-white/10'
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
                  className="flex-1 text-base text-white"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <Feather name="eye" size={20} color="#64748B" />
                  ) : (
                    <Feather name="eye-off" size={20} color="#64748B" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              onPress={handleSignIn}
              activeOpacity={0.8}
              className="mt-3 items-center rounded-xl bg-[#7C3AED] py-4">
              <Text className="text-base font-semibold text-white">Sign In</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View className="mt-8 flex-row justify-center pb-6">
              <Text className="text-sm text-gray-400">Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                <Text className="text-sm font-semibold text-[#7C3AED]">Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignInScreen;
