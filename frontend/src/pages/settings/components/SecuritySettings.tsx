import { useState, useEffect } from 'react';
import { Key, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { settingsApi } from '@/api/services';
import { useToastContext } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export function SecuritySettings() {
  const { success, error: toastError } = useToastContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; ip: string; lastActive: string; current: boolean }>>([]);
  useEffect(() => {
    settingsApi.getActiveSessions().then((res) => {
      setSessions(res.data || []);
    }).catch(() => {
      // Fallback if sessions endpoint not ready
      setSessions([]);
    });
  }, []);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toastError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      toastError('Password must include an uppercase letter, a lowercase letter, and a number');
      return;
    }
    setIsChangingPassword(true);
    try {
      await settingsApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.details?.[0]?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to change password';
      toastError(serverMsg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await settingsApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      success('Session revoked');
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    setIsRevokingAll(true);
    try {
      await settingsApi.revokeAllSessions();
      setSessions([]);
      success('All sessions revoked');
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Failed to revoke sessions');
    } finally {
      setIsRevokingAll(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Change your account password</p>
                </div>
              </div>
              {!showPasswordForm && (
                <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(true)}>
                  Change Password
                </Button>
              )}
            </div>
            {showPasswordForm && (
              <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                  Must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.
                </p>
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
                <div className="flex items-center gap-3">
                  <Button variant="primary" size="sm" isLoading={isChangingPassword} onClick={handleChangePassword}>
                    Update Password
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

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
              <Button variant="outline" size="sm" disabled>
                Coming Soon
              </Button>
            </div>
          </div>

          {sessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-gray-900 dark:text-white">Active Sessions</p>
                <button
                  className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                  onClick={handleRevokeAllSessions}
                  disabled={isRevokingAll}
                >
                  {isRevokingAll ? 'Revoking...' : 'Revoke All'}
                </button>
              </div>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        session.current ? 'bg-green-500' : 'bg-gray-300'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{session.device || 'Unknown Device'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{session.ip || 'Unknown IP'}</p>
                      </div>
                    </div>
                    {session.current ? (
                      <span className="text-xs text-green-600 font-medium">Current</span>
                    ) : (
                      <button
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
