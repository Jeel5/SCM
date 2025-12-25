import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  MapPin,
  Clock,
  Package,
  Download,
  RefreshCw,
  Eye,
  Navigation,
  CheckCircle2,
  Circle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type { Feature, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Modal,
  Tabs,
} from '@/components/ui';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { getRoute, formatDistance, formatDuration, type RouteInfo } from '@/lib/routing';
import { useShipmentTracking } from '@/hooks/useSocket';
import { mockApi } from '@/api/mockData';
import type { Shipment, ShipmentEvent } from '@/types';

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

// Shipment Timeline Component
function ShipmentTimeline({ events }: { events: ShipmentEvent[] }) {
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="relative">
      {sortedEvents.map((event, index) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className="flex gap-4 pb-6 last:pb-0"
        >
          {/* Timeline line */}
          <div className="relative flex flex-col items-center">
            <div
              className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                index === 0
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              {index === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            {index < sortedEvents.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
            )}
          </div>

          {/* Event content */}
          <div className="flex-1 pt-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">{event.description}</p>
              <StatusBadge status={event.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDate(event.timestamp, 'MMM dd, yyyy HH:mm')}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Shipment Map Component with OSRM Routing and Live Tracking
function ShipmentMap({ shipment }: { shipment: Shipment }) {
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

// Shipment Details Modal
function ShipmentDetailsModal({
  shipment,
  isOpen,
  onClose,
}: {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState('timeline');

  if (!shipment) return null;

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'map', label: 'Track on Map' },
    { id: 'details', label: 'Details' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Shipment ${shipment.trackingNumber}`} size="lg">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{shipment.carrierName}</p>
              <p className="text-sm text-gray-500">
                Est. Delivery: {formatDate(shipment.estimatedDelivery)}
              </p>
            </div>
          </div>
          <StatusBadge status={shipment.status} />
        </div>

        {/* Route Info */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="text-center">
            <p className="text-sm text-gray-500">From</p>
            <p className="font-medium text-gray-900">{shipment.origin.city}</p>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-blue-500 to-indigo-500" />
              <Navigation className="h-4 w-4 text-indigo-500" />
              <div className="h-0.5 w-16 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="h-2 w-2 rounded-full bg-purple-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">To</p>
            <p className="font-medium text-gray-900">{shipment.destination.city}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        {activeTab === 'timeline' && (
          <div className="mt-4">
            <ShipmentTimeline events={shipment.events} />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="mt-4">
            <ShipmentMap shipment={shipment} />
          </div>
        )}

        {activeTab === 'details' && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Order ID</p>
              <p className="font-medium text-gray-900">{shipment.orderId}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Weight</p>
              <p className="font-medium text-gray-900">{shipment.weight.toFixed(2)} kg</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">SLA Deadline</p>
              <p className="font-medium text-gray-900">{formatDate(shipment.slaDeadline)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Shipping Cost</p>
              <p className="font-medium text-gray-900">${shipment.cost.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// Main Shipments Page
export function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [totalShipments, setTotalShipments] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 10;

  const tabs = [
    { id: 'all', label: 'All Shipments', count: totalShipments },
    { id: 'in_transit', label: 'In Transit' },
    { id: 'out_for_delivery', label: 'Out for Delivery' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'failed_delivery', label: 'Failed' },
  ];

  const columns = [
    {
      key: 'tracking',
      header: 'Tracking',
      sortable: true,
      render: (shipment: Shipment) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{shipment.trackingNumber}</p>
            <p className="text-sm text-gray-500">{formatRelativeTime(shipment.updatedAt)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'carrier',
      header: 'Carrier',
      render: (shipment: Shipment) => (
        <span className="font-medium text-gray-700">{shipment.carrierName}</span>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (shipment: Shipment) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-700">{shipment.origin.city}</span>
          <span className="text-gray-400">→</span>
          <span className="text-gray-700">{shipment.destination.city}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (shipment: Shipment) => <StatusBadge status={shipment.status} />,
    },
    {
      key: 'eta',
      header: 'Est. Delivery',
      sortable: true,
      render: (shipment: Shipment) => (
        <span className="text-gray-700">{formatDate(shipment.estimatedDelivery)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (shipment: Shipment) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedShipment(shipment);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
        </button>
      ),
    },
  ];

  useEffect(() => {
    const fetchShipments = async () => {
      setIsLoading(true);
      try {
        const response = await mockApi.getShipments(page, pageSize);
        setShipments(response.data);
        setTotalShipments(response.total);
      } catch (error) {
        console.error('Failed to fetch shipments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchShipments();
  }, [page]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500 mt-1">Track and manage all shipments in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />}>
            Export
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Shipments', value: totalShipments, icon: Package, color: 'bg-blue-100 text-blue-600' },
          { label: 'In Transit', value: shipments.filter((s) => s.status === 'in_transit').length, icon: Truck, color: 'bg-yellow-100 text-yellow-600' },
          { label: 'Out for Delivery', value: shipments.filter((s) => s.status === 'out_for_delivery').length, icon: Navigation, color: 'bg-purple-100 text-purple-600' },
          { label: 'Delivered', value: shipments.filter((s) => s.status === 'delivered').length, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white rounded-xl border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Table */}
      <Card padding="none">
        <div className="p-4 border-b border-gray-100">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <DataTable
          columns={columns}
          data={shipments}
          isLoading={isLoading}
          searchPlaceholder="Search by tracking number..."
          pagination={{
            page,
            pageSize,
            total: totalShipments,
            onPageChange: setPage,
          }}
          onRowClick={(shipment) => {
            setSelectedShipment(shipment);
            setIsDetailsOpen(true);
          }}
          emptyMessage="No shipments found"
          className="border-0 rounded-none"
        />
      </Card>

      {/* Details Modal */}
      <ShipmentDetailsModal
        shipment={selectedShipment}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedShipment(null);
        }}
      />
    </div>
  );
}
