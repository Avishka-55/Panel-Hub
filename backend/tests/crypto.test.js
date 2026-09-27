const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

// Set a test master key (64 hex characters = 32 bytes)
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');

const { encrypt } = require('../src/utils/encrypt');
const { decrypt } = require('../src/utils/decrypt');

test('Crypto utility: encrypt and decrypt roundtrip', () => {
  const secretPassword = 'my-super-secret-panel-password-123!@#$%';
  const encrypted = encrypt(secretPassword);

  assert.ok(encrypted.ciphertext, 'Ciphertext should be present');
  assert.ok(encrypted.iv, 'IV should be present');
  assert.ok(encrypted.authTag, 'AuthTag should be present');
  assert.notEqual(encrypted.ciphertext, secretPassword);

  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, secretPassword);
});

test('Crypto utility: supports positional arguments in decrypt', () => {
  const secret = 'another-secret-key';
  const encrypted = encrypt(secret);

  const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag);
  assert.equal(decrypted, secret);
});

test('Crypto utility: fails decryption if ciphertext is tampered', () => {
  const secret = 'protect-me';
  const encrypted = encrypt(secret);

  // Tamper ciphertext
  const tamperedCiphertext = encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith('aa') ? 'bb' : 'aa');

  assert.throws(() => {
    decrypt({
      ciphertext: tamperedCiphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag
    });
  });
});

test('Crypto utility: fails decryption if authTag is tampered', () => {
  const secret = 'protect-me';
  const encrypted = encrypt(secret);

  // Tamper auth tag
  const tamperedAuthTag = encrypted.authTag.slice(0, -2) + (encrypted.authTag.endsWith('00') ? '11' : '00');

  assert.throws(() => {
    decrypt({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: tamperedAuthTag
    });
  });
});

test('Crypto utility: handles empty or invalid inputs gracefully', () => {
  assert.throws(() => encrypt(12345), /Plaintext must be a string/);
  assert.throws(() => decrypt({}), /Missing ciphertext, iv, or authTag/);
});
