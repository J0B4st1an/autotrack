
/* AutoTrack - Admin Staff App JS */

let allVehicles = [];
let allUsers = [];
let stages = [];
let currentAdminUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminSession()) return;
  await fetchStages();
  await loadData();
  setupAdminClientAutofill();
});

function checkAdminSession() {
  const raw = localStorage.getItem('autotrack_admin_user');

  if (!raw) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    currentAdminUser = JSON.parse(raw);
  } catch {
    localStorage.removeItem('autotrack_admin_user');
    window.location.href = '/login.html';
    return false;
  }

  if (currentAdminUser.role === 'client') {
    window.location.href = '/login.html';
    return false;
  }

  const displayBox = document.getElementById('admin-user-display');
  if (displayBox) {
    displayBox.textContent =
      currentAdminUser.client_name || currentAdminUser.username || 'Staff';
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

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'No se pudieron cargar las fases.');
    }

    stages = data.stages || [];
  } catch (err) {
    console.error('Error al cargar etapas:', err);
    alert('No se pudieron cargar las fases del sistema.');
  }
}

async function loadData() {
  try {
    const [resV, resU] = await Promise.all([
      fetch('/api/vehicles'),
      fetch('/api/users')
    ]);

    const [dataV, dataU] = await Promise.all([
      resV.json(),
      resU.json()
    ]);

    if (!resV.ok || !dataV.success) {
      throw new Error(dataV.message || 'No se pudieron cargar los vehículos.');
    }

    if (!resU.ok || !dataU.success) {
      throw new Error(dataU.message || 'No se pudieron cargar los usuarios.');
    }

    allVehicles = dataV.vehicles || [];
    allUsers = dataU.users || [];

    renderVehiclesTable(allVehicles);
    updateSummaryCards(allVehicles, allUsers);
    updateAdminClientDatalists();
  } catch (err) {
    console.error('Error al cargar datos:', err);
    alert('No se pudieron cargar los datos de AutoTrack.');
  }
}

function updateSummaryCards(vehicles, users) {
  const active = vehicles.filter(v => v.current_stage_index < 6).length;
  const ready = vehicles.filter(v => v.current_stage_index === 6).length;

  const delayed = vehicles.filter(v => {
    if (v.current_stage_index === 7) return false;

    const elapsedDays = Math.floor(
      (Date.now() - new Date(v.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return elapsedDays > Number(v.estimated_delivery_days || 0);
  }).length;

  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-ready').textContent = ready;
  document.getElementById('stat-users').textContent =
    users.filter(u => u.role === 'client').length;
  document.getElementById('stat-delayed').textContent = delayed;
}

function renderVehiclesTable(vehicles) {
  const tbody = document.getElementById('vehicles-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!vehicles.length) {
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

    let stageOptions = '';

    stages.forEach(s => {
      stageOptions += `
        <option value="${s.index}"
          ${Number(s.index) === Number(v.current_stage_index) ? 'selected' : ''}>
          ${s.index}. ${escapeHtml(s.name)}
        </option>`;
    });

    tr.innerHTML = `
      <td class="py-4 px-6">
        <span class="font-bold text-slate-900 block">${escapeHtml(v.id)}</span>
        <span class="text-[11px] text-slate-400 font-mono">${escapeHtml(v.order_code)}</span>
      </td>
      <td class="py-4 px-6">
        <span class="font-bold text-slate-800 block">${escapeHtml(v.client_name)}</span>
        <span class="text-[11px] text-slate-500 block">C.C. ${escapeHtml(v.client_doc)}</span>
        <span class="text-[10px] text-slate-400 font-mono block">${escapeHtml(v.client_email || 'Sin correo registrado')}</span>
      </td>
      <td class="py-4 px-6">
        <span class="font-bold text-slate-900 block">${escapeHtml(v.brand_model)}</span>
        <span class="text-[10px] text-slate-400 font-mono">VIN: ${escapeHtml(v.vin)}</span>
      </td>
      <td class="py-4 px-6">
        <select
          onchange="handleStatusChange('${escapeJs(v.id)}', this.value)"
          class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 shadow-sm">
          ${stageOptions}
        </select>
      </td>
      <td class="py-4 px-6 text-right">
        <button
          type="button"
          onclick="resendWelcomeEmail('${escapeJs(v.id)}', this)"
          class="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition inline-block">
          <i class="fa-solid fa-paper-plane mr-1"></i>
          Re-enviar Correo
        </button>
      </td>`;

    tbody.appendChild(tr);
  });
}

async function handleStatusChange(vehicleId, newStageIndex) {
  try {
    const notes = prompt(
      'Opcional: Ingresa una nota u observación para este cambio de etapa:',
      'Actualización desde panel staff.'
    );

    const res = await fetch(
      `/api/vehicles/${encodeURIComponent(vehicleId)}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_index: Number.parseInt(newStageIndex, 10),
          notes: notes || 'Cambio de etapa vía panel staff',
          updated_by: currentAdminUser?.client_name || 'Personal Staff'
        })
      }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'No se pudo actualizar el estado.');
    }

    showSuccessToast(`Estado actualizado a: ${data.vehicle.current_stage_name}`);
    await loadData();
  } catch (err) {
    console.error('Error al actualizar estado:', err);
    alert(`Error al actualizar el estado: ${err.message}`);
    await loadData();
  }
}

async function resendWelcomeEmail(vehicleId, button) {
  const vehicle = allVehicles.find(v => v.id === vehicleId);

  if (!vehicle) {
    alert('No se encontró el vehículo en la lista.');
    return;
  }

  if (!vehicle.client_email) {
    alert('Este vehículo no tiene un correo de cliente registrado.');
    return;
  }

  const originalHtml = button?.innerHTML;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Enviando...';
    }

    const res = await fetch(
      `/api/vehicles/${encodeURIComponent(vehicleId)}/resend-status-email`,
      { method: 'POST' }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'No se pudo enviar el correo.');
    }

    showSuccessToast(data.message || `Notificación enviada a ${vehicle.client_email}.`);
  } catch (err) {
    console.error('Error al reenviar correo de estado:', err);
    alert(`No se pudo enviar el correo: ${err.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }
}

function filterVehicles() {
  const search = (
    document.getElementById('admin-search-input')?.value || ''
  ).toLowerCase();

  const stage = document.getElementById('filter-stage')?.value || '';

  let filtered = allVehicles;

  if (stage) {
    filtered = filtered.filter(
      v => Number(v.current_stage_index) === Number.parseInt(stage, 10)
    );
  }

  if (search) {
    filtered = filtered.filter(v =>
      String(v.client_name || '').toLowerCase().includes(search) ||
      String(v.client_doc || '').toLowerCase().includes(search) ||
      String(v.vin || '').toLowerCase().includes(search) ||
      String(v.order_code || '').toLowerCase().includes(search)
    );
  }

  renderVehiclesTable(filtered);
}

// ===== AUTOCOMPLETADO INTELIGENTE DE CLIENTES =====
function getKnownClients() {
  const map = new Map();
  (allVehicles || []).forEach(v => {
    const doc = String(v.client_doc || '').trim();
    if (doc && !map.has(doc)) {
      map.set(doc, {
        doc,
        name: String(v.client_name || '').trim(),
        email: String(v.client_email || '').trim(),
        phone: String(v.client_phone || '').trim()
      });
    }
  });
  (allUsers || []).forEach(u => {
    const doc = String(u.client_doc || '').trim();
    if (doc && !map.has(doc)) {
      map.set(doc, {
        doc,
        name: String(u.client_name || u.username || '').trim(),
        email: String(u.email || '').trim(),
        phone: ''
      });
    }
  });
  return Array.from(map.values());
}

function updateAdminClientDatalists() {
  const clients = getKnownClients();
  const docList = document.getElementById('admin-clients-doc-list');
  const nameList = document.getElementById('admin-clients-name-list');

  if (docList) {
    docList.innerHTML = clients
      .map(c => `<option value="${escapeHtml(c.doc)}">${escapeHtml(c.name)}</option>`)
      .join('');
  }
  if (nameList) {
    nameList.innerHTML = clients
      .map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.doc)}</option>`)
      .join('');
  }
}

function setupAdminClientAutofill() {
  const docInput = document.getElementById('new-doc');
  const nameInput = document.getElementById('new-name');
  if (!docInput || !nameInput) return;

  const handleMatch = (query, isDoc = true) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q || q.length < 3) return;

    const clients = getKnownClients();
    const found = clients.find(c =>
      isDoc ? c.doc.toLowerCase() === q : c.name.toLowerCase() === q
    );

    if (found) {
      document.getElementById('new-doc').value = found.doc;
      document.getElementById('new-name').value = found.name;
      if (found.email) document.getElementById('new-email').value = found.email;
      if (found.phone) document.getElementById('new-phone').value = found.phone;

      const infoBox = document.getElementById('new-client-autofill-info');
      const infoText = document.getElementById('new-client-autofill-text');
      if (infoBox && infoText) {
        infoText.textContent = `Cliente existente vinculado: ${found.name} (${found.doc})`;
        infoBox.classList.remove('hidden');
      }
    }
  };

  docInput.addEventListener('input', (e) => handleMatch(e.target.value, true));
  docInput.addEventListener('change', (e) => handleMatch(e.target.value, true));
  nameInput.addEventListener('change', (e) => handleMatch(e.target.value, false));
}

function clearAdminClientAutofill() {
  document.getElementById('new-doc').value = '';
  document.getElementById('new-name').value = '';
  document.getElementById('new-email').value = '';
  document.getElementById('new-phone').value = '';
  document.getElementById('new-client-autofill-info')?.classList.add('hidden');
  document.getElementById('new-doc').focus();
}

function openNewVehicleModal() {
  try {
    updateAdminClientDatalists();
  } catch (err) {
    console.warn('Error al actualizar lista de clientes:', err);
  }
  document.getElementById('new-client-autofill-info')?.classList.add('hidden');
  const modal = document.getElementById('new-vehicle-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function closeNewVehicleModal() {
  const modal = document.getElementById('new-vehicle-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
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
    advisor_name: currentAdminUser?.client_name || 'Laura Gómez'
  };

  try {
    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'No se pudo registrar el vehículo.');
    }

    closeNewVehicleModal();
    document.getElementById('create-vehicle-form')?.reset();
    await loadData();

    showSuccessToast(
      `Vehículo registrado. Verifica el resultado del envío de correo en el servidor.`
    );
  } catch (err) {
    console.error('Error al crear pedido:', err);
    alert(`No se pudo registrar el vehículo: ${err.message}`);
  }
}

function showSuccessToast(msg) {
  const toast = document.getElementById('creation-success-toast');
  const msgSpan = document.getElementById('creation-success-msg');

  if (toast && msgSpan) {
    msgSpan.textContent = msg;
    toast.classList.remove('hidden');

    setTimeout(() => toast.classList.add('hidden'), 6000);
  } else {
    alert(msg);
  }
}

function closeSuccessToast() {
  document.getElementById('creation-success-toast')?.classList.add('hidden');
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

function escapeJs(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '');
}
