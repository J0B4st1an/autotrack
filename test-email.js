const { sendWelcomeEmail } = require('./services/emailService');

async function test() {
  console.log("🧪 Probando módulo de envío de correo HTML...");
  
  const mockUser = {
    client_name: "Carlos Eduardo Mendoza",
    username: "carlos.mendoza",
    password: "Temp9876",
    email: "carlos.mendoza@email.com"
  };

  const mockVehicle = {
    brand_model: "Mazda CX-30 Grand Touring 2024",
    order_code: "PED-2024-8891"
  };

  const result = await sendWelcomeEmail({
    user: mockUser,
    vehicle: mockVehicle,
    portalUrl: "http://localhost:3000/login.html"
  });

  console.log("\n📌 Resultado de la prueba:", result);
}

test();
