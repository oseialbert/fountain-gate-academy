import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { api } from '../api';
import { Btn, Card, Field, Notice, Screen } from '../components';

export default function ClassFormScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', subject: '', gradeLevel: '', teacherName: '', room: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const save = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      await api('/api/school/classes', {
        method: 'POST',
        body: {
          name: form.name.trim(),
          subject: form.subject.trim(),
          gradeLevel: Number(form.gradeLevel),
          teacherName: form.teacherName.trim(),
          room: form.room.trim()
        }
      });
      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [form, navigation]);

  return (
    <Screen contentStyle={styles.content}>
      <Card>
        <Field label="Class name" value={form.name} onChangeText={set('name')} placeholder="English 5A" />
        <Field label="Subject" value={form.subject} onChangeText={set('subject')} placeholder="English" />
        <Field label="Grade level (1-12)" value={form.gradeLevel} onChangeText={set('gradeLevel')} placeholder="5" keyboardType="number-pad" />
        <Field label="Teacher" value={form.teacherName} onChangeText={set('teacherName')} placeholder="Teacher name" />
        <Field label="Room" value={form.room} onChangeText={set('room')} placeholder="Room" />
      </Card>
      <Notice message={error} />
      <Btn title="Add class" onPress={save} loading={busy} />
      <Btn title="Cancel" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: 14 } });
