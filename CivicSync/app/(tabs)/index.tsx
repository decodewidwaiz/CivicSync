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

  const [aqiValue, setAqiValue] = useState("--");
  const [aqiStatus, setAqiStatus] = useState("Loading...");
  const [location, setLocation] = useState("Fetching location...");

  const API_KEY = "1a192eb540b9e042b3207edc7b7e1db5";

  const getAQIStatus = (aqi: number) => {
    if (aqi === 1) return "Good";
    if (aqi === 2) return "Fair";
    if (aqi === 3) return "Moderate";
    if (aqi === 4) return "Poor";
    return "Very Poor";
  };

  const fetchAQI = async () => {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=20.2961&lon=85.8245&appid=${API_KEY}`
      );
      const data = await res.json();
      const aqi = data.list[0].main.aqi;

      setAqiValue(aqi.toString());
      setAqiStatus(getAQIStatus(aqi));
      setLocation("Bhubaneswar");
    } catch (err) {
      console.error(err);
    }
  };

  const userName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';

  const fetchIssues = async () => {
    const { data } = await supabase
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
    fetchAQI();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIssues();
    await fetchAQI();
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

        <View style={styles.airQualityCard}>
          <View style={styles.airQualityLeft}>
            <Text style={styles.airQualityLabel}>Current Air Quality</Text>
            <Text style={styles.airQualityValue}>{aqiStatus}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{location}</Text>
            </View>
          </View>

          <View style={styles.airQualityRight}>
            <Text style={styles.aqi}>{aqiValue}</Text>
            <Text style={styles.aqiLabel}>AQI</Text>
          </View>
        </View>

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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },

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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a3c70',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  airQualityCard: {
    marginHorizontal: 20,
    backgroundColor: '#1a3c70',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  airQualityLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  airQualityValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  aqi: { color: '#4ADE80', fontSize: 40, fontWeight: '900' },
  aqiLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  statsRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#64748B' },

  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  seeAll: { fontSize: 13, color: '#1a3c70' },

  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 10,
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
  activityTitle: { fontSize: 14, fontWeight: '700' },
  activityDesc: { fontSize: 12, color: '#64748B' },
  activityMeta: { flexDirection: 'row', alignItems: 'center' },
  activityTime: { fontSize: 11, color: '#94A3B8' },
  activityDot: { marginHorizontal: 4 },
  activityCode: { fontSize: 11 },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },

  loadingContainer: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { fontSize: 14, color: '#94A3B8' },

  emptyContainer: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, color: '#94A3B8' },

  emptyButton: { backgroundColor: '#1a3c70', padding: 12, borderRadius: 12 },
  emptyButtonText: { color: '#fff' },
});
