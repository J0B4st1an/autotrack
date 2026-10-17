/* AutoTrack - Metrics App JS Protegido */

document.addEventListener('DOMContentLoaded', () => {
  if (!checkAdminSession()) return;
  loadMetrics();
});

function checkAdminSession() {
  const raw = localStorage.getItem('autotrack_admin_user');
  if (!raw) {
    window.location.href = '/admin-login.html';
    return false;
  }
  return true;
}

function logoutAdmin() {
  localStorage.removeItem('autotrack_admin_user');
  window.location.href = '/admin-login.html';
}

async function loadMetrics() {
  try {
    const res = await fetch('/api/metrics');
    const data = await res.json();
    if (!data.success || !data.metrics) return;

    const m = data.metrics;

    document.getElementById('metric-satisfaction').textContent = `${m.avg_satisfaction_rating} / 5.0`;
    document.getElementById('metric-delayed').textContent = m.delayed_vehicles_count;

    renderStageDistribution(m.stage_distribution, m.total_vehicles);
    renderDelayedTable(m.delayed_list);

  } catch (err) {
    console.error("Error al cargar métricas:", err);
  }
}

function renderStageDistribution(stages, total) {
  const container = document.getElementById('stage-distribution-container');
  container.innerHTML = '';

  if (!stages || stages.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400">Sin datos de etapas.</p>';
    return;
  }

  stages.forEach(s => {
    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'space-y-1.5';
    row.innerHTML = `
      <div class="flex justify-between items-center text-xs font-semibold">
        <span class="text-slate-700">${s.stage_index}. ${s.stage_name}</span>
        <span class="text-slate-500 font-mono">${s.count} vehículos (${pct}%)</span>
      </div>
      <div class="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div class="h-full bg-indigo-600 rounded-full transition-all duration-500" style="width: ${Math.max(5, pct)}%;"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

function renderDelayedTable(delayedList) {
  const tbody = document.getElementById('delayed-table-body');
  tbody.innerHTML = '';

  if (!delayedList || delayedList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-6 text-center text-emerald-600 font-semibold text-xs">
          <i class="fa-solid fa-circle-check mr-1.5"></i> ¡Excelente! Ningún vehículo presenta retrasos frente al tiempo estimado.
        </td>
      </tr>`;
    return;
  }

  delayedList.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-900">${v.id}</td>
      <td class="py-3 px-4">${v.client_name}</td>
      <td class="py-3 px-4 font-medium">${v.brand_model}</td>
      <td class="py-3 px-4 text-amber-700 font-semibold">${v.stage}</td>
      <td class="py-3 px-4 font-mono">${v.estimated_days} días</td>
      <td class="py-3 px-4 text-right">
        <span class="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md font-bold text-[10px]">
          Alerta Retraso
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
