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
    card.className = "bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition group";

    card.innerHTML = `
      <!-- Foto del Vehículo -->
      <div class="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
        <img src="${imgSrc}" alt="${v.brand_model}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" onerror="this.src='${defaultImg}'">
        
        <div class="absolute top-3 left-3 flex items-center gap-1.5">
          <span class="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg border border-white/10 uppercase tracking-wide">
            ${v.vehicle_type || 'Automóvil'}
          </span>
          <span class="px-2.5 py-1 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-mono font-bold rounded-lg shadow-sm">
            ${v.order_code}
          </span>
        </div>

        <div class="absolute top-3 right-3">
          <span class="px-2.5 py-1 bg-emerald-500/90 text-white text-[10px] font-bold rounded-lg shadow-sm flex items-center gap-1">
            <i class="fa-solid fa-circle-check text-[9px]"></i>
            ${v.current_stage_name}
          </span>
        </div>
      </div>

      <!-- Contenido de la Tarjeta -->
      <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3 class="text-base font-extrabold text-slate-900 leading-snug">${v.brand_model}</h3>
          <p class="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <span>Color: <strong class="text-slate-700">${v.color || 'Blanco'}</strong></span>
            <span>•</span>
            <span class="font-mono text-[11px]">VIN: ${v.vin}</span>
          </p>
        </div>

        <!-- Ficha del Cliente -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente Asignado</span>
            <span class="text-[10px] font-mono text-indigo-600 font-bold">C.C. ${v.client_doc}</span>
          </div>
          <p class="font-bold text-slate-800">${v.client_name}</p>
          <p class="text-[11px] text-slate-500 font-mono">${v.client_email || 'Sin correo'}</p>
        </div>

        <!-- Metadatos de Entrega -->
        <div class="text-[11px] text-slate-500 space-y-1 border-t border-slate-100 pt-3">
          <p class="flex items-center justify-between">
            <span>Asesor:</span>
            <strong class="text-slate-700">${v.advisor_name || 'Laura Gómez'}</strong>
          </p>
          <p class="flex items-center justify-between">
            <span>Sede:</span>
            <span class="text-slate-600">${v.dealership_branch || 'Almotores Principal'}</span>
          </p>
        </div>

        <!-- Acciones -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
          <a href="/admin.html" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <span>Ver en Línea de Tiempo</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </a>

          <button onclick="handleDeleteVehicle('${v.id}')" class="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition" title="Eliminar vehículo">
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

function openCreateVehicleModal() {
  selectedImageFile = null;
  document.getElementById('form-create-vehicle').reset();
  updateDefaultImage('Automóvil');
  document.getElementById('preview-badge').textContent = 'Por defecto';
  document.getElementById('modal-vehicle').classList.remove('hidden');
}

function closeCreateVehicleModal() {
  document.getElementById('modal-vehicle').classList.add('hidden');
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
      dealership_branch: document.getElementById('veh-branch').value.trim() || 'Almotores Principal',
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
  document.getElementById('usr-password').value = 'Almotores2024*';
  document.getElementById('modal-user').classList.remove('hidden');
}

function closeCreateUserModal() {
  document.getElementById('modal-user').classList.add('hidden');
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
      password: document.getElementById('usr-password').value.trim() || 'Almotores2024*',
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
      showToast(`✅ Usuario @${body.username} creado exitosamente.`);
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
