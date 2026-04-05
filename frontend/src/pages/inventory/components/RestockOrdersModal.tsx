import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, RefreshCw, Truck } from 'lucide-react';
import { Modal, DataTable, Badge, Button, Select, Input, useToast } from '@/components/ui';
import { inventoryApi } from '@/api/services';
import { notifyLoadError } from '@/lib/apiErrors';
import { formatCurrency } from '@/lib/utils';
import type { RestockOrderSummary, Warehouse } from '@/types';

interface RestockOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusBadgeVariant = (status: string): 'outline' | 'info' | 'success' | 'warning' | 'error' => {
  if (status === 'submitted') return 'info';
  if (status === 'confirmed' || status === 'received') return 'success';
  if (status === 'cancelled') return 'error';
  if (status === 'in_transit') return 'warning';
  return 'outline';
};

export function RestockOrdersModal({ isOpen, onClose, warehouses }: RestockOrdersModalProps) {
  const [orders, setOrders] = useState<RestockOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<RestockOrderSummary | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editSupplierPo, setEditSupplierPo] = useState('');
  const [editExpectedArrival, setEditExpectedArrival] = useState('');
  const { success, error } = useToast();

  const warehouseOptions = useMemo(
    () => [
      { value: '', label: 'All warehouses' },
      ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
    ],
    [warehouses]
  );

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await inventoryApi.getRestockOrders(100, true, {
        status: statusFilter || undefined,
        warehouseId: warehouseFilter || undefined,
      });
      setOrders(response.data);
    } catch (error) {
      notifyLoadError('restock orders', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openTrackingDetails = (order: RestockOrderSummary) => {
    setSelectedOrder(order);
    setEditStatus(order.status || 'draft');
    setEditTrackingNumber(order.trackingNumber || '');
    setEditSupplierPo(order.supplierPoNumber || '');
    setEditExpectedArrival(order.expectedArrival ? String(order.expectedArrival).slice(0, 10) : '');
  };

  const saveTrackingStatus = async () => {
    if (!selectedOrder) return;

    setIsSaving(true);
    try {
      await inventoryApi.updateRestockOrder(selectedOrder.id, {
        status: editStatus,
        tracking_number: editTrackingNumber || null,
        supplier_po_number: editSupplierPo || null,
        expected_arrival: editExpectedArrival ? new Date(editExpectedArrival).toISOString() : null,
      });

      const nextOrder: RestockOrderSummary = {
        ...selectedOrder,
        status: editStatus,
        trackingNumber: editTrackingNumber || null,
        supplierPoNumber: editSupplierPo || null,
        expectedArrival: editExpectedArrival ? new Date(editExpectedArrival).toISOString() : null,
      };

      setOrders((prev) => prev.map((order) => (order.id === selectedOrder.id ? nextOrder : order)));
      setSelectedOrder(nextOrder);
      success('Reorder updated', 'Status and tracking info were saved.');
    } catch (err: any) {
      notifyLoadError('reorder update', err);
      error('Update failed', err?.message || 'Could not update reorder details');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchOrders();
    // Filters are dependencies so results stay synced with selected values.
  }, [isOpen, statusFilter, warehouseFilter]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      title="All Reorders"
      description="Browse and filter restock requests created by low-stock workflows or manual adjustments."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Warehouse"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            options={warehouseOptions}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              className="w-full"
              onClick={fetchOrders}
              isLoading={isLoading}
            >
              Refresh
            </Button>
          </div>
        </div>

        <DataTable
          columns={[
            {
              key: 'restockNumber',
              header: 'Reorder',
              sortable: true,
              render: (order: RestockOrderSummary) => (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="h-4 w-4 text-indigo-500" />
                    {order.restockNumber || order.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {order.supplierName}{' -> '}{order.warehouseName}
                  </p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              render: (order: RestockOrderSummary) => (
                <div>
                  <Badge variant={statusBadgeVariant(order.status)} className="capitalize">
                    {order.status.replace(/_/g, ' ')}
                  </Badge>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tracking: {order.trackingNumber || 'Pending'}
                  </p>
                </div>
              ),
            },
            {
              key: 'totalQuantity',
              header: 'Quantity',
              sortable: true,
              render: (order: RestockOrderSummary) => (
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{order.totalQuantity} units</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{order.lineItems} line items</p>
                </div>
              ),
            },
            {
              key: 'totalAmount',
              header: 'Amount',
              sortable: true,
              render: (order: RestockOrderSummary) => (
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</span>
              ),
            },
            {
              key: 'requestedAt',
              header: 'Requested',
              sortable: true,
              render: (order: RestockOrderSummary) => (
                <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                  <CalendarClock className="h-4 w-4" />
                  {new Date(order.requestedAt).toLocaleString()}
                </span>
              ),
            },
          ]}
          data={orders}
          isLoading={isLoading}
          searchPlaceholder="Search by reorder number, supplier, warehouse, or status"
          emptyMessage="No reorders found for the selected filters"
          onRowClick={openTrackingDetails}
        />
      </div>

      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        size="lg"
        title={selectedOrder ? `Reorder ${selectedOrder.restockNumber || selectedOrder.id.slice(0, 8)}` : 'Reorder Details'}
        description="Tracking information lives with status updates for supplier-side progress."
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={STATUS_OPTIONS.slice(1)}
              />
              <Input
                label="Tracking Number"
                value={editTrackingNumber}
                onChange={(e) => setEditTrackingNumber(e.target.value)}
                placeholder="Supplier or carrier tracking number"
              />
              <Input
                label="Supplier PO Number"
                value={editSupplierPo}
                onChange={(e) => setEditSupplierPo(e.target.value)}
                placeholder="Supplier purchase order reference"
              />
              <Input
                label="Expected Arrival"
                type="date"
                value={editExpectedArrival}
                onChange={(e) => setEditExpectedArrival(e.target.value)}
              />
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <p><strong>Supplier:</strong> {selectedOrder.supplierName}</p>
              <p><strong>Warehouse:</strong> {selectedOrder.warehouseName}</p>
              <p><strong>Requested:</strong> {new Date(selectedOrder.requestedAt).toLocaleString()}</p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={saveTrackingStatus} isLoading={isSaving}>
                Save Tracking Status
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
}
