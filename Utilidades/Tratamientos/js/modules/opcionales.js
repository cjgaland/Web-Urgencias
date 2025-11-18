// js/modules/opcionales.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const OpcionalesModule = (() => {
  const moduleState = { editingIndex: -1 };
  let VIA_OPCIONES = [];
  let FREQ_OPCIONES = [];
  let CONDICIONES_OPC = [];

  async function leerLineas(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error();
    const t = await res.text();
    return t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  async function cargarVias() {
    if (typeof DataLoader?.cargarViasAdministracion === 'function') {
      try { const v = await DataLoader.cargarViasAdministracion(); if(v.length) return v; } catch(e){}
    }
    return await leerLineas('data/vias_administracion.txt');
  }

  function mapearPautaTextoAValor(txt) {
    const t = (txt || '').toLowerCase();
    if (t.includes('ahora')) return 'ahora';
    if (t.includes('prn') || t.includes('precisa')) return 'prn';
    const m = t.match(/cada\s+(\d+)\s*hora/);
    if (m) { const h = parseInt(m[1]); if ([1, 2, 4, 6, 8, 12, 24].includes(h)) return `q${h}`; }
    return t || '';
  }

  async function cargarPautas() {
    if (typeof DataLoader?.cargarPautas === 'function') {
      try { const f = await DataLoader.cargarPautas(); if(f.length) return f.map(t=>({value:mapearPautaTextoAValor(t), text:t})); } catch(e){}
    }
    const l = await leerLineas('data/pauta.txt');
    return l.map(t => ({ value: mapearPautaTextoAValor(t), text: t }));
  }

  async function cargarCondicionesOpcionales() {
    try { return await leerLineas('data/condiciones_opcionales.txt'); } catch { return []; }
  }

  function poblarSelectVias(sel, vias) {
    const s = $(sel); if(!s) return; s.innerHTML='<option value="">Seleccionar...</option>';
    vias.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; s.appendChild(o); });
  }
  function poblarSelectPautas(sel, opts) {
    const s = $(sel); if(!s) return; s.innerHTML='<option value="">Seleccionar...</option>';
    opts.forEach(o=>{ const op=document.createElement('option'); op.value=o.value; op.textContent=o.text; s.appendChild(op); });
  }
  function poblarSelectCondiciones(sel, conds) {
    const s = $(sel); if(!s) return; if(!conds.length) return; s.innerHTML='<option value="">Seleccionar...</option>';
    conds.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; s.appendChild(o); });
  }
  function textoPautaDesdeValor(v) { const f=FREQ_OPCIONES.find(o=>o.value===v); return f?f.text:(v||''); }

  async function init() {
    if (!Array.isArray(GlobalState.opcionales)) StateManager.updateState({...GlobalState, opcionales:[]});
    try { VIA_OPCIONES = await cargarVias(); } catch { VIA_OPCIONES=[]; }
    try { FREQ_OPCIONES = await cargarPautas(); } catch { FREQ_OPCIONES=[]; }
    try { CONDICIONES_OPC = await cargarCondicionesOpcionales(); } catch { CONDICIONES_OPC=[]; }
    poblarSelectVias('#opc_via', VIA_OPCIONES);
    poblarSelectPautas('#opc_freqmax', FREQ_OPCIONES);
    poblarSelectCondiciones('#opc_condicion', CONDICIONES_OPC);
    renderTable();
  }

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

    StateActions.addToArray('opcionales', { condicion, farmaco, dosis, via, freqmax, obs, timestamp: new Date().toISOString() });
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
    
    const original = GlobalState.opcionales[moduleState.editingIndex] || {};
    const item = { condicion, farmaco, dosis, via, freqmax, obs, timestamp: original.timestamp || new Date().toISOString() };
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
    limpiarFormulario();
    renderTable();
    showToast('Medicación opcional vaciada', 'info');
  }

  function renderTable() {
    const tbody = $('#tablaOpcional tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const lista = (GlobalState.opcionales || []).slice().reverse();

    if (lista.length === 0) {
      tbody.innerHTML = `<tr style="text-align:center;color:#64748b"><td colspan="8">No hay medicación opcional</td></tr>`;
      return;
    }

    lista.forEach((it, i) => {
      const realIndex = (GlobalState.opcionales.length - 1) - i;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${it.condicion}</td>
        <td>${it.farmaco}</td>
        <td>${it.dosis}</td>
        <td>${it.via}</td>
        <td>${textoPautaDesdeValor(it.freqmax)}</td>
        <td>${it.obs || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-opcional" data-index="${realIndex}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm danger" data-action="delete-opcional" data-index="${realIndex}"><i class="fas fa-trash"></i></button>
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

  function limpiarFormulario() {
    DOMHelpers.setValue('#opc_condicion', '');
    DOMHelpers.setValue('#opc_farmaco', '');
    DOMHelpers.setValue('#opc_dosis', '');
    DOMHelpers.setValue('#opc_via', '');
    DOMHelpers.setValue('#opc_freqmax', '');
    DOMHelpers.setValue('#opc_obs', '');
    DOMHelpers.showElement('#btnAddOpcional');
    DOMHelpers.hideElement('#btnUpdateOpcional');
    DOMHelpers.hideElement('#btnCancelEditOpcional');
    moduleState.editingIndex = -1;
  }

  function cancelarEdicion() { limpiarFormulario(); }

  // SUSCRIPCIÓN
  StateManager.subscribe((nuevo, anterior, cambios) => {
    if (cambios.opcionales !== undefined) renderTable();
  });

  return { init, addOpcional, updateOpcional, cancelarEdicion, vaciar, add: addOpcional, guardar: updateOpcional, clear: vaciar };
})();

export default OpcionalesModule;