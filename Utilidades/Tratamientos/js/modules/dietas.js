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
      if (action === 'edit-dieta') {
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx)) editarDieta(idx);
        return;
      }
      if (action === 'delete-dieta') {
        const idx = parseInt(btn.dataset.index, 10);
        if (!isNaN(idx)) eliminarDieta(idx);
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

  // Si tipo = "absoluta", consistencia NO es obligatoria
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
      observaciones: item.observaciones
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

    const actualizado = {
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

  // ===== Layout: 4 arriba en una fila, Observaciones debajo =====
  function aplicarLayoutFilaSuperiorYObservaciones() {
    // IDs de los campos que deben ir en la fila superior
    const idsFilaSuperior = [
      '#dieta_tipo', 
      '#dieta_consistencia', 
      '#dieta_celiaquia', 
      '#dieta_intolerancia_select'
    ];
    
    // Encontrar todos los grupos de formulario
    const gruposFilaSuperior = idsFilaSuperior
      .map(id => $(id))
      .filter(Boolean)
      .map(el => el.closest('.form-group'))
      .filter(Boolean);

    if (gruposFilaSuperior.length === 0) return;

    // Encontrar el contenedor común más cercano
    const contenedorComun = encontrarContenedorComun(gruposFilaSuperior);
    if (!contenedorComun) return;

    // Configurar el contenedor común como flex
    contenedorComun.style.display = 'flex';
    contenedorComun.style.flexWrap = 'wrap';
    contenedorComun.style.gap = '12px';
    contenedorComun.style.alignItems = 'flex-end';
    contenedorComun.style.overflowX = 'auto';
    contenedorComun.style.paddingBottom = '2px';

    // Aplicar estilos a los grupos de la fila superior
    gruposFilaSuperior.forEach(grupo => {
      aplanarContenedoresIntermedios(contenedorComun, grupo);
      
      grupo.style.display = 'flex';
      grupo.style.flexDirection = 'column';
      grupo.style.gap = '4px';
      grupo.style.flex = '1 1 23%'; // Ajustado para 4 elementos con gap
      grupo.style.minWidth = '200px';
      grupo.style.maxWidth = '280px';
    });

    // Manejar el grupo de observaciones
    const grupoObservaciones = $('#dieta_obs')?.closest('.form-group');
    if (grupoObservaciones && contenedorComun.contains(grupoObservaciones)) {
      aplanarContenedoresIntermedios(contenedorComun, grupoObservaciones);
      
      grupoObservaciones.style.display = 'flex';
      grupoObservaciones.style.flexDirection = 'column';
      grupoObservaciones.style.gap = '4px';
      grupoObservaciones.style.flex = '1 1 100%';
      grupoObservaciones.style.minWidth = '100%';
      grupoObservaciones.style.order = '999'; // Forzar que esté al final
    }
  }

  // Función auxiliar para encontrar el contenedor común
  function encontrarContenedorComun(elements) {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0].parentElement;

    const paths = elements.map(el => {
      const path = [];
      let current = el;
      while (current) {
        path.push(current);
        current = current.parentElement;
      }
      return path;
    });

    let commonAncestor = null;
    for (let i = 0; i < paths[0].length; i++) {
      const candidate = paths[0][i];
      if (paths.every(path => path.includes(candidate))) {
        commonAncestor = candidate;
      } else {
        break;
      }
    }

    return commonAncestor;
  }

  // Función auxiliar para aplanar contenedores intermedios
  function aplanarContenedoresIntermedios(contenedorPadre, elemento) {
    let current = elemento.parentElement;
    while (current && current !== contenedorPadre) {
      if (current !== document.body && current !== document.documentElement) {
        current.style.display = 'contents';
      }
      current = current.parentElement;
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
      consSel.title = 'No aplicable para dieta absoluta';
    } else {
      consSel.disabled = false;
      consSel.style.opacity = '1';
      consSel.title = '';
    }
  }

  // ===== Render =====
  function renderTable() {
    const tbody = $('#tablaDietas tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const lista = GlobalState.dietas || [];
    if (lista.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="text-align:center;color:#64748b">No hay dietas registradas</td>`;
      tbody.appendChild(tr);
      return;
    }

    lista.forEach((d, idx) => {
      const intoleranciasTxt = (d.intolerancias || [])
        .map(v => v.replace(/_/g, ' '))
        .join(', ') || '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${d.tipo_text || d.tipo || '-'}</td>
        <td>${d.consistencia_text || d.consistencia || '-'}</td>
        <td>${d.celiaquia === 'si' ? 'Sí celíaco' : d.celiaquia === 'sensibilidad' ? 'Sensibilidad gluten' : 'No'}</td>
        <td>${intoleranciasTxt}</td>
        <td>${d.observaciones || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-dieta" data-index="${idx}" title="Editar"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm danger" data-action="delete-dieta" data-index="${idx}" title="Eliminar"><i class="fas fa-trash"></i></button>
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