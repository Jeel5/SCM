// User validation schemas - defines rules for authentication and registration

export const registerUserSchema = {
  username: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    custom: (value) => {
      if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        return 'Username can only contain letters, numbers, and underscores';
      }
    }
  },
  email: {
    type: 'string',
    required: true,
    email: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    custom: (value) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
      if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
      if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
    }
  },
  full_name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 255
  },
  role: {
    type: 'string',
    required: false,
    enum: ['admin', 'manager', 'operator', 'viewer']
  },
  department: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  phone: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 20
  }
};

export const loginUserSchema = {
  email: {
    type: 'string',
    required: true,
    email: true
  },
  password: {
    type: 'string',
    required: true,
    minLength: 1
  }
};

export const updateUserSchema = {
  email: {
    type: 'string',
    required: false,
    email: true
  },
  full_name: {
    type: 'string',
    required: false,
    minLength: 2,
    maxLength: 255
  },
  role: {
    type: 'string',
    required: false,
    enum: ['admin', 'manager', 'operator', 'viewer']
  },
  department: {
    type: 'string',
    required: false,
    maxLength: 100
  },
  phone: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 20
  },
  is_active: {
    type: 'string',
    required: false,
    enum: ['true', 'false']
  }
};

export const changePasswordSchema = {
  current_password: {
    type: 'string',
    required: true,
    minLength: 1
  },
  new_password: {
    type: 'string',
    required: true,
    minLength: 8,
    custom: (value) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
      if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
      if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
    }
  }
};

export const updateProfileSchema = {
  name: {
    type: 'string',
    required: false,
    minLength: 2,
    maxLength: 255
  },
  email: {
    type: 'string',
    required: false,
    email: true
  },
  phone: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 20
  },
  company: {
    type: 'string',
    required: false,
    maxLength: 255
  },
  avatar: {
    type: 'string',
    required: false,
    maxLength: 500
  }
};

export const notificationPreferencesSchema = {
  email_enabled: {
    type: 'boolean',
    required: false
  },
  push_enabled: {
    type: 'boolean',
    required: false
  },
  sms_enabled: {
    type: 'boolean',
    required: false
  },
  notification_types: {
    type: 'object',
    required: false,
    properties: {
      orders: { type: 'boolean' },
      shipments: { type: 'boolean' },
      sla_alerts: { type: 'boolean' },
      exceptions: { type: 'boolean' },
      returns: { type: 'boolean' },
      system_updates: { type: 'boolean' }
    }
  }
};
