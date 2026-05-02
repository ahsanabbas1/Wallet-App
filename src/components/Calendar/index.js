import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MiniCalendar = ({ selectedDate, onSelectDate }) => {
  const { colors: COLORS } = useTheme();
  const [viewDate, setViewDate] = useState(parseLocalDate(selectedDate));
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
  
  const month = viewDate.getMonth();
  const year = viewDate.getFullYear();
  const days = daysInMonth(month, year);
  const firstDay = firstDayOfMonth(month, year);
  
  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= days; i++) calendarDays.push(i);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handleSelectDate = (day) => {
    const newDate = new Date(year, month, day);
    onSelectDate(formatLocalDate(newDate));
  };

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={() => setViewDate(new Date(year, month - 1, 1))}>
          <ChevronLeft color={COLORS.text} size={20} />
        </Pressable>
        <Text style={styles.calendarTitle}>{monthNames[month]} {year}</Text>
        <Pressable onPress={() => setViewDate(new Date(year, month + 1, 1))}>
          <ChevronRight color={COLORS.text} size={20} />
        </Pressable>
      </View>
      <View style={styles.calendarGrid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
          <Text key={idx} style={styles.calendarDayHeader}>{d}</Text>
        ))}
        {calendarDays.map((d, index) => {
          const isSelected = d && d.toString() === selectedDate.split('-')[2] && 
                            parseInt(selectedDate.split('-')[1]) === month + 1 &&
                            parseInt(selectedDate.split('-')[0]) === year;
          
          return (
            <Pressable 
              key={index} 
              onPress={() => d && handleSelectDate(d)}
              style={[
                styles.calendarDay, 
                isSelected && styles.calendarDaySelected
              ]}
            >
              <Text style={[styles.calendarDayText, !d && { opacity: 0 }]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (COLORS) => StyleSheet.create({
  calendarContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calendarTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayHeader: {
    width: (width - 100) / 7,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 10,
  },
  calendarDay: {
    width: (width - 100) / 7,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  calendarDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calendarDayText: {
    color: COLORS.text,
    fontSize: 12,
  },
});

export default MiniCalendar;
