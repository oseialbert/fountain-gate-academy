import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Card, EmptyState, Field, Loading, Notice, Screen, Tag } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

const statusOptions = ['present', 'absent', 'late', 'excused'];

const statusColors = { present: '#2f8f5b', absent: '#c0392b', late: '#d98a1f', excused: '#4a6fa5' };

export default function AttendanceScreen() {
  const { user } = useAuth();
  const canMark = user && (user.role === 'admin' || user.role === 'user');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api(`/api/school/attendance?date=${encodeURIComponent(date)}`);
      setRecords(data.attendance || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      records.filter((item) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return `${item.first_name} ${item.last_name} ${item.student_number}`.toLowerCase().includes(needle);
      }),
    [records, query]
  );

  function markStatus(item, status) {
    Alert.alert('Mark attendance', `Set ${item.first_name} ${item.last_name} to ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: 'default',
        onPress: async () => {
          try {
            await api(`/api/school/attendance/${item.student_id}`, {
              method: 'POST',
              body: { date, status, note: item.note || '' }
            });
            load();
          } catch (err) {
            Alert.alert('Could not save', err.message);
          }
        }
      }
    ]);
  }

  function deleteRecord(item) {
    Alert.alert('Clear record', `Remove attendance for ${item.first_name} ${item.last_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/school/attendance/${item.student_id}`, { method: 'DELETE', body: { date } });
            load();
          } catch (err) {
            Alert.alert('Could not clear', err.message);
          }
        }
      }
    ]);
  }

  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.forest} />}
    >
      <PageHeader title="Attendance" description={`Date: ${date}`} />
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-10-19" autoCapitalize="none" />
      <Field value={query} onChangeText={setQuery} placeholder="Search name or student number" autoCapitalize="none" />
      <Notice message={error} />
      <Btn title="Refresh" variant="secondary" onPress={load} />
      {loading ? <Loading /> : null}
      {!loading && !filtered.length ? <EmptyState title="No students to show" hint="Add students or adjust the date." /> : null}
      {filtered.map((item) => (
        <Card key={item.student_id} style={styles.record}>
          <View style={styles.recordHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {item.last_name}, {item.first_name}
              </Text>
              <Text style={styles.meta}>
                {item.student_number} · Grade {item.grade_level}
              </Text>
            </View>
            <Tag text={item.status || 'unmarked'} color={item.status ? statusColors[item.status] : colors.muted} />
          </View>
          {canMark ? (
            <View style={styles.actions}>
              {statusOptions.map((status) => (
                <Pressable key={status} onPress={() => markStatus(item, status)} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{status}</Text>
                </Pressable>
              ))}
              {item.status ? (
                <Pressable onPress={() => deleteRecord(item)} style={[styles.actionBtn, styles.actionGhost]}>
                  <Text style={[styles.actionText, { color: colors.muted }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  record: { gap: 10 },
  recordHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  actionGhost: { backgroundColor: 'transparent' },
  actionText: { fontSize: 13, color: colors.forest, fontWeight: '700', textTransform: 'capitalize' }
});
