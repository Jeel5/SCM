import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { settingsApi } from '@/api/services';
import { useToastContext } from '@/components/ui/Toast';
import { Save } from 'lucide-react';
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
  const { success, error: toastError } = useToastContext();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    orderUpdates: true,
    shipmentAlerts: true,
    exceptionAlerts: true,
    dailyDigest: false,
    weeklyReport: true,
  });

  // Load preferences from backend on mount — convert snake_case backend keys to camelCase UI keys
  useEffect(() => {
    void (async () => {
      try {
        const res = await settingsApi.getNotificationPreferences();
        const d = res.data as any;
        if (!d) return;
        const types = d.notification_types || {};
        setSettings((prev) => ({
          ...prev,
          emailNotifications: d.email_enabled ?? prev.emailNotifications,
          pushNotifications: d.push_enabled ?? prev.pushNotifications,
          orderUpdates: types.orders ?? prev.orderUpdates,
          shipmentAlerts: types.shipments ?? prev.shipmentAlerts,
          exceptionAlerts: types.exceptions ?? prev.exceptionAlerts,
          weeklyReport: types.system_updates ?? prev.weeklyReport,
        }));
      } catch {
        // Use defaults
      }
    })();
  }, []);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Map camelCase UI state → snake_case backend schema
      await settingsApi.updateNotificationPreferences({
        email_enabled: settings.emailNotifications,
        push_enabled:  settings.pushNotifications,
        notification_types: {
          orders:       settings.orderUpdates,
          shipments:    settings.shipmentAlerts,
          exceptions:   settings.exceptionAlerts,
          system_updates: settings.weeklyReport,
          sla_alerts:   settings.exceptionAlerts,
          returns:      true,
        },
      } as any);
      success('Notification preferences saved');
      setIsDirty(false);
    } catch (err: any) {
      toastError(err?.response?.data?.message || err?.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
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
        {isDirty && (
          <div className="flex justify-end pt-4">
            <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={isSaving} onClick={handleSave}>
              Save Preferences
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
