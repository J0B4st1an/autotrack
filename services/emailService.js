const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuración del transportador Nodemailer
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass }
    });
  }

  // Fallback si no hay credenciales SMTP: retorna null para usar simulación / Ethereal
  return null;
}

/**
 * Plantilla de correo HTML elegante y responsive para AutoTrack
 */
function buildWelcomeEmailHtml({ client_name, username, tempPassword, brand_model, order_code, portal_url }) {
  const loginUrl = portal_url || 'http://localhost:3000/login.html';
  
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a AutoTrack</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
      <tr>
        <td align="center" style="padding: 30px 15px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
            
            <!-- Header Header Bar -->
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 40px; text-align: center;">
                <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                  🚗 AutoTrack <span style="color: #38bdf8; font-size: 14px; font-weight: 600; text-transform: uppercase; background: rgba(56,189,248,0.15); padding: 4px 10px; border-radius: 20px; margin-left: 8px;">Almotores</span>
                </div>
                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Sistema de Seguimiento de Entrega de Vehículos</p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 40px 40px 30px 40px;">
                <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">¡Hola ${client_name}! 👋</h1>
                
                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                  ¡Felicitaciones por la adquisición de tu nuevo <strong>${brand_model}</strong>! Tu orden de pedido <strong>#${order_code}</strong> ha sido creada exitosamente en nuestro concesionario.
                </p>

                <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                  A través de nuestro portal web podrás realizar el seguimiento en tiempo real de las 7 etapas de alistamiento, matrícula y entrega de tu vehículo.
                </p>

                <!-- Credentials Box -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 10px; padding: 20px; margin: 0 0 28px 0;">
                  <div style="font-size: 13px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                    🔑 Tus Credenciales de Acceso
                  </div>
                  <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 14px; color: #334155;">
                    <tr>
                      <td width="130" style="font-weight: 600; color: #64748b;">Portal Web:</td>
                      <td><a href="${loginUrl}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${loginUrl}</a></td>
                    </tr>
                    <tr>
                      <td style="font-weight: 600; color: #64748b;">Usuario:</td>
                      <td style="font-weight: 700; color: #0f172a; font-family: monospace; font-size: 15px;">${username}</td>
                    </tr>
                    <tr>
                      <td style="font-weight: 600; color: #64748b;">Contraseña Temporal:</td>
                      <td style="font-weight: 700; color: #d97706; font-family: monospace; font-size: 15px;">${tempPassword}</td>
                    </tr>
                  </table>
                </div>

                <!-- Action Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.25);">
                    Ingresar al Portal AutoTrack →
                  </a>
                </div>

                <!-- Important Note -->
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px 16px; margin-top: 24px; font-size: 13px; color: #b45309; line-height: 1.5;">
                  <strong>⚠️ Importante:</strong> Por tu seguridad, en tu primer inicio de sesión el sistema te solicitará cambiar tu contraseña temporal por una clave personal y confidencial.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #64748b;">Almotores S.A.S. — Sistema AutoTrack</p>
                <p style="margin: 0;">Este es un mensaje automático. Por favor no respondas a este correo.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

/**
 * Función principal para enviar correos de bienvenida
 */
async function sendWelcomeEmail({ user, vehicle, portalUrl }) {
  const transporter = createTransporter();
  const mailOptions = {
    from: process.env.SMTP_FROM || '"AutoTrack Almotores" <notificaciones@autotrack.com>',
    to: user.email,
    subject: `🚗 Bienvenido a AutoTrack — Seguimiento de tu ${vehicle.brand_model}`,
    html: buildWelcomeEmailHtml({
      client_name: user.client_name,
      username: user.username,
      tempPassword: user.password,
      brand_model: vehicle.brand_model,
      order_code: vehicle.order_code,
      portal_url: portalUrl
    })
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`\n✅ [EMAIL ENVIADO REAL] Correo enviado exitosamente a: ${user.email} (MessageID: ${info.messageId})`);
      return { success: true, mode: 'real', messageId: info.messageId };
    } catch (err) {
      console.error(`\n❌ [EMAIL ERROR] Error al enviar correo SMTP real a ${user.email}:`, err.message);
      // Continuar con simulación de respaldo si falla SMTP
    }
  }

  // Si no hay configuración SMTP o falló, usar simulación mejorada con enlace Ethereal/Consola
  console.log(`\n📧 ================= NOTIFICACIÓN POR CORREO (SIMULACIÓN / MOCK) =================`);
  console.log(`De: ${mailOptions.from}`);
  console.log(`Para: ${user.client_name} <${user.email}>`);
  console.log(`Asunto: ${mailOptions.subject}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Hola ${user.client_name},`);
  console.log(`Se ha generado tu orden (${vehicle.order_code}) para tu vehículo ${vehicle.brand_model}.`);
  console.log(`👉 Portal: ${portalUrl || 'http://localhost:3000/login.html'}`);
  console.log(`👤 Usuario: ${user.username}`);
  console.log(`🔑 Contraseña Temporal: ${user.password}`);
  console.log(`=================================================================================\n`);

  return { success: true, mode: 'simulated' };
}

module.exports = {
  sendWelcomeEmail,
  buildWelcomeEmailHtml
};
