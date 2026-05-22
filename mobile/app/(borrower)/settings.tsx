/**
 * RupeeFast — Borrower Settings Screen
 *
 * Connects to:
 * - useAuthStore for user data
 * - logout() auth service for logout
 */

import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { useAuthStore } from '../../src/stores/auth-store';
import { logout as apiLogout } from '../../src/services/auth';

export default function BorrowerSettingsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [biometric, setBiometric] = useState(true);
  const [autoPay, setAutoPay] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await apiLogout();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Settings</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ padding: spacing.lg }}>
          {/* Profile Summary */}
          <View style={[styles.profileCard, { backgroundColor: colors.primaryBg }]}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.profileAvatarText}>
                {(user?.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.lg }}>
              <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'User'}</Text>
              <Text style={[styles.profilePhone, { color: colors.text3 }]}>+91 {user?.mobile}</Text>
            </View>
          </View>

          {/* Security */}
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Security</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow icon="finger-print" label="Biometric Login" colors={colors} value={biometric} onToggle={setBiometric} />
            <SettingRow icon="lock-closed" label="Change PIN" colors={colors} last />
          </View>

          {/* Payments */}
          <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xl4 }]}>Payments</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow icon="card" label="AutoPay Mandate" colors={colors} value={autoPay} onToggle={setAutoPay} />
            <SettingRow icon="business" label="Bank Accounts" colors={colors} last />
          </View>

          {/* Preferences */}
          <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xl4 }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow icon="notifications" label="Push Notifications" colors={colors} value={notifications} onToggle={setNotifications} />
            <SettingRow icon="moon" label="Dark Mode" colors={colors} value={darkMode} onToggle={setDarkMode} last />
          </View>

          {/* About */}
          <Text style={[styles.sectionTitle, { color: colors.text3, marginTop: spacing.xl4 }]}>About</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow icon="information-circle" label="App Version" colors={colors} valueText="1.0.0" />
            <SettingRow icon="document-text" label="Terms of Service" colors={colors} last />
          </View>

          {/* Logout */}
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.red} />
            <Text style={[styles.logoutText, { color: colors.red }]}>Logout</Text>
          </Pressable>
        </View>
        <View style={{ height: spacing.xl5 }} />
      </ScrollView>
    </View>
  );
}

function SettingRow({ icon, label, colors, value, onToggle, valueText, last }: {
  icon: string; label: string; colors: any; value?: boolean; onToggle?: (v: boolean) => void; valueText?: string; last?: boolean;
}) {
  return (
    <View style={[styles.settingRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flex: 1 }}>
        <Ionicons name={icon as any} size={18} color={colors.text3} />
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      </View>
      {onToggle !== undefined ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      ) : (
        <Text style={[styles.settingValue, { color: colors.text3 }]}>{valueText || ''}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.smd },
  card: { borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2 },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingValue: { fontSize: 12 },
  profileCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl + 2, borderRadius: radii.sm, marginBottom: spacing.xl4 },
  profileAvatar: { width: 48, height: 48, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  profileName: { fontSize: 16, fontWeight: '700' },
  profilePhone: { fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.smd, marginTop: spacing.xl4, paddingVertical: spacing.xl, borderWidth: 1, borderRadius: radii.sm },
  logoutText: { fontSize: 14, fontWeight: '600' },
});
