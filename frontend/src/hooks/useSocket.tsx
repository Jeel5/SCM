/**
 * Socket.IO integration.
 *
 * Architecture:
 *  - SocketProvider  — mounts once, creates/destroys the socket based on auth state
 *  - useSocket()     — returns isConnected + shipment room helpers
 *  - useSocketEvent  — subscribes a component to a named event (auto-cleans up)
 *  - useShipmentTracking — convenience hook for the live shipment map
 *
 * The socket connects to the same host as VITE_API_URL but without the /api suffix.
 * Credentials are sent via withCredentials so the accessToken httpOnly cookie is
 * forwarded in the Socket.IO handshake — no token in JS memory needed.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore, useNotificationStore } from '@/stores';
import type { Notification } from '@/types';

// Strip /api (or /api/) suffix so socket connects to the server root
const SOCKET_URL = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  return apiUrl.replace(/\/api\/?$/, '');
})();

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiderLocation {
  riderId: string;
  shipmentId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  subscribeToShipment: (shipmentId: string) => void;
  unsubscribeFromShipment: (shipmentId: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  subscribeToShipment: () => {},
  unsubscribeFromShipment: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let attemptedRefresh = false;

    const sock = io(SOCKET_URL, {
      withCredentials: true, // sends accessToken httpOnly cookie in handshake
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    sock.on('connect', () => setIsConnected(true));
    sock.on('disconnect', () => setIsConnected(false));
    sock.on('connect_error', async (err: Error) => {
      console.warn('[socket] connection error:', err.message);

      // Token can expire before socket reconnect; try one silent refresh then reconnect.
      const msg = (err?.message || '').toLowerCase();
      const authError = msg.includes('auth') || msg.includes('token') || msg.includes('unauthorized');
      if (!attemptedRefresh && authError) {
        attemptedRefresh = true;
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
          await fetch(`${apiUrl}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          sock.connect();
        } catch {
          // No-op: normal reconnect policy and app auth guards will handle failures.
        }
      }
    });

    // Global handler: notification:new updates the header bell for ALL pages
    sock.on('notification:new', (data: { id: string; type: string; title: string; message: string; link?: string; created_at?: string }) => {
      const notification: Notification = {
        id: data.id,
        type: (data.type || 'system') as Notification['type'],
        title: data.title,
        message: data.message,
        isRead: false,
        actionUrl: data.link,
        createdAt: data.created_at || new Date().toISOString(),
      };
      addNotification(notification);
    });

    setSocket(sock);

    return () => {
      sock.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, userId, addNotification]);

  const subscribeToShipment = useCallback((shipmentId: string) => {
    socket?.emit('shipment:subscribe', { shipmentId });
  }, [socket]);

  const unsubscribeFromShipment = useCallback((shipmentId: string) => {
    socket?.emit('shipment:unsubscribe', { shipmentId });
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, subscribeToShipment, unsubscribeFromShipment }}>
      {children}
    </SocketContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Access the socket connection and shipment room helpers. */
export function useSocket() {
  return useContext(SocketContext);
}

/**
 * Subscribe to a named socket event for the lifetime of the component.
 * Always calls the latest handler — safe to use inline functions without worry.
 *
 * @example
 * useSocketEvent('order:updated', (data) => refetch());
 */
export function useSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const stable = (data: T) => handlerRef.current(data);
    socket.on(event, stable);
    return () => { socket.off(event, stable); };
  }, [socket, event]);
}

/**
 * Live tracking hook for the shipment map.
 * Subscribes to the shipment room and tracks the latest rider location.
 */
export function useShipmentTracking(shipmentId: string | null) {
  const { socket, isConnected, subscribeToShipment, unsubscribeFromShipment } = useSocket();
  const [currentLocation, setCurrentLocation] = useState<RiderLocation | null>(null);

  useEffect(() => {
    if (!shipmentId || !isConnected) return;
    subscribeToShipment(shipmentId);
    return () => unsubscribeFromShipment(shipmentId);
  }, [shipmentId, isConnected, subscribeToShipment, unsubscribeFromShipment]);

  useEffect(() => {
    if (!socket || !shipmentId) return;
    const handleLocation = (data: RiderLocation) => {
      if (data.shipmentId === shipmentId) setCurrentLocation(data);
    };
    socket.on('rider:location', handleLocation);
    socket.on('shipment:location', handleLocation);
    return () => {
      socket.off('rider:location', handleLocation);
      socket.off('shipment:location', handleLocation);
    };
  }, [socket, shipmentId]);

  return { isConnected, currentLocation };
}
