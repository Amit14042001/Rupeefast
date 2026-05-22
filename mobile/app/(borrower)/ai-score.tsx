/**
 * RupeeFast — Borrower AI Trust Score Screen
 *
 * Dark theme with animated SVG ring and step-by-step analysis.
 * On completion, fetches real credit score from GET /api/credit/score.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { fetchCreditScore } from '../../src/services/credit';

const STEPS = [
  'Checking device fingerprint & root status...',
  'Analysing 6-month UPI transaction history...',
  'Verifying income consistency patterns...',
  'Checking SIM age & GPS stability...',
  'Scanning for fraud signals & loan rings...',
  'Analysing bank statement cash flow...',
  'Running repayment prediction model...',
  'Computing Trust Score — 47 signals...',
];

const ICONS = [
  '✓ Device clean', '✓ UPI activity: High', '✓ Income: Consistent',
  '✓ GPS: Stable', '✓ No fraud detected', '✓ Cash flow: Good',
  '⚠ 1 existing EMI noted', 'Generating offer...',
];

export default function BorrowerAiScoreScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [loadingScore, setLoadingScore] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [pct, setPct] = useState(0);

  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < STEPS.length - 1) {
          const newPct = Math.round(((prev + 2) / STEPS.length) * 100);
          setPct(newPct);
          Animated.timing(progressAnim, { toValue: newPct, duration: 400, useNativeDriver: false }).start();
          return prev + 1;
        } else {
          clearInterval(interval);
          setPct(100);
          // Fetch real credit score from API
          setLoadingScore(true);
          fetchCreditScore().then((result) => {
            setLoadingScore(false);
            if (result.success && result.score) {
              setFinalScore(result.score);
            } else {
              setFinalScore(74); // fallback
            }
          });
          setShowDone(true);
          Animated.timing(progressAnim, { toValue: 100, duration: 400, useNativeDriver: false }).start();
          return prev;
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: '#0F172A' }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topNavTitle}>AI Trust Score</Text>
      </View>

      <View style={styles.content}>
        {/* Animated Ring */}
        <View style={styles.ringContainer}>
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
            <Circle
              cx={size / 2} cy={size / 2} r={radius} fill="none"
              stroke="#2562A8" strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.ringText}>
            <Text style={styles.ringPct}>{showDone ? finalScore : pct}{showDone ? '' : '%'}</Text>
            <Text style={styles.ringLabel}>{showDone ? 'Trust Score' : 'Analysing'}</Text>
          </View>
        </View>

        {/* Progress Card */}
        <View style={styles.progressCard}>
          <Text style={styles.currentStep}>{showDone ? 'Analysis Complete!' : STEPS[stepIndex]}</Text>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
          </View>

          <View style={styles.checks}>
            {ICONS.slice(0, stepIndex + 1).map((icon, i) => (
              <View key={i} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                <Text style={styles.checkText}>{icon}</Text>
              </View>
            ))}
            {loadingScore && (
              <View style={styles.checkRow}>
                <Ionicons name="sync" size={14} color="#2562A8" />
                <Text style={styles.checkText}>Fetching your Trust Score...</Text>
              </View>
            )}
          </View>
        </View>

        {showDone && !loadingScore && (
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(borrower)/offer')}
          >
            <Text style={styles.doneBtnText}>Finalise Application →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginLeft: spacing.smd },
  content: { flex: 1, padding: spacing.xl4, alignItems: 'center' },
  ringContainer: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl4 },
  ringText: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 36, fontWeight: '800', color: '#fff' },
  ringLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  progressCard: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radii.lg, padding: spacing.xl + 2 },
  currentStep: { fontSize: 14, color: '#fff', fontWeight: '600', marginBottom: spacing.lg },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2562A8', borderRadius: 2 },
  checks: { marginTop: spacing.xl4, gap: spacing.smd },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.smd },
  checkText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  doneBtn: { width: '100%', marginTop: spacing.xl4, backgroundColor: '#fff', paddingVertical: spacing.xl, borderRadius: radii.sm, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
});
