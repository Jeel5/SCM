import { useState, useEffect } from 'react';
import { User, Mail, Phone, Building2, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { authApi, settingsApi } from '@/api/services';
import { useToastContext } from '@/components/ui/Toast';

export function ProfileSettings() {
  const { user, updateUser } = useAuthStore();
  const { success, error: toastError, info } = useToastContext();
  const [isSaving, setIsSaving] = useState(false);
  const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  // Track server values so we can diff before sending
  const [serverName, setServerName] = useState(user?.name || '');
  const [serverEmail, setServerEmail] = useState(user?.email || '');
  const [serverPhone, setServerPhone] = useState('');

  // Load full profile from server so phone (and other fields not in the JWT) are populated
  useEffect(() => {
    void (async () => {
      try {
        const res = await authApi.getProfile();
        const p = res.data as any;
        if (!p) return;
        setFirstName(p.name?.split(' ')[0] || '');
        setLastName(p.name?.split(' ').slice(1).join(' ') || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        // Record server baseline for diffing
        setServerName(p.name || '');
        setServerEmail(p.email || '');
        setServerPhone(p.phone || '');
      } catch {
        // Keep defaults from auth store
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const name = `${firstName} ${lastName}`.trim();
      const emailChanged = email !== serverEmail;

      // Only send fields that actually differ from what the server returned
      const payload: Record<string, string | undefined> = {};
      if (name && name !== serverName) payload.name = name;
      if (emailChanged && email) payload.email = email;
      if (phone !== serverPhone) payload.phone = phone || undefined;

      if (Object.keys(payload).length === 0) {
        info('No changes to save');
        return;
      }

      const res = await settingsApi.updateProfile(payload);

      // Keep the auth store in sync so the header/avatar reflect the new name
      if (res?.data) {
        const updated = res.data as any;
        updateUser({ name: updated.name, email: updated.email });
        // Update server baseline so next diff is correct
        if (updated.name) { setServerName(updated.name); }
        if (!emailChanged && updated.email) setServerEmail(updated.email);
        if (payload.phone !== undefined) setServerPhone(payload.phone || '');
      } else if (payload.name) {
        updateUser({ name: payload.name });
        setServerName(payload.name);
      }

      if (emailChanged) {
        success('Profile saved. Check your new email for a verification link.');
      } else {
        success('Profile updated successfully');
      }
    } catch (err: any) {
      toastError(err?.response?.data?.message || err?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name}&background=3B82F6&color=fff&size=128`}
                alt={user?.name}
                className="h-24 w-24 rounded-2xl object-cover"
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{user?.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">
                Role: {user?.role.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              leftIcon={<User className="h-4 w-4" />}
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              leftIcon={<User className="h-4 w-4" />}
            />
          </div>
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
          />
          <Input
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            leftIcon={<Phone className="h-4 w-4" />}
          />
          <Input
            label="Department"
            defaultValue={user?.role || 'Operations'}
            leftIcon={<Building2 className="h-4 w-4" />}
            disabled
          />

          <div className="flex justify-end">
            <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} isLoading={isSaving} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
