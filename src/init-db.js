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
      const passwordHash = await hashPassword(process.env.ONE_TIME_RESET, config.passwordPepper);
      const reset = await pool.query('UPDATE users SET password_hash = $2 WHERE email = $1', ['ninaparks2008@gmail.com', passwordHash]);
      console.log(`One-time admin reset applied (${reset.rowCount} row).`);
    }
    console.log('Database schema is ready.');
  } finally { await pool.end(); }
}

initializeDatabase().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});