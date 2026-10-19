import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Card, EmptyState, Loading, Notice, Screen, Tag } from '../components';
import { PageHeader, StatCard } from '../ui';
import { colors } from '../theme';

const statusColors = { present: '#2f8f5b', absent: '#c0392b', late: '#d98a1f', excused: '#4a6fa5' };

export default function DashboardScreen() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api('/api/school/overview');
      setOverview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const counts = overview ? overview.counts : { students: 0, classes: 0, attendance: 0, grades: 0 };
  const recent = overview && overview.recent ? overview.recent : [];

  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest} />}
    >
      <PageHeader
        title={`Hello, ${user ? user.email.split('@')[0] : 'there'}`}
        description={`Signed in with ${user ? user.role : 'staff'} access. Here is the school snapshot.`}
      />
      <Notice message={error} />
      {loading ? <Loading /> : null}

      <View style={styles.stats}>
        <StatCard label="Students" value={counts.students} />
        <StatCard label="Classes" value={counts.classes} />
        <StatCard label="Attendance records" value={counts.attendance} />
        <StatCard label="Grades recorded" value={counts.grades} />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Recent attendance</Text>
        {recent.length ? (
          recent.map((row, index) => (
            <View key={`${row.student_number}-${row.attendance_date}-${index}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {row.first_name} {row.last_name}
                </Text>
                <Text style={styles.date}>
                  {row.attendance_date} · {row.student_number}
                </Text>
              </View>
              <Tag text={row.status} color={statusColors[row.status] || colors.forest} />
            </View>
          ))
        ) : (
          <EmptyState title="No attendance yet" hint="Mark attendance from the Attendance tab." />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.forest, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  date: { fontSize: 13, color: colors.muted, marginTop: 2 }
});
