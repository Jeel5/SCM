import type { Feature, LineString } from 'geojson';

const OSRM_URL = import.meta.env.VITE_OSRM_URL;

interface RouteResponse {
  routes: Array<{
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
    distance: number;
    duration: number;
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        geometry: {
          coordinates: [number, number][];
        };
        distance: number;
        duration: number;
        name: string;
        maneuver: {
          type: string;
          instruction: string;
          location: [number, number];
        };
      }>;
    }>;
  }>;
  waypoints: Array<{
    name: string;
    location: [number, number];
  }>;
}

export interface RouteInfo {
  coordinates: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds
  geojson: Feature<LineString>;
}

/**
 * Get route between two or more points using OSRM
 * @param coordinates Array of [lng, lat] coordinates
 * @param profile Routing profile: 'driving', 'walking', 'cycling'
 */
export async function getRoute(
  coordinates: [number, number][],
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<RouteInfo | null> {
  if (coordinates.length < 2) {
    console.error('At least 2 coordinates required for routing');
    return null;
  }

  try {
    const coordString = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');
    const url = `${OSRM_URL}/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OSRM request failed: ${response.status}`);
    }

    const data: RouteResponse = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.error('No routes found');
      return null;
    }

    const route = data.routes[0];
    
    return {
      coordinates: route.geometry.coordinates as [number, number][],
      distance: route.distance,
      duration: route.duration,
      geojson: {
        type: 'Feature',
        properties: {
          distance: route.distance,
          duration: route.duration,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.geometry.coordinates,
        },
      },
    };
  } catch (error) {
    console.error('Failed to get route:', error);
    return null;
  }
}

/**
 * Get route with current rider position
 * Returns two segments: completed and remaining
 */
export async function getRouteWithProgress(
  origin: [number, number],
  destination: [number, number],
  currentPosition: [number, number],
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<{
  completedRoute: RouteInfo | null;
  remainingRoute: RouteInfo | null;
  totalDistance: number;
  remainingDistance: number;
  eta: number;
} | null> {
  try {
    // Get route from origin to current position (completed)
    const completedRoute = await getRoute([origin, currentPosition], profile);
    
    // Get route from current position to destination (remaining)
    const remainingRoute = await getRoute([currentPosition, destination], profile);

    if (!completedRoute || !remainingRoute) {
      return null;
    }

    return {
      completedRoute,
      remainingRoute,
      totalDistance: completedRoute.distance + remainingRoute.distance,
      remainingDistance: remainingRoute.distance,
      eta: remainingRoute.duration,
    };
  } catch (error) {
    console.error('Failed to get route with progress:', error);
    return null;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
