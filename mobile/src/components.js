import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';

export function Screen({ children, scroll = true, contentStyle, refreshControl }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>{body}</SafeAreaView>;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children, style }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, multiline, editable = true }) {
  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        multiline={multiline}
        editable={editable}
      />
    </View>
  );
}

export function Btn({ title, onPress, variant = 'primary', loading, disabled, style }) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        variants[variant],
        pressed && !isDisabled && styles.btnPressed,
        isDisabled && styles.btnDisabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.lime : colors.forest} />
      ) : (
        <Text style={[styles.btnText, variant === 'primary' ? styles.btnTextPrimary : styles.btnTextSecondary]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const variants = {
  primary: { backgroundColor: colors.forest },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' }
};

export function Notice({ message, type = 'error' }) {
  if (!message) return null;
  const tone = type === 'success'
    ? { borderColor: '#bcdcc8', backgroundColor: '#e9f6ee' }
    : { borderColor: '#f0c6bd', backgroundColor: '#fdede9' };
  return (
    <View style={[styles.notice, tone]}>
      <Text style={[styles.noticeText, type === 'success' ? { color: '#1d6b45' } : { color: colors.danger }]}>
        {message}
      </Text>
    </View>
  );
}

export function Tag({ text, color }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.segmentPressed]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Loading({ label = 'Loading...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.forest} />
      <Muted style={{ marginTop: 8 }}>{label}</Muted>
    </View>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Muted style={{ marginTop: 4, textAlign: 'center' }}>{hint}</Muted> : null}
    </Card>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  fill: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.forestDeep },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '700', color: colors.forest, marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 14 },
  field: { gap: 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: '#eef1ec', color: colors.muted },
  btn: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnTextPrimary: { color: colors.lime },
  btnTextSecondary: { color: colors.forest },
  notice: { borderWidth: 1, borderRadius: 10, padding: 12 },
  noticeText: { fontSize: 14, fontWeight: '600' },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 4,
    gap: 4
  },
  segment: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { backgroundColor: colors.forest },
  segmentPressed: { opacity: 0.85 },
  segmentText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  segmentTextActive: { color: colors.lime },
  loading: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.forest },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 }
});
