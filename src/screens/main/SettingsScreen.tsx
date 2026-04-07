import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';
import { showSuccess } from '@/utils/toast';

// ==================== Memoized Components ====================

/** Reusable settings row item with icon, title, subtitle, and optional right element */
const SettingItem = React.memo(
  ({
    icon,
    iconColor = '#7C3AED',
    title,
    subtitle,
    onPress,
    rightElement,
    showChevron = true,
  }: {
    icon: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
      className="mb-2 flex-row items-center rounded-xl bg-[#1A2332] p-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconColor + '20' }}>
        <Feather name={icon as any} size={20} color={iconColor} />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-medium text-white">{title}</Text>
        {subtitle && <Text className="mt-0.5 text-xs text-gray-500">{subtitle}</Text>}
      </View>
      {rightElement}
      {showChevron && !rightElement && <Feather name="chevron-right" size={20} color="#475569" />}
    </TouchableOpacity>
  )
);

// ==================== Main Component ====================

const SettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { userInfo, logout } = useUserStore();

  const initial = userInfo?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';

  /** Handle logout with custom dark modal instead of native Alert */
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    showSuccess('See you next time! 👋', 'Logged Out');
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn' }],
    });
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Prevent stale full-screen modal overlay from blocking touches.
        setShowLogoutModal(false);
      };
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View className="px-4 pb-2 pt-3">
          <Text className="text-2xl font-bold text-white">Settings</Text>
          <Text className="mt-1 text-sm text-gray-400">Manage your account and app preferences</Text>
        </View>

        {/* ── Account Snapshot ── */}
        <View className="mb-6 px-4">
          <View className="overflow-hidden rounded-2xl border border-[#27364A] bg-[#1A2332] p-4">
            <View
              className="absolute -right-8 -top-8 h-28 w-28 rounded-full"
              style={{ backgroundColor: 'rgba(124,58,237,0.18)' }}
            />
            <View className="flex-row items-center">
              <View className="h-[64px] w-[64px] items-center justify-center rounded-2xl border border-[#7C3AED]/40 bg-[#7C3AED]/20">
                <Text className="text-2xl font-black text-[#C4B5FD]">{initial}</Text>
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-white">{userInfo?.fullName || 'User'}</Text>
                <Text className="mt-0.5 text-sm text-gray-400">
                  {userInfo?.email || 'user@example.com'}
                </Text>
                <View className="mt-1 flex-row items-center gap-1">
                  <MaterialIcons name="badge" size={14} color="#A78BFA" />
                  <Text className="text-xs text-gray-500">{userInfo?.studentId || 'SE171234'}</Text>
                </View>
              </View>
            </View>
            <View className="mt-4 rounded-xl border border-white/10 bg-[#101922] px-3 py-2.5">
              <Text className="text-xs text-gray-500">Profile editing is managed by your school system.</Text>
            </View>
          </View>
        </View>

        {/* ── Account ── */}
        <View className="px-4">
          <Text className="mb-2 ml-1 text-xs font-semibold text-gray-600">ACCOUNT</Text>
          <SettingItem
            icon="link"
            iconColor="#22C55E"
            title="Linked Accounts"
            subtitle="GitHub, Jira integration"
            onPress={() => navigation.navigate('LinkedAccounts')}
          />
        </View>

        {/* ── App Info ── */}
        <View className="mt-6 px-4">
          <Text className="mb-2 ml-1 text-xs font-semibold text-gray-600">APP INFO</Text>
          <SettingItem
            icon="info"
            iconColor="#94A3B8"
            title="About JiHub"
            subtitle="Version 1.0.0"
            showChevron={false}
          />
        </View>

        {/* ── Logout Button ── */}
        <View className="mt-8 px-4">
          <TouchableOpacity
            onPress={() => setShowLogoutModal(true)}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-red-500/10 p-3">
            <Feather name="log-out" size={20} color="#EF4444" />
            <Text className="text-base font-semibold text-red-400">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════
                Custom Dark Logout Modal (replaces native Alert)
               ═══════════════════════════════════════════════════ */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}>
        {/* Dim backdrop — tap to dismiss */}
        <Pressable
          onPress={() => setShowLogoutModal(false)}
          className="flex-1 items-center justify-center bg-black/60 px-8">
          {/* Modal card — stopPropagation so taps inside don't close */}
          <Pressable onPress={() => {}} className="w-full rounded-2xl bg-[#1A2332] p-6">
            {/* Icon */}
            <View className="mb-4 items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-red-500/15">
                <Feather name="log-out" size={28} color="#EF4444" />
              </View>
            </View>

            {/* Title + Subtitle */}
            <Text className="mb-2 text-center text-xl font-bold text-white">Log out?</Text>
            <Text className="mb-6 text-center text-sm text-gray-400">
              You'll need to sign in again to access your projects and team.
            </Text>

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-xl bg-white/5 py-3.5">
                <Text className="font-semibold text-white">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmLogout}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-xl bg-red-500 py-3.5">
                <Text className="font-semibold text-white">Log out</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default SettingsScreen;
