
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

  const vehicleSection = brand_model ? `
      <div style="background:#eff6ff;padding:16px;border-radius:10px;margin:16px 0;border:1px solid #bfdbfe">
        <p style="margin:0 0 6px 0;font-size:12px;color:#1e40af;font-weight:700;text-transform:uppercase">🚗 Vehículo Asociado</p>
        <p style="margin:0;font-size:16px;font-weight:800;color:#1e3a8a">${escapeHtml(brand_model)}</p>
        ${order_code ? `<p style="margin:4px 0 0 0;font-size:12px;color:#3b82f6;font-family:monospace">Orden: <strong>${escapeHtml(order_code)}</strong></p>` : ''}
      </div>` : `
      <div style="background:#f8fafc;padding:14px;border-radius:10px;margin:16px 0;border:1px solid #e2e8f0">
        <p style="margin:0;font-size:14px;color:#475569">Tu cuenta de acceso a la plataforma <strong>AutoTrack</strong> ha sido creada exitosamente.</p>
      </div>`;

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a AutoTrack</title>
  </head>
  <body style="margin:0;padding:24px;background:#091426;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
    <main style="max-width:580px;margin:auto;background:#ffffff;padding:36px 32px;border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,0.25)">
      <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid #e2e8f0;margin-bottom:24px">
        <h1 style="margin:0;font-size:24px;color:#091426;font-weight:900;letter-spacing:-0.5px">🚗 auto<span style="color:#2563eb">track</span></h1>
        <p style="margin:4px 0 0 0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:1px">Sistema de Seguimiento y Alistamiento de Vehículos</p>
      </div>

      <h2 style="font-size:18px;color:#0f172a;margin-top:0">¡Hola, ${escapeHtml(client_name || username)}!</h2>
      <p style="font-size:14px;color:#475569;line-height:1.5">Te damos la bienvenida a <strong>AutoTrack</strong>. A continuación encontrarás tus credenciales personales para acceder a la plataforma:</p>

      ${vehicleSection}

      <div style="background:#f1f5f9;padding:18px;border-radius:12px;border:1px solid #cbd5e1;margin:20px 0">
        <p style="margin:0 0 10px 0;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.5px">🔑 Tus Credenciales de Acceso</p>
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#64748b;font-weight:600;width:130px">Portal Web:</td>
            <td style="padding:4px 0"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb;text-decoration:none;font-weight:700">${escapeHtml(loginUrl)}</a></td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;font-weight:600">Usuario / Correo:</td>
            <td style="padding:4px 0;font-weight:800;color:#0f172a;font-family:monospace">${escapeHtml(username)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#64748b;font-weight:600">Contraseña:</td>
            <td style="padding:4px 0;font-weight:800;color:#d97706;font-family:monospace">${escapeHtml(tempPassword)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:28px 0">
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:14px 32px;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(37,99,235,0.35)">
          Ingresar a la Plataforma →
        </a>
      </div>

      <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 14px;font-size:12px;color:#92400e;line-height:1.4">
        <strong>⚠️ Recomendación de seguridad:</strong> Si se te asignó una contraseña temporal, el sistema te solicitará cambiarla en tu primer inicio de sesión.
      </div>

      <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:28px;border-top:1px solid #f1f5f9;padding-top:16px">
        Este es un mensaje automático generado por AutoTrack. Por favor, no respondas a este correo.
      </p>
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
      <h1 style="color:#2563eb">🚗 AutoTrack</h1>
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

  const subject = vehicle?.brand_model
    ? `🚗 Bienvenido a AutoTrack — ${vehicle.brand_model}`
    : `🚗 Bienvenido a AutoTrack — Tus Credenciales de Acceso`;

  const html = buildWelcomeEmailHtml({
    client_name: user.client_name,
    username: user.username,
    tempPassword: user.password || user.tempPassword || 'AutoTrack2024*',
    brand_model: vehicle?.brand_model,
    order_code: vehicle?.order_code,
    portal_url: portalUrl
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject,
    html
  };

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL CREDENCIALES] Enviado con éxito a ${user.email} (ID: ${info.messageId})`);
    return { success: true, mode: 'real', messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL ERROR] Falló envío SMTP a ${user.email}:`, err.message);
    // Modo simulación de respaldo en consola para garantizar que las credenciales nunca se pierdan
    console.log(`\n📧 [SIMULACIÓN CREDENCIALES] Para: ${user.client_name || user.username} <${user.email}>`);
    console.log(`👉 Usuario: ${user.username} | Clave: ${user.password || user.tempPassword || 'AutoTrack2024*'}`);
    console.log(`👉 Portal: ${portalUrl || process.env.PORTAL_URL || 'http://localhost:3000/login.html'}\n`);
    return { success: false, mode: 'simulated_fallback', error: err.message };
  }
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
