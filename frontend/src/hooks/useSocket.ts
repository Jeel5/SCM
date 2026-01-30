import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Singleton socket instance to prevent multiple connections
let socketInstance: Socket | null = null;
let socketRefCount = 0;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  socketRefCount++;
  return socketInstance;
}

function releaseSocket(): void {
  socketRefCount--;
  if (socketRefCount <= 0 && socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketRefCount = 0;
  }
}

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
    // Use singleton socket instance
    const socket = getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    const handleRiderLocation = (data: RiderLocation) => {
      setRiderLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.shipmentId, data);
        return newMap;
      });
    };

    const handleRiderLocationsBatch = (data: RiderLocation[]) => {
      setRiderLocations((prev) => {
        const newMap = new Map(prev);
        data.forEach((location) => {
          newMap.set(location.shipmentId, location);
        });
        return newMap;
      });
    };

    // Check if already connected
    if (socket.connected) {
      setIsConnected(true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('rider:location', handleRiderLocation);
    socket.on('rider:locations:batch', handleRiderLocationsBatch);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('rider:location', handleRiderLocation);
      socket.off('rider:locations:batch', handleRiderLocationsBatch);
      releaseSocket();
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
