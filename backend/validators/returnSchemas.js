// Return validation schemas - defines rules for return requests

export const createReturnSchema = {
  order_id: {
    type: 'string',
    required: true
  },
  return_number: {
    type: 'string',
    required: false,
    minLength: 5,
    maxLength: 50
  },
  reason: {
    type: 'string',
    required: true,
    enum: ['damaged', 'defective', 'wrong_item', 'not_as_described', 'unwanted', 'size_issue', 'late_delivery', 'other']
  },
  reason_details: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  status: {
    type: 'string',
    required: false,
    enum: ['requested', 'approved', 'rejected', 'received', 'inspecting', 'completed', 'refunded']
  },
  requested_by: {
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
  refund_amount: {
    type: 'number',
    required: false,
    min: 0
  },
  refund_method: {
    type: 'string',
    required: false,
    enum: ['original_payment', 'store_credit', 'bank_transfer', 'check']
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
      condition: {
        type: 'string',
        required: false,
        enum: ['new', 'like_new', 'good', 'acceptable', 'poor', 'damaged']
      }
    }
  }
};

export const updateReturnStatusSchema = {
  status: {
    type: 'string',
    required: true,
    enum: ['requested', 'approved', 'rejected', 'received', 'inspecting', 'completed', 'refunded']
  },
  inspection_notes: {
    type: 'string',
    required: false,
    maxLength: 1000
  },
  refund_amount: {
    type: 'number',
    required: false,
    min: 0
  },
  refund_method: {
    type: 'string',
    required: false,
    enum: ['original_payment', 'store_credit', 'bank_transfer', 'check']
  }
};

export const listReturnsQuerySchema = {
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
    enum: ['requested', 'approved', 'rejected', 'received', 'inspecting', 'completed', 'refunded']
  },
  reason: {
    type: 'string',
    required: false,
    enum: ['damaged', 'defective', 'wrong_item', 'not_as_described', 'unwanted', 'size_issue', 'late_delivery', 'other']
  },
  search: {
    type: 'string',
    required: false,
    maxLength: 100
  }
};
