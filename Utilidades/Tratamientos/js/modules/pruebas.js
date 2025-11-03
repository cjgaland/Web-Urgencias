// modules/pruebas.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const PruebasModule = (() => {
  const st = {
    editIndex: -1,
    especialidades: [],
    hojasSeleccionadas: [] // array de valores (texto de especialidad)
  };

  // ---------- INIT ----------
  async function init() {
    const card = $('#pruebas-card');
    if (!card) {
      console.warn('[Pruebas] No se encuentra #pruebas-card');
      return;
    }

    // Cargar especialidades para el desplegable
    try {
      if (typeof DataLoader.cargarEspecialidades === 'function') {
        st.especialidades = await DataLoader.cargarEspecialidades();
      } else {
        st.especialidades = [];
      }
      rellenarEspecialidades();
    } catch (e) {
      console.warn('No se pudieron cargar especialidades:', e);
    }

    wireUI();

    // Normaliza estado
    if (!Array.isArray(GlobalState.pruebas)) {
      StateManager.updateState({ pruebas: [] });
    }

    // Eventos (único delegado y bloqueo submit)
    bindEvents();

    renderTable();
  }

  function rellenarEspecialidades() {
    const sel = $('#pr_hc_esp');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar especialidad...</option>';
    for (let i = 0; i < st.especialidades.length; i++) {
      const esp = st.especialidades[i];
      const op = document.createElement('option');
      op.value = esp; // usamos texto directo
      op.textContent = esp;
      sel.appendChild(op);
    }
  }

  // ---------- UI wiring ----------
  function wireUI() {
    attachRadioGroup('pr_ana', updateAna);
    attachRadioGroup('pr_rx', updateRx);
    attachRadioGroup('pr_otras', updateOtras);
    attachRadioGroup('pr_hc', updateHC);

    // Inicial
    updateAna();
    updateRx();
    updateOtras();
    updateHC();

    // Fuerza disposición inline (radios + opciones en la misma fila)
    ensureInlineRow('pr_ana',  'pr_ana_block');
    ensureInlineRow('pr_rx',   'pr_rx_block');
    ensureInlineRow('pr_otras','pr_otras_block');
    ensureInlineRow('pr_hc',   'pr_hc_block');
  }

  // === NUEVO: forzar layout inline sin tocar tu HTML ===
  function ensureInlineRow(groupName, blockId) {
    const anyRadio = document.querySelector(`input[name="${groupName}"]`);
    if (!anyRadio) return;
    const fg = anyRadio.closest('.form-group');
    if (!fg) return;

    // En tu HTML: <label> + <div (radios)> + <div (block)>
    const divChildren = Array.from(fg.children).filter(n => n.tagName === 'DIV');
    const radiosDiv = divChildren[0];
    const blockDiv  = document.getElementById(blockId);

    if (radiosDiv) {
      radiosDiv.style.display     = 'inline-flex';
      radiosDiv.style.alignItems  = 'center';
      radiosDiv.style.gap         = radiosDiv.style.gap || '12px';
      radiosDiv.style.flexWrap    = 'wrap';
      radiosDiv.style.marginRight = '8px';
    }
    if (blockDiv) {
      if (blockDiv.style.display === 'flex') {
        blockDiv.style.display = 'inline-flex';
      }
      blockDiv.style.alignItems = 'center';
      blockDiv.style.gap        = blockDiv.style.gap || '8px';
      blockDiv.style.flexWrap   = 'wrap';
      blockDiv.style.marginTop  = '0';
    }
  }

  function attachRadioGroup(name, handler) {
    const radios = document.querySelectorAll('input[name="' + name + '"]');
    for (let i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', handler);
    }
  }

  function getRadioValue(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : 'no';
  }

  function updateAna() {
    const yes = getRadioValue('pr_ana') === 'si';
    const b = $('#pr_ana_block');
    if (b) b.style.display = yes ? 'inline-flex' : 'none';
  }
  function updateRx() {
    const yes = getRadioValue('pr_rx') === 'si';
    const b = $('#pr_rx_block');
    if (b) b.style.display = yes ? 'inline-flex' : 'none';
  }
  function updateOtras() {
    const yes = getRadioValue('pr_otras') === 'si';
    const b = $('#pr_otras_block');
    if (b) b.style.display = yes ? 'inline-flex' : 'none';
  }
  function updateHC() {
    const yes = getRadioValue('pr_hc') === 'si';
    const b = $('#pr_hc_block');
    if (b) b.style.display = yes ? 'inline-flex' : 'none';
  }

  // ---------- Chips Hojas de consulta ----------
  function addHC() {
    const sel = $('#pr_hc_esp');
    if (!sel) return;
    const val = sel.value;
    if (!val) {
      safeToast('Selecciona una especialidad', 'warning');
      return;
    }
    if (st.hojasSeleccionadas.indexOf(val) !== -1) {
      safeToast('Esa especialidad ya está añadida', 'info');
      return;
    }
    st.hojasSeleccionadas.push(val);
    pintarHCChips();
  }

  function removeHC(val) {
    st.hojasSeleccionadas = st.hojasSeleccionadas.filter(function(v){ return v !== val; });
    pintarHCChips();
  }

  function pintarHCChips() {
    const wrap = $('#pr_hc_chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < st.hojasSeleccionadas.length; i++) {
      const v = st.hojasSeleccionadas[i];
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.marginRight = '6px';
      chip.innerHTML =
        v +
        ' <button class="chip-remove" data-chip="hc-remove" data-value="' + esc(v) + '" title="Quitar">×</button>';
      wrap.appendChild(chip);
    }
  }

  // ---------- Formulario, validación y helpers ----------
  function leerFormulario() {
    // Analíticas
    const anaSi = getRadioValue('pr_ana') === 'si';
    const ana = anaSi ? {
      hemo: getChecked('ana_hemo'),
      bioq: getChecked('ana_bioq'),
      coag: getChecked('ana_coag'),
      orina: getChecked('ana_orina'),
      hemoc: getChecked('ana_hemoc'),
      uroc: getChecked('ana_uroc')
    } : null;

    // Radiología
    const rxSi = getRadioValue('pr_rx') === 'si';
    const rx = rxSi ? {
      simple: getChecked('rx_simple'),
      eco: getChecked('rx_eco'),
      tac_c: getChecked('rx_tac_c'),
      tac_s: getChecked('rx_tac_s'),
      rmn: getChecked('rx_rmn')
    } : null;

    // Otras
    const otrasSi = getRadioValue('pr_otras') === 'si';
    const otras = otrasSi ? {
      eda: getChecked('ot_eda'),
      colo: getChecked('ot_colo'),
      bronco: getChecked('ot_bronco')
    } : null;

    // Hojas de consulta
    const hcSi = getRadioValue('pr_hc') === 'si';
    const hc = hcSi ? st.hojasSeleccionadas.slice() : [];

    // Observaciones
    const obsEl = $('#pr_obs');
    const obs = obsEl ? (obsEl.value || '').trim() : '';

    return {
      analiticas: ana,   // null o objeto con tests
      radiologia: rx,    // null o objeto con tests
      otras: otras,      // null o objeto con tests
      hojasConsulta: hc, // array
      obs: obs
    };
  }

  // ✅ Comprobar si el registro está vacío (nada seleccionado ni texto)
  function isEmptyPruebas(item) {
    const anyAna  = !!(item.analiticas && anyTrue(item.analiticas));
    const anyRx   = !!(item.radiologia && anyTrue(item.radiologia));
    const anyOtr  = !!(item.otras && anyTrue(item.otras));
    const anyHC   = Array.isArray(item.hojasConsulta) && item.hojasConsulta.length > 0;
    const anyObs  = !!(item.obs && item.obs.trim());
    return !(anyAna || anyRx || anyOtr || anyHC || anyObs);
  }

  function validar(item) {
    // Si una sección es "Sí", debe haber al menos una subprueba marcada
    if (item.analiticas) {
      if (!anyTrue(item.analiticas)) { safeToast('Selecciona al menos una analítica', 'warning'); return false; }
    }
    if (item.radiologia) {
      if (!anyTrue(item.radiologia)) { safeToast('Selecciona al menos una prueba de radiología', 'warning'); return false; }
    }
    if (item.otras) {
      if (!anyTrue(item.otras)) { safeToast('Selecciona al menos una prueba en "Otras"', 'warning'); return false; }
    }
    if (getRadioValue('pr_hc') === 'si' && item.hojasConsulta.length === 0) {
      safeToast('Añade al menos una Hoja de consulta', 'warning'); return false;
    }
    return true;
  }

  function anyTrue(obj) {
    const vals = Object.keys(obj).map(function(k){ return !!obj[k]; });
    for (let i = 0; i < vals.length; i++) if (vals[i]) return true;
    return false;
  }

  function getChecked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }

  function setRadio(name, value) {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  // ---------- CRUD ----------
  function bindEvents() {
    const card = $('#pruebas-card');
    if (!card) return;

    // Evita que el submit del <form> recargue la página o duplique acciones
    const form = card.closest('form');
    if (form) {
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    // Clicks (único delegado)
    card.addEventListener('click', function(e){
      const btn = e.target.closest('button');
      if (!btn) return;

      // Evita submit/recarga accidental
      e.preventDefault();

      if (btn.id === 'btnAddPruebas') { onAdd(); return; }
      if (btn.id === 'btnUpdatePruebas') { onUpdate(); return; }
      if (btn.id === 'btnCancelEditPruebas') { onCancel(); return; }
      if (btn.id === 'btnVaciarPruebas') { onVaciar(); return; }

      // Chips remove
      const chipAct = btn.getAttribute('data-chip');
      if (chipAct === 'hc-remove') {
        const val = btn.getAttribute('data-value');
        removeHC(val);
        return;
      }

      // Acciones tabla
      const action = btn.getAttribute('data-action');
      const idxStr = btn.getAttribute('data-index');
      const idx = idxStr ? parseInt(idxStr, 10) : NaN;
      if (!isNaN(idx)) {
        if (action === 'edit') onEdit(idx);
        if (action === 'del') onDelete(idx);
      }
    });

    // Botón añadir hoja de consulta
    const btnAddHC = $('#btnAddHC');
    if (btnAddHC) {
      btnAddHC.addEventListener('click', function(e){
        e.preventDefault();
        addHC();
      });
    }
  }

  function onAdd() {
    const item = leerFormulario();

    // ⛔ No crear filas en blanco
    if (isEmptyPruebas(item)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validar(item)) return;

    const arr = Array.isArray(GlobalState.pruebas) ? GlobalState.pruebas.slice() : [];
    arr.push(item);
    StateManager.updateState({ pruebas: arr });

    renderTable();
    limpiarFormulario();
    showToast('Registro añadido', 'success');
  }

  function onEdit(i) {
    const item = Array.isArray(GlobalState.pruebas) ? GlobalState.pruebas[i] : null;
    if (!item) return;

    // Analíticas
    if (item.analiticas) {
      setRadio('pr_ana', 'si'); updateAna();
      setChecked('ana_hemo', !!item.analiticas.hemo);
      setChecked('ana_bioq', !!item.analiticas.bioq);
      setChecked('ana_coag', !!item.analiticas.coag);
      setChecked('ana_orina', !!item.analiticas.orina);
      setChecked('ana_hemoc', !!item.analiticas.hemoc);
      setChecked('ana_uroc', !!item.analiticas.uroc);
    } else {
      setRadio('pr_ana', 'no'); updateAna();
      clearAna();
    }

    // Radiología
    if (item.radiologia) {
      setRadio('pr_rx', 'si'); updateRx();
      setChecked('rx_simple', !!item.radiologia.simple);
      setChecked('rx_eco', !!item.radiologia.eco);
      setChecked('rx_tac_c', !!item.radiologia.tac_c);
      setChecked('rx_tac_s', !!item.radiologia.tac_s);
      setChecked('rx_rmn', !!item.radiologia.rmn);
    } else {
      setRadio('pr_rx', 'no'); updateRx();
      clearRx();
    }

    // Otras
    if (item.otras) {
      setRadio('pr_otras', 'si'); updateOtras();
      setChecked('ot_eda', !!item.otras.eda);
      setChecked('ot_colo', !!item.otras.colo);
      setChecked('ot_bronco', !!item.otras.bronco);
    } else {
      setRadio('pr_otras', 'no'); updateOtras();
      clearOtras();
    }

    // Hojas de consulta
    if (item.hojasConsulta && item.hojasConsulta.length > 0) {
      setRadio('pr_hc', 'si'); updateHC();
      st.hojasSeleccionadas = item.hojasConsulta.slice();
    } else {
      setRadio('pr_hc', 'no'); updateHC();
      st.hojasSeleccionadas = [];
    }
    pintarHCChips();

    // Obs
    const obsEl = $('#pr_obs');
    if (obsEl) obsEl.value = item.obs || '';

    st.editIndex = i;
    toggleEdit(true);
  }

  function onUpdate() {
    if (st.editIndex < 0) return;

    const item = leerFormulario();

    // ⛔ No guardar vacío tras editar
    if (isEmptyPruebas(item)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validar(item)) return;

    const arr = Array.isArray(GlobalState.pruebas) ? GlobalState.pruebas.slice() : [];
    arr[st.editIndex] = item;
    StateManager.updateState({ pruebas: arr });

    renderTable();
    onCancel();
    showToast('Registro actualizado', 'success');
  }

  function onDelete(i) {
    const arr = Array.isArray(GlobalState.pruebas) ? GlobalState.pruebas.slice() : [];
    arr.splice(i, 1);
    StateManager.updateState({ pruebas: arr });
    renderTable();
    showToast('Registro eliminado', 'info');
  }

  function onVaciar() {
    StateManager.updateState({ pruebas: [] });
    renderTable();
    limpiarFormulario();
    showToast('Lista vaciada', 'info');
  }

  function onCancel() {
    limpiarFormulario();
    toggleEdit(false);
  }

  // ---------- Limpieza y render ----------
  function clearAna() {
    setChecked('ana_hemo', false);
    setChecked('ana_bioq', false);
    setChecked('ana_coag', false);
    setChecked('ana_orina', false);
    setChecked('ana_hemoc', false);
    setChecked('ana_uroc', false);
  }
  function clearRx() {
    setChecked('rx_simple', false);
    setChecked('rx_eco', false);
    setChecked('rx_tac_c', false);
    setChecked('rx_tac_s', false);
    setChecked('rx_rmn', false);
  }
  function clearOtras() {
    setChecked('ot_eda', false);
    setChecked('ot_colo', false);
    setChecked('ot_bronco', false);
  }

  function limpiarFormulario() {
    setRadio('pr_ana', 'no'); updateAna(); clearAna();
    setRadio('pr_rx', 'no'); updateRx(); clearRx();
    setRadio('pr_otras', 'no'); updateOtras(); clearOtras();
    setRadio('pr_hc', 'no'); updateHC();
    st.hojasSeleccionadas = []; pintarHCChips();

    const obsEl = $('#pr_obs');
    if (obsEl) obsEl.value = '';

    st.editIndex = -1;
  }

  function renderTable() {
    const tbody = $('#tablaPruebas tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const arr = Array.isArray(GlobalState.pruebas) ? GlobalState.pruebas : [];

    if (arr.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" style="text-align:center;color:#64748b;">Sin registros</td>';
      tbody.appendChild(tr);
      return;
    }

    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      const tr = document.createElement('tr');

      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + (fmtAna(r.analiticas) || '—') + '</td>' +
        '<td>' + (fmtRx(r.radiologia) || '—') + '</td>' +
        '<td>' + (fmtOtras(r.otras) || '—') + '</td>' +
        '<td>' + (r.hojasConsulta && r.hojasConsulta.length ? esc(r.hojasConsulta.join(', ')) : '—') + '</td>' +
        '<td>' + esc(r.obs || '') + '</td>' +
        '<td>' +
          '<div style="display:flex;gap:6px;justify-content:center;">' +
            '<button class="btn btn-sm" data-action="edit" data-index="' + i + '" title="Editar"><i class="fas fa-pen"></i></button>' +
            '<button class="btn btn-sm danger" data-action="del" data-index="' + i + '" title="Eliminar"><i class="fas fa-trash"></i></button>' +
          '</div>' +
        '</td>';

      tbody.appendChild(tr);
    }
  }

  function fmtAna(a) {
    if (!a) return '';
    const out = [];
    if (a.hemo) out.push('Hemograma');
    if (a.bioq) out.push('Bioquímica');
    if (a.coag) out.push('Coagulación');
    if (a.orina) out.push('Orina');
    if (a.hemoc) out.push('Hemocultivo');
    if (a.uroc) out.push('Urocultivo');
    return out.join(', ');
  }
  function fmtRx(r) {
    if (!r) return '';
    const out = [];
    if (r.simple) out.push('Rx simple');
    if (r.eco) out.push('ECO');
    if (r.tac_c) out.push('TAC +C');
    if (r.tac_s) out.push('TAC -C');
    if (r.rmn) out.push('RMN');
    return out.join(', ');
  }
  function fmtOtras(o) {
    if (!o) return '';
    const out = [];
    if (o.eda) out.push('EDA');
    if (o.colo) out.push('Colonoscopia');
    if (o.bronco) out.push('Broncoscopia');
    return out.join(', ');
  }

  function toggleEdit(isEdit) {
    const add = $('#btnAddPruebas');
    const upd = $('#btnUpdatePruebas');
    const can = $('#btnCancelEditPruebas');
    if (add) add.style.display = isEdit ? 'none' : 'inline-flex';
    if (upd) upd.style.display = isEdit ? 'inline-flex' : 'none';
    if (can) can.style.display = isEdit ? 'inline-flex' : 'none';
  }

  function esc(s) {
    const str = (s || '') + '';
    return str.replace(/[&<>"']/g, function(m){
      const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return map[m];
    });
  }

  function safeToast(msg, type) {
    try { if (typeof showToast === 'function') showToast(msg, type || 'info', 1800); } catch (e) {}
  }

  // MODIFICADO: Exponer las funciones para events.js
  return {
    init,
    renderTable,
    // --- API para events.js ---
    add: onAdd,
    agregar: onAdd,
    create: onAdd,
    actualizar: onUpdate,
    update: onUpdate,
    save: onUpdate,
    cancelarEdicion: onCancel,
    cancelEdit: onCancel,
    cancelar: onCancel,
    vaciar: onVaciar,
    clear: onVaciar
  };
})();

export default PruebasModule;