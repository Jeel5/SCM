import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';

// Extract component outside of render
function NotificationToggle({
  label,
  description,
  isEnabled,
  onToggle,
}: {
  label: string;
  description: string;
  isEnabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            isEnabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

export function NotificationSettings() {
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
            isEnabled={settings.emailNotifications}
            onToggle={() => toggleSetting('emailNotifications')}
          />
          <NotificationToggle
            label="Push Notifications"
            description="Receive push notifications in browser"
            isEnabled={settings.pushNotifications}
            onToggle={() => toggleSetting('pushNotifications')}
          />
          <NotificationToggle
            label="Order Updates"
            description="Get notified about order status changes"
            isEnabled={settings.orderUpdates}
            onToggle={() => toggleSetting('orderUpdates')}
          />
          <NotificationToggle
            label="Shipment Alerts"
            description="Receive alerts for shipment delays and updates"
            isEnabled={settings.shipmentAlerts}
            onToggle={() => toggleSetting('shipmentAlerts')}
          />
          <NotificationToggle
            label="Exception Alerts"
            description="Get notified about critical exceptions"
            isEnabled={settings.exceptionAlerts}
            onToggle={() => toggleSetting('exceptionAlerts')}
          />
          <NotificationToggle
            label="Daily Digest"
            description="Receive a daily summary of activities"
            isEnabled={settings.dailyDigest}
            onToggle={() => toggleSetting('dailyDigest')}
          />
          <NotificationToggle
            label="Weekly Report"
            description="Receive weekly performance reports"
            isEnabled={settings.weeklyReport}
            onToggle={() => toggleSetting('weeklyReport')}
          />
        </div>
      </CardContent>
    </Card>
  );
}
