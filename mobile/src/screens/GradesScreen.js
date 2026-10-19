import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Card, EmptyState, Field, Loading, Notice, Screen } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

export default function GradesScreen() {
  const { user } = useAuth();
  const canAdd = user && (user.role === 'admin' || user.role === 'user');
  const [grades, setGrades] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', classId: '', assessment: '', score: '', maxScore: '', gradeDate: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const load = useCallback(async () => {
    setError('');
    try {
      const [gradesData, studentsData, classesData] = await Promise.all([
        api('/api/school/grades'),
        api('/api/school/students'),
        api('/api/school/classes')
      ]);
      setGrades(gradesData.grades || []);
      setStudents(studentsData.students || []);
      setClasses(classesData.classes || []);
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

  const filtered = useMemo(
    () =>
      grades.filter((item) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return `${item.first_name} ${item.last_name} ${item.class_name} ${item.subject} ${item.assessment}`.toLowerCase().includes(needle);
      }),
    [grades, query]
  );

  async function saveGrade() {
    setError('');
    setBusy(true);
    try {
      await api('/api/school/grades', {
        method: 'POST',
        body: {
          studentId: Number(form.studentId),
          classId: Number(form.classId),
          assessment: form.assessment.trim(),
          score: Number(form.score),
          maxScore: Number(form.maxScore),
          gradeDate: form.gradeDate
        }
      });
      setShowForm(false);
      setForm({ studentId: '', classId: '', assessment: '', score: '', maxScore: '', gradeDate: new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(grade) {
    Alert.alert('Delete grade', 'Remove this grade record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/school/grades/${grade.id}`, { method: 'DELETE' });
            load();
          } catch (err) {
            Alert.alert('Could not delete', err.message);
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
      <PageHeader title="Grades" description={`${grades.length} records`} />
      <Field value={query} onChangeText={setQuery} placeholder="Search student, class, or assessment" autoCapitalize="none" />
      <Notice message={error} />
      {canAdd ? (
        <Btn title={showForm ? 'Close form' : 'Add grade'} variant={showForm ? 'secondary' : 'primary'} onPress={() => setShowForm((v) => !v)} />
      ) : null}

      {showForm && canAdd ? (
        <Card style={styles.form}>
          <Text style={styles.formTitle}>New grade</Text>
          <Field label="Assessment" value={form.assessment} onChangeText={set('assessment')} placeholder="Reading check" />
          <Field label="Score" value={form.score} onChangeText={set('score')} placeholder="9.5" keyboardType="numeric" />
          <Field label="Max score" value={form.maxScore} onChangeText={set('maxScore')} placeholder="10" keyboardType="numeric" />
          <Field label="Date (YYYY-MM-DD)" value={form.gradeDate} onChangeText={set('gradeDate')} placeholder="2026-10-19" autoCapitalize="none" />
          <Field label="Student ID" value={form.studentId} onChangeText={set('studentId')} placeholder="e.g. 1" keyboardType="number-pad" />
          <Field label="Class ID" value={form.classId} onChangeText={set('classId')} placeholder="e.g. 1" keyboardType="number-pad" />
          <Btn title="Save" onPress={saveGrade} loading={busy} />
        </Card>
      ) : null}

      {loading ? <Loading /> : null}
      {!loading && !filtered.length ? <EmptyState title="No grades found" hint="Add a grade record." /> : null}
      {filtered.map((grade) => (
        <Card key={grade.id}>
          <View style={styles.gradeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {grade.last_name}, {grade.first_name}
              </Text>
              <Text style={styles.meta}>
                {grade.student_number} · {grade.class_name} ({grade.subject}) · {grade.assessment}
              </Text>
              <Text style={styles.meta}>{grade.grade_date}</Text>
            </View>
            <View style={styles.score}>
              <Text style={styles.scoreText}>{grade.score}/{grade.max_score}</Text>
            </View>
          </View>
          {user && user.role === 'admin' ? (
            <Btn title="Delete" variant="danger" onPress={() => confirmDelete(grade)} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  form: { gap: 10 },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.forest },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  score: { backgroundColor: colors.forest, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  scoreText: { color: colors.lime, fontWeight: '800', fontSize: 16 }
});
