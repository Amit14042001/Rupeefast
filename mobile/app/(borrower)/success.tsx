/**
 * RupeeFast — Borrower Loan Application Success Screen
 *
 * Shown after accepting loan offer — confirms application, shows loan details,
 * expected disbursement timeline, and next steps.
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

export default function BorrowerSuccessScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success Icon ── */}
        <View style={[styles.successSection, { paddingTop: top + spacing.xl5 }]}>
          <View style={[styles.successIcon, { backgroundColor: colors.greenBg }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.green} />
          </View>
          <Text style={[styles.successHeading, { color: colors.text }]}>
            Application Submitted!
          </Text>
          <Text style={[styles.successSub, { color: colors.text3 }]}>
            Your loan application has been received and is being processed.
          </Text>
        </View>

        {/* ── Loan Summary Card ── */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Loan Summary</Text>

          {[
            { label: 'Loan Amount', value: '₹8,000' },
            { label: 'Disbursal Amount', value: '₹7,200', highlight: true },
            { label: 'Repayment Plan', value: 'Daily (₹120/day)' },
            { label: 'Tenure', value: '100 Days' },
            { label: 'Est. Disbursal', value: 'Within 24 hours', accent: true },
          ].map((row, i) => (
            <View
              key={i}
              style={[
                styles.summaryRow,
                i < 4 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: colors.text3 }]}>{row.label}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: colors.text },
                  row.highlight && { color: colors.green, fontWeight: '700' },
                  row.accent && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Next Steps ── */}
        <Text style={[styles.sectionLabel, { color: colors.text3 }]}>What happens next?</Text>

        {[
          { icon: 'document-text', text: 'Loan agreement is being verified', done: true },
          { icon: 'person', text: 'KYC documents are under review', done: true },
          { icon: 'timer', text: 'Disbursal initiated — typically within 24 hrs', done: false },
          { icon: 'notifications', text: 'You\'ll get a notification when funds arrive', done: false },
        ].map((step, i) => (
          <View key={i} style={[styles.stepRow, { borderBottomColor: colors.borderLight }]}>
            <View style={[styles.stepIcon, { backgroundColor: step.done ? colors.greenBg : colors.primaryBg }]}>
              <Ionicons
                name={step.done ? 'checkmark-circle' : step.icon as any}
                size={18}
                color={step.done ? colors.green : colors.primary}
              />
            </View>
            <Text style={[styles.stepText, { color: step.done ? colors.text : colors.text2 }]}>
              {step.text}
            </Text>
            {i < 3 && <View style={[styles.stepLine, { backgroundColor: colors.borderLight }]} />}
          </View>
        ))}

        {/* ── CTA ── */}
        <Pressable
          style={({ pressed }) => [styles.ctaPrimary, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/(borrower)/(tabs)/home')}
        >
          <Ionicons name="home" size={16} color="#fff" />
          <Text style={styles.ctaText}> Back to Home</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/(borrower)/(tabs)/schedule')}
        >
          <Text style={[styles.ctaGhostText, { color: colors.primary }]}>View Repayment Schedule →</Text>
        </Pressable>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl5 },
  successSection: { alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl4 },
  successIcon: { width: 96, height: 96, borderRadius: radii.xl3, justifyContent: 'center', alignItems: 'center' },
  successHeading: { fontSize: 22, fontWeight: '700', marginTop: spacing.xl4, textAlign: 'center' },
  successSub: { fontSize: 14, marginTop: spacing.smd, textAlign: 'center', lineHeight: 20 },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.xl4 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: spacing.xl4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.smd + 2 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl + 2, position: 'relative' },
  stepIcon: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 20 },
  stepLine: { position: 'absolute', left: spacing.xxl + 17, top: 44, width: 2, height: 24 },
  ctaPrimary: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl5, paddingVertical: spacing.xl + 2, borderRadius: radii.sm },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  ctaGhost: { marginVertical: spacing.smd, paddingVertical: spacing.xl, alignItems: 'center' },
  ctaGhostText: { fontSize: 13, fontWeight: '600' },
});
