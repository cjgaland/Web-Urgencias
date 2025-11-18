// modules/pruebas.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const PruebasModule = (() => {
  const st = { editIndex: -1, especialidades: [], hojasSeleccionadas: [] };

  async function init() {
    try { st.especialidades = await DataLoader.cargarEspecialidades(); } catch(e){}
    rellenarEspecialidades(); wireUI();
    if (!Array.isArray(GlobalState.pruebas)) StateManager.updateState({ pruebas: [] });
    bindEvents(); renderTable();
  }

  function rellenarEspecialidades() {
    const s=$('#pr_hc_esp'); if(!s)return; s.innerHTML='<option value="">Seleccionar...</option>';
    st.especialidades.forEach(e=>{ const o=document.createElement('option'); o.value=e; o.textContent=e; s.appendChild(o); });
  }

  function wireUI() {
    ['pr_ana','pr_rx','pr_otras','pr_hc'].forEach(name => {
       document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.addEventListener('change', updateUI));
    });
    updateUI();
  }
  function updateUI() {
    const chk = n => document.querySelector(`input[name="${n}"]:checked`)?.value==='si';
    $('#pr_ana_block').style.display=chk('pr_ana')?'inline-flex':'none';
    $('#pr_rx_block').style.display=chk('pr_rx')?'inline-flex':'none';
    $('#pr_otras_block').style.display=chk('pr_otras')?'inline-flex':'none';
    $('#pr_hc_block').style.display=chk('pr_hc')?'inline-flex':'none';
  }

  function bindEvents() {
    const card = $('#pruebas-card'); if(!card) return;
    card.addEventListener('click', e => {
      const btn = e.target.closest('button'); if(!btn) return; e.preventDefault();
      if(btn.id==='btnAddPruebas') onAdd(); else if(btn.id==='btnUpdatePruebas') onUpdate(); else if(btn.id==='btnCancelEditPruebas') onCancel(); else if(btn.id==='btnVaciarPruebas') onVaciar();
      else if(btn.id==='btnAddHC') addHC();
      else if(btn.dataset.chip==='hc-remove') removeHC(btn.dataset.value);
      const act=btn.dataset.action, idx=parseInt(btn.dataset.index, 10);
      if(!isNaN(idx)) { if(act==='edit') onEdit(idx); if(act==='del') onDelete(idx); }
    });
  }

  function addHC() {
    const val=$('#pr_hc_esp')?.value; if(!val) return showToast('Elige especialidad','warning');
    if(st.hojasSeleccionadas.includes(val)) return showToast('Ya existe','info');
    st.hojasSeleccionadas.push(val); pintarHC();
  }
  function removeHC(val) { st.hojasSeleccionadas = st.hojasSeleccionadas.filter(x=>x!==val); pintarHC(); }
  function pintarHC() {
    const w=$('#pr_hc_chips'); if(!w)return; w.innerHTML='';
    st.hojasSeleccionadas.forEach(h => {
       w.innerHTML += `<span class="chip">${h} <button class="chip-remove" data-chip="hc-remove" data-value="${h}">×</button></span>`;
    });
  }

  function leerFormulario() {
    const ana = document.querySelector('input[name="pr_ana"]:checked')?.value==='si';
    const rx = document.querySelector('input[name="pr_rx"]:checked')?.value==='si';
    const otr = document.querySelector('input[name="pr_otras"]:checked')?.value==='si';
    const hc = document.querySelector('input[name="pr_hc"]:checked')?.value==='si';
    const data = { analiticas:null, radiologia:null, otras:null, hojasConsulta:[], obs: $('#pr_obs')?.value };

    if(ana) { data.analiticas={}; ['hemo','bioq','coag','orina','hemoc','uroc'].forEach(k=>data.analiticas[k]=$('#ana_'+k)?.checked); }
    if(rx) { data.radiologia={}; ['simple','eco','tac_c','tac_s','rmn'].forEach(k=>data.radiologia[k]=$('#rx_'+k)?.checked); }
    if(otr) { data.otras={}; ['eda','colo','bronco'].forEach(k=>data.otras[k]=$('#ot_'+k)?.checked); }
    if(hc) data.hojasConsulta = [...st.hojasSeleccionadas];
    return data;
  }

  function onAdd() {
    const d = leerFormulario(); d.timestamp=new Date().toISOString();
    const arr=[...(GlobalState.pruebas||[])]; arr.push(d);
    StateManager.updateState({ pruebas: arr });
    limpiarFormulario(); renderTable(); showToast('Añadido','success');
  }
  function onUpdate() {
    if(st.editIndex<0)return;
    const d = leerFormulario(); d.timestamp=GlobalState.pruebas[st.editIndex].timestamp || new Date().toISOString();
    const arr=[...GlobalState.pruebas]; arr[st.editIndex]=d;
    StateManager.updateState({ pruebas: arr });
    onCancel(); renderTable(); showToast('Actualizado','success');
  }
  function onDelete(i) {
    const arr=[...GlobalState.pruebas]; arr.splice(i,1);
    StateManager.updateState({ pruebas: arr });
    renderTable();
  }
  function onVaciar() { StateManager.updateState({ pruebas: [] }); renderTable(); limpiarFormulario(); }
  function onCancel() { st.editIndex=-1; limpiarFormulario(); $('#btnAddPruebas').style.display='inline-flex'; $('#btnUpdatePruebas').style.display='none'; $('#btnCancelEditPruebas').style.display='none'; }

  function onEdit(i) {
    const r = GlobalState.pruebas[i]; if(!r) return;
    limpiarFormulario();
    if(r.analiticas) { document.querySelector('input[name="pr_ana"][value="si"]').checked=true; for(let k in r.analiticas) if(r.analiticas[k]) $('#ana_'+k).checked=true; }
    if(r.radiologia) { document.querySelector('input[name="pr_rx"][value="si"]').checked=true; for(let k in r.radiologia) if(r.radiologia[k]) $('#rx_'+k).checked=true; }
    if(r.otras) { document.querySelector('input[name="pr_otras"][value="si"]').checked=true; for(let k in r.otras) if(r.otras[k]) $('#ot_'+k).checked=true; }
    if(r.hojasConsulta && r.hojasConsulta.length) {
        document.querySelector('input[name="pr_hc"][value="si"]').checked=true;
        st.hojasSeleccionadas = [...r.hojasConsulta]; pintarHC();
    }
    $('#pr_obs').value = r.obs||'';
    updateUI();
    st.editIndex = i;
    $('#btnAddPruebas').style.display='none'; $('#btnUpdatePruebas').style.display='inline-flex'; $('#btnCancelEditPruebas').style.display='inline-flex';
  }

  function limpiarFormulario() {
    document.querySelectorAll('#pruebas-card input[type="checkbox"]').forEach(c=>c.checked=false);
    document.querySelectorAll('#pruebas-card input[type="radio"][value="no"]').forEach(c=>c.checked=true);
    $('#pr_obs').value=''; st.hojasSeleccionadas=[]; pintarHC(); updateUI();
  }

  function renderTable() {
    const tbody = $('#tablaPruebas tbody'); if(!tbody) return; tbody.innerHTML='';
    const arr = (GlobalState.pruebas||[]).slice().reverse();
    if(!arr.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center">Sin registros</td></tr>'; return; }
    arr.forEach((r, i) => {
        const realIdx = GlobalState.pruebas.length - 1 - i;
        const date = r.timestamp ? new Date(r.timestamp).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'}) : '-';
        const ana = r.analiticas ? 'Sí' : '-';
        const rx = r.radiologia ? 'Sí' : '-';
        const otr = r.otras ? 'Sí' : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${date}</td><td>${ana}</td><td>${rx}</td><td>${otr}</td><td>${(r.hojasConsulta||[]).join(', ')}</td><td>${r.obs||''}</td>
          <td><div style="display:flex;gap:4px"><button class="btn btn-sm" data-action="edit" data-index="${realIdx}"><i class="fas fa-pen"></i></button><button class="btn btn-sm danger" data-action="del" data-index="${realIdx}"><i class="fas fa-trash"></i></button></div></td>`;
        tbody.appendChild(tr);
    });
  }

  // SUSCRIPCIÓN
  StateManager.subscribe((n, a, c) => { if (c.pruebas !== undefined) renderTable(); });

  return { init, renderTable, add:onAdd, update:onUpdate, cancel:onCancel, clear:onVaciar };
})();

export default PruebasModule;