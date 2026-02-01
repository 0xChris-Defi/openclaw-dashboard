import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { ENV } from './_core/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from JWT_SECRET
 */
function getKey(): Buffer {
  const secret = ENV.cookieSecret || 'default-secret-key-for-dev';
  return scryptSync(secret, 'openclaw-salt', 32);
}

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt config object (encrypts sensitive fields)
 */
export function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['apiKey', 'botToken', 'appSecret', 'accessToken', 'password', 'signingSecret', 'encryptKey', 'verificationToken'];
  const encrypted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (sensitiveFields.includes(key) && typeof value === 'string' && value.length > 0) {
      encrypted[key] = encrypt(value);
      encrypted[`${key}_encrypted`] = true;
    } else {
      encrypted[key] = value;
    }
  }
  
  return encrypted;
}

/**
 * Decrypt config object (decrypts sensitive fields)
 */
export function decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const decrypted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith('_encrypted')) {
      continue; // Skip marker fields
    }
    
    if (config[`${key}_encrypted`] === true && typeof value === 'string') {
      try {
        decrypted[key] = decrypt(value);
      } catch {
        decrypted[key] = value; // Return as-is if decryption fails
      }
    } else {
      decrypted[key] = value;
    }
  }
  
  return decrypted;
}

/**
 * Mask sensitive value for display (show first 8 and last 4 chars)
 */
export function maskSensitiveValue(value: string): string {
  if (value.length <= 12) {
    return '••••••••';
  }
  return `${value.substring(0, 8)}••••${value.substring(value.length - 4)}`;
}

/**
 * Mask config object for frontend display
 */
export function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['apiKey', 'botToken', 'appSecret', 'accessToken', 'password', 'signingSecret', 'encryptKey', 'verificationToken'];
  const masked: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith('_encrypted')) {
      continue; // Skip marker fields
    }
    
    if (sensitiveFields.includes(key) && typeof value === 'string' && value.length > 0) {
      masked[key] = maskSensitiveValue(value);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}
