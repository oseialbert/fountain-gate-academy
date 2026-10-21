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
      const users = await pool.query('SELECT id, email, role FROM users ORDER BY id');
      console.log('USERS=' + JSON.stringify(users.rows));
      const admins = users.rows.filter((user) => user.role === 'admin');
      if (admins.length) {
        const passwordHash = await hashPassword(process.env.ONE_TIME_RESET, config.passwordPepper);
        const reset = await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [admins[0].id, passwordHash]);
        console.log(`ONE_TIME_RESET applied to ${admins[0].email} (${reset.rowCount} row).`);
      } else {
        console.log('ONE_TIME_RESET: no admin user found.');
      }
    }
    console.log('Database schema is ready.');
  } finally { await pool.end(); }
}

initializeDatabase().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});