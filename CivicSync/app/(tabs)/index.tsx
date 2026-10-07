import React, { useEffect, useState, useCallback } from 'react';
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
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  issue_id?: string;
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
  const [aqiLoading, setAqiLoading] = useState(true);
  const [aqiData, setAqiData] = useState({ value: 0, status: 'Loading...', location: 'Locating...' });

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

  const getAqiStatus = (aqi: number) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy/Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  };

  const fetchAqi = useCallback(async () => {
    try {
      setAqiLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAqiData({ value: 0, status: 'Perm Denied', location: 'Unknown' });
        setAqiLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;

      let locName = 'Your Area';
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (geo && geo.length > 0) {
          locName = geo[0].city || geo[0].district || geo[0].region || 'Your Area';
        }
      } catch (e) {
        console.log('Geocode error', e);
      }

      const res = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`
      );
      const data = await res.json();

      if (data && data.current && data.current.us_aqi !== undefined) {
        const aqiValue = data.current.us_aqi;
        setAqiData({
          value: Math.round(aqiValue),
          status: getAqiStatus(aqiValue),
          location: locName,
        });
      } else {
        setAqiData({ value: 0, status: 'Unavailable', location: locName });
      }
    } catch (err) {
      console.log('AQI Fetch error', err);
      setAqiData({ value: 0, status: 'Error', location: 'Unknown' });
    } finally {
      setAqiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    fetchAqi();
  }, [fetchAqi]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchIssues(), fetchAqi()]);
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
            {aqiLoading ? (
              <ActivityIndicator size="small" color="#fff" style={{ alignSelf: 'flex-start', marginVertical: 4 }} />
            ) : (
              <Text style={styles.airQualityValue}>{aqiData.status}</Text>
            )}
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>{aqiData.location}</Text>
            </View>
          </View>

          <View style={styles.airQualityRight}>
            {aqiLoading ? (
              <Text style={styles.aqi}>-</Text>
            ) : (
              <Text style={styles.aqi}>{aqiData.value}</Text>
            )}
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
  avatarButton: {
    padding: 2,
  },
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
  airQualityLeft: { flex: 1, marginRight: 10 },
  airQualityLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  airQualityValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginVertical: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationIcon: { fontSize: 12, marginRight: 4 },
  locationText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  airQualityRight: { alignItems: 'center', justifyContent: 'center' },
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

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
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
