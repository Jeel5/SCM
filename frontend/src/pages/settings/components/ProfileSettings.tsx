import { User, Mail, Phone, Building2, Save } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores';

export function ProfileSettings() {
  const { user } = useAuthStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
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
