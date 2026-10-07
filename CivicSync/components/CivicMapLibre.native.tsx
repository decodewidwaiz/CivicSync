import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import CivicMapWebView from './CivicMapWebView';
import {
  getMapStyleUrl,
  fetchNearbyPlaces,
  CIVIC_AMENITY_CONFIG,
  type CivicAmenityCategory,
  type GeoapifyMapStyle,
} from '@/lib/geoapify';

let MLRN: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MLRN = require('@maplibre/maplibre-react-native');
} catch {
  MLRN = null;
}

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

// Default center: New Delhi, India
const DEFAULT_CENTER: [number, number] = [77.2090, 28.6139];

export default function CivicMapLibre(props: CivicMapLibreProps) {
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === 'expo' ||
    !MLRN ||
    !MLRN.Map;

  if (isExpoGo) {
    return <CivicMapWebView {...props} />;
  }

  return <NativeMapLibreRenderer {...props} />;
}

function NativeMapLibreRenderer({
  issues,
  selectedIssue,
  onSelectIssue,
  categoryEmojis,
  statusColors,
  initialCenter = DEFAULT_CENTER,
}: CivicMapLibreProps) {
  const { Map, Camera, Marker, GeoJSONSource, Layer } = MLRN;
  const cameraRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<GeoapifyMapStyle>('osm-bright');
  const [currentCenter] = useState<[number, number]>(initialCenter);
  const [activeAmenity, setActiveAmenity] = useState<CivicAmenityCategory | null>(null);
  const [amenityData, setAmenityData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  const moveCamera = useCallback((coords: [number, number], zoom = 15) => {
    const ref = cameraRef.current;
    if (!ref) return;
    try {
      if (typeof ref.flyTo === 'function') {
        ref.flyTo({ center: coords, zoom, duration: 1200 });
      } else if (typeof ref.easeTo === 'function') {
        ref.easeTo({ center: coords, zoom, duration: 800 });
      } else if (typeof ref.jumpTo === 'function') {
        ref.jumpTo({ center: coords, zoom });
      } else if (typeof ref.setCamera === 'function') {
        ref.setCamera({
          centerCoordinate: coords,
          zoomLevel: zoom,
          animationDuration: 1000,
        });
      }
    } catch (e) {
      console.log('Camera move error:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && isMounted) {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown && isMounted && !selectedIssue) {
            const coords: [number, number] = [lastKnown.coords.longitude, lastKnown.coords.latitude];
            setUserCoords(coords);
            moveCamera(coords, 15);
          }

          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted) {
            const coords: [number, number] = [loc.coords.longitude, loc.coords.latitude];
            setUserCoords(coords);
            if (!selectedIssue) {
              moveCamera(coords, 15);
            }
          }
        }
      } catch (e) {
        console.log('Location permission error:', e);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedIssue, moveCamera]);

  useEffect(() => {
    if (selectedIssue?.lng && selectedIssue?.lat) {
      const lng = Number(selectedIssue.lng);
      const lat = Number(selectedIssue.lat);
      if (!isNaN(lng) && !isNaN(lat)) {
        moveCamera([lng, lat], 16);
      }
    }
  }, [selectedIssue, moveCamera]);

  const handleToggleAmenity = useCallback(async (cat: CivicAmenityCategory) => {
    if (activeAmenity === cat) {
      setActiveAmenity(null);
      setAmenityData(null);
      return;
    }

    setActiveAmenity(cat);
    setLoadingAmenities(true);

    const centerToUse = selectedIssue?.lng && selectedIssue?.lat 
      ? [Number(selectedIssue.lng), Number(selectedIssue.lat)]
      : (userCoords || currentCenter);

    const [lon, lat] = centerToUse;
    const config = CIVIC_AMENITY_CONFIG[cat];

    const data = await fetchNearbyPlaces({
      lat,
      lon,
      categories: config.categories,
      radiusMeters: 2500,
      limit: 20,
    });

    setAmenityData(data);
    setLoadingAmenities(false);
  }, [activeAmenity, selectedIssue, userCoords, currentCenter]);

  const handleRecenter = () => {
    if (userCoords) {
      moveCamera(userCoords, 15);
    }
  };

  const toggleMapTheme = () => {
    setMapStyle((prev) => (prev === 'osm-bright' ? 'dark-matter' : 'osm-bright'));
  };

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={getMapStyleUrl(mapStyle)}
        attributionPosition={{ bottom: 8, right: 8 }}
        logoPosition={{ bottom: 8, left: 8 }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: userCoords || initialCenter,
            zoom: 14,
          }}
        />

        {amenityData && activeAmenity && (
          <GeoJSONSource id="amenities-source" data={amenityData}>
            <Layer
              id="amenity-circles"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': CIVIC_AMENITY_CONFIG[activeAmenity].color,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#FFFFFF',
                'circle-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
        )}

        {issues.map((issue) => {
          if (!issue?.lat || !issue?.lng) return null;
          const latNum = Number(issue.lat);
          const lngNum = Number(issue.lng);
          if (isNaN(latNum) || isNaN(lngNum)) return null;

          const isSelected = selectedIssue?.id === issue.id;
          const statusColor = statusColors?.[issue.status]?.text ?? '#EF4444';
          const emoji = categoryEmojis?.[issue.category] ?? '📌';

          return (
            <Marker
              key={issue.id}
              id={`issue-${issue.id}`}
              lngLat={[lngNum, latNum]}
              anchor="bottom"
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onSelectIssue(isSelected ? null : issue)}
                style={[
                  styles.markerWrapper,
                  isSelected && styles.markerWrapperSelected,
                ]}
              >
                {isSelected && (
                  <View style={styles.calloutBubble}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {issue.title}
                    </Text>
                    <View style={styles.calloutBadge}>
                      <Text style={[styles.calloutStatus, { color: statusColor }]}>
                        {statusColors?.[issue.status]?.label ?? issue.status}
                      </Text>
                    </View>
                  </View>
                )}
                <View
                  style={[
                    styles.pinHead,
                    { borderColor: statusColor },
                    isSelected && { transform: [{ scale: 1.15 }] },
                  ]}
                >
                  <Text style={styles.pinEmoji}>{emoji}</Text>
                </View>
                <View style={[styles.pinPoint, { borderTopColor: statusColor }]} />
              </TouchableOpacity>
            </Marker>
          );
        })}

        {userCoords && (
          <Marker id="user-location" lngLat={userCoords} anchor="center">
            <View style={styles.userDotPulse}>
              <View style={styles.userDot} />
            </View>
          </Marker>
        )}
      </Map>

      <View style={styles.topControlsContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={toggleMapTheme}
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

        {userCoords && (
          <TouchableOpacity
            style={styles.floatingButton}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={18} color="#2563EB" />
            <Text style={[styles.buttonLabel, { color: '#2563EB' }]}>My Location</Text>
          </TouchableOpacity>
        )}
      </View>

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
  },
  map: {
    flex: 1,
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
  markerWrapper: {
    alignItems: 'center',
  },
  markerWrapperSelected: {
    zIndex: 100,
  },
  calloutBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    maxWidth: 160,
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  calloutBadge: {
    marginTop: 2,
  },
  calloutStatus: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  pinHead: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pinEmoji: {
    fontSize: 15,
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
  },
  userDotPulse: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
