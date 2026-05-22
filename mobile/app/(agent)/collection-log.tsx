/**
 * RupeeFast — Agent Collection Log Form
 *
 * Full-featured form for agents to log collection attempts from the `collection_logs` table.
 * Fields: type, contact details, GPS, amount promised/collected, outcome, notes, attachments.
 * Falls back gracefully when backend is offline.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { createCollectionLog, updateCollectionLog } from '../../src/services/collections';
import type {
  CollectionType, ContactRelationship, ContactMethod, CollectionOutcome, CollectionStatus,
} from '../../src/types';

// ── Static data ──

const COLLECTION_TYPES: { value: CollectionType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'field_visit',  label: 'Field Visit',     icon: 'walk' },
  { value: 'home_visit',   label: 'Home Visit',      icon: 'home' },
  { value: 'workplace_visit', label: 'Workplace Visit', icon: 'business' },
  { value: 'phone_call',   label: 'Phone Call',      icon: 'call' },
  { value: 'sms_reminder', label: 'SMS Reminder',    icon: 'chatbubble' },
  { value: 'email_reminder', label: 'Email Reminder', icon: 'mail' },
  { value: 'legal_notice', label: 'Legal Notice',    icon: 'document-text' },
];

const CONTACT_METHODS: { value: ContactMethod; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'phone',     label: 'Phone' },
  { value: 'sms',       label: 'SMS' },
  { value: 'email',     label: 'Email' },
  { value: 'third_party', label: 'Third Party' },
];

const RELATIONSHIPS: { value: ContactRelationship; label: string }[] = [
  { value: 'self',       label: 'Self' },
  { value: 'spouse',     label: 'Spouse' },
  { value: 'parent',     label: 'Parent' },
  { value: 'neighbor',   label: 'Neighbor' },
  { value: 'employer',   label: 'Employer' },
  { value: 'guarantor',  label: 'Guarantor' },
  { value: 'other',      label: 'Other' },
];

const OUTCOMES: { value: CollectionOutcome; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'full_payment',   label: 'Full Payment',     icon: 'checkmark-circle' },
  { value: 'partial_payment', label: 'Partial Payment', icon: 'cash' },
  { value: 'promise_to_pay', label: 'Promise to Pay',   icon: 'time' },
  { value: 'no_response',    label: 'No Response',      icon: 'sad-outline' },
  { value: 'not_home',       label: 'Not Home',         icon: 'home-outline' },
  { value: 'refused',        label: 'Refused',          icon: 'close-circle' },
  { value: 'dispute',        label: 'Dispute',          icon: 'alert-circle' },
  { value: 'wrong_address',  label: 'Wrong Address',    icon: 'location-outline' },
  { value: 'deceased',       label: 'Deceased',         icon: 'heart-dislike' },
  { value: 'legal_referral', label: 'Legal Referral',   icon: 'shield' },
];

// ── Selectable Pill Row ──

function PillRow<T extends string>({
  options, selected, onSelect, colors,
}: {
  options: { value: T; label: string; icon?: keyof typeof Ionicons.glyphMap }[];
  selected: T | null;
  onSelect: (value: T) => void;
  colors: any;
}) {
  return (
    <View style={pillStyles.row}>
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              pillStyles.pill,
              {
                backgroundColor: isActive ? colors.primary : colors.bg,
                borderColor: isActive ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => onSelect(opt.value)}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={14}
                color={isActive ? '#fff' : colors.text3}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={[pillStyles.label, { color: isActive ? '#fff' : colors.text2 }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '600' },
});

// ── Main Screen ──

export default function AgentCollectionLogScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ loanId?: string; borrowerName?: string }>();

  const [loading, setLoading] = useState(false);

  // Form state
  const [collectionType, setCollectionType] = useState<CollectionType | null>(null);
  const [contactMethod, setContactMethod] = useState<ContactMethod | null>(null);
  const [relationship, setRelationship] = useState<ContactRelationship | null>(null);
  const [contactedPerson, setContactedPerson] = useState(params.borrowerName || '');
  const [outcome, setOutcome] = useState<CollectionOutcome | null>(null);
  const [amountCollected, setAmountCollected] = useState('');
  const [amountPromised, setAmountPromised] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');

  // GPS auto-capture
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Attempt to get GPS position for logging
    try {
      navigator.geolocation?.getCurrentPosition?.(
        (pos) => {
          setLocationLat(pos.coords.latitude.toFixed(6));
          setLocationLng(pos.coords.longitude.toFixed(6));
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } catch {}
  }, []);

  const resetForm = () => {
    setCollectionType(null);
    setContactMethod(null);
    setRelationship(null);
    setContactedPerson(params.borrowerName || '');
    setOutcome(null);
    setAmountCollected('');
    setAmountPromised('');
    setPromiseDate('');
    setDuration('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!collectionType) {
      Alert.alert('Required', 'Please select a collection type.');
      return;
    }
    if (!outcome) {
      Alert.alert('Required', 'Please select an outcome.');
      return;
    }

    setLoading(true);

    // Build GPS coords from manual entry or auto-captured
    const lat = locationLat ? parseFloat(locationLat) : undefined;
    const lng = locationLng ? parseFloat(locationLng) : undefined;

    const result = await createCollectionLog({
      loan_id: params.loanId ? parseInt(params.loanId) : 1,
      collection_type: collectionType,
      contacted_person: contactedPerson.trim() || undefined,
      relationship: relationship || undefined,
      contact_method: contactMethod || undefined,
      amount_collected: amountCollected ? parseInt(amountCollected) : undefined,
      amount_promised: amountPromised ? parseInt(amountPromised) : undefined,
      promise_date: promiseDate || undefined,
      outcome: outcome,
      notes: notes.trim() || undefined,
      location_lat: lat,
      location_lng: lng,
      duration_minutes: duration ? parseInt(duration) : undefined,
    });

    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Collection Logged',
        `Collection log #${result.logId} has been recorded successfully.${lat ? '\nGPS coordinates stamped.' : ''}`,
        [
          {
            text: 'Done',
            onPress: () => router.back(),
          },
        ],
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to save. Please try again.');
    }
  };

  const isPayment = outcome === 'full_payment' || outcome === 'partial_payment';
  const isPromise = outcome === 'promise_to_pay';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.topNavTitle, { color: colors.text }]}>Log Collection</Text>
          {params.borrowerName && (
            <Text style={[styles.topNavSub, { color: colors.text3 }]}>{params.borrowerName}</Text>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* ── Section: Collection Type ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Collection Type</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PillRow
            options={COLLECTION_TYPES}
            selected={collectionType}
            onSelect={setCollectionType}
            colors={colors}
          />
        </View>

        {/* ── Section: Contact ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Contact Details</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="Contacted Person Name"
            placeholderTextColor={colors.text3}
            value={contactedPerson}
            onChangeText={setContactedPerson}
          />

          <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Relationship</Text>
          <PillRow
            options={RELATIONSHIPS}
            selected={relationship}
            onSelect={setRelationship}
            colors={colors}
          />

          <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Contact Method</Text>
          <PillRow
            options={CONTACT_METHODS}
            selected={contactMethod}
            onSelect={setContactMethod}
            colors={colors}
          />
        </View>

        {/* ── Section: Outcome ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Outcome</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PillRow
            options={OUTCOMES}
            selected={outcome}
            onSelect={(v) => {
              setOutcome(v);
              if (v !== 'partial_payment' && v !== 'full_payment') setAmountCollected('');
              if (v !== 'promise_to_pay') { setAmountPromised(''); setPromiseDate(''); }
            }}
            colors={colors}
          />

          {isPayment && (
            <View style={styles.conditionalSection}>
              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Amount Collected (₹)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. 120"
                placeholderTextColor={colors.text3}
                keyboardType="number-pad"
                value={amountCollected}
                onChangeText={setAmountCollected}
              />
            </View>
          )}

          {isPromise && (
            <View style={styles.conditionalSection}>
              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Amount Promised (₹)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. 120"
                placeholderTextColor={colors.text3}
                keyboardType="number-pad"
                value={amountPromised}
                onChangeText={setAmountPromised}
              />
              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Promise Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="YYYY-MM-DD (e.g. 2025-07-05)"
                placeholderTextColor={colors.text3}
                value={promiseDate}
                onChangeText={setPromiseDate}
              />
            </View>
          )}
        </View>

        {/* ── Section: GPS & Duration ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Location & Time</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.gpsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Latitude</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="28.6139"
                placeholderTextColor={colors.text3}
                keyboardType="decimal-pad"
                value={locationLat}
                onChangeText={setLocationLat}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Longitude</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="77.2090"
                placeholderTextColor={colors.text3}
                keyboardType="decimal-pad"
                value={locationLng}
                onChangeText={setLocationLng}
              />
            </View>
          </View>
          {locationLat && locationLng && (
            <View style={[styles.gpsBadge, { backgroundColor: colors.greenBg }]}>
              <Ionicons name="locate" size={14} color={colors.green} />
              <Text style={[styles.gpsText, { color: colors.green }]}>GPS Captured</Text>
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.text2 }]}>Duration (minutes)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. 15"
            placeholderTextColor={colors.text3}
            keyboardType="number-pad"
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        {/* ── Section: Notes ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Notes</Text>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
            placeholder="Add any additional notes about this collection attempt..."
            placeholderTextColor={colors.text3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* ── Actions ── */}
        <View style={styles.actionSection}>
          <Pressable
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Save Collection Log</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.resetBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
            onPress={resetForm}
          >
            <Text style={[styles.resetBtnText, { color: colors.text3 }]}>Reset Form</Text>
          </Pressable>
        </View>

        <View style={{ height: spacing.xl5 * 2 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  topNavSub: { fontSize: 11, fontWeight: '500', marginLeft: spacing.smd, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 64 },

  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionCard: { marginHorizontal: spacing.lg, borderRadius: radii.sm, borderWidth: 1, padding: spacing.xl + 2, gap: spacing.lg },

  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, fontSize: 14, fontWeight: '500' },
  textArea: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, fontSize: 13, minHeight: 100, lineHeight: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  conditionalSection: { gap: spacing.smd, marginTop: spacing.sm },

  gpsRow: { flexDirection: 'row', gap: spacing.smd },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, alignSelf: 'flex-start' },
  gpsText: { fontSize: 11, fontWeight: '600' },

  actionSection: { marginHorizontal: spacing.lg, marginTop: spacing.xl4, gap: spacing.smd },
  submitBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderRadius: radii.sm },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  resetBtn: { paddingVertical: spacing.xl, borderRadius: radii.sm, borderWidth: 1, alignItems: 'center' },
  resetBtnText: { fontSize: 14, fontWeight: '600' },
});
