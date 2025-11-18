// modules/fluidos.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers, TextHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const FluidosModule = (() => {
  const moduleState = { editingIndex: -1 };

  async function init() {
    await cargarDatosFluidos();
    bindEvents();
    toggleCamposSolucion();
    renderTable();
  }

  async function cargarDatosFluidos() {
    try {
      const [soluciones, pautas] = await Promise.all([
        DataLoader.cargarSoluciones?.(),
        DataLoader.cargarPautas?.()
      ]);
      llenarSelectSoluciones(soluciones || []);
      llenarSelectFrecuencia(pautas || []);
    } catch (error) { console.error(error); }
  }

  function llenarSelectSoluciones(soluciones) {
    const select = $('#fluido_solucion');
    if (!select) return;
    const val = select.value;
    select.innerHTML = '<option value="">Seleccionar solución...</option>';
    soluciones.forEach(s => {
      const opt = document.createElement('option');
      opt.value = normalizarTexto(s);
      opt.textContent = s;
      select.appendChild(opt);
    });
    if (val) select.value = val;
  }

  function llenarSelectFrecuencia(pautas) {
    const select = $('#fluido_frecuencia');
    if (!select) return;
    const val = select.value;
    select.innerHTML = '<option value="">Seleccionar...</option>';
    pautas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = normalizarTexto(p);
      opt.textContent = p;
      select.appendChild(opt);
    });
    if (val) select.value = val;
  }

  function normalizarTexto(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function bindEvents() {
    const card = $('#fluidos-card');
    if (card) {
      card.addEventListener('click', handleFluidosClick);
      card.addEventListener('change', handleFluidosChange);
      card.addEventListener('input', handleFluidosInput);
    }
    const viaSelect = $('#fluido_via');
    if (viaSelect) {
      viaSelect.addEventListener('change', function() {
        toggleCamposSolucion();
        if (this.value !== 'con') {
          DOMHelpers.setValue('#fluido_solucion', '');
          DOMHelpers.setValue('#fluido_ritmo', '');
        } else {
          setTimeout(() => calcularRitmoAutomatico(), 100);
        }
      });
    }
  }

  function handleFluidosClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.action;
    const idx = btn.dataset.index ? parseInt(btn.dataset.index, 10) : null;
    if (action === 'edit-fluido' && idx !== null) editarFluido(idx);
    if (action === 'delete-fluido' && idx !== null) eliminarFluido(idx);
    if (action === 'calcular-ritmo') calcularRitmoAutomatico();
  }

  function handleFluidosChange(e) {
    if ((e.target.id === 'fluido_volumen' || e.target.id === 'fluido_frecuencia') && $('#fluido_via').value === 'con') calcularRitmoAutomatico();
  }

  function handleFluidosInput(e) {
    if (e.target.id === 'fluido_volumen' || e.target.id === 'fluido_ritmo') validarCampoNumerico(e.target);
  }

  function toggleCamposSolucion() {
    const via = $('#fluido_via').value;
    ['#campos_fila_superior', '#campos_fila_inferior'].forEach(sel => {
      const el = $(sel);
      if (el) el.style.display = (via === 'con') ? 'contents' : 'none';
    });
  }

  function validarCampoNumerico(campo) {
    const val = parseFloat(campo.value);
    if (campo.value && (isNaN(val) || val <= 0)) campo.classList.add('error');
    else campo.classList.remove('error');
  }

  function addFluido() {
    const via = $('#fluido_via').value;
    const solucion = $('#fluido_solucion').value;
    const volumen = $('#fluido_volumen').value;
    const frecuencia = $('#fluido_frecuencia').value;
    const ritmo = $('#fluido_ritmo').value;
    const obs = ($('#fluido_obs')?.value || '').trim();

    if (!validarFluido(via, solucion, volumen, frecuencia, ritmo)) return;

    const item = {
      via,
      solucion: via === 'con' ? solucion : '',
      volumen,
      frecuencia,
      ritmo: via === 'con' ? ritmo : '',
      obs,
      timestamp: new Date().toISOString()
    };
    StateActions.addToArray('fluidos', item);
    limpiarFormulario();
    renderTable();
    showToast('Fluidoterapia añadida', 'success');
  }

  function editarFluido(idx) {
    const f = GlobalState.fluidos[idx];
    if (!f) return;
    DOMHelpers.setValue('#fluido_via', f.via);
    DOMHelpers.setValue('#fluido_solucion', f.solucion || '');
    DOMHelpers.setValue('#fluido_volumen', f.volumen);
    DOMHelpers.setValue('#fluido_frecuencia', f.frecuencia);
    DOMHelpers.setValue('#fluido_ritmo', f.ritmo || '');
    DOMHelpers.setValue('#fluido_obs', f.obs || '');
    toggleCamposSolucion();
    DOMHelpers.hideElement('#btnAddFluido');
    DOMHelpers.showElement('#btnUpdateFluido');
    DOMHelpers.showElement('#btnCancelEditFluido');
    moduleState.editingIndex = idx;
  }

  function actualizarFluido() {
    if (moduleState.editingIndex === -1) return;
    const via = $('#fluido_via').value;
    const solucion = $('#fluido_solucion').value;
    const volumen = $('#fluido_volumen').value;
    const frecuencia = $('#fluido_frecuencia').value;
    const ritmo = $('#fluido_ritmo').value;
    const obs = ($('#fluido_obs')?.value || '').trim();

    if (!validarFluido(via, solucion, volumen, frecuencia, ritmo)) return;

    const original = GlobalState.fluidos[moduleState.editingIndex] || {};
    const item = {
      via,
      solucion: via === 'con' ? solucion : '',
      volumen,
      frecuencia,
      ritmo: via === 'con' ? ritmo : '',
      obs,
      timestamp: original.timestamp || new Date().toISOString()
    };
    StateActions.updateInArray('fluidos', moduleState.editingIndex, item);
    cancelarEdicion();
    renderTable();
    showToast('Fluidoterapia actualizada', 'success');
  }

  function validarFluido(via, solucion, volumen, frecuencia, ritmo) {
    if (!via) { showToast('Selecciona una vía', 'warning'); return false; }
    if (via === 'con') {
      if (!solucion) { showToast('Selecciona una solución', 'warning'); return false; }
      if (!volumen || isNaN(parseFloat(volumen)) || parseFloat(volumen) <= 0) { showToast('Volumen inválido', 'warning'); return false; }
      if (!ritmo || isNaN(parseFloat(ritmo)) || parseFloat(ritmo) <= 0) { showToast('Ritmo inválido', 'warning'); return false; }
    }
    return true;
  }

  function calcularRitmoAutomatico() {
    const via = $('#fluido_via').value;
    if (via !== 'con') return;
    const vol = parseFloat($('#fluido_volumen').value);
    const freq = $('#fluido_frecuencia').value;
    if (!vol || !freq || isNaN(vol)) return;

    const horasMap = { 'ahora': 0.1, '1h': 1, '2h': 2, '4h': 4, '6h': 6, '8h': 8, '12h': 12, '24h': 24, 'cada_1_hora': 1, 'cada_2_horas': 2, 'cada_4_horas': 4, 'cada_6_horas': 6, 'cada_8_horas': 8, 'cada_12_horas': 12, 'cada_24_horas': 24 };
    const h = horasMap[freq];
    if (h && h > 0) {
      const r = Math.round(vol / h);
      DOMHelpers.setValue('#fluido_ritmo', r);
      showToast(`Ritmo calculado: ${r} ml/h`, 'info', 2000);
    }
  }

  function eliminarFluido(idx) {
    StateActions.removeFromArray('fluidos', idx);
    renderTable();
    showToast('Fluidoterapia eliminada', 'info');
  }

  function vaciarFluidos() {
    StateActions.clearArray('fluidos');
    renderTable();
    showToast('Fluidoterapia vaciada', 'info');
  }

  function renderTable() {
    const tbody = $('#tablaFluidos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const lista = (GlobalState.fluidos || []).slice().reverse();

    if (lista.length === 0) {
      tbody.innerHTML = `<tr style="text-align:center;color:#64748b"><td colspan="8">No hay fluidoterapia registrada</td></tr>`;
      return;
    }

    lista.forEach((f, i) => {
      const realIndex = (GlobalState.fluidos.length - 1) - i;
      const esContinua = f.via === 'con';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${esContinua ? 'Continua' : (f.via === 'salinizada' ? 'Salinizada' : 'Sin vía')}</td>
        <td>${f.solucion ? TextHelpers.solucionText(f.solucion) : '-'}</td>
        <td>${f.volumen ? f.volumen + ' ml' : '-'}</td>
        <td>${f.frecuencia ? TextHelpers.frecuenciaText(f.frecuencia) : '-'}</td>
        <td>${esContinua ? f.ritmo + ' ml/h' : '-'}</td>
        <td>${f.obs || '-'}</td>
        <td>
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn btn-sm edit" data-action="edit-fluido" data-index="${realIndex}"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm danger" data-action="delete-fluido" data-index="${realIndex}"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function limpiarFormulario() {
    DOMHelpers.setValue('#fluido_via', 'sin');
    DOMHelpers.setValue('#fluido_solucion', '');
    DOMHelpers.setValue('#fluido_volumen', '');
    DOMHelpers.setValue('#fluido_frecuencia', '');
    DOMHelpers.setValue('#fluido_ritmo', '');
    DOMHelpers.setValue('#fluido_obs', '');
    toggleCamposSolucion();
    $$('#fluidos-card .error').forEach(el => el.classList.remove('error'));
  }

  function cancelarEdicion() {
    limpiarFormulario();
    DOMHelpers.showElement('#btnAddFluido');
    DOMHelpers.hideElement('#btnUpdateFluido');
    DOMHelpers.hideElement('#btnCancelEditFluido');
    moduleState.editingIndex = -1;
  }

  // SUSCRIPCIÓN AL ESTADO (Corrección Fallo 2)
  StateManager.subscribe((nuevo, anterior, cambios) => {
    if (cambios.fluidos !== undefined) renderTable();
  });

  return {
    init, addFluido, updateFluido: actualizarFluido, cancelarEdicion,
    add: addFluido, editar: editarFluido, eliminar: eliminarFluido, vaciar: vaciarFluidos, calcularRitmo: calcularRitmoAutomatico
  };
})();

export default FluidosModule;