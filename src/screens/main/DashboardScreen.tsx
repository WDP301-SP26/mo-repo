import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    RefreshControl,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useUserStore } from '@/utils/stores/userStore';

// Mock data
const MOCK_GROUP = {
    id: 1,
    name: 'Team Alpha',
    projectName: 'JiHub - Project Management',
    className: 'SE1845',
    leader: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1' },
    instructor: { name: 'Dr. Tran Thi B', avatar: 'https://i.pravatar.cc/150?img=10' },
    membersCount: 5,
    progress: 68,
};

const MOCK_TASKS = [
    { id: 1, title: 'Implement OAuth Flow', status: 'in_progress', priority: 'high', deadline: '2026-02-05', assignee: 'https://i.pravatar.cc/150?img=1' },
    { id: 2, title: 'Design Dashboard UI', status: 'in_progress', priority: 'medium', deadline: '2026-02-07', assignee: 'https://i.pravatar.cc/150?img=2' },
    { id: 3, title: 'Setup CI/CD Pipeline', status: 'todo', priority: 'low', deadline: '2026-02-10', assignee: 'https://i.pravatar.cc/150?img=3' },
];

const STATS = [
    { label: 'In Progress', value: 3, icon: 'clock', color: '#EAB308', bgColor: 'bg-yellow-500/10' },
    { label: 'Completed', value: 12, icon: 'check-circle', color: '#22C55E', bgColor: 'bg-green-500/10' },
    { label: 'Due Soon', value: 2, icon: 'alert-circle', color: '#EF4444', bgColor: 'bg-red-500/10' },
];

const DashboardScreen = () => {
    const [refreshing, setRefreshing] = useState(false);
    const [hasGroup] = useState(true);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    const userInfo = useUserStore((state) => state.userInfo);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setRefreshing(false);
    };

    const getDeadlineInfo = (deadline: string) => {
        const today = new Date();
        const deadlineDate = new Date(deadline);
        const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { text: 'Overdue', color: '#EF4444' };
        if (diffDays === 0) return { text: 'Today', color: '#F97316' };
        if (diffDays <= 2) return { text: `${diffDays}d left`, color: '#EAB308' };
        return { text: `${diffDays}d left`, color: '#22C55E' };
    };

    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case 'high': return { bg: 'bg-red-500/15', text: 'text-red-400', border: '#EF4444' };
            case 'medium': return { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: '#EAB308' };
            default: return { bg: 'bg-green-500/15', text: 'text-green-400', border: '#22C55E' };
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="px-4 py-3">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Text className="text-gray-400 text-sm">{getGreeting()} 👋</Text>
                        <Text className="text-white text-2xl font-bold mt-0.5">
                            {userInfo?.full_name?.split(' ')[0] || 'User'}
                        </Text>
                    </View>
                    <TouchableOpacity className="w-11 h-11 rounded-full bg-[#1A2332] items-center justify-center border border-[#334155]">
                        <Feather name="bell" size={20} color="#94A3B8" />
                        <View className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-[#1A2332]" />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" colors={['#7C3AED']} />}
            >
                {/* My Group Card */}
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="px-4 mt-3">
                    <Text className="text-white text-lg font-semibold mb-3">My Group</Text>

                    {hasGroup ? (
                        <TouchableOpacity activeOpacity={0.9} className="bg-[#1A2332] rounded-2xl p-4 border border-[#334155]">
                            {/* Group Header */}
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-[#7C3AED] px-2.5 py-1 rounded-lg">
                                            <Text className="text-white text-xs font-semibold">{MOCK_GROUP.className}</Text>
                                        </View>
                                        <Text className="text-green-400 text-xs font-medium">● Active</Text>
                                    </View>
                                    <Text className="text-white text-xl font-bold mt-2">{MOCK_GROUP.name}</Text>
                                    <Text className="text-gray-400 text-sm mt-0.5">{MOCK_GROUP.projectName}</Text>
                                </View>
                                <View className="items-center">
                                    <Text className="text-[#7C3AED] text-3xl font-bold">{MOCK_GROUP.progress}%</Text>
                                    <Text className="text-gray-500 text-xs">Progress</Text>
                                </View>
                            </View>

                            {/* Progress Bar */}
                            <View className="mt-4">
                                <View className="h-1.5 bg-[#334155] rounded-full overflow-hidden">
                                    <View className="h-full bg-[#7C3AED] rounded-full" style={{ width: `${MOCK_GROUP.progress}%` }} />
                                </View>
                            </View>

                            {/* Members Row */}
                            <View className="flex-row justify-between items-center mt-4">
                                <View className="flex-row items-center">
                                    <View className="flex-row">
                                        <Image source={{ uri: MOCK_GROUP.leader.avatar }} className="w-8 h-8 rounded-full border-2 border-[#7C3AED]" />
                                        <Image source={{ uri: MOCK_GROUP.instructor.avatar }} className="w-8 h-8 rounded-full -ml-2.5 border-2 border-[#1A2332]" />
                                        <View className="w-8 h-8 rounded-full -ml-2.5 bg-[#334155] border-2 border-[#1A2332] items-center justify-center">
                                            <Text className="text-gray-400 text-xs font-semibold">+{MOCK_GROUP.membersCount - 2}</Text>
                                        </View>
                                    </View>
                                    <Text className="text-gray-400 text-xs ml-2">{MOCK_GROUP.membersCount} members</Text>
                                </View>
                                <Feather name="chevron-right" size={20} color="#64748B" />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View className="bg-[#1A2332] rounded-2xl p-6 items-center border border-dashed border-[#334155]">
                            <MaterialIcons name="group-add" size={48} color="#64748B" />
                            <Text className="text-gray-400 text-center mt-3 mb-4">You haven't joined any group yet</Text>
                            <TouchableOpacity className="bg-[#7C3AED] px-6 py-3 rounded-xl">
                                <Text className="text-white font-semibold">Browse Groups</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {/* Quick Stats */}
                <Animated.View style={{ opacity: fadeAnim }} className="px-4 mt-6">
                    <Text className="text-white text-lg font-semibold mb-3">Quick Stats</Text>
                    <View className="flex-row gap-3">
                        {STATS.map((stat, index) => (
                            <TouchableOpacity key={index} className="flex-1 bg-[#1A2332] rounded-2xl p-3 border border-[#334155]" activeOpacity={0.8}>
                                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: stat.color + '20' }}>
                                    <Feather name={stat.icon as any} size={18} color={stat.color} />
                                </View>
                                <Text className="text-white text-2xl font-bold mt-2">{stat.value}</Text>
                                <Text className="text-gray-400 text-xs mt-0.5">{stat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Animated.View>

                {/* My Tasks */}
                <Animated.View style={{ opacity: fadeAnim }} className="px-4 mt-6">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-white text-lg font-semibold">My Tasks</Text>
                        <TouchableOpacity className="flex-row items-center gap-1">
                            <Text className="text-[#7C3AED] text-sm font-medium">See all</Text>
                            <Feather name="arrow-right" size={14} color="#7C3AED" />
                        </TouchableOpacity>
                    </View>

                    {MOCK_TASKS.map((task) => {
                        const deadline = getDeadlineInfo(task.deadline);
                        const priority = getPriorityStyle(task.priority);

                        return (
                            <TouchableOpacity
                                key={task.id}
                                activeOpacity={0.8}
                                className="bg-[#1A2332] rounded-2xl p-3 mb-2 border border-[#334155] flex-row items-center"
                            >
                                <View className="w-1 h-10 rounded-sm mr-3" style={{ backgroundColor: priority.border }} />
                                <View className="flex-1">
                                    <Text className="text-white text-sm font-medium" numberOfLines={1}>{task.title}</Text>
                                    <View className="flex-row items-center gap-2 mt-1.5">
                                        <View className={`px-2 py-0.5 rounded-md ${priority.bg}`}>
                                            <Text className={`text-[10px] font-semibold capitalize ${priority.text}`}>{task.priority}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-1">
                                            <Feather name="clock" size={11} color={deadline.color} />
                                            <Text className="text-xs font-medium" style={{ color: deadline.color }}>{deadline.text}</Text>
                                        </View>
                                    </View>
                                </View>
                                <Image source={{ uri: task.assignee }} className="w-8 h-8 rounded-full ml-2" />
                            </TouchableOpacity>
                        );
                    })}
                </Animated.View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DashboardScreen;
