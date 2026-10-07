import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
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

export interface CivicMapProps {
  issues: CivicIssue[];
  selectedIssue: CivicIssue | null;
  onSelectIssue: (issue: CivicIssue | null) => void;
  categoryEmojis: Record<string, string>;
  statusColors: Record<string, { bg: string; text: string; label: string }>;
  initialCenter?: [number, number]; // [lng, lat]
}

export default function CivicMapWebView({
  issues,
  selectedIssue,
  onSelectIssue,
  categoryEmojis,
  statusColors,
  initialCenter = [77.2090, 28.6139],
}: CivicMapProps) {
  const [mapStyle, setMapStyle] = useState<GeoapifyMapStyle>('osm-bright');
  const [activeAmenity, setActiveAmenity] = useState<CivicAmenityCategory | null>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            setUserCoords([lastKnown.coords.longitude, lastKnown.coords.latitude]);
          }
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords([loc.coords.longitude, loc.coords.latitude]);
        }
      } catch (e) {
        console.log('Location permission error in WebView map:', e);
      }
    })();
  }, []);

  const centerLat = selectedIssue?.lat ?? (userCoords ? userCoords[1] : initialCenter[1]);
  const centerLng = selectedIssue?.lng ?? (userCoords ? userCoords[0] : initialCenter[0]);
  const zoom = selectedIssue ? 16 : 14;

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

  const htmlContent = useMemo(() => {
    const tileStyle = mapStyle === 'dark-matter' ? 'dark-matter-purple-roads' : 'osm-bright';
    const tileUrl = `https://maps.geoapify.com/v1/tile/${tileStyle}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`;

    const issueMarkersJs = issues
      .filter((i) => i.lat && i.lng)
      .map((i) => {
        const color = statusColors[i.status]?.text || '#EF4444';
        const emoji = categoryEmojis[i.category] || '📌';
        const escapedTitle = (i.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const isSelected = selectedIssue?.id === i.id;
        const borderThickness = isSelected ? '4px' : '2.5px';
        const scale = isSelected ? 'transform:scale(1.2);' : '';

        return `
          (function() {
            var marker = L.marker([${i.lat}, ${i.lng}], {
              icon: L.divIcon({
                className: 'custom-pin',
                html: '<div style="background:#fff;border:${borderThickness} solid ${color};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 8px rgba(0,0,0,0.35);cursor:pointer;${scale}">${emoji}</div>',
                iconSize: [34, 34],
                iconAnchor: [17, 34]
              })
            }).addTo(map);

            marker.on('click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_ISSUE', id: '${i.id}' }));
              }
            });

            marker.bindPopup("<b>${escapedTitle}</b><br/><span style='color:${color};font-weight:bold;'>${statusColors[i.status]?.label || i.status}</span>");
          })();
        `;
      })
      .join('\n');

    const amenityMarkersJs = amenities
      .filter((a) => a.geometry?.coordinates)
      .map((a) => {
        const [lon, lat] = a.geometry.coordinates;
        const color = activeAmenity ? CIVIC_AMENITY_CONFIG[activeAmenity].color : '#3B82F6';
        const name = (a.properties?.name || a.properties?.formatted || 'Civic Facility')
          .replace(/'/g, "\\'")
          .replace(/"/g, '&quot;');
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0f172a; overflow: hidden; }
            .leaflet-popup-content-wrapper { border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .custom-pin { background: transparent; border: none; }
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
  }, [issues, amenities, mapStyle, centerLat, centerLng, zoom, activeAmenity, categoryEmojis, statusColors, selectedIssue]);

  const onMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'SELECT_ISSUE') {
        const found = issues.find((i) => i.id === msg.id);
        if (found) {
          onSelectIssue(found);
        }
      }
    } catch (e) {
      console.log('Error parsing webview message', e);
    }
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <iframe
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          title="Civic Community Map"
        />
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webview}
          onMessage={onMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}
        />
      )}

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
  webview: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
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
