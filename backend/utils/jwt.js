import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// JWT configuration - access token expires quickly, refresh token lasts longer
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-key';
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Generate short-lived access token for API requests
export function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

// Generate long-lived refresh token for obtaining new access tokens
export function generateRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

// Verify access token, returns null if invalid or expired
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
}

// Verify refresh token, returns null if invalid or expired
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
}

// Decode token without verifying signature (useful for debugging)
export function decodeToken(token) {
  return jwt.decode(token);
}
