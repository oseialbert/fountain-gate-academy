require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { readConfig } = require('./config');

async function initializeDatabase() {
  const config = readConfig();
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : false });
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema is ready.');
  } finally { await pool.end(); }
}

initializeDatabase().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});