import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardScreen from '@/screens/main/DashboardScreen';
import GroupsScreen from '@/screens/main/GroupsScreen';
import TasksScreen from '@/screens/main/TasksScreen';
import NewsfeedScreen from '@/screens/main/NewsfeedScreen';
import SettingsScreen from '@/screens/main/SettingsScreen';

export type MainTabParamList = {
    Dashboard: undefined;
    Groups: undefined;
    Tasks: undefined;
    Newsfeed: undefined;
    Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TABS = [
    { key: 'Dashboard', icon: 'home', label: 'Home' },
    { key: 'Groups', icon: 'users', label: 'Groups' },
    { key: 'Tasks', icon: 'check-square', label: 'Tasks' },
    { key: 'Newsfeed', icon: 'message-square', label: 'Feed' },
    { key: 'Settings', icon: 'settings', label: 'Settings' },
];

const TabItem = ({ route, isFocused, onPress }: { route: any; isFocused: boolean; onPress: () => void }) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const tab = TABS.find((t) => t.key === route.name);

    React.useEffect(() => {
        Animated.spring(scale, {
            toValue: isFocused ? 1.1 : 1,
            friction: 5,
            useNativeDriver: true,
        }).start();
    }, [isFocused]);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            className="flex-1 items-center justify-center py-2"
        >
            <Animated.View style={{ transform: [{ scale }] }} className="items-center">
                <View className={`w-11 h-11 rounded-2xl items-center justify-center mb-1 ${isFocused ? 'bg-[#7C3AED]' : 'bg-transparent'}`}>
                    <Feather name={tab?.icon as any} size={20} color={isFocused ? '#fff' : '#64748B'} />
                </View>
                <Text className={`text-[10px] font-medium ${isFocused ? 'text-[#7C3AED]' : 'text-[#64748B]'}`}>
                    {tab?.label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

const CustomTabBar = ({ state, navigation }: { state: any; navigation: any }) => {
    const insets = useSafeAreaInsets();

    return (
        <View
            className="absolute bottom-0 left-0 right-0 bg-[#1A2332] border-t border-[#334155]"
            style={{ paddingBottom: insets.bottom || 8 }}
        >
            {/* Tab Items */}
            <View className="flex-row pt-2 pb-1">
                {state.routes.map((route: any, index: number) => {
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return <TabItem key={route.key} route={route} isFocused={isFocused} onPress={onPress} />;
                })}
            </View>
        </View>
    );
};

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <CustomTabBar {...props} />}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Groups" component={GroupsScreen} />
            <Tab.Screen name="Tasks" component={TasksScreen} />
            <Tab.Screen name="Newsfeed" component={NewsfeedScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

export default MainTabNavigator;
