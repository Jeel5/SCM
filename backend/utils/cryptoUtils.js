/**
 * Crypto Utilities — symmetric encryption/decryption for sensitive fields
 * (e.g., carrier API keys stored in the database)
 *
 * Algorithm : AES-256-GCM  (authenticated encryption — tamper-evident)
 * Key source : ENCRYPTION_KEY env var — must be a 64-char hex string (32 bytes)
 *
 * Encrypted format (all base64, colon-separated):  iv:authTag:ciphertext
 *
 * Usage:
 *   import { encryptField, decryptField } from '../utils/cryptoUtils.js';
 *   const enc = encryptField('my-secret-api-key');
 *   const plain = decryptField(enc);           // → 'my-secret-api-key'
 *
 * If ENCRYPTION_KEY is not configured the decrypt functions return the raw value
 * as-is (graceful degradation so the app still works without encryption configured,
 * though this should be treated as a misconfiguration in production).
 */

import crypto from 'crypto';
import logger from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES   = 12; // 96-bit IV recommended for GCM
const TAG_BYTES  = 16;

function getKey() {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    return null; // key not configured
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns a colon-delimited base64 string:  iv:authTag:ciphertext
 * Returns the original value unchanged if ENCRYPTION_KEY is not set.
 */
export function encryptField(plaintext) {
  const key = getKey();
  if (!key) {
    logger.warn('ENCRYPTION_KEY not configured — storing value unencrypted');
    return plaintext;
  }

  const iv     = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a value previously encrypted with encryptField().
 * Returns the plaintext string.
 * Returns the raw value unchanged if:
 *   - ENCRYPTION_KEY is not set, OR
 *   - the value does not look like an encrypted blob (no ':' separators)
 *     — this handles legacy rows that were stored as plaintext.
 */
export function decryptField(encrypted) {
  if (!encrypted) return encrypted;

  const key = getKey();
  if (!key) {
    // Encryption not configured — assume value is plaintext
    return encrypted;
  }

  // If the stored value doesn't look encrypted (no colons), treat as plaintext
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    return encrypted; // legacy plaintext value — use as-is
  }

  try {
    const [ivB64, tagB64, cipherB64] = parts;
    const iv         = Buffer.from(ivB64,    'base64');
    const authTag    = Buffer.from(tagB64,   'base64');
    const ciphertext = Buffer.from(cipherB64,'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (err) {
    logger.error('decryptField: decryption failed — returning raw value', { error: err.message });
    // Return raw value rather than crashing — caller should handle invalid keys gracefully
    return encrypted;
  }
}
