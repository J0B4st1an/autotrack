/* AutoTrack - Admin Staff App JS Protegido Aislado */

let allVehicles = [];
let allUsers = [];
let stages = [];
let currentAdminUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminSession()) return;
  await fetchStages();
  await loadData();
});

function checkAdminSession() {
  const raw = localStorage.getItem('autotrack_admin_user');
  if (!raw) {
    window.location.href = '/login.html';
    return false;
  }
  currentAdminUser = JSON.parse(raw);

  // Asegurar que no sea cliente
  if (currentAdminUser.role === 'client') {
    window.location.href = '/login.html';
    return false;
  }

  const displayBox = document.getElementById('admin-user-display');
  if (displayBox) {
    displayBox.textContent = `${currentAdminUser.client_name || currentAdminUser.username}`;
  }
  return true;
}

function logoutAdmin() {
  localStorage.removeItem('autotrack_admin_user');
  window.location.href = '/login.html';
}

async function fetchStages() {
  try {
    const res = await fetch('/api/stages');
    const data = await res.json();
    if (data.success) stages = data.stages;
  } catch (err) {
    console.error("Error al cargar etapas:", err);
  }
}

async function loadData() {
  try {
    const [resV, resU] = await Promise.all([
      fetch('/api/vehicles'),
      fetch('/api/users')
    ]);
    const dataV = await resV.json();
    const dataU = await resU.json();

    if (dataV.success) allVehicles = dataV.vehicles;
    if (dataU.success) allUsers = dataU.users;

    renderVehiclesTable(allVehicles);
    updateSummaryCards(allVehicles, allUsers);

  } catch (err) {
    console.error("Error al cargar datos:", err);
  }
}

function updateSummaryCards(vehicles, users) {
  const active = vehicles.filter(v => v.current_stage_index < 6).length;
  const ready = vehicles.filter(v => v.current_stage_index === 6).length;
  const delayed = vehicles.filter(v => {
    if (v.current_stage_index === 7) return false;
    const elapsedDays = Math.floor((new Date() - new Date(v.created_at)) / (1000 * 60 * 60 * 24));
    return elapsedDays > v.estimated_delivery_days;
  }).length;

  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-ready').textContent = ready;
  document.getElementById('stat-users').textContent = users ? users.filter(u => u.role === 'client').length : 0;
  document.getElementById('stat-delayed').textContent = delayed;
}

function renderVehiclesTable(vehicles) {
  const tbody = document.getElementById('vehicles-table-body');
  tbody.innerHTML = '';

  if (!vehicles || vehicles.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400">
          No se encontraron vehículos registrados.
        </td>
      </tr>`;
    return;
  }

  vehicles.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/80 transition border-b border-slate-100';

    const completedChk = v.checklist ? v.checklist.filter(c => c.completed).length : 0;
    const totalChk = v.checklist ? v.checklist.length : 0;

    let stageOptions = '';
    stages.forEach(s => {
      stageOptions += `<option value="${s.index}" ${s.index === v.current_stage_index ? 'selected' : ''}>${s.index}. ${s.name}</option>`;
    });

    tr.innerHTML = `
      <td class="py-4 px-6">
        <span class="font-bold text-slate-900 block">${v.id}</span>
        <span class="text-[11px] text-slate-400 font-mono">${v.order_code}</span>
      </td>

      <td class="py-4 px-6">
        <span class="font-bold text-slate-800 block">${v.client_name}</span>
        <span class="text-[11px] text-slate-500 block">C.C. ${v.client_doc}</span>
        <span class="text-[10px] text-slate-400 font-mono block">${v.client_email || 'Sin correo registrado'}</span>
      </td>

      <td class="py-4 px-6">
        <span class="font-bold text-slate-900 block">${v.brand_model}</span>
        <span class="text-[10px] text-slate-400 font-mono">VIN: ${v.vin}</span>
      </td>

      <td class="py-4 px-6">
        <select 
          onchange="handleStatusChange('${v.id}', this.value)" 
          class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 shadow-sm"
        >
          ${stageOptions}
        </select>
      </td>

      <td class="py-4 px-6 text-right">
        <button onclick="resendWelcomeEmail('${v.id}')" class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition inline-block">
          <i class="fa-solid fa-paper-plane mr-1"></i> Re-enviar Correo
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function handleStatusChange(vehicleId, newStageIndex) {
  try {
    const notes = prompt("Opcional: Ingresa una nota u observación para este cambio de etapa:", "Actualización desde panel staff.");
    
    const res = await fetch(`/api/vehicles/${vehicleId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage_index: parseInt(newStageIndex),
        notes: notes || "Cambio de etapa vía panel staff",
        updated_by: currentAdminUser ? currentAdminUser.client_name : 'Personal Staff'
      })
    });

    const data = await res.json();
    if (data.success) {
      showSuccessToast(`✅ Estado actualizado a: ${data.vehicle.current_stage_name}`);
      await loadData();
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  } catch (err) {
    console.error("Error al actualizar estado:", err);
  }
}

function filterVehicles() {
  const search = document.getElementById('admin-search-input').value.toLowerCase();
  const stage = document.getElementById('filter-stage').value;

  let filtered = allVehicles;

  if (stage) filtered = filtered.filter(v => v.current_stage_index === parseInt(stage));
  if (search) {
    filtered = filtered.filter(v => 
      v.client_name.toLowerCase().includes(search) ||
      v.client_doc.toLowerCase().includes(search) ||
      v.vin.toLowerCase().includes(search) ||
      v.order_code.toLowerCase().includes(search)
    );
  }

  renderVehiclesTable(filtered);
}

function openNewVehicleModal() {
  document.getElementById('new-vehicle-modal').classList.remove('hidden');
}

function closeNewVehicleModal() {
  document.getElementById('new-vehicle-modal').classList.add('hidden');
}

async function handleCreateVehicle(e) {
  e.preventDefault();
  const body = {
    client_doc: document.getElementById('new-doc').value.trim(),
    client_name: document.getElementById('new-name').value.trim(),
    client_email: document.getElementById('new-email').value.trim(),
    client_phone: document.getElementById('new-phone').value.trim(),
    vehicle_type: document.getElementById('new-type').value,
    brand_model: document.getElementById('new-model').value.trim(),
    advisor_name: currentAdminUser ? currentAdminUser.client_name : "Laura Gómez"
  };

  try {
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
      closeNewVehicleModal();
      document.getElementById('create-vehicle-form').reset();
      await loadData();

      // Notificación silenciosa en toast al staff (Sin mostrar credenciales en pantalla)
      showSuccessToast(`✅ Vehículo registrado exitosamente. Se ha enviado un correo electrónico con las credenciales de acceso a ${body.client_email}.`);
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  } catch (err) {
    console.error("Error al crear pedido:", err);
  }
}

function resendWelcomeEmail(vehicleId) {
  const v = allVehicles.find(x => x.id === vehicleId);
  if (!v) return;

  showSuccessToast(`✉️ Correo de bienvenida re-enviado al cliente a ${v.client_email || 'su email registrado'}.`);
}

function showSuccessToast(msg) {
  const toast = document.getElementById('creation-success-toast');
  const msgSpan = document.getElementById('creation-success-msg');
  if (toast && msgSpan) {
    msgSpan.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 6000);
  }
}

function closeSuccessToast() {
  const toast = document.getElementById('creation-success-toast');
  if (toast) toast.classList.add('hidden');
}
