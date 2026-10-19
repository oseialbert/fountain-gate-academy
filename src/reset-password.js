require('dotenv').config();
const { Pool } = require('pg');
const { readConfig } = require('./config');
const { hashPassword, validatePassword } = require('./security');

function usage() {
  console.error('Usage: node src/reset-password.js <email> <new-password> [--disable-2fa]');
  console.error('  --disable-2fa   Also clears any enrolled authenticator (if you lost it).');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const disable2fa = args.includes('--disable-2fa');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const [emailArg, newPassword] = positional;
  const email = typeof emailArg === 'string' ? emailArg.trim().toLowerCase() : '';
  if (!email || !newPassword) usage();
  if (!validatePassword(newPassword)) {
    console.error('New password must be between 12 and 128 characters.');
    process.exit(1);
  }

  const config = readConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false
  });
  try {
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (!existing.rows.length) {
      console.error(`No account found for ${email}.`);
      process.exit(1);
    }
    const passwordHash = await hashPassword(newPassword, config.passwordPepper);
    if (disable2fa) {
      await pool.query(
        'UPDATE users SET password_hash = $2, totp_secret = NULL, totp_enabled = FALSE, totp_last_step = NULL WHERE email = $1',
        [email, passwordHash]
      );
    } else {
      await pool.query('UPDATE users SET password_hash = $2 WHERE email = $1', [email, passwordHash]);
    }
    console.log(`Password updated for ${email} (role: ${existing.rows[0].role}).${disable2fa ? ' Two-factor authentication was cleared.' : ''}`);
    console.log('You can now sign in with your new password.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  if (/SSL|self-signed|certificate/i.test(error.message || '')) {
    console.error('Hint: if your database requires SSL, set DATABASE_SSL=true before running this.');
  }
  process.exitCode = 1;
});
