// js/modules/opcionales.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const OpcionalesModule = (() => {
  const moduleState = { editingIndex: -1 };

  // Catálogos cargados (para pintar texto en tabla)
  let VIA_OPCIONES = [];                   // ['Oral', 'Venosa periférica', ...]
  let FREQ_OPCIONES = [];                  // [{ value:'q6', text:'Cada 6 horas' }, ...]
  let CONDICIONES_OPC = [];                // ['Si fiebre >38°C', 'Si dolor', ...] (opcional)

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

  function mapearPautaTextoAValor(txt) {
    const t = (txt || '').toLowerCase();
    if (t.includes('ahora')) return 'ahora';
    if (t.includes('prn') || t.includes('precisa')) return 'prn';
    const m = t.match(/cada\s+(\d+)\s*hora/);
    if (m) {
      const h = parseInt(m[1], 10);
      if ([1, 2, 4, 6, 8, 12, 24].includes(h)) return `q${h}`;
    }
    return t || '';
  }

  async function cargarPautas() {
    if (typeof DataLoader?.cargarPautas === 'function') {
      try {
        const freqs = await DataLoader.cargarPautas();
        if (Array.isArray(freqs) && freqs.length) {
          return freqs.map(text => ({ value: mapearPautaTextoAValor(text), text }));
        }
      } catch (e) { /* fallback a fichero */ }
    }
    // soporte por compatibilidad si existe cargarFrecuencias
    if (typeof DataLoader?.cargarFrecuencias === 'function') {
      try {
        const freqs = await DataLoader.cargarFrecuencias();
        if (Array.isArray(freqs) && freqs.length) {
          return freqs.map(text => ({ value: mapearPautaTextoAValor(text), text }));
        }
      } catch (e) { /* seguimos */ }
    }
    const lineas = await leerLineas('data/pauta.txt');
    return lineas.map(text => ({ value: mapearPautaTextoAValor(text), text }));
  }

  async function cargarCondicionesOpcionales() {
    // Si tienes DataLoader.cargarCondicionesOpcionales lo usamos
    if (typeof DataLoader?.cargarCondicionesOpcionales === 'function') {
      try {
        const conds = await DataLoader.cargarCondicionesOpcionales();
        if (Array.isArray(conds) && conds.length) return conds;
      } catch (e) { /* fallback */ }
    }
    // Fichero opcional (si no existe, simplemente usamos fallback de HTML)
    try {
      return await leerLineas('data/condiciones_opcionales.txt');
    } catch {
      // Deja que el HTML aporte el listado
      return [];
    }
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
      opt.value = v;       // Guardamos el texto literal
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function poblarSelectPautas(selector, opciones) {
  const sel = $(selector);
  if (!sel) return;
  sel.innerHTML = '';

  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Seleccionar...';
  sel.appendChild(ph);

  opciones.forEach(({ value, text }) => {
    const opt = document.createElement('option');
    opt.value = value;     // value interno (q6, prn, ahora…)
    opt.textContent = text; // texto mostrado (del fichero)
    sel.appendChild(opt);
  });
    if (sel.querySelector('option[value="q8"]')) sel.value = 'q8'; // por defecto en tu HTML
  }

  function poblarSelectCondiciones(selector, condiciones) {
    const sel = $(selector);
    if (!sel) return;

    // Si no hay condiciones cargadas, respetamos lo que viene del HTML
    if (!Array.isArray(condiciones) || !condiciones.length) return;

    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Seleccionar...';
    sel.appendChild(ph);

    condiciones.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  function textoPautaDesdeValor(val) {
    const found = FREQ_OPCIONES.find(o => o.value === val);
    return found ? found.text : (val || '');
  }

  // --- Init ---------------------------------------------------------------

  async function init() {
    // Asegurar estructura del estado global
    if (!Array.isArray(GlobalState.opcionales)) {
      const newState = { ...GlobalState, opcionales: [] };
      StateManager.updateState(newState);
    }

    // Cargar catálogos
    try { VIA_OPCIONES = await cargarVias(); }
    catch { VIA_OPCIONES = ['Oral', 'Venosa periférica', 'Venosa central', 'Intramuscular', 'Subcutánea', 'Inhalada']; }

    try { FREQ_OPCIONES = await cargarPautas(); }
    catch {
      FREQ_OPCIONES = [
        { value: 'q4',  text: 'Cada 4 horas' },
        { value: 'q6',  text: 'Cada 6 horas' },
        { value: 'q8',  text: 'Cada 8 horas' },
        { value: 'q12', text: 'Cada 12 horas' },
        { value: 'prn', text: 'Si precisa' }
      ];
    }

    try { CONDICIONES_OPC = await cargarCondicionesOpcionales(); } catch { CONDICIONES_OPC = []; }

    // Poblar selects
    poblarSelectVias('#opc_via', VIA_OPCIONES);
    poblarSelectPautas('#opc_freqmax', FREQ_OPCIONES);
    poblarSelectCondiciones('#opc_condicion', CONDICIONES_OPC);

    renderTable();
  }

  // --- CRUD ---------------------------------------------------------------

  function addOpcional() {
    const condicion = $('#opc_condicion')?.value || '';
    const farmaco   = $('#opc_farmaco')?.value?.trim() || '';
    const dosis     = $('#opc_dosis')?.value?.trim() || '';
    const via       = $('#opc_via')?.value || '';
    const freqmax   = $('#opc_freqmax')?.value || '';
    const obs       = $('#opc_obs')?.value?.trim() || '';

    if (!condicion) return showToast('Selecciona una condición', 'warning');
    if (!farmaco)   return showToast('Indica el fármaco', 'warning');
    if (!dosis)     return showToast('Indica la dosis', 'warning');
    if (!via)       return showToast('Selecciona la vía', 'warning');
    if (!freqmax)   return showToast('Selecciona la frecuencia máxima', 'warning');

    const item = { condicion, farmaco, dosis, via, freqmax, obs };
    StateActions.addToArray('opcionales', item);
    limpiarFormulario();
    renderTable();
    showToast('Medicación opcional añadida', 'success');
  }

  function editarOpcional(index) {
    const it = GlobalState.opcionales[index];
    if (!it) return;

    DOMHelpers.setValue('#opc_condicion', it.condicion);
    DOMHelpers.setValue('#opc_farmaco', it.farmaco);
    DOMHelpers.setValue('#opc_dosis', it.dosis);
    DOMHelpers.setValue('#opc_via', it.via);
    DOMHelpers.setValue('#opc_freqmax', it.freqmax);
    DOMHelpers.setValue('#opc_obs', it.obs || '');

    DOMHelpers.hideElement('#btnAddOpcional');
    DOMHelpers.showElement('#btnUpdateOpcional');
    DOMHelpers.showElement('#btnCancelEditOpcional');

    moduleState.editingIndex = index;
  }

  function updateOpcional() {
    if (moduleState.editingIndex === -1) return;

    const condicion = $('#opc_condicion')?.value || '';
    const farmaco   = $('#opc_farmaco')?.value?.trim() || '';
    const dosis     = $('#opc_dosis')?.value?.trim() || '';
    const via       = $('#opc_via')?.value || '';
    const freqmax   = $('#opc_freqmax')?.value || '';
    const obs       = $('#opc_obs')?.value?.trim() || '';

    if (!condicion) return showToast('Selecciona una condición', 'warning');
    if (!farmaco)   return showToast('Indica el fármaco', 'warning');
    if (!dosis)     return showToast('Indica la dosis', 'warning');
    if (!via)       return showToast('Selecciona la vía', 'warning');
    if (!freqmax)   return showToast('Selecciona la frecuencia máxima', 'warning');

    const item = { condicion, farmaco, dosis, via, freqmax, obs };
    StateActions.updateInArray('opcionales', moduleState.editingIndex, item);

    cancelarEdicion();
    renderTable();
    showToast('Medicación opcional actualizada', 'success');
  }

  function eliminarOpcional(index) {
    StateActions.removeFromArray('opcionales', index);
    renderTable();
    showToast('Medicación opcional eliminada', 'info');
  }

  function vaciar() {
  StateActions.clearArray('opcionales');
  limpiarFormulario(); // ← AÑADE ESTA LÍNEA
  renderTable();
  showToast('Medicación opcional vaciada', 'info');
}

  // --- Render -------------------------------------------------------------

  function renderTable() {
    const tbody = $('#tablaOpcional tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(GlobalState.opcionales) || GlobalState.opcionales.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align:center;color:#64748b">No hay medicación opcional</td>`;
      tbody.appendChild(tr);
      return;
    }

    GlobalState.opcionales.forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${it.condicion}</td>
        <td>${it.farmaco}</td>
        <td>${it.dosis}</td>
        <td>${it.via}</td>
        <td>${textoPautaDesdeValor(it.freqmax)}</td>
        <td>${it.obs || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-opcional" data-index="${idx}" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm danger" data-action="delete-opcional" data-index="${idx}" title="Eliminar">
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
        if (action === 'edit-opcional') return editarOpcional(index);
        if (action === 'delete-opcional') return eliminarOpcional(index);
      });
    });
  }

  // --- Form helpers -------------------------------------------------------

  function limpiarFormulario() {
  DOMHelpers.setValue('#opc_condicion', '');
  DOMHelpers.setValue('#opc_farmaco', '');
  DOMHelpers.setValue('#opc_dosis', '');
  DOMHelpers.setValue('#opc_via', '');
  
  // CORREGIDO: Siempre limpiar a vacío en lugar de poner 'q8' por defecto
  DOMHelpers.setValue('#opc_freqmax', '');
  
  DOMHelpers.setValue('#opc_obs', '');

  DOMHelpers.showElement('#btnAddOpcional');
  DOMHelpers.hideElement('#btnUpdateOpcional');
  DOMHelpers.hideElement('#btnCancelEditOpcional');

  moduleState.editingIndex = -1;
}

  function cancelarEdicion() {
    limpiarFormulario();
  }

  // API pública que espera events.js
  return {
    init,
    addOpcional,
    updateOpcional,
    cancelarEdicion,
    vaciar,

    // alias por si acaso
    add: addOpcional,
    guardar: updateOpcional,
    clear: vaciar
  };
})();

export default OpcionalesModule;
