// Order validation schemas - defines rules for order creation and updates

export const createOrderSchema = {
  order_number: {
    type: 'string',
    required: false, // Auto-generated if not provided
    minLength: 3,
    maxLength: 50
  },
  customer_name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  customer_email: {
    type: 'string',
    required: true,
    email: true
  },
  customer_phone: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 20
  },
  status: {
    type: 'string',
    required: false,
    enum: ['created', 'confirmed', 'allocated', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled']
  },
  priority: {
    type: 'string',
    required: false,
    enum: ['express', 'standard', 'bulk']
  },
  total_amount: {
    type: 'number',
    required: true,
    min: 0
  },
  currency: {
    type: 'string',
    required: false,
    enum: ['USD', 'EUR', 'GBP', 'INR']
  },
  shipping_address: {
    type: 'object',
    required: true,
    custom: (value) => {
      if (!value.street || !value.city || !value.postal_code || !value.country) {
        return 'Shipping address must include street, city, postal_code, and country';
      }
    }
  },
  billing_address: {
    type: 'object',
    required: false
  },
  estimated_delivery: {
    type: 'string',
    required: false
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  items: {
    type: 'array',
    required: true,
    minItems: 1,
    items: {
      product_id: {
        type: 'string',
        required: true
      },
      sku: {
        type: 'string',
        required: true
      },
      product_name: {
        type: 'string',
        required: true
      },
      quantity: {
        type: 'number',
        required: true,
        min: 1,
        integer: true
      },
      unit_price: {
        type: 'number',
        required: true,
        min: 0
      },
      weight: {
        type: 'number',
        required: false,
        min: 0
      },
      warehouse_id: {
        type: 'string',
        required: false
      }
    }
  }
};

export const updateOrderStatusSchema = {
  status: {
    type: 'string',
    required: true,
    enum: ['created', 'confirmed', 'allocated', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled']
  },
  notes: {
    type: 'string',
    required: false,
    maxLength: 1000
  }
};

export const listOrdersQuerySchema = {
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
    enum: ['created', 'confirmed', 'allocated', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled']
  },
  search: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  sortBy: {
    type: 'string',
    required: false,
    enum: ['created_at', 'updated_at', 'total_amount', 'status']
  },
  sortOrder: {
    type: 'string',
    required: false,
    enum: ['ASC', 'DESC']
  }
};
