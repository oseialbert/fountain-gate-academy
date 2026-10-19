import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Btn, Field, Notice, Screen } from '../components';
import { AuthHeader } from '../ui';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/login', { method: 'POST', body: { email: email.trim(), password } });
      if (data && data.requiresTwoFactor) {
        navigation.navigate('TwoFactor');
      } else if (data && data.user) {
        setUser(data.user);
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
          title="Welcome back"
          description="Sign in to manage students, classes, attendance, and grades."
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
            placeholder="Your password"
            secureTextEntry
            autoCapitalize="none"
          />
          <Notice message={error} />
          <Btn title="Sign in" onPress={submit} loading={busy} />
          <Btn title="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18, paddingTop: 24 },
  form: { gap: 14 },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' }
});
