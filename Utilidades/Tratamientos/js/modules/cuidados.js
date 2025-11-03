// js/modules/cuidados.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const CuidadosModule = (() => {
  const st = {
    pautas: [],
    editIndex: -1
  };

  // ========= INIT =========
  async function init() {
    const card = $('#cuidados-card');
    if (!card) {
      console.warn('[Cuidados] No se encuentra #cuidados-card');
      return;
    }

    // Cargar pautas para intermitente
    try {
      if (typeof DataLoader.cargarPautas === 'function') {
        st.pautas = await DataLoader.cargarPautas();
      } else {
        st.pautas = [];
      }
      fillPautaSelects();
      attachIntermitenteEnhancements(); // auto-check y default 8h en selects/checkbox
    } catch (e) {
      console.warn('[Cuidados] No se pudieron cargar pautas:', e);
    }

    // Wire de UI
    wireUI();

    // Estado
    if (!Array.isArray(GlobalState.cuidados)) {
      StateManager.updateState({ cuidados: [] });
    }

    // Eventos (único delegado)
    bindEvents();

    // Render inicial
    renderTable();
  }

  // ========= UI =========
  function wireUI() {
    attachRadio('cui_diuresis', updateDiuresis);
    attachRadio('cui_depos', updateDepos);
    attachRadio('cui_mon', updateMon);
    attachRadio('cui_mon_int', updateMonInt);
    attachRadio('cui_mon_cont', updateMonCont);

    // Estado inicial de bloques
    updateDiuresis();
    updateDepos();
    updateMon();
    updateMonInt();
    updateMonCont();
    // OJO: el manejo de checkboxes/selects intermitentes se hace en bindEvents() y attachIntermitenteEnhancements()
  }

  function attachRadio(name, handler) {
    const nodes = document.querySelectorAll('input[name="' + name + '"]');
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('change', handler);
    }
  }

  function getRadio(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : 'no';
  }

  function updateDiuresis() {
    const yes = getRadio('cui_diuresis') === 'si';
    const b = $('#cui_diuresis_block');
    if (b) b.style.display = yes ? 'flex' : 'none';

    // Default: si Sí y sin valor -> "Cada 8 horas"
    const sel = document.getElementById('cui_diuresis_tipo');
    if (yes && sel && (!sel.value || sel.value === '')) {
      sel.value = 'c8h'; // existe en el HTML
    }
  }

  function updateDepos() {
    const yes = getRadio('cui_depos') === 'si';
    const b = $('#cui_depos_block');
    if (b) b.style.display = yes ? 'block' : 'none';
  }

  function updateMon() {
    const yes = getRadio('cui_mon') === 'si';
    const b = $('#cui_mon_block');
    if (b) b.style.display = yes ? 'flex' : 'none';
  }

  function updateMonInt() {
    const yes = getRadio('cui_mon_int') === 'si';
    const b = $('#cui_mon_int_block');
    if (b) b.style.display = yes ? 'flex' : 'none';
  }

  function updateMonCont() {
    const yes = getRadio('cui_mon_cont') === 'si';
    const b = $('#cui_mon_cont_block');
    if (b) b.style.display = yes ? 'flex' : 'none';
  }

  // ========= FORM LECTURA / VALIDACIÓN =========
  function leerFormulario() {
    // General
    const general = [];
    // Base
    const c1 = document.getElementById('cui_cama');
    const c2 = document.getElementById('cui_sedest');
    const c3 = document.getElementById('cui_deamb');
    if (c1 && c1.checked) general.push('Cama cabecero elevado');
    if (c2 && c2.checked) general.push('Sedestación');
    if (c3 && c3.checked) general.push('Puede deambular');

    // Opcionales añadidos
    const c4 = document.getElementById('cui_cpost');
    const c5 = document.getElementById('cui_barand');
    const c6 = document.getElementById('cui_timbre');
    const c7 = document.getElementById('cui_upp');
    if (c4 && c4.checked) general.push('Cambios posturales');
    if (c5 && c5.checked) general.push('Barandillas elevadas');
    if (c6 && c6.checked) general.push('Timbre al alcance');
    if (c7 && c7.checked) general.push('Prevención UPP');

    // Diuresis
    const diuresisYes = getRadio('cui_diuresis') === 'si';
    const tipoSel = document.getElementById('cui_diuresis_tipo');
    const tipoVal = tipoSel ? tipoSel.value : '';
    const diuresis = diuresisYes ? { si: true, tipo: tipoVal } : { si: false };

    // Deposiciones
    const depos = getRadio('cui_depos') === 'si';

    // Monitorización
    const mon = getRadio('cui_mon') === 'si';

    // Intermitente
    const monIntYes = getRadio('cui_mon_int') === 'si';
    let intermitente = null;
    if (mon && monIntYes) {
      intermitente = {
        ta: readInter('ta'),
        temp: readInter('temp'),
        fc: readInter('fc'),
        sat: readInter('sat'),
        glu: readInter('glu'),
        gcs: readInter('gcs')
      };
    }

    // Continua
    const monContYes = getRadio('cui_mon_cont') === 'si';
    let continua = null;
    if (mon && monContYes) {
      const ecg = document.getElementById('cont_ecg');
      const sat = document.getElementById('cont_sat');
      const fc  = document.getElementById('cont_fc');
      const ta  = document.getElementById('cont_ta');
      continua = {
        ecg: !!(ecg && ecg.checked),
        sat: !!(sat && sat.checked),
        fc:  !!(fc && fc.checked),
        ta:  !!(ta && ta.checked)
      };
    }

    // Observaciones
    const obsEl = document.getElementById('cui_obs');
    const obs = obsEl ? (obsEl.value || '').trim() : '';

    return {
      general: general,
      diuresis: diuresis,
      depos: depos,
      mon: mon,
      intermitente: intermitente,
      continua: continua,
      obs: obs
    };
  }

  function readInter(k) {
    const chk = document.getElementById('int_' + k);
    const sel = document.getElementById('int_' + k + '_pauta');
    return {
      use: !!(chk && chk.checked),
      pauta: sel ? sel.value : ''
    };
  }

  // ✅ NUEVO: considerar si el formulario está totalmente vacío
  function isEmptyCuidados(m) {
    const anyGeneral = Array.isArray(m.general) && m.general.length > 0;

    const anyDiuresis = !!(m.diuresis && m.diuresis.si && m.diuresis.tipo);

    const anyDepos = !!m.depos;

    const anyIntermitente = !!(m.mon && m.intermitente &&
      (['ta','temp','fc','sat','glu','gcs'].some(k => m.intermitente[k]?.use && m.intermitente[k]?.pauta)));

    const anyContinua = !!(m.mon && m.continua &&
      (m.continua.ecg || m.continua.sat || m.continua.fc || m.continua.ta));

    const anyObs = !!(m.obs && m.obs.trim());

    return !(anyGeneral || anyDiuresis || anyDepos || anyIntermitente || anyContinua || anyObs);
  }

  function validarFormulario(m) {
    // Diuresis: si es sí -> tipo requerido
    if (m.diuresis && m.diuresis.si && (!m.diuresis.tipo || m.diuresis.tipo === '')) {
      showToast('Selecciona el tipo de diuresis', 'warning');
      return false;
    }

    // Monitorización intermitente: al menos un parámetro y su pauta
    if (m.mon && m.intermitente) {
      const entries = [
        ['ta', m.intermitente.ta],
        ['temp', m.intermitente.temp],
        ['fc', m.intermitente.fc],
        ['sat', m.intermitente.sat],
        ['glu', m.intermitente.glu],
        ['gcs', m.intermitente.gcs]
      ];
      let alguno = false;
      for (let i = 0; i < entries.length; i++) {
        const v = entries[i][1];
        if (v && v.use) {
          alguno = true;
          if (!v.pauta || v.pauta === '') {
            showToast('Selecciona la frecuencia de ' + labelInter(entries[i][0]), 'warning');
            return false;
          }
        }
      }
      if (!alguno) {
        showToast('Selecciona al menos un parámetro de monitorización intermitente', 'warning');
        return false;
      }
    }

    // Monitorización continua: al menos un parámetro
    if (m.mon && m.continua) {
      const anyCont = !!(m.continua.ecg || m.continua.sat || m.continua.fc || m.continua.ta);
      if (!anyCont) {
        showToast('Selecciona al menos un parámetro de monitorización continua', 'warning');
        return false;
      }
    }

    return true;
  }

  // ===== CRUD CUIDADOS =====
  function resetForm(){ limpiarFormulario(); } // alias para mantener lo que usa el CRUD

  function onAdd() {
    const data = leerFormulario();

    // ⛔ Si no hay nada seleccionado, no añadir
    if (isEmptyCuidados(data)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validarFormulario(data)) return;

    const arr = Array.isArray(GlobalState.cuidados) ? [...GlobalState.cuidados] : [];
    arr.push(data);
    StateManager.updateState({ cuidados: arr });
    resetForm();
    renderTable();
    showToast('Cuidados añadidos', 'success');
  }

  function onUpdate() {
    if (typeof st.editIndex !== 'number' || st.editIndex < 0) return;
    const data = leerFormulario();

    // ⛔ Si queda vacío tras editar, no guardar
    if (isEmptyCuidados(data)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validarFormulario(data)) return;

    const arr = Array.isArray(GlobalState.cuidados) ? [...GlobalState.cuidados] : [];
    if (st.editIndex >= arr.length) return;
    arr[st.editIndex] = data;
    StateManager.updateState({ cuidados: arr });
    st.editIndex = -1;
    toggleEdit(false);
    resetForm();
    renderTable();
    showToast('Registro actualizado', 'success');
  }

  function onCancel() {
    st.editIndex = -1;
    toggleEdit(false);
    resetForm();
    showToast('Edición cancelada', 'info');
  }

  function onVaciar() {
    StateManager.updateState({ cuidados: [] });
    st.editIndex = -1;
    toggleEdit(false);
    resetForm();
    renderTable();
    showToast('Tabla de Cuidados vaciada', 'warning');
  }

  function onEdit(idx) {
    const arr = Array.isArray(GlobalState.cuidados) ? GlobalState.cuidados : [];
    if (idx < 0 || idx >= arr.length) return;
    const r = arr[idx];

    // General
    setChecked('cui_cama',   !!(r.general && r.general.includes('Cama cabecero elevado')));
    setChecked('cui_sedest', !!(r.general && r.general.includes('Sedestación')));
    setChecked('cui_deamb',  !!(r.general && r.general.includes('Puede deambular')));
    setChecked('cui_cpost',  !!(r.general && r.general.includes('Cambios posturales')));
    setChecked('cui_barand', !!(r.general && r.general.includes('Barandillas elevadas')));
    setChecked('cui_timbre', !!(r.general && r.general.includes('Timbre al alcance')));
    setChecked('cui_upp',    !!(r.general && r.general.includes('Prevención UPP')));

    // Diuresis
    const d = r.diuresis || {};
    if (d.si) {
      setRadio('cui_diuresis', 'si'); updateDiuresis();
      const map = { 'Miccional':'miccional','Horaria':'horaria','c/4h':'c4h','c/6h':'c6h','c/8h':'c8h','c/12h':'c12h','24h':'24h' };
      const v = map[d.tipo] || d.tipo || '';
      setValue('cui_diuresis_tipo', v);
    } else {
      setRadio('cui_diuresis', 'no'); updateDiuresis();
    }

    // Deposiciones
    if (r.depos === true || (r.depos && r.depos.registrar)) {
      setRadio('cui_depos', 'si'); updateDepos();
      // setValue('depos_cant', r.depos.cantidad || '');
      // setValue('depos_carac', r.depos.caracteristicas || '');
    } else {
      setRadio('cui_depos', 'no'); updateDepos();
    }

    // Monitorización
    const mon = !!r.mon;
    setRadio('cui_mon', mon ? 'si' : 'no'); updateMon();

    // Intermitente
    const inter = r.intermitente || {};
    setRadio('cui_mon_int', (inter.ta || inter.temp || inter.fc || inter.sat || inter.glu || inter.gcs) ? 'si' : 'no');
    updateMonInt();
    ['ta','temp','fc','sat','glu','gcs'].forEach(k=>{
      setChecked('int_'+k, !!(inter[k] && inter[k].use));
      setValue('int_'+k+'_pauta', (inter[k] && inter[k].pauta) ? inter[k].pauta : '');
    });

    // Continua
    const cont = r.continua || {};
    setRadio('cui_mon_cont', (cont.ecg||cont.sat||cont.fc||cont.ta) ? 'si' : 'no');
    updateMonCont();
    setChecked('cont_ecg', !!cont.ecg);
    setChecked('cont_sat', !!cont.sat);
    setChecked('cont_fc',  !!cont.fc);
    setChecked('cont_ta',  !!cont.ta);

    // Obs
    setValue('cui_obs', r.obs || '');

    st.editIndex = idx;
    toggleEdit(true);
  }

  function onDelete(idx) {
    const arr = Array.isArray(GlobalState.cuidados) ? [...GlobalState.cuidados] : [];
    if (idx < 0 || idx >= arr.length) return;
    arr.splice(idx, 1);
    StateManager.updateState({ cuidados: arr });
    if (st.editIndex === idx) { st.editIndex = -1; toggleEdit(false); resetForm(); }
    renderTable();
    showToast('Registro eliminado', 'warning');
  }

  // ========= EVENTOS =========
  function bindEvents() {
    const card = document.getElementById('cuidados-card');
    if (!card) return;

    // 1) Si hay un <form> padre, evita el submit
    const form = card.closest('form');
    if (form) {
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    // 2) ÚNICO listener delegado sobre la tarjeta (evita dobles disparos)
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      // Evita que un botón "submit" recargue la página
      e.preventDefault();

      const id = btn.id;
      if (id === 'btnAddCuidados')         { onAdd(); return; }
      if (id === 'btnUpdateCuidados')      { onUpdate(); return; }
      if (id === 'btnCancelEditCuidados')  { onCancel(); return; }
      if (id === 'btnVaciarCuidados')      { onVaciar(); return; }

      const action = btn.getAttribute('data-action');
      const idxText = btn.getAttribute('data-index');
      const idx = idxText ? parseInt(idxText, 10) : NaN;

      if (!isNaN(idx)) {
        if (action === 'edit') onEdit(idx);
        if (action === 'del')  onDelete(idx);
      }
    });

    // === Monitorización intermitente: checkboxes <-> selects ===
    const interKeys = ['ta', 'temp', 'fc', 'sat', 'glu', 'gcs'];

    function handleInterCheckboxChange(e) {
      const chk = e.currentTarget;
      const sel = document.getElementById(chk.id + '_pauta');
      if (!sel) return;

      if (!chk.checked) {
        sel.selectedIndex = 0;  // "Frecuencia..."
      } else {
        if (!sel.value || sel.value === '') ensureDefault8h(sel);
      }
    }

    for (let k of interKeys) {
      const chk = document.getElementById('int_' + k);
      if (chk) chk.addEventListener('change', handleInterCheckboxChange);
    }
  }

  // Modificamos renderTable para ajustar el contenido como pides
  function renderTable() {
    const tbody = $('#tablaCuidados tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const arr = Array.isArray(GlobalState.cuidados) ? GlobalState.cuidados : [];
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
        '<td>' + esc(r.general && r.general.length ? r.general.join(', ') : '—') + '</td>' +
        '<td>' + formatDiuresisCustom(r.diuresis) + '</td>' +
        '<td>' + formatDeposicionesCustom(r.depos) + '</td>' +
        '<td>' + formatMonitorCustom(r) + '</td>' +
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

  // ======== FORMATTERS personalizados ========
  function formatDiuresisCustom(d) {
    if (!d || !d.si) return '';
    const map = {
      miccional: 'Miccional',
      horaria: 'Horaria',
      c4h: 'Cada 4 h',
      c6h: 'Cada 6 h',
      c8h: 'Cada 8 h',
      c12h: 'Cada 12 h',
      '24h': 'Orina de 24 h'
    };
    const t = map[d.tipo] ? map[d.tipo] : (d.tipo || '');
    return esc(t);
  }

  function formatDeposicionesCustom(depos) {
    if (!depos) return '';
    return 'Anotar nº y características';
  }

  function formatMonitorCustom(r) {
    if (!r || !r.mon) return '';

    const labelMap = {
      ta: 'Tensión Arterial',
      temp: 'Temperatura',
      fc: 'Frecuencia Cardiaca',
      sat: 'Sat O₂',
      glu: 'Glucemia',
      gcs: 'Glasgow',
      ecg: 'ECG'
    };

    function abreviarFrecuencia(texto) {
      if (!texto) return '';
      const map = {
        'Cada 4 horas': 'c/4h',
        'Cada 6 horas': 'c/6h',
        'Cada 8 horas': 'c/8h',
        'Cada 12 horas': 'c/12h',
        'Orina 24 h': '24h',
        'Miccional': 'Miccional',
        'Horaria': 'Horaria'
      };
      return map[texto] || texto;
    }

    const partes = [];

    if (r.intermitente) {
      const interItems = [];
      for (const key of ['ta', 'temp', 'fc', 'sat', 'glu', 'gcs']) {
        const item = r.intermitente[key];
        if (item && item.use && item.pauta) {
          interItems.push(`<b>${labelMap[key]}</b> · ${abreviarFrecuencia(item.pauta)}`);
        }
      }
      if (interItems.length > 0) {
        partes.push(`<i>Intermitente</i>: ${interItems.join(', ')}`);
      }
    }

    if (r.continua) {
      const contItems = [];
      for (const key of ['ecg', 'sat', 'fc', 'ta']) {
        if (r.continua[key]) contItems.push(`<b>${labelMap[key]}</b>`);
      }
      if (contItems.length > 0) {
        partes.push(`<i>Continua</i>: ${contItems.join(', ')}`);
      }
    }

    return partes.length > 1 ? partes.join('<br>') : (partes[0] || '');
  }

  // ========= HELPERS =========
  function fillPautaSelects() {
    const keys = ['ta','temp','fc','sat','glu','gcs'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const sel = document.getElementById('int_' + k + '_pauta');
      if (!sel) continue;
      sel.innerHTML = '<option value="">Frecuencia...</option>';
      for (let j = 0; j < st.pautas.length; j++) {
        const p = st.pautas[j];
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        sel.appendChild(opt);
      }
    }
  }

  // Marca checkbox al abrir el select y fija por defecto "cada 8 horas" si está vacío
  function attachIntermitenteEnhancements() {
    function handleInterSelectOpen(e) {
      const sel = e.currentTarget;
      const chkId = sel.id.replace('_pauta', '');
      const chk = document.getElementById(chkId);
      if (chk) chk.checked = true;
      if (!sel.value || sel.value === '') ensureDefault8h(sel);
    }

    function handleInterSelectChange(e) {
      const sel = e.currentTarget;
      const chkId = sel.id.replace('_pauta', '');
      const chk = document.getElementById(chkId);
      if (chk && !chk.checked) chk.checked = true;
      if (!sel.value || sel.value === '') ensureDefault8h(sel);
    }

    const keys = ['ta','temp','fc','sat','glu','gcs'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const sel = document.getElementById('int_' + k + '_pauta');
      if (!sel) continue;

      sel.addEventListener('focus', handleInterSelectOpen);
      sel.addEventListener('mousedown', handleInterSelectOpen);
      sel.addEventListener('change', handleInterSelectChange);
    }
  }

  // Busca en el select una opción que contenga "8" y "hora" y la selecciona; si no hay, elige la primera válida
  function ensureDefault8h(selectEl) {
    if (!selectEl) return;
    let chosen = '';
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const txt = (opt.text || '').toLowerCase();
      if (opt.value && txt.indexOf('8') !== -1 && txt.indexOf('hora') !== -1) {
        chosen = opt.value;
        break;
      }
    }
    if (!chosen) {
      for (let j = 0; j < selectEl.options.length; j++) {
        const op = selectEl.options[j];
        if (op.value) { chosen = op.value; break; }
      }
    }
    if (chosen) selectEl.value = chosen;
  }

  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }
  function setValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  function setRadio(name, value) {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }
  function setInter(k, v) {
    const use = v && v.use ? true : false;
    const pauta = v && v.pauta ? v.pauta : '';
    setChecked('int_' + k, use);
    setValue('int_' + k + '_pauta', pauta);
  }

  function labelInter(k) {
    const map = { ta:'Tensión Arterial', temp:'Temperatura', fc:'Frecuencia Cardiaca', sat:'Sat O₂', glu:'Glucemia', gcs:'Glasgow' };
    return map[k] || k;
  }

  function formatDiuresis(d) {
    if (!d || !d.si) return 'No';
    const map = {
      miccional: 'Miccional',
      horaria: 'Horaria',
      c4h: 'Cada 4 h',
      c6h: 'Cada 6 h',
      c8h: 'Cada 8 h',
      c12h: 'Cada 12 h',
      '24h': 'Orina 24 h'
    };
    const t = map[d.tipo] ? map[d.tipo] : (d.tipo || '—');
    return 'Sí · ' + t;
  }

  function formatMonitor(r) {
    if (!r || !r.mon) return 'No';
    const parts = [];

    if (r.intermitente) {
      const iParts = [];
      if (r.intermitente.ta && r.intermitente.ta.use)   iParts.push('TA · ' + r.intermitente.ta.pauta);
      if (r.intermitente.temp && r.intermitente.temp.use) iParts.push('Temp · ' + r.intermitente.temp.pauta);
      if (r.intermitente.fc && r.intermitente.fc.use)   iParts.push('FC · ' + r.intermitente.fc.pauta);
      if (r.intermitente.sat && r.intermitente.sat.use) iParts.push('Sat O₂ · ' + r.intermitente.sat.pauta);
      if (r.intermitente.glu && r.intermitente.glu.use) iParts.push('Glucemia · ' + r.intermitente.glu.pauta);
      if (r.intermitente.gcs && r.intermitente.gcs.use) iParts.push('Glasgow · ' + r.intermitente.gcs.pauta);
      if (iParts.length > 0) parts.push('Intermitente: ' + iParts.join(', '));
    }

    if (r.continua) {
      const c = [];
      if (r.continua.ecg) c.push('ECG');
      if (r.continua.sat) c.push('Sat O₂');
      if (r.continua.fc)  c.push('FC');
      if (r.continua.ta)  c.push('TA');
      if (c.length > 0) parts.push('Continua: ' + c.join(', '));
    }

    return parts.length ? parts.join(' | ') : 'Sí';
  }

  function esc(s) {
    const str = (s || '') + '';
    return str.replace(/[&<>"']/g, function(m){
      const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return map[m];
    });
  }

  function limpiarFormulario() {
    // General (incluye opcionales)
    setChecked('cui_cama', false);
    setChecked('cui_sedest', false);
    setChecked('cui_deamb', false);
    setChecked('cui_cpost', false);
    setChecked('cui_barand', false);
    setChecked('cui_timbre', false);
    setChecked('cui_upp', false);

    // Diuresis
    setRadio('cui_diuresis', 'no');
    setValue('cui_diuresis_tipo', '');
    updateDiuresis();

    // Deposiciones
    setRadio('cui_depos', 'no');
    updateDepos();

    // Monitorización
    setRadio('cui_mon', 'no'); updateMon();

    setRadio('cui_mon_int', 'no'); updateMonInt();
    const keys = ['ta','temp','fc','sat','glu','gcs'];
    for (let i = 0; i < keys.length; i++) {
      setChecked('int_' + keys[i], false);
      setValue('int_' + keys[i] + '_pauta', '');
    }

    setRadio('cui_mon_cont', 'no'); updateMonCont();
    setChecked('cont_ecg', false);
    setChecked('cont_sat', false);
    setChecked('cont_fc', false);
    setChecked('cont_ta', false);

    // Obs
    setValue('cui_obs', '');

    st.editIndex = -1;
    toggleEdit(false);
  }

  function toggleEdit(isEdit) {
    const add = $('#btnAddCuidados');
    const upd = $('#btnUpdateCuidados');
    const can = $('#btnCancelEditCuidados');
    if (add) add.style.display = isEdit ? 'none' : 'inline-flex';
    if (upd) upd.style.display = isEdit ? 'inline-flex' : 'none';
    if (can) can.style.display = isEdit ? 'inline-flex' : 'none';
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

export default CuidadosModule;