// Importa datos históricos de data/tracker_db.json a PostgreSQL sin borrar registros existentes.
// Ejecutar solo después de database/migration_autotrack.sql: npm run migrate:json
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('./postgres');
const scrypt = promisify(crypto.scrypt);
const file = path.join(__dirname, '..', 'data', 'tracker_db.json');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
function splitName(value) {
  const p = String(value || 'Usuario AutoTrack').trim().split(/\s+/);
  return [p.shift() || 'Usuario', p.join(' ') || '-'];
}
function roleFor(role) {
  if (role === 'admin') return 'admin';
  if (role === 'client' || role === 'cliente') return 'cliente';
  return 'asesor'; // La base actual define solo admin, asesor y cliente.
}
async function main() {
  if (!fs.existsSync(file)) throw new Error('No existe data/tracker_db.json; no se importó nada.');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let vehiclesImported = 0, usersImported = 0;
  const clientIds = new Map();
  const advisorIds = new Map();

  for (const v of (data.vehicles || [])) {
    const doc = String(v.client_doc || '').trim();
    if (!doc) { console.warn(`Se omite ${v.id}: falta documento del cliente.`); continue; }
    const [cn, ca] = splitName(v.client_name);
    let cr = await pool.query('SELECT id_cliente FROM public.clientes WHERE documento=$1 OR lower(correo)=lower($2) LIMIT 1', [doc, v.client_email || `${doc}@autotrack.local`]);
    let clientId;
    if (cr.rows[0]) clientId = cr.rows[0].id_cliente;
    else {
      cr = await pool.query(`INSERT INTO public.clientes(nombre,apellido,documento,correo,telefono)
        VALUES($1,$2,$3,$4,$5) RETURNING id_cliente`,
        [cn,ca,doc,v.client_email || `${doc}@autotrack.local`,v.client_phone || null]);
      clientId = cr.rows[0].id_cliente;
    }
    clientIds.set(doc, clientId);

    const advisorEmail = String(v.advisor_email || `asesor.${String(v.advisor_name || 'autotrack').toLowerCase().replace(/[^a-z0-9]+/g,'.')}@autotrack.local`);
    let ar = await pool.query('SELECT id_asesor FROM public.asesores WHERE lower(correo)=lower($1) LIMIT 1', [advisorEmail]);
    let advisorId;
    if (ar.rows[0]) advisorId = ar.rows[0].id_asesor;
    else {
      const [an, aa] = splitName(v.advisor_name || 'Asesor AutoTrack');
      ar = await pool.query(`INSERT INTO public.asesores(nombre,apellido,correo,telefono,activo)
        VALUES($1,$2,$3,$4,true) RETURNING id_asesor`, [an,aa,advisorEmail,v.advisor_phone || null]);
      advisorId = ar.rows[0].id_asesor;
    }
    advisorIds.set(String(v.advisor_name || ''), advisorId);

    const existing = await pool.query(`SELECT id_vehiculo FROM public.vehiculos
      WHERE codigo_vehiculo=$1 OR vin=$2 OR codigo_orden=$3 LIMIT 1`, [v.id,v.vin,v.order_code]);
    if (existing.rows[0]) {
      console.log(`Vehículo ${v.id} ya existe; se conserva y no se duplica.`);
      continue;
    }
    const phase = await pool.query('SELECT id_fase FROM public.fases WHERE numero_fase=$1', [Math.max(1,Math.min(7,Number(v.current_stage_index)||1))]);
    const parts = String(v.brand_model || 'Sin modelo').trim().split(/\s+/);
    const marca = parts.shift() || 'Sin marca';
    const modelo = parts.join(' ') || 'Sin modelo';
    const plate = `AT${String(1000 + vehiclesImported).slice(-4)}`;
    const vr = await pool.query(`INSERT INTO public.vehiculos
      (codigo_vehiculo,codigo_orden,vin,placa,marca,modelo,anio,id_cliente,id_asesor,id_fase_actual,
       fecha_ingreso,fecha_estimada_entrega,observaciones,tipo_vehiculo,color,sede,telefono_asesor,
       imagen_url,dias_estimados_entrega,fecha_actualizacion,calificacion_satisfaccion)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13,$14,$15,$16,$17,$18,$19,CURRENT_TIMESTAMP,$20)
      RETURNING id_vehiculo`,
      [v.id,v.order_code || `PED-${Date.now()}-${vehiclesImported}`,v.vin || `VIN-${Date.now()}-${vehiclesImported}`,
       plate,marca,modelo,Number(String(v.brand_model||'').match(/\b(19|20)\d{2}\b/)?.[0]) || new Date().getFullYear(),
       clientId,advisorId,phase.rows[0].id_fase,
       v.created_at ? String(v.created_at).slice(0,10) : new Date().toISOString().slice(0,10),
       v.estimated_delivery_date || null,null,v.vehicle_type || 'Automóvil',v.color || null,
       v.dealership_branch || null,v.advisor_phone || null,v.image_url || null,
       Number(v.estimated_delivery_days)||0,v.satisfaction_rating == null ? null : Number(v.satisfaction_rating)]);
    const vehicleId = vr.rows[0].id_vehiculo;
    for (let i=0;i<(v.checklist||[]).length;i++) {
      const item=v.checklist[i];
      await pool.query(`INSERT INTO public.checklist_vehiculos(id_vehiculo,codigo_tarea,titulo,categoria,completada)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [vehicleId,item.code || `JSON-${i+1}`,item.title || 'Tarea',item.category || null,Boolean(item.completed)]);
    }
    // El historial existente se importa como historial; trigger solo dispara en UPDATE de fase.
    for (const h of (v.status_history||[])) {
      const ph=await pool.query('SELECT id_fase FROM public.fases WHERE numero_fase=$1',[Number(h.stage_index)]);
      if (!ph.rows[0]) continue;
      await pool.query(`INSERT INTO public.historial_estados(id_vehiculo,id_fase,id_asesor,fecha_cambio,observacion)
        VALUES($1,$2,$3,COALESCE($4::timestamp,CURRENT_TIMESTAMP),$5)`,
        [vehicleId,ph.rows[0].id_fase,advisorId,h.date ? String(h.date).replace('T',' ').slice(0,19) : null,
         [h.updated_by,h.notes].filter(Boolean).join(' — ') || null]);
    }
    vehiclesImported++;
  }

  for (const u of (data.users || [])) {
    const username=String(u.username||'').trim().toLowerCase();
    const email=String(u.email||`${username}@autotrack.local`).trim().toLowerCase();
    if (!username || !u.password) { console.warn(`Se omite usuario ${username||'(sin nombre)'}: faltan credenciales.`); continue; }
    const exists=await pool.query('SELECT 1 FROM public.usuarios WHERE lower(nombre_usuario)=lower($1) OR lower(correo)=lower($2)',[username,email]);
    if (exists.rowCount) { console.log(`Usuario ${username} ya existe; se conserva y no se duplica.`); continue; }
    const role=roleFor(u.role);
    let idCliente=null,idAsesor=null;
    if (role==='cliente') {
      const doc=String(u.client_doc||'').trim();
      const [n,a]=splitName(u.client_name||username);
      let cr=doc ? await pool.query('SELECT id_cliente FROM public.clientes WHERE documento=$1 LIMIT 1',[doc]) : {rows:[]};
      if (cr.rows[0]) idCliente=cr.rows[0].id_cliente;
      else {
        const safeDoc=doc || `DOC-${Date.now()}-${usersImported}`;
        const uniqueEmail=email;
        const byEmail=await pool.query('SELECT id_cliente FROM public.clientes WHERE lower(correo)=lower($1)',[uniqueEmail]);
        if(byEmail.rows[0]) idCliente=byEmail.rows[0].id_cliente;
        else {
          cr=await pool.query(`INSERT INTO public.clientes(nombre,apellido,documento,correo,telefono)
            VALUES($1,$2,$3,$4,NULL) RETURNING id_cliente`,[n,a,safeDoc,uniqueEmail]);
          idCliente=cr.rows[0].id_cliente;
        }
      }
    } else if (role==='asesor') {
      const [n,a]=splitName(u.client_name||username);
      let ar=await pool.query('SELECT id_asesor FROM public.asesores WHERE lower(correo)=lower($1)',[email]);
      if(ar.rows[0]) idAsesor=ar.rows[0].id_asesor;
      else {
        ar=await pool.query(`INSERT INTO public.asesores(nombre,apellido,correo,telefono,activo)
          VALUES($1,$2,$3,NULL,true) RETURNING id_asesor`,[n,a,email]);
        idAsesor=ar.rows[0].id_asesor;
      }
    }
    const hash=await hashPassword(u.password);
    await pool.query(`INSERT INTO public.usuarios
      (nombre_usuario,correo,password_hash,rol,activo,id_cliente,id_asesor,debe_cambiar_password)
      VALUES($1,$2,$3,$4,true,$5,$6,$7)`,
      [username,email,hash,role,idCliente,idAsesor,Boolean(u.must_change_password)]);
    usersImported++;
  }
  console.log(`Importación terminada. Vehículos nuevos: ${vehiclesImported}. Usuarios nuevos: ${usersImported}.`);
  console.log('El JSON original no se borró. Revisa los datos antes de archivarlo.');
}
main().catch(err=>{ console.error('Falló la importación:',err.message); process.exitCode=1; })
.finally(()=>pool.end());
