// Inventory validation schemas - defines rules for stock management

export const createInventorySchema = {
  product_id: {
    type: 'string',
    required: true
  },
  sku: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100
  },
  product_name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  warehouse_id: {
    type: 'string',
    required: true
  },
  location: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  quantity: {
    type: 'number',
    required: true,
    min: 0,
    integer: true
  },
  reserved_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  available_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  reorder_point: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  reorder_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  unit_cost: {
    type: 'number',
    required: false,
    min: 0
  },
  status: {
    type: 'string',
    required: false,
    enum: ['available', 'low_stock', 'out_of_stock', 'discontinued']
  }
};

export const updateInventorySchema = {
  quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  reserved_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  available_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  location: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  reorder_point: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  reorder_quantity: {
    type: 'number',
    required: false,
    min: 0,
    integer: true
  },
  unit_cost: {
    type: 'number',
    required: false,
    min: 0
  },
  status: {
    type: 'string',
    required: false,
    enum: ['available', 'low_stock', 'out_of_stock', 'discontinued']
  }
};

export const adjustInventorySchema = {
  adjustment_type: {
    type: 'string',
    required: true,
    enum: ['add', 'remove', 'set', 'reserve', 'release']
  },
  quantity: {
    type: 'number',
    required: true,
    min: 0,
    integer: true
  },
  reason: {
    type: 'string',
    required: true,
    minLength: 5,
    maxLength: 500
  },
  reference_id: {
    type: 'string',
    required: false
  }
};

export const listInventoryQuerySchema = {
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
  warehouse_id: {
    type: 'string',
    required: false
  },
  status: {
    type: 'string',
    required: false,
    enum: ['available', 'low_stock', 'out_of_stock', 'discontinued']
  },
  search: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  low_stock: {
    type: 'string',
    required: false,
    enum: ['true', 'false']
  }
};
