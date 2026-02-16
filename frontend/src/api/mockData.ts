import type {
  User,
  Order,
  Shipment,
  Warehouse,
  InventoryItem,
  Carrier,
  SLAPolicy,
  SLAViolation,
  Return,
  Exception,
  DashboardMetrics,
  ChartDataPoint,
  CarrierPerformance,
  WarehouseUtilization,
  Notification,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

// Simulated delay for realistic API behavior
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Data Generators
const generateId = () => Math.random().toString(36).substring(2, 9);

type SLADashboardData = {
  overallCompliance: number;
  totalShipments: number;
  onTimeDeliveries: number;
  violations: { pending: number; resolved: number; waived: number };
  topCarriers: Array<{ name: string; reliabilityScore: number; shipmentCount: number }>;
};

type FinanceData = {
  outstandingInvoices: number;
  refundsProcessed: number;
  disputes: number;
  payoutStatus: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    carrier: string;
    amount: number;
    status: 'pending' | 'paid';
    dueDate: string;
  }>;
  refunds: Array<{
    id: string;
    orderNumber: string;
    amount: number;
    status: 'processed' | 'pending';
    processedAt: string;
  }>;
};

// Users Mock Data
const mockUsers: User[] = [
  {
    id: '0',
    email: 'superadmin@twinchain.in',
    name: 'Super Admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin',
    role: 'superadmin',
    organizationId: null,
    permissions: ['*:*'],
    createdAt: '2024-01-01T10:00:00Z',
    lastLogin: '2024-12-24T10:00:00Z',
  },
  {
    id: '1',
    email: 'admin@twinchain.in',
    name: 'John Admin',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
    role: 'admin',
    organizationId: 'org-1',
    permissions: ['all'],
    createdAt: '2024-01-15T10:00:00Z',
    lastLogin: '2024-12-24T09:00:00Z',
  },
  {
    id: '2',
    email: 'ops@twinchain.in',
    name: 'Sarah Operations',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    role: 'operations_manager',
    organizationId: 'org-1',
    permissions: ['orders', 'shipments', 'sla', 'exceptions'],
    createdAt: '2024-02-10T10:00:00Z',
    lastLogin: '2024-12-24T08:30:00Z',
  },
];

// Orders Mock Data
const generateOrders = (count: number): Order[] => {
  const statuses: Order['status'][] = [
    'created', 'confirmed', 'allocated', 'processing', 'shipped', 
    'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled'
  ];
  const priorities: Order['priority'][] = ['express', 'standard', 'bulk'];
  const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `ord-${generateId()}`,
    orderNumber: `ORD-${String(100000 + i).padStart(6, '0')}`,
    customerId: `cust-${generateId()}`,
    customerName: `Customer ${i + 1}`,
    customerEmail: `customer${i + 1}@example.com`,
    customerPhone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    priority: priorities[Math.floor(Math.random() * priorities.length)],
    items: [
      {
        id: `item-${generateId()}`,
        productId: `prod-${generateId()}`,
        productName: `Product ${Math.floor(Math.random() * 100)}`,
        sku: `SKU-${Math.floor(Math.random() * 10000)}`,
        quantity: Math.floor(Math.random() * 5) + 1,
        unitPrice: Math.floor(Math.random() * 200) + 20,
        weight: Math.random() * 10 + 0.5,
      },
    ],
    shippingAddress: {
      street: `${Math.floor(Math.random() * 900) + 100} MG Road`,
      city: cities[Math.floor(Math.random() * cities.length)],
      state: 'Maharashtra',
      postalCode: `${Math.floor(Math.random() * 900000) + 100000}`,
      country: 'India',
    },
    billingAddress: {
      street: `${Math.floor(Math.random() * 900) + 100} MG Road`,
      city: cities[Math.floor(Math.random() * cities.length)],
      state: 'Maharashtra',
      postalCode: `${Math.floor(Math.random() * 900000) + 100000}`,
      country: 'India',
    },
    totalAmount: Math.floor(Math.random() * 50000) + 5000,
    currency: 'INR',
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    estimatedDelivery: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

// Shipments Mock Data
const generateShipments = (count: number): Shipment[] => {
  const statuses: Shipment['status'][] = [
    'pending', 'picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'
  ];
  const carriers = ['DHL Express', 'FedEx', 'UPS', 'BlueDart', 'Delhivery'];
  
  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const events: Shipment['events'] = [
      {
        id: `evt-${generateId()}`,
        shipmentId: `ship-${i}`,
        status: 'pending',
        location: 'Origin Warehouse',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Shipment created',
      },
    ];
    
    if (['picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'delivered'].includes(status)) {
      events.push({
        id: `evt-${generateId()}`,
        shipmentId: `ship-${i}`,
        status: 'picked_up',
        location: 'Origin Hub',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Package picked up by carrier',
      });
    }
    
    if (['in_transit', 'at_hub', 'out_for_delivery', 'delivered'].includes(status)) {
      events.push({
        id: `evt-${generateId()}`,
        shipmentId: `ship-${i}`,
        status: 'in_transit',
        location: 'Transit Hub',
        coordinates: { lat: 34.0522 + Math.random() * 5, lng: -118.2437 + Math.random() * 5 },
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'In transit to destination',
      });
    }
    
    return {
      id: `ship-${generateId()}`,
      trackingNumber: `TRK${String(Math.floor(Math.random() * 9000000000) + 1000000000)}`,
      orderId: `ord-${generateId()}`,
      carrierId: `car-${Math.floor(Math.random() * 5)}`,
      carrierName: carriers[Math.floor(Math.random() * carriers.length)],
      status,
      origin: {
        street: '123 Warehouse Dr',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA',
        coordinates: { lat: 34.0522, lng: -118.2437 },
      },
      destination: {
        street: '456 Customer Ave',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
        coordinates: { lat: 40.7128, lng: -74.006 },
      },
      currentLocation: { lat: 34.0522 + Math.random() * 6, lng: -118.2437 + Math.random() * 40 },
      events,
      weight: Math.random() * 20 + 1,
      estimatedDelivery: new Date(Date.now() + Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
      slaDeadline: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      cost: Math.floor(Math.random() * 100) + 15,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

// Warehouses Mock Data
const mockWarehouses: Warehouse[] = [
  {
    id: 'wh-1',
    code: 'WH-MUM',
    name: 'Mumbai Fulfillment Center',
    type: 'fulfillment',
    address: {
      street: '123 Industrial Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      coordinates: { lat: 19.0760, lng: 72.8777 },
    },
    capacity: 50000,
    currentUtilization: 72,
    utilizationPercentage: 72,
    inventoryCount: 15420,
    zones: 8,
    location: { lat: 19.0760, lng: 72.8777 },
    status: 'active',
    contactEmail: 'mumbai-warehouse@twinchain.in',
    contactPhone: '+91-22-1234-5678',
    operatingHours: { open: '06:00', close: '22:00', timezone: 'America/Los_Angeles' },
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'wh-2',
    code: 'WH-DEL',
    name: 'Delhi Distribution Hub',
    type: 'distribution',
    address: {
      street: '456 Commerce Way',
      city: 'Delhi',
      state: 'Delhi',
      postalCode: '110001',
      country: 'India',
      coordinates: { lat: 28.7041, lng: 77.1025 },
    },
    capacity: 35000,
    currentUtilization: 85,
    utilizationPercentage: 85,
    inventoryCount: 12350,
    zones: 6,
    location: { lat: 28.7041, lng: 77.1025 },
    status: 'active',
    contactEmail: 'delhi-warehouse@twinchain.in',
    contactPhone: '+91-11-1234-5678',
    operatingHours: { open: '05:00', close: '23:00', timezone: 'America/New_York' },
    createdAt: '2023-02-15T00:00:00Z',
  },
  {
    id: 'wh-3',
    code: 'WH-BLR',
    name: 'Bangalore Cross-Dock Center',
    type: 'cross_dock',
    address: {
      street: '789 Whitefield Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560066',
      country: 'India',
      coordinates: { lat: 12.9716, lng: 77.5946 },
    },
    capacity: 25000,
    currentUtilization: 58,
    utilizationPercentage: 58,
    inventoryCount: 8920,
    zones: 4,
    location: { lat: 12.9716, lng: 77.5946 },
    status: 'active',
    contactEmail: 'bangalore-warehouse@twinchain.in',
    contactPhone: '+91-80-1234-5678',
    operatingHours: { open: '07:00', close: '21:00', timezone: 'Asia/Kolkata' },
    createdAt: '2023-03-20T00:00:00Z',
  },
  {
    id: 'wh-4',
    code: 'WH-MIA',
    name: 'Miami Cold Storage Facility',
    type: 'cold_storage',
    address: {
      street: '321 Refrigerated Ln',
      city: 'Miami',
      state: 'FL',
      postalCode: '33101',
      country: 'USA',
      coordinates: { lat: 25.7617, lng: -80.1918 },
    },
    capacity: 15000,
    currentUtilization: 45,
    utilizationPercentage: 45,
    inventoryCount: 3200,
    zones: 3,
    location: { lat: 25.7617, lng: -80.1918 },
    status: 'active',
    contactEmail: 'mia-warehouse@logitower.com',
    contactPhone: '+1-555-0104',
    operatingHours: { open: '00:00', close: '23:59', timezone: 'America/New_York' },
    createdAt: '2023-05-10T00:00:00Z',
  },
];

// Carriers Mock Data
const mockCarriers: Carrier[] = [
  {
    id: 'car-1',
    code: 'DHL',
    name: 'DHL Express',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/DHL_Logo.svg/200px-DHL_Logo.svg.png',
    type: 'multimodal',
    status: 'active',
    rating: 4.5,
    onTimeDeliveryRate: 94.2,
    damageRate: 0.8,
    lossRate: 0.1,
    averageDeliveryTime: 2.3,
    activeShipments: 1250,
    totalShipments: 45000,
    services: ['Express', 'Same Day', 'International', 'Freight'],
    serviceAreas: ['North America', 'Europe', 'Asia'],
    rateCard: [],
    contactEmail: 'support@dhl.com',
    contactPhone: '+1-800-225-5345',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'car-2',
    code: 'FEDEX',
    name: 'FedEx',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/FedEx_Express_Logo.svg/200px-FedEx_Express_Logo.svg.png',
    type: 'multimodal',
    status: 'active',
    rating: 4.3,
    onTimeDeliveryRate: 92.8,
    damageRate: 1.2,
    lossRate: 0.2,
    averageDeliveryTime: 2.5,
    activeShipments: 980,
    totalShipments: 38000,
    services: ['Priority', 'Ground', 'International', 'Freight'],
    serviceAreas: ['North America', 'Europe', 'Asia', 'South America'],
    rateCard: [],
    contactEmail: 'support@fedex.com',
    contactPhone: '+1-800-463-3339',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'car-3',
    code: 'UPS',
    name: 'UPS',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/United_Parcel_Service_logo_2014.svg/200px-United_Parcel_Service_logo_2014.svg.png',
    type: 'multimodal',
    status: 'active',
    rating: 4.4,
    onTimeDeliveryRate: 93.5,
    damageRate: 0.9,
    lossRate: 0.15,
    averageDeliveryTime: 2.4,
    activeShipments: 1120,
    totalShipments: 42000,
    services: ['Next Day Air', 'Ground', 'Worldwide Express', 'Freight'],
    serviceAreas: ['North America', 'Europe', 'Asia'],
    rateCard: [],
    contactEmail: 'support@ups.com',
    contactPhone: '+1-800-742-5877',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'car-4',
    code: 'BLUEDART',
    name: 'BlueDart',
    type: 'ground',
    status: 'active',
    rating: 4.1,
    onTimeDeliveryRate: 89.5,
    damageRate: 1.5,
    lossRate: 0.3,
    averageDeliveryTime: 3.2,
    activeShipments: 450,
    totalShipments: 15000,
    services: ['Express', 'Surface', 'Dart Plus'],
    serviceAreas: ['India', 'South Asia'],
    rateCard: [],
    contactEmail: 'support@bluedart.com',
    contactPhone: '+91-1860-233-1234',
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'car-5',
    code: 'DELHIVERY',
    name: 'Delhivery',
    type: 'ground',
    status: 'active',
    rating: 4.0,
    onTimeDeliveryRate: 88.2,
    damageRate: 1.8,
    lossRate: 0.4,
    averageDeliveryTime: 3.5,
    activeShipments: 320,
    totalShipments: 12000,
    services: ['Express', 'Part Load', 'Full Load'],
    serviceAreas: ['India'],
    rateCard: [],
    contactEmail: 'support@delhivery.com',
    contactPhone: '+91-1860-266-6766',
    createdAt: '2023-01-01T00:00:00Z',
  },
];

// SLA Policies Mock Data
const mockSLAPolicies: SLAPolicy[] = [
  {
    id: 'sla-1',
    name: 'Express Delivery - Metro',
    serviceType: 'express',
    region: 'Metro Cities',
    targetDeliveryHours: 24,
    warningThresholdHours: 20,
    penaltyAmount: 50,
    penaltyType: 'fixed',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'sla-2',
    name: 'Standard Delivery - Nationwide',
    serviceType: 'standard',
    region: 'Nationwide',
    targetDeliveryHours: 72,
    warningThresholdHours: 60,
    penaltyAmount: 10,
    penaltyType: 'percentage',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
  },
  {
    id: 'sla-3',
    name: 'Bulk Shipping - Regional',
    serviceType: 'bulk',
    region: 'Regional',
    targetDeliveryHours: 120,
    warningThresholdHours: 96,
    penaltyAmount: 25,
    penaltyType: 'fixed',
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
  },
];

// Generate SLA Violations
const generateSLAViolations = (count: number): SLAViolation[] => {
  const statuses: SLAViolation['status'][] = ['pending', 'acknowledged', 'resolved', 'waived'];
  
  return Array.from({ length: count }, () => ({
    id: `vio-${generateId()}`,
    shipmentId: `ship-${generateId()}`,
    orderId: `ord-${generateId()}`,
    policyId: mockSLAPolicies[Math.floor(Math.random() * mockSLAPolicies.length)].id,
    policyName: mockSLAPolicies[Math.floor(Math.random() * mockSLAPolicies.length)].name,
    expectedDelivery: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
    actualDelivery: Math.random() > 0.3 ? new Date().toISOString() : undefined,
    delayHours: Math.floor(Math.random() * 48) + 1,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    penaltyAmount: Math.floor(Math.random() * 100) + 10,
    carrierId: mockCarriers[Math.floor(Math.random() * mockCarriers.length)].id,
    carrierName: mockCarriers[Math.floor(Math.random() * mockCarriers.length)].name,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

// Generate Returns
const generateReturns = (count: number): Return[] => {
  const statuses: Return['status'][] = [
    'requested', 'approved', 'rejected', 'pickup_scheduled', 'picked_up',
    'in_transit', 'received', 'inspected', 'refunded', 'replaced', 'closed',
    'pending', 'processing', 'completed'
  ];
  const reasons: Return['reason'][] = [
    'damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'quality_issue', 'late_delivery', 'other'
  ];
  const returnTypes: Return['type'][] = ['refund', 'exchange', 'store_credit'];
  
  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const isRefunded = ['refunded', 'completed', 'closed'].includes(status);
    
    return {
      id: `ret-${generateId()}`,
      rmaNumber: `RMA-${String(100000 + i).padStart(6, '0')}`,
      orderId: `ord-${generateId()}`,
      orderNumber: `ORD-${String(100000 + Math.floor(Math.random() * 1000)).padStart(6, '0')}`,
      customerId: `cust-${generateId()}`,
      customerName: `Customer ${Math.floor(Math.random() * 100)}`,
      status,
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      type: returnTypes[Math.floor(Math.random() * returnTypes.length)],
      items: [
        {
          id: `item-${generateId()}`,
          productId: `prod-${generateId()}`,
          productName: `Product ${Math.floor(Math.random() * 100)}`,
          name: `Product ${Math.floor(Math.random() * 100)}`,
          sku: `SKU-${Math.floor(Math.random() * 10000)}`,
          quantity: Math.floor(Math.random() * 3) + 1,
        },
      ],
      pickupAddress: {
        street: `${Math.floor(Math.random() * 900) + 100} Return Lane`,
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      warehouseId: mockWarehouses[Math.floor(Math.random() * mockWarehouses.length)].id,
      notes: Math.random() > 0.5 ? 'Customer provided additional details about the return.' : undefined,
      trackingNumber: Math.random() > 0.3 ? `TRK${Math.floor(Math.random() * 1000000000)}` : undefined,
      refundAmount: isRefunded ? Math.floor(Math.random() * 200) + 20 : undefined,
      requestedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

// Generate Exceptions
const generateExceptions = (count: number): Exception[] => {
  const types: Exception['type'][] = [
    'delay', 'damage', 'lost', 'wrong_address', 'customer_unavailable', 'carrier_issue', 'weather', 'other'
  ];
  const severities: Exception['severity'][] = ['low', 'medium', 'high', 'critical'];
  const statuses: Exception['status'][] = [
    'open', 'investigating', 'pending_resolution', 'resolved', 'escalated', 'closed'
  ];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `exc-${generateId()}`,
    ticketNumber: `EXC-${String(100000 + i).padStart(6, '0')}`,
    shipmentId: `ship-${generateId()}`,
    orderId: `ord-${generateId()}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    title: `Exception ${i + 1}: Shipment Issue`,
    description: 'Shipment encountered an issue during transit that requires attention.',
    slaImpact: Math.random() > 0.5,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

// Generate Inventory
const generateInventory = (count: number): InventoryItem[] => {
  const categories = ['electronics', 'clothing', 'food', 'furniture', 'automotive', 'health'];
  const units = ['pieces', 'boxes', 'pallets', 'units', 'kg', 'liters'];
  const locations = ['Aisle A', 'Aisle B', 'Aisle C', 'Zone 1', 'Zone 2', 'Rack 01', 'Rack 02', 'Cold Storage'];
  
  return Array.from({ length: count }, (_, i) => {
    const warehouse = mockWarehouses[Math.floor(Math.random() * mockWarehouses.length)];
    const maxQuantity = Math.floor(Math.random() * 500) + 100;
    const quantity = Math.floor(Math.random() * maxQuantity * 0.9) + Math.floor(maxQuantity * 0.1);
    const reserved = Math.floor(Math.random() * quantity * 0.3);
    const minQuantity = Math.floor(maxQuantity * 0.15);
    
    return {
      id: `inv-${generateId()}`,
      productId: `prod-${generateId()}`,
      productName: `Product ${i + 1}`,
      name: `Product ${i + 1}`,
      sku: `SKU-${String(10000 + i).padStart(5, '0')}`,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      quantity,
      reservedQuantity: reserved,
      availableQuantity: quantity - reserved,
      minQuantity,
      maxQuantity,
      reorderPoint: 50,
      reorderQuantity: 200,
      unitCost: Math.floor(Math.random() * 100) + 10,
      category: categories[Math.floor(Math.random() * categories.length)],
      unit: units[Math.floor(Math.random() * units.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      lastRestocked: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
};

// Generate Notifications
const generateNotifications = (): Notification[] => {
  return [
    {
      id: 'notif-1',
      type: 'sla',
      title: 'SLA Breach Alert',
      message: 'Order #ORD-100234 has breached SLA deadline',
      isRead: false,
      actionUrl: '/sla/violations',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-2',
      type: 'exception',
      title: 'New Exception Created',
      message: 'Shipment TRK123456789 reported as damaged',
      isRead: false,
      actionUrl: '/exceptions',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-3',
      type: 'order',
      title: 'High Priority Order',
      message: 'Express order #ORD-100456 requires immediate attention',
      isRead: true,
      actionUrl: '/orders/ord-100456',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-4',
      type: 'return',
      title: 'Return Request',
      message: 'New return request RMA-100023 received',
      isRead: true,
      actionUrl: '/returns',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-5',
      type: 'system',
      title: 'System Maintenance',
      message: 'Scheduled maintenance tonight at 2:00 AM EST',
      isRead: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
};

// Dashboard Metrics
const generateDashboardMetrics = (): DashboardMetrics => ({
  totalOrders: 12458,
  ordersChange: 12.5,
  activeShipments: 3247,
  shipmentsChange: 8.3,
  deliveryRate: 94.7,
  deliveryRateChange: 2.1,
  slaCompliance: 96.2,
  slaComplianceChange: -1.3,
  pendingReturns: 156,
  returnsChange: -5.2,
  activeExceptions: 42,
  exceptionsChange: 15.7,
  revenue: 2847563,
  revenueChange: 18.4,
  avgDeliveryTime: 2.4,
  avgDeliveryTimeChange: -8.3,
});

// Chart Data
const generateChartData = (days: number): ChartDataPoint[] => {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    value: Math.floor(Math.random() * 500) + 200,
  }));
};

// Carrier Performance
const generateCarrierPerformance = (): CarrierPerformance[] => {
  return mockCarriers.map((carrier) => ({
    carrierId: carrier.id,
    carrierName: carrier.name,
    totalShipments: Math.floor(Math.random() * 5000) + 1000,
    onTimeDeliveries: Math.floor(Math.random() * 4500) + 900,
    lateDeliveries: Math.floor(Math.random() * 500) + 50,
    onTimeRate: carrier.onTimeDeliveryRate,
    avgDeliveryTime: carrier.averageDeliveryTime,
    rating: carrier.rating,
    slaViolations: Math.floor(Math.random() * 50) + 5,
  }));
};

// Warehouse Utilization
const generateWarehouseUtilization = (): WarehouseUtilization[] => {
  return mockWarehouses.map((warehouse) => ({
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    capacity: warehouse.capacity,
    used: Math.floor(warehouse.capacity * (warehouse.currentUtilization / 100)),
    utilizationRate: warehouse.currentUtilization,
    inboundToday: Math.floor(Math.random() * 200) + 50,
    outboundToday: Math.floor(Math.random() * 250) + 60,
  }));
};

// Mock API Functions
export const mockApi = {
  // Auth
  async login(email: string, _password: string): Promise<ApiResponse<{ user: User; accessToken: string; refreshToken: string }>> {
    void _password;
    await delay(800);
    // Find user by email or use default admin
    const user = mockUsers.find(u => u.email === email) || mockUsers[0];
    return { 
      data: { 
        user, 
        accessToken: 'mock-jwt-access-token-' + generateId(),
        refreshToken: 'mock-jwt-refresh-token-' + generateId()
      }, 
      success: true 
    };
  },

  async googleLogin(): Promise<ApiResponse<{ user: User; token: string }>> {
    await delay(800);
    // Simulate Google OAuth validation
    const user: User = {
      id: generateId(),
      email: 'user@example.com',
      name: 'Demo User',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Demo',
      role: 'admin',
      organizationId: 'org-1',
      permissions: ['all'],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    return { data: { user, token: 'mock-jwt-token' }, success: true };
  },

  async getCurrentUser(): Promise<ApiResponse<User>> {
    await delay(300);
    return { data: mockUsers[0], success: true };
  },

  async logout(): Promise<ApiResponse<null>> {
    await delay(300);
    return { data: null, success: true };
  },

  // Orders
  async getOrders(page = 1, pageSize = 10): Promise<PaginatedResponse<Order>> {
    await delay(500);
    const allOrders = generateOrders(100);
    const start = (page - 1) * pageSize;
    const data = allOrders.slice(start, start + pageSize);
    return {
      data,
      total: allOrders.length,
      page,
      pageSize,
      totalPages: Math.ceil(allOrders.length / pageSize),
    };
  },

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    await delay(300);
    const orders = generateOrders(1);
    return { data: { ...orders[0], id }, success: true };
  },

  async createOrder(orderData: Partial<Order>): Promise<ApiResponse<Order>> {
    await delay(500);
    const orders = generateOrders(1);
    return { data: { ...orders[0], ...orderData }, success: true, message: 'Order created successfully' };
  },

  async updateOrder(id: string, updates: Partial<Order>): Promise<ApiResponse<Order>> {
    await delay(400);
    const orders = generateOrders(1);
    return { data: { ...orders[0], id, ...updates }, success: true, message: 'Order updated successfully' };
  },

  // Shipments
  async getShipments(page = 1, pageSize = 10): Promise<PaginatedResponse<Shipment>> {
    await delay(500);
    const allShipments = generateShipments(80);
    const start = (page - 1) * pageSize;
    const data = allShipments.slice(start, start + pageSize);
    return {
      data,
      total: allShipments.length,
      page,
      pageSize,
      totalPages: Math.ceil(allShipments.length / pageSize),
    };
  },

  async getShipment(id: string): Promise<ApiResponse<Shipment>> {
    await delay(300);
    const shipments = generateShipments(1);
    return { data: { ...shipments[0], id }, success: true };
  },

  async getShipmentTimeline(): Promise<ApiResponse<Shipment['events']>> {
    await delay(300);
    const shipments = generateShipments(1);
    return { data: shipments[0].events, success: true };
  },

  // Warehouses
  async getWarehouses(): Promise<ApiResponse<Warehouse[]>> {
    await delay(400);
    return { data: mockWarehouses, success: true };
  },

  async getWarehouse(id: string): Promise<ApiResponse<Warehouse>> {
    await delay(300);
    const warehouse = mockWarehouses.find((w) => w.id === id) || mockWarehouses[0];
    return { data: warehouse, success: true };
  },

  // Inventory
  async getInventory(page = 1, pageSize = 10): Promise<PaginatedResponse<InventoryItem>> {
    await delay(500);
    const allInventory = generateInventory(200);
    const start = (page - 1) * pageSize;
    const data = allInventory.slice(start, start + pageSize);
    return {
      data,
      total: allInventory.length,
      page,
      pageSize,
      totalPages: Math.ceil(allInventory.length / pageSize),
    };
  },

  // Carriers
  async getCarriers(): Promise<ApiResponse<Carrier[]>> {
    await delay(400);
    return { data: mockCarriers, success: true };
  },

  async getCarrier(id: string): Promise<ApiResponse<Carrier>> {
    await delay(300);
    const carrier = mockCarriers.find((c) => c.id === id) || mockCarriers[0];
    return { data: carrier, success: true };
  },

  // SLA
  async getSLAPolicies(): Promise<ApiResponse<SLAPolicy[]>> {
    await delay(400);
    return { data: mockSLAPolicies, success: true };
  },

  async getSLAViolations(page = 1, pageSize = 10): Promise<PaginatedResponse<SLAViolation>> {
    await delay(500);
    const allViolations = generateSLAViolations(50);
    const start = (page - 1) * pageSize;
    const data = allViolations.slice(start, start + pageSize);
    return {
      data,
      total: allViolations.length,
      page,
      pageSize,
      totalPages: Math.ceil(allViolations.length / pageSize),
    };
  },

  // Returns
  async getReturns(page = 1, pageSize = 10): Promise<PaginatedResponse<Return>> {
    await delay(500);
    const allReturns = generateReturns(60);
    const start = (page - 1) * pageSize;
    const data = allReturns.slice(start, start + pageSize);
    return {
      data,
      total: allReturns.length,
      page,
      pageSize,
      totalPages: Math.ceil(allReturns.length / pageSize),
    };
  },

  async getReturn(id: string): Promise<ApiResponse<Return>> {
    await delay(300);
    const returns = generateReturns(1);
    return { data: { ...returns[0], id }, success: true };
  },

  // Exceptions
  async getExceptions(page = 1, pageSize = 10): Promise<PaginatedResponse<Exception>> {
    await delay(500);
    const allExceptions = generateExceptions(45);
    const start = (page - 1) * pageSize;
    const data = allExceptions.slice(start, start + pageSize);
    return {
      data,
      total: allExceptions.length,
      page,
      pageSize,
      totalPages: Math.ceil(allExceptions.length / pageSize),
    };
  },

  async getException(id: string): Promise<ApiResponse<Exception>> {
    await delay(300);
    const exceptions = generateExceptions(1);
    return { data: { ...exceptions[0], id }, success: true };
  },

  // Dashboard & Analytics
  async getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
    await delay(400);
    return { data: generateDashboardMetrics(), success: true };
  },

  async getOrdersChart(days = 30): Promise<ApiResponse<ChartDataPoint[]>> {
    await delay(300);
    return { data: generateChartData(days), success: true };
  },

  async getCarrierPerformance(): Promise<ApiResponse<CarrierPerformance[]>> {
    await delay(400);
    return { data: generateCarrierPerformance(), success: true };
  },

  async getWarehouseUtilization(): Promise<ApiResponse<WarehouseUtilization[]>> {
    await delay(400);
    return { data: generateWarehouseUtilization(), success: true };
  },

  // SLA Dashboard
  async getSLADashboard(): Promise<ApiResponse<SLADashboardData>> {
    await delay(400);
    return {
      data: {
        overallCompliance: 94.5,
        totalShipments: 1250,
        onTimeDeliveries: 1182,
        violations: { pending: 12, resolved: 45, waived: 11 },
        topCarriers: [
          { name: 'DHL Express', reliabilityScore: 0.95, shipmentCount: 450 },
          { name: 'FedEx', reliabilityScore: 0.92, shipmentCount: 380 },
          { name: 'UPS', reliabilityScore: 0.88, shipmentCount: 250 },
        ],
      },
      success: true,
    };
  },

  // Finance
  async getFinanceData(): Promise<ApiResponse<FinanceData>> {
    await delay(400);
    return {
      data: {
        outstandingInvoices: 12450.75,
        refundsProcessed: 3280.50,
        disputes: 2,
        payoutStatus: 'Scheduled for Jan 25, 2026',
        invoices: [
          {
            id: 'inv-1',
            invoiceNumber: 'INV-2026-001',
            carrier: 'DHL Express',
            amount: 5420.25,
            status: 'pending',
            dueDate: '2026-01-25',
          },
          {
            id: 'inv-2',
            invoiceNumber: 'INV-2026-002',
            carrier: 'FedEx',
            amount: 3890.50,
            status: 'pending',
            dueDate: '2026-01-28',
          },
          {
            id: 'inv-3',
            invoiceNumber: 'INV-2025-145',
            carrier: 'UPS',
            amount: 3140.00,
            status: 'paid',
            dueDate: '2026-01-15',
          },
          {
            id: 'inv-4',
            invoiceNumber: 'INV-2026-003',
            carrier: 'BlueDart',
            amount: 2250.75,
            status: 'pending',
            dueDate: '2026-01-30',
          },
        ],
        refunds: [
          {
            id: 'ref-1',
            orderNumber: 'ORD-100234',
            amount: 89.99,
            status: 'processed',
            processedAt: '2026-01-15',
          },
          {
            id: 'ref-2',
            orderNumber: 'ORD-100189',
            amount: 124.50,
            status: 'processed',
            processedAt: '2026-01-14',
          },
          {
            id: 'ref-3',
            orderNumber: 'ORD-100456',
            amount: 299.99,
            status: 'pending',
            processedAt: '2026-01-18',
          },
          {
            id: 'ref-4',
            orderNumber: 'ORD-100512',
            amount: 45.25,
            status: 'processed',
            processedAt: '2026-01-16',
          },
        ],
      },
      success: true,
    };
  },

  // Notifications
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    await delay(300);
    return { data: generateNotifications(), success: true };
  },

  async markNotificationRead(): Promise<ApiResponse<null>> {
    await delay(200);
    return { data: null, success: true };
  },

  async markAllNotificationsRead(): Promise<ApiResponse<null>> {
    await delay(200);
    return { data: null, success: true };
  },

  // Add mock data for shipments
  mockShipments: [
    {
      id: 'shipment-1',
      status: 'delivered',
      orderId: 'ord-1',
      carrierId: 'car-1',
      trackingNumber: 'TRK123456789',
      origin: {
        street: '123 Warehouse Dr',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90001',
        country: 'USA',
      },
      destination: {
        street: '456 Customer Ave',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'USA',
      },
      weight: 2.5,
      cost: 15.0,
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-12T10:00:00Z',
      events: [
        {
          id: 'evt-1',
          shipmentId: 'shipment-1',
          status: 'picked_up',
          location: 'Origin Hub',
          timestamp: '2024-01-10T12:00:00Z',
          description: 'Package picked up by carrier',
        },
        {
          id: 'evt-2',
          shipmentId: 'shipment-1',
          status: 'in_transit',
          location: 'Transit Hub',
          timestamp: '2024-01-11T08:00:00Z',
          description: 'In transit to destination',
        },
        {
          id: 'evt-3',
          shipmentId: 'shipment-1',
          status: 'delivered',
          location: 'Destination',
          timestamp: '2024-01-12T09:00:00Z',
          description: 'Package delivered to customer',
        },
      ],
    },
    {
      id: 'shipment-2',
      status: 'in_transit',
      orderId: 'ord-2',
      carrierId: 'car-2',
      trackingNumber: 'TRK987654321',
      origin: {
        street: '789 Logistics Dr',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
      },
      destination: {
        street: '321 Customer Blvd',
        city: 'Houston',
        state: 'TX',
        postalCode: '77001',
        country: 'USA',
      },
      weight: 10.0,
      cost: 50.0,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
      events: [
        {
          id: 'evt-4',
          shipmentId: 'shipment-2',
          status: 'picked_up',
          location: 'Origin Hub',
          timestamp: '2024-01-15T12:00:00Z',
          description: 'Package picked up by carrier',
        },
        {
          id: 'evt-5',
          shipmentId: 'shipment-2',
          status: 'in_transit',
          location: 'Transit Hub',
          timestamp: '2024-01-16T08:00:00Z',
          description: 'In transit to destination',
        },
      ],
    },
  ],
};

export default mockApi;
