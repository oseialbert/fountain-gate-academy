import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Card, EmptyState, Field, Loading, Notice, Screen } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

export default function StudentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const isAdmin = user && user.role === 'admin';
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api('/api/school/students');
      setStudents(data.students || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDelete(student) {
    Alert.alert('Remove student', `Delete ${student.first_name} ${student.last_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/school/students/${student.id}`, { method: 'DELETE' });
            load();
          } catch (err) {
            Alert.alert('Could not delete', err.message);
          }
        }
      }
    ]);
  }

  const filtered = students.filter((student) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${student.first_name} ${student.last_name} ${student.student_number}`.toLowerCase().includes(needle);
  });

  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.forest} />
      }
    >
      <PageHeader title="Students" description={`${students.length} enrolled`} />
      <Field value={query} onChangeText={setQuery} placeholder="Search name or student number" autoCapitalize="none" />
      <Notice message={error} />
      {isAdmin ? <Btn title="Add student" onPress={() => navigation.navigate('StudentForm', {})} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !filtered.length ? <EmptyState title="No students found" hint="Adjust your search or add a student." /> : null}
      {filtered.map((student) => (
        <Pressable
          key={student.id}
          onPress={() => {
            if (isAdmin) navigation.navigate('StudentForm', { student });
            else Alert.alert(`${student.first_name} ${student.last_name}`, `Student number: ${student.student_number}\nGrade: ${student.grade_level}\nHomeroom: ${student.homeroom || 'Not assigned'}`);
          }}
          onLongPress={() => confirmDelete(student)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {student.last_name}, {student.first_name}
            </Text>
            <Text style={styles.meta}>
              {student.student_number} · Grade {student.grade_level}
              {student.homeroom ? ` · ${student.homeroom}` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>{isAdmin ? '›' : ''}</Text>
        </Pressable>
      ))}
      <Text style={styles.hint}>{isAdmin ? 'Tap to edit. Long press to remove.' : 'Administrators can edit student records.'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  row: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  rowPressed: { opacity: 0.7 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  chevron: { fontSize: 22, color: colors.muted, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }
});
