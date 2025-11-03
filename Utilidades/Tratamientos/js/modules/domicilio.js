// modules/domicilio.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const DomicilioModule = (() => {
  const moduleState = { editingIndex: -1 };

  async function init() {
    await Promise.all([cargarVias(), cargarPautasFlex()]);
    preseleccionarViaOral();
    bindEvents();
    renderTable();
  }

  async function cargarVias() {
    try {
      const vias = await (DataLoader.cargarViasAdministracion?.() ?? Promise.resolve([]));
      const sel = $('#dom_via');
      if (sel) {
        sel.innerHTML = '<option value="">Seleccionar vía...</option>';
        (vias || []).forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('Domicilio: error cargando vías', e);
      showToast('No se pudieron cargar las vías', 'error');
    }
  }

  // --- Loader de Pauta a prueba de nombre ---
  async function obtenerPautas() {
    // Intenta los 3 nombres habituales sin romper si alguno no existe
    if (typeof DataLoader.cargarPautas === 'function') {
      return await DataLoader.cargarPautas();
    }
    if (typeof DataLoader.cargarPauta === 'function') {
      return await DataLoader.cargarPauta();
    }
    if (typeof DataLoader.cargarFrecuencias === 'function') {
      return await DataLoader.cargarFrecuencias();
    }
    return [];
  }

  async function cargarPautasFlex() {
    try {
      const pautas = await obtenerPautas();
      const sel = $('#dom_freq');
      if (sel) {
        sel.innerHTML = '<option value="">Seleccionar pauta...</option>';
        (pautas || []).forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('Domicilio: error cargando pautas', e);
      showToast('No se pudieron cargar las pautas', 'error');
    }
  }

  function preseleccionarViaOral() {
    const sel = $('#dom_via');
    if (!sel) return;
    const opt = Array.from(sel.options).find(o => o.textContent.trim().toLowerCase() === 'oral');
    if (opt) sel.value = opt.value;
  }

  function bindEvents() {
    $('#btnAddDom')?.addEventListener('click', add);
    $('#btnUpdateDom')?.addEventListener('click', actualizar);
    $('#btnCancelEditDom')?.addEventListener('click', cancelarEdicion);
    $('#btnVaciarDom')?.addEventListener('click', vaciar);

    $('#tablaDom')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.index, 10);
      if (action === 'edit' && Number.isInteger(index)) editar(index);
      if (action === 'delete' && Number.isInteger(index)) eliminar(index);
    });
  }

  function getForm() {
    return {
      farmaco: $('#dom_farmaco')?.value?.trim() || '',
      dosis: $('#dom_dosis')?.value?.trim() || '',
      via: $('#dom_via')?.value?.trim() || '',
      freq: $('#dom_freq')?.value?.trim() || '',
      inicio: $('#dom_inicio')?.value || '',
      dias: parseInt($('#dom_dias')?.value, 10) || 1,
      indicacion: $('#dom_indicacion')?.value?.trim() || '',
      obs: $('#dom_obs')?.value?.trim() || ''
    };
  }

  function validar(v) {
    if (!v.farmaco) return 'Indica el fármaco';
    if (!v.dosis) return 'Indica la dosis';
    if (!v.via) return 'Selecciona la vía';
    if (!v.freq) return 'Selecciona la pauta';
    if (!v.inicio) return 'Indica la hora de inicio';
    if (!v.dias || v.dias < 1) return 'Introduce días (≥1)';
    return '';
  }

  function add() {
    const v = getForm();
    const err = validar(v);
    if (err) { showToast(err, 'warning'); return; }
    StateActions.addToArray('domicilio', v);
    limpiar();
    renderTable();
    showToast('Medicación domiciliaria añadida', 'success');
  }

  function editar(index) {
    const it = GlobalState.domicilio?.[index];
    if (!it) return;
    DOMHelpers.setValue('#dom_farmaco', it.farmaco);
    DOMHelpers.setValue('#dom_dosis', it.dosis);
    DOMHelpers.setValue('#dom_via', it.via);
    DOMHelpers.setValue('#dom_freq', it.freq);
    DOMHelpers.setValue('#dom_inicio', it.inicio);
    DOMHelpers.setValue('#dom_dias', it.dias);
    DOMHelpers.setValue('#dom_indicacion', it.indicacion);
    DOMHelpers.setValue('#dom_obs', it.obs || '');

    moduleState.editingIndex = index;
    DOMHelpers.hideElement('#btnAddDom');
    DOMHelpers.showElement('#btnUpdateDom');
    DOMHelpers.showElement('#btnCancelEditDom');
  }

  function actualizar() {
    if (moduleState.editingIndex < 0) return;
    const v = getForm();
    const err = validar(v);
    if (err) { showToast(err, 'warning'); return; }
    StateActions.updateInArray('domicilio', moduleState.editingIndex, v);
    cancelarEdicion();
    renderTable();
    showToast('Medicación domiciliaria actualizada', 'success');
  }

  function eliminar(index) {
    StateActions.removeFromArray('domicilio', index);
    renderTable();
    showToast('Elemento eliminado', 'info');
  }

  function vaciar() {
    StateActions.clearArray('domicilio');
    renderTable();
    showToast('Lista vaciada', 'info');
  }

  function limpiar() {
    DOMHelpers.setValue('#dom_farmaco', '');
    DOMHelpers.setValue('#dom_dosis', '');
    preseleccionarViaOral();
    DOMHelpers.setValue('#dom_freq', '');
    DOMHelpers.setValue('#dom_inicio', '');
    DOMHelpers.setValue('#dom_dias', '1');
    DOMHelpers.setValue('#dom_indicacion', '');
    DOMHelpers.setValue('#dom_obs', '');
  }

  function cancelarEdicion() {
    limpiar();
    moduleState.editingIndex = -1;
    DOMHelpers.showElement('#btnAddDom');
    DOMHelpers.hideElement('#btnUpdateDom');
    DOMHelpers.hideElement('#btnCancelEditDom');
  }

  function renderTable() {
    const tbody = $('#tablaDom tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const items = GlobalState.domicilio || [];
    if (items.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="10" style="text-align:center;color:#64748b">No hay medicación domiciliaria</td>`;
      tbody.appendChild(tr);
      return;
    }

    items.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${it.farmaco}</td>
        <td>${it.dosis}</td>
        <td>${it.via}</td>
        <td>${it.freq}</td>
        <td>${it.inicio}</td>
        <td>${it.dias}</td>
        <td>${it.indicacion || ''}</td>
        <td>${it.obs || ''}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit" data-index="${idx}" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm danger" data-action="delete" data-index="${idx}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function getParaImpresion() {
    return (GlobalState.domicilio || []).map(it => ({
      ...it,
      texto: `${it.farmaco} ${it.dosis} ${it.via} — ${it.freq}, inicio ${it.inicio}, ${it.dias} días`
    }));
  }

  return {
    init,
    add,
    actualizar,
    editar,
    eliminar,
    vaciar,
    getParaImpresion
  };
})();

export default DomicilioModule;
