// js/modules/oxigenacion.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const OxigenacionModule = (() => {
  const moduleState = { editingIndex: -1 };

  async function init() {
    try {
      const pautas = await DataLoader.cargarPautas();
      if (Array.isArray(pautas) && pautas.length) {
        fillPautas('#aero_salbutamol_pauta', pautas);
        fillPautas('#aero_ipratropio_pauta', pautas);
        fillPautas('#aero_budesonida_pauta', pautas);
      }
    } catch (e) {}

    if (!Array.isArray(GlobalState.oxigenacion)) StateActions.clearArray('oxigenacion');
    wireRespiratorioUI();
    bindEvents();
    renderTable();
  }

  function fillPautas(sel, list) {
    const s = $(sel); if (!s) return; s.innerHTML='<option value="">Seleccionar...</option>';
    list.forEach(l => { const o=document.createElement('option'); o.value=String(l); o.textContent=String(l); s.appendChild(o); });
  }

  function wireRespiratorioUI() {
    const oxBlock=$('#resp_ox_inline'); const oxDisp=$('#resp_ox_dispositivo'); const lpmWrap=$('#resp_ox_lpm_wrap'); const ventiWrap=$('#resp_ox_venti_wrap');
    function updateOx() { const yes=getRadio('resp_oxigeno')==='si'; if(oxBlock) oxBlock.style.display=yes?'flex':'none'; updateDispositivo(); }
    function updateDispositivo() { if(!oxDisp)return; const isVenti=oxDisp.value==='ventimask'; lpmWrap.style.display=isVenti?'none':'flex'; ventiWrap.style.display=isVenti?'flex':'none'; }
    listenRadios('resp_oxigeno', updateOx); if(oxDisp) oxDisp.addEventListener('change', updateDispositivo);

    const aeroBlock=$('#resp_aero_block');
    function updateAero() { const yes=getRadio('resp_aero')==='si'; if(aeroBlock) aeroBlock.style.display=yes?'flex':'none'; }
    listenRadios('resp_aero', updateAero);

    const vmniInline=$('#vmni_inline'); const vmniTipo=$('#resp_vmni_tipo'); const pOAF=$('#vmni_oaf_params'); const pCPAP=$('#vmni_cpap_params'); const pBIPAP=$('#vmni_bipap_params');
    function updateVMNI() {
      const yes=getRadio('resp_vmni')==='si'; if(vmniInline) vmniInline.style.display=yes?'flex':'none';
      const t=vmniTipo?vmniTipo.value:'';
      if(pOAF) pOAF.style.display=(yes&&t==='oaf')?'flex':'none';
      if(pCPAP) pCPAP.style.display=(yes&&t==='cpap')?'flex':'none';
      if(pBIPAP) pBIPAP.style.display=(yes&&t==='bipap')?'flex':'none';
    }
    listenRadios('resp_vmni', updateVMNI); if(vmniTipo) vmniTipo.addEventListener('change', updateVMNI);
    updateOx(); updateAero(); updateVMNI();
  }

  function listenRadios(name, handler) { document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.addEventListener('change', handler)); }
  function getRadio(name) { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : 'no'; }
  function setRadio(name, val) { const r = document.querySelector(`input[name="${name}"][value="${val}"]`); if (r) r.checked = true; }
  function setVal(sel, val) { const el = $(sel); if (el) el.value = (val == null ? '' : val); }
  function setChk(sel, on)  { const el = $(sel); if (el) el.checked = !!on; }

  function bindEvents() {
    const card = $('#respiratorio-card'); if (!card) return;
    const form = card.closest('form'); if (form) form.addEventListener('submit', (e) => e.preventDefault());

    card.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      e.preventDefault();
      if (btn.id === 'btnAddResp') { addRegistro(); return; }
      if (btn.id === 'btnUpdateResp') { actualizarRegistro(); return; }
      if (btn.id === 'btnCancelEditResp') { cancelarEdicion(); return; }
      if (btn.id === 'btnVaciarResp') { vaciarRegistros(); return; }
      const act = btn.dataset.action; const idx = parseInt(btn.dataset.index, 10);
      if (!isNaN(idx)) { if (act === 'edit') editarRegistro(idx); if (act === 'del') eliminarRegistro(idx); }
    });
  }

  function leerFormulario() {
    const oxigeno=getRadio('resp_oxigeno'), dispositivo=$('#resp_ox_dispositivo')?.value, litros=$('#resp_ox_lpm')?.value, porcentaje=$('#resp_ox_venti_pct')?.value;
    const aerosol=getRadio('resp_aero'), salbu=$('#aero_salbutamol')?.checked, salbu_d=$('#aero_salbutamol_dosis')?.value, salbu_p=$('#aero_salbutamol_pauta')?.value;
    const ipra=$('#aero_ipratropio')?.checked, ipra_d=$('#aero_ipratropio_dosis')?.value, ipra_p=$('#aero_ipratropio_pauta')?.value;
    const bude=$('#aero_budesonida')?.checked, bude_d=$('#aero_budesonida_dosis')?.value, bude_p=$('#aero_budesonida_pauta')?.value;
    const vmni=getRadio('resp_vmni'), tipo=$('#resp_vmni_tipo')?.value, oaf=$('#resp_oaf_flujo')?.value, cpap=$('#resp_cpap_ipap')?.value, bipap_i=$('#resp_bipap_ipap')?.value, bipap_e=$('#resp_bipap_epap')?.value, bipap_ie=$('#resp_bipap_ie')?.value;
    const obs=$('#resp_obs')?.value;

    return {
      oxigeno, dispositivo, litros, porcentaje, aerosol,
      aerosoles: { salbutamol:{use:salbu,dosis:salbu_d,pauta:salbu_p}, ipratropio:{use:ipra,dosis:ipra_d,pauta:ipra_p}, budesonida:{use:bude,dosis:bude_d,pauta:bude_p} },
      vmni, tipo, vmniParams: { oaf_flujo:oaf, cpap_ipap:cpap, bipap_ipap:bipap_i, bipap_epap:bipap_e, bipap_ie:bipap_ie }, obs
    };
  }

  function isEmptyRecord(m) {
    const anyOx=(m.oxigeno==='si')&&(m.dispositivo);
    const anyAero=(m.aerosol==='si')&&(m.aerosoles.salbutamol.use||m.aerosoles.ipratropio.use||m.aerosoles.budesonida.use);
    const anyVmni=(m.vmni==='si')&&(m.tipo);
    const anyObs=!!(m.obs&&m.obs.trim());
    return !(anyOx||anyAero||anyVmni||anyObs);
  }

  function validarRegistro(m) {
    if (m.oxigeno==='si' && !m.dispositivo) { showToast('Faltan datos oxígeno', 'warning'); return false; }
    if (m.aerosol==='si') { if(!m.aerosoles.salbutamol.use&&!m.aerosoles.ipratropio.use&&!m.aerosoles.budesonida.use) { showToast('Elige fármaco aerosol', 'warning'); return false; } }
    if (m.vmni==='si' && !m.tipo) { showToast('Faltan datos VMNI', 'warning'); return false; }
    return true;
  }

  function addRegistro() {
    const m = leerFormulario();
    if (isEmptyRecord(m)) { showToast('Sin datos', 'warning'); return; }
    if (!validarRegistro(m)) return;
    m.timestamp = new Date().toISOString();
    StateActions.addToArray('oxigenacion', m);
    renderTable();
    limpiarFormulario();
    showToast('Registro añadido', 'success');
  }

  function editarRegistro(i) {
    const item = GlobalState.oxigenacion?.[i];
    if (!item) return;
    setRadio('resp_oxigeno', item.oxigeno==='si'?'si':'no'); setVal('#resp_ox_dispositivo', item.dispositivo); setVal('#resp_ox_lpm', item.litros); setVal('#resp_ox_venti_pct', item.porcentaje);
    setRadio('resp_aero', item.aerosol==='si'?'si':'no');
    setChk('#aero_salbutamol', item.aerosoles?.salbutamol?.use); setVal('#aero_salbutamol_dosis', item.aerosoles?.salbutamol?.dosis); setVal('#aero_salbutamol_pauta', item.aerosoles?.salbutamol?.pauta);
    setChk('#aero_ipratropio', item.aerosoles?.ipratropio?.use); setVal('#aero_ipratropio_dosis', item.aerosoles?.ipratropio?.dosis); setVal('#aero_ipratropio_pauta', item.aerosoles?.ipratropio?.pauta);
    setChk('#aero_budesonida', item.aerosoles?.budesonida?.use); setVal('#aero_budesonida_dosis', item.aerosoles?.budesonida?.dosis); setVal('#aero_budesonida_pauta', item.aerosoles?.budesonida?.pauta);
    setRadio('resp_vmni', item.vmni==='si'?'si':'no'); setVal('#resp_vmni_tipo', item.tipo);
    setVal('#resp_oaf_flujo', item.vmniParams?.oaf_flujo); setVal('#resp_cpap_ipap', item.vmniParams?.cpap_ipap);
    setVal('#resp_bipap_ipap', item.vmniParams?.bipap_ipap); setVal('#resp_bipap_epap', item.vmniParams?.bipap_epap); setVal('#resp_bipap_ie', item.vmniParams?.bipap_ie);
    setVal('#resp_obs', item.obs);
    wireRespiratorioUI();
    moduleState.editingIndex = i;
    $('#btnAddResp').style.display='none'; $('#btnUpdateResp').style.display='inline-flex'; $('#btnCancelEditResp').style.display='inline-flex';
  }

  function actualizarRegistro() {
    if (moduleState.editingIndex < 0) return;
    const m = leerFormulario();
    if (isEmptyRecord(m)) return;
    if (!validarRegistro(m)) return;
    const orig = GlobalState.oxigenacion[moduleState.editingIndex];
    m.timestamp = orig.timestamp || new Date().toISOString();
    StateActions.updateInArray('oxigenacion', moduleState.editingIndex, m);
    renderTable(); cancelarEdicion(); showToast('Actualizado', 'success');
  }

  function eliminarRegistro(i) { StateActions.removeFromArray('oxigenacion', i); renderTable(); }
  function vaciarRegistros() { StateActions.clearArray('oxigenacion'); renderTable(); limpiarFormulario(); }
  function cancelarEdicion() { moduleState.editingIndex=-1; limpiarFormulario(); $('#btnAddResp').style.display='inline-flex'; $('#btnUpdateResp').style.display='none'; $('#btnCancelEditResp').style.display='none'; }

  function limpiarFormulario() {
    setRadio('resp_oxigeno','no'); setRadio('resp_aero','no'); setRadio('resp_vmni','no');
    setVal('#resp_ox_dispositivo',''); setVal('#resp_ox_lpm',''); setVal('#resp_ox_venti_pct','');
    setChk('#aero_salbutamol',0); setVal('#aero_salbutamol_dosis',''); setVal('#aero_salbutamol_pauta','');
    setChk('#aero_ipratropio',0); setVal('#aero_ipratropio_dosis',''); setVal('#aero_ipratropio_pauta','');
    setChk('#aero_budesonida',0); setVal('#aero_budesonida_dosis',''); setVal('#aero_budesonida_pauta','');
    setVal('#resp_vmni_tipo',''); setVal('#resp_oaf_flujo',''); setVal('#resp_cpap_ipap',''); setVal('#resp_bipap_ipap',''); setVal('#resp_bipap_epap',''); setVal('#resp_bipap_ie','');
    setVal('#resp_obs','');
    wireRespiratorioUI();
  }

  function renderTable() {
    const tbody = $('#tablaResp tbody'); if (!tbody) return; tbody.innerHTML = '';
    const arr = (GlobalState.oxigenacion || []).slice().reverse();
    if (!arr.length) { tbody.innerHTML='<tr><td colspan="7" style="text-align:center">Sin registros</td></tr>'; return; }
    arr.forEach((r, i) => {
      const realIdx = GlobalState.oxigenacion.length - 1 - i;
      const fechaFmt = r.timestamp ? new Date(r.timestamp).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'}) : '-';
      let ox='No'; if(r.oxigeno==='si') ox = r.dispositivo==='gafas_nasales' ? `Gafas ${r.litros}L` : `Venti ${r.porcentaje}`;
      let aero='No'; if(r.aerosol==='si') { const p=[]; if(r.aerosoles.salbutamol.use) p.push('Salbutamol'); if(r.aerosoles.ipratropio.use) p.push('Ipratropio'); if(r.aerosoles.budesonida.use) p.push('Budesonida'); aero=p.join(', '); }
      let vmni='No'; if(r.vmni==='si') vmni = (r.tipo||'').toUpperCase();
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${fechaFmt}</td><td>${ox}</td><td>${aero}</td><td>${vmni}</td><td>${r.obs||''}</td>
        <td><div style="display:flex;gap:4px"><button class="btn btn-sm" data-action="edit" data-index="${realIdx}"><i class="fas fa-pen"></i></button><button class="btn btn-sm danger" data-action="del" data-index="${realIdx}"><i class="fas fa-trash"></i></button></div></td>`;
      tbody.appendChild(tr);
    });
  }

  // SUSCRIPCIÓN
  StateManager.subscribe((n, a, c) => { if (c.oxigenacion !== undefined) renderTable(); });

  return { init, renderTable, addRegistro, actualizarRegistro, cancelarEdicion, vaciarRegistros, add:addRegistro, save:actualizarRegistro, clear:vaciarRegistros };
})();

export default OxigenacionModule;