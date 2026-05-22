/**
 * RupeeFast — Borrower Payment Screen
 *
 * Layout:
 *   ┌─ Top Nav (back, "Make Payment") ──────────────────┐
 *   ├─ Today's Payment (₹120, EMI info) ────────────────┤
 *   ├─ Active Mandate Card (hidden; shown if exists) ────┤
 *   ├─ "Choose Payment Method" ──────────────────────────┤
 *   │   • UPI AutoPay (Recommended)                     │
 *   │   • NACH Mandate                                  │
 *   │   • Agent Collection                              │
 *   ├─ Plan Summary (amount, frequency, cycles) ────────┤
 *   ├─ "Set Up AutoPay →" CTA button ──────────────────│
 *   └─ "Secured by Razorpay" footer ────────────────────┘
 *
 * Razorpay checkout is opened inside a Modal WebView.
 * Falls back to demo mode when backend is offline.
 */

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii, typography } from '../../src/theme';
import { useAuthStore } from '../../src/stores/auth-store';
import { apiFetch } from '../../src/api/client';
import { ENDPOINTS } from '../../src/api/endpoints';

// ── Types ──

type PaymentMethod = 'upi_autopay' | 'nach' | 'agent';

interface MandateInfo {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: 'active' | 'paused';
  frequency: string;
  remainingCycles: number;
  totalCycles: number;
}

interface PaymentMethodDef {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: 'primary' | 'amber' | 'purple';
  badge?: string;
  badgeColor?: 'green' | 'amber';
}

// ── Constants ──

const EMI_AMOUNT = 120;
const TOTAL_CYCLES = 100;
const CURRENT_DAY = 33;

const PAYMENT_METHODS: PaymentMethodDef[] = [
  {
    id: 'upi_autopay',
    label: 'UPI AutoPay',
    description: 'Automatic daily payment via UPI',
    icon: 'phone-portrait-outline',
    colorKey: 'primary',
    badge: 'Recommended',
    badgeColor: 'green',
  },
  {
    id: 'nach',
    label: 'NACH Mandate',
    description: 'Auto-debit from bank account',
    icon: 'business-outline',
    colorKey: 'amber',
  },
  {
    id: 'agent',
    label: 'Agent Collection',
    description: 'Pay to field agent in person',
    icon: 'location-outline',
    colorKey: 'purple',
  },
];

// ── RAZORPAY CHECKOUT URL BUILDER ──

const RAZORPAY_KEY_ID =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_xxxxxxxxxxxx';

function buildRazorpayCheckoutHtml(options: {
  key: string;
  amountPaise: number;
  name: string;
  description: string;
  subscriptionId?: string;
  prefillContact?: string;
  prefillName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body style="margin:0;padding:0;background:#0F1117;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;padding:20px;font-family:sans-serif;">
    <div style="font-size:14px;color:#9CA3AF;margin-bottom:20px;">Loading RupeeFast Payment...</div>
    <div style="width:40px;height:40px;border:3px solid #1B3A6B;border-top-color:transparent;border-radius:50%;margin:0 auto;animation:spin 0.8s linear infinite;"></div>
  </div>
  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  <script>
    var rzp = new Razorpay({
      key: '${options.key}',
      amount: ${options.amountPaise},
      currency: 'INR',
      name: '${options.name}',
      description: '${options.description}',
      ${options.subscriptionId ? `subscription_id: '${options.subscriptionId}',` : ''}
      prefill: {
        contact: '${options.prefillContact || ''}',
        name: '${options.prefillName || ''}'
      },
      theme: { color: '#1B3A6B' },
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'SUCCESS',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_subscription_id: response.razorpay_subscription_id || '',
          razorpay_signature: response.razorpay_signature || ''
        }));
      },
      modal: {
        ondismiss: function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISMISSED' }));
        }
      }
    });
    rzp.open();
  </script>
</body>
</html>`;
}

// ══════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════

function PaymentMethodCard({
  method,
  isSelected,
  colors,
  onSelect,
}: {
  method: PaymentMethodDef;
  isSelected: boolean;
  colors: any;
  onSelect: () => void;
}) {
  const iconColorMap: Record<'primary' | 'amber' | 'purple', string> = {
    primary: colors.primary,
    amber: colors.amber,
    purple: colors.purple,
  };
  const iconColor = iconColorMap[method.colorKey];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.pmCard,
        {
          backgroundColor: colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          borderLeftWidth: isSelected ? 3 : 1,
          borderLeftColor: isSelected ? colors.primary : colors.border,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
      ]}
      onPress={onSelect}
    >
      <View style={[styles.pmCardContent]}>
        <Ionicons name={method.icon} size={22} color={iconColor} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[
                typography.body,
                { color: colors.text, fontWeight: '600', fontSize: 14 },
              ]}
            >
              {method.label}
            </Text>
            {method.badge && (
              <View
                style={[
                  styles.pmBadge,
                  {
                    backgroundColor:
                      method.badgeColor === 'green'
                        ? colors.greenBg
                        : colors.amberBg,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '600',
                    color:
                      method.badgeColor === 'green'
                        ? colors.green
                        : colors.amber,
                  }}
                >
                  {method.badge}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.text3, fontSize: 12, marginTop: 2 },
            ]}
          >
            {method.description}
          </Text>
        </View>

        {/* Check indicator */}
        <View
          style={[
            styles.pmCheck,
            {
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primary : 'transparent',
            },
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={12} color="#fff" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.text3 }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

// ══════════════════════════════════════════════
// MAIN PAY SCREEN
// ══════════════════════════════════════════════

export default function PayScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi_autopay');
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [mandate, setMandate] = useState<MandateInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const frequencyLabel =
    selectedMethod === 'nach' ? 'Monthly' : 'Daily';
  const totalCycles =
    selectedMethod === 'nach' ? 12 : TOTAL_CYCLES;

  // ── Holds the subscription_id once created on backend ──
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // ── Open Razorpay Checkout ──

  async function handleSetUpAutopay() {
    if (selectedMethod === 'agent') return;

    setIsProcessing(true);

    const amountPaise = EMI_AMOUNT * 100;

    // If no API key configured, use demo fallback
    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.includes('test_xxxxxxxxxxxx')) {
      setIsProcessing(false);
      Alert.alert(
        'Demo Mode',
        `Your ${selectedMethod === 'nach' ? 'NACH mandate' : 'UPI AutoPay'} of ₹${EMI_AMOUNT}/${frequencyLabel.toLowerCase()} is ready.`,
      );
      return;
    }

    // 1. Create a plan on the backend
    const planResult = await apiFetch('/payments/create-plan', {
      method: 'POST',
      body: {
        frequency: selectedMethod === 'nach' ? 'monthly' : 'daily',
        amountPaise,
        label: `RupeeFast EMI — ₹${EMI_AMOUNT}`,
      },
    });

    if (!planResult.success) {
      setIsProcessing(false);
      Alert.alert(
        'Demo Mode',
        'Backend unavailable. Running in demo mode.',
      );
      return;
    }

    const planId = (planResult as any).data?.plan?.id;

    // 2. Create a subscription from the plan
    const subResult = await apiFetch('/payments/create-subscription', {
      method: 'POST',
      body: {
        planId,
        totalCycles,
        method: selectedMethod,
        amount: EMI_AMOUNT,
        frequency: selectedMethod === 'nach' ? 'monthly' : 'daily',
      },
    });

    if (!subResult.success) {
      setIsProcessing(false);
      Alert.alert(
        'Demo Mode',
        'Could not create subscription. Running in demo mode.',
      );
      return;
    }

    const subId = (subResult as any).data?.subscription?.id;
    setSubscriptionId(subId ?? null);

    // 3. Open Razorpay WebView checkout with subscription_id
    setShowRazorpay(true);
    setIsProcessing(false);
  }

  // ── Handle Razorpay WebView Messages ──

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'SUCCESS') {
        setShowRazorpay(false);

        // Verify payment on backend before showing success
        const verifyResult = await apiFetch(ENDPOINTS.VERIFY_PAYMENT, {
          method: 'POST',
          body: {
            razorpay_payment_id: msg.razorpay_payment_id,
            razorpay_subscription_id: msg.razorpay_subscription_id,
            razorpay_signature: msg.razorpay_signature,
          },
        });

        if (verifyResult.success) {
          setMandate({
            id: msg.razorpay_subscription_id || 'demo',
            method: selectedMethod,
            amount: EMI_AMOUNT,
            status: 'active',
            frequency: frequencyLabel.toLowerCase(),
            remainingCycles: totalCycles,
            totalCycles,
          });
          Alert.alert(
            'Mandate Activated!',
            `Your ${selectedMethod === 'nach' ? 'NACH mandate' : 'UPI AutoPay'} of ₹${EMI_AMOUNT}/${frequencyLabel.toLowerCase()} is active. Future EMIs will be collected automatically.`,
          );
        } else {
          Alert.alert(
            'Verification Failed',
            'Payment was received but signature verification failed. Please contact support.',
          );
        }
      } else if (msg.type === 'DISMISSED') {
        setShowRazorpay(false);
      }
    } catch {
      setShowRazorpay(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Top Nav ── */}
      <View
        style={[
          styles.topNav,
          {
            paddingTop: top + spacing.smd,
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderLight,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>
          Make Payment
        </Text>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Today's Payment Hero ── */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.heroIcon,
              { backgroundColor: colors.greenBg },
            ]}
          >
            <Ionicons name="cash" size={32} color={colors.green} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Today's Payment
          </Text>
          <Text
            style={[styles.heroAmount, { color: colors.green }]}
          >
            ₹{EMI_AMOUNT}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.text3 }]}>
            EMI — Day {CURRENT_DAY} of {TOTAL_CYCLES}
          </Text>
        </View>

        {/* ── Active Mandate Card (conditional) ── */}
        {mandate && (
          <View style={[styles.mandateCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.green }]}>
            <View style={styles.mandateCardContent}>
              <View style={[styles.mandateIcon, { backgroundColor: colors.greenBg }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.green} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: '600', fontSize: 13 }]}>
                  AutoPay Active
                </Text>
                <Text style={[typography.bodySmall, { color: colors.text3, fontSize: 11 }]}>
                  {mandate.method === 'nach' ? 'NACH' : 'UPI AutoPay'} · ₹{mandate.amount}/{mandate.frequency} · {mandate.remainingCycles} remaining
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.mandateCancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  setMandate(null);
                  Alert.alert('Mandate Cancelled', 'Your AutoPay mandate has been cancelled.');
                }}
              >
                <Text style={[styles.mandateCancelText, { color: colors.red }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Section Header ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text3 }]}>
            Choose Payment Method
          </Text>
        </View>

        {/* ── Payment Methods ── */}
        <View style={styles.pmList}>
          {PAYMENT_METHODS.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              isSelected={selectedMethod === method.id}
              colors={colors}
              onSelect={() => {
                if (method.id === 'agent') {
                  Alert.alert(
                    'Agent Collection',
                    'Agent collection is available on the Home screen.',
                  );
                  return;
                }
                setSelectedMethod(method.id);
              }}
            />
          ))}
        </View>

        {/* ── Plan Summary ── */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surfaceHover,
              borderColor: colors.border,
            },
          ]}
        >
          <SummaryRow label="Payment Amount" value={`₹${EMI_AMOUNT}`} colors={colors} />
          <SummaryRow label="Frequency" value={frequencyLabel} colors={colors} />
          <SummaryRow label="Total Cycles" value={`${totalCycles}`} colors={colors} />
        </View>

        {/* ── CTA Button ── */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: selectedMethod === 'agent' ? colors.text3 : colors.primary,
              opacity: isProcessing ? 0.7 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleSetUpAutopay}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Text style={styles.ctaText}>Processing...</Text>
          ) : (
            <>
              <Ionicons name="lock-closed" size={14} color="#fff" />
              <Text style={styles.ctaText}>
                {' '}Set Up AutoPay →
              </Text>
            </>
          )}
        </Pressable>

        {/* ── Footer Note ── */}
        <Text style={[styles.footerNote, { color: colors.text3 }]}>
          <Ionicons name="shield" size={11} color={colors.text3} />{' '}
          Secured by Razorpay. Your payment info is encrypted.
        </Text>

        <View style={{ height: spacing.xl5 }} />
      </ScrollView>

      {/* ── Razorpay Checkout Modal ── */}
      <Modal
        visible={showRazorpay}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRazorpay(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F1117' }}>
          {/* Modal top bar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: '#1A1D28',
            }}
          >
            <Pressable
              onPress={() => setShowRazorpay(false)}
              style={({ pressed }) => [
                { padding: 4, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={24} color="#F1F3F7" />
            </Pressable>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 15,
                fontWeight: '600',
                color: '#F1F3F7',
                marginRight: 28,
              }}
            >
              RupeeFast Payment
            </Text>
          </View>

          {/* Razorpay Checkout WebView */}            <WebView
            key={subscriptionId ?? 'demo'}
            source={{
              html: buildRazorpayCheckoutHtml({
                key: RAZORPAY_KEY_ID,
                amountPaise: EMI_AMOUNT * 100,
                name: 'RupeeFast',
                description: `${frequencyLabel} repayment — ₹${EMI_AMOUNT}`,
                subscriptionId: subscriptionId ?? undefined,
                prefillContact: user?.mobile,
                prefillName: user?.name,
              }),
            }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: '#0F1117',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: 'rgba(27, 58, 107, 0.3)',
                    borderTopColor: '#1B3A6B',
                  }}
                />
                <Text
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    color: '#9CA3AF',
                  }}
                >
                  Loading payment gateway...
                </Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Top Nav ──
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl3,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topNavTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: spacing.smd,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 64,
  },

  // ── Hero Section ──
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl5,
    paddingHorizontal: spacing.xxl,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: radii.xl2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: spacing.xxl,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: spacing.ssm,
  },

  // ── Active Mandate Card ──
  mandateCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.smd,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacing.xl + 2,
  },
  mandateCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
  },
  mandateIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mandateCancelBtn: {
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.ssm,
  },
  mandateCancelText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Section Header ──
  sectionHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl4,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Payment Method Cards ──
  pmList: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pmCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.xl + 2,
  },
  pmCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  pmBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  pmCheck: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Plan Summary ──
  summaryCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.xl + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.ssm,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontWeight: '700',
    fontSize: 13,
  },

  // ── CTA Button ──
  ctaButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl4,
    paddingVertical: spacing.xl + 4,
    borderRadius: radii.sm,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Footer ──
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    paddingHorizontal: spacing.xl2,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl5,
  },
});
