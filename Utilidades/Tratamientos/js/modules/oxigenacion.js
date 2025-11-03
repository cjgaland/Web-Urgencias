// js/modules/oxigenacion.js
import { GlobalState, StateActions } from '../core/state.js';
import { select as $, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const OxigenacionModule = (() => {
  const moduleState = { editingIndex: -1 };

  // ---------- INIT ----------
  async function init() {
    try {
      const pautas = await DataLoader.cargarPautas();
      if (Array.isArray(pautas) && pautas.length) {
        fillPautas('#aero_salbutamol_pauta', pautas);
        fillPautas('#aero_ipratropio_pauta', pautas);
        fillPautas('#aero_budesonida_pauta', pautas);
      }
    } catch (e) {
      console.warn('[Respiratorio] No se pudieron cargar las pautas:', e);
    }

    // Asegura el array del estado (por si viene vacío o mal tipado)
    // MODIFICADO: Usa la clave 'oxigenacion'
    if (!Array.isArray(GlobalState.oxigenacion)) {
      StateActions.clearArray('oxigenacion');
    }

    wireRespiratorioUI(); // deja todo oculto y en “no”
    bindEvents();
    renderTable();
  }

  function fillPautas(selector, lista) {
    const sel = $(selector);
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar pauta...</option>';
    (lista || []).forEach((label) => {
      const opt = document.createElement('option');
      opt.value = String(label);
      opt.textContent = String(label);
      sel.appendChild(opt);
    });
  }

  // ---------- UI show/hide ----------
  function wireRespiratorioUI() {
    // Oxígeno
    const oxBlock = $('#resp_ox_inline');
    const oxDisp = $('#resp_ox_dispositivo');
    const lpmWrap = $('#resp_ox_lpm_wrap');
    const ventiWrap = $('#resp_ox_venti_wrap');

    function updateOx() {
      const yes = getRadio('resp_oxigeno') === 'si';
      if (oxBlock) oxBlock.style.display = yes ? 'flex' : 'none';
      updateDispositivo();
    }
    function updateDispositivo() {
      if (!oxDisp || !lpmWrap || !ventiWrap) return;
      const isVenti = oxDisp.value === 'ventimask';
      lpmWrap.style.display = isVenti ? 'none' : 'flex';
      ventiWrap.style.display = isVenti ? 'flex' : 'none';
    }
    listenRadios('resp_oxigeno', updateOx);
    if (oxDisp) oxDisp.addEventListener('change', updateDispositivo);

    // Aerosoles
    const aeroBlock = $('#resp_aero_block');
    function updateAero() {
      const yes = getRadio('resp_aero') === 'si';
      if (aeroBlock) aeroBlock.style.display = yes ? 'flex' : 'none';
    }
    listenRadios('resp_aero', updateAero);

    // VMNI
    const vmniInline = $('#vmni_inline');
    const vmniTipo = $('#resp_vmni_tipo');
    const pOAF = $('#vmni_oaf_params');
    const pCPAP = $('#vmni_cpap_params');
    const pBIPAP = $('#vmni_bipap_params');

    function updateVMNI() {
      const yes = getRadio('resp_vmni') === 'si';
      if (vmniInline) vmniInline.style.display = yes ? 'flex' : 'none';

      const t = vmniTipo ? vmniTipo.value : '';
      if (pOAF) pOAF.style.display = (yes && t === 'oaf') ? 'flex' : 'none';
      if (pCPAP) pCPAP.style.display = (yes && t === 'cpap') ? 'flex' : 'none';
      if (pBIPAP) pBIPAP.style.display = (yes && t === 'bipap') ? 'flex' : 'none';
    }
    listenRadios('resp_vmni', updateVMNI);
    if (vmniTipo) vmniTipo.addEventListener('change', updateVMNI);

    // Estado inicial
    updateOx();
    updateAero();
    updateVMNI();
  }

  function listenRadios(name, handler) {
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
      r.addEventListener('change', handler);
    });
  }
  function getRadio(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : 'no';
  }
  function setRadio(name, value) {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  }

  // ---------- Eventos ----------
  function bindEvents() {
    const card = $('#respiratorio-card');
    if (!card) return;

    // 1) Evita submit del form padre si lo hubiera
    const form = card.closest('form');
    if (form) form.addEventListener('submit', (e) => e.preventDefault());

    // 2) Delegado ÚNICO sobre la tarjeta (evita dobles disparos)
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      // Evita comportamiento por defecto de <button type="submit">
      e.preventDefault();

      if (btn.id === 'btnAddResp') { addRegistro(); return; }
      if (btn.id === 'btnUpdateResp') { actualizarRegistro(); return; }
      if (btn.id === 'btnCancelEditResp') { cancelarEdicion(); return; }
      if (btn.id === 'btnVaciarResp') { vaciarRegistros(); return; }

      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.index, 10);
      if (!Number.isNaN(idx)) {
        if (action === 'edit') editarRegistro(idx);
        if (action === 'del') eliminarRegistro(idx);
      }
    });
  }

  // ---------- Formulario ----------
  function leerFormulario() {
    // Oxígeno
    const oxigeno = getRadio('resp_oxigeno');
    const dispositivo = $('#resp_ox_dispositivo')?.value || '';
    const litros = $('#resp_ox_lpm')?.value || '';
    const porcentaje = $('#resp_ox_venti_pct')?.value || '';

    // Aerosoles
    const aerosol = getRadio('resp_aero');
    const salbu = $('#aero_salbutamol')?.checked || false;
    const salbu_dosis = $('#aero_salbutamol_dosis')?.value || '';
    const salbu_pauta = $('#aero_salbutamol_pauta')?.value || '';
    const ipra = $('#aero_ipratropio')?.checked || false;
    const ipra_dosis = $('#aero_ipratropio_dosis')?.value || '';
    const ipra_pauta = $('#aero_ipratropio_pauta')?.value || '';
    const bude = $('#aero_budesonida')?.checked || false;
    const bude_dosis = $('#aero_budesonida_dosis')?.value || '';
    const bude_pauta = $('#aero_budesonida_pauta')?.value || '';

    // VMNI
    const vmni = getRadio('resp_vmni');
    const tipo = $('#resp_vmni_tipo')?.value || '';
    const oaf_flujo = $('#resp_oaf_flujo')?.value || '';
    const cpap_ipap = $('#resp_cpap_ipap')?.value || '';
    const bipap_ipap = $('#resp_bipap_ipap')?.value || '';
    const bipap_epap = $('#resp_bipap_epap')?.value || '';
    const bipap_ie = $('#resp_bipap_ie')?.value || '';

    const obs = $('#resp_obs')?.value || '';

    return {
      oxigeno, dispositivo, litros, porcentaje,
      aerosol,
      aerosoles: {
        salbutamol: { use: salbu, dosis: salbu_dosis, pauta: salbu_pauta },
        ipratropio: { use: ipra, dosis: ipra_dosis, pauta: ipra_pauta },
        budesonida: { use: bude, dosis: bude_dosis, pauta: bude_pauta },
      },
      vmni, tipo,
      vmniParams: { oaf_flujo, cpap_ipap, bipap_ipap, bipap_epap, bipap_ie },
      obs
    };
  }

  // ✅ NUEVO: considera si el registro está completamente vacío
  function isEmptyRecord(m) {
    const anyOx = (m.oxigeno === 'si') && (
      (m.dispositivo === 'gafas_nasales' && m.litros) ||
      (m.dispositivo === 'ventimask'     && m.porcentaje)
    );

    const anyAero =
      (m.aerosol === 'si') &&
      (
        (m.aerosoles?.salbutamol?.use && (m.aerosoles.salbutamol.dosis || m.aerosoles.salbutamol.pauta)) ||
        (m.aerosoles?.ipratropio?.use && (m.aerosoles.ipratropio.dosis || m.aerosoles.ipratropio.pauta)) ||
        (m.aerosoles?.budesonida?.use && (m.aerosoles.budesonida.dosis || m.aerosoles.budesonida.pauta))
      );

    const anyVmni =
      (m.vmni === 'si') && (
        (m.tipo === 'oaf'  && m.vmniParams?.oaf_flujo) ||
        (m.tipo === 'cpap' && m.vmniParams?.cpap_ipap) ||
        (m.tipo === 'bipap' && (m.vmniParams?.bipap_ipap || m.vmniParams?.bipap_epap || m.vmniParams?.bipap_ie))
      );

    const anyObs = !!(m.obs && m.obs.trim());

    return !(anyOx || anyAero || anyVmni || anyObs);
  }

  function validarRegistro(m) {
    // Oxígeno
    if (m.oxigeno === 'si') {
      if (!m.dispositivo) { showToast('Selecciona un dispositivo de oxígeno', 'warning'); return false; }
      if (m.dispositivo === 'gafas_nasales' && !m.litros) { showToast('Indica litros/minuto', 'warning'); return false; }
      if (m.dispositivo === 'ventimask' && !m.porcentaje) { showToast('Indica % de O₂', 'warning'); return false; }
    }
    // Aerosoles
    if (m.aerosol === 'si') {
      const any = m.aerosoles.salbutamol.use || m.aerosoles.ipratropio.use || m.aerosoles.budesonida.use;
      if (!any) { showToast('Selecciona al menos un fármaco', 'warning'); return false; }
      for (const [k, v] of Object.entries(m.aerosoles)) {
        if (v.use && (!v.dosis || !v.pauta)) { showToast(`Completa dosis y pauta de ${k}`, 'warning'); return false; }
      }
    }
    // VMNI
    if (m.vmni === 'si') {
      if (!m.tipo) { showToast('Selecciona tipo de VMNI', 'warning'); return false; }
      if (m.tipo === 'oaf' && !m.vmniParams.oaf_flujo) { showToast('Indica flujo para OAF', 'warning'); return false; }
      if (m.tipo === 'cpap' && !m.vmniParams.cpap_ipap) { showToast('Indica IPAP para CPAP', 'warning'); return false; }
      if (m.tipo === 'bipap') {
        const { bipap_ipap, bipap_epap, bipap_ie } = m.vmniParams;
        if (!bipap_ipap || !bipap_epap || !bipap_ie) { showToast('Completa IPAP, EPAP e I:E para BiPAP', 'warning'); return false; }
      }
    }
    return true;
  }

  // ---------- CRUD ----------
  function addRegistro() {
    const m = leerFormulario();

    // ⛔ No añadir si no hay nada seleccionado
    if (isEmptyRecord(m)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validarRegistro(m)) return;

    // MODIFICADO: Usa la clave 'oxigenacion'
    StateActions.addToArray('oxigenacion', m);
    renderTable();
    limpiarFormulario();
    showToast('Registro añadido', 'success');
  }

  function editarRegistro(i) {
    // MODIFICADO: Usa la clave 'oxigenacion'
    const item = GlobalState.oxigenacion?.[i];
    if (!item) return;

    // Oxígeno
    setRadio('resp_oxigeno', item.oxigeno === 'si' ? 'si' : 'no');
    setVal('#resp_ox_dispositivo', item.dispositivo || '');
    setVal('#resp_ox_lpm', item.litros || '');
    setVal('#resp_ox_venti_pct', item.porcentaje || '');

    // Aerosoles
    setRadio('resp_aero', item.aerosol === 'si' ? 'si' : 'no');
    setChk('#aero_salbutamol', !!item.aerosoles?.salbutamol?.use);
    setVal('#aero_salbutamol_dosis', item.aerosoles?.salbutamol?.dosis || '');
    setVal('#aero_salbutamol_pauta', item.aerosoles?.salbutamol?.pauta || '');

    setChk('#aero_ipratropio', !!item.aerosoles?.ipratropio?.use);
    setVal('#aero_ipratropio_dosis', item.aerosoles?.ipratropio?.dosis || '');
    setVal('#aero_ipratropio_pauta', item.aerosoles?.ipratropio?.pauta || '');

    setChk('#aero_budesonida', !!item.aerosoles?.budesonida?.use);
    setVal('#aero_budesonida_dosis', item.aerosoles?.budesonida?.dosis || '');
    setVal('#aero_budesonida_pauta', item.aerosoles?.budesonida?.pauta || '');

    // VMNI
    setRadio('resp_vmni', item.vmni === 'si' ? 'si' : 'no');
    setVal('#resp_vmni_tipo', item.tipo || '');
    setVal('#resp_oaf_flujo', item.vmniParams?.oaf_flujo || '');
    setVal('#resp_cpap_ipap', item.vmniParams?.cpap_ipap || '');
    setVal('#resp_bipap_ipap', item.vmniParams?.bipap_ipap || '');
    setVal('#resp_bipap_epap', item.vmniParams?.bipap_epap || '');
    setVal('#resp_bipap_ie', item.vmniParams?.bipap_ie || '');

    // Observaciones
    setVal('#resp_obs', item.obs || '');

    // Refresca visibilidad
    refreshVisibility();

    moduleState.editingIndex = i;
    toggleEditButtons(true);
  }

  function actualizarRegistro() {
    if (moduleState.editingIndex < 0) return;
    const m = leerFormulario();

    // Si quedó vacío tras editar, no guardes
    if (isEmptyRecord(m)) {
      showToast('Selecciona una condición', 'warning');
      return;
    }

    if (!validarRegistro(m)) return;

    // MODIFICADO: Usa la clave 'oxigenacion'
    StateActions.updateInArray('oxigenacion', moduleState.editingIndex, m);
    renderTable();
    cancelarEdicion();
    showToast('Registro actualizado', 'success');
  }

  function eliminarRegistro(i) {
    // MODIFICADO: Usa la clave 'oxigenacion'
    StateActions.removeFromArray('oxigenacion', i);
    renderTable();
    showToast('Registro eliminado', 'info');
  }

  function vaciarRegistros() {
    // MODIFICADO: Usa la clave 'oxigenacion'
    StateActions.clearArray('oxigenacion');
    renderTable();
    limpiarFormulario();
    showToast('Datos vaciados', 'info');
  }

  function cancelarEdicion() {
    moduleState.editingIndex = -1;
    limpiarFormulario();
    toggleEditButtons(false);
  }

  // ---------- Aux UI ----------
  function toggleEditButtons(isEdit) {
    const add = $('#btnAddResp');
    const upd = $('#btnUpdateResp');
    const can = $('#btnCancelEditResp');
    if (add) add.style.display = isEdit ? 'none' : 'inline-flex';
    if (upd) upd.style.display = isEdit ? 'inline-flex' : 'none';
    if (can) can.style.display = isEdit ? 'inline-flex' : 'none';
  }

  function limpiarFormulario() {
    // Radios a NO
    setRadio('resp_oxigeno', 'no');
    setRadio('resp_aero', 'no');
    setRadio('resp_vmni', 'no');

    // Campos
    setVal('#resp_ox_dispositivo', '');
    setVal('#resp_ox_lpm', '');
    setVal('#resp_ox_venti_pct', '');

    setChk('#aero_salbutamol', false);
    setVal('#aero_salbutamol_dosis', '');
    setVal('#aero_salbutamol_pauta', '');

    setChk('#aero_ipratropio', false);
    setVal('#aero_ipratropio_dosis', '');
    setVal('#aero_ipratropio_pauta', '');

    setChk('#aero_budesonida', false);
    setVal('#aero_budesonida_dosis', '');
    setVal('#aero_budesonida_pauta', '');

    setVal('#resp_vmni_tipo', '');
    setVal('#resp_oaf_flujo', '');
    setVal('#resp_cpap_ipap', '');
    setVal('#resp_bipap_ipap', '');
    setVal('#resp_bipap_epap', '');
    setVal('#resp_bipap_ie', '');
    setVal('#resp_obs', '');

    refreshVisibility();
  }

  function refreshVisibility() {
    // Recalcula VISIBILIDAD sin volver a registrar listeners
    const oxBlock = $('#resp_ox_inline');
    const lpmWrap = $('#resp_ox_lpm_wrap');
    const ventiWrap = $('#resp_ox_venti_wrap');
    const oxYes = getRadio('resp_oxigeno') === 'si';
    if (oxBlock) oxBlock.style.display = oxYes ? 'flex' : 'none';
    const oxDispVal = $('#resp_ox_dispositivo')?.value || '';
    if (lpmWrap) lpmWrap.style.display = oxDispVal === 'ventimask' ? 'none' : 'flex';
    if (ventiWrap) ventiWrap.style.display = oxDispVal === 'ventimask' ? 'flex' : 'none';

    const aeroBlock = $('#resp_aero_block');
    const aeroYes = getRadio('resp_aero') === 'si';
    if (aeroBlock) aeroBlock.style.display = aeroYes ? 'flex' : 'none';

    const vmniInline = $('#vmni_inline');
    const vmniYes = getRadio('resp_vmni') === 'si';
    if (vmniInline) vmniInline.style.display = vmniYes ? 'flex' : 'none';

    const tipo = $('#resp_vmni_tipo')?.value || '';
    const pOAF = $('#vmni_oaf_params');
    const pCPAP = $('#vmni_cpap_params');
    const pBIPAP = $('#vmni_bipap_params');
    if (pOAF) pOAF.style.display = (vmniYes && tipo === 'oaf') ? 'flex' : 'none';
    if (pCPAP) pCPAP.style.display = (vmniYes && tipo === 'cpap') ? 'flex' : 'none';
    if (pBIPAP) pBIPAP.style.display = (vmniYes && tipo === 'bipap') ? 'flex' : 'none';
  }

  // ---------- Tabla ----------
  function renderTable() {
    const tbody = $('#tablaResp tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // MODIFICADO: Usa la clave 'oxigenacion'
    const arr = GlobalState.oxigenacion || [];
    if (!arr.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" style="text-align:center;color:#64748b;">Sin registros</td>';
      tbody.appendChild(tr);
      return;
    }

    arr.forEach((r, i) => {
      // Oxígeno
      let oxTxt = 'No';
      if (r.oxigeno === 'si') {
        if (r.dispositivo === 'gafas_nasales') {
          oxTxt = 'Gafas ' + (r.litros || '') + ' L/min';
        } else {
          oxTxt = 'Ventimask ' + (r.porcentaje || '');
        }
      }

      // Aerosoles
      const aeroTxt = (r.aerosol === 'si') ? summaryAerosoles(r.aerosoles) : 'No';

      // VMNI
      const vmniTxt = (r.vmni === 'si') ? summaryVMNI(r.tipo, r.vmniParams) : 'No';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${oxTxt}</td>
        <td>${aeroTxt}</td>
        <td>${vmniTxt}</td>
        <td>${r.obs ? escapeHTML(r.obs) : ''}</td>
        <td>
          <div style="display:flex;gap:6px;justify-content:center;">
            <button class="btn btn-sm" data-action="edit" data-index="${i}" title="Editar">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-sm danger" data-action="del" data-index="${i}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  // ---------- Helpers ----------
  function summaryAerosoles(a) {
    const parts = [];
    if (a && a.salbutamol && a.salbutamol.use) {
      parts.push('Salbutamol ' + (a.salbutamol.dosis || '') + ' · ' + (a.salbutamol.pauta || ''));
    }
    if (a && a.ipratropio && a.ipratropio.use) {
      parts.push('Ipratropio ' + (a.ipratropio.dosis || '') + ' · ' + (a.ipratropio.pauta || ''));
    }
    if (a && a.budesonida && a.budesonida.use) {
      parts.push('Budesonida ' + (a.budesonida.dosis || '') + ' · ' + (a.budesonida.pauta || ''));
    }
    return parts.length ? parts.join(', ') : '—';
  }

  function summaryVMNI(tipo, p) {
    const params = p || {};
    if (tipo === 'oaf') return 'OAF · ' + (params.oaf_flujo || '') + ' L/min';
    if (tipo === 'cpap') return 'CPAP · ' + (params.cpap_ipap || '') + ' cmH₂O';
    if (tipo === 'bipap') {
      const i = params.bipap_ipap || '';
      const e = params.bipap_epap || '';
      const ie = params.bipap_ie || '';
      return 'BiPAP · IPAP ' + i + ' · EPAP ' + e + ' · I:E ' + ie;
    }
    return (tipo || '').toUpperCase();
  }

  function setVal(sel, val) { const el = $(sel); if (el) el.value = (val == null ? '' : val); }
  function setChk(sel, on)  { const el = $(sel); if (el) el.checked = !!on; }
  function escapeHTML(s) {
    const str = (s == null ? '' : String(s));
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  // MODIFICADO: Exponer las funciones para events.js
  return {
    init,
    renderTable,
    // --- API para events.js ---
    add: addRegistro,
    agregar: addRegistro,
    create: addRegistro,
    addRegistro: addRegistro,
    actualizar: actualizarRegistro,
    update: actualizarRegistro,
    save: actualizarRegistro,
    actualizarRegistro: actualizarRegistro,
    cancelarEdicion: cancelarEdicion,
    cancelEdit: cancelarEdicion,
    cancelar: cancelarEdicion,
    vaciar: vaciarRegistros,
    clear: vaciarRegistros,
    reset: vaciarRegistros,
    vaciarRegistros: vaciarRegistros
  };
})();

export default OxigenacionModule;