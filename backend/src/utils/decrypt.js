const crypto = require('crypto');
const { getMasterKey } = require('./encrypt');

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * Accepts either:
 * - decrypt({ ciphertext, iv, authTag })
 * - decrypt(ciphertext, iv, authTag)
 *
 * @param {string|{ciphertext: string, iv: string, authTag: string}} ciphertextOrObj
 * @param {string} [ivHex]
 * @param {string} [authTagHex]
 * @returns {string} Decrypted plaintext string
 */
function decrypt(ciphertextOrObj, ivHex, authTagHex) {
  let ciphertext;
  let iv;
  let authTag;

  if (typeof ciphertextOrObj === 'object' && ciphertextOrObj !== null) {
    ciphertext = ciphertextOrObj.ciphertext;
    iv = ciphertextOrObj.iv;
    authTag = ciphertextOrObj.authTag;
  } else {
    ciphertext = ciphertextOrObj;
    iv = ivHex;
    authTag = authTagHex;
  }

  if (!ciphertext || !iv || !authTag) {
    throw new Error('Missing ciphertext, iv, or authTag for decryption');
  }

  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  try {
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    if (err.message && (err.message.includes('Unsupported state') || err.message.includes('unable to authenticate'))) {
      throw new Error('Credential decryption failed: Master encryption key mismatch or corrupted credentials');
    }
    throw err;
  }
}

module.exports = {
  decrypt
};
