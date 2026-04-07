import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@/components/icons';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface DatePickerModalProps {
  visible: boolean;
  value: Date | null;
  minDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  title?: string;
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const DatePickerModal = ({
  visible,
  value,
  minDate,
  onConfirm,
  onCancel,
  title = 'Select Date',
}: DatePickerModalProps) => {
  const today = new Date();
  const todayStartTs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const minDateTs = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime()
    : null;
  const valueTs = value ? new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime() : null;

  const initial = (() => {
    const base = valueTs ?? todayStartTs;
    if (minDateTs !== null && base < minDateTs) {
      return new Date(minDateTs);
    }
    return new Date(base);
  })();

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState<Date>(initial);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const baseTs = valueTs ?? todayStartTs;
    const nextTs = minDateTs !== null && baseTs < minDateTs ? minDateTs : baseTs;
    const nextSelected = new Date(nextTs);

    setSelected((prev) => {
      if (prev.getTime() === nextSelected.getTime()) return prev;
      return nextSelected;
    });
    setViewYear((prev) => (prev === nextSelected.getFullYear() ? prev : nextSelected.getFullYear()));
    setViewMonth((prev) => (prev === nextSelected.getMonth() ? prev : nextSelected.getMonth()));
    setShowYearPicker(false);
  }, [minDateTs, todayStartTs, valueTs, visible]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const handleDayPress = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (minDateTs !== null && date.getTime() < minDateTs) return;
    setSelected(date);
  };

  const isDisabled = (day: number) => {
    if (minDateTs === null) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d.getTime() < minDateTs;
  };

  const yearRange = Array.from({ length: 10 }, (_, i) => today.getFullYear() - 1 + i);

  // Build calendar grid
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
        <View
          className="w-full overflow-hidden rounded-3xl"
          style={{
            backgroundColor: '#131C27',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            maxWidth: 360,
          }}>
          {/* Header */}
          <View
            className="px-5 pb-3 pt-5"
            style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
            <Text className="mb-1 text-xs uppercase tracking-wider text-gray-500">{title}</Text>
            <Text className="text-2xl font-bold text-white">
              {MONTHS[selected.getMonth()].slice(0, 3)} {selected.getDate()},{' '}
              {selected.getFullYear()}
            </Text>
          </View>

          {/* Month nav */}
          <View className="flex-row items-center justify-between px-4 py-3">
            <TouchableOpacity
              onPress={prevMonth}
              className="h-8 w-8 rotate-180 transform items-center justify-center rounded-xl"
              style={{ backgroundColor: '#1A2332' }}>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowYearPicker((v) => !v)}
              className="flex-row items-center gap-1">
              <Text className="text-sm font-bold text-white">
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Feather
                name={showYearPicker ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#A78BFA"
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={nextMonth}
              className="h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#1A2332' }}>
              <Feather name="chevron-right" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Year picker dropdown */}
          {showYearPicker && (
            <View
              className="mx-4 mb-2 overflow-hidden rounded-2xl"
              style={{ backgroundColor: '#1A2332' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-2 py-2">
                {yearRange.map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    onPress={() => {
                      setViewYear(yr);
                      setShowYearPicker(false);
                    }}
                    className="mx-1 items-center justify-center rounded-xl px-3 py-2"
                    style={{
                      backgroundColor: yr === viewYear ? '#7C3AED' : 'transparent',
                    }}>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: yr === viewYear ? '#fff' : '#94A3B8' }}>
                      {yr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Day-of-week headers */}
          <View className="flex-row px-3">
            {DAYS_OF_WEEK.map((d) => (
              <View key={d} className="flex-1 items-center py-1">
                <Text className="text-[11px] font-semibold text-gray-500">{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View className="px-3 pb-2">
            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} className="flex-row">
                {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                  if (!day) return <View key={col} className="flex-1 py-1" />;

                  const dayDate = new Date(viewYear, viewMonth, day);
                  const isSelected = isSameDay(dayDate, selected);
                  const isToday = isSameDay(dayDate, today);
                  const disabled = isDisabled(day);

                  return (
                    <TouchableOpacity
                      key={col}
                      onPress={() => handleDayPress(day)}
                      disabled={disabled}
                      activeOpacity={0.7}
                      className="flex-1 items-center py-1">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: isSelected ? '#7C3AED' : 'transparent',
                          borderWidth: isToday && !isSelected ? 1 : 0,
                          borderColor: '#7C3AED',
                        }}>
                        <Text
                          className="text-sm font-semibold"
                          style={{
                            color: disabled
                              ? '#334155'
                              : isSelected
                                ? '#fff'
                                : isToday
                                  ? '#A78BFA'
                                  : '#E2E8F0',
                          }}>
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Footer buttons */}
          <View
            className="flex-row gap-3 px-4 pb-5 pt-3"
            style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.7}
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: '#1A2332' }}>
              <Text className="text-sm font-semibold text-gray-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (minDateTs !== null && selected.getTime() < minDateTs) {
                  return;
                }
                onConfirm(selected);
              }}
              activeOpacity={0.8}
              className="flex-1 items-center rounded-xl bg-[#7C3AED] py-3">
              <Text className="text-sm font-bold text-white">Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DatePickerModal;
