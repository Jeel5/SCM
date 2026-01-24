import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Bell,
  Shield,
  Key,
  Mail,
  Phone,
  Building2,
  Save,
  Check,
  Palette,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui';
import { useAuthStore, useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

// Profile Settings Section
function ProfileSettings() {
  const { user } = useAuthStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}&background=3B82F6&color=fff&size=128`}
                alt={user?.name}
                className="h-24 w-24 rounded-2xl object-cover"
              />
              <button
                type="button"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
              >
                <Palette className="h-4 w-4" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{user?.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">
                Role: {user?.role.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              defaultValue={user?.name.split(' ')[0]}
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="Last Name"
              defaultValue={user?.name.split(' ')[1]}
              leftIcon={<User className="h-4 w-4" />}
            />
          </div>
          <Input
            label="Email Address"
            type="email"
            defaultValue={user?.email}
            leftIcon={<Mail className="h-4 w-4" />}
          />
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+1 (555) 000-0000"
            leftIcon={<Phone className="h-4 w-4" />}
          />
          <Input
            label="Department"
            defaultValue={user?.role || 'Operations'}
            leftIcon={<Building2 className="h-4 w-4" />}
          />

          <div className="flex justify-end">
            <Button variant="primary" leftIcon={<Save className="h-4 w-4" />}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Notification Settings Section
function NotificationSettings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderUpdates: true,
    shipmentAlerts: true,
    exceptionAlerts: true,
    dailyDigest: false,
    weeklyReport: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const NotificationToggle = ({
    label,
    description,
    settingKey,
  }: {
    label: string;
    description: string;
    settingKey: keyof typeof settings;
  }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => toggleSetting(settingKey)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          settings[settingKey] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            settings[settingKey] ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          <NotificationToggle
            label="Email Notifications"
            description="Receive notifications via email"
            settingKey="emailNotifications"
          />
          <NotificationToggle
            label="Push Notifications"
            description="Receive push notifications in browser"
            settingKey="pushNotifications"
          />
          <NotificationToggle
            label="Order Updates"
            description="Get notified about order status changes"
            settingKey="orderUpdates"
          />
          <NotificationToggle
            label="Shipment Alerts"
            description="Receive alerts for shipment delays and updates"
            settingKey="shipmentAlerts"
          />
          <NotificationToggle
            label="Exception Alerts"
            description="Get notified about critical exceptions"
            settingKey="exceptionAlerts"
          />
          <NotificationToggle
            label="Daily Digest"
            description="Receive a daily summary of activities"
            settingKey="dailyDigest"
          />
          <NotificationToggle
            label="Weekly Report"
            description="Receive weekly performance reports"
            settingKey="weeklyReport"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Security Settings Section
function SecuritySettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Change Password */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last changed 30 days ago</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Enable 2FA
              </Button>
            </div>
          </div>

          {/* Active Sessions */}
          <div>
            <p className="font-medium text-gray-900 dark:text-white mb-3">Active Sessions</p>
            <div className="space-y-3">
              {[
                { device: 'Windows PC - Chrome', location: 'New York, US', current: true },
                { device: 'iPhone 13 - Safari', location: 'New York, US', current: false },
                { device: 'MacBook Pro - Chrome', location: 'Los Angeles, US', current: false },
              ].map((session, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      session.current ? 'bg-green-500' : 'bg-gray-300'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{session.device}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{session.location}</p>
                    </div>
                  </div>
                  {session.current ? (
                    <span className="text-xs text-green-600 font-medium">Current</span>
                  ) : (
                    <button className="text-xs text-red-600 hover:text-red-700 font-medium">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Settings Page
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account settings and preferences</p>
      </motion.div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:w-64 shrink-0"
        >
          <nav className="space-y-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-2 transition-colors duration-300">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <tab.icon className="h-5 w-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </motion.div>

        {/* Main Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1"
        >
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
        </motion.div>
      </div>
    </div>
  );
}
