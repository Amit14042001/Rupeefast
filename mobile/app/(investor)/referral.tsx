/**
 * RupeeFast — Investor Referral Screen
 */

import { View, Text, ScrollView, Pressable, StyleSheet, Share, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';

export default function InvestorReferralScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const referralCode = 'RFIN842';

  const handleShare = async (platform: string) => {
    try {
      await Share.share({
        message: `Invest with RupeeFast and earn up to 22% ROI! Use my referral code ${referralCode} to get started. Download: https://rupeefast.in/download`,
      });
    } catch { /* ignore */ }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Refer & Earn</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl5, paddingHorizontal: spacing.xxl }}>
          <View style={[styles.iconBox, { backgroundColor: colors.purpleBg }]}>
            <Ionicons name="gift" size={32} color={colors.purple} />
          </View>
          <Text style={[styles.heading, { color: colors.text }]}>Invite Investors</Text>
          <Text style={[styles.subtitle, { color: colors.text3 }]}>
            Earn <Text style={{ fontWeight: '700', color: colors.green }}>₹500</Text> for every investor who deposits ₹10,000+
          </Text>
        </View>

        <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.codeLabel, { color: colors.text3 }]}>Your Referral Code</Text>
          <Text style={[styles.codeValue, { color: colors.green }]}>{referralCode}</Text>
          <Pressable
            style={[styles.copyBtn, { backgroundColor: colors.green }]}
            onPress={() => Alert.alert('Copied!', 'Referral code copied to clipboard.')}
          >
            <Ionicons name="copy-outline" size={14} color="#fff" />
            <Text style={styles.copyText}> Copy Code</Text>
          </Pressable>
        </View>

        <View style={[styles.statsCard, { backgroundColor: colors.purpleBg }]}>
          <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.statLabel, { color: colors.text }]}>Total Referrals</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>3 successful</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.statValue, { color: colors.purple }]}>₹1,500</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>Earned</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View>
              <Text style={[styles.statLabel, { color: colors.text }]}>Available Bonus</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>Pending deposits</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.statValue, { color: colors.green }]}>₹500</Text>
              <Text style={[styles.statSub, { color: colors.text3 }]}>1 pending</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Your Referrals</Text>
        </View>

        {[
          { name: 'Rajesh Patel', detail: 'Invested ₹25,000 · May 12', bonus: '₹500', status: 'paid' },
          { name: 'Priya Singh', detail: 'Invested ₹15,000 · Apr 28', bonus: '₹500', status: 'paid' },
          { name: 'Amit Kapoor', detail: 'Invested ₹12,000 · Apr 5', bonus: '₹500', status: 'paid' },
          { name: 'Neha Verma', detail: 'Deposit pending · Registered May 30', bonus: 'Pending', status: 'pending' },
        ].map((ref, i) => (
          <View key={i} style={[styles.refItem, { borderBottomColor: colors.borderLight }]}>
            <View style={[styles.refIcon, { backgroundColor: ref.status === 'paid' ? colors.greenBg : colors.amberBg }]}>
              <Ionicons name={ref.status === 'paid' ? 'person' : 'person-outline'} size={16} color={ref.status === 'paid' ? colors.green : colors.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.refName, { color: colors.text }]}>{ref.name}</Text>
              <Text style={[styles.refDetail, { color: colors.text3 }]}>{ref.detail}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: ref.status === 'paid' ? colors.greenBg : colors.amberBg }]}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: ref.status === 'paid' ? colors.green : colors.amber }}>{ref.bonus}</Text>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Share Via</Text>
        </View>

        <View style={styles.shareGrid}>
          <Pressable style={[styles.shareBtn, { backgroundColor: '#25D366' }]} onPress={() => handleShare('WhatsApp')}>
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={styles.shareText}> WhatsApp</Text>
          </Pressable>
          <Pressable style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={() => handleShare('SMS')}>
            <Ionicons name="chatbox" size={18} color="#fff" />
            <Text style={styles.shareText}> SMS</Text>
          </Pressable>
          <Pressable style={[styles.shareBtn, { backgroundColor: '#00AFF5' }]} onPress={() => handleShare('Telegram')}>
            <Ionicons name="paper-plane" size={18} color="#fff" />
            <Text style={styles.shareText}> Telegram</Text>
          </Pressable>
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
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  iconBox: { width: 70, height: 70, borderRadius: radii.xl2, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginTop: spacing.xxl },
  subtitle: { fontSize: 14, marginTop: spacing.ssm },
  codeCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl4, alignItems: 'center' },
  codeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeValue: { fontSize: 28, fontWeight: '800', letterSpacing: 4, marginVertical: spacing.md },
  copyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl4, paddingVertical: spacing.md, borderRadius: radii.full },
  copyText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  statsCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.sm, padding: spacing.xl + 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1 },
  statLabel: { fontWeight: '700', fontSize: 13 },
  statSub: { fontSize: 11, marginTop: 2 },
  statValue: { fontWeight: '700', fontSize: 15 },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  refItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1 },
  refIcon: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  refName: { fontWeight: '600', fontSize: 14 },
  refDetail: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  shareGrid: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl4 },
  shareBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl, borderRadius: radii.sm },
  shareText: { fontSize: 12, fontWeight: '600', color: '#fff' },
});
