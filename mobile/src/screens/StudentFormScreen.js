import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Btn, Card, Field, Loading, Notice, Screen } from '../components';
import { colors } from '../theme';

export default function StudentFormScreen({ route, navigation }) {
  const existing = route.params && route.params.student;
  const [form, setForm] = useState({
    studentNumber: existing ? existing.student_number : '',
    firstName: existing ? existing.first_name : '',
    lastName: existing ? existing.last_name : '',
    email: existing ? existing.email || '' : '',
    gradeLevel: existing ? String(existing.grade_level) : '',
    homeroomId: existing && existing.homeroom_id ? String(existing.homeroom_id) : ''
  });
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    api('/api/school/classes')
      .then((data) => setClasses(data.classes || []))
      .catch(() => setClasses([]));
  }, []);

  const save = useCallback(async () => {
    setError('');
    setBusy(true);
    const payload = {
      studentNumber: form.studentNumber.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      gradeLevel: Number(form.gradeLevel),
      homeroomId: form.homeroomId ? Number(form.homeroomId) : null
    };
    try {
      if (existing) {
        await api(`/api/school/students/${existing.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/school/students', { method: 'POST', body: payload });
      }
      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [form, existing, navigation]);

  return (
    <Screen contentStyle={styles.content}>
      <Card>
        <Field label="Student number" value={form.studentNumber} onChangeText={set('studentNumber')} placeholder="STU-1001" autoCapitalize="characters" />
        <Field label="First name" value={form.firstName} onChangeText={set('firstName')} placeholder="First name" />
        <Field label="Last name" value={form.lastName} onChangeText={set('lastName')} placeholder="Last name" />
        <Field label="Email (optional)" value={form.email} onChangeText={set('email')} placeholder="student@school.edu" keyboardType="email-address" autoCapitalize="none" />
        <Field label="Grade level (1-12)" value={form.gradeLevel} onChangeText={set('gradeLevel')} placeholder="5" keyboardType="number-pad" />
        <View style={styles.picker}>
          <Text style={styles.pickerLabel}>Homeroom</Text>
          <View style={styles.chips}>
            <Chip label="None" active={!form.homeroomId} onPress={() => set('homeroomId')('')} />
            {classes.map((item) => (
              <Chip
                key={item.id}
                label={`${item.name} (G${item.grade_level})`}
                active={String(item.id) === form.homeroomId}
                onPress={() => set('homeroomId')(String(item.id))}
              />
            ))}
          </View>
        </View>
      </Card>
      <Notice message={error} />
      <Btn title={existing ? 'Save changes' : 'Add student'} onPress={save} loading={busy} />
      <Btn title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  picker: { gap: 6 },
  pickerLabel: { fontSize: 13, fontWeight: '700', color: colors.forest },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { fontSize: 13, color: colors.forest, fontWeight: '600' },
  chipTextActive: { color: colors.lime }
});
