/* AutoTrack - Gestión de Catálogo y Usuarios (Staff) */

let allVehicles = [];
let allUsers = [];
let stages = [];
let currentAdminUser = null;
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminSession()) return;
  await fetchStages();
  await loadManagementData();
  setupGestionClientAutofill();
});

function checkAdminSession() {
  const raw = localStorage.getItem('autotrack_admin_user');
  if (!raw) {
    window.location.href = '/login.html';
    return false;
  }
  currentAdminUser = JSON.parse(raw);

  if (currentAdminUser.role === 'client') {
    window.location.href = '/login.html';
    return false;
  }

  const displayBox = document.getElementById('admin-user-display');
  if (displayBox) {
    displayBox.textContent = currentAdminUser.client_name || currentAdminUser.username;
  }
  return true;
}

function logoutAdmin() {
  localStorage.removeItem('autotrack_admin_user');
  window.location.href = '/login.html';
}

function switchTab(tab) {
  const secVehicles = document.getElementById('section-vehicles');
  const secUsers = document.getElementById('section-users');
  const btnVehicles = document.getElementById('tab-btn-vehicles');
  const btnUsers = document.getElementById('tab-btn-users');

  if (tab === 'vehicles') {
    secVehicles.classList.remove('hidden');
    secUsers.classList.add('hidden');
    btnVehicles.className = "px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-indigo-600 text-white shadow-sm";
    btnUsers.className = "px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200";
  } else {
    secVehicles.classList.add('hidden');
    secUsers.classList.remove('hidden');
    btnVehicles.className = "px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200";
    btnUsers.className = "px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-indigo-600 text-white shadow-sm";
  }
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

async function loadManagementData() {
  try {
    const [resV, resU] = await Promise.all([
      fetch('/api/vehicles'),
      fetch('/api/users')
    ]);

    const dataV = await resV.json();
    const dataU = await resU.json();

    if (dataV.success) allVehicles = dataV.vehicles || [];
    if (dataU.success) allUsers = dataU.users || [];

    renderVehiclesGrid(allVehicles);
    renderUsersTable(allUsers);
    updateBadgesAndStats();
    populateVehicleSelect();
    updateGestionClientDatalists();

  } catch (err) {
    console.error("Error al cargar datos de gestión:", err);
  }
}

function updateBadgesAndStats() {
  document.getElementById('badge-total-vehicles').textContent = allVehicles.length;
  document.getElementById('badge-total-users').textContent = allUsers.length;

  document.getElementById('stat-users-total').textContent = allUsers.length;
  document.getElementById('stat-users-staff').textContent = allUsers.filter(u => u.role !== 'client').length;
  document.getElementById('stat-users-clients').textContent = allUsers.filter(u => u.role === 'client').length;
}

function populateVehicleSelect() {
  const sel = document.getElementById('usr-vehicle-id');
  if (!sel) return;
  sel.innerHTML = '<option value="">Ninguno</option>';
  allVehicles.forEach(v => {
    sel.innerHTML += `<option value="${v.id}">${v.brand_model} (${v.id} - ${v.client_name})</option>`;
  });
}

/* ========================================================= */
/* GESTIÓN DE VEHÍCULOS                                      */
/* ========================================================= */

function renderVehiclesGrid(vehicles) {
  const container = document.getElementById('vehicles-cards-grid');
  container.innerHTML = '';

  if (!vehicles || vehicles.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200 p-8">
        <i class="fa-solid fa-car text-slate-300 text-4xl mb-3"></i>
        <p class="text-sm font-bold text-slate-700">No se encontraron vehículos.</p>
        <p class="text-xs text-slate-400 mt-1">Registra uno nuevo haciendo clic en "+ Nuevo Vehículo".</p>
      </div>`;
    return;
  }

  vehicles.forEach(v => {
    const defaultImg = v.vehicle_type === 'Motocicleta' ? '/img/moto-default.svg' : 
                      (v.vehicle_type === 'Camioneta' ? '/img/suv-default.svg' : '/img/car-default.svg');
    const imgSrc = v.image_url || defaultImg;

    const card = document.createElement('div');
    card.className = "cardd rounded-3xl border border-white/10 shadow-xl overflow-hidden flex flex-col hover:border-blue-400/30 transition group";

    card.innerHTML = `
      <!-- Foto del Vehículo -->
      <div style="position: relative; height: 180px; width: 100%; background: #081020; overflow: hidden; border-radius: 1.25rem 1.25rem 0 0; display: block;">
        <img src="${imgSrc}" alt="${escapeHtml(v.brand_model)}" style="width: 100%; height: 100%; object-fit: contain; padding: 12px; display: block;" onerror="this.src='${defaultImg}'">
        
        <!-- Badges Superiores (Esquina Superior Izquierda) -->
        <div style="position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; max-width: 65%;">
          <span style="padding: 3px 8px; background: rgba(0,0,0,0.85); color: #fff; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); text-transform: uppercase;">
            ${escapeHtml(v.vehicle_type || 'Automóvil')}
          </span>
          <span style="padding: 3px 8px; background: rgba(37,99,235,0.9); color: #fff; font-size: 10px; font-family: monospace; font-weight: 700; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ${escapeHtml(v.order_code)}
          </span>
        </div>

        <!-- Badge de Etapa (Esquina Inferior Derecha - Separado totalmente) -->
        <div style="position: absolute; bottom: 10px; right: 10px; z-index: 10; max-width: 80%;">
          <span style="padding: 4px 10px; background: rgba(5,150,105,0.92); color: #fff; font-size: 10px; font-weight: 700; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-circle-check" style="font-size: 9px;"></i>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(v.current_stage_name)}</span>
          </span>
        </div>
      </div>

      <!-- Contenido de la Tarjeta -->
      <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3.5">
        <div>
          <h3 class="text-sm sm:text-base font-extrabold text-white leading-snug">${escapeHtml(v.brand_model)}</h3>
          <p class="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
            <span>Color: <strong class="text-slate-100">${escapeHtml(v.color || 'Blanco')}</strong></span>
            <span>•</span>
            <span class="font-mono text-[11px] text-slate-300">VIN: ${escapeHtml(v.vin)}</span>
          </p>
        </div>

        <!-- Ficha del Cliente -->
        <div class="bg-white/5 p-3 rounded-2xl border border-white/10 text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente Asignado</span>
            <span class="text-[10px] font-mono text-blue-300 font-bold">C.C. ${escapeHtml(v.client_doc)}</span>
          </div>
          <p class="font-bold text-slate-100">${escapeHtml(v.client_name)}</p>
          <p class="text-[11px] text-slate-400 font-mono">${escapeHtml(v.client_email || 'Sin correo')}</p>
        </div>

        <!-- Metadatos de Entrega -->
        <div class="text-[11px] text-slate-300 space-y-1 border-t border-white/10 pt-2.5">
          <p class="flex items-center justify-between">
            <span class="text-slate-400">Asesor:</span>
            <strong class="text-slate-200">${escapeHtml(v.advisor_name || 'Laura Gómez')}</strong>
          </p>
          <p class="flex items-center justify-between">
            <span class="text-slate-400">Sede:</span>
            <span class="text-slate-200">${escapeHtml(v.dealership_branch || 'Sede Principal')}</span>
          </p>
        </div>

        <!-- Acciones -->
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <a href="/admin.html" class="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <span>Ver en Línea de Tiempo</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </a>

          <button onclick="handleDeleteVehicle('${escapeHtml(v.id)}')" class="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition" title="Eliminar vehículo">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function filterVehiclesList() {
  const search = (document.getElementById('search-vehicle-input').value || '').toLowerCase().trim();
  const type = document.getElementById('filter-vehicle-type').value;

  let filtered = allVehicles;
  if (type) {
    filtered = filtered.filter(v => (v.vehicle_type || '').toLowerCase() === type.toLowerCase());
  }
  if (search) {
    filtered = filtered.filter(v => 
      (v.brand_model || '').toLowerCase().includes(search) ||
      (v.client_name || '').toLowerCase().includes(search) ||
      (v.client_doc || '').toLowerCase().includes(search) ||
      (v.vin || '').toLowerCase().includes(search) ||
      (v.order_code || '').toLowerCase().includes(search)
    );
  }

  renderVehiclesGrid(filtered);
}

// ===== AUTOCOMPLETADO INTELIGENTE DE CLIENTES (GESTIÓN) =====
function getKnownClientsGestion() {
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

function updateGestionClientDatalists() {
  const clients = getKnownClientsGestion();
  const docList = document.getElementById('gestion-clients-doc-list');
  const nameList = document.getElementById('gestion-clients-name-list');

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

function setupGestionClientAutofill() {
  const docInput = document.getElementById('veh-client-doc');
  const nameInput = document.getElementById('veh-client-name');
  if (!docInput || !nameInput) return;

  const handleMatch = (query, isDoc = true) => {
    const q = String(query || '').trim().toLowerCase();
    if (!q || q.length < 3) return;

    const clients = getKnownClientsGestion();
    const found = clients.find(c =>
      isDoc ? c.doc.toLowerCase() === q : c.name.toLowerCase() === q
    );

    if (found) {
      document.getElementById('veh-client-doc').value = found.doc;
      document.getElementById('veh-client-name').value = found.name;
      if (found.email) document.getElementById('veh-client-email').value = found.email;
      if (found.phone) document.getElementById('veh-client-phone').value = found.phone;

      const infoBox = document.getElementById('gestion-client-autofill-info');
      const infoText = document.getElementById('gestion-client-autofill-text');
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

function clearGestionClientAutofill() {
  document.getElementById('veh-client-doc').value = '';
  document.getElementById('veh-client-name').value = '';
  document.getElementById('veh-client-email').value = '';
  document.getElementById('veh-client-phone').value = '';
  document.getElementById('gestion-client-autofill-info')?.classList.add('hidden');
  document.getElementById('veh-client-doc').focus();
}

function openCreateVehicleModal() {
  selectedImageFile = null;
  document.getElementById('form-create-vehicle')?.reset();
  updateDefaultImage('Automóvil');
  const badge = document.getElementById('preview-badge');
  if (badge) badge.textContent = 'Por defecto';
  document.getElementById('gestion-client-autofill-info')?.classList.add('hidden');
  try {
    updateGestionClientDatalists();
  } catch (err) {
    console.warn('Error al actualizar lista de clientes gestión:', err);
  }
  const m = document.getElementById('modal-vehicle');
  if (m) {
    m.classList.remove('hidden');
    m.style.display = 'flex';
  }
}

function closeCreateVehicleModal() {
  const m = document.getElementById('modal-vehicle');
  if (m) {
    m.classList.add('hidden');
    m.style.display = 'none';
  }
}

function updateDefaultImage(type) {
  if (selectedImageFile) return;
  const preview = document.getElementById('img-preview');
  if (type === 'Motocicleta') preview.src = '/img/moto-default.svg';
  else if (type === 'Camioneta') preview.src = '/img/suv-default.svg';
  else preview.src = '/img/car-default.svg';
}

function handleImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById('img-preview').src = event.target.result;
    document.getElementById('preview-badge').textContent = file.name.substring(0, 16) + '...';
  };
  reader.readAsDataURL(file);
}

async function handleSaveVehicle(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-vehicle');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Guardando...</span>';

  try {
    let uploadedImageUrl = null;

    // 1. Si el usuario seleccionó un archivo de imagen, subirlo a /public/img
    if (selectedImageFile) {
      const formData = new FormData();
      formData.append('image', selectedImageFile);

      const uploadRes = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();

      if (uploadData.success && uploadData.imageUrl) {
        uploadedImageUrl = uploadData.imageUrl;
      } else {
        console.warn("No se pudo subir la imagen, se usará imagen por defecto:", uploadData.message);
      }
    }

    // 2. Crear vehículo en la base de datos
    const body = {
      brand_model: document.getElementById('veh-model').value.trim(),
      vehicle_type: document.getElementById('veh-type').value,
      color: document.getElementById('veh-color').value.trim() || 'Blanco Glaciar',
      vin: document.getElementById('veh-vin').value.trim() || undefined,
      order_code: document.getElementById('veh-order').value.trim() || undefined,
      dealership_branch: document.getElementById('veh-branch').value.trim() || 'Sede Principal Norte',
      advisor_name: document.getElementById('veh-advisor').value.trim() || 'Laura Gómez',
      client_name: document.getElementById('veh-client-name').value.trim(),
      client_doc: document.getElementById('veh-client-doc').value.trim(),
      client_email: document.getElementById('veh-client-email').value.trim(),
      client_phone: document.getElementById('veh-client-phone').value.trim(),
      image_url: uploadedImageUrl || undefined
    };

    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.success) {
      closeCreateVehicleModal();
      showToast(`✅ Vehículo "${body.brand_model}" registrado y foto guardada en /public/img.`);
      await loadManagementData();
    } else {
      alert(`❌ Error al guardar vehículo: ${data.message}`);
    }

  } catch (err) {
    console.error("Error al registrar vehículo:", err);
    alert("Error de conexión al guardar vehículo.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Guardar Vehículo</span>';
  }
}

async function handleDeleteVehicle(vehicleId) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el vehículo ${vehicleId}? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/vehicles/${vehicleId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`🗑️ Vehículo ${vehicleId} eliminado.`);
      await loadManagementData();
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  } catch (err) {
    console.error("Error al eliminar vehículo:", err);
  }
}

/* ========================================================= */
/* GESTIÓN DE USUARIOS                                       */
/* ========================================================= */

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '';

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          No se encontraron usuarios registrados.
        </td>
      </tr>`;
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/80 transition border-b border-slate-100";

    // Estilo de insignia según el rol
    let roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Cliente</span>';
    let avatarBg = 'bg-blue-600';

    if (u.role === 'admin') {
      roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Administrador</span>';
      avatarBg = 'bg-purple-600';
    } else if (u.role === 'staff_asesor') {
      roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Asesor Comercial</span>';
      avatarBg = 'bg-indigo-600';
    } else if (u.role === 'staff_logistica') {
      roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Jefe de Taller</span>';
      avatarBg = 'bg-amber-600';
    } else if (u.role === 'staff_tramites') {
      roleBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Gestor Trámites</span>';
      avatarBg = 'bg-emerald-600';
    }

    const firstLetter = (u.client_name || u.username || 'U').charAt(0).toUpperCase();

    tr.innerHTML = `
      <td class="py-3.5 px-6">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full ${avatarBg} text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
            ${firstLetter}
          </div>
          <div>
            <span class="font-bold text-slate-900 block">${u.client_name || u.username}</span>
            <span class="text-[11px] text-slate-400 font-mono">@${u.username}</span>
          </div>
        </div>
      </td>

      <td class="py-3.5 px-6">
        <span class="font-mono text-slate-700 block">${u.client_doc || 'Sin documento'}</span>
        <span class="text-[11px] text-slate-400 block">${u.email || 'Sin correo'}</span>
      </td>

      <td class="py-3.5 px-6">
        ${roleBadge}
      </td>

      <td class="py-3.5 px-6">
        ${u.vehicle_id ? `<span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] font-bold border border-slate-200">${u.vehicle_id}</span>` : '<span class="text-slate-400 italic text-[11px]">Ninguno</span>'}
      </td>

      <td class="py-3.5 px-6">
        ${u.must_change_password ? 
          '<span class="text-amber-600 font-semibold text-[11px] flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left"></i> Temporal</span>' : 
          '<span class="text-emerald-600 font-semibold text-[11px] flex items-center gap-1"><i class="fa-solid fa-shield-check"></i> Personalizada</span>'}
      </td>

      <td class="py-3.5 px-6 text-right">
        ${u.username === 'admin' ? 
          '<span class="text-slate-400 text-[10px] italic">Protegido</span>' : 
          `<button onclick="handleDeleteUser('${u.id}', '${u.username}')" class="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition" title="Eliminar usuario">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>`
        }
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterUsersList() {
  const search = (document.getElementById('search-user-input').value || '').toLowerCase().trim();
  const role = document.getElementById('filter-user-role').value;

  let filtered = allUsers;
  if (role) {
    filtered = filtered.filter(u => u.role === role);
  }
  if (search) {
    filtered = filtered.filter(u => 
      (u.client_name || '').toLowerCase().includes(search) ||
      (u.username || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      (u.client_doc || '').toLowerCase().includes(search)
    );
  }

  renderUsersTable(filtered);
}

function openCreateUserModal() {
  document.getElementById('form-create-user').reset();
  document.getElementById('usr-password').value = 'AutoTrack2024*';
  const m = document.getElementById('modal-user');
  if (m) {
    m.classList.remove('hidden');
    m.style.display = 'flex';
  }
}

function closeCreateUserModal() {
  const m = document.getElementById('modal-user');
  if (m) {
    m.classList.add('hidden');
    m.style.display = 'none';
  }
}

async function handleSaveUser(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-user');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Guardando...</span>';

  try {
    const body = {
      client_name: document.getElementById('usr-name').value.trim(),
      username: document.getElementById('usr-username').value.trim(),
      role: document.getElementById('usr-role').value,
      email: document.getElementById('usr-email').value.trim(),
      client_doc: document.getElementById('usr-doc').value.trim() || undefined,
      password: document.getElementById('usr-password').value.trim() || 'AutoTrack2024*',
      vehicle_id: document.getElementById('usr-vehicle-id').value || null,
      must_change_password: document.getElementById('usr-must-change').checked
    };

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.success) {
      closeCreateUserModal();
      const emailNote = data.emailSent
        ? ` y credenciales enviadas a ${body.email}.`
        : '.';
      showToast(`✅ Usuario @${body.username} creado exitosamente${emailNote}`);
      await loadManagementData();
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  } catch (err) {
    console.error("Error al crear usuario:", err);
    alert("Error de conexión al crear usuario.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-check"></i><span>Crear Usuario</span>';
  }
}

async function handleDeleteUser(userId, username) {
  if (!confirm(`¿Estás seguro de eliminar el usuario @${username}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(`🗑️ Usuario @${username} eliminado.`);
      await loadManagementData();
    } else {
      alert(`❌ Error: ${data.message}`);
    }
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
  }
}

/* ========================================================= */
/* TOAST NOTIFICACIONES                                      */
/* ========================================================= */

function showToast(text) {
  const toast = document.getElementById('toast-msg');
  const span = document.getElementById('toast-text');
  if (toast && span) {
    span.textContent = text;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }
}

function closeToast() {
  const toast = document.getElementById('toast-msg');
  if (toast) toast.classList.add('hidden');
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
