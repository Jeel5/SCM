// Shipment validation schemas - defines rules for shipment operations

export const createShipmentSchema = {
  order_id: {
    type: 'string',
    required: true
  },
  tracking_number: {
    type: 'string',
    required: false,
    minLength: 5,
    maxLength: 100
  },
  carrier_id: {
    type: 'string',
    required: true
  },
  carrier_name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  service_type: {
    type: 'string',
    required: false,
    enum: ['express', 'standard', 'economy', 'overnight', 'two_day']
  },
  status: {
    type: 'string',
    required: false,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned']
  },
  origin: {
    type: 'object',
    required: true,
    custom: (value) => {
      if (!value.city || !value.country) {
        return 'Origin must include city and country';
      }
    }
  },
  destination: {
    type: 'object',
    required: true,
    custom: (value) => {
      if (!value.city || !value.country) {
        return 'Destination must include city and country';
      }
    }
  },
  estimated_delivery: {
    type: 'string',
    required: false
  },
  actual_delivery: {
    type: 'string',
    required: false
  },
  weight: {
    type: 'number',
    required: false,
    min: 0
  },
  dimensions: {
    type: 'object',
    required: false
  },
  cost: {
    type: 'number',
    required: false,
    min: 0
  }
};

export const updateShipmentStatusSchema = {
  status: {
    type: 'string',
    required: true,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned']
  },
  location: {
    type: 'object',
    required: false
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  actual_delivery: {
    type: 'string',
    required: false
  }
};

export const listShipmentsQuerySchema = {
  page: {
    type: 'string',
    required: false,
    custom: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return 'Page must be a positive integer';
    }
  },
  limit: {
    type: 'string',
    required: false,
    custom: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1 || num > 100) return 'Limit must be between 1 and 100';
    }
  },
  status: {
    type: 'string',
    required: false,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned']
  },
  carrier_id: {
    type: 'string',
    required: false
  },
  search: {
    type: 'string',
    required: false,
    maxLength: 100
  }
};
