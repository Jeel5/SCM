// Canonical return status contract used across validators, services, and repositories.

export const RETURN_STATUS_TRANSITIONS = {
  requested: ['approved', 'rejected'],
  approved: ['received', 'rejected'],
  received: ['inspecting'],
  inspecting: ['inspection_passed', 'inspection_failed', 'rejected'],
  inspection_passed: ['refunded', 'restocked'],
  inspection_failed: ['rejected'],
  refunded: [],
  restocked: [],
  rejected: [],
  cancelled: [],
  // Legacy mappings kept for backward compatibility with historical rows.
  inspected: ['refunded', 'restocked'],
  completed: [],
  pickup_scheduled: ['picked_up', 'rejected'],
  picked_up: ['in_transit', 'received'],
  in_transit: ['received'],
};

export const RETURN_STATUSES = Object.keys(RETURN_STATUS_TRANSITIONS);

export const RETURN_PENDING_STATUSES = [
  'requested',
  'pending',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'received',
  'inspecting',
];

export const RETURN_PROCESSING_STATUSES = [
  'inspection_passed',
  'inspection_failed',
  'inspected',
];

export const RETURN_COMPLETED_STATUSES = ['refunded', 'restocked', 'completed'];

export const RETURN_REFUND_ELIGIBLE_STATUSES = ['approved', 'inspected', 'refunded'];

export const OPEN_RETURN_STATUSES = RETURN_STATUSES.filter(
  (status) => !['rejected', 'cancelled', ...RETURN_COMPLETED_STATUSES].includes(status)
);
