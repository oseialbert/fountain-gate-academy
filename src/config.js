function readConfig(env = process.env) {
  const required = ['DATABASE_URL', 'SESSION_SECRET', 'PASSWORD_PEPPER', 'TOTP_ENCRYPTION_KEY'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (env.SESSION_SECRET.length < 32 || env.PASSWORD_PEPPER.length < 32) {
    throw new Error('SESSION_SECRET and PASSWORD_PEPPER must each be at least 32 characters.');
  }
  const encryptionKey = Buffer.from(env.TOTP_ENCRYPTION_KEY, 'base64');
  if (encryptionKey.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return {
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL === 'true',
    sessionSecret: env.SESSION_SECRET,
    passwordPepper: env.PASSWORD_PEPPER,
    totpEncryptionKey: encryptionKey,
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT || 3000)
  };
}

module.exports = { readConfig };