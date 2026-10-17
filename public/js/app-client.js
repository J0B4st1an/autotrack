/* AutoTrack - Protected Client App JS */

let currentVehicle = null;
let stagesData = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

function checkSession() {
  const rawUser = localStorage.getItem('autotrack_user');
  if (!rawUser) {
    window.location.href = '/login.html';
    return;
  }

  currentUser = JSON.parse(rawUser);

  // Renderizar info de usuario en la barra
  document.getElementById('user-display-name').textContent = currentUser.client_name || currentUser.username;
  document.getElementById('user-avatar').textContent = (currentUser.client_name || 'U').charAt(0).toUpperCase();

  // Si requiere cambio obligatorio de contraseña en primer ingreso
  if (currentUser.must_change_password) {
    document.getElementById('mandatory-password-modal').classList.remove('hidden');
    return;
  }

  // Cargar vehículo exclusivo del cliente
  loadClientVehicle(currentUser.vehicle_id);
}

function logout() {
  localStorage.removeItem('autotrack_user');
  localStorage.removeItem('autotrack_vehicle');
  window.location.href = '/login.html';
}

async function loadClientVehicle(vehicleId) {
  try {
    const res = await fetch(`/api/client/my-vehicle?vehicle_id=${encodeURIComponent(vehicleId)}`);
    const data = await res.json();

    if (!data.success || !data.vehicle) {
      alert("No se pudo cargar la información de tu vehículo asignado.");
      return;
    }

    currentVehicle = data.vehicle;
    stagesData = data.stages;

    renderVehicleDetails(currentVehicle, data.currentStageInfo, data.daysElapsed);
    renderTimeline(currentVehicle, stagesData);
    renderChecklist(currentVehicle.checklist);
    renderAuditHistory(currentVehicle.status_history);

  } catch (err) {
    console.error("Error al cargar vehículo:", err);
  }
}

async function handleMandatoryChangePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('old-pwd-input').value;
  const newPassword = document.getElementById('new-pwd-input').value;
  const confirmPassword = document.getElementById('confirm-pwd-input').value;
  const errorBox = document.getElementById('change-pwd-error');

  errorBox.classList.add('hidden');

  if (newPassword !== confirmPassword) {
    errorBox.textContent = "La nueva contraseña y la confirmación no coinciden.";
    errorBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        oldPassword,
        newPassword
      })
    });
    const data = await res.json();

    if (!data.success) {
      errorBox.textContent = data.message || "Error al actualizar contraseña.";
      errorBox.classList.remove('hidden');
      return;
    }

    alert("✅ ¡Contraseña actualizada exitosamente! Bienvenido a tu vehículo.");

    // Actualizar sesión local
    currentUser.must_change_password = false;
    localStorage.setItem('autotrack_user', JSON.stringify(currentUser));

    document.getElementById('mandatory-password-modal').classList.add('hidden');
    loadClientVehicle(currentUser.vehicle_id);

  } catch (err) {
    console.error("Error al cambiar clave:", err);
    errorBox.textContent = "Error de conexión al cambiar la contraseña.";
    errorBox.classList.remove('hidden');
  }
}

function renderVehicleDetails(v, currentStage, daysElapsed) {
  document.getElementById('v-type').textContent = v.vehicle_type;
  document.getElementById('v-order').textContent = v.order_code;
  document.getElementById('v-title').textContent = v.brand_model;
  document.getElementById('v-vin').textContent = v.vin;
  document.getElementById('v-color').textContent = v.color;
  document.getElementById('v-branch').textContent = v.dealership_branch;
  document.getElementById('v-advisor').textContent = v.advisor_name;

  const iconBox = document.getElementById('vehicle-icon-box');
  if (v.vehicle_type === "Motocicleta") {
    iconBox.innerHTML = '<i class="fa-solid fa-motorcycle"></i>';
    iconBox.className = "w-14 h-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-2xl flex-shrink-0";
  } else {
    iconBox.innerHTML = '<i class="fa-solid fa-car"></i>';
    iconBox.className = "w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl flex-shrink-0";
  }

  document.getElementById('current-stage-badge').textContent = v.current_stage_name;
  
  const currentStageObj = stagesData.find(s => s.index === v.current_stage_index) || { est_pct: 15 };
  const pct = currentStageObj.est_pct || 15;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-bar-fill').style.width = `${pct}%`;

  document.getElementById('days-info').textContent = `Día ${daysElapsed} de ~${v.estimated_delivery_days} días est.`;
  document.getElementById('v-est-date').textContent = formatDate(v.estimated_delivery_date);

  const cleanPhone = (v.advisor_phone || "").replace(/[^0-9]/g, '');
  const waMsg = encodeURIComponent(`Hola ${v.advisor_name}, requiero información de mi vehículo ${v.brand_model} (Pedido: ${v.order_code}).`);
  document.getElementById('whatsapp-btn').href = `https://wa.me/${cleanPhone || '573001234567'}?text=${waMsg}`;
}

function renderTimeline(v, stages) {
  const container = document.getElementById('timeline-container');
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-7 gap-4 relative';

  stages.forEach((s) => {
    const isCompleted = s.index < v.current_stage_index;
    const isActive = s.index === v.current_stage_index;

    const histMatch = v.status_history.find(h => h.stage_index === s.index);
    const histDate = histMatch ? formatDateShort(histMatch.date) : '';

    const stepNode = document.createElement('div');
    stepNode.className = `timeline-step flex md:flex-col items-center gap-3 p-3 rounded-2xl border ${
      isActive ? 'bg-blue-50/70 border-blue-200 active' : 
      isCompleted ? 'bg-emerald-50/40 border-emerald-100 completed' : 'bg-slate-50 border-slate-100 text-slate-400'
    }`;

    stepNode.innerHTML = `
      <div class="step-circle">
        ${isCompleted ? '<i class="fa-solid fa-check"></i>' : s.index}
      </div>
      <div class="md:text-center flex-1">
        <p class="text-xs font-bold ${isActive ? 'text-blue-900' : isCompleted ? 'text-emerald-900' : 'text-slate-500'}">
          ${s.name}
        </p>
        <p class="text-[10px] text-slate-400 mt-0.5">${histDate || (isActive ? 'En proceso' : 'Pendiente')}</p>
      </div>
    `;

    grid.appendChild(stepNode);
  });

  container.appendChild(grid);
}

function renderChecklist(checklist) {
  const container = document.getElementById('checklist-items');
  const tag = document.getElementById('chk-progress-tag');
  if (!container) return;
  container.innerHTML = '';

  if (!checklist || checklist.length === 0) {
    container.innerHTML = '<li class="text-xs text-slate-400 italic">No hay ítems registrados.</li>';
    return;
  }

  const completedCount = checklist.filter(c => c.completed).length;
  tag.textContent = `${completedCount}/${checklist.length} Completados`;

  checklist.forEach(item => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs';
    li.innerHTML = `
      <div class="flex items-center space-x-2.5">
        <i class="fa-solid ${item.completed ? 'fa-circle-check text-emerald-500' : 'fa-circle text-slate-300'} text-sm"></i>
        <span class="${item.completed ? 'line-through text-slate-400' : 'font-medium text-slate-700'}">${item.title}</span>
      </div>
      <span class="text-[10px] font-semibold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-500">${item.category || 'General'}</span>
    `;
    container.appendChild(li);
  });
}

function renderAuditHistory(history) {
  const container = document.getElementById('history-timeline');
  container.innerHTML = '';

  if (!history || history.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic">Sin historial registrado.</p>';
    return;
  }

  const sorted = [...history].reverse();

  sorted.forEach(item => {
    const div = document.createElement('div');
    div.className = 'relative pl-5 border-l-2 border-slate-200 pb-3 last:pb-0';
    div.innerHTML = `
      <div class="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-indigo-500"></div>
      <div class="flex justify-between items-center text-[11px] font-bold text-slate-800">
        <span>${item.stage_name}</span>
        <span class="font-normal text-slate-400">${formatDateShort(item.date)}</span>
      </div>
      <p class="text-xs text-slate-600 mt-1">${item.notes}</p>
      <p class="text-[10px] text-slate-400 mt-0.5">Por: ${item.updated_by}</p>
    `;
    container.appendChild(div);
  });
}

function simulateNotification() {
  if (!currentVehicle) return;
  const modal = document.getElementById('notification-modal');
  document.getElementById('notif-header').textContent = `🚗 ¡Hola ${currentVehicle.client_name.split(' ')[0]}!`;
  document.getElementById('notif-body').innerHTML = `Tu vehículo <b>${currentVehicle.brand_model}</b> ha sido actualizado a la etapa: <b class="text-emerald-700">${currentVehicle.current_stage_name}</b>.`;
  modal.classList.remove('hidden');
}

function closeNotificationModal() {
  document.getElementById('notification-modal').classList.add('hidden');
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
