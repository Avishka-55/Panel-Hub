const crypto = require('crypto');

/**
 * Derives or normalizes the 32-byte key from process.env.MASTER_KEY.
 * Supports:
 * - 64-hex character string (32 bytes)
 * - 32-character utf8 string (32 bytes)
 * - 44-character base64 string (32 bytes)
 * - SHA-256 fallback for arbitrary length strings
 */
function getMasterKey() {
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) {
    throw new Error('MASTER_KEY environment variable is required');
  }

  // 64-hex characters represents 32 raw bytes
  if (typeof masterKey === 'string' && /^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return Buffer.from(masterKey, 'hex');
  }

  // Exact 32 bytes UTF-8 string
  const utf8Buf = Buffer.from(masterKey, 'utf8');
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  // Try base64 decoding if applicable
  try {
    const b64Buf = Buffer.from(masterKey, 'base64');
    if (b64Buf.length === 32) {
      return b64Buf;
    }
  } catch (_) {}

  // Fallback to SHA-256 hash to ensure a constant 256-bit (32-byte) key
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The plaintext string to encrypt.
 * @returns {{ ciphertext: string, iv: string, authTag: string }} Hex-encoded values
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('Plaintext must be a string');
  }

  const key = getMasterKey();
  // Standard 12-byte (96-bit) IV for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag
  };
}

module.exports = {
  encrypt,
  getMasterKey
};
