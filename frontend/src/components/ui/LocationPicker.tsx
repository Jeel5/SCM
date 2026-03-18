import { useState, useCallback, useRef } from 'react';
import Map, { Marker, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { MapPin, Loader, Search, X } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

// Popular Indian cities for quick selection
const INDIAN_CITIES = [
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
];

export function LocationPicker({ 
  latitude = 20.5937, // Default to center of India
  longitude = 78.9629,
  onLocationChange,
  className 
}: LocationPickerProps) {
  const mapRef = useRef<MapRef>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleMapClick = useCallback((event: { lngLat: { lat: number; lng: number } }) => {
    const { lngLat } = event;
    const newMarker = { lat: lngLat.lat, lng: lngLat.lng };
    setMarker(newMarker);
    onLocationChange(lngLat.lat, lngLat.lng);
  }, [onLocationChange]);

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsSearching(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords;
          const newMarker = { lat, lng };
          setMarker(newMarker);
          onLocationChange(lat, lng);
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
          setIsSearching(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsSearching(false);
        }
      );
    }
  };

  const handleCitySelect = (city: typeof INDIAN_CITIES[0]) => {
    const newMarker = { lat: city.lat, lng: city.lng };
    setMarker(newMarker);
    onLocationChange(city.lat, city.lng);
    mapRef.current?.flyTo({ center: [city.lng, city.lat], zoom: 12 });
  };

  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsGeocoding(true);
    try {
      // Using Nominatim OSM geocoding API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=in&limit=1`
      );
      const results = await response.json();
      
      if (results && results.length > 0) {
        const [{ lat, lon }] = results;
        const newMarker = { lat: parseFloat(lat), lng: parseFloat(lon) };
        setMarker(newMarker);
        onLocationChange(newMarker.lat, newMarker.lng);
        mapRef.current?.flyTo({ center: [newMarker.lng, newMarker.lat], zoom: 14 });
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Location
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isSearching}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50 transition-colors"
        >
          {isSearching ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Use My Location
            </>
          )}
        </button>
      </div>

      {/* Address Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddressSearch())}
            placeholder="Search address in India..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddressSearch}
          disabled={isGeocoding || !searchQuery.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isGeocoding ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
      </div>

      {/* Quick City Selection */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 py-1">Quick select:</span>
        {INDIAN_CITIES.map((city) => (
          <button
            key={city.name}
            type="button"
            onClick={() => handleCitySelect(city)}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {city.name}
          </button>
        ))}
      </div>
      
      <div className="relative h-120 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: marker?.lng || longitude,
            latitude: marker?.lat || latitude,
            zoom: marker ? 12 : 5,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAP_STYLE}
          onClick={handleMapClick}
          scrollZoom={true}
          dragRotate={false}
          doubleClickZoom={true}
        >
          <NavigationControl position="top-right" />
          {marker && (
            <Marker
              longitude={marker.lng}
              latitude={marker.lat}
              anchor="bottom"
            >
              <div className="relative">
                <MapPin className="h-8 w-8 text-red-500 fill-red-500 drop-shadow-lg" />
              </div>
            </Marker>
          )}
        </Map>
      </div>

      {marker && (
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
          <span>
            Latitude: <span className="font-mono">{marker.lat.toFixed(6)}</span>
          </span>
          <span>
            Longitude: <span className="font-mono">{marker.lng.toFixed(6)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
