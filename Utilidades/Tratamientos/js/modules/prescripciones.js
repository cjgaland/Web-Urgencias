// js/modules/prescripciones.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const PrescripcionesModule = (() => {
  const moduleState = { editingIndex: -1, medicamentosDB: [] };
  let VIA_OPCIONES = [];
  let FREQ_OPCIONES = [];

  async function leerLineas(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error();
    const t = await res.text();
    return t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
  
  // ... (Mismas funciones auxiliares de carga de datos que antes) ...
  // Para ahorrar espacio en la respuesta, omito las funciones de carga que son idénticas al bloque anterior
  // PERO asegúrate de mantener cargarVias, cargarMedicamentos, mapearPautaTextoAValor, cargarPautas, 
  // poblarSelects y onFarmacoInput igual que en el código que te di antes.
  
  // Voy a poner la estructura completa para que puedas copiar y pegar sin miedo:

  async function cargarVias() {
      if (typeof DataLoader?.cargarViasAdministracion === 'function') {
        try { const v = await DataLoader.cargarViasAdministracion(); if(v.length) return v; } catch(e){}
      }
      return await leerLineas('data/vias_administracion.txt');
  }
  async function cargarMedicamentos() {
      if (typeof DataLoader?.cargarMedicamentos === 'function') {
          try { const m = await DataLoader.cargarMedicamentos(); if(m.length) { moduleState.medicamentosDB = m; return; } } catch(e){}
      }
      moduleState.medicamentosDB = [];
  }
  function mapearPautaTextoAValor(txt) {
      const t = (txt||'').toLowerCase();
      if(t.includes('ahora')) return 'ahora';
      if(t.includes('prn')||t.includes('precisa')) return 'prn';
      const m = t.match(/cada\s+(\d+)\s*hora/);
      if(m) { const h = parseInt(m[1]); if([1,2,4,6,8,12,24].includes(h)) return `q${h}`; }
      return t||'';
  }
  async function cargarPautas() {
      if (typeof DataLoader?.cargarPauta === 'function') {
          try { const f = await DataLoader.cargarPauta(); if(f.length) return f.map(t=>({value:mapearPautaTextoAValor(t), text:t})); } catch(e){}
      }
      const l = await leerLineas('data/pauta.txt');
      return l.map(t=>({value:mapearPautaTextoAValor(t), text:t}));
  }
  function poblarDatalistMedicamentos(sel, meds) {
      const d = $(sel); if(!d) return; d.innerHTML=''; meds.forEach(m=>{ const o=document.createElement('option'); o.value=m.value; d.appendChild(o); });
  }
  function poblarSelectVias(sel, vias) {
      const s = $(sel); if(!s) return; s.innerHTML='<option value="">Seleccionar...</option>';
      vias.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; s.appendChild(o); });
  }
  function poblarSelectPautas(sel, opts, def=true) {
      const s = $(sel); if(!s) return; s.innerHTML='<option value="">Seleccionar...</option>';
      opts.forEach(o=>{ const op=document.createElement('option'); op.value=o.value; op.textContent=o.text; s.appendChild(op); });
      if(def && s.querySelector('option[value="q24"]')) s.value='q24';
  }
  function textoPautaDesdeValor(v) { const f=FREQ_OPCIONES.find(o=>o.value===v); return f?f.text:(v||''); }
  
  async function init() {
    if (!Array.isArray(GlobalState.prescripciones)) StateManager.updateState({...GlobalState, prescripciones:[]});
    try { VIA_OPCIONES = await cargarVias(); } catch(e){ VIA_OPCIONES=['Oral','IV','IM','SC']; }
    try { FREQ_OPCIONES = await cargarPautas(); } catch(e){ FREQ_OPCIONES=[{value:'q8',text:'Cada 8h'}]; }
    try { await cargarMedicamentos(); } catch(e){}
    
    poblarSelectVias('#p_via', VIA_OPCIONES);
    poblarSelectVias('#opc_via', VIA_OPCIONES);
    poblarSelectVias('#pun_via', VIA_OPCIONES);
    poblarSelectVias('#dom_via', VIA_OPCIONES);
    poblarSelectPautas('#p_freq', FREQ_OPCIONES, true);
    poblarDatalistMedicamentos('#medicamentos-list', moduleState.medicamentosDB);
    
    ['#p_farmaco','#opc_farmaco','#pun_farmaco','#dom_farmaco'].forEach(id => {
        const i = $(id); if(i) i.addEventListener('input', onFarmacoInput);
    });
    renderTable();
  }

  const VIA_MAP = { 'IV':'Venosa periférica', 'VO':'Oral', 'IM':'Intramuscular', 'SC':'Subcutanea', 'V.C.':'Venosa Central', 'INHALADO':'Inhalada', 'INHAL':'Inhalada', 'SL':'Sublingual', 'TRANSDÉRMICO':'Transdérmico', 'TÓPICO':'Tópico', 'BUCAL':'Bucal', 'NASAL':'Nasal', 'RECTAL':'Rectal', 'VAGINAL':'Vaginal' };
  function findViaValue(sel, cod) {
      if(!sel||!cod) return "";
      const u = cod.toUpperCase(); const l = VIA_MAP[u] || cod;
      for(const o of sel.options) if(o.value.toUpperCase()===l.toUpperCase()) return o.value;
      return "";
  }
  function onFarmacoInput(e) {
      const i=e.target; const val=i.value; const p=i.id.split('_')[0];
      const m=moduleState.medicamentosDB.find(x=>x.value===val);
      if(m) {
          DOMHelpers.setValue(`#${p}_farmaco`, m.nombre);
          DOMHelpers.setValue(`#${p}_dosis`, m.dosis);
          const s=$(`#${p}_via`); if(s) DOMHelpers.setValue(`#${p}_via`, findViaValue(s, m.via));
          if($(`#${p}_indicacion`)) DOMHelpers.setValue(`#${p}_indicacion`, m.indicacion);
      }
  }

  function addPrescripcion() {
    const farmaco = $('#p_farmaco')?.value?.trim() || '';
    const dosis = $('#p_dosis')?.value?.trim() || '';
    const via = $('#p_via')?.value || '';
    const pauta = $('#p_freq')?.value || '';
    const inicio = $('#p_inicio')?.value || '';
    const dias = $('#p_dias')?.value || '';
    const indicacion = $('#p_indicacion')?.value?.trim() || '';
    const obs = $('#p_obs')?.value?.trim() || '';

    if (!farmaco) return showToast('Indica el fármaco', 'warning');
    if (!dosis) return showToast('Indica la dosis', 'warning');
    if (!via) return showToast('Selecciona vía', 'warning');
    if (!pauta) return showToast('Selecciona pauta', 'warning');
    if (!inicio) return showToast('Indica inicio', 'warning');
    if (!dias || Number(dias) <= 0) return showToast('Indica días', 'warning');

    StateActions.addToArray('prescripciones', { farmaco, dosis, via, pauta, inicio, dias, indicacion, obs, timestamp: new Date().toISOString() });
    limpiarFormulario();
    renderTable();
    showToast('Prescripción añadida', 'success');
  }

  function editarPrescripcion(idx) {
    const p = GlobalState.prescripciones[idx];
    if(!p) return;
    DOMHelpers.setValue('#p_farmaco', p.farmaco);
    DOMHelpers.setValue('#p_dosis', p.dosis);
    DOMHelpers.setValue('#p_via', p.via);
    DOMHelpers.setValue('#p_freq', p.pauta);
    DOMHelpers.setValue('#p_inicio', p.inicio);
    DOMHelpers.setValue('#p_dias', p.dias);
    DOMHelpers.setValue('#p_indicacion', p.indicacion);
    DOMHelpers.setValue('#p_obs', p.obs||'');
    DOMHelpers.hideElement('#btnAdd');
    DOMHelpers.showElement('#btnUpdate');
    DOMHelpers.showElement('#btnCancelEdit');
    moduleState.editingIndex = idx;
  }

  function updatePrescripcion() {
    if(moduleState.editingIndex === -1) return;
    const farmaco = $('#p_farmaco')?.value?.trim() || '';
    const dosis = $('#p_dosis')?.value?.trim() || '';
    const via = $('#p_via')?.value || '';
    const pauta = $('#p_freq')?.value || '';
    const inicio = $('#p_inicio')?.value || '';
    const dias = $('#p_dias')?.value || '';
    const indicacion = $('#p_indicacion')?.value?.trim() || '';
    const obs = $('#p_obs')?.value?.trim() || '';

    if (!farmaco) return showToast('Indica el fármaco', 'warning');
    if (!dosis) return showToast('Indica la dosis', 'warning');
    
    const original = GlobalState.prescripciones[moduleState.editingIndex] || {};
    const item = { farmaco, dosis, via, pauta, inicio, dias, indicacion, obs, timestamp: original.timestamp || new Date().toISOString() };
    
    StateActions.updateInArray('prescripciones', moduleState.editingIndex, item);
    cancelarEdicion();
    renderTable();
    showToast('Prescripción actualizada', 'success');
  }

  function eliminarPrescripcion(idx) {
    StateActions.removeFromArray('prescripciones', idx);
    renderTable();
    showToast('Prescripción eliminada', 'info');
  }

  function vaciarTabla() {
    StateActions.clearArray('prescripciones');
    limpiarFormulario();
    renderTable();
    showToast('Tabla vaciada', 'info');
  }

  function renderTable() {
    const tbody = $('#tabla tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const lista = (GlobalState.prescripciones || []).slice().reverse();

    if (lista.length === 0) {
        tbody.innerHTML = `<tr style="text-align:center;color:#64748b"><td colspan="10">No hay prescripciones</td></tr>`;
        return;
    }

    lista.forEach((p, i) => {
        const realIndex = (GlobalState.prescripciones.length - 1) - i;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i+1}</td>
            <td>${p.farmaco}</td>
            <td>${p.dosis}</td>
            <td>${p.via}</td>
            <td>${textoPautaDesdeValor(p.pauta)}</td>
            <td>${p.inicio}</td>
            <td>${p.dias} día(s)</td>
            <td>${p.indicacion||'-'}</td>
            <td>${p.obs||'-'}</td>
            <td>
                <div style="display:flex;gap:4px;justify-content:center">
                    <button class="btn btn-sm edit" data-action="edit-prescripcion" data-index="${realIndex}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm danger" data-action="delete-prescripcion" data-index="${realIndex}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        tr.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index, 10);
            if (action === 'edit-prescripcion') editarPrescripcion(index);
            if (action === 'delete-prescripcion') eliminarPrescripcion(index);
        });
    });
  }

  function limpiarFormulario() {
    DOMHelpers.setValue('#p_farmaco', '');
    DOMHelpers.setValue('#p_dosis', '');
    DOMHelpers.setValue('#p_via', '');
    DOMHelpers.setValue('#p_freq', '');
    DOMHelpers.setValue('#p_inicio', '08:00');
    DOMHelpers.setValue('#p_dias', '1');
    DOMHelpers.setValue('#p_indicacion', '');
    DOMHelpers.setValue('#p_obs', '');
    DOMHelpers.showElement('#btnAdd');
    DOMHelpers.hideElement('#btnUpdate');
    DOMHelpers.hideElement('#btnCancelEdit');
    moduleState.editingIndex = -1;
  }

  function cancelarEdicion() { limpiarFormulario(); }

  // SUSCRIPCIÓN AL ESTADO (Corrección Fallo 2)
  StateManager.subscribe((nuevo, anterior, cambios) => {
    if (cambios.prescripciones !== undefined) renderTable();
  });

  return {
    init, addPrescripcion, updatePrescripcion, cancelarEdicion, vaciar: vaciarTabla,
    add: addPrescripcion, guardar: updatePrescripcion, clear: vaciarTabla
  };
})();

export default PrescripcionesModule;