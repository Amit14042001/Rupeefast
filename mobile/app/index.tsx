/**
 * RupeeFast — Landing Screen
 *
 * Role selection with:
 * - Gradient background (primary dark → primary → primary light)
 * - Floating animated particles (translucent circles)
 * - Glow orbs in corners
 * - Staggered fade-in entrance animation
 * - Three role buttons: Borrow Money, Invest & Earn, Field Agent
 */

import { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radii, typography } from '../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Floating particle data ──
const PARTICLES = [
  { size: 120, top: '10%', left: '5%', duration: 12000 },
  { size: 80, top: '60%', right: '10%', duration: 10000, delay: -2000 },
  { size: 160, bottom: '15%', left: '20%', duration: 14000, delay: -5000 },
  { size: 60, top: '30%', right: '25%', duration: 9000, delay: -3000 },
  { size: 100, bottom: '40%', left: '50%', duration: 11000, delay: -7000 },
];

export default function LandingScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Entrance animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(12)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const btn1Opacity = useRef(new Animated.Value(0)).current;
  const btn2Opacity = useRef(new Animated.Value(0)).current;
  const btn3Opacity = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslate, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(btn1Opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(btn2Opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(btn3Opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(statusOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRoleSelect = useCallback(
    (role: string) => {
      router.push(`/(auth)/login?role=${role}`);
    },
    [router],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      {/* Gradient background */}
      <View style={[styles.gradientOverlay]} />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <View
          key={i}
          style={[
            styles.particle,
            {
              width: p.size,
              height: p.size,
              top: p.top as any,
              left: p.left as any,
              right: p.right as any,
              bottom: p.bottom as any,
            },
          ]}
        />
      ))}

      {/* Glow orbs */}
      <View
        style={[
          styles.glowOrb,
          {
            top: -80,
            right: -80,
            width: 240,
            height: 240,
            backgroundColor: 'rgba(37,98,168,0.2)',
          },
        ]}
      />
      <View
        style={[
          styles.glowOrb,
          {
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            backgroundColor: 'rgba(79,136,203,0.15)',
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Logo icon */}
        <Animated.View
          style={[
            styles.logoIcon,
            {
              opacity: logoOpacity,
              transform: [{ translateY: logoTranslate }],
            },
          ]}
        >
          <Text style={styles.logoEmoji}>💰</Text>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{ opacity: titleOpacity }}>
          <Text style={styles.title}>RupeeFast</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle}>
            Institutional grade micro-lending.{'\n'}Instant. Ethical. Secure.
          </Text>
        </Animated.View>

        {/* Role buttons */}
        <View style={styles.buttonGroup}>
          <Animated.View style={{ opacity: btn1Opacity, width: '100%' }}>
            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                pressed && styles.roleButtonPressed,
              ]}
              onPress={() => handleRoleSelect('borrower')}
            >
              <Text style={styles.roleButtonIcon}>👤</Text>
              <Text style={styles.roleButtonText}>Borrow Money</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={{ opacity: btn2Opacity, width: '100%' }}>
            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                pressed && styles.roleButtonPressed,
              ]}
              onPress={() => handleRoleSelect('investor')}
            >
              <Text style={styles.roleButtonIcon}>📈</Text>
              <Text style={styles.roleButtonText}>Invest & Earn</Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={{ opacity: btn3Opacity, width: '100%' }}>
            <Pressable
              style={({ pressed }) => [
                styles.roleButton,
                pressed && styles.roleButtonPressed,
              ]}
              onPress={() => handleRoleSelect('agent')}
            >
              <Text style={styles.roleButtonIcon}>📍</Text>
              <Text style={styles.roleButtonText}>Field Agent</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Status badge */}
        <Animated.View style={[styles.statusBadge, { opacity: statusOpacity }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>RBI Registered NBFC Partner</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  particle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 1,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.xl2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  logoEmoji: {
    fontSize: 34,
  },
  title: {
    ...typography.h1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginTop: 10,
  },
  buttonGroup: {
    marginTop: 44,
    width: 280,
    gap: 12,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  roleButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ scale: 0.97 }],
  },
  roleButtonIcon: {
    fontSize: 18,
  },
  roleButtonText: {
    ...typography.buttonSmall,
    color: '#FFFFFF',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 36,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  statusText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
});
