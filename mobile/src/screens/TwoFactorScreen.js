import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Field, Notice, Screen } from '../components';
import { AuthHeader } from '../ui';

export default function TwoFactorScreen({ navigation }) {
  const { setUser } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/2fa/verify', { method: 'POST', body: { code: code.trim() } });
      if (data && data.user) setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <AuthHeader
          eyebrow="Two-factor verification"
          title="Enter your code"
          description="Open your authenticator app and enter the current six-digit code."
        />
        <View style={styles.form}>
          <Field
            label="Six-digit code"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            autoCapitalize="none"
          />
          <Notice message={error} />
          <Btn title="Verify" onPress={submit} loading={busy} />
          <Btn title="Back to sign in" variant="secondary" onPress={() => navigation.navigate('Login')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18, paddingTop: 24 },
  form: { gap: 14 }
});
