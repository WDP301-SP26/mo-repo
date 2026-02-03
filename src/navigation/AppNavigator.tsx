import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LinkThirdPartyScreen from '../screens/auth/LinkThirdPartyScreen';
import MainTabNavigator from './MainTabNavigator';

export type RootStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    MainTabs: undefined;
    LinkThirdParty: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <Stack.Navigator
            initialRouteName="SignIn"
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            {/* Auth Flow */}
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="LinkThirdParty" component={LinkThirdPartyScreen} />

            {/* Main App with Bottom Tabs */}
            <Stack.Screen
                name="MainTabs"
                component={MainTabNavigator}
                options={{
                    animation: 'fade',
                }}
            />
        </Stack.Navigator>
    );
}