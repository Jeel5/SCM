// Page State
export interface AuthPageState {
  isLoading: boolean;
  error: string | null;
}

// Login Form
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Register Form (if needed in future)
export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  agreedToTerms: boolean;
}

// Forgot Password Form
export interface ForgotPasswordFormData {
  email: string;
}

// Reset Password Form
export interface ResetPasswordFormData {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// OAuth Response
export interface OAuthResponse {
  provider: 'google' | 'github' | 'microsoft';
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
}

// Auth Error Types
export type AuthError = 
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED';

export interface AuthErrorDetails {
  code: AuthError;
  message: string;
  retryAfter?: number;
}
