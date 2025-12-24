import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Truck, Shield, BarChart3, Globe, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores';
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call mock API (in production, this would validate the token with backend)
      const response = await mockApi.googleLogin(credentialResponse.credential || '');
      
      if (response.success) {
        login(response.data.user, response.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in failed. Please try again.');
  };

  // Demo login for development
  const handleDemoLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await mockApi.googleLogin('demo-token');
      
      if (response.success) {
        login(response.data.user, response.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Demo login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 w-full max-w-5xl mx-auto"
    >
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Left Side - Features */}
          <div className="p-8 lg:p-12 bg-gradient-to-br from-blue-600/20 to-indigo-600/20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              {/* Logo */}
              <div className="flex items-center gap-3 mb-8">
                <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <Truck className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">LogiTower</h1>
                  <p className="text-blue-200 text-sm">Control Center</p>
                </div>
              </div>

              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
                Your Logistics<br />Command Center
              </h2>
              <p className="text-blue-100 text-lg mb-8">
                Real-time visibility into your entire supply chain. Track orders, manage shipments, and optimize delivery performance.
              </p>

              {/* Features */}
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/5 backdrop-blur border border-white/10"
                  >
                    <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center text-blue-300">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <p className="text-sm text-blue-200">{feature.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Side - Login */}
          <div className="p-8 lg:p-12 bg-white flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-sm mx-auto w-full"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                <p className="text-gray-600">Sign in to access your control tower</p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100"
                >
                  <p className="text-sm text-red-600 text-center">{error}</p>
                </motion.div>
              )}

              {/* Google Login Button */}
              <div className="mb-6">
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    useOneTap
                    theme="outline"
                    size="large"
                    width="100%"
                    text="signin_with"
                    shape="rectangular"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
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
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Continue with Demo Account'
                )}
              </motion.button>

              {/* Roles Info */}
              <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">Demo includes these roles:</p>
                <div className="flex flex-wrap gap-2">
                  {['Admin', 'Ops Manager', 'Warehouse', 'Finance', 'Support'].map((role) => (
                    <span
                      key={role}
                      className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="mt-8 flex items-center justify-center gap-6 text-gray-400">
                <div className="flex items-center gap-1.5 text-xs">
                  <Shield className="h-4 w-4" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className="h-4 w-4" />
                  <span>SOC 2 Compliant</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-blue-200/60 text-sm mt-8"
      >
        © 2024 LogiTower. Enterprise Logistics Control Tower.
      </motion.p>
    </motion.div>
  );
}
