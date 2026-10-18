require('dotenv').config();
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { createApp } = require('./app');
const { readConfig } = require('./config');

async function start() {
  const config = readConfig();
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl ? { rejectUnauthorized: true } : false });
  await pool.query('SELECT 1');
  const sessionStore = new PgSession({ pool, createTableIfMissing: true, tableName: 'user_sessions' });
  const app = createApp({ pool, config, sessionStore });
  const server = app.listen(config.port, () => console.log(`Fountain Gate Academy is listening on http://localhost:${config.port}`));
  const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exitCode = 1;
});