/**
 * Geoapify API Service Layer for CivicSync
 * 
 * Scalability & Credit Optimization Guarantees:
 * - Always requests <= 20 places per query to cap Places API usage at 1 credit.
 * - In-memory cache for places and reverse geocoding to prevent duplicate network calls.
 * - Request deduplication for simultaneous calls.
 */

export const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || '';

export type GeoapifyMapStyle = 
  | 'osm-bright'
  | 'dark-matter'
  | 'osm-liberty'
  | 'positron'
  | 'klokantech-basic'
  | 'toner';

/**
 * Returns the vector tile style JSON URL for MapLibre
 */
export function getMapStyleUrl(style: GeoapifyMapStyle = 'osm-bright'): string {
  return `https://maps.geoapify.com/v1/styles/${style}/style.json?apiKey=${GEOAPIFY_API_KEY}`;
}

export type CivicAmenityCategory = 
  | 'public_safety'
  | 'healthcare'
  | 'waste_management'
  | 'public_service';

export const CIVIC_AMENITY_CONFIG: Record<
  CivicAmenityCategory, 
  { label: string; icon: string; color: string; categories: string }
> = {
  public_safety: {
    label: 'Police & Fire',
    icon: 'shield-checkmark',
    color: '#3B82F6',
    categories: 'service.police,emergency.fire_service',
  },
  healthcare: {
    label: 'Hospitals & Clinics',
    icon: 'medical',
    color: '#EF4444',
    categories: 'healthcare.hospital,healthcare.clinic',
  },
  waste_management: {
    label: 'Waste & Recycling',
    icon: 'trash',
    color: '#10B981',
    categories: 'service.waste_disposal,service.recycling',
  },
  public_service: {
    label: 'Civic Offices',
    icon: 'business',
    color: '#8B5CF6',
    categories: 'administrative',
  },
};

// In-Memory Cache for Places API (TTL: 10 minutes)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const placesCache = new Map<string, CacheEntry<GeoJSON.FeatureCollection>>();
const inFlightPlacesRequests = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches nearby civic amenities / places from Geoapify Places API.
 * Caps `limit` at 20 (strictly 1 credit per query) and uses spatial grid caching.
 */
export async function fetchNearbyPlaces(options: {
  lat: number;
  lon: number;
  categories: string;
  radiusMeters?: number;
  limit?: number;
}): Promise<GeoJSON.FeatureCollection | null> {
  const { lat, lon, categories, radiusMeters = 1500, limit = 20 } = options;

  if (!GEOAPIFY_API_KEY) {
    console.warn('[Geoapify] EXPO_PUBLIC_GEOAPIFY_API_KEY is not configured.');
    return null;
  }

  // Cap at 20 to preserve 1 credit quota
  const cappedLimit = Math.min(limit, 20);

  // Round coordinates to ~500m spatial grid for cache hits
  const gridLat = Math.round(lat * 200) / 200;
  const gridLon = Math.round(lon * 200) / 200;
  const cacheKey = `${categories}:${gridLat}:${gridLon}:${radiusMeters}:${cappedLimit}`;

  // Check valid cache
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Deduplicate in-flight requests
  if (inFlightPlacesRequests.has(cacheKey)) {
    return inFlightPlacesRequests.get(cacheKey)!;
  }

  const requestPromise = (async () => {
    try {
      const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
        categories
      )}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${cappedLimit}&apiKey=${GEOAPIFY_API_KEY}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Geoapify Places API responded with status ${res.status}`);
      }

      const data: GeoJSON.FeatureCollection = await res.json();
      placesCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.error('[Geoapify Places Error]:', err);
      return null;
    } finally {
      inFlightPlacesRequests.delete(cacheKey);
    }
  })();

  inFlightPlacesRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// Reverse Geocode Cache
const reverseGeocodeCache = new Map<string, CacheEntry<string>>();

/**
 * Reverse geocode latitude/longitude to a human-readable address with caching.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!GEOAPIFY_API_KEY) return null;

  // Key precision to ~11m
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = reverseGeocodeCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS * 2) {
    return cached.data;
  }

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (data?.features?.[0]?.properties?.formatted) {
      const formatted = data.features[0].properties.formatted as string;
      reverseGeocodeCache.set(key, { data: formatted, timestamp: Date.now() });
      return formatted;
    }
    return null;
  } catch (err) {
    console.error('[Geoapify Reverse Geocode Error]:', err);
    return null;
  }
}
