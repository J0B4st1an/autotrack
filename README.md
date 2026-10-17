# AutoTrack — Sistema de Información para Entrega de Vehículos Nuevos

**AutoTrack** es una solución web centralizada de seguimiento en tiempo real del proceso de alistamiento y entrega de vehículos nuevos en concesionarios. El proyecto resuelve la falta de visibilidad del cliente durante los tiempos de espera (8 a 60 días para automóviles; 3 a 30 días para motocicletas) y elimina la sobrecarga operacional de llamadas constantes a los asesores comerciales.

---

## 🎨 Enfoque y Justificación para la Clase de Diseño de Experiencias (UX)

Este proyecto fue estructurado aplicando metodologías de **Diseño Centrado en el Usuario (UCD)** y los principios heurísticos de Jakob Nielsen:

### 1. Arquetipos de Usuario y Puntos de Dolor Resueltos
* **Comprador / Cliente Final**:
  * *Problema*: Ansiedad y desinformación.
  * *Solución UX*: Portal público **sin registro obligatorio ni contraseñas**. Búsqueda directa por Cédula, VIN o Código de Pedido. Timeline visual progresivo en 7 etapas, contador de días transcurridos vs estimados, checklist transparente de tareas y botón de contacto a WhatsApp de 1 clic.
* **Personal Operativo / Alistamiento y Logística**:
  * *Problema*: Resistencia al uso de software complejo.
  * *Solución UX*: Panel responsivo con actualización de etapa en **1 solo clic**, checkboxes interactivos de checklist y estados con código de colores claro.
* **Asesores Comerciales**:
  * *Problema*: Interrupciones telefónicas permanentes.
  * *Solución UX*: Registro rápido de nuevos pedidos y generación automática de links de seguimiento para enviar al cliente por WhatsApp.

### 2. Principios Heurísticos Aplicados
* **Visibilidad del Estado del Sistema (#1)**: Timeline animado con indicador de porcentaje del proceso (15% a 100%), fecha estimada de entrega y hito activo en tiempo real.
* **Relación entre el Sistema y el Mundo Real (#2)**: Uso de terminología clara en español latinoamericano (ej: *"Lavado y detallado de entrega"*, *"Expedición de SOAT"*).
* **Prevención de Errores (#5)**: Búsqueda flexible con soporte multivariable (Cédula, VIN o Número de Pedido) y botones de prueba rápida para evitar entradas vacías.
* **Diseño Responsivo (Mobile-First)**: El 85% de las consultas se realizarán desde teléfonos móviles; la interfaz adapta el timeline de horizontal (pantalla grande) a vertical ordenado (móvil).

---

## 🏗️ Arquitectura Técnica

```
vehicle-tracking-system/
├── package.json            # Configuración de dependencias y scripts Node
├── server.js               # Servidor Express REST API & Servidor Estático
├── test-api.js             # Script de verificación automatizada
├── render.yaml             # Configuración Infrastructure-as-Code para Render
├── database/
│   ├── db.js               # Persistencia de datos (SQLite / JSON file db)
│   └── seed.js             # Semilla de datos de prueba realistas
├── public/
│   ├── index.html          # Portal público para el Cliente (Timeline & Consulta)
│   ├── admin.html          # Panel operativo para Asesores, Logística y Trámites
│   ├── metrics.html        # Dashboard de métricas UX y tiempos de entrega
│   ├── css/
│   │   └── styles.css      # Estilos personalizados y animaciones UX
│   └── js/
│       ├── app-client.js   # Lógica cliente y simulación de notificaciones
│       ├── app-admin.js    # Lógica panel staff y actualización 1-click
│       └── app-metrics.js  # Lógica de dashboard y distribución por etapas
└── README.md
```

---

## 🚦 Flujo de 7 Estados del Vehículo

1. **Vehículo en Proceso de Asignación** (Vínculo VIN/Chasis y pedido).
2. **Vehículo en Transporte** (En tránsito hacia el concesionario).
3. **Vehículo Recibido** (Inspección inicial física y documental).
4. **En Alistamiento** (Mecánica rápida, accesorios, lavado/detallado).
5. **Documentación en Proceso** (Matrícula, SOAT, placas, seguro).
6. **Listo para Entrega** (Agendamiento de cita de entrega).
7. **Entregado** (Firma de acta de entrega y evaluación de satisfacción).

---

## 🚀 Ejecución Local

1. Navegar a la carpeta del proyecto:
   ```bash
   cd vehicle-tracking-system
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Ejecutar verificación de pruebas de API:
   ```bash
   npm test
   ```

4. Iniciar el servidor:
   ```bash
   npm start
   ```

5. Abrir las interfaces en el navegador:
   * **Portal del Cliente**: [http://localhost:3000](http://localhost:3000)
   * **Panel Operativo Staff**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)
   * **Dashboard de Métricas**: [http://localhost:3000/metrics.html](http://localhost:3000/metrics.html)

---

## ☁️ Guía de Despliegue en Render (Render Web Services)

Subir la aplicación a **Render** es un proceso sencillo de 3 pasos:

### Opción A: Despliegue Directo desde GitHub (Recomendado)
1. Sube esta carpeta a un repositorio de GitHub (público o privado).
2. Inicia sesión en [Render.com](https://dashboard.render.com).
3. Haz clic en **New +** -> **Web Service**.
4. Conecta tu repositorio de GitHub.
5. Render detectará automáticamente el archivo `render.yaml` y configurará:
   * **Build Command**: `npm install`
   * **Start Command**: `node server.js`
   * **Environment**: Node
6. Haz clic en **Create Web Service**. ¡En 2 minutos tu aplicación estará pública en la URL de Render (`https://autotrack-xxxx.onrender.com`)!

---

## 🧪 Datos de Prueba Incluidos (Para evaluación de la clase)

Puedes probar las búsquedas inmediatas en el portal del cliente con estos datos:

| Tipo | Cédula | VIN / Chasis | Pedido | Estado Actual |
|---|---|---|---|---|
| **Automóvil** | `1098765432` | `9BWCA111000123456` | `PED-2024-8891` | En Alistamiento |
| **Motocicleta** | `52431980` | `93YMT07X998877665` | `PED-2024-9042` | Listo para Entrega |
| **Automóvil** | `80123456` | `8AGBT552000445566` | `PED-2024-7710` | Vehículo en Transporte |
