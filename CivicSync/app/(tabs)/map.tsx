import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import CustomMap from '@/components/CustomMap';
import { supabase } from '@/lib/supabase';

 

interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  location_address: string;
  created_at: string;
  lat?: number;
  lng?: number;
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

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: '#FEF2F2', text: '#EF4444', label: 'Open' },
  in_progress: { bg: '#FFFBEB', text: '#D97706', label: 'In Progress' },
  resolved: { bg: '#F0FDF4', text: '#16A34A', label: 'Resolved' },
  closed: { bg: '#F9FAFB', text: '#6B7280', label: 'Closed' },
};



export default function MapScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    const { data } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setIssues(data as Issue[]);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchIssues();
    setRefreshing(false);
  };

  const categories = ['All', ...Array.from(new Set(issues.map((i) => i.category)))];

  const filtered = selectedCategory === 'All'
    ? issues
    : issues.filter((i) => i.category === selectedCategory);

  const openMaps = (issue: Issue) => {
    const addr = encodeURIComponent(issue.location_address ?? issue.title);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${addr}`
      : `geo:0,0?q=${addr}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${addr}`)
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🗺️ Community Map</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Loading...' : `${issues.length} issue${issues.length !== 1 ? 's' : ''} in your community`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => router.push('/(tabs)/report')}>
          <Text style={styles.reportButtonText}>+ Report</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={[styles.mapPlaceholder, { flex: 1 }]}>
            <Text style={styles.mapBg}>🗺️</Text>
            <Text style={{ marginTop: 20, color: '#1a3c70', fontWeight: 'bold' }}>
              Interactive Map unavailable on Web (Use Expo Go)
            </Text>
          </View>
        ) : (
          <CustomMap 
             issues={filtered}
             selectedIssueId={selectedIssue?.id || null}
             onSelectIssue={setSelectedIssue}
             categoryEmojis={CATEGORY_EMOJIS}
             statusColors={STATUS_COLORS}
          />
        )}

        {/* Selected Issue Overlay */}
        {selectedIssue && (
          <TouchableOpacity 
            style={styles.mapIdBadge}
            onPress={() => openMaps(selectedIssue)}
          >
            <Text style={styles.mapIdText} numberOfLines={1}>
              {selectedIssue.title}
            </Text>
            <Text style={styles.calloutLink}>Tap to navigate ↗</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat)}>
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
              {cat === 'All' ? '🌐 All' : `${CATEGORY_EMOJIS[cat] ?? '📌'} ${cat}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Issues List */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a3c70" />}>
        <Text style={styles.listTitle}>Reported Issues</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1a3c70" />
            <Text style={styles.loadingText}>Fetching issues from database...</Text>
          </View>
        ) : issues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No issues reported yet</Text>
            <Text style={styles.emptySubtitle}>Community issues will appear here once reported.</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/report')}>
              <Text style={styles.emptyButtonText}>+ Report First Issue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && filtered.map((issue) => {
          const statusStyle = STATUS_COLORS[issue.status] ?? STATUS_COLORS.open;
          return (
            <TouchableOpacity
              key={issue.id}
              style={[styles.issueCard, selectedIssue?.id === issue.id && styles.issueCardSelected]}
              onPress={() => setSelectedIssue(issue === selectedIssue ? null : issue)}>
              <View style={styles.issueCardLeft}>
                <View style={styles.issueCategoryIcon}>
                  <Text style={{ fontSize: 22 }}>{CATEGORY_EMOJIS[issue.category] ?? '📌'}</Text>
                </View>
                <View style={styles.issueInfo}>
                  <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
                  <Text style={styles.issueLocation} numberOfLines={1}>
                    📍 {issue.location_address ?? 'Unknown location'}
                  </Text>
                  <Text style={styles.issueTime}>{formatTimeAgo(issue.created_at)}</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                  {statusStyle.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F1B35' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  reportButton: {
    backgroundColor: '#1a3c70',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reportButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  mapContainer: { height: 260, backgroundColor: '#E8F4F8' },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBg: { fontSize: 80, opacity: 0.15, position: 'absolute' },
  pinDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pinSelected: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderColor: '#fff',
    borderWidth: 3,
  },
  pinEmoji: { fontSize: 16 },
  calloutContainer: {
    width: 140,
    padding: 6,
    alignItems: 'center',
  },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: '#0F1B35', marginBottom: 2 },
  calloutStatus: { fontSize: 11, color: '#64748B', marginBottom: 4 },
  calloutLink: { fontSize: 11, color: '#1a3c70', fontWeight: '600' },
  mapIdBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#1a3c70',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mapIdText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Filters
  filtersContainer: { maxHeight: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#1a3c70', borderColor: '#1a3c70' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#fff' },

  // List
  listContainer: { flex: 1, paddingHorizontal: 16 },
  listTitle: { fontSize: 15, fontWeight: '700', color: '#0F1B35', marginVertical: 12 },
  issueCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  issueCardSelected: {
    borderColor: '#1a3c70',
    backgroundColor: '#EFF6FF',
  },
  issueCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  issueCategoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  issueInfo: { flex: 1 },
  issueTitle: { fontSize: 14, fontWeight: '700', color: '#0F1B35', marginBottom: 2 },
  issueLocation: { fontSize: 11, color: '#64748B', marginBottom: 2 },
  issueTime: { fontSize: 11, color: '#94A3B8' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 0,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  // Loading & Empty
  loadingContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    margin: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F1B35', marginBottom: 6 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 16 },
  emptyButton: {
    backgroundColor: '#1a3c70',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
