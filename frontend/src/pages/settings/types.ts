// Component Props
export interface ProfileSettingsProps {
  onUpdate?: () => void;
}

export interface NotificationSettingsProps {
  onUpdate?: () => void;
}

export interface SecuritySettingsProps {
  onUpdate?: () => void;
}

// Page State
export interface SettingsPageState {
  activeTab: SettingsTab;
  hasUnsavedChanges: boolean;
}

// Tab Types
export type SettingsTab = 'profile' | 'notifications' | 'security' | 'preferences' | 'billing';

export interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
}

// Profile Settings
export interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
}

// Notification Settings
export interface NotificationPreferences {
  email: {
    orderUpdates: boolean;
    shipmentUpdates: boolean;
    exceptionAlerts: boolean;
    slaViolations: boolean;
    dailySummary: boolean;
    weeklyReport: boolean;
  };
  push: {
    criticalAlerts: boolean;
    orderUpdates: boolean;
    mentions: boolean;
  };
  sms: {
    criticalAlerts: boolean;
    deliveryUpdates: boolean;
  };
}

// Security Settings
export interface SecurityFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  twoFactorEnabled: boolean;
  sessionTimeout: number;
}

export interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  ipAddress: string;
}

// Preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  sidebarCollapsed: boolean;
  defaultView: string;
  itemsPerPage: number;
  currency: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

// Billing (if needed)
export interface BillingInfo {
  plan: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  paymentMethod: PaymentMethod;
  billingHistory: BillingTransaction[];
}

export interface PaymentMethod {
  type: 'card' | 'bank';
  last4: string;
  expiryDate?: string;
  isDefault: boolean;
}

export interface BillingTransaction {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  invoiceUrl: string;
}
