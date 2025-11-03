// js/modules/puntuales.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const PuntualesModule = (() => {
  const moduleState = { editingIndex: -1 };

  // Catálogos cargados
  let VIA_OPCIONES = [];

  // --- Utilidades de carga -----------------------------------------------

  async function leerLineas(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error ${res.status} cargando ${path}`);
    const text = await res.text();
    return text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function cargarVias() {
    if (typeof DataLoader?.cargarViasAdministracion === 'function') {
      try {
        const vias = await DataLoader.cargarViasAdministracion();
        if (Array.isArray(vias) && vias.length) return vias;
      } catch (e) { /* fallback a fichero */ }
    }
    return await leerLineas('data/vias_administracion.txt');
  }

  // --- Poblar selects -----------------------------------------------------

  function poblarSelectVias(selector, vias) {
    const sel = $(selector);
    if (!sel) return;
    sel.innerHTML = '';

    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Seleccionar...';
    sel.appendChild(ph);

    vias.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  // --- Init ---------------------------------------------------------------

  async function init() {
    console.log('🟡 Inicializando módulo Puntuales...');
    
    // Asegurar estructura del estado global
    if (!Array.isArray(GlobalState.puntuales)) {
      const newState = { ...GlobalState, puntuales: [] };
      StateManager.updateState(newState);
    }

    // Cargar catálogos
    try { 
      VIA_OPCIONES = await cargarVias();
      console.log('✅ Vías cargadas para puntuales:', VIA_OPCIONES);
    }
    catch (e) { 
      console.error('❌ Error cargando vías para puntuales:', e);
      VIA_OPCIONES = ['Oral', 'Venosa periférica', 'Venosa central', 'Intramuscular', 'Subcutánea', 'Inhalada']; 
    }

    // Poblar selects
    poblarSelectVias('#pun_via', VIA_OPCIONES);

    // Verificar que el select se pobló
    console.log('✅ Select vía puntual después de poblar:', $('#pun_via')?.innerHTML);

    renderTable();
    console.log('✅ Módulo Puntuales inicializado correctamente');
  }

  // --- CRUD ---------------------------------------------------------------

  function addPuntual() {
    const farmaco = $('#pun_farmaco')?.value?.trim() || '';
    const dosis = $('#pun_dosis')?.value?.trim() || '';
    const via = $('#pun_via')?.value || '';
    const indicacion = $('#pun_indicacion')?.value?.trim() || '';
    const cuando = $('#pun_cuando')?.value || '';
    const obs = $('#pun_obs')?.value?.trim() || '';

    if (!farmaco) return showToast('Indica el fármaco', 'warning');
    if (!dosis) return showToast('Indica la dosis', 'warning');
    if (!via) return showToast('Selecciona la vía', 'warning');
    if (!indicacion) return showToast('Indica la indicación', 'warning');
    if (!cuando) return showToast('Selecciona cuándo', 'warning');

    const item = { farmaco, dosis, via, indicacion, cuando, obs };
    StateActions.addToArray('puntuales', item);
    limpiarFormulario();
    renderTable();
    showToast('Medicación puntual añadida', 'success');
  }

  function editarPuntual(index) {
    const it = GlobalState.puntuales[index];
    if (!it) return;

    DOMHelpers.setValue('#pun_farmaco', it.farmaco);
    DOMHelpers.setValue('#pun_dosis', it.dosis);
    DOMHelpers.setValue('#pun_via', it.via);
    DOMHelpers.setValue('#pun_indicacion', it.indicacion);
    DOMHelpers.setValue('#pun_cuando', it.cuando);
    DOMHelpers.setValue('#pun_obs', it.obs || '');

    DOMHelpers.hideElement('#btnAddPuntual');
    DOMHelpers.showElement('#btnUpdatePuntual');
    DOMHelpers.showElement('#btnCancelEditPuntual');

    moduleState.editingIndex = index;
  }

  function updatePuntual() {
    if (moduleState.editingIndex === -1) return;

    const farmaco = $('#pun_farmaco')?.value?.trim() || '';
    const dosis = $('#pun_dosis')?.value?.trim() || '';
    const via = $('#pun_via')?.value || '';
    const indicacion = $('#pun_indicacion')?.value?.trim() || '';
    const cuando = $('#pun_cuando')?.value || '';
    const obs = $('#pun_obs')?.value?.trim() || '';

    if (!farmaco) return showToast('Indica el fármaco', 'warning');
    if (!dosis) return showToast('Indica la dosis', 'warning');
    if (!via) return showToast('Selecciona la vía', 'warning');
    if (!indicacion) return showToast('Indica la indicación', 'warning');
    if (!cuando) return showToast('Selecciona cuándo', 'warning');

    const item = { farmaco, dosis, via, indicacion, cuando, obs };
    StateActions.updateInArray('puntuales', moduleState.editingIndex, item);

    cancelarEdicion();
    renderTable();
    showToast('Medicación puntual actualizada', 'success');
  }

  function eliminarPuntual(index) {
    StateActions.removeFromArray('puntuales', index);
    renderTable();
    showToast('Medicación puntual eliminada', 'info');
  }

  function vaciar() {
    StateActions.clearArray('puntuales');
    limpiarFormulario(); // ← Limpiar formulario también
    renderTable();
    showToast('Medicación puntual vaciada', 'info');
  }

  // --- Render -------------------------------------------------------------

  function renderTable() {
    const tbody = $('#tablaPuntual tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(GlobalState.puntuales) || GlobalState.puntuales.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align:center;color:#64748b">No hay medicación puntual</td>`;
      tbody.appendChild(tr);
      return;
    }

    GlobalState.puntuales.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${it.farmaco}</td>
        <td>${it.dosis}</td>
        <td>${it.via}</td>
        <td>${it.indicacion || '-'}</td>
        <td>${it.cuando}</td>
        <td>${it.obs || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-puntual" data-index="${idx}" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm danger" data-action="delete-puntual" data-index="${idx}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      tr.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(index)) return;
        if (action === 'edit-puntual') return editarPuntual(index);
        if (action === 'delete-puntual') return eliminarPuntual(index);
      });
    });
  }

  // --- Form helpers -------------------------------------------------------

  function limpiarFormulario() {
    DOMHelpers.setValue('#pun_farmaco', '');
    DOMHelpers.setValue('#pun_dosis', '');
    DOMHelpers.setValue('#pun_via', '');
    DOMHelpers.setValue('#pun_indicacion', '');
    DOMHelpers.setValue('#pun_cuando', 'ahora'); // Valor por defecto
    DOMHelpers.setValue('#pun_obs', '');

    DOMHelpers.showElement('#btnAddPuntual');
    DOMHelpers.hideElement('#btnUpdatePuntual');
    DOMHelpers.hideElement('#btnCancelEditPuntual');

    moduleState.editingIndex = -1;
  }

  function cancelarEdicion() {
    limpiarFormulario();
  }

  // API pública que espera events.js
  return {
    init,
    addPuntual,
    updatePuntual,
    cancelarEdicion,
    vaciar,

    // alias por si acaso
    add: addPuntual,
    guardar: updatePuntual,
    clear: vaciar
  };
})();

export default PuntualesModule;