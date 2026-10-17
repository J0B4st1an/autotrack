const db = require('./db');

console.log("🌱 Reiniciando y sembrando base de datos AutoTrack...");
const seeded = db.resetSeed();
console.log(`✅ Base de datos sembrada con éxito con ${seeded.length} vehículos de prueba.`);
console.log("Vehículos de prueba disponibles:");
seeded.forEach(v => {
  console.log(`  • ID: ${v.id} | Pedido: ${v.order_code} | Cédula: ${v.client_doc} | VIN: ${v.vin} | Modelo: ${v.brand_model} (${v.current_stage_name})`);
});
