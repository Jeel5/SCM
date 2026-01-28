import { Edit, ShoppingCart } from 'lucide-react';
import { Modal, Button, StatusBadge, PriorityBadge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Order } from '@/types';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Order ${order.orderNumber}`} size="lg">
      <div className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <StatusBadge status={order.status} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Priority</p>
            <PriorityBadge priority={order.priority} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Customer Information</h4>
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
              <p className="font-medium text-gray-900 dark:text-white">{order.customerPhone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Shipping Address</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <p className="text-gray-700 dark:text-gray-300">
              {order.shippingAddress.street}<br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
              {order.shippingAddress.country}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Order Items</h4>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{item.productName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.unitPrice)} x {item.quantity}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="outline" className="flex-1">
            <Edit className="h-4 w-4 mr-2" />
            Edit Order
          </Button>
          <Button variant="primary" className="flex-1">
            Create Shipment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
