import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Card, EmptyState, Field, Loading, Notice, Screen, Segmented } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

export default function AdminScreen() {
  const { user, refresh } = useAuth();
  const isAdmin = user && user.role === 'admin';
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api('/api/admin/users');
      setUsers(data.users || []);
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

  async function createAccount() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api('/api/admin/accounts', { method: 'POST', body: { email: email.trim(), password, role } });
      setMessage('Account created. Share the temporary password securely.');
      setEmail('');
      setPassword('');
      setRole('user');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(account) {
    const isSelf = user && String(user.id) === String(account.id);
    Alert.alert(
      'Delete account',
      `Delete ${account.email}? They will lose access immediately. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setMessage('');
            try {
              await api(`/api/admin/users/${account.id}`, { method: 'DELETE', body: {} });
              setMessage('Account deleted.');
              if (isSelf) refresh();
              else load();
            } catch (err) {
              Alert.alert('Could not delete', err.message);
            }
          }
        }
      ]
    );
  }

  return (
    <Screen
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.forest} />}
    >
      <PageHeader title="Account management" description={`${users.length} accounts`} />
      <Notice message={error} type="error" />
      <Notice message={message} type="success" />
      {!isAdmin ? (
        <EmptyState title="Administrator access required" hint="Only administrators can manage accounts." />
      ) : (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Create an account</Text>
            <Text style={styles.hint}>Create staff/teacher accounts or another administrator. Share the temporary password securely.</Text>
            <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="name@school.org" />
            <Field label="Temporary password (min 12 chars)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <Segmented
              options={[{ value: 'user', label: 'Staff / teacher' }, { value: 'admin', label: 'Administrator' }]}
              value={role}
              onChange={setRole}
            />
            <Btn title="Create account" onPress={createAccount} loading={busy} />
          </Card>
          {loading ? <Loading /> : null}
          {!loading && !users.length ? <EmptyState title="No accounts yet" hint="Create the first account above." /> : null}
          {users.map((account) => (
            <Pressable
              key={account.id}
              onLongPress={() => confirmDelete(account)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{account.email}</Text>
                <Text style={styles.meta}>
                  {account.role === 'admin' ? 'Administrator' : 'Staff / teacher'} · 2FA {account.totp_enabled ? 'on' : 'off'} · joined {new Date(account.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Btn title="Delete" variant="danger" onPress={() => confirmDelete(account)} style={styles.deleteBtn} />
            </Pressable>
          ))}
          {users.length ? <Text style={styles.hint}>Tap Delete to remove an account. Only administrators can delete accounts.</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.forest, marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
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
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 3 },
  deleteBtn: { minHeight: 40, paddingHorizontal: 14 }
});
