const SUBSCRIPTION_LIMITS = {
  starter: {
    maxUsers: 25,
  },
  standard: {
    maxUsers: 200,
  },
  enterprise: {
    maxUsers: null,
  },
};

export function getSubscriptionLimits(tier = 'standard') {
  return SUBSCRIPTION_LIMITS[tier] || SUBSCRIPTION_LIMITS.standard;
}

export default SUBSCRIPTION_LIMITS;
