/**
 * RupeeFast — Borrower Help & FAQs Screen
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

const FAQS = [
  { q: 'How do I apply for a loan?', a: 'Go to the Apply tab, select your amount and purpose, complete KYC verification, and e-sign the agreement.' },
  { q: 'When will I receive the loan amount?', a: 'Disbursal happens within 24 hours of e-signing the agreement, usually within 2-4 hours on business days.' },
  { q: 'How do repayments work?', a: 'Repayments are collected daily via UPI AutoPay. You can also pay via NACH mandate or field agent.' },
  { q: 'What happens if I miss a payment?', a: 'A late fee of ₹25/day applies after a 24-hour grace period. Repeated misses affect your Trust Score.' },
  { q: 'Can I prepay the loan?', a: 'Yes! Foreclosure is allowed anytime with 0% penalty. You only pay interest for days used.' },
  { q: 'How can I contact support?', a: 'Call us at 1800-123-4567 or email support@rupeefast.com. Available Mon-Sat, 9AM-8PM.' },
];

export default function BorrowerHelpScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Help & FAQs</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          <View style={[styles.contactCard, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="headset" size={32} color={colors.primary} />
            <Text style={[styles.contactTitle, { color: colors.primary }]}>Need help?</Text>
            <Text style={[styles.contactDesc, { color: colors.text2 }]}>Our support team is available 9AM-8PM, Mon-Sat</Text>
            <View style={styles.contactRow}>
              <View style={[styles.contactBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={styles.contactBtnText}>Call</Text>
              </View>
              <View style={[styles.contactBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="chatbubble" size={14} color="#fff" />
                <Text style={styles.contactBtnText}>Chat</Text>
              </View>
              <View style={[styles.contactBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="mail" size={14} color="#fff" />
                <Text style={styles.contactBtnText}>Email</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Frequently Asked Questions</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {FAQS.map((faq, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.faqItem,
                  i < FAQS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setExpanded(expanded === i ? null : i)}
              >
                <View style={styles.faqHeader}>
                  <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.q}</Text>
                  <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text3} />
                </View>
                {expanded === i && (
                  <Text style={[styles.faqAnswer, { color: colors.text2, marginTop: spacing.smd }]}>{faq.a}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 },
  contactCard: { borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center', marginBottom: spacing.xl4 },
  contactTitle: { fontSize: 18, fontWeight: '700', marginTop: spacing.smd },
  contactDesc: { fontSize: 12, marginTop: spacing.xs, textAlign: 'center' },
  contactRow: { flexDirection: 'row', gap: spacing.smd, marginTop: spacing.lg },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xl + 2, paddingVertical: spacing.smd, borderRadius: radii.sm },
  contactBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  faqItem: { padding: spacing.xl + 2 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: 13, fontWeight: '600', flex: 1 },
  faqAnswer: { fontSize: 12, lineHeight: 18 },
});
