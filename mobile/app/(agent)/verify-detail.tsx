/**
 * RupeeFast — Agent Verification Detail
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

const CHECKLIST = [
  'Confirm residence address',
  'Verify business location',
  'Collect GPS stamp',
  'Borrower OTP confirmation',
];

export default function AgentVerifyDetailScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false]);

  const toggleCheck = (i: number) => {
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
  };

  const complete = () => {
    Alert.alert('Verified!', 'Suresh Raina has been verified. ₹50 commission added to your earnings.');
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Verify Borrower</Text>
      </View>

      <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.xl4 }}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>SR</Text>
            </View>
            <View>
              <Text style={[styles.profileName, { color: colors.text }]}>Suresh Raina</Text>
              <Text style={[styles.profileSub, { color: colors.text3 }]}>+91 9876543120 · Shop Owner</Text>
            </View>
          </View>

          <View style={[styles.checklistCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.checklistTitle, { color: colors.text }]}>Verification Checklist</Text>
            {CHECKLIST.map((item, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.checkItem, pressed && { opacity: 0.8 }]}
                onPress={() => toggleCheck(i)}
              >
                <View style={[styles.checkbox, { borderColor: checked[i] ? colors.green : colors.border, backgroundColor: checked[i] ? colors.green : 'transparent' }]}>
                  {checked[i] && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={[styles.checkLabel, { color: colors.text }]}>{item}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary }, checked.every(Boolean) ? {} : { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
            onPress={complete}
            disabled={!checked.every(Boolean)}
          >
            <Text style={styles.ctaText}>Complete Verification</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl4 },
  avatar: { width: 56, height: 56, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '700' },
  profileName: { fontWeight: '700', fontSize: 16 },
  profileSub: { fontSize: 13, marginTop: 2 },
  checklistCard: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2 },
  checklistTitle: { fontWeight: '600', fontSize: 14, marginBottom: spacing.lg },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, marginBottom: spacing.smd },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { fontSize: 13 },
  cta: { marginTop: spacing.xl4, paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
