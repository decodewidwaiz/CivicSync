import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GEOAPIFY_API_KEY,
  fetchNearbyPlaces,
  CIVIC_AMENITY_CONFIG,
  type CivicAmenityCategory,
  type GeoapifyMapStyle,
} from '@/lib/geoapify';

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  location_address?: string;
  created_at: string;
  lat?: number;
  lng?: number;
}

export interface CivicMapLibreProps {
  issues: CivicIssue[];
  selectedIssue: CivicIssue | null;
  onSelectIssue: (issue: CivicIssue | null) => void;
  categoryEmojis: Record<string, string>;
  statusColors: Record<string, { bg: string; text: string; label: string }>;
  initialCenter?: [number, number]; // [lng, lat]
}

export default function CivicMapLibreWeb({
  issues,
  selectedIssue,
  onSelectIssue,
  categoryEmojis,
  statusColors,
  initialCenter = [77.2090, 28.6139],
}: CivicMapLibreProps) {
  const [mapStyle, setMapStyle] = useState<GeoapifyMapStyle>('osm-bright');
  const [activeAmenity, setActiveAmenity] = useState<CivicAmenityCategory | null>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Generate interactive Leaflet HTML for web
  const centerLat = selectedIssue?.lat ?? initialCenter[1];
  const centerLng = selectedIssue?.lng ?? initialCenter[0];
  const zoom = selectedIssue ? 16 : 13;

  const handleToggleAmenity = async (cat: CivicAmenityCategory) => {
    if (activeAmenity === cat) {
      setActiveAmenity(null);
      setAmenities([]);
      return;
    }

    setActiveAmenity(cat);
    setLoadingAmenities(true);

    const config = CIVIC_AMENITY_CONFIG[cat];
    const data = await fetchNearbyPlaces({
      lat: centerLat,
      lon: centerLng,
      categories: config.categories,
      radiusMeters: 3000,
      limit: 20,
    });

    if (data?.features) {
      setAmenities(data.features);
    }
    setLoadingAmenities(false);
  };

  const iframeSrcDoc = useMemo(() => {
    const tileStyle = mapStyle === 'dark-matter' ? 'dark-matter-purple-roads' : 'osm-bright';
    const tileUrl = `https://maps.geoapify.com/v1/tile/${tileStyle}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

    const issueMarkersJs = issues
      .filter((i) => i.lat && i.lng)
      .map((i) => {
        const color = statusColors[i.status]?.text || '#EF4444';
        const emoji = categoryEmojis[i.category] || '📌';
        return `
          L.marker([${i.lat}, ${i.lng}], {
            icon: L.divIcon({
              className: 'custom-pin',
              html: '<div style="background:#fff;border:2.5px solid ${color};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;">${emoji}</div>',
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            })
          }).addTo(map).bindPopup("<b>${i.title.replace(/"/g, '&quot;')}</b><br/><span style='color:${color};font-weight:bold;'>${statusColors[i.status]?.label || i.status}</span>");
        `;
      })
      .join('\n');

    const amenityMarkersJs = amenities
      .filter((a) => a.geometry?.coordinates)
      .map((a) => {
        const [lon, lat] = a.geometry.coordinates;
        const color = activeAmenity ? CIVIC_AMENITY_CONFIG[activeAmenity].color : '#3B82F6';
        const name = (a.properties?.name || a.properties?.formatted || 'Civic Facility').replace(/"/g, '&quot;');
        return `
          L.circleMarker([${lat}, ${lon}], {
            radius: 8,
            fillColor: "${color}",
            color: "#ffffff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map).bindPopup("<b>${name}</b>");
        `;
      })
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            html, body, #map { height: 100%; margin: 0; padding: 0; background: #0f172a; }
            .leaflet-popup-content-wrapper { border-radius: 10px; font-family: sans-serif; font-size: 13px; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], ${zoom});
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            L.tileLayer('${tileUrl}', {
              maxZoom: 20,
              attribution: 'Powered by Geoapify | © OpenStreetMap contributors'
            }).addTo(map);

            ${issueMarkersJs}
            ${amenityMarkersJs}
          </script>
        </body>
      </html>
    `;
  }, [issues, amenities, mapStyle, centerLat, centerLng, zoom, activeAmenity, categoryEmojis, statusColors]);

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={iframeSrcDoc}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        title="Civic Community Map"
      />

      {/* Top Floating Controls */}
      <View style={styles.topControlsContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setMapStyle((prev) => (prev === 'osm-bright' ? 'dark-matter' : 'osm-bright'))}
          activeOpacity={0.8}
        >
          <Ionicons
            name={mapStyle === 'dark-matter' ? 'sunny' : 'moon'}
            size={18}
            color="#1E293B"
          />
          <Text style={styles.buttonLabel}>
            {mapStyle === 'dark-matter' ? 'Light' : 'Dark'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Amenity Filter Quick Pills */}
      <View style={styles.amenityBarContainer}>
        {(Object.keys(CIVIC_AMENITY_CONFIG) as CivicAmenityCategory[]).map((cat) => {
          const cfg = CIVIC_AMENITY_CONFIG[cat];
          const isActive = activeAmenity === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.amenityChip,
                isActive && { backgroundColor: cfg.color, borderColor: cfg.color },
              ]}
              onPress={() => handleToggleAmenity(cat)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={cfg.icon as any}
                size={14}
                color={isActive ? '#FFFFFF' : '#475569'}
              />
              <Text
                style={[
                  styles.amenityChipText,
                  isActive && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Loading Banner */}
      {loadingAmenities && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingBannerText}>Finding nearby civic facilities...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  topControlsContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  amenityBarContainer: {
    position: 'absolute',
    top: 60,
    left: 14,
    right: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 20,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  amenityChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  loadingBanner: {
    position: 'absolute',
    top: 105,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 20,
  },
  loadingBannerText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
});
