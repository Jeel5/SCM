import { ShoppingCart, Package, MapPin, Calendar, User, Phone, Mail, Truck } from 'lucide-react';
import { Modal, StatusBadge, PriorityBadge, Badge, useToast } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/api/client';
import type { Order } from '@/types';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose, onUpdate }: OrderDetailsModalProps) {
  const { success, error } = useToast();

  if (!order) return null;

  const totalWeight = order.items.reduce((sum, item) => sum + (item.weight * item.quantity), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Order ${order.orderNumber}`} size="2xl">
      <div className="space-y-6">
        {/* Status Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
            <StatusBadge status={order.status} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Priority</p>
            <PriorityBadge priority={order.priority} className="mt-1" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Customer Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerName}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Email
              </p>
              <p className="font-medium text-gray-900 dark:text-white text-sm">{order.customerEmail}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone
              </p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerPhone}</p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Order Date
              </p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            Shipping Address
          </h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300">
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            Order Items ({order.items.length})
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3 flex-1">
                  <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{item.productName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Weight: {item.weight} kg × {item.quantity}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-4 p-4 bg-linear-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Items:</span>
              <Badge variant="default">{order.items.length} items</Badge>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Weight:</span>
              <span className="font-medium text-gray-900 dark:text-white">{totalWeight.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-base font-semibold text-gray-900 dark:text-white">Order Total:</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Shipment Info */}
        {order.shipmentId && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">Shipment Created</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Shipment ID: <span className="font-mono text-blue-600 dark:text-blue-400">{order.shipmentId}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Info */}
        {(order.estimatedDelivery || order.actualDelivery) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {order.estimatedDelivery && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Estimated Delivery</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(order.estimatedDelivery)}</p>
              </div>
            )}
            {order.actualDelivery && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Delivered On</p>
                <p className="font-medium text-gray-900 dark:text-white">{formatDate(order.actualDelivery)}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium mb-1">Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{order.notes}</p>
          </div>
        )}

      </div>
    </Modal>
  );
}
