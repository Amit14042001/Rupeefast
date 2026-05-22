/**
 * RupeeFast — Borrower Refer & Earn Screen
 */

import { View, Text, ScrollView, Pressable, StyleSheet, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

export default function BorrowerReferScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const handleShare = async () => {
    try {
      await Share.share({ message: 'Use my referral code RFRK200 to get ₹200 bonus on RupeeFast! Download now: https://rupeefast.com/download' });
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Refer & Earn</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
          <View style={[styles.rewardBox, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="gift" size={40} color={colors.primary} />
            <Text style={[styles.rewardTitle, { color: colors.primary }]}>Refer a Friend</Text>
            <Text style={[styles.rewardSub, { color: colors.text2 }]}>You earn ₹200, they earn ₹200</Text>
          </View>

          <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.codeLabel, { color: colors.text3 }]}>Your Referral Code</Text>
            <Text style={[styles.codeValue, { color: colors.primary }]}>RFRK200</Text>
            <Pressable
              style={({ pressed }) => [styles.shareBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
              onPress={handleShare}
            >
              <Ionicons name="share" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Share Now</Text>
            </Pressable>
          </View>

          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statRow}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.statNum, { color: colors.green }]}>12</Text>
                <Text style={[styles.statLabel, { color: colors.text3 }]}>Referred</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border, height: 40 }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.statNum, { color: colors.green }]}>8</Text>
                <Text style={[styles.statLabel, { color: colors.text3 }]}>Joined</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.border, height: 40 }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[styles.statNum, { color: colors.green }]}>₹1,600</Text>
                <Text style={[styles.statLabel, { color: colors.text3 }]}>Earned</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text3, alignSelf: 'flex-start' }]}>How it works</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, width: '100%' }]}>
            {[
              { step: '1', text: 'Share your unique referral code with friends' },
              { step: '2', text: 'They sign up & complete their first loan' },
              { step: '3', text: 'You both earn ₹200 bonus instantly' },
            ].map((item, i) => (
              <View key={i} style={[styles.stepRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <View style={[styles.stepNum, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.stepNumText, { color: colors.primary }]}>{item.step}</Text>
                </View>
                <Text style={[styles.stepText, { color: colors.text2 }]}>{item.text}</Text>
              </View>
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
  rewardBox: { width: '100%', borderRadius: radii.sm, padding: spacing.xl4, alignItems: 'center', marginBottom: spacing.lg },
  rewardTitle: { fontSize: 20, fontWeight: '700', marginTop: spacing.smd },
  rewardSub: { fontSize: 13, marginTop: spacing.ssm },
  codeCard: { width: '100%', borderRadius: radii.sm, borderWidth: 1, borderStyle: 'dashed', padding: spacing.xl4, alignItems: 'center', marginBottom: spacing.lg },
  codeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 3, marginTop: spacing.smd, marginBottom: spacing.lg },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd, paddingHorizontal: spacing.xl4, paddingVertical: spacing.smd, borderRadius: radii.sm },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsCard: { width: '100%', borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl4, marginBottom: spacing.xl4 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: spacing.xs, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.xl4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.xl + 2 },
  stepNum: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepNumText: { fontSize: 13, fontWeight: '700' },
  stepText: { fontSize: 13, flex: 1 },
});
