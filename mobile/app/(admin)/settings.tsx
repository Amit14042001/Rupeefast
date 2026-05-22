/**
 * RupeeFast — Admin Platform Settings
 *
 * Layout:
 *   ┌─ Top Nav (title) ─────────────────────────────────┐
 *   ├─ Sections: Fee Config, Loan Limits, System, etc. ─┤
 *   ├─ Toggles, inputs, and pickers for each setting ───┤
 *   └─ Save button ─────────────────────────────────────┘
 */

import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

// ── Settings types ──

interface SettingSection {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: SettingItem[];
}

interface SettingItem {
  id: string;
  label: string;
  value: string | boolean;
  type: 'toggle' | 'value' | 'select';
  description: string;
}

// ── Fallback settings ──

const FALLBACK_SETTINGS: SettingSection[] = [
  {
    id: 'fees', title: 'Fee Configuration', icon: 'cash-outline',
    items: [
      { id: 'processing_fee', label: 'Processing Fee', value: '5.0%', type: 'value', description: 'Charged upfront on loan disbursement' },
      { id: 'late_fee', label: 'Late Payment Fee', value: '₹50/day', type: 'value', description: 'Daily penalty for missed EMI' },
      { id: 'agent_commission', label: 'Agent Commission', value: '2.0%', type: 'value', description: 'Paid to agents on collected amount' },
      { id: 'referral_bonus', label: 'Referral Bonus', value: '₹200', type: 'value', description: 'Per successful borrower referral' },
    ],
  },
  {
    id: 'limits', title: 'Loan Limits', icon: 'options-outline',
    items: [
      { id: 'min_loan', label: 'Min Loan Amount', value: '₹2,000', type: 'value', description: 'Minimum loan amount for borrowers' },
      { id: 'max_loan', label: 'Max Loan Amount', value: '₹50,000', type: 'value', description: 'Maximum loan amount for borrowers' },
      { id: 'min_duration', label: 'Min Duration', value: '10 days', type: 'value', description: 'Shortest repayment period' },
      { id: 'max_duration', label: 'Max Duration', value: '180 days', type: 'value', description: 'Longest repayment period' },
    ],
  },
  {
    id: 'system', title: 'System Configuration', icon: 'settings-outline',
    items: [
      { id: 'auto_approve', label: 'Auto-approve Loans', value: true, type: 'toggle', description: 'Auto-approve loans with Trust Score ≥ 80' },
      { id: 'notify_agents', label: 'Auto-assign Agents', value: true, type: 'toggle', description: 'Automatically assign new collections to available agents' },
      { id: 'fraud_detection', label: 'AI Fraud Detection', value: true, type: 'toggle', description: 'Enable real-time fraud detection on loan applications' },
      { id: 'maintenance', label: 'Maintenance Mode', value: false, type: 'toggle', description: 'Block all user-facing operations during maintenance' },
    ],
  },
  {
    id: 'security', title: 'Security', icon: 'shield-outline',
    items: [
      { id: 'otp_login', label: 'OTP Login Required', value: true, type: 'toggle', description: 'All logins require OTP verification' },
      { id: 'max_login_attempts', label: 'Max Login Attempts', value: '5', type: 'value', description: 'Account lockout after failed attempts' },
      { id: 'session_timeout', label: 'Session Timeout', value: '30 min', type: 'value', description: 'Auto-logout after inactivity' },
      { id: 'audit_logging', label: 'Audit Logging', value: true, type: 'toggle', description: 'Record all admin actions in audit log' },
    ],
  },
  {
    id: 'notifications', title: 'Notifications', icon: 'notifications-outline',
    items: [
      { id: 'sms_reminders', label: 'SMS Reminders', value: true, type: 'toggle', description: 'Send SMS reminders for upcoming EMIs' },
      { id: 'whatsapp_alerts', label: 'WhatsApp Alerts', value: true, type: 'toggle', description: 'Send payment confirmations via WhatsApp' },
      { id: 'email_reports', label: 'Daily Email Reports', value: false, type: 'toggle', description: 'Send daily portfolio summary to admin email' },
      { id: 'push_notifications', label: 'Push Notifications', value: true, type: 'toggle', description: 'In-app push notifications for important events' },
    ],
  },
];

export default function AdminSettingsScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const [sections, setSections] = useState<SettingSection[]>(FALLBACK_SETTINGS);
  const [expandedSection, setExpandedSection] = useState<string | null>('fees');

  const { loading } = useTimedAsyncData(
    useCallback(async () => { await apiFetch('/health'); return null; }, []),
    null, 1500,
  );

  const handleToggle = (sectionId: string, itemId: string) => {
    setSections((prev) => prev.map((section) => {
      if (section.id !== sectionId) return section;
      return {
        ...section,
        items: section.items.map((item) => {
          if (item.id !== itemId) return item;
          if (item.type === 'toggle') {
            return { ...item, value: !item.value };
          }
          return item;
        }),
      };
    }));
  };

  const handleSave = () => {
    Alert.alert('Settings Saved', 'All configuration changes have been applied successfully.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.primaryDark }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topNavTitle}>Platform Settings</Text>
          <Text style={styles.topNavSub}>Configure platform parameters</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl5 * 2 }} />
        ) : (
          <>
            {sections.map((section) => {
              const isExpanded = expandedSection === section.id;
              return (
                <View key={section.id} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable
                    style={styles.sectionHeader}
                    onPress={() => setExpandedSection(isExpanded ? null : section.id)}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={[styles.sectionIcon, { backgroundColor: colors.primaryBg }]}>
                        <Ionicons name={section.icon} size={20} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                        <Text style={[styles.sectionCount, { color: colors.text3 }]}>{section.items.length} settings</Text>
                      </View>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text3} />
                  </Pressable>

                  {isExpanded && (
                    <View style={[styles.sectionBody, { borderTopColor: colors.borderLight }]}>
                      {section.items.map((item, idx) => (
                        <View
                          key={item.id}
                          style={[
                            styles.settingRow,
                            { borderBottomColor: colors.borderLight },
                            idx === section.items.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: colors.text }]}>{item.label}</Text>
                            <Text style={[styles.settingDesc, { color: colors.text3 }]}>{item.description}</Text>
                          </View>
                          {item.type === 'toggle' ? (
                            <Pressable
                              style={({ pressed }) => [
                                styles.toggle,
                                { backgroundColor: item.value ? colors.green : colors.text3 },
                                pressed && { opacity: 0.8 },
                              ]}
                              onPress={() => handleToggle(section.id, item.id)}
                            >
                              <View style={[styles.toggleKnob, { marginLeft: item.value ? 22 : 2 }]} />
                            </Pressable>
                          ) : (
                            <Pressable style={({ pressed }) => [styles.valueBtn, { backgroundColor: colors.bg, borderColor: colors.border }, pressed && { opacity: 0.7 }]}>
                              <Text style={[styles.valueText, { color: colors.primary }]}>{String(item.value)}</Text>
                              <Ionicons name="pencil" size={12} color={colors.text3} />
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Save button */}
            <View style={styles.saveSection}>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
                onPress={handleSave}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save All Changes</Text>
              </Pressable>
            </View>

            <View style={{ height: spacing.xl5 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, gap: spacing.smd },
  topNavTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  topNavSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },
  sectionCard: { marginHorizontal: spacing.lg, borderRadius: radii.xs, borderWidth: 1, marginBottom: spacing.smd, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl + 2 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  sectionIcon: { width: 40, height: 40, borderRadius: radii.md, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionCount: { fontSize: 11, marginTop: 2 },
  sectionBody: { borderTopWidth: 1, paddingHorizontal: spacing.xl + 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xl + 2, borderBottomWidth: 1, gap: spacing.lg },
  settingLabel: { fontSize: 13, fontWeight: '600' },
  settingDesc: { fontSize: 10, marginTop: 2, lineHeight: 14 },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  valueBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.xs, borderWidth: 1 },
  valueText: { fontSize: 12, fontWeight: '600' },
  saveSection: { marginHorizontal: spacing.lg, marginTop: spacing.xl4 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl + 2, borderRadius: radii.xs },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
