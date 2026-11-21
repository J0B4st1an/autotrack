
require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database/db');
const emailService = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de imágenes
const imgDir = path.join(__dirname, 'public', 'img');

if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imgDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename =
      `vehiculo-${Date.now()}-${Math.floor(100 + Math.random() * 900)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos de imagen.'));
  }
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ======================================================
// AUTENTICACIÓN
// ======================================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Ingresa tu usuario/correo y contraseña.'
    });
  }

  const user = await db.authenticateUser(username, password);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario o contraseña incorrectos.'
    });
  }

  const vehicle = user.vehicle_id
    ? await db.getUserVehicle(user.vehicle_id)
    : null;

  return res.json({
    success: true,
    message: 'Inicio de sesión exitoso',
    user: {
      id: user.id,
      username: user.username,
      client_name: user.client_name,
      email: user.email,
      vehicle_id: user.vehicle_id,
      must_change_password: user.must_change_password,
      role: user.role
    },
    vehicle
  });
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Ingresa usuario y contraseña.'
    });
  }

  const user = await db.authenticateUser(username, password);

  if (!user || user.role === 'client') {
    return res.status(401).json({
      success: false,
      message: 'Credenciales administrativas incorrectas.'
    });
  }

  return res.json({
    success: true,
    message: 'Autenticación staff exitosa',
    user: {
      id: user.id,
      username: user.username,
      client_name: user.client_name,
      email: user.email,
      role: user.role
    }
  });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Todos los campos son requeridos.'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'La nueva contraseña debe tener al menos 6 caracteres.'
    });
  }

  const result = await db.changePassword(userId, oldPassword, newPassword);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json({
    success: true,
    message: '¡Contraseña actualizada exitosamente!',
    user: result.user
  });
});

// ======================================================
// CLIENTE
// ======================================================

app.get('/api/client/my-vehicle', async (req, res) => {
  const vehicleId = req.query.vehicle_id;

  if (!vehicleId) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere vehicle_id de sesión.'
    });
  }

  const vehicle = await db.getUserVehicle(vehicleId);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehículo no encontrado.'
    });
  }

  const stages = db.getStages();
  const currentStageInfo = stages.find(
    stage => Number(stage.index) === Number(vehicle.current_stage_index)
  );

  const createdDate = new Date(vehicle.created_at);
  const daysElapsed = Math.max(
    1,
    Math.floor((Date.now() - createdDate.getTime()) / 86400000)
  );

  return res.json({
    success: true,
    vehicle,
    stages,
    currentStageInfo,
    daysElapsed
  });
});

// ======================================================
// FASES, USUARIOS Y VEHÍCULOS
// ======================================================

app.get('/api/stages', (req, res) => {
  return res.json({
    success: true,
    stages: db.getStages()
  });
});

app.get('/api/users', async (req, res) => {
  const users = await db.getAllUsers();
  return res.json({ success: true, users });
});

app.get('/api/vehicles', async (req, res) => {
  let vehicles = await db.getAllVehicles();
  const { stage, type, search } = req.query;

  if (stage) {
    vehicles = vehicles.filter(
      vehicle => Number(vehicle.current_stage_index) === Number.parseInt(stage, 10)
    );
  }

  if (type) {
    vehicles = vehicles.filter(
      vehicle => String(vehicle.vehicle_type || '').toLowerCase() ===
        String(type).toLowerCase()
    );
  }

  if (search) {
    const q = String(search).toLowerCase();

    vehicles = vehicles.filter(vehicle =>
      String(vehicle.client_name || '').toLowerCase().includes(q) ||
      String(vehicle.client_doc || '').toLowerCase().includes(q) ||
      String(vehicle.vin || '').toLowerCase().includes(q) ||
      String(vehicle.order_code || '').toLowerCase().includes(q)
    );
  }

  return res.json({
    success: true,
    count: vehicles.length,
    vehicles
  });
});

// ======================================================
// REENVIAR CORREO CON LA FASE ACTUAL DEL VEHÍCULO
// ======================================================

app.post('/api/vehicles/:id/resend-status-email', async (req, res) => {
  try {
    // En este proyecto, el identificador visible es, por ejemplo, VEH-1014.
    // getVehicleByCode debe devolver el vehículo con sus datos asociados.
    if (typeof db.getVehicleByCode !== 'function') {
      throw new Error(
        'database/db.js no exporta la función getVehicleByCode.'
      );
    }

    const vehicle = await db.getVehicleByCode(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el vehículo.'
      });
    }

    if (!vehicle.client_email) {
      return res.status(400).json({
        success: false,
        message: 'El cliente no tiene un correo registrado.'
      });
    }

    if (typeof emailService.sendVehicleStatusEmail !== 'function') {
      throw new Error(
        'emailService.js no exporta sendVehicleStatusEmail.'
      );
    }

    const result = await emailService.sendVehicleStatusEmail({
      user: {
        email: vehicle.client_email,
        client_name: vehicle.client_name
      },
      vehicle,
      portalUrl: process.env.PORTAL_URL
    });

    return res.json({
      success: true,
      message: `Notificación de estado enviada a ${vehicle.client_email}.`,
      messageId: result.messageId
    });
  } catch (err) {
    console.error('[REENVÍO DE CORREO DE ESTADO]', err);

    return res.status(500).json({
      success: false,
      message: err.message || 'No se pudo enviar el correo.'
    });
  }
});

// ======================================================
// SUBIDA DE IMÁGENES
// ======================================================

app.post('/api/upload-image', (req, res) => {
  upload.single('image')(req, res, err => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: `Error de subida: ${err.message}`
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se seleccionó ningún archivo de imagen.'
      });
    }

    return res.json({
      success: true,
      message: 'Imagen subida exitosamente.',
      imageUrl: `/img/${req.file.filename}`,
      filename: req.file.filename
    });
  });
});

// ======================================================
// OPERACIONES DE USUARIOS Y VEHÍCULOS
// ======================================================

app.post('/api/users', async (req, res) => {
  const { username, email, vehicle_id } = req.body;

  if (!username || !email) {
    return res.status(400).json({
      success: false,
      message: 'Nombre de usuario y correo son obligatorios.'
    });
  }

  const result = await db.createUser(req.body);

  if (!result.success) {
    return res.status(400).json(result);
  }

  const rawPassword = result.plainPassword || req.body.password || 'AutoTrack2024*';

  // Enviar las credenciales al usuario por correo electrónico
  let emailSent = false;
  try {
    let vehicle = null;
    const vId = vehicle_id || result.user?.vehicle_id;
    if (vId && typeof db.getVehicleByCode === 'function') {
      try {
        vehicle = await db.getVehicleByCode(vId);
      } catch (ve) {
        console.warn('[EMAIL USUARIO] No se pudo obtener el vehículo:', ve.message);
      }
    }

    const emailRes = await emailService.sendWelcomeEmail({
      user: {
        email: result.user.email || email,
        client_name: result.user.client_name || req.body.client_name || username,
        username: result.user.username || username,
        password: rawPassword
      },
      vehicle,
      portalUrl: process.env.PORTAL_URL
    });

    emailSent = Boolean(emailRes?.success);
  } catch (err) {
    console.error(`[AutoTrack] Error al enviar credenciales a ${email}:`, err.message);
  }

  const emailMsg = emailSent
    ? ` y credenciales enviadas a ${email}`
    : '';

  return res.status(201).json({
    success: true,
    message: `Usuario @${result.user.username} creado exitosamente${emailMsg}.`,
    user: result.user,
    emailSent
  });
});

app.delete('/api/users/:id', async (req, res) => {
  const result = await db.deleteUser(req.params.id);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

app.delete('/api/vehicles/:id', async (req, res) => {
  const result = await db.deleteVehicle(req.params.id);

  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

app.put('/api/vehicles/:id', async (req, res) => {
  const updated = await db.updateVehicle(req.params.id, req.body);

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Vehículo no encontrado.'
    });
  }

  return res.json({
    success: true,
    message: 'Vehículo actualizado exitosamente.',
    vehicle: updated
  });
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const { client_doc, client_name, brand_model } = req.body;

    if (!client_doc || !client_name || !brand_model) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes (Cédula, Nombre o Modelo).'
      });
    }

    const result = await db.createVehicle(req.body);

    return res.status(201).json({
      success: true,
      message: 'Vehículo registrado correctamente.',
      vehicle: result.vehicle
    });
  } catch (err) {
    console.error('[ERROR CREAR VEHÍCULO]', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Error interno al registrar el vehículo.'
    });
  }
});

app.patch('/api/vehicles/:id/status', async (req, res) => {
  const { stage_index, notes, updated_by } = req.body;

  const updatedVehicle = await db.updateStatus(
    req.params.id,
    stage_index,
    notes,
    updated_by
  );

  if (!updatedVehicle) {
    return res.status(404).json({
      success: false,
      message: 'Vehículo no encontrado.'
    });
  }

  return res.json({
    success: true,
    message: `Estado actualizado a: ${updatedVehicle.current_stage_name}`,
    vehicle: updatedVehicle
  });
});

app.put('/api/vehicles/:id/checklist', async (req, res) => {
  const { item_id, completed } = req.body;
  const updatedVehicle = await db.toggleChecklistItem(
    req.params.id,
    item_id,
    completed
  );

  return res.json({ success: true, vehicle: updatedVehicle });
});

app.post('/api/vehicles/:id/rating', async (req, res) => {
  const updatedVehicle = await db.submitRating(
    req.params.id,
    req.body.rating
  );

  return res.json({
    success: true,
    message: '¡Gracias por tu calificación!',
    vehicle: updatedVehicle
  });
});

// ======================================================
// MÉTRICAS
// ======================================================

app.get('/api/metrics', async (req, res) => {
  const vehicles = await db.getAllVehicles();
  const stages = db.getStages();

  const total = vehicles.length;
  const active = vehicles.filter(v => v.current_stage_index < 7).length;
  const delivered = vehicles.filter(v => v.current_stage_index === 7).length;

  const stageDistribution = stages.map(stage => ({
    stage_index: stage.index,
    stage_name: stage.name,
    count: vehicles.filter(
      vehicle => vehicle.current_stage_index === stage.index
    ).length
  }));

  const delayed = vehicles.filter(vehicle => {
    if (vehicle.current_stage_index === 7) return false;

    const elapsedDays = Math.floor(
      (Date.now() - new Date(vehicle.created_at).getTime()) / 86400000
    );

    return elapsedDays > Number(vehicle.estimated_delivery_days || 0);
  });

  return res.json({
    success: true,
    metrics: {
      total_vehicles: total,
      active_vehicles: active,
      delivered_vehicles: delivered,
      delayed_vehicles_count: delayed.length,
      avg_satisfaction_rating: '4.9',
      stage_distribution: stageDistribution,
      delayed_list: delayed
    }
  });
});

// ======================================================
// MANEJO DE ERRORES
// ======================================================

app.use((err, req, res, next) => {
  console.error('[ERROR DEL SERVIDOR]', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: 'Ocurrió un error interno al procesar la solicitud.'
  });
});

// Fallback para páginas
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'Endpoint no encontrado.'
    });
  }

  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log('====================================================');
    console.log('🚀 Servidor AutoTrack iniciado correctamente');
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔑 Portal de Login: http://localhost:${PORT}/login.html`);
    console.log('====================================================');
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está ocupado.`);
    } else {
      console.error(err);
    }
  });
}

module.exports = app;
