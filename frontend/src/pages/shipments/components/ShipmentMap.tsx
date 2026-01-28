import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, MapPin, Truck } from 'lucide-react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { Feature, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';
import { getRoute, formatDistance, formatDuration, type RouteInfo } from '@/lib/routing';
import { useShipmentTracking } from '@/hooks/useSocket';
import type { Shipment } from '@/types';

// OpenStreetMap style - free, no token required, optimized for India
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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

export function ShipmentMap({ shipment }: { shipment: Shipment }) {
  const [popupInfo, setPopupInfo] = useState<{ type: string; lat: number; lng: number } | null>(null);
  const [routeData, setRouteData] = useState<RouteInfo | null>(null);
  const [completedRoute, setCompletedRoute] = useState<RouteInfo | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  
  // Live tracking via Socket.io
  const { isConnected, currentLocation } = useShipmentTracking(shipment.id);
  
  const origin = shipment.origin.coordinates || { lat: 28.6139, lng: 77.2090 }; // Default: Delhi
  const destination = shipment.destination.coordinates || { lat: 19.0760, lng: 72.8777 }; // Default: Mumbai
  const current = currentLocation 
    ? { lat: currentLocation.lat, lng: currentLocation.lng }
    : shipment.currentLocation || origin;

  const centerLat = (origin.lat + destination.lat) / 2;
  const centerLng = (origin.lng + destination.lng) / 2;

  // Fetch route from OSRM
  const fetchRoute = useCallback(async () => {
    setIsLoadingRoute(true);
    try {
      // Get full route from origin to destination
      const fullRoute = await getRoute(
        [[origin.lng, origin.lat], [destination.lng, destination.lat]],
        'driving'
      );
      setRouteData(fullRoute);

      // If shipment is in transit, get completed portion
      if (shipment.status !== 'delivered' && shipment.status !== 'pending') {
        const completed = await getRoute(
          [[origin.lng, origin.lat], [current.lng, current.lat]],
          'driving'
        );
        setCompletedRoute(completed);
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
    } finally {
      setIsLoadingRoute(false);
    }
  }, [origin.lat, origin.lng, destination.lat, destination.lng, current.lat, current.lng, shipment.status]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Fallback straight-line route if OSRM fails
  const fallbackRouteGeoJSON: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [origin.lng, origin.lat],
        [current.lng, current.lat],
        [destination.lng, destination.lat],
      ],
    },
  };

  return (
    <div className="h-64 rounded-xl overflow-hidden border border-gray-200 relative">
      {/* Connection Status Indicator */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium">
        {isConnected ? (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span className="text-green-600">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-gray-400" />
            <span className="text-gray-500">Offline</span>
          </>
        )}
      </div>

      {/* Route Info */}
      {routeData && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">{formatDistance(routeData.distance)}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600">{formatDuration(routeData.duration)}</span>
          </div>
        </div>
      )}

      <Map
        initialViewState={{
          longitude: centerLng,
          latitude: centerLat,
          zoom: 5,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
      >
        <NavigationControl position="bottom-right" />

        {/* Full Route (gray/dashed) */}
        <Source 
          id="full-route" 
          type="geojson" 
          data={routeData?.geojson || fallbackRouteGeoJSON}
        >
          <Layer
            id="full-route-line"
            type="line"
            paint={{
              'line-color': '#9CA3AF',
              'line-width': 3,
              'line-dasharray': [2, 2],
            }}
          />
        </Source>

        {/* Completed Route (solid blue) */}
        {completedRoute && (
          <Source id="completed-route" type="geojson" data={completedRoute.geojson}>
            <Layer
              id="completed-route-line"
              type="line"
              paint={{
                'line-color': '#3B82F6',
                'line-width': 4,
              }}
            />
          </Source>
        )}

        {/* Origin Marker */}
        <Marker longitude={origin.lng} latitude={origin.lat}>
          <div
            className="h-8 w-8 bg-green-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              setPopupInfo({ type: 'origin', lat: origin.lat, lng: origin.lng });
            }}
          >
            <MapPin className="h-4 w-4 text-white" />
          </div>
        </Marker>

        {/* Destination Marker */}
        <Marker longitude={destination.lng} latitude={destination.lat}>
          <div
            className="h-8 w-8 bg-red-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform"
            onClick={(e) => {
              e.stopPropagation();
              setPopupInfo({ type: 'destination', lat: destination.lat, lng: destination.lng });
            }}
          >
            <MapPin className="h-4 w-4 text-white" />
          </div>
        </Marker>

        {/* Current Location / Rider Marker */}
        {shipment.status !== 'delivered' && (
          <Marker longitude={current.lng} latitude={current.lat}>
            <div
              className={cn(
                "h-10 w-10 bg-blue-600 rounded-full border-3 border-white shadow-lg flex items-center justify-center cursor-pointer",
                isConnected && "animate-pulse"
              )}
              style={{
                transform: currentLocation?.heading 
                  ? `rotate(${currentLocation.heading}deg)` 
                  : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setPopupInfo({ type: 'current', lat: current.lat, lng: current.lng });
              }}
            >
              <Truck className="h-5 w-5 text-white" />
            </div>
          </Marker>
        )}

        {/* Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lng}
            latitude={popupInfo.lat}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            className="rounded-lg"
          >
            <div className="text-sm p-1">
              {popupInfo.type === 'origin' && (
                <div>
                  <p className="font-semibold text-green-600">Origin</p>
                  <p className="text-gray-700">{shipment.origin.city}</p>
                </div>
              )}
              {popupInfo.type === 'destination' && (
                <div>
                  <p className="font-semibold text-red-600">Destination</p>
                  <p className="text-gray-700">{shipment.destination.city}</p>
                </div>
              )}
              {popupInfo.type === 'current' && (
                <div>
                  <p className="font-semibold text-blue-600">Current Location</p>
                  {currentLocation && (
                    <p className="text-gray-500 text-xs">
                      Speed: {currentLocation.speed?.toFixed(1) || 0} km/h
                    </p>
                  )}
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Loading overlay */}
      {isLoadingRoute && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
