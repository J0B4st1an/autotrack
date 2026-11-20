require('dotenv').config();
const { testConnection, pool } = require('./database/postgres');

(async () => {
  try {
    const info = await testConnection();
    console.log('Conexión PostgreSQL correcta.');
    console.log(`Base de datos: ${info.database}`);
    console.log(`Usuario: ${info.user}`);
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('Tablas encontradas:', tables.rows.map(r => r.table_name).join(', '));
    const required = [
      'clientes', 'asesores', 'fases', 'vehiculos',
      'historial_estados', 'notificaciones', 'usuarios',
      'checklist_vehiculos'
    ];
    const missing = required.filter(t => !tables.rows.some(r => r.table_name === t));
    if (missing.length) {
      console.error('Faltan tablas esperadas:', missing.join(', '));
      process.exitCode = 2;
    } else {
      console.log('Las tablas principales de AutoTrack están presentes.');
    }
  } catch (err) {
    console.error('No se pudo conectar a PostgreSQL:', err.message);
    console.error('Revisa PGHOST, PGPORT, PGDATABASE, PGUSER y PGPASSWORD en .env.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
