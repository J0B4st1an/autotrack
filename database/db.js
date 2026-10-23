const crypto = require('crypto');
const { promisify } = require('util');
const { pool } = require('./postgres');
const emailService = require('../services/emailService');
const scrypt = promisify(crypto.scrypt);

const STAGES = [
  { index: 1, name: 'PROCESO DE ASIGNACION', description: 'Asignación de VIN, chasis y confirmación de pedido.', icon: 'clipboard-check', est_pct: 15 },
  { index: 2, name: 'VEHICULO SIENDO TRANSPORTADO', description: 'En tránsito desde planta o puerto hacia el concesionario.', icon: 'truck', est_pct: 30 },
  { index: 3, name: 'VEHICULO RECIBIDO', description: 'Recepción en patio, inspección física y documental inicial.', icon: 'building-warehouse', est_pct: 45 },
  { index: 4, name: 'EN ALISTAMIENTO', description: 'Mecánica rápida, instalación de accesorios y detallado/lavado.', icon: 'wrench', est_pct: 65 },
  { index: 5, name: 'DOCUMENTACION EN PROCESO', description: 'Trámite de matrícula, SOAT, expedición de placas y póliza.', icon: 'file-text', est_pct: 85 },
  { index: 6, name: 'LISTO PARA ENTREGA', description: 'Vehículo 100% verificado. Cita de entrega agendada.', icon: 'sparkles', est_pct: 95 },
  { index: 7, name: 'ENTREGADO', description: 'Acta de entrega firmada y llaves entregadas al cliente.', icon: 'key', est_pct: 100 }
];

function roleToApp(role) {
  if (role === 'admin') return 'admin';
  if (role === 'asesor') return 'staff_asesor';
  return 'client';
}
function appRole(role) {
  if (role === 'admin') return 'admin';
  if (['asesor', 'staff_asesor', 'staff_logistica', 'staff_tramites'].includes(role)) return 'asesor';
  return 'cliente';
}
function displayName(a, b) { return [a, b].filter(Boolean).join(' ').trim(); }
function splitName(full) {
  const parts = String(full || 'Usuario AutoTrack').trim().split(/\s+/);
  return { nombre: parts.shift() || 'Usuario', apellido: parts.join(' ') || '-' };
}
function brandModel(v) { return [v.marca, v.modelo].filter(Boolean).join(' ').trim(); }
function mapVehicle(row, checklist = [], history = []) {
  if (!row) return null;
  const stage = STAGES.find(s => s.index === Number(row.numero_fase)) || STAGES[0];
  return {
    id: row.codigo_vehiculo || `VEH-${row.id_vehiculo}`,
    placa: row.placa,
    db_id: row.id_vehiculo,
    order_code: row.codigo_orden || '',
    vin: row.vin || '',
    client_doc: row.documento || '',
    client_name: displayName(row.cliente_nombre, row.cliente_apellido),
    client_phone: row.cliente_telefono || '',
    client_email: row.cliente_correo || '',
    vehicle_type: row.tipo_vehiculo || 'Automóvil',
    brand_model: brandModel(row),
    color: row.color || '',
    dealership_branch: row.sede || '',
    advisor_name: displayName(row.asesor_nombre, row.asesor_apellido),
    advisor_phone: row.telefono_asesor || row.asesor_telefono || '',
    image_url: row.imagen_url || '/img/car-default.svg',
    current_stage_index: Number(row.numero_fase) || 1,
    current_stage_name: row.nombre_fase || stage.name,
    estimated_delivery_days: Number(row.dias_estimados_entrega || 0),
    created_at: row.fecha_ingreso,
    updated_at: row.fecha_actualizacion,
    estimated_delivery_date: row.fecha_estimada_entrega,
    checklist,
    status_history: history,
    satisfaction_rating: row.calificacion_satisfaccion == null ? null : Number(row.calificacion_satisfaccion)
  };
}
const VEHICLE_SELECT = `
 SELECT v.*, f.numero_fase, f.nombre_fase,
        c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
        c.documento, c.telefono AS cliente_telefono, c.correo AS cliente_correo,
        a.nombre AS asesor_nombre, a.apellido AS asesor_apellido,
        a.telefono AS asesor_telefono
 FROM public.vehiculos v
 JOIN public.fases f ON f.id_fase = v.id_fase_actual
 JOIN public.clientes c ON c.id_cliente = v.id_cliente
 JOIN public.asesores a ON a.id_asesor = v.id_asesor`;

async function getVehicleExtras(idVehiculo) {
  const [cr, hr] = await Promise.all([
    pool.query(`SELECT id_checklist, codigo_tarea, titulo, categoria, completada, fecha_creacion, fecha_actualizacion
                FROM public.checklist_vehiculos WHERE id_vehiculo=$1 ORDER BY id_checklist`, [idVehiculo]),
    pool.query(`SELECT h.id_historial, h.id_fase, f.numero_fase, f.nombre_fase, h.fecha_cambio, h.observacion
                FROM public.historial_estados h JOIN public.fases f ON f.id_fase=h.id_fase
                WHERE h.id_vehiculo=$1 ORDER BY h.fecha_cambio, h.id_historial`, [idVehiculo])
  ]);
  return {
    checklist: cr.rows.map(r => ({ id: String(r.id_checklist), code: r.codigo_tarea, title: r.titulo, category: r.categoria || '', completed: r.completada })),
    history: hr.rows.map(r => ({ stage_index: Number(r.numero_fase), stage_name: r.nombre_fase, date: r.fecha_cambio, notes: r.observacion || '', updated_by: 'Sistema' }))
  };
}
async function vehicleByRow(row) {
  if (!row) return null;
  const extras = await getVehicleExtras(row.id_vehiculo);
  return mapVehicle(row, extras.checklist, extras.history);
}
async function getVehicleByCode(code) {
  const r = await pool.query(`${VEHICLE_SELECT} WHERE v.codigo_vehiculo=$1 OR v.id_vehiculo::text=$1 LIMIT 1`, [String(code)]);
  return vehicleByRow(r.rows[0]);
}
async function ensureClient(data) {
  const parts = splitName(data.client_name || `${data.nombre || ''} ${data.apellido || ''}`);
  const doc = String(data.client_doc || data.documento || '').trim();
  if (!doc) throw new Error('El documento del cliente es obligatorio.');
  const email = String(data.client_email || data.email || `${doc}@autotrack.local`).trim().toLowerCase();
  const found = await pool.query('SELECT id_cliente FROM public.clientes WHERE documento=$1 OR correo=$2 LIMIT 1', [doc, email]);
  if (found.rows[0]) return found.rows[0].id_cliente;
  const r = await pool.query(`INSERT INTO public.clientes(nombre,apellido,documento,correo,telefono)
      VALUES($1,$2,$3,$4,$5) RETURNING id_cliente`, [parts.nombre, parts.apellido, doc, email, data.client_phone || data.telefono || null]);
  return r.rows[0].id_cliente;
}
async function ensureAdvisor(data) {
  const email = String(data.advisor_email || data.asesor_correo || 'laura.prueba@example.com').toLowerCase();
  let r = await pool.query('SELECT id_asesor FROM public.asesores WHERE lower(correo)=lower($1) LIMIT 1', [email]);
  if (r.rows[0]) return r.rows[0].id_asesor;
  r = await pool.query('SELECT id_asesor FROM public.asesores WHERE activo=true ORDER BY id_asesor LIMIT 1');
  if (r.rows[0]) return r.rows[0].id_asesor;
  const p = splitName(data.advisor_name || 'Asesor AutoTrack');
  const emailNew = email === 'laura.prueba@example.com' ? `asesor${Date.now()}@autotrack.local` : email;
  r = await pool.query(`INSERT INTO public.asesores(nombre,apellido,correo,telefono,activo)
      VALUES($1,$2,$3,$4,true) RETURNING id_asesor`, [p.nombre,p.apellido,emailNew,data.advisor_phone || null]);
  return r.rows[0].id_asesor;
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const key = await scrypt(String(password), salt, 64);
    const a = Buffer.from(hash, 'hex');
    return a.length === key.length && crypto.timingSafeEqual(a, key);
  }
  // Compatibilidad temporal con hashes bcrypt si el proyecto los tuvo.
  if (stored.startsWith('$2')) {
    try { return await require('bcryptjs').compare(String(password), stored); } catch (_) { return false; }
  }
  return false; // Nunca aceptar contraseñas en texto plano.
}
async function getUserRows() {
  const r = await pool.query(`
    SELECT u.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido,
           c.documento, c.telefono AS cliente_telefono, c.correo AS cliente_correo,
           a.nombre AS asesor_nombre, a.apellido AS asesor_apellido,
           a.telefono AS asesor_telefono,
           (SELECT v.codigo_vehiculo FROM public.vehiculos v
             WHERE v.id_cliente=u.id_cliente ORDER BY v.id_vehiculo DESC LIMIT 1) AS codigo_vehiculo
    FROM public.usuarios u
    LEFT JOIN public.clientes c ON c.id_cliente=u.id_cliente
    LEFT JOIN public.asesores a ON a.id_asesor=u.id_asesor
    ORDER BY u.id_usuario`);
  return r.rows;
}
function mapUser(r) {
  const isClient = r.rol === 'cliente';
  const fullName = isClient ? displayName(r.cliente_nombre, r.cliente_apellido) : displayName(r.asesor_nombre, r.asesor_apellido);
  return {
    id: `${r.rol === 'admin' ? 'ADM' : isClient ? 'USR' : 'ASE'}-${r.id_usuario}`,
    db_id: r.id_usuario, username: r.nombre_usuario, email: r.correo,
    client_doc: r.documento || '', client_name: fullName || r.nombre_usuario,
    vehicle_id: r.codigo_vehiculo || null, must_change_password: Boolean(r.debe_cambiar_password),
    role: isClient ? 'client' : roleToApp(r.rol), activo: r.activo
  };
}
async function ensureUserPasswordColumn() {
  // La columna se crea mediante migration.sql, no desde cada petición.
}
const db = {
  getStages: () => STAGES,
  getAllVehicles: async () => {
    const r = await pool.query(`${VEHICLE_SELECT} ORDER BY v.id_vehiculo`);
    return Promise.all(r.rows.map(vehicleByRow));
  },
  getVehicleById: getVehicleByCode,
  searchVehicle: async query => {
    if (!query) return null;
    const q = String(query).trim();
    const r = await pool.query(`${VEHICLE_SELECT}
      WHERE c.documento=$1 OR v.vin=$1 OR v.codigo_orden=$1 OR v.codigo_vehiculo=$1
      LIMIT 1`, [q]);
    return vehicleByRow(r.rows[0]);
  },
  getUserVehicle: getVehicleByCode,

createVehicle: async data => {
  const client = await pool.connect();
  let createdUser = null;
  let vehicleCode;

  try {
    await client.query('BEGIN');

    const doc = String(data.client_doc || data.documento || '').trim();
    if (!doc) {
      throw new Error('El documento del cliente es obligatorio.');
    }

    const clientEmail = String(
      data.client_email || data.email || `${doc}@autotrack.local`
    ).trim().toLowerCase();

    const parts = splitName(
      data.client_name || `${data.nombre || ''} ${data.apellido || ''}`
    );

    // Buscar cliente por documento; impedir asociar otro documento al correo.
    let result = await client.query(
      `SELECT id_cliente, documento, correo
       FROM public.clientes
       WHERE documento = $1
       LIMIT 1`,
      [doc]
    );

    let clientId;

    if (result.rowCount) {
      clientId = result.rows[0].id_cliente;
    } else {
      result = await client.query(
        `SELECT id_cliente, documento
         FROM public.clientes
         WHERE lower(correo) = lower($1)
         LIMIT 1`,
        [clientEmail]
      );

      if (result.rowCount) {
        throw new Error(
          'Ese correo ya está asociado a otro cliente. Verifica los datos.'
        );
      }

      result = await client.query(
        `INSERT INTO public.clientes
           (nombre, apellido, documento, correo, telefono)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id_cliente`,
        [
          parts.nombre,
          parts.apellido,
          doc,
          clientEmail,
          data.client_phone || data.telefono || null
        ]
      );

      clientId = result.rows[0].id_cliente;
    }

    // Resolver asesor dentro de la misma transacción.
    const advisorEmail = String(
      data.advisor_email ||
      data.asesor_correo ||
      'laura.prueba@example.com'
    ).toLowerCase();

    result = await client.query(
      `SELECT id_asesor
       FROM public.asesores
       WHERE lower(correo) = lower($1)
       LIMIT 1`,
      [advisorEmail]
    );

    if (!result.rowCount) {
      result = await client.query(
        `SELECT id_asesor
         FROM public.asesores
         WHERE activo = true
         ORDER BY id_asesor
         LIMIT 1`
      );
    }

    let advisorId;

    if (result.rowCount) {
      advisorId = result.rows[0].id_asesor;
    } else {
      const advisorParts = splitName(
        data.advisor_name || 'Asesor AutoTrack'
      );

      const newAdvisorEmail =
        advisorEmail === 'laura.prueba@example.com'
          ? `asesor${Date.now()}@autotrack.local`
          : advisorEmail;

      result = await client.query(
        `INSERT INTO public.asesores
           (nombre, apellido, correo, telefono, activo)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id_asesor`,
        [
          advisorParts.nombre,
          advisorParts.apellido,
          newAdvisorEmail,
          data.advisor_phone || null
        ]
      );

      advisorId = result.rows[0].id_asesor;
    }

    const currentIndex = Number(data.current_stage_index || 1);

    const phase = await client.query(
      `SELECT id_fase
       FROM public.fases
       WHERE numero_fase = $1`,
      [currentIndex]
    );

    if (!phase.rowCount) {
      throw new Error('La fase indicada no existe.');
    }

    const count = await client.query(
      `SELECT COALESCE(MAX(id_vehiculo), 0) + 1 AS n
       FROM public.vehiculos`
    );

    const n = Number(count.rows[0].n);
    vehicleCode = data.id || `VEH-${1000 + n}`;

    const vehicleParts = String(data.brand_model || '')
      .trim()
      .split(/\s+/);

    const marca = data.marca || vehicleParts.shift() || 'Sin marca';
    const modelo = data.modelo ||
      vehicleParts.join(' ') ||
      String(data.brand_model || 'Sin modelo');

    const days = Number(
      data.estimated_delivery_days ||
      (data.vehicle_type === 'Motocicleta' ? 7 : 15)
    );

    const order = data.order_code ||
      `PED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const vin = data.vin ||
      `VIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Crear vehículo.
    const inserted = await client.query(
      `INSERT INTO public.vehiculos
        (codigo_vehiculo, codigo_orden, vin, placa, marca, modelo,
         anio, id_cliente, id_asesor, id_fase_actual, fecha_ingreso,
         fecha_estimada_entrega, observaciones, tipo_vehiculo, color,
         sede, telefono_asesor, imagen_url, dias_estimados_entrega,
         fecha_actualizacion)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,
         $11,$12,$13,$14,$15,$16,$17,$18,CURRENT_TIMESTAMP)
       RETURNING id_vehiculo`,
      [
        vehicleCode,
        order,
        vin,
        data.placa || `TMP${String(n).padStart(3, '0')}`,
        marca,
        modelo,
        Number(data.anio) || new Date().getFullYear(),
        clientId,
        advisorId,
        phase.rows[0].id_fase,
        data.estimated_delivery_date || data.fecha_estimada_entrega || null,
        data.observaciones || null,
        data.vehicle_type || 'Automóvil',
        data.color || null,
        data.dealership_branch || null,
        data.advisor_phone || null,
        data.image_url || '/img/car-default.svg',
        days
      ]
    );

    const id = inserted.rows[0].id_vehiculo;

    // Crear checklist.
    for (const [i, item] of (data.checklist || []).entries()) {
      await client.query(
        `INSERT INTO public.checklist_vehiculos
           (id_vehiculo, codigo_tarea, titulo, categoria, completada)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          id,
          item.code || item.codigo_tarea || `TAREA-${i + 1}`,
          item.title || item.titulo || 'Tarea',
          item.category || item.categoria || null,
          Boolean(item.completed)
        ]
      );
    }

    // Crear una cuenta solo si el cliente aún no tiene una.
    if (
      data.create_client_user !== false &&
      data.client_name &&
      data.client_doc
    ) {
      const account = await client.query(
        `SELECT id_usuario
         FROM public.usuarios
         WHERE id_cliente = $1 AND rol = 'cliente'
         LIMIT 1`,
        [clientId]
      );

      if (!account.rowCount) {
        const raw = String(data.client_name)
          .trim()
          .toLowerCase()
          .split(/\s+/);

        const baseUsername =
          `${raw[0] || 'cliente'}.${raw[raw.length - 1] || 'usuario'}`
            .replace(/[^a-z0-9.]/g, '');

        let username = baseUsername;
        let suffix = 1;

        while (true) {
          const usernameCheck = await client.query(
            `SELECT 1
             FROM public.usuarios
             WHERE lower(nombre_usuario) = lower($1)`,
            [username]
          );

          if (!usernameCheck.rowCount) break;
          username = `${baseUsername}.${suffix++}`;
        }

        const email = String(
          data.client_email || `${username}@email.com`
        ).trim().toLowerCase();

        const emailCheck = await client.query(
          `SELECT id_usuario, id_cliente
           FROM public.usuarios
           WHERE lower(correo) = lower($1)
           LIMIT 1`,
          [email]
        );

        if (emailCheck.rowCount) {
          if (Number(emailCheck.rows[0].id_cliente) !== Number(clientId)) {
            throw new Error(
              'Ese correo ya pertenece a otra cuenta. Verifica el correo.'
            );
          }

          // La cuenta ya existe para este cliente: no duplicarla.
        } else {
          const tempPassword =
            `Temp${crypto.randomInt(1000, 9999)}!`;

          const hash = await hashPassword(tempPassword);

          const userResult = await client.query(
            `INSERT INTO public.usuarios
               (nombre_usuario, correo, password_hash, rol, activo,
                id_cliente, id_asesor, debe_cambiar_password)
             VALUES ($1, $2, $3, 'cliente', true, $4, NULL, true)
             RETURNING id_usuario`,
            [username, email, hash, clientId]
          );

          createdUser = {
            id: `USR-${userResult.rows[0].id_usuario}`,
            username,
            password: tempPassword,
            client_doc: doc,
            client_name: String(data.client_name),
            email,
            vehicle_id: vehicleCode,
            must_change_password: true,
            role: 'client'
          };
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // El correo se procesa después de confirmar la transacción.
  if (createdUser) {
    emailService.sendWelcomeEmail({
      user: createdUser,
      vehicle: await getVehicleByCode(vehicleCode)
    }).catch(err => {
      console.error(
        'Error al procesar correo de bienvenida:',
        err.message
      );
    });
  }

  return {
    vehicle: await getVehicleByCode(vehicleCode),
    createdUser
  };
},

  updateStatus: async (code, newIndex, notes, updatedBy = 'Personal Operativo') => {
    const current = await getVehicleByCode(code);
    if (!current) return null;
    const target = Number(newIndex);
    if (!Number.isInteger(target) || target < 1 || target > 7) return null;
    if (target < current.current_stage_index) throw new Error('No se permite retroceder de fase.');
    if (target === current.current_stage_index) return current;
    for (let n = current.current_stage_index; n < target; n++) {
      await pool.query('SELECT public.avanzar_fase_vehiculo($1)', [String(current.placa || code)]);
    }
    const r = await pool.query(`SELECT id_vehiculo FROM public.vehiculos WHERE codigo_vehiculo=$1 OR id_vehiculo::text=$1 LIMIT 1`, [String(code)]);
    if (r.rows[0] && notes) {
      await pool.query(`UPDATE public.historial_estados SET observacion=$1
        WHERE id_historial=(SELECT id_historial FROM public.historial_estados WHERE id_vehiculo=$2 ORDER BY fecha_cambio DESC,id_historial DESC LIMIT 1)`,
        [String(notes), r.rows[0].id_vehiculo]);
    }
    return getVehicleByCode(code);
  },
  toggleChecklistItem: async (code, itemId, completed) => {
    const r = await pool.query(`UPDATE public.checklist_vehiculos ch SET completada=$1, fecha_actualizacion=CURRENT_TIMESTAMP
      FROM public.vehiculos v WHERE ch.id_vehiculo=v.id_vehiculo
      AND (v.codigo_vehiculo=$2 OR v.id_vehiculo::text=$2) AND ch.id_checklist::text=$3
      RETURNING v.codigo_vehiculo`, [Boolean(completed),String(code),String(itemId)]);
    if (!r.rowCount) return null;
    return getVehicleByCode(code);
  },
  submitRating: async (code, rating) => {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error('La calificación debe estar entre 1 y 5.');
    const r = await pool.query('UPDATE public.vehiculos SET calificacion_satisfaccion=$1,fecha_actualizacion=CURRENT_TIMESTAMP WHERE codigo_vehiculo=$2 OR id_vehiculo::text=$2 RETURNING id_vehiculo', [n,String(code)]);
    return r.rowCount ? getVehicleByCode(code) : null;
  },
  getAllUsers: async () => (await getUserRows()).map(mapUser),
  authenticateUser: async (usernameOrEmail, password) => {
    const q = String(usernameOrEmail || '').trim().toLowerCase();
    const r = await pool.query(`SELECT * FROM public.usuarios
      WHERE lower(nombre_usuario)=lower($1) OR lower(correo)=lower($1)
         OR id_cliente IN (SELECT id_cliente FROM public.clientes WHERE documento=$1)
      LIMIT 1`, [q]);
    if (!r.rows[0] || !r.rows[0].activo || !(await verifyPassword(password, r.rows[0].password_hash))) return null;
    const row = (await getUserRows()).find(x => x.id_usuario === r.rows[0].id_usuario);
    return row ? mapUser(row) : null;
  },
  changePassword: async (userId, oldPassword, newPassword) => {
    const id = String(userId).match(/-(\d+)$/)?.[1] || userId;
    const r = await pool.query('SELECT id_usuario,password_hash FROM public.usuarios WHERE id_usuario=$1', [id]);
    if (!r.rows[0]) return { success:false, message:'Usuario no encontrado' };
    if (!(await verifyPassword(oldPassword,r.rows[0].password_hash))) return { success:false,message:'La contraseña actual no es correcta' };
    const hash = await hashPassword(newPassword);
    await pool.query('UPDATE public.usuarios SET password_hash=$1 WHERE id_usuario=$2',[hash,id]);
    return { success:true, user:(await db.getAllUsers()).find(u=>u.db_id===Number(id)) };
  },
  createUser: async data => {
    const username = String(data.username || '').trim().toLowerCase();
    const email = String(data.email || `${username}@autotrack.local`).trim().toLowerCase();
    if (!username) return {success:false,message:'El nombre de usuario es obligatorio.'};
    const exists = await pool.query('SELECT 1 FROM public.usuarios WHERE lower(nombre_usuario)=lower($1) OR lower(correo)=lower($2)',[username,email]);
    if (exists.rowCount) return {success:false,message:'El usuario o correo ya existe.'};
    const role = appRole(data.role || 'client');
    let idCliente = null, idAsesor = null;
    if (role === 'cliente') idCliente = await ensureClient({client_doc:data.client_doc || `DOC-${Date.now()}`,client_name:data.client_name || username,client_email:email});
    else if (role === 'asesor') idAsesor = await ensureAdvisor({advisor_name:data.client_name || username,advisor_email:email});
    const hash = await hashPassword(data.password || crypto.randomBytes(12).toString('hex'));
    const r = await pool.query(`INSERT INTO public.usuarios(nombre_usuario,correo,password_hash,rol,activo,id_cliente,id_asesor,debe_cambiar_password)
      VALUES($1,$2,$3,$4,true,$5,$6,$7) RETURNING id_usuario`,[username,email,hash,role,idCliente,idAsesor,data.must_change_password !== false]);
    return {success:true,user:(await db.getAllUsers()).find(u=>u.db_id===r.rows[0].id_usuario)};
  },
  deleteUser: async userId => {
    const id = String(userId).match(/-(\d+)$/)?.[1] || userId;
    const u = await pool.query('SELECT nombre_usuario FROM public.usuarios WHERE id_usuario=$1',[id]);
    if (!u.rows[0]) return {success:false,message:'Usuario no encontrado.'};
    if (u.rows[0].nombre_usuario.toLowerCase()==='admin') return {success:false,message:'No es posible eliminar el administrador principal.'};
    await pool.query('DELETE FROM public.usuarios WHERE id_usuario=$1',[id]);
    return {success:true,message:'Usuario eliminado correctamente.'};
  },
  deleteVehicle: async code => {
    const r = await pool.query('DELETE FROM public.vehiculos WHERE codigo_vehiculo=$1 OR id_vehiculo::text=$1 RETURNING id_vehiculo',[String(code)]);
    return r.rowCount ? {success:true,message:'Vehículo eliminado correctamente.'} : {success:false,message:'Vehículo no encontrado.'};
  },
  updateVehicle: async (code, data) => {
    const old = await getVehicleByCode(code);
    if (!old) return null;
    if (data.current_stage_index && Number(data.current_stage_index)!==old.current_stage_index) {
      const advanced = await db.updateStatus(code, data.current_stage_index, data.observaciones || data.notes);
      if (!advanced) return null;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fields = [];
      const values = [];
      const add = (col,val) => { values.push(val); fields.push(`${col}=$${values.length}`); };
      if (data.order_code !== undefined) add('codigo_orden',data.order_code);
      if (data.vin !== undefined) add('vin',data.vin);
      if (data.vehicle_type !== undefined) add('tipo_vehiculo',data.vehicle_type);
      if (data.color !== undefined) add('color',data.color);
      if (data.dealership_branch !== undefined) add('sede',data.dealership_branch);
      if (data.advisor_phone !== undefined) add('telefono_asesor',data.advisor_phone);
      if (data.image_url !== undefined) add('imagen_url',data.image_url);
      if (data.estimated_delivery_days !== undefined) add('dias_estimados_entrega',Number(data.estimated_delivery_days));
      if (data.estimated_delivery_date !== undefined) add('fecha_estimada_entrega',data.estimated_delivery_date || null);
      if (data.satisfaction_rating !== undefined) add('calificacion_satisfaccion',data.satisfaction_rating);
      if (data.marca !== undefined) add('marca',data.marca);
      if (data.modelo !== undefined) add('modelo',data.modelo);
      if (data.anio !== undefined) add('anio',Number(data.anio));
      if (data.placa !== undefined) add('placa',data.placa);
      if (fields.length) {
        values.push(old.db_id);
        await client.query(`UPDATE public.vehiculos SET ${fields.join(',')}, fecha_actualizacion=CURRENT_TIMESTAMP WHERE id_vehiculo=$${values.length}`,values);
      }
      await client.query('COMMIT');
    } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    return getVehicleByCode(code);
  }
};
module.exports = db;
