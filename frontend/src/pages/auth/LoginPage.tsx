import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Truck, Shield, BarChart3, Globe, Mail, Lock } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/stores';
import { authApi } from '@/api/services';
import { mockApi } from '@/api/mockData';

const features = [
  { icon: <Truck className="h-6 w-6" />, title: 'Real-time Tracking', desc: 'Monitor all shipments in real-time' },
  { icon: <Shield className="h-6 w-6" />, title: 'SLA Compliance', desc: 'Automated breach detection' },
  { icon: <BarChart3 className="h-6 w-6" />, title: 'Analytics Dashboard', desc: 'Comprehensive insights' },
  { icon: <Globe className="h-6 w-6" />, title: 'Multi-carrier Support', desc: 'Integrate all carriers' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { theme } = useUIStore();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleSuccess = async (_credentialResponse: CredentialResponse) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // TODO: Implement Google OAuth backend validation
      // For now, show a message that Google login will be available soon
      setError('Google OAuth will be available soon. Please use email/password login.');
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  // Email/Password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await authApi.login(email, password);
      
      if (response.success) {
        login(response.data.user);
        localStorage.removeItem('useMockApi'); // Clear mock flag for real API
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      const errorMessage = errData?.error || errData?.message || 'Login failed. Please check your credentials.';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo login for development
  const handleDemoLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use mock API for demo login
      const response = await mockApi.login('admin@twinchain.in', 'demo');
      
      if (response.success) {
        login(response.data.user);
        localStorage.setItem('useMockApi', 'true'); // Flag to use mock data
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage = 'Demo login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left panel — branding ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative lg:w-1/2 flex flex-col justify-between px-10 py-12 lg:px-16 xl:px-24 bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-[#0a0f1e] dark:to-[#0d1530] overflow-hidden"
      >
        {/* Background glows */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-400/20 dark:bg-indigo-600/20 blur-[100px] pointer-events-none" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '50px 50px' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">TwinChain</p>
            <p className="text-blue-200 dark:text-blue-300 text-xs">Control Center</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 my-auto py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200 dark:text-blue-400 mb-4">Supply Chain Intelligence</p>
          <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
            Your Logistics<br />Command Center
          </h2>
          <p className="text-blue-100 dark:text-blue-200 text-lg max-w-sm mb-10">
            Real-time visibility into your entire supply chain — orders, shipments, carriers and exceptions in one place.
          </p>

          {/* Feature cards */}
          <div className="space-y-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-4 p-3.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm"
              >
                <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center text-white shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{feature.title}</p>
                  <p className="text-xs text-blue-200">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-blue-300/70">
          © 2026 TwinChain. Enterprise Logistics Control Tower.
        </p>
      </motion.div>

      {/* ── Right panel — form ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative lg:w-1/2 flex flex-col justify-center px-8 py-12 lg:px-16 xl:px-24 bg-white dark:bg-gray-950 overflow-y-auto"
      >
        {/* Soft glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-100 dark:bg-blue-950/40 blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-sm mx-auto">

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400">Sign in to access your control tower</p>
          </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40"
                >
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                </motion.div>
              )}

              {/* Email/Password Login Form */}
              <form onSubmit={handleEmailLogin} className="mb-6 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@twinchain.in"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 transition-all outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 transition-all outline-none"
                    />
                  </div>
                </div>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Login'
                  )}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">or continue with</span>
                </div>
              </div>

              {/* Google Login Button */}
              <div className="mb-5">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap
                    theme={isDark ? 'filled_black' : 'outline'}
                    size="large"
                    width="100%"
                    text="signin_with"
                    shape="rectangular"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400">or</span>
                </div>
              </div>

              {/* Demo Login Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Continue with Demo Account'
                )}
              </motion.button>

              {/* Roles Info */}
              <div className="mt-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Demo includes these roles:</p>
                <div className="flex flex-wrap gap-2">
                  {['Superadmin', 'Admin', 'Ops Manager', 'Warehouse', 'Finance', 'Support'].map((role) => (
                    <span key={role} className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {role}
                    </span>
                  ))}
                </div>
              </div>

        </div>
      </motion.div>
    </div>
  );
}
