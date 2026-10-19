import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Card, Field, Notice, Screen } from '../components';
import { PageHeader } from '../ui';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { user, signOut, refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFa, setTwoFa] = useState(null);
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [setupShown, setSetupShown] = useState(false);

  async function changePassword() {
    setError('');
    setMessage('');
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/password', { method: 'POST', body: { currentPassword: password, newPassword } });
      setMessage('Password updated successfully.');
      setPassword('');
      setNewPassword('');
      setConfirm('');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const start2fa = useCallback(async () => {
    setError('');
    setMessage('');
    setTwoFaBusy(true);
    try {
      const data = await api('/api/2fa/setup', { method: 'POST' });
      setTwoFa(data);
      setQr(data.qrCode);
      setSetupShown(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setTwoFaBusy(false);
    }
  }, []);

  async function enable2fa() {
    setError('');
    setMessage('');
    try {
      await api('/api/2fa/enable', { method: 'POST', body: { code: code.trim() } });
      setMessage('Two-factor authentication enabled.');
      setSetupShown(false);
      setCode('');
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function disable2fa() {
    Alert.alert('Disable 2FA', 'Enter your password and current code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          Alert.prompt(
            'Password',
            'Your password',
            async (pwd) => {
              Alert.prompt(
                'Authenticator code',
                'Six-digit code',
                async (c) => {
                  try {
                    await api('/api/2fa/disable', { method: 'POST', body: { password: pwd, code: c } });
                    Alert.alert('Done', 'Two-factor authentication disabled.');
                    refresh();
                  } catch (err) {
                    Alert.alert('Error', err.message);
                  }
                },
                'plain-text',
                '',
                'numeric'
              );
            },
            'secure-text'
          );
        }
      }
    ]);
  }

  return (
    <Screen contentStyle={styles.content}>
      <PageHeader title="Account" description="Manage your session and security." />
      <Card>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.kv}>Email: {user ? user.email : '-'}</Text>
        <Text style={styles.kv}>Role: {user ? user.role : '-'}</Text>
        <Text style={styles.kv}>2FA: {user && user.totp_enabled ? 'Enabled' : 'Disabled'}</Text>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Change password</Text>
        <Field label="Current password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
        <Field label="New password (min 12 chars)" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" />
        <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
        <Notice message={error} type="error" />
        <Notice message={message} type="success" />
        <Btn title="Update password" onPress={changePassword} loading={busy} />
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Two-factor authentication</Text>
        {user && user.totp_enabled ? (
          <Btn title="Disable 2FA" variant="danger" onPress={disable2fa} />
        ) : (
          <>
            <Btn title="Set up 2FA" onPress={start2fa} loading={twoFaBusy} />
            {setupShown && twoFa ? (
              <View style={{ marginTop: 12, gap: 10 }}>
                <Text style={styles.hint}>Scan this QR code in your authenticator app. Keep the secret safe.</Text>
                <Field label="Enter code to enable" value={code} onChangeText={setCode} placeholder="123456" keyboardType="numeric" />
                <Btn title="Confirm and enable" onPress={enable2fa} />
              </View>
            ) : null}
          </>
        )}
      </Card>
      <Btn title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.forest, marginBottom: 4 },
  kv: { color: colors.ink, marginBottom: 4 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 }
});
