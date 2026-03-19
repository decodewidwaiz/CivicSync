import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  issue_id: string;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'Road Maintenance': '🛣️',
  'Waste Management': '🗑️',
  'Street Lighting': '💡',
  'Water Supply': '💧',
  'Public Safety': '🚨',
  'Parks & Recreation': '🌳',
  Other: '📌',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#EF4444',
  in_progress: '#F59E0B',
  resolved: '#10B981',
  closed: '#6B7280',
};

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, resolved: 0, open: 0 });

  const userName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';

  const fetchIssues = async () => {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setIssues(data as Issue[]);
      setStats({
        total: data.length,
        resolved: data.filter((i) => i.status === 'resolved').length,
        open: data.filter((i) => i.status === 'open').length,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIssues();
    setRefreshing(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (mins > 0) return `${mins} min${mins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a3c70" />}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.nameText}>Hello, {userName} 👋</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.avatarButton}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Air Quality Card */}
        <View style={styles.airQualityCard}>
          <View style={styles.airQualityLeft}>
            <Text style={styles.airQualityLabel}>Current Air Quality</Text>
            <Text style={styles.airQualityValue}>Good</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>Downtown District</Text>
            </View>
          </View>
          <View style={styles.airQualityRight}>
            <Text style={styles.aqi}>42</Text>
            <Text style={styles.aqiLabel}>AQI</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statNumber, { color: '#1a3c70' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.open}</Text>
            <Text style={styles.statLabel}>Open Issues</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/report')}>
              <Text style={styles.quickActionIcon}>📋</Text>
              <Text style={styles.quickActionLabel}>Report Issue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/map')}>
              <Text style={styles.quickActionIcon}>🗺️</Text>
              <Text style={styles.quickActionLabel}>View Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Text style={styles.quickActionIcon}>📊</Text>
              <Text style={styles.quickActionLabel}>My Issues</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction}>
              <Text style={styles.quickActionIcon}>🔔</Text>
              <Text style={styles.quickActionLabel}>Alerts</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/map')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1a3c70" />
              <Text style={styles.loadingText}>Loading issues...</Text>
            </View>
          ) : issues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No issues reported yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to report a community issue!</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/report')}>
                <Text style={styles.emptyButtonText}>+ Report an Issue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            issues.map((issue) => (
              <View key={issue.id} style={styles.activityCard}>
                <View style={styles.activityIconContainer}>
                  <Text style={styles.activityEmoji}>
                    {CATEGORY_EMOJIS[issue.category] ?? '📌'}
                  </Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{issue.category}</Text>
                  <Text style={styles.activityDesc} numberOfLines={1}>{issue.title}</Text>
                  <View style={styles.activityMeta}>
                    <Text style={styles.activityTime}>{formatTimeAgo(issue.created_at)}</Text>
                    <Text style={styles.activityDot}>·</Text>
                    <Text style={styles.activityCode}>#{issue.id.slice(0, 8).toUpperCase()}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[issue.status] ?? '#6B7280') + '20' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[issue.status] ?? '#6B7280' }]}>
                    {issue.status === 'in_progress' ? 'Active' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Community Map Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Map</Text>
          <TouchableOpacity
            style={styles.mapPreview}
            onPress={() => router.push('/(tabs)/map')}>
            <Text style={styles.mapEmoji}>🗺️</Text>
            <Text style={styles.mapPreviewText}>Tap to view community issues map</Text>
            <Text style={styles.mapArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 16,
  },
  welcomeText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  nameText: { fontSize: 22, fontWeight: '800', color: '#0F1B35', marginTop: 2 },
  avatarButton: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a3c70',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Air Quality
  airQualityCard: {
    marginHorizontal: 20,
    backgroundColor: '#1a3c70',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1a3c70',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  airQualityLeft: { flex: 1 },
  airQualityLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 4 },
  airQualityValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationIcon: { fontSize: 12 },
  locationText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  airQualityRight: { alignItems: 'center' },
  aqi: { color: '#4ADE80', fontSize: 40, fontWeight: '900' },
  aqiLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: -4 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statNumber: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '500', textAlign: 'center' },

  // Sections
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F1B35', marginBottom: 14 },
  seeAll: { fontSize: 13, color: '#1a3c70', fontWeight: '600' },

  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickAction: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickActionIcon: { fontSize: 28, marginBottom: 8 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },

  // Activity Cards
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityEmoji: { fontSize: 22 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700', color: '#0F1B35', marginBottom: 2 },
  activityDesc: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityTime: { fontSize: 11, color: '#94A3B8' },
  activityDot: { fontSize: 11, color: '#94A3B8' },
  activityCode: { fontSize: 11, color: '#1a3c70', fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Map Preview
  mapPreview: {
    backgroundColor: '#1a3c70',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mapEmoji: { fontSize: 32 },
  mapPreviewText: { flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  mapArrow: { color: '#fff', fontSize: 20, fontWeight: '700' },

  // Loading & Empty states
  loadingContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F1B35', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  emptyButton: {
    backgroundColor: '#1a3c70',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
