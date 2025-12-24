import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  Modal,
  Tabs,
} from '@/components/ui';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { mockApi } from '@/api/mockData';
import type { Shipment, ShipmentEvent } from '@/types';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

// Shipment Map Component
function ShipmentMap({ shipment }: { shipment: Shipment }) {
  const origin = shipment.origin.coordinates || { lat: 34.0522, lng: -118.2437 };
  const destination = shipment.destination.coordinates || { lat: 40.7128, lng: -74.006 };
  const current = shipment.currentLocation || origin;

  const center: [number, number] = [
    (origin.lat + destination.lat) / 2,
    (origin.lng + destination.lng) / 2,
  ];

  return (
    <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>Origin: {shipment.origin.city}</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]}>
          <Popup>Destination: {shipment.destination.city}</Popup>
        </Marker>
        {shipment.status !== 'delivered' && (
          <Marker position={[current.lat, current.lng]}>
            <Popup>Current Location</Popup>
          </Marker>
        )}
        <Polyline
          positions={[
            [origin.lat, origin.lng],
            [current.lat, current.lng],
            [destination.lat, destination.lng],
          ]}
          color="#3B82F6"
          weight={3}
          dashArray="10, 10"
        />
      </MapContainer>
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
