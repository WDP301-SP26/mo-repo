import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserStore } from '@/utils/stores/userStore';
import { showSuccess } from '@/utils/toast';

const SettingsScreen = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const { userInfo, logout } = useUserStore();

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        showSuccess('You have been logged out', 'Goodbye');
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'SignIn' }],
                        });
                    },
                },
            ]
        );
    };

    const SettingItem = ({
        icon,
        iconColor,
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
            className="flex-row items-center p-3 bg-[#1A2332] rounded-xl mb-2"
        >
            <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: (iconColor || '#7C3AED') + '20' }}
            >
                <Feather name={icon as any} size={20} color={iconColor || '#7C3AED'} />
            </View>
            <View className="flex-1 ml-3">
                <Text className="text-white text-base font-medium">{title}</Text>
                {subtitle && <Text className="text-gray-500 text-xs mt-0.5">{subtitle}</Text>}
            </View>
            {rightElement}
            {showChevron && !rightElement && (
                <Feather name="chevron-right" size={20} color="#64748B" />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View className="px-4 py-3">
                    <Text className="text-white text-2xl font-bold">Settings</Text>
                </View>

                {/* Profile Card */}
                <View className="px-4 mb-6">
                    <View className="bg-[#1A2332] rounded-2xl p-4 border border-[#334155]">
                        <View className="flex-row items-center">
                            <View className="relative">
                                <Image
                                    source={{ uri: 'https://i.pravatar.cc/150?img=1' }}
                                    className="w-[72px] h-[72px] rounded-full border-[3px] border-[#7C3AED]"
                                />
                                <TouchableOpacity className="absolute bottom-0 right-0 w-[26px] h-[26px] rounded-full bg-[#7C3AED] items-center justify-center border-2 border-[#1A2332]">
                                    <Feather name="camera" size={12} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-white text-xl font-bold">
                                    {userInfo?.full_name || 'User'}
                                </Text>
                                <Text className="text-gray-400 text-sm mt-0.5">
                                    {userInfo?.email || 'user@example.com'}
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1">
                                    <MaterialIcons name="badge" size={14} color="#7C3AED" />
                                    <Text className="text-gray-500 text-xs">
                                        {userInfo?.student_id || 'SE171234'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity activeOpacity={0.8} className="mt-4 bg-[#7C3AED] rounded-xl py-3 items-center">
                            <Text className="text-white text-sm font-semibold">Edit Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Account Settings */}
                <View className="px-4">
                    <Text className="text-gray-500 text-xs font-semibold mb-2 ml-1">ACCOUNT</Text>
                    <SettingItem
                        icon="lock"
                        iconColor="#06B6D4"
                        title="Change Password"
                        subtitle="Update your password"
                        onPress={() => { }}
                    />
                    <SettingItem
                        icon="link"
                        iconColor="#22C55E"
                        title="Linked Accounts"
                        subtitle="GitHub, Jira integration"
                        onPress={() => navigation.navigate('LinkThirdParty')}
                    />
                </View>

                {/* Preferences */}
                <View className="px-4 mt-6">
                    <Text className="text-gray-500 text-xs font-semibold mb-2 ml-1">PREFERENCES</Text>
                    <SettingItem
                        icon="bell"
                        iconColor="#EAB308"
                        title="Notifications"
                        subtitle={notificationsEnabled ? 'Enabled' : 'Disabled'}
                        showChevron={false}
                        rightElement={
                            <Switch
                                value={notificationsEnabled}
                                onValueChange={setNotificationsEnabled}
                                trackColor={{ false: '#334155', true: '#7C3AED60' }}
                                thumbColor={notificationsEnabled ? '#7C3AED' : '#64748B'}
                            />
                        }
                    />
                </View>

                {/* Support */}
                <View className="px-4 mt-6">
                    <Text className="text-gray-500 text-xs font-semibold mb-2 ml-1">SUPPORT</Text>
                    <SettingItem
                        icon="help-circle"
                        iconColor="#94A3B8"
                        title="Help Center"
                        onPress={() => { }}
                    />
                    <SettingItem
                        icon="info"
                        iconColor="#94A3B8"
                        title="About JiHub"
                        subtitle="Version 1.0.0"
                        onPress={() => { }}
                    />
                </View>

                {/* Logout */}
                <View className="px-4 mt-8">
                    <TouchableOpacity
                        onPress={handleLogout}
                        activeOpacity={0.8}
                        className="bg-red-500/15 rounded-xl p-3 border border-red-500/25 flex-row items-center justify-center gap-2"
                    >
                        <Feather name="log-out" size={20} color="#EF4444" />
                        <Text className="text-red-400 text-base font-semibold">Logout</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default SettingsScreen;
