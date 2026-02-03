import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    StatusBar,
    RefreshControl,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';

// Mock data
const MOCK_POSTS = [
    {
        id: 1,
        type: 'meeting',
        author: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Leader' },
        content: 'Team Meeting tomorrow at 10:00 AM\nAgenda: Sprint planning and task allocation for next week.',
        meetingTime: '2026-02-04 10:00',
        createdAt: '2026-02-03 09:30',
        reactions: 5,
        comments: 3,
    },
    {
        id: 2,
        type: 'announcement',
        author: { name: 'Dr. Tran Thi B', avatar: 'https://i.pravatar.cc/150?img=10', role: 'Instructor' },
        content: 'Great progress on the project! Keep up the good work. Remember to submit the SRS document by Friday.',
        createdAt: '2026-02-02 14:00',
        reactions: 12,
        comments: 7,
    },
    {
        id: 3,
        type: 'update',
        author: { name: 'Tran Van C', avatar: 'https://i.pravatar.cc/150?img=3', role: 'Member' },
        content: 'Just finished implementing the login feature. Ready for code review!\n\nPR: #42 - User Authentication',
        createdAt: '2026-02-02 11:45',
        reactions: 8,
        comments: 2,
    },
    {
        id: 4,
        type: 'meeting',
        author: { name: 'Nguyen Van A', avatar: 'https://i.pravatar.cc/150?img=1', role: 'Leader' },
        content: 'Daily Standup - Quick sync on blockers and progress.',
        meetingTime: '2026-02-03 08:30',
        createdAt: '2026-02-01 18:00',
        reactions: 3,
        comments: 1,
    },
];

const NewsfeedScreen = () => {
    const [refreshing, setRefreshing] = useState(false);
    const [likedPosts, setLikedPosts] = useState<number[]>([]);

    const onRefresh = async () => {
        setRefreshing(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setRefreshing(false);
    };

    const toggleLike = (postId: number) => {
        if (likedPosts.includes(postId)) {
            setLikedPosts(likedPosts.filter((id) => id !== postId));
        } else {
            setLikedPosts([...likedPosts, postId]);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        return `${diffDays}d`;
    };

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'meeting': return { icon: 'event', label: 'Meeting', color: '#06B6D4', bg: 'bg-cyan-500' };
            case 'announcement': return { icon: 'campaign', label: 'Announcement', color: '#F97316', bg: 'bg-orange-500' };
            default: return { icon: 'update', label: 'Update', color: '#22C55E', bg: 'bg-green-500' };
        }
    };

    const LikeButton = ({ postId, count }: { postId: number; count: number }) => {
        const isLiked = likedPosts.includes(postId);
        const scale = useRef(new Animated.Value(1)).current;

        const handlePress = () => {
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]).start();
            toggleLike(postId);
        };

        return (
            <TouchableOpacity onPress={handlePress} className="flex-row items-center gap-1.5">
                <Animated.View style={{ transform: [{ scale }] }}>
                    {isLiked ? (
                        <MaterialIcons name="favorite" size={20} color="#EF4444" />
                    ) : (
                        <MaterialIcons name="favorite-border" size={20} color="#64748B" />
                    )}
                </Animated.View>
                <Text className={`text-sm font-medium ${isLiked ? 'text-red-400' : 'text-gray-500'}`}>
                    {count + (isLiked ? 1 : 0)}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderPost = ({ item }: { item: typeof MOCK_POSTS[0] }) => {
        const config = getTypeConfig(item.type);

        return (
            <View className="bg-[#1A2332] rounded-2xl p-4 mb-3 border border-[#334155]">
                {/* Header */}
                <View className="flex-row items-center">
                    <View className="relative">
                        <Image
                            source={{ uri: item.author.avatar }}
                            className={`w-11 h-11 rounded-full border-2 ${item.author.role === 'Leader' ? 'border-[#7C3AED]' :
                                    item.author.role === 'Instructor' ? 'border-orange-500' : 'border-[#334155]'
                                }`}
                        />
                        {item.author.role !== 'Member' && (
                            <View className={`absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full items-center justify-center border-2 border-[#1A2332] ${item.author.role === 'Leader' ? 'bg-[#7C3AED]' : 'bg-orange-500'
                                }`}>
                                {item.author.role === 'Leader' ? (
                                    <MaterialIcons name="star" size={10} color="#fff" />
                                ) : (
                                    <MaterialIcons name="school" size={10} color="#fff" />
                                )}
                            </View>
                        )}
                    </View>
                    <View className="flex-1 ml-3">
                        <Text className="text-white text-base font-semibold">{item.author.name}</Text>
                        <View className="flex-row items-center gap-1.5 mt-0.5">
                            <Text className="text-gray-500 text-xs">{item.author.role}</Text>
                            <Text className="text-gray-500 text-[10px]">•</Text>
                            <Text className="text-gray-500 text-xs">{formatTime(item.createdAt)}</Text>
                        </View>
                    </View>
                    <View className={`px-2.5 py-1 rounded-lg flex-row items-center gap-1 ${config.bg}`}>
                        <MaterialIcons name={config.icon as any} size={12} color="#fff" />
                        <Text className="text-white text-[10px] font-semibold">{config.label}</Text>
                    </View>
                </View>

                {/* Content */}
                <Text className="text-white text-sm leading-6 mt-3">{item.content}</Text>

                {/* Meeting Card */}
                {item.type === 'meeting' && item.meetingTime && (
                    <View className="bg-cyan-500/10 rounded-xl p-3 mt-3 flex-row items-center gap-3 border border-cyan-500/20">
                        <View className="w-10 h-10 rounded-xl bg-cyan-500/20 items-center justify-center">
                            <MaterialIcons name="event" size={20} color="#06B6D4" />
                        </View>
                        <View>
                            <Text className="text-cyan-400 text-sm font-semibold">
                                {new Date(item.meetingTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            <Text className="text-cyan-300 text-xs">
                                {new Date(item.meetingTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View className="flex-row items-center gap-6 mt-4 pt-3 border-t border-[#334155]">
                    <LikeButton postId={item.id} count={item.reactions} />
                    <TouchableOpacity className="flex-row items-center gap-1.5">
                        <Feather name="message-circle" size={18} color="#64748B" />
                        <Text className="text-gray-500 text-sm font-medium">{item.comments}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Feather name="share-2" size={18} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor="#101922" />

            {/* Header */}
            <View className="px-4 py-3">
                <Text className="text-white text-2xl font-bold">Newsfeed</Text>
                <Text className="text-gray-400 text-sm mt-0.5">Stay updated with your team</Text>
            </View>

            {/* Posts */}
            <FlatList
                data={MOCK_POSTS}
                renderItem={renderPost}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" colors={['#7C3AED']} />}
            />

            {/* FAB */}
            <TouchableOpacity className="absolute bottom-24 right-5 w-14 h-14 rounded-full bg-[#7C3AED] items-center justify-center shadow-lg" activeOpacity={0.9}>
                <Feather name="edit-3" size={22} color="#fff" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default NewsfeedScreen;
