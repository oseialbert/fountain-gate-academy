require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { readConfig } = require('./config');
const { hashPassword } = require('./security');

async function initializeDatabase() {
  const config = readConfig();
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : false });
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    if (process.env.ONE_TIME_RESET) {
      const users = await pool.query('SELECT id, email, role, length(password_hash) AS hash_len FROM users ORDER BY id');
      console.log('USERS=' + JSON.stringify(users.rows));
      const email = process.env.RESET_EMAIL || 'ninaparks2008@gmail.com';
      const passwordHash = await hashPassword(process.env.ONE_TIME_RESET, config.passwordPepper);
      const reset = await pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'",
        [email, passwordHash]
      );
      console.log(`ONE_TIME_RESET applied to ${email} (${reset.rowCount} row).`);
    }
    console.log('Database schema is ready.');
  } finally { await pool.end(); }
}

initializeDatabase().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});