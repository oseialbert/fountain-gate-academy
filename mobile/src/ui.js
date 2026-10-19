import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export function AuthHeader({ eyebrow, title, description }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandLetter}>F</Text>
        </View>
        <Text style={styles.brandName}>{eyebrow}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function PageHeader({ title, description, right }) {
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function StatCard({ label, value, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function KeyValue({ label, value }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandLetter: { color: colors.lime, fontWeight: '800', fontSize: 18 },
  brandName: { color: colors.forestDeep, fontWeight: '800', fontSize: 17 },
  title: { fontSize: 26, fontWeight: '800', color: colors.forestDeep },
  description: { fontSize: 15, color: colors.muted, lineHeight: 21, marginTop: 4 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 4
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.forest },
  statLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kvLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  kvValue: { color: colors.ink, fontSize: 14, flexShrink: 1, textAlign: 'right' }
});
