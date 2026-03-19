import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const CATEGORIES = [
  { label: 'Road Maintenance', emoji: '🛣️' },
  { label: 'Waste Management', emoji: '🗑️' },
  { label: 'Street Lighting', emoji: '💡' },
  { label: 'Water Supply', emoji: '💧' },
  { label: 'Public Safety', emoji: '🚨' },
  { label: 'Parks & Recreation', emoji: '🌳' },
  { label: 'Other', emoji: '📌' },
];

export default function ReportScreen() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('Current Location');
  const [locationAddress, setLocationAddress] = useState('Fetching location...');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationAddress('Location permission denied');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });

      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (addr) {
        const formatted = [addr.streetNumber, addr.street, addr.city, addr.region]
          .filter(Boolean)
          .join(', ');
        setLocationAddress(formatted || '245 Market St, San Francisco, CA');
        setLocation(formatted || '245 Market St, San Francisco, CA');
      }
    } catch {
      setLocationAddress('245 Market St, San Francisco, CA');
    }
    setLocationLoading(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Info', 'Please enter a title for the issue.');
      return;
    }
    if (!category) {
      Alert.alert('Missing Info', 'Please select a category.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please describe the issue.');
      return;
    }

    setLoading(true);

    let imageUrl: string | null = null;

    // Upload image if selected
    if (imageUri) {
      try {
        const fileName = `issue_${Date.now()}.jpg`;
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('issue-images')
          .upload(fileName, blob, { contentType: 'image/jpeg' });

        if (!uploadError && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('issue-images')
            .getPublicUrl(uploadData.path);
          imageUrl = publicUrl;
        }
      } catch (e) {
        console.warn('Image upload failed, proceeding without image');
      }
    }

    // Insert issue into Supabase
    const { error } = await supabase.from('issues').insert({
      title: title.trim(),
      description: description.trim(),
      category,
      location_address: locationAddress,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      status: 'open',
      image_url: imageUrl,
      user_id: user?.id,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Submission Failed', error.message);
    } else {
      Alert.alert(
        '✅ Issue Reported!',
        'Your issue has been submitted successfully. Our team will look into it.',
        [{ text: 'OK', onPress: resetForm }]
      );
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setImageUri(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Report an Issue</Text>
          <Text style={styles.headerSubtitle}>Help improve your community</Text>
        </View>

        {/* Evidence / Photo Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Evidence</Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.evidenceRow}>
              <TouchableOpacity style={styles.evidenceButton} onPress={pickImage}>
                <Text style={styles.evidenceIcon}>🖼️</Text>
                <Text style={styles.evidenceLabel}>Upload Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.evidenceButton} onPress={takePhoto}>
                <Text style={styles.evidenceIcon}>📷</Text>
                <Text style={styles.evidenceLabel}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Issue Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Issue Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief title of the issue"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <TouchableOpacity style={styles.locationCard} onPress={getLocation}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>Current Location</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {locationLoading ? 'Fetching location...' : locationAddress}
              </Text>
            </View>
            {locationLoading ? (
              <ActivityIndicator size="small" color="#1a3c70" />
            ) : (
              <Text style={styles.refreshIcon}>🔄</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Category *</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.categoryChip,
                  category === cat.label && styles.categoryChipActive,
                ]}
                onPress={() => setCategory(cat.label)}>
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.label && styles.categoryLabelActive,
                  ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Issue Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the issue in detail so we can address it more effectively..."
            placeholderTextColor="#94A3B8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            By submitting, you agree to the CivicSync{' '}
            <Text style={styles.disclaimerLink}>Terms of Service</Text>
            {' '}and data privacy policies.
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },

  header: {
    backgroundColor: '#1a3c70',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },

  // Evidence
  evidenceRow: { flexDirection: 'row', gap: 12 },
  evidenceButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  evidenceIcon: { fontSize: 28 },
  evidenceLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  imagePreviewContainer: { position: 'relative' },
  imagePreview: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#E2E8F0' },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Inputs
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F1B35',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },

  // Location
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: { fontSize: 24 },
  locationInfo: { flex: 1 },
  locationTitle: { fontSize: 13, fontWeight: '700', color: '#0F1B35', marginBottom: 2 },
  locationAddress: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  refreshIcon: { fontSize: 18 },

  // Categories
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  categoryChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1a3c70',
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  categoryLabelActive: { color: '#1a3c70' },

  // Disclaimer
  disclaimer: { marginHorizontal: 20, marginTop: 16 },
  disclaimerText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  disclaimerLink: { color: '#1a3c70', fontWeight: '600' },

  // Submit
  submitButton: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#1a3c70',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#1a3c70',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
