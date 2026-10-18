const crypto = require('node:crypto');
const argon2 = require('argon2');
const OTPAuth = require('otpauth');

function encryptSecret(secret, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptSecret(value, key) {
  const [iv, tag, ciphertext] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function createTotp(secret, email) {
  return new OTPAuth.TOTP({
    issuer: 'Fountain Gate Academy', label: email, algorithm: 'SHA1', digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
}

function acceptedTotpStep(secret, email, token, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(token || '')) return null;
  const delta = createTotp(secret, email).validate({ token, window: 1, timestamp });
  return delta === null ? null : Math.floor(timestamp / 30000) + delta;
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

async function hashPassword(password, pepper) {
  return argon2.hash(`${password}${pepper}`, {
    type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1
  });
}

async function verifyPassword(hash, password, pepper) {
  try { return await argon2.verify(hash, `${password}${pepper}`); } catch { return false; }
}

module.exports = { acceptedTotpStep, createTotp, decryptSecret, encryptSecret, hashPassword, validatePassword, verifyPassword };