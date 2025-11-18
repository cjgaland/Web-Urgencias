// modules/dietas.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const DietasModule = (() => {
  const moduleState = {
    editingIndex: -1,
    intoleranciasSeleccionadas: []
  };

  const safeToast = (msg, type = 'info', ms = 2000) => {
    try { if (typeof showToast === 'function') showToast(msg, type, ms); } catch(_) {}
  };

  const norm = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();

  const findOptionText = (sel) => {
    const val = sel.value;
    const opt = sel.querySelector(`option[value="${val}"]`);
    return opt ? opt.textContent : '';
  };

  // ===== Carga e init =====
  async function init() {
    await cargarDatosDietas();
    bindEvents();
    limpiarFormulario(true);
    toggleConsistenciaAvailability();
    aplicarLayoutFilaSuperiorYObservaciones();
    renderTable();
  }

  async function cargarDatosDietas() {
    try {
      const [dietas, consistencias, intolerancias] = await Promise.all([
        DataLoader.cargarDietas?.() || [],
        DataLoader.cargarConsistencias?.() || [],
        DataLoader.cargarIntolerancias?.() || []
      ]);

      const selTipo = $('#dieta_tipo');
      if (selTipo) {
        selTipo.innerHTML = '<option value="">Seleccionar...</option>';
        dietas.forEach(d => {
          const op = document.createElement('option');
          op.value = norm(d);
          op.textContent = d;
          selTipo.appendChild(op);
        });
      }

      const selCons = $('#dieta_consistencia');
      if (selCons) {
        selCons.innerHTML = '<option value="">Seleccionar...</option>';
        consistencias.forEach(c => {
          const op = document.createElement('option');
          op.value = norm(c);
          op.textContent = c;
          selCons.appendChild(op);
        });
      }

      const selInt = $('#dieta_intolerancia_select');
      if (selInt) {
        selInt.innerHTML = '<option value="">Seleccionar intolerancia...</option>';
        intolerancias.forEach(t => {
          const op = document.createElement('option');
          op.value = norm(t);
          op.textContent = t;
          selInt.appendChild(op);
        });
      }

    } catch (err) {
      console.error('Dietas: error cargando listas', err);
      safeToast('No se pudieron cargar las listas de Dietas', 'error');
    }
  }

  // ===== Eventos =====
  function bindEvents() {
    const card = $('#dietas-card') || document;

    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.id === 'btnAddIntolerancia') { addIntolerancia(); return; }
      if (btn.id === 'btnAddDieta')       { addDieta(); return; }
      if (btn.id === 'btnUpdateDieta')    { updateDieta(); return; }
      if (btn.id === 'btnCancelEditDieta'){ cancelarEdicion(); return; }
      if (btn.id === 'btnVaciarDietas')   { vaciarDietas(); return; }

      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.index, 10);

      if (action === 'edit-dieta' && !isNaN(idx)) {
        editarDieta(idx);
        return;
      }
      if (action === 'delete-dieta' && !isNaN(idx)) {
        eliminarDieta(idx);
        return;
      }

      if (btn.dataset.intoleranciaChip === 'remove') {
        const val = btn.dataset.value;
        removeIntolerancia(val);
        return;
      }
    });

    $('#dieta_intolerancia_select')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addIntolerancia();
      }
    });

    $('#dieta_tipo')?.addEventListener('change', () => {
      toggleConsistenciaAvailability();
    });
  }

  // ===== Intolerancias (chips) =====
  function addIntolerancia() {
    const sel = $('#dieta_intolerancia_select');
    if (!sel) return;

    const val = sel.value;
    if (!val) { safeToast('Selecciona una intolerancia', 'warning', 1500); return; }

    if (moduleState.intoleranciasSeleccionadas.includes(val)) {
      safeToast('Esa intolerancia ya está añadida', 'info', 1500);
      return;
    }
    moduleState.intoleranciasSeleccionadas.push(val);
    pintarIntoleranciasChips();
  }

  function removeIntolerancia(val) {
    moduleState.intoleranciasSeleccionadas =
      moduleState.intoleranciasSeleccionadas.filter(v => v !== val);
    pintarIntoleranciasChips();
  }

  function pintarIntoleranciasChips() {
    const wrap = $('#intolerancias-list');
    const sel = $('#dieta_intolerancia_select');
    if (!wrap) return;

    wrap.innerHTML = '';
    moduleState.intoleranciasSeleccionadas.forEach(v => {
      const label = sel?.querySelector(`option[value="${v}"]`)?.textContent || v;
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.marginRight = '6px';
      chip.innerHTML = `
        ${label}
        <button class="chip-remove" data-intolerancia-chip="remove" data-value="${v}" title="Quitar">×</button>
      `;
      wrap.appendChild(chip);
    });
  }

  // ===== CRUD =====
  function leerFormulario() {
    const tipoSel = $('#dieta_tipo');
    const consSel = $('#dieta_consistencia');
    const celSel  = $('#dieta_celiaquia');
    const obs     = $('#dieta_obs');

    return {
      tipoVal: tipoSel?.value || '',
      tipoTxt: tipoSel ? findOptionText(tipoSel) : '',
      consVal: consSel?.value || '',
      consTxt: consSel ? findOptionText(consSel) : '',
      celVal:  celSel?.value || 'no',
      celTxt:  celSel ? findOptionText(celSel) : 'No',
      intolerancias: [...moduleState.intoleranciasSeleccionadas],
      observaciones: obs?.value?.trim() || ''
    };
  }

  function validar(item) {
    if (!item.tipoVal) { safeToast('Selecciona un tipo de dieta', 'warning', 1500); return false; }
    const esAbsoluta = item.tipoVal === 'absoluta';
    if (!esAbsoluta && !item.consVal) {
      safeToast('Selecciona la consistencia', 'warning', 1500);
      return false;
    }
    return true;
  }

  function addDieta() {
    const item = leerFormulario();
    if (item.tipoVal === 'absoluta') { item.consVal = ''; item.consTxt = ''; }
    if (!validar(item)) return;

    const nuevo = {
      tipo: item.tipoVal,
      tipo_text: item.tipoTxt,
      consistencia: item.consVal || '',
      consistencia_text: item.consTxt || '',
      celiaquia: item.celVal,
      intolerancias: item.intolerancias,
      observaciones: item.observaciones,
      timestamp: new Date().toISOString() // FALLO 7: Añadida fecha
    };

    if (StateActions?.addToArray) {
      StateActions.addToArray('dietas', nuevo);
    } else {
      const newState = { ...GlobalState };
      newState.dietas = [...(newState.dietas || []), nuevo];
      StateManager.updateState(newState);
    }

    safeToast('Dieta añadida', 'success', 1200);
    limpiarFormulario(true);
    toggleConsistenciaAvailability();
    renderTable();
  }

  function editarDieta(index) {
    const d = GlobalState.dietas?.[index];
    if (!d) return;

    DOMHelpers.setValue('#dieta_tipo', d.tipo);
    DOMHelpers.setValue('#dieta_consistencia', d.consistencia || '');
    DOMHelpers.setValue('#dieta_celiaquia', d.celiaquia || 'no');
    DOMHelpers.setValue('#dieta_obs', d.observaciones || '');

    moduleState.intoleranciasSeleccionadas = [...(d.intolerancias || [])];
    pintarIntoleranciasChips();

    toggleConsistenciaAvailability();

    DOMHelpers.hideElement('#btnAddDieta');
    DOMHelpers.showElement('#btnUpdateDieta');
    DOMHelpers.showElement('#btnCancelEditDieta');

    moduleState.editingIndex = index;
  }

  function updateDieta() {
    if (moduleState.editingIndex === -1) return;

    const item = leerFormulario();
    if (item.tipoVal === 'absoluta') { item.consVal = ''; item.consTxt = ''; }
    if (!validar(item)) return;

    const original = GlobalState.dietas[moduleState.editingIndex] || {};

    const actualizado = {
      ...original, // Mantener timestamp original
      tipo: item.tipoVal,
      tipo_text: item.tipoTxt,
      consistencia: item.consVal || '',
      consistencia_text: item.consTxt || '',
      celiaquia: item.celVal,
      intolerancias: item.intolerancias,
      observaciones: item.observaciones
    };

    if (StateActions?.updateInArray) {
      StateActions.updateInArray('dietas', moduleState.editingIndex, actualizado);
    } else {
      const newState = { ...GlobalState };
      newState.dietas = newState.dietas.map((d, i) => i === moduleState.editingIndex ? actualizado : d);
      StateManager.updateState(newState);
    }

    safeToast('Dieta actualizada', 'success', 1200);
    cancelarEdicion();
    toggleConsistenciaAvailability();
    renderTable();
  }

  function cancelarEdicion() {
    limpiarFormulario(true);
    DOMHelpers.showElement('#btnAddDieta');
    DOMHelpers.hideElement('#btnUpdateDieta');
    DOMHelpers.hideElement('#btnCancelEditDieta');
    moduleState.editingIndex = -1;
  }

  function eliminarDieta(index) {
    if (StateActions?.removeFromArray) {
      StateActions.removeFromArray('dietas', index);
    } else {
      const newState = { ...GlobalState };
      newState.dietas = newState.dietas.filter((_, i) => i !== index);
      StateManager.updateState(newState);
    }
    safeToast('Dieta eliminada', 'info', 1000);
    renderTable();
  }

  function vaciarDietas() {
    if (StateActions?.clearArray) {
      StateActions.clearArray('dietas');
    } else {
      const newState = { ...GlobalState };
      newState.dietas = [];
      StateManager.updateState(newState);
    }
    safeToast('Lista de dietas vaciada', 'info');
    renderTable();
  }

  function limpiarFormulario(resetCeliaquia = false) {
    DOMHelpers.setValue('#dieta_tipo', '');
    DOMHelpers.setValue('#dieta_consistencia', '');
    if (resetCeliaquia) DOMHelpers.setValue('#dieta_celiaquia', 'no');
    DOMHelpers.setValue('#dieta_obs', '');
    moduleState.intoleranciasSeleccionadas = [];
    pintarIntoleranciasChips();
  }

  function aplicarLayoutFilaSuperiorYObservaciones() {
    const idsFilaSuperior = ['#dieta_tipo', '#dieta_consistencia', '#dieta_celiaquia', '#dieta_intolerancia_select'];
    const gruposFilaSuperior = idsFilaSuperior.map(id => $(id)).filter(Boolean).map(el => el.closest('.form-group')).filter(Boolean);
    if (gruposFilaSuperior.length === 0) return;

    const contenedorComun = encontrarContenedorComun(gruposFilaSuperior);
    if (!contenedorComun) return;

    contenedorComun.style.display = 'flex';
    contenedorComun.style.flexWrap = 'wrap';
    contenedorComun.style.gap = '12px';
    contenedorComun.style.alignItems = 'flex-end';

    gruposFilaSuperior.forEach(grupo => {
      aplanarContenedoresIntermedios(contenedorComun, grupo);
      grupo.style.flex = '1 1 20%';
      grupo.style.minWidth = '150px';
    });

    const grupoObservaciones = $('#dieta_obs')?.closest('.form-group');
    if (grupoObservaciones && contenedorComun.contains(grupoObservaciones)) {
      aplanarContenedoresIntermedios(contenedorComun, grupoObservaciones);
      grupoObservaciones.style.flex = '1 1 100%';
      grupoObservaciones.style.width = '100%';
    }
  }

  function encontrarContenedorComun(elements) {
    if (!elements.length) return null;
    return elements[0].parentElement; // Simplificación asumiendo estructura conocida
  }

  function aplanarContenedoresIntermedios(contenedorPadre, elemento) {
    // Simplificado para este caso de uso
    if (elemento.parentElement !== contenedorPadre) {
       // Lógica de aplanamiento si fuera necesaria
    }
  }

  function toggleConsistenciaAvailability() {
    const tipoSel = $('#dieta_tipo');
    const consSel = $('#dieta_consistencia');
    if (!tipoSel || !consSel) return;

    const esAbsoluta = tipoSel.value === 'absoluta';
    if (esAbsoluta) {
      consSel.disabled = true;
      consSel.value = '';
      consSel.style.opacity = '0.6';
    } else {
      consSel.disabled = false;
      consSel.style.opacity = '1';
    }
  }

  // ===== Render =====
  function renderTable() {
    const tbody = $('#tablaDietas tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // FALLO 4: Invertir el orden para visualización
    const listaOriginal = GlobalState.dietas || [];
    const listaInvertida = listaOriginal.slice().reverse();

    if (listaInvertida.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align:center;color:#64748b">No hay dietas registradas</td>`;
      tbody.appendChild(tr);
      return;
    }

    listaInvertida.forEach((d, visualIdx) => {
      // Calculamos el índice real en el array original para los botones de acción
      const realIndex = listaOriginal.length - 1 - visualIdx;

      const intoleranciasTxt = (d.intolerancias || []).map(v => v.replace(/_/g, ' ')).join(', ') || '-';
      
      // FALLO 7: Formato fecha
      const fechaFmt = d.timestamp ? new Date(d.timestamp).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'}) : '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${visualIdx + 1}</td>
        <td>${fechaFmt}</td>
        <td>${d.tipo_text || d.tipo || '-'}</td>
        <td>${d.consistencia_text || d.consistencia || '-'}</td>
        <td>${d.celiaquia === 'si' ? 'Sí celíaco' : d.celiaquia === 'sensibilidad' ? 'Sensibilidad' : 'No'}</td>
        <td>${intoleranciasTxt}</td>
        <td>${d.observaciones || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-dieta" data-index="${realIndex}" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm danger" data-action="delete-dieta" data-index="${realIndex}" title="Eliminar"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  StateManager.subscribe((nuevo, anterior, cambios) => {
    if (cambios.dietas !== undefined) renderTable();
  });

  return {
    init,
    addDieta,
    updateDieta,
    cancelarEdicion,
    eliminarDieta,
    addIntolerancia,
    vaciar: vaciarDietas,
    getDietas: () => [...(GlobalState.dietas || [])],
    setDietas: (nuevasDietas) => {
      const newState = { ...GlobalState, dietas: nuevasDietas };
      StateManager.updateState(newState);
      renderTable();
    }
  };
})();

export default DietasModule;