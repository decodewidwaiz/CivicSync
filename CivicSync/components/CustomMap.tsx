import React from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from 'react-native';

interface CustomMapProps {
  issues: any[];
  onSelectIssue: (issue: any) => void;
  selectedIssueId: string | null;
  categoryEmojis: Record<string, string>;
  statusColors: Record<string, { bg: string; text: string; label: string }>;
}

export default function CustomMap({ issues, onSelectIssue, selectedIssueId, categoryEmojis, statusColors }: CustomMapProps) {
  // Bounding box for India approximate
  const MIN_LAT = 6.5;
  const MAX_LAT = 37.5;
  const MIN_LNG = 67.0;
  const MAX_LNG = 98.0;

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/India_location_map.svg/800px-India_location_map.svg.png' }}
        style={styles.mapImage}
        resizeMode="contain"
      >
        {issues.map((issue) => {
          if (!issue?.lat || !issue?.lng) return null;

          const latNum = Number(issue.lat);
          const lngNum = Number(issue.lng);

          if (isNaN(latNum) || isNaN(lngNum)) return null;

          // Normalize coordinates to 0-1 range based on bounding box
          let xPercent = (lngNum - MIN_LNG) / (MAX_LNG - MIN_LNG);
          let yPercent = (MAX_LAT - latNum) / (MAX_LAT - MIN_LAT);

          // If out of bounds of India, still show them but clamp to edges so they don't disappear completely
          xPercent = Math.max(0, Math.min(1, xPercent || 0));
          yPercent = Math.max(0, Math.min(1, yPercent || 0));

          const topPos = `${yPercent * 100}%` as any;
          const leftPos = `${xPercent * 100}%` as any;

          const isSelected = selectedIssueId === issue.id;

          return (
            <TouchableOpacity
              key={issue.id || Math.random().toString()}
              style={[
                styles.marker,
                { top: topPos, left: leftPos },
                isSelected && styles.markerSelected
              ]}
              onPress={() => onSelectIssue(issue)}
            >
              <View style={[
                styles.pinDot,
                { backgroundColor: statusColors?.[issue.status]?.text ?? '#EF4444' },
                isSelected && styles.pinSelected
              ]}>
                <Text style={styles.pinEmoji}>{categoryEmojis?.[issue.category] ?? '📌'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    overflow: 'hidden',
  },
  mapImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  marker: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -16 }], 
  },
  markerSelected: {
    zIndex: 10,
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
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
  pinEmoji: {
    fontSize: 16,
  },
});