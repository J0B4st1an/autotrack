const fs = require('fs');
const path = require('path');
const emailService = require('../services/emailService');

const DB_PATH = path.join(__dirname, '../data/tracker_db.json');

const STAGES = [
  { index: 1, name: "Vehículo en Proceso de Asignación", description: "Asignación de VIN, chasis y confirmación de pedido.", icon: "clipboard-check", est_pct: 15 },
  { index: 2, name: "Vehículo en Transporte", description: "En tránsito desde planta o puerto hacia el concesionario.", icon: "truck", est_pct: 30 },
  { index: 3, name: "Vehículo Recibido", description: "Recepción en patio, inspección física y documental inicial.", icon: "building-warehouse", est_pct: 45 },
  { index: 4, name: "En Alistamiento", description: "Mecánica rápida, instalación de accesorios y detallado/lavado.", icon: "wrench", est_pct: 65 },
  { index: 5, name: "Documentación en Proceso", description: "Trámite de matrícula, SOAT, expedición de placas y póliza.", icon: "file-text", est_pct: 85 },
  { index: 6, name: "Listo para Entrega", description: "Vehículo 100% verificado. Cita de entrega agendada.", icon: "sparkles", est_pct: 95 },
  { index: 7, name: "Entregado", description: "Acta de entrega firmada y llaves entregadas al cliente.", icon: "key", est_pct: 100 }
];

const INITIAL_VEHICLES = [
  {
    id: "VEH-1001",
    order_code: "PED-2024-8891",
    vin: "9BWCA111000123456",
    client_doc: "1098765432",
    client_name: "Carlos Eduardo Mendoza",
    client_phone: "+57 315 890 1234",
    client_email: "carlos.mendoza@email.com",
    vehicle_type: "Automóvil",
    brand_model: "Mazda CX-30 Grand Touring 2024",
    color: "Rojo Cristal Metalizado",
    dealership_branch: "Almotores - Sede Principal Norte",
    advisor_name: "Laura Gómez",
    advisor_phone: "+57 300 123 4567",
    current_stage_index: 4,
    current_stage_name: "En Alistamiento",
    estimated_delivery_days: 14,
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    estimated_delivery_date: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
    checklist: [
      { id: "chk_1", title: "Inspección física y pintura inicial", completed: true, category: "Recepción" },
      { id: "chk_2", title: "Inspección mecánica y fluidos", completed: true, category: "Alistamiento" },
      { id: "chk_3", title: "Instalación de película de seguridad", completed: true, category: "Accesorios" },
      { id: "chk_4", title: "Lavado y detallado de entrega", completed: false, category: "Alistamiento" },
      { id: "chk_5", title: "Expedición de SOAT", completed: true, category: "Trámites" },
      { id: "chk_6", title: "Asignación e instalación de placas", completed: false, category: "Trámites" }
    ],
    status_history: [
      { stage_index: 1, stage_name: "Vehículo en Proceso de Asignación", date: new Date(Date.now() - 8 * 86400000).toISOString(), notes: "VIN asignado y pedido confirmado.", updated_by: "Sistema" },
      { stage_index: 2, stage_name: "Vehículo en Transporte", date: new Date(Date.now() - 6 * 86400000).toISOString(), notes: "Despachado en niñera desde puerto Buenaventura.", updated_by: "Logística Central" },
      { stage_index: 3, stage_name: "Vehículo Recibido", date: new Date(Date.now() - 3 * 86400000).toISOString(), notes: "Ingreso a patio concesionario Almotores Norte.", updated_by: "Recepción Patio" },
      { stage_index: 4, stage_name: "En Alistamiento", date: new Date(Date.now() - 1 * 86400000).toISOString(), notes: "Ingreso a taller para polarizado y accesorios.", updated_by: "Jefe de Alistamiento" }
    ],
    satisfaction_rating: null
  },
  {
    id: "VEH-1002",
    order_code: "PED-2024-9042",
    vin: "93YMT07X998877665",
    client_doc: "52431980",
    client_name: "María Fernanda Ríos",
    client_phone: "+57 320 456 7890",
    client_email: "mf.rios@email.com",
    vehicle_type: "Motocicleta",
    brand_model: "Yamaha MT-07 ABS 2024",
    color: "Cyan Storm",
    dealership_branch: "Almotores - Sede Sur Motos",
    advisor_name: "Julián Ruiz",
    advisor_phone: "+57 312 987 6543",
    current_stage_index: 6,
    current_stage_name: "Listo para Entrega",
    estimated_delivery_days: 6,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 0.5 * 86400000).toISOString(),
    estimated_delivery_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    checklist: [
      { id: "chk_1", title: "Ensamble final y torque de ruedas", completed: true, category: "Alistamiento" },
      { id: "chk_2", title: "Carga y prueba de batería", completed: true, category: "Alistamiento" },
      { id: "chk_3", title: "Expedición de SOAT y Matrícula", completed: true, category: "Trámites" },
      { id: "chk_4", title: "Instalación de placa trasera", completed: true, category: "Trámites" }
    ],
    status_history: [
      { stage_index: 1, stage_name: "Vehículo en Proceso de Asignación", date: new Date(Date.now() - 5 * 86400000).toISOString(), notes: "Chasis verificado.", updated_by: "Sistema" },
      { stage_index: 6, stage_name: "Listo para Entrega", date: new Date(Date.now() - 0.5 * 86400000).toISOString(), notes: "Cliente citada para mañana 10:00 AM.", updated_by: "Julián Ruiz" }
    ],
    satisfaction_rating: null
  }
];

const INITIAL_USERS = [
  {
    id: "ADM-001",
    username: "admin",
    password: "Admin1234*",
    client_doc: "00000001",
    client_name: "Administrador General",
    email: "admin@autotrack.com",
    vehicle_id: null,
    must_change_password: false,
    role: "admin"
  },
  {
    id: "ADM-002",
    username: "asesor.laura",
    password: "Asesor1234*",
    client_doc: "00000002",
    client_name: "Laura Gómez (Asesor Comercial)",
    email: "laura.gomez@autotrack.com",
    vehicle_id: null,
    must_change_password: false,
    role: "staff_asesor"
  },
  {
    id: "ADM-003",
    username: "logistica.taller",
    password: "Taller1234*",
    client_doc: "00000003",
    client_name: "Jefe de Alistamiento & Taller",
    email: "taller@autotrack.com",
    vehicle_id: null,
    must_change_password: false,
    role: "staff_logistica"
  },
  {
    id: "ADM-004",
    username: "tramites.runt",
    password: "Tramites1234*",
    client_doc: "00000004",
    client_name: "Gestor de Trámites & Placas",
    email: "tramites@autotrack.com",
    vehicle_id: null,
    must_change_password: false,
    role: "staff_tramites"
  },
  {
    id: "USR-1001",
    username: "carlos.mendoza",
    password: "Temp1234",
    client_doc: "1098765432",
    client_name: "Carlos Eduardo Mendoza",
    email: "carlos.mendoza@email.com",
    vehicle_id: "VEH-1001",
    must_change_password: true,
    role: "client"
  },
  {
    id: "USR-1002",
    username: "mf.rios",
    password: "Clave2024",
    client_doc: "52431980",
    client_name: "María Fernanda Ríos",
    email: "mf.rios@email.com",
    vehicle_id: "VEH-1002",
    must_change_password: false,
    role: "client"
  }
];

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const initialStore = { vehicles: INITIAL_VEHICLES, users: INITIAL_USERS };

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
  } else {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      let users = parsed.users || [];
      let vehicles = parsed.vehicles || (Array.isArray(parsed) ? parsed : INITIAL_VEHICLES);

      let updated = false;
      INITIAL_USERS.forEach(initUser => {
        if (!users.some(u => u.username === initUser.username)) {
          users.push(initUser);
          updated = true;
        }
      });

      if (updated || Array.isArray(parsed)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ vehicles, users }, null, 2), 'utf8');
      }
    } catch (e) {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
    }
  }
}

function readData() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { vehicles: parsed, users: INITIAL_USERS };
    return parsed;
  } catch (err) {
    return { vehicles: INITIAL_VEHICLES, users: INITIAL_USERS };
  }
}

function writeData(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Simulación de envío silencioso de correo de bienvenida al cliente
function simulateWelcomeEmail(user, vehicle) {
  console.log(`\n📧 ================= NOTIFICACIÓN POR CORREO ENVIADA AL CLIENTE =================`);
  console.log(`Para: ${user.client_name} <${user.email}>`);
  console.log(`Asunto: ¡Bienvenido a AutoTrack! Consulta el alistamiento de tu ${vehicle.brand_model}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Hola ${user.client_name},`);
  console.log(`Se ha generado tu pedido (${vehicle.order_code}) para tu vehículo ${vehicle.brand_model}.`);
  console.log(`Puedes ingresar a consultar el seguimiento en el siguiente enlace:`);
  console.log(`👉 Link de Acceso: http://localhost:3000/login.html`);
  console.log(`👤 Usuario: ${user.username}`);
  console.log(`🔑 Contraseña Temporal: ${user.password}`);
  console.log(`⚠️  Nota: En tu primer ingreso, el sistema te solicitará cambiar tu clave por una personal.`);
  console.log(`=================================================================================\n`);
}

const db = {
  getStages: () => STAGES,

  getAllVehicles: () => readData().vehicles || [],

  getVehicleById: (id) => {
    const vehicles = readData().vehicles || [];
    return vehicles.find(v => v.id.toLowerCase() === id.toLowerCase());
  },

  searchVehicle: (query) => {
    if (!query) return null;
    const q = query.trim().toLowerCase();
    const vehicles = readData().vehicles || [];
    return vehicles.find(v => 
      v.client_doc.toLowerCase() === q ||
      v.vin.toLowerCase() === q ||
      v.order_code.toLowerCase() === q ||
      v.id.toLowerCase() === q
    ) || null;
  },

  createVehicle: (vehicleData) => {
    const data = readData();
    const vehicles = data.vehicles || [];
    const users = data.users || [];
    const newId = `VEH-${1001 + vehicles.length}`;
    const stageObj = STAGES.find(s => s.index === (vehicleData.current_stage_index || 1)) || STAGES[0];

    const newVehicle = {
      id: newId,
      order_code: vehicleData.order_code || `PED-2024-${Math.floor(1000 + Math.random() * 9000)}`,
      vin: vehicleData.vin || `9BW${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
      client_doc: vehicleData.client_doc,
      client_name: vehicleData.client_name,
      client_phone: vehicleData.client_phone || "+57 300 000 0000",
      client_email: vehicleData.client_email || "cliente@email.com",
      vehicle_type: vehicleData.vehicle_type || "Automóvil",
      brand_model: vehicleData.brand_model,
      color: vehicleData.color || "Blanco Glaciar",
      dealership_branch: vehicleData.dealership_branch || "Almotores - Sede Principal",
      advisor_name: vehicleData.advisor_name || "Asesor Comercial",
      advisor_phone: vehicleData.advisor_phone || "+57 300 123 4567",
      current_stage_index: stageObj.index,
      current_stage_name: stageObj.name,
      estimated_delivery_days: vehicleData.vehicle_type === "Motocicleta" ? 7 : 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      estimated_delivery_date: new Date(Date.now() + (vehicleData.vehicle_type === "Motocicleta" ? 7 : 15) * 86400000).toISOString().split('T')[0],
      checklist: [
        { id: "chk_1", title: "Inspección inicial física", completed: true, category: "Recepción" },
        { id: "chk_2", title: "Alistamiento mecánico", completed: false, category: "Alistamiento" },
        { id: "chk_3", title: "Expedición de SOAT y Matrícula", completed: false, category: "Trámites" }
      ],
      status_history: [
        { stage_index: stageObj.index, stage_name: stageObj.name, date: new Date().toISOString(), notes: "Registro inicial del pedido.", updated_by: vehicleData.advisor_name || "Sistema" }
      ],
      satisfaction_rating: null
    };

    vehicles.push(newVehicle);

    const rawUser = (vehicleData.client_name || "cliente").toLowerCase().split(' ')[0] + "." + (vehicleData.client_name || "usuario").toLowerCase().split(' ').pop();
    const cleanUsername = rawUser.replace(/[^a-z0-9.]/g, '');
    const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}`;

    const newUser = {
      id: `USR-${1001 + users.length}`,
      username: cleanUsername,
      password: tempPassword,
      client_doc: vehicleData.client_doc,
      client_name: vehicleData.client_name,
      email: vehicleData.client_email || `${cleanUsername}@email.com`,
      vehicle_id: newId,
      must_change_password: true,
      role: "client"
    };

    users.push(newUser);
    writeData({ vehicles, users });

    // Enviar correo de bienvenida (envío SMTP real si hay credenciales configuradas, o consola)
    emailService.sendWelcomeEmail({ user: newUser, vehicle: newVehicle }).catch(err => {
      console.error("Error al procesar correo de bienvenida:", err);
    });

    return { vehicle: newVehicle, createdUser: newUser };
  },

  updateStatus: (id, newStageIndex, notes, updatedBy = "Personal Operativo") => {
    const data = readData();
    const vehicles = data.vehicles;
    const idx = vehicles.findIndex(v => v.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    const targetStage = STAGES.find(s => s.index === parseInt(newStageIndex));
    if (!targetStage) return null;

    vehicles[idx].current_stage_index = targetStage.index;
    vehicles[idx].current_stage_name = targetStage.name;
    vehicles[idx].updated_at = new Date().toISOString();

    vehicles[idx].status_history.push({
      stage_index: targetStage.index,
      stage_name: targetStage.name,
      date: new Date().toISOString(),
      notes: notes || `Cambio de estado a: ${targetStage.name}`,
      updated_by: updatedBy
    });

    writeData(data);
    return vehicles[idx];
  },

  toggleChecklistItem: (id, itemId, completed) => {
    const data = readData();
    const v = data.vehicles.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (v) {
      const chk = v.checklist.find(c => c.id === itemId);
      if (chk) chk.completed = completed;
      writeData(data);
    }
    return v;
  },

  submitRating: (id, rating) => {
    const data = readData();
    const v = data.vehicles.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (v) {
      v.satisfaction_rating = rating;
      writeData(data);
    }
    return v;
  },

  // --- AUTENTICACIÓN Y ROLES UNIFICADOS ---

  getAllUsers: () => readData().users || [],

  authenticateUser: (usernameOrEmail, password) => {
    const data = readData();
    const users = data.users || [];
    const q = (usernameOrEmail || '').trim().toLowerCase();
    const p = (password || '').trim();

    const found = users.find(u => 
      (u.username.toLowerCase() === q || u.email.toLowerCase() === q || (u.client_doc && u.client_doc.toLowerCase() === q)) &&
      (u.password === password || u.password === p)
    );

    return found || null;
  },

  changePassword: (userId, oldPassword, newPassword) => {
    const data = readData();
    const users = data.users || [];
    const idx = users.findIndex(u => u.id === userId);

    if (idx === -1) return { success: false, message: "Usuario no encontrado" };
    if (users[idx].password !== oldPassword) {
      return { success: false, message: "La contraseña actual no es correcta" };
    }

    users[idx].password = newPassword;
    users[idx].must_change_password = false;
    writeData(data);

    return { success: true, user: users[idx] };
  },

  getUserVehicle: (vehicleId) => {
    const data = readData();
    return (data.vehicles || []).find(v => v.id.toLowerCase() === (vehicleId || '').toLowerCase());
  }
};

module.exports = db;
