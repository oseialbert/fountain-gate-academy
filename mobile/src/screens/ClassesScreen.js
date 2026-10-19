import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, EmptyState, Field, Loading, Notice, Screen } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

export default function ClassesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const isAdminOrStaff = user && (user.role === 'admin' || user.role === 'user');
  const [classes, setClasses] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api('/api/school/classes');
      setClasses(data.classes || []);
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

  function confirmDelete(item) {
    Alert.alert('Remove class', `Delete ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/school/classes/${item.id}`, { method: 'DELETE' });
            load();
          } catch (err) {
            Alert.alert('Could not delete', err.message);
          }
        }
      }
    ]);
  }

  const filtered = classes.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.name} ${item.subject} ${item.teacher_name}`.toLowerCase().includes(needle);
  });

  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.forest} />}
    >
      <PageHeader title="Classes" description={`${classes.length} classes`} />
      <Field value={query} onChangeText={setQuery} placeholder="Search class, subject, or teacher" autoCapitalize="none" />
      <Notice message={error} />
      {isAdminOrStaff ? <Btn title="Add class" onPress={() => navigation.navigate('ClassForm', {})} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !filtered.length ? <EmptyState title="No classes found" hint="Add a class to get started." /> : null}
      {filtered.map((item) => (
        <Pressable
          key={item.id}
          onLongPress={() => confirmDelete(item)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.subject} · Grade {item.grade_level} · {item.room || 'No room'} · {item.teacher_name}
              {item.student_count ? ` · ${item.student_count} students` : ''}
            </Text>
          </View>
        </Pressable>
      ))}
      {isAdminOrStaff ? <Text style={styles.hint}>Long press to remove a class.</Text> : null}
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
    gap: 6
  },
  rowPressed: { opacity: 0.7 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 19 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }
});
