require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer para subida de imágenes a /public/img
const imgDir = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imgDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const cleanName = `vehiculo-${Date.now()}-${Math.floor(100 + Math.random() * 900)}${ext}`;
    cb(null, cleanName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPG, PNG, WEBP, SVG, GIF).'));
    }
  }
});

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// --- ROUTER DE AUTENTICACIÓN UNIFICADA ---

// Endpoint Único de Login (Soporta Clientes y Staff por Rol)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Ingresa tu usuario/correo y contraseña." });
  }

  const user = await db.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos." });
  }

  const vehicle = user.vehicle_id ? await db.getUserVehicle(user.vehicle_id) : null;

  res.json({
    success: true,
    message: "Inicio de sesión exitoso",
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

// Endpoint de Login Administrativo (Alias para compatibilidad)
app.post('/api/auth/admin-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Ingresa usuario y contraseña." });
  }

  const user = await db.authenticateUser(username, password);
  if (!user || user.role === 'client') {
    return res.status(401).json({ success: false, message: "Credenciales administrativas incorrectas." });
  }

  res.json({
    success: true,
    message: "Autenticación staff exitosa",
    user: {
      id: user.id,
      username: user.username,
      client_name: user.client_name,
      email: user.email,
      role: user.role
    }
  });
});

// Cambio Obligatorio de Contraseña (Primer Ingreso Cliente)
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Todos los campos son requeridos." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "La nueva contraseña debe tener al menos 6 caracteres." });
  }

  const result = await db.changePassword(userId, oldPassword, newPassword);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    message: "¡Contraseña actualizada exitosamente!",
    user: result.user
  });
});

// Endpoint Exclusivo del Cliente (Su vehículo asignado)
app.get('/api/client/my-vehicle', async (req, res) => {
  const vehicleId = req.query.vehicle_id;
  if (!vehicleId) {
    return res.status(400).json({ success: false, message: "Se requiere vehicle_id de sesión." });
  }

  const vehicle = await db.getUserVehicle(vehicleId);
  if (!vehicle) {
    return res.status(404).json({ success: false, message: "Vehículo no encontrado." });
  }

  const stages = db.getStages();
  const currentStageInfo = stages.find(s => s.index === vehicle.current_stage_index);
  const createdDate = new Date(vehicle.created_at);
  const daysElapsed = Math.max(1, Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24)));

  res.json({
    success: true,
    vehicle,
    stages,
    currentStageInfo,
    daysElapsed
  });
});

// --- API OPERATIVA Y ADMINISTRATIVA ---

app.get('/api/stages', async (req, res) => {
  res.json({ success: true, stages: db.getStages() });
});

app.get('/api/users', async (req, res) => {
  res.json({ success: true, users: await db.getAllUsers() });
});

app.get('/api/vehicles', async (req, res) => {
  let vehicles = await db.getAllVehicles();
  const { stage, type, search } = req.query;

  if (stage) vehicles = vehicles.filter(v => v.current_stage_index === parseInt(stage));
  if (type) vehicles = vehicles.filter(v => v.vehicle_type.toLowerCase() === type.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    vehicles = vehicles.filter(v => 
      v.client_name.toLowerCase().includes(q) ||
      v.client_doc.toLowerCase().includes(q) ||
      v.vin.toLowerCase().includes(q) ||
      v.order_code.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, count: vehicles.length, vehicles });
});

// Subida de imagen a la carpeta /public/img
app.post('/api/upload-image', async (req, res) => {
  upload.single('image')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Error de subida: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se seleccionó ningún archivo de imagen." });
    }

    const imageUrl = `/img/${req.file.filename}`;
    res.json({
      success: true,
      message: "Imagen subida exitosamente.",
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  });
});

// Creación de Usuario Independiente
app.post('/api/users', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ success: false, message: "Nombre de usuario y correo son obligatorios." });
  }

  const result = await db.createUser(req.body);
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.status(201).json({
    success: true,
    message: `Usuario @${result.user.username} creado exitosamente.`,
    user: result.user
  });
});

// Eliminación de Usuario
app.delete('/api/users/:id', async (req, res) => {
  const result = await db.deleteUser(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Eliminación de Vehículo
app.delete('/api/vehicles/:id', async (req, res) => {
  const result = await db.deleteVehicle(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// Actualización de Vehículo
app.put('/api/vehicles/:id', async (req, res) => {
  const updated = await db.updateVehicle(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Vehículo no encontrado." });
  }
  res.json({ success: true, message: "Vehículo actualizado exitosamente.", vehicle: updated });
});

// Creación de Vehículo + Generación Silenciosa de Cliente & Envío de Correo
app.post('/api/vehicles', async (req, res) => {
  const { client_doc, client_name, brand_model } = req.body;
  if (!client_doc || !client_name || !brand_model) {
    return res.status(400).json({ success: false, message: "Campos requeridos faltantes." });
  }

  const result = await db.createVehicle(req.body);
  res.status(201).json({
    success: true,
    message: "Vehículo registrado exitosamente. Se ha enviado un correo electrónico con las credenciales de acceso al cliente.",
    vehicle: result.vehicle
  });
});

app.patch('/api/vehicles/:id/status', async (req, res) => {
  const { stage_index, notes, updated_by } = req.body;
  const updatedVehicle = await db.updateStatus(req.params.id, stage_index, notes, updated_by);
  if (!updatedVehicle) {
    return res.status(404).json({ success: false, message: "Vehículo no encontrado." });
  }
  res.json({ success: true, message: `Estado actualizado a: ${updatedVehicle.current_stage_name}`, vehicle: updatedVehicle });
});

app.put('/api/vehicles/:id/checklist', async (req, res) => {
  const { item_id, completed } = req.body;
  const updatedVehicle = await db.toggleChecklistItem(req.params.id, item_id, completed);
  res.json({ success: true, vehicle: updatedVehicle });
});

app.post('/api/vehicles/:id/rating', async (req, res) => {
  const updatedVehicle = await db.submitRating(req.params.id, req.body.rating);
  res.json({ success: true, message: "¡Gracias por tu calificación!", vehicle: updatedVehicle });
});

app.get('/api/metrics', async (req, res) => {
  const vehicles = await db.getAllVehicles();
  const stages = db.getStages();

  const total = vehicles.length;
  const active = vehicles.filter(v => v.current_stage_index < 7).length;
  const delivered = vehicles.filter(v => v.current_stage_index === 7).length;

  const stageDistribution = stages.map(s => ({
    stage_index: s.index,
    stage_name: s.name,
    count: vehicles.filter(v => v.current_stage_index === s.index).length
  }));

  const delayed = vehicles.filter(v => {
    if (v.current_stage_index === 7) return false;
    const elapsedDays = Math.floor((new Date() - new Date(v.created_at)) / (1000 * 60 * 60 * 24));
    return elapsedDays > v.estimated_delivery_days;
  });

  res.json({
    success: true,
    metrics: {
      total_vehicles: total,
      active_vehicles: active,
      delivered_vehicles: delivered,
      delayed_vehicles_count: delayed.length,
      avg_satisfaction_rating: "4.9",
      stage_distribution: stageDistribution,
      delayed_list: delayed
    }
  });
});

// Fallback SPA -> Redirigir a login.html
app.get('*', async (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: "Endpoint no encontrado." });
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Para ejecución local independiente
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor AutoTrack iniciado correctamente`);
    console.log(`📍 Puerto: ${PORT}`);
    console.log(`🔑 Portal de Login Unificado: http://localhost:${PORT}/login.html`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n⚠️ El puerto ${PORT} ya está ocupado por otro proceso.`);
      console.log(`Por favor libera el puerto 3000 o cierra cualquier servidor previo que esté ejecutándose.\n`);
    } else {
      console.error(err);
    }
  });
}

// Exportar Express app para Vercel Serverless Function
module.exports = app;
