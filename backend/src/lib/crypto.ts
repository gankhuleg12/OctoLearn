import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

// AES-256-GCM with a key derived from SETTINGS_SECRET (falls back to JWT_SECRET),
// so secrets in app_settings are not readable from a database dump alone.
const key = createHash('sha256').update(`octolearn-settings:${config.settingsSecret}`).digest();
const PREFIX = 'enc:v1:';

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

/** Returns null when the value cannot be decrypted (e.g. the secret changed). */
export function decryptSecret(stored: string): string | null {
  if (!stored.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
