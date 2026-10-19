import 'react-native-gesture-handler';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import { colors } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import TwoFactorScreen from './src/screens/TwoFactorScreen';
import HomeScreen from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import StudentsScreen from './src/screens/StudentsScreen';
import StudentFormScreen from './src/screens/StudentFormScreen';
import ClassesScreen from './src/screens/ClassesScreen';
import ClassFormScreen from './src/screens/ClassFormScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import GradesScreen from './src/screens/GradesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.white,
    text: colors.ink,
    border: colors.line,
    primary: colors.forest
  }
};

function TabIcon({ label, focused }) {
  const active = focused ? colors.forest : colors.muted;
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabLabel, { color: active }]}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white, borderBottomColor: colors.line },
        headerTitleStyle: { fontWeight: '800', color: colors.forestDeep },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.muted
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="StudentsList"
        component={StudentsScreen}
        options={{ title: 'Students', tabBarIcon: ({ focused }) => <TabIcon label="Students" focused={focused} /> }}
      />
      <Tabs.Screen
        name="ClassesList"
        component={ClassesScreen}
        options={{ title: 'Classes', tabBarIcon: ({ focused }) => <TabIcon label="Classes" focused={focused} /> }}
      />
      <Tabs.Screen
        name="AttendanceList"
        component={AttendanceScreen}
        options={{ title: 'Attendance', tabBarIcon: ({ focused }) => <TabIcon label="Attendance" focused={focused} /> }}
      />
      <Tabs.Screen
        name="GradesList"
        component={GradesScreen}
        options={{ title: 'Grades', tabBarIcon: ({ focused }) => <TabIcon label="Grades" focused={focused} /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Me" focused={focused} /> }}
      />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.forest} />
      </View>
    );
  }
  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="StudentForm" component={StudentFormScreen} options={{ title: 'Student details' }} />
      <Stack.Screen name="ClassForm" component={ClassFormScreen} options={{ title: 'Add class' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  tabIcon: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 }
});
