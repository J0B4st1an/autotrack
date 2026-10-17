const http = require('http');

console.log("🧪 Iniciando verificación automatizada de endpoints de API para AutoTrack...");

const db = require('./database/db');

// Test 1: Verificar Base de Datos
const vehicles = db.getAllVehicles();
console.log(`✅ TEST 1: Base de datos leída correctamente (${vehicles.length} vehículos encontrados).`);

// Test 2: Búsqueda por Cédula
const resultDoc = db.searchVehicle("1098765432");
if (resultDoc && resultDoc.client_name === "Carlos Eduardo Mendoza") {
  console.log(`✅ TEST 2: Búsqueda por Cédula '1098765432' exitosa (${resultDoc.brand_model}).`);
} else {
  console.error("❌ TEST 2 FALLÓ: No se encontró vehículo por cédula 1098765432.");
  process.exit(1);
}

// Test 3: Búsqueda por VIN
const resultVin = db.searchVehicle("93YMT07X998877665");
if (resultVin && resultVin.vehicle_type === "Motocicleta") {
  console.log(`✅ TEST 3: Búsqueda por VIN '93YMT07X998877665' exitosa (${resultVin.brand_model}).`);
} else {
  console.error("❌ TEST 3 FALLÓ: No se encontró vehículo por VIN.");
  process.exit(1);
}

// Test 4: Avance de estado
const updated = db.updateStatus("VEH-1003", 3, "Llegada comprobada en patio norte", "Tester");
if (updated && updated.current_stage_index === 3) {
  console.log(`✅ TEST 4: Cambio de estado a 'Vehículo Recibido' exitoso para VEH-1003.`);
} else {
  console.error("❌ TEST 4 FALLÓ: Error al actualizar estado.");
  process.exit(1);
}

// Test 5: Verificación de Etapas oficiales
const stages = db.getStages();
if (stages.length === 7) {
  console.log(`✅ TEST 5: 7 etapas del flujo del vehículo verificadas correctamente.`);
} else {
  console.error("❌ TEST 5 FALLÓ: Número de etapas no coincide con 7.");
  process.exit(1);
}

console.log("\n🎉 ¡TODOS LOS TESTS DE VERIFICACIÓN PASARON SATISFACTORIAMENTE!");
