
const nodemailer = require('nodemailer');
require('dotenv').config();

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('Faltan SMTP_USER o SMTP_PASS en el archivo .env.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function buildWelcomeEmailHtml({
  client_name,
  username,
  tempPassword,
  brand_model,
  order_code,
  portal_url
}) {
  const loginUrl = portal_url || process.env.PORTAL_URL ||
    'http://localhost:3000/login.html';

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b">
    <main style="max-width:600px;margin:auto;background:#fff;padding:32px;border-radius:12px">
      <h1>🚗 AutoTrack - Almotores</h1>
      <h2>¡Hola ${escapeHtml(client_name)}!</h2>
      <p>Se ha registrado tu vehículo <strong>${escapeHtml(brand_model)}</strong>.</p>
      <p>Orden de pedido: <strong>${escapeHtml(order_code)}</strong></p>
      <p>Portal: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
      <p>Usuario: <strong>${escapeHtml(username)}</strong></p>
      <p>Contraseña temporal: <strong>${escapeHtml(tempPassword)}</strong></p>
      <p>Por seguridad, cambia tu contraseña en el primer inicio de sesión.</p>
    </main>
  </body>
  </html>`;
}

function buildStatusEmailHtml({ client_name, vehicle, portal_url }) {
  const loginUrl = portal_url || process.env.PORTAL_URL ||
    'http://localhost:3000/login.html';

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#1e293b">
    <main style="max-width:600px;margin:auto;background:#fff;padding:32px;border-radius:12px">
      <h1 style="color:#2563eb">🚗 AutoTrack - Almotores</h1>
      <h2>Hola ${escapeHtml(client_name)}</h2>
      <p>Te informamos sobre el estado actual de tu vehículo.</p>
      <p><strong>Vehículo:</strong> ${escapeHtml(vehicle.brand_model)}</p>
      <p><strong>Orden:</strong> ${escapeHtml(vehicle.order_code)}</p>
      <div style="padding:16px;background:#eff6ff;border-radius:8px">
        <p><strong>Fase actual:</strong></p>
        <h2>${escapeHtml(vehicle.current_stage_name)}</h2>
      </div>
      <p>Puedes consultar tu seguimiento en el portal:</p>
      <p><a href="${escapeHtml(loginUrl)}">Ingresar a AutoTrack</a></p>
      <p style="color:#64748b;font-size:12px">Mensaje automático de AutoTrack.</p>
    </main>
  </body>
  </html>`;
}

async function sendWelcomeEmail({ user, vehicle, portalUrl }) {
  if (!user?.email) {
    throw new Error('El usuario no tiene un correo registrado.');
  }

  const transporter = createTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `Bienvenido a AutoTrack — ${vehicle.brand_model}`,
    html: buildWelcomeEmailHtml({
      client_name: user.client_name,
      username: user.username,
      tempPassword: user.password,
      brand_model: vehicle.brand_model,
      order_code: vehicle.order_code,
      portal_url: portalUrl
    })
  });

  console.log(`[EMAIL BIENVENIDA] Enviado a ${user.email}: ${info.messageId}`);
  return { success: true, mode: 'real', messageId: info.messageId };
}

async function sendVehicleStatusEmail({ user, vehicle, portalUrl }) {
  if (!user?.email) {
    throw new Error('El cliente no tiene un correo registrado.');
  }

  if (!vehicle?.current_stage_name) {
    throw new Error('No se pudo determinar la fase actual del vehículo.');
  }

  const transporter = createTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `Actualización de tu vehículo ${vehicle.id}`,
    html: buildStatusEmailHtml({
      client_name: user.client_name,
      vehicle,
      portal_url: portalUrl
    })
  });

  console.log(`[EMAIL ESTADO] Enviado a ${user.email}: ${info.messageId}`);
  return { success: true, mode: 'real', messageId: info.messageId };
}

module.exports = {
  sendWelcomeEmail,
  sendVehicleStatusEmail,
  buildWelcomeEmailHtml,
  buildStatusEmailHtml
};
