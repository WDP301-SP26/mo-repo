import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    StatusBar,
    TextInput,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { showSuccess } from '@/utils/toast';

// Mock data
const MOCK_GROUPS = [
    {
        id: 1,
        name: 'Team Alpha',
        projectName: 'Project Management Tool',
        className: 'SE1845',
        leader: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1' },
        membersCount: 5,
        maxMembers: 6,
        status: 'open',
        tags: ['Mobile', 'React Native'],
    },
    {
        id: 2,
        name: 'Team Beta',
        projectName: 'E-commerce Platform',
        className: 'SE1846',
        leader: { name: 'Tran Van C', avatar: 'https://i.pravatar.cc/150?img=3' },
        membersCount: 6,
        maxMembers: 6,
        status: 'full',
        tags: ['Web', 'NextJS'],
    },
    {
        id: 3,
        name: 'Team Gamma',
        projectName: 'Healthcare System',
        className: 'SE1845',
        leader: { name: 'Pham Thi E', avatar: 'https://i.pravatar.cc/150?img=5' },
        membersCount: 4,
        maxMembers: 6,
        status: 'open',
        tags: ['Web', 'Spring Boot'],
    },
    {
        id: 4,
        name: 'Team Delta',
        projectName: 'Smart Parking IoT',
        className: 'SE1847',
        leader: { name: 'Le Minh G', avatar: 'https://i.pravatar.cc/150?img=7' },
        membersCount: 3,
        maxMembers: 5,
        status: 'open',
        tags: ['IoT', 'Embedded'],
    },
];

const GroupsScreen = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<number[]>([]);
    const [searchFocused, setSearchFocused] = useState(false);

    const filteredGroups = MOCK_GROUPS.filter(
        (group) =>
            group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.projectName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setRefreshing(false);
    };

    const handleRequestJoin = (groupId: number, groupName: string) => {
        Alert.alert(
            'Join Group',
            `Send a request to join ${groupName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Request',
                    onPress: () => {
                        setPendingRequests([...pendingRequests, groupId]);
                        showSuccess(`Request sent to ${groupName}`, 'Request Sent');
                    },
                },
            ]
        );
    };

    const renderGroup = ({ item }: { item: typeof MOCK_GROUPS[0] }) => {
        const isPending = pendingRequests.includes(item.id);
        const isFull = item.status === 'full';

        return (
            <TouchableOpacity activeOpacity={0.9} className="bg-[#1A2332] rounded-2xl p-4 mb-3 border border-[#334155]">
                {/* Header */}
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1.5">
                            <View className={`px-2 py-0.5 rounded-md ${isFull ? 'bg-red-500/15' : 'bg-green-500/15'}`}>
                                <Text className={`text-[10px] font-semibold ${isFull ? 'text-red-400' : 'text-green-400'}`}>
                                    {isFull ? 'Full' : 'Open'}
                                </Text>
                            </View>
                            <Text className="text-gray-500 text-xs">{item.className}</Text>
                        </View>
                        <Text className="text-white text-lg font-bold">{item.name}</Text>
                        <Text className="text-gray-400 text-sm mt-0.5">{item.projectName}</Text>
                    </View>
                </View>

                {/* Tags */}
                <View className="flex-row gap-1.5 mt-3">
                    {item.tags.map((tag, idx) => (
                        <View key={idx} className="bg-[#7C3AED]/15 px-2.5 py-1 rounded-lg">
                            <Text className="text-[#7C3AED] text-xs font-medium">{tag}</Text>
                        </View>
                    ))}
                </View>

                {/* Members Row */}
                <View className="flex-row justify-between items-center mt-4 pt-3 border-t border-[#334155]">
                    <View className="flex-row items-center">
                        <Image
                            source={{ uri: item.leader.avatar }}
                            className="w-7 h-7 rounded-full border-2 border-[#7C3AED]"
                        />
                        <View className="bg-[#7C3AED] px-1.5 py-0.5 rounded ml-1.5">
                            <Text className="text-white text-[9px] font-semibold">LEADER</Text>
                        </View>
                        <View className="w-px h-5 bg-[#334155] mx-3" />
                        <View className="flex-row items-center gap-1">
                            <MaterialIcons name="group" size={16} color="#64748B" />
                            <Text className="text-gray-400 text-xs">{item.membersCount}/{item.maxMembers}</Text>
                        </View>
                    </View>

                    {!isFull && (
                        <TouchableOpacity
                            onPress={() => handleRequestJoin(item.id, item.name)}
                            disabled={isPending}
                            activeOpacity={0.8}
                            className={`px-3.5 py-2 rounded-xl ${isPending ? 'bg-[#334155]' : 'bg-[#7C3AED]'}`}
                        >
                            <Text className={`text-xs font-semibold ${isPending ? 'text-gray-500' : 'text-white'}`}>
                                {isPending ? 'Pending' : 'Join'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">Browse Groups</Text>
                <Text className="text-gray-400 text-sm mt-0.5">Find and join a group for your project</Text>
            </View>

            {/* Search */}
            <View className="px-4 mb-3">
                <View
                    className={`flex-row items-center bg-[#1A2332] rounded-xl px-3 h-12 border ${searchFocused ? 'border-[#7C3AED]' : 'border-[#334155]'
                        }`}
                >
                    <Feather name="search" size={18} color={searchFocused ? '#7C3AED' : '#64748B'} />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        placeholder="Search by name, project, or class..."
                        placeholderTextColor="#64748B"
                        className="flex-1 ml-2 text-white text-sm"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Feather name="x" size={18} color="#64748B" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Groups List */}
            <FlatList
                data={filteredGroups}
                renderItem={renderGroup}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" colors={['#7C3AED']} />}
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <MaterialIcons name="search-off" size={48} color="#64748B" />
                        <Text className="text-gray-400 mt-3">No groups found</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

export default GroupsScreen;
