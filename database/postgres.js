require('dotenv').config();
const { Pool } = require('pg');

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'seguimiento_vehiculos',
      user: process.env.PGUSER || 'app_seguimiento',
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

if (!config.password && !process.env.DATABASE_URL) {
  console.warn('[PostgreSQL] Falta PGPASSWORD en el archivo .env.');
}

const pool = new Pool({
  ...config,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: 'AutoTrack'
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Error en conexión inactiva:', err.message);
});

async function testConnection() {
  const result = await pool.query(`
    SELECT current_database() AS database,
           current_user AS user,
           version() AS version
  `);
  return result.rows[0];
}

module.exports = { pool, testConnection };
