import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  InteractionManager,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@/components/icons';
import { MaterialIcons } from '@/components/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getAllClasses, getMyClasses, joinClass } from '@/services/classService';
import { getCurrentSemester, type SerializedSemester } from '@/services/semesterService';
import { showError, showInfo, showSuccess } from '@/utils/toast';
import type { ClassItem, ClassStatus } from '@/types/class';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { enrollmentKeySchema, getZodErrorMessage } from '@/utils/validation/formSchemas';

// ==================== Constants ====================

const TAB_BAR_HEIGHT = 80;

const STATUS_CONFIG: Record<ClassStatus, { label: string; color: string; bg: string }> = {
  ONGOING: { label: 'Ongoing', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  COMPLETED: { label: 'Completed', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  ARCHIVED: { label: 'Archived', color: '#EAB308', bg: 'rgba(234,179,8,0.15)' },
};

// ==================== Memoized Components ====================

const MyClassCard = React.memo(
  ({
    item,
    onPress,
    interactionDisabled,
  }: {
    item: ClassItem;
    onPress: (id: string, lecturerId: string) => void;
    interactionDisabled: boolean;
  }) => {
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ONGOING;
    const badgeLabel =
      item.status === 'ONGOING' ? (interactionDisabled ? 'Upcoming' : 'Ongoing') : statusCfg.label;
    const badgeColor = item.status === 'ONGOING' && interactionDisabled ? '#F59E0B' : statusCfg.color;
    const badgeBg =
      item.status === 'ONGOING' && interactionDisabled ? 'rgba(245,158,11,0.2)' : statusCfg.bg;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(item.id, item.lecturer_id)}
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="mb-1.5 flex-row items-center gap-2">
              <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: badgeBg }}>
                <Text className="text-[10px] font-semibold" style={{ color: badgeColor }}>
                  {badgeLabel}
                </Text>
              </View>
              {item.semester && <Text className="text-xs text-gray-500">{item.semester}</Text>}
            </View>
            <Text className="text-lg font-bold text-white">{item.code}</Text>
            <Text className="mt-0.5 text-sm text-gray-400">{item.name}</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#475569" />
        </View>
      </TouchableOpacity>
    );
  }
);

const BrowseClassCard = React.memo(
  ({
    item,
    onJoin,
    interactionDisabled,
  }: {
    item: ClassItem;
    onJoin: (item: ClassItem) => void;
    interactionDisabled: boolean;
  }) => {
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.ONGOING;
    const badgeLabel =
      item.status === 'ONGOING' ? (interactionDisabled ? 'Upcoming' : 'Ongoing') : statusCfg.label;
    const badgeColor = item.status === 'ONGOING' && interactionDisabled ? '#F59E0B' : statusCfg.color;
    const badgeBg =
      item.status === 'ONGOING' && interactionDisabled ? 'rgba(245,158,11,0.2)' : statusCfg.bg;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onJoin(item)}
        className="mb-3 rounded-2xl bg-[#1A2332] p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="mb-1.5 flex-row items-center gap-2">
              <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: badgeBg }}>
                <Text className="text-[10px] font-semibold" style={{ color: badgeColor }}>
                  {badgeLabel}
                </Text>
              </View>
              {item.semester && <Text className="text-xs text-gray-500">{item.semester}</Text>}
            </View>
            <Text className="text-lg font-bold text-white">{item.code}</Text>
            <Text className="mt-0.5 text-sm text-gray-400">{item.name}</Text>
          </View>
        </View>

        {/* Footer */}
        <View className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-3">
          <View className="flex-row items-center gap-1.5">
            <MaterialIcons name="groups" size={16} color="#64748B" />
            <Text className="text-xs text-gray-400">
              Max {item.max_groups} groups · {item.max_students_per_group}/group
            </Text>
          </View>
          <TouchableOpacity
            disabled={interactionDisabled}
            onPress={() => onJoin(item)}
            activeOpacity={0.8}
            className={`flex-row items-center gap-1.5 rounded-xl px-4 py-2 ${
              interactionDisabled ? 'bg-[#334155]' : 'bg-[#7C3AED]'
            }`}>
            <Feather name="log-in" size={14} color="#fff" />
            <Text className="text-xs font-semibold text-white">
              {interactionDisabled ? 'Locked' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }
);

const EmptyState = React.memo(({ message }: { message: string }) => (
  <View className="items-center py-16">
    <MaterialIcons name="school" size={48} color="#64748B" />
    <Text className="mt-3 text-base text-gray-400">{message}</Text>
  </View>
));

// ==================== Main Component ====================

const ClassesScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── State ────────────────────────────────────────
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [currentSemester, setCurrentSemester] = useState<SerializedSemester | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Join modal state
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [joining, setJoining] = useState(false);

  const isMounted = useRef(true);

  const isClassInteractionLocked = useCallback(
    (classItem: ClassItem | null) => {
      if (!classItem || !currentSemester) return false;

      // Student interactions are allowed only in the current ACTIVE semester.
      if (currentSemester.status !== 'ACTIVE') return true;

      const itemSemester = classItem.semester?.trim().toUpperCase();
      const currentCode = currentSemester.code?.trim().toUpperCase();
      if (!itemSemester || !currentCode) return false;

      return itemSemester !== currentCode;
    },
    [currentSemester]
  );

  // ── Derived: filter out already-enrolled classes from browse list ──
  const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);
  const browseClasses = useMemo(
    () => allClasses.filter((c) => !myClassIds.has(c.id)),
    [allClasses, myClassIds]
  );

  // ── Fetch ────────────────────────────────────────

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const [all, mine, semester] = await Promise.all([
        getAllClasses(),
        getMyClasses(),
        getCurrentSemester().catch(() => null),
      ]);

      if (!isMounted.current) return;
      setAllClasses(all);
      setMyClasses(mine);
      setCurrentSemester(semester);
    } catch (error: any) {
      if (!isMounted.current) return;
      showError(error.response?.data?.message || 'Failed to load classes');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      const task = InteractionManager.runAfterInteractions(() => {
        fetchData();
      });
      return () => {
        isMounted.current = false;
        // Ensure modal overlay is closed when leaving this tab.
        setJoinModalVisible(false);
        task.cancel();
      };
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // ── Join Class ───────────────────────────────────

  const openJoinModal = useCallback((classItem: ClassItem) => {
    if (isClassInteractionLocked(classItem)) {
      showInfo('This class is outside the current active semester. Enrollment is read-only.');
      return;
    }

    setSelectedClass(classItem);
    setEnrollmentKey('');
    setJoinModalVisible(true);
  }, [isClassInteractionLocked]);

  const handleJoinClass = useCallback(async () => {
    if (!selectedClass) return;

    if (isClassInteractionLocked(selectedClass)) {
      showInfo('This class is outside the current active semester. Enrollment is read-only.');
      return;
    }

    const parsed = enrollmentKeySchema.safeParse({ enrollmentKey });
    if (!parsed.success) {
      showError(getZodErrorMessage(parsed.error));
      return;
    }

    try {
      setJoining(true);
      await joinClass(selectedClass.id, { enrollment_key: parsed.data.enrollmentKey });
      showSuccess(`Joined ${selectedClass.code} successfully!`, 'Enrolled 🎉');
      setJoinModalVisible(false);
      fetchData(true);
      navigation.navigate('ClassDetail', {
        classId: selectedClass.id,
        lecturerId: selectedClass.lecturer_id,
      });
    } catch (error: any) {
      showError(error.response?.data?.message || 'Failed to join class');
    } finally {
      setJoining(false);
    }
  }, [selectedClass, enrollmentKey, fetchData, navigation, isClassInteractionLocked]);

  // ── Navigation ───────────────────────────────────

  const handleClassPress = useCallback(
    (classId: string, lecturerId: string) => {
      navigation.navigate('ClassDetail', { classId, lecturerId });
    },
    [navigation]
  );

  // ── FlatList Callbacks ───────────────────────────

  const renderBrowseClass = useCallback(
    ({ item }: { item: ClassItem }) => (
      <BrowseClassCard
        item={item}
        onJoin={openJoinModal}
        interactionDisabled={isClassInteractionLocked(item)}
      />
    ),
    [openJoinModal, isClassInteractionLocked]
  );

  const hasReadOnlySemesterItems = useMemo(() => {
    if (!currentSemester) return false;
    return browseClasses.some((item) => isClassInteractionLocked(item));
  }, [browseClasses, currentSemester, isClassInteractionLocked]);

  const keyExtractor = useCallback((item: ClassItem) => item.id, []);

  // ── List Header: My Classes Section ──────────────

  const ListHeader = useMemo(() => {
    if (myClasses.length === 0) return null;

    return (
      <View className="mb-5">
        <Text className="mb-3 text-lg font-semibold text-white">My Classes</Text>
        {myClasses.map((item) => (
          <MyClassCard
            key={item.id}
            item={item}
            onPress={handleClassPress}
            interactionDisabled={isClassInteractionLocked(item)}
          />
        ))}
        <Text className="mb-2 ml-1 mt-4 text-xs font-semibold text-gray-600">BROWSE CLASSES</Text>
      </View>
    );
  }, [myClasses, handleClassPress]);

  // ── Main Render ──────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#101922]" edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#101922" />

      {/* Header */}
      <View className="px-4 py-3">
        <Text className="text-2xl font-bold text-white">Classes</Text>
        <Text className="mt-0.5 text-sm text-gray-400">
          {myClasses.length > 0
            ? `${myClasses.length} enrolled · Browse & join more`
            : 'Browse & join a class'}
        </Text>
      </View>

      {hasReadOnlySemesterItems && (
        <View className="mx-4 mb-3 mt-1 flex-row items-start gap-2 rounded-xl bg-amber-900/30 px-3 py-2.5">
          <Feather name="clock" size={14} color="#FCD34D" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-amber-300">
            Some classes are outside the current active semester. You can view them, but joining is
            disabled.
          </Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={browseClasses}
          renderItem={renderBrowseClass}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7C3AED"
              colors={['#7C3AED']}
            />
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              message={myClasses.length > 0 ? 'No more classes to join' : 'No classes available'}
            />
          }
        />
      )}

      {/* ═══════ Join Class Modal ═══════ */}
      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalVisible(false)}>
        <Pressable
          onPress={() => setJoinModalVisible(false)}
          className="flex-1 items-center justify-center bg-black/60 px-8">
          <Pressable onPress={() => {}} className="w-full rounded-2xl bg-[#1A2332] p-6">
            {/* Icon */}
            <View className="mb-4 items-center">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/20">
                <Feather name="key" size={28} color="#7C3AED" />
              </View>
            </View>

            <Text className="mb-1 text-center text-xl font-bold text-white">
              Join {selectedClass?.code}
            </Text>
            <Text className="mb-6 text-center text-sm text-gray-400">
              Enter the enrollment key provided by your lecturer
            </Text>

            {/* Input */}
            <TextInput
              value={enrollmentKey}
              onChangeText={setEnrollmentKey}
              placeholder="e.g. RANDOM-KEY-123"
              placeholderTextColor="#475569"
              autoCapitalize="characters"
              className="mb-5 h-12 rounded-xl border border-white/10 bg-[#101922] px-4 text-center font-mono text-sm tracking-widest text-white"
            />

            {/* Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setJoinModalVisible(false)}
                activeOpacity={0.8}
                className="flex-1 items-center rounded-xl bg-white/5 py-3.5">
                <Text className="font-semibold text-white">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJoinClass}
                disabled={joining || !enrollmentKey.trim()}
                activeOpacity={0.8}
                className={`flex-1 items-center rounded-xl py-3.5 ${
                  joining || !enrollmentKey.trim() ? 'bg-[#334155]' : 'bg-[#7C3AED]'
                }`}>
                {joining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default ClassesScreen;
