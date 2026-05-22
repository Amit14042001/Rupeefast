/**
 * RupeeFast — Borrower Loyalty Rewards Screen
 */

import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

const TIERS = [
  { name: 'Bronze', min: 0, max: 74, color: '#CD7F32', icon: 'medal', benefits: 'Basic loan access', current: true },
  { name: 'Silver', min: 75, max: 89, color: '#C0C0C0', icon: 'medal', benefits: 'Lower fees, higher limits', current: false },
  { name: 'Gold', min: 90, max: 100, color: '#FFD700', icon: 'medal', benefits: 'Priority disbursal, 0% fees', current: false },
];

const REWARDS = [
  { id: 1, title: 'Referral Bonus', desc: 'Earn ₹200 per referral', progress: 8, target: 10, icon: 'people' },
  { id: 2, title: 'On-time Payment Streak', desc: '10 consecutive on-time payments', progress: 33, target: 100, icon: 'flame' },
  { id: 3, title: 'Loan Completion Bonus', desc: 'Complete your first loan cycle', progress: 33, target: 100, icon: 'trophy' },
];

export default function BorrowerLoyaltyScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Loyalty Rewards</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          {/* Current Tier */}
          <View style={[styles.tierBanner, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="medal" size={48} color={colors.primary} />
            <Text style={[styles.tierName, { color: colors.primary }]}>Bronze Tier</Text>
            <Text style={[styles.tierDesc, { color: colors.text2 }]}>Trust Score 74 — 1 point to Silver!</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '74%', backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressLabel, { color: colors.text3 }]}>74 / 100 points</Text>
          </View>

          {/* All Tiers */}
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Tiers & Benefits</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {TIERS.map((tier, i) => (
              <View key={i} style={[styles.tierRow, i < TIERS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.tierIcon, { backgroundColor: tier.current ? colors.primaryBg : colors.bg }]}>
                  <Ionicons name={tier.icon as any} size={20} color={tier.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierLabel, { color: colors.text, fontWeight: tier.current ? '700' : '500' }]}>
                    {tier.name} {tier.current && '(Current)'}
                  </Text>
                  <Text style={[styles.tierRange, { color: colors.text3 }]}>{tier.min}-{tier.max} pts</Text>
                  <Text style={[styles.tierBenefits, { color: colors.text2 }]}>{tier.benefits}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Active Rewards */}
          <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xl4 }]}>Active Rewards</Text>
          {REWARDS.map((reward) => (
            <View key={reward.id} style={[styles.rewardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.rewardHeader}>
                <Ionicons name={reward.icon as any} size={22} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: spacing.lg }}>
                  <Text style={[styles.rewardTitle, { color: colors.text }]}>{reward.title}</Text>
                  <Text style={[styles.rewardDesc, { color: colors.text3 }]}>{reward.desc}</Text>
                </View>
              </View>
              <View style={styles.rewardProgress}>
                <View style={styles.rewardBar}>
                  <View style={[styles.rewardFill, { width: `${(reward.progress / reward.target) * 100}%`, backgroundColor: colors.green }]} />
                </View>
                <Text style={[styles.rewardPct, { color: colors.text3 }]}>{reward.progress}/{reward.target}</Text>
              </View>
            </View>
          ))}
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
  tierBanner: { borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center', marginBottom: spacing.xl4 },
  tierName: { fontSize: 22, fontWeight: '700', marginTop: spacing.smd },
  tierDesc: { fontSize: 13, marginTop: spacing.xs },
  progressBar: { width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, marginTop: spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { fontSize: 11, marginTop: spacing.smd },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  tierRow: { flexDirection: 'row', padding: spacing.xl + 2, gap: spacing.lg },
  tierIcon: { width: 44, height: 44, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  tierLabel: { fontSize: 14 },
  tierRange: { fontSize: 11, marginTop: 1 },
  tierBenefits: { fontSize: 11, marginTop: 2 },
  rewardCard: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, marginBottom: spacing.smd },
  rewardHeader: { flexDirection: 'row', alignItems: 'center' },
  rewardTitle: { fontSize: 14, fontWeight: '600' },
  rewardDesc: { fontSize: 11, marginTop: 1 },
  rewardProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg },
  rewardBar: { flex: 1, height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' },
  rewardFill: { height: '100%', borderRadius: 3 },
  rewardPct: { fontSize: 11, fontWeight: '600' },
});
