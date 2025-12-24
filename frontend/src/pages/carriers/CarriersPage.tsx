import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Star,
  Clock,
  Package,
  Plus,
  Eye,
  Edit,
  MoreHorizontal,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Progress,
  Dropdown,
  DataTable,
  Tabs,
} from '@/components/ui';
import { formatNumber, cn } from '@/lib/utils';
import { mockApi } from '@/api/mockData';
import type { Carrier } from '@/types';

// Rating Stars Component
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-4 w-4',
            i < Math.floor(rating)
              ? 'text-yellow-400 fill-yellow-400'
              : i < rating
                ? 'text-yellow-400 fill-yellow-400 opacity-50'
                : 'text-gray-300'
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
    </div>
  );
}

// Carrier Card Component
function CarrierCard({
  carrier,
  onViewDetails,
}: {
  carrier: Carrier;
  onViewDetails: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                carrier.status === 'active'
                  ? 'bg-blue-100 text-blue-600'
                  : carrier.status === 'suspended'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-600'
              )}
            >
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{carrier.name}</h3>
              <RatingStars rating={carrier.rating} />
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </button>
            }
            items={[
              { label: 'View Details', value: 'view', icon: <Eye className="h-4 w-4" /> },
              { label: 'Edit', value: 'edit', icon: <Edit className="h-4 w-4" /> },
            ]}
            onSelect={(value) => {
              if (value === 'view') onViewDetails();
            }}
          />
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">On-Time Delivery</span>
          <div className="flex items-center gap-2">
            <Progress value={carrier.onTimeDeliveryRate} size="sm" className="w-24" />
            <span className="text-sm font-medium text-gray-700">
              {carrier.onTimeDeliveryRate}%
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Damage Rate</span>
          <div className="flex items-center gap-2">
            <Progress
              value={100 - carrier.damageRate}
              variant={carrier.damageRate > 5 ? 'error' : 'success'}
              size="sm"
              className="w-24"
            />
            <span className="text-sm font-medium text-gray-700">
              {carrier.damageRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-gray-50 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            {formatNumber(carrier.activeShipments)}
          </p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="text-center border-x border-gray-200">
          <p className="text-lg font-semibold text-gray-900">
            {formatNumber(carrier.totalShipments)}
          </p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{carrier.averageDeliveryTime}h</p>
          <p className="text-xs text-gray-500">Avg Time</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {carrier.services.slice(0, 2).map((service) => (
            <Badge key={service} variant="default" className="text-xs capitalize">
              {service.replace('_', ' ')}
            </Badge>
          ))}
          {carrier.services.length > 2 && (
            <Badge variant="default" className="text-xs">
              +{carrier.services.length - 2}
            </Badge>
          )}
        </div>
        <Badge
          variant={
            carrier.status === 'active'
              ? 'success'
              : carrier.status === 'suspended'
                ? 'error'
                : 'default'
          }
          className="capitalize"
        >
          {carrier.status}
        </Badge>
      </div>
    </motion.div>
  );
}

// Carrier Details Modal
function CarrierDetailsModal({
  carrier,
  isOpen,
  onClose,
}: {
  carrier: Carrier | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!carrier) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={carrier.name} size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{carrier.name}</h3>
              <RatingStars rating={carrier.rating} />
            </div>
          </div>
          <Badge
            variant={
              carrier.status === 'active'
                ? 'success'
                : carrier.status === 'suspended'
                  ? 'error'
                  : 'default'
            }
            size="lg"
            className="capitalize"
          >
            {carrier.status}
          </Badge>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{carrier.onTimeDeliveryRate}%</p>
            <p className="text-sm text-gray-500">On-Time</p>
          </div>
          <div className="p-4 bg-red-50 rounded-xl text-center">
            <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{carrier.damageRate}%</p>
            <p className="text-sm text-gray-500">Damage Rate</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-xl text-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{carrier.lossRate}%</p>
            <p className="text-sm text-gray-500">Loss Rate</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl text-center">
            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{carrier.averageDeliveryTime}h</p>
            <p className="text-sm text-gray-500">Avg Time</p>
          </div>
        </div>

        {/* Shipment Stats */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-4">Shipment Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-500">Active Shipments</span>
              <span className="font-semibold text-gray-900">{formatNumber(carrier.activeShipments)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg">
              <span className="text-sm text-gray-500">Total Shipments</span>
              <span className="font-semibold text-gray-900">{formatNumber(carrier.totalShipments)}</span>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-3">Available Services</h4>
          <div className="flex flex-wrap gap-2">
            {carrier.services.map((service) => (
              <Badge key={service} variant="info" className="capitalize">
                {service.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>

        {/* Contact Information */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <h4 className="font-medium text-gray-900 mb-4">Contact Information</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm font-medium text-gray-900">{carrier.contactPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{carrier.contactEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Globe className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">API Endpoint</p>
                <p className="text-sm font-medium text-blue-600">{carrier.apiEndpoint || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Add Carrier Modal
function AddCarrierModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Carrier" size="lg">
      <form className="space-y-4">
        <Input label="Carrier Name" placeholder="Enter carrier name" required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contact Phone" placeholder="+1 (555) 000-0000" required />
          <Input label="Contact Email" type="email" placeholder="contact@carrier.com" required />
        </div>
        <Input label="Website" placeholder="https://www.carrier.com" />
        <Select
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'pending', label: 'Pending' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
          <div className="grid grid-cols-3 gap-2">
            {['express', 'standard', 'economy', 'freight', 'cold_chain', 'hazmat'].map((service) => (
              <label
                key={service}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
              >
                <input type="checkbox" className="rounded text-blue-600" />
                <span className="text-sm capitalize">{service.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Add Carrier
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Main Carriers Page
export function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All Carriers', count: carriers.length },
    { id: 'active', label: 'Active', count: carriers.filter((c) => c.status === 'active').length },
    { id: 'inactive', label: 'Inactive', count: carriers.filter((c) => c.status === 'inactive').length },
    { id: 'suspended', label: 'Suspended', count: carriers.filter((c) => c.status === 'suspended').length },
  ];

  useEffect(() => {
    const fetchCarriers = async () => {
      setIsLoading(true);
      try {
        const response = await mockApi.getCarriers();
        setCarriers(response.data);
      } catch (error) {
        console.error('Failed to fetch carriers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCarriers();
  }, []);

  // Calculate stats
  const avgOnTime = carriers.length
    ? carriers.reduce((sum, c) => sum + c.onTimeDeliveryRate, 0) / carriers.length
    : 0;
  const totalActiveShipments = carriers.reduce((sum, c) => sum + c.activeShipments, 0);

  const columns = [
    {
      key: 'carrier',
      header: 'Carrier',
      sortable: true,
      render: (carrier: Carrier) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Truck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{carrier.name}</p>
            <RatingStars rating={carrier.rating} />
          </div>
        </div>
      ),
    },
    {
      key: 'onTime',
      header: 'On-Time',
      sortable: true,
      render: (carrier: Carrier) => (
        <div className="flex items-center gap-2">
          <Progress value={carrier.onTimeDeliveryRate} size="sm" className="w-20" />
          <span className="text-sm font-medium">{carrier.onTimeDeliveryRate}%</span>
        </div>
      ),
    },
    {
      key: 'shipments',
      header: 'Active Shipments',
      sortable: true,
      render: (carrier: Carrier) => (
        <span className="font-medium">{formatNumber(carrier.activeShipments)}</span>
      ),
    },
    {
      key: 'avgTime',
      header: 'Avg. Time',
      render: (carrier: Carrier) => <span>{carrier.averageDeliveryTime}h</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (carrier: Carrier) => (
        <Badge
          variant={
            carrier.status === 'active'
              ? 'success'
              : carrier.status === 'suspended'
                ? 'error'
                : 'warning'
          }
          className="capitalize"
        >
          {carrier.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      render: (carrier: Carrier) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCarrier(carrier);
            setIsDetailsOpen(true);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Eye className="h-4 w-4 text-gray-500" />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carriers</h1>
          <p className="text-gray-500 mt-1">Manage shipping carriers and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'grid'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Table
            </button>
          </div>
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddOpen(true)}>
            Add Carrier
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Carriers',
            value: carriers.length,
            icon: Truck,
            color: 'bg-blue-100 text-blue-600',
          },
          {
            label: 'Active Shipments',
            value: formatNumber(totalActiveShipments),
            icon: Package,
            color: 'bg-green-100 text-green-600',
          },
          {
            label: 'Avg On-Time',
            value: `${avgOnTime.toFixed(1)}%`,
            icon: Clock,
            color: 'bg-purple-100 text-purple-600',
          },
          {
            label: 'Top Performer',
            value: carriers.length
              ? carriers.sort((a, b) => b.rating - a.rating)[0]?.name || 'N/A'
              : 'N/A',
            icon: Star,
            color: 'bg-yellow-100 text-yellow-600',
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-white rounded-xl border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', stat.color)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="border-b border-gray-200">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carriers
              .filter((c) => activeTab === 'all' || c.status === activeTab)
              .map((carrier) => (
                <CarrierCard
                  key={carrier.id}
                  carrier={carrier}
                  onViewDetails={() => {
                    setSelectedCarrier(carrier);
                    setIsDetailsOpen(true);
                  }}
                />
              ))}
          </div>
        </>
      ) : (
        <Card padding="none">
          <div className="p-4 border-b border-gray-100">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          </div>
          <DataTable
            columns={columns}
            data={carriers.filter((c) => activeTab === 'all' || c.status === activeTab)}
            isLoading={isLoading}
            searchPlaceholder="Search carriers..."
            onRowClick={(carrier) => {
              setSelectedCarrier(carrier);
              setIsDetailsOpen(true);
            }}
            emptyMessage="No carriers found"
            className="border-0 rounded-none"
          />
        </Card>
      )}

      {/* Modals */}
      <CarrierDetailsModal
        carrier={selectedCarrier}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedCarrier(null);
        }}
      />

      <AddCarrierModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </div>
  );
}
