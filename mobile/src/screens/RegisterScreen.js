import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Field, Notice, Screen } from '../components';
import { AuthHeader } from '../ui';

export default function RegisterScreen({ navigation }) {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/register', { method: 'POST', body: { email: email.trim(), password } });
      const data = await api('/api/login', { method: 'POST', body: { email: email.trim(), password } });
      if (data && data.user) {
        setUser(data.user);
      } else if (data && data.requiresTwoFactor) {
        navigation.navigate('TwoFactor');
      }
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
          eyebrow="Fountain Gate Academy"
          title="Create your account"
          description="New accounts start with staff access. An administrator can grant elevated permissions."
        />
        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@school.edu"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 12 characters"
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat your password"
            secureTextEntry
            autoCapitalize="none"
          />
          <Notice message={error} />
          <Btn title="Create account" onPress={submit} loading={busy} />
          <Btn title="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18, paddingTop: 24 },
  form: { gap: 14 }
});
