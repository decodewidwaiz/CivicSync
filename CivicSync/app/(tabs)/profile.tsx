import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface Stats {
  total: number;
  open: number;
  resolved: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, open: 0, resolved: 0 });
  const [loading, setLoading] = useState(false);

  const fullName = user?.user_metadata?.full_name ?? 'Community Member';
  const email = user?.email ?? '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data } = await supabase
      .from('issues')
      .select('status')
      .eq('user_id', user?.id);

    if (data) {
      setStats({
        total: data.length,
        open: data.filter((i) => i.status === 'open').length,
        resolved: data.filter((i) => i.status === 'resolved').length,
      });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await signOut();
          setLoading(false);
        },
      },
    ]);
  };

  const menuItems = [
    { emoji: '📋', label: 'My Reported Issues', subtitle: `${stats.total} total reports` },
    { emoji: '🔔', label: 'Notifications', subtitle: 'Manage alerts' },
    { emoji: '🔐', label: 'Privacy & Security', subtitle: 'Password, data settings' },
    { emoji: '❓', label: 'Help & Support', subtitle: 'FAQs, contact us' },
    { emoji: '📄', label: 'Terms of Service', subtitle: 'Legal information' },
    { emoji: '🌐', label: 'About CivicSync', subtitle: 'Version 1.0.0' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>🏆 Community Member</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>Total{'\n'}Reports</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#EF4444' }]}>{stats.open}</Text>
            <Text style={styles.statLbl}>Open{'\n'}Issues</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#10B981' }]}>{stats.resolved}</Text>
            <Text style={styles.statLbl}>Resolved{'\n'}Issues</Text>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{fullName}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{email}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.label}>
                <TouchableOpacity style={styles.menuRow}>
                  <Text style={styles.menuEmoji}>{item.emoji}</Text>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
                {index < menuItems.length - 1 && <View style={styles.menuDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#EF4444" />
            ) : (
              <Text style={styles.signOutText}>🚪 Sign Out</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },

  profileHeader: {
    backgroundColor: '#1a3c70',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  memberBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  memberBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  statsContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '900', color: '#1a3c70', marginBottom: 4 },
  statLbl: { fontSize: 11, color: '#64748B', fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  statDivider: { width: 1, height: 40, backgroundColor: '#F1F5F9' },

  section: { marginHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F1B35', marginBottom: 12 },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#0F1B35', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  infoDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 16 },

  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600', color: '#0F1B35', marginBottom: 2 },
  menuSubtitle: { fontSize: 12, color: '#94A3B8' },
  menuArrow: { fontSize: 20, color: '#CBD5E1', fontWeight: '300' },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginLeft: 56 },

  signOutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
});
