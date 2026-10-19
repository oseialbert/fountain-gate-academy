import { View, StyleSheet } from 'react-native';
import { useAuth } from '../AuthContext';
import { Btn, Screen } from '../components';
import { AuthHeader } from '../ui';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  return (
    <Screen contentStyle={styles.content}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <AuthHeader
          eyebrow="Fountain Gate Academy"
          title="School portal"
          description="Track students, classes, attendance, grades, and keep your data secure."
        />
        <Btn title="Sign in" onPress={() => navigation.navigate('Login')} />
        <Btn title="Create account" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
