/**
 * RupeeFast — Agent Leaderboard Screen
 *
 * Tries to fetch leaderboard data from the backend API with a 3-second timeout.
 * Falls back to static mock data when the backend is offline.
 */

import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, radii } from '../../src/theme';
import { apiFetch } from '../../src/api/client';
import { useTimedAsyncData } from '../../src/hooks/useAsyncData';

interface AgentRank {
  rank: number;
  initials: string;
  name: string;
  detail: string;
  earnings: string;
  color: string;
  isYou: boolean;
}

interface PodiumEntry {
  rank: number;
  initials: string;
  name: string;
  tasks: number;
  color: string;
  height: number;
  emoji: string;
}

const FALLBACK_PODIUM: PodiumEntry[] = [
  { rank: 2, initials: 'AM', name: 'Amit M.', tasks: 162, color: 'green', height: 90, emoji: '🥈' },
  { rank: 1, initials: 'PK', name: 'Priya K.', tasks: 198, color: 'amber', height: 120, emoji: '🥇' },
  { rank: 3, initials: 'RJ', name: 'Rohit J.', tasks: 145, color: 'purple', height: 70, emoji: '🥉' },
];

const FALLBACK_AGENTS: AgentRank[] = [
  { rank: 4, initials: 'SV', name: 'Suresh V.', detail: 'Zone 2 · 140 tasks · 4.9⭐', earnings: '₹3,800', color: 'green', isYou: false },
  { rank: 5, initials: 'MG', name: 'Meena G.', detail: 'Zone 1 · 138 tasks · 4.8⭐', earnings: '₹3,450', color: 'amber', isYou: false },
  { rank: 6, initials: 'AK', name: 'Arun K.', detail: 'Zone 3 · 136 tasks · 4.7⭐', earnings: '₹3,300', color: 'green', isYou: false },
  { rank: 7, initials: 'SV', name: 'Sunil Verma', detail: 'Zone 4 · 134 tasks · 4.8⭐', earnings: '₹3,240', color: 'amber', isYou: true },
  { rank: 8, initials: 'DL', name: 'Deepak L.', detail: 'Zone 5 · 128 tasks · 4.6⭐', earnings: '₹3,100', color: 'green', isYou: false },
  { rank: 9, initials: 'SN', name: 'Sunita N.', detail: 'Zone 1 · 120 tasks · 4.7⭐', earnings: '₹2,850', color: 'blue', isYou: false },
  { rank: 10, initials: 'VP', name: 'Vijay P.', detail: 'Zone 3 · 115 tasks · 4.5⭐', earnings: '₹2,640', color: 'blue', isYou: false },
];

const iconColorMap: Record<string, string> = { green: '#0B6B4A', amber: '#9A6200', purple: '#5A3E9B', blue: '#1B3A6B' };
const iconBgMap: Record<string, string> = { green: '#E3F5EE', amber: '#FEF3DC', purple: '#F0EBFF', blue: '#EBF2FB' };

export default function AgentLeaderboardScreen() {
  const { top } = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();

  const { data, loading } = useTimedAsyncData(
    async (): Promise<{ podium: PodiumEntry[]; agents: AgentRank[] } | null> => {
      const result = await apiFetch('/leaderboard');
      if (!result.success || !Array.isArray(result.data)) return null;
      const dataArr = result.data as any[];
      const top3 = dataArr.slice(0, 3).map((a: any, i: number) => ({
        rank: i + 1,
        initials: (a.name || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        name: a.name || `Agent #${a.id || i + 1}`,
        tasks: a.tasks || 0,
        color: i === 0 ? 'amber' : i === 1 ? 'green' : 'purple',
        height: i === 0 ? 120 : i === 1 ? 90 : 70,
        emoji: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
      }));
      const rest = dataArr.slice(3).map((a: any, i: number) => ({
        rank: i + 4,
        initials: (a.name || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        name: a.name || `Agent #${a.id || i + 4}`,
        detail: `${a.zone || 'Zone N'} · ${a.tasks || 0} tasks · ${a.rating || '4.5'}⭐`,
        earnings: a.earnings ? `₹${a.earnings.toLocaleString('en-IN')}` : '₹0',
        color: i % 2 === 0 ? 'green' : i % 2 === 1 ? 'amber' : 'blue',
        isYou: !!a.isYou,
      }));
      if (top3.length < 3 || rest.length === 0) return null;
      return { podium: top3, agents: rest };
    },
    { podium: FALLBACK_PODIUM, agents: FALLBACK_AGENTS },
    3000,
  );
  const podium = data.podium;
  const agents = data.agents;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topNav, { paddingTop: top + spacing.smd, backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topNavTitle, { color: colors.text }]}>Leaderboard</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.amber} />
        </View>
      ) : (
        <ScrollView style={[styles.scroll, { backgroundColor: colors.surface }]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[colors.amber, '#D98A00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <Text style={styles.heroLabel}>Your Rank</Text>
            <Text style={styles.heroRank}>#{agents.find((a) => a.isYou)?.rank || 7}</Text>
            <Text style={styles.heroName}>
              {agents.find((a) => a.isYou)?.name || 'Sunil Verma'} · {agents.find((a) => a.isYou)?.detail.split('·')[0]?.trim() || 'Zone 4'}
            </Text>
            <View style={styles.heroStats}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>{agents.find((a) => a.isYou)?.detail.match(/(\d+)\s*tasks/)?.[1] || '134'}</Text>
                <Text style={styles.heroStatLabel}>Tasks Done</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>{agents.find((a) => a.isYou)?.detail.match(/([\d.]+)⭐/)?.[1] || '4.8'}⭐</Text>
                <Text style={styles.heroStatLabel}>Rating</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.heroStatValue}>{agents.find((a) => a.isYou)?.earnings || '₹3,240'}</Text>
                <Text style={styles.heroStatLabel}>This Month</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>Top Performers</Text>
          </View>

          <View style={styles.podiumRow}>
            {podium.map((p) => (
              <View key={p.rank} style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, { backgroundColor: iconBgMap[p.color] }]}>
                  <Text style={{ fontSize: p.rank === 1 ? 20 : 16, fontWeight: '700', color: iconColorMap[p.color] }}>{p.initials}</Text>
                </View>
                <Text style={[styles.podiumName, { color: colors.text }]}>{p.name}</Text>
                <Text style={[styles.podiumTasks, { color: colors.text3 }]}>{p.tasks} tasks</Text>
                <View style={[styles.podiumBar, { height: p.height, backgroundColor: iconBgMap[p.color] }]}>
                  <Text style={{ fontWeight: '700', fontSize: p.rank === 1 ? 16 : 13, color: iconColorMap[p.color] }}>{p.emoji} #{p.rank}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text3 }]}>All Agents</Text>
          </View>

          {agents.map((agent, i) => (
            <View
              key={i}
              style={[
                styles.rankItem,
                agent.isYou && { backgroundColor: colors.amberBg, borderLeftWidth: 3, borderLeftColor: colors.amber },
              ]}
            >
              <Text style={[styles.rankNum, { color: agent.isYou ? colors.amber : colors.text3 }]}>#{agent.rank}</Text>
              <View style={[styles.rankAvatar, { backgroundColor: agent.isYou ? colors.amber : iconBgMap[agent.color] }]}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: agent.isYou ? '#fff' : iconColorMap[agent.color] }}>{agent.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankName, { color: colors.text }]}>
                  {agent.name}{agent.isYou ? <Text style={{ fontSize: 10, color: colors.amber, fontWeight: '600' }}> (You)</Text> : null}
                </Text>
                <Text style={[styles.rankDetail, { color: colors.text3 }]}>{agent.detail}</Text>
              </View>
              <View style={[styles.rankBadge, { backgroundColor: iconBgMap[agent.color] }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: iconColorMap[agent.color] }}>{agent.earnings}</Text>
              </View>
            </View>
          ))}

          <View style={{ height: spacing.xl5 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl3, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: radii.full, justifyContent: 'center', alignItems: 'center' },
  topNavTitle: { fontSize: 17, fontWeight: '700', marginLeft: spacing.smd },
  scroll: { flex: 1 }, scrollContent: { paddingBottom: 64 },
  heroCard: { margin: spacing.lg, borderRadius: radii.xl, padding: spacing.xl4, alignItems: 'center' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroRank: { fontSize: 40, fontWeight: '800', color: '#fff', marginTop: spacing.sm },
  heroName: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  heroStats: { flexDirection: 'row', gap: spacing.xl4, marginTop: spacing.lg },
  heroStatValue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionHeader: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl4, paddingBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  podiumRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'flex-end' },
  podiumItem: { flex: 1, alignItems: 'center' },
  podiumAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  podiumName: { fontWeight: '600', fontSize: 12 },
  podiumTasks: { fontSize: 10, marginTop: 2 },
  podiumBar: { width: '100%', borderRadius: radii.sm + 4, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing.sm },
  rankItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xl + 2, paddingHorizontal: spacing.xxl, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  rankNum: { width: 28, fontWeight: '800', fontSize: 14 },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  rankName: { fontWeight: '600', fontSize: 14 },
  rankDetail: { fontSize: 11, marginTop: 2 },
  rankBadge: { paddingHorizontal: spacing.md + 2, paddingVertical: spacing.xs, borderRadius: radii.full },
});
