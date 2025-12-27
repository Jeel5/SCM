import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface RiderLocation {
  riderId: string;
  shipmentId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  riderLocations: Map<string, RiderLocation>;
  subscribeToShipment: (shipmentId: string) => void;
  unsubscribeFromShipment: (shipmentId: string) => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [riderLocations, setRiderLocations] = useState<Map<string, RiderLocation>>(new Map());

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('rider:location', (data: RiderLocation) => {
      setRiderLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.shipmentId, data);
        return newMap;
      });
    });

    socket.on('rider:locations:batch', (data: RiderLocation[]) => {
      setRiderLocations((prev) => {
        const newMap = new Map(prev);
        data.forEach((location) => {
          newMap.set(location.shipmentId, location);
        });
        return newMap;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribeToShipment = useCallback((shipmentId: string) => {
    socketRef.current?.emit('shipment:subscribe', { shipmentId });
  }, []);

  const unsubscribeFromShipment = useCallback((shipmentId: string) => {
    socketRef.current?.emit('shipment:unsubscribe', { shipmentId });
    setRiderLocations((prev) => {
      const newMap = new Map(prev);
      newMap.delete(shipmentId);
      return newMap;
    });
  }, []);

  return {
    isConnected,
    riderLocations,
    subscribeToShipment,
    unsubscribeFromShipment,
  };
}

// Hook for tracking a single shipment
export function useShipmentTracking(shipmentId: string | null) {
  const { isConnected, riderLocations, subscribeToShipment, unsubscribeFromShipment } = useSocket();

  useEffect(() => {
    if (shipmentId && isConnected) {
      subscribeToShipment(shipmentId);
      return () => {
        unsubscribeFromShipment(shipmentId);
      };
    }
  }, [shipmentId, isConnected, subscribeToShipment, unsubscribeFromShipment]);

  const currentLocation = useMemo(() => {
    if (shipmentId) {
      return riderLocations.get(shipmentId) ?? null;
    }
    return null;
  }, [shipmentId, riderLocations]);

  return {
    isConnected,
    currentLocation,
  };
}
