// js/modules/cuidados.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const CuidadosModule = (() => {
  const st = { pautas: [], editIndex: -1 };

  async function init() {
    try { st.pautas = await DataLoader.cargarPautas(); } catch(e){}
    fillPautaSelects(); attachIntermitenteEnhancements(); wireUI();
    if (!Array.isArray(GlobalState.cuidados)) StateManager.updateState({ cuidados: [] });
    bindEvents(); renderTable();
  }

  function wireUI() {
    const rads = ['cui_diuresis','cui_depos','cui_mon','cui_mon_int','cui_mon_cont'];
    rads.forEach(name => document.querySelectorAll(`input[name="${name}"]`).forEach(r => r.addEventListener('change', updateUI)));
    updateUI();
  }

  function updateUI() {
    const getR = n => document.querySelector(`input[name="${n}"]:checked`)?.value === 'si';
    $('#cui_diuresis_block').style.display = getR('cui_diuresis') ? 'flex' : 'none';
    $('#cui_depos_block').style.display = getR('cui_depos') ? 'block' : 'none';
    $('#cui_mon_block').style.display = getR('cui_mon') ? 'flex' : 'none';
    $('#cui_mon_int_block').style.display = getR('cui_mon_int') ? 'flex' : 'none';
    $('#cui_mon_cont_block').style.display = getR('cui_mon_cont') ? 'flex' : 'none';
  }

  function leerFormulario() {
    const gen = [];
    ['cui_cama','cui_sedest','cui_deamb','cui_cpost','cui_barand','cui_timbre','cui_upp'].forEach(id => {
      const el=document.getElementById(id); if(el&&el.checked) gen.push(el.parentElement.innerText.trim());
    });
    const diu = { si: document.querySelector('input[name="cui_diuresis"]:checked')?.value === 'si', tipo: $('#cui_diuresis_tipo')?.value };
    const dep = document.querySelector('input[name="cui_depos"]:checked')?.value === 'si';
    const mon = document.querySelector('input[name="cui_mon"]:checked')?.value === 'si';
    let inter = null;
    if (mon && document.querySelector('input[name="cui_mon_int"]:checked')?.value === 'si') {
      inter = {}; ['ta','temp','fc','sat','glu','gcs'].forEach(k => {
        inter[k] = { use: document.getElementById('int_'+k)?.checked, pauta: document.getElementById('int_'+k+'_pauta')?.value };
      });
    }
    let cont = null;
    if (mon && document.querySelector('input[name="cui_mon_cont"]:checked')?.value === 'si') {
      cont = {}; ['ecg','sat','fc','ta'].forEach(k => cont[k] = document.getElementById('cont_'+k)?.checked);
    }
    return { general: gen, diuresis: diu, depos: dep, mon, intermitente: inter, continua: cont, obs: $('#cui_obs')?.value };
  }

  function onAdd() {
    const d = leerFormulario();
    d.timestamp = new Date().toISOString();
    const arr = [...(GlobalState.cuidados||[])]; arr.push(d);
    StateManager.updateState({ cuidados: arr });
    limpiarFormulario(); renderTable(); showToast('Añadido', 'success');
  }

  function onUpdate() {
    if (st.editIndex<0) return;
    const d = leerFormulario();
    d.timestamp = GlobalState.cuidados[st.editIndex].timestamp || new Date().toISOString();
    const arr = [...GlobalState.cuidados]; arr[st.editIndex] = d;
    StateManager.updateState({ cuidados: arr });
    onCancel(); renderTable(); showToast('Actualizado', 'success');
  }
  function onDelete(i) {
    const arr = [...GlobalState.cuidados]; arr.splice(i, 1);
    StateManager.updateState({ cuidados: arr });
    renderTable();
  }
  function onVaciar() { StateManager.updateState({ cuidados: [] }); renderTable(); limpiarFormulario(); }
  function onCancel() { st.editIndex=-1; limpiarFormulario(); $('#btnAddCuidados').style.display='inline-flex'; $('#btnUpdateCuidados').style.display='none'; $('#btnCancelEditCuidados').style.display='none'; }

  function onEdit(i) {
    const r = GlobalState.cuidados[i]; if(!r) return;
    // Set values... (Simplified for brevity, logic remains same as before)
    limpiarFormulario(); // Reset visual
    // Apply values
    (r.general||[]).forEach(t => {
       if(t.includes('Cama')) $('#cui_cama').checked=true;
       if(t.includes('Sedest')) $('#cui_sedest').checked=true;
       if(t.includes('deambular')) $('#cui_deamb').checked=true;
       if(t.includes('Barand')) $('#cui_barand').checked=true;
       if(t.includes('Timbre')) $('#cui_timbre').checked=true;
       if(t.includes('UPP')) $('#cui_upp').checked=true;
    });
    if(r.diuresis?.si) { document.querySelector('input[name="cui_diuresis"][value="si"]').checked=true; $('#cui_diuresis_tipo').value=r.diuresis.tipo; }
    if(r.depos) document.querySelector('input[name="cui_depos"][value="si"]').checked=true;
    if(r.mon) {
       document.querySelector('input[name="cui_mon"][value="si"]').checked=true;
       if(r.intermitente) {
          document.querySelector('input[name="cui_mon_int"][value="si"]').checked=true;
          for(let k in r.intermitente) { if(r.intermitente[k].use) { $('#int_'+k).checked=true; $('#int_'+k+'_pauta').value=r.intermitente[k].pauta; } }
       }
       if(r.continua) {
          document.querySelector('input[name="cui_mon_cont"][value="si"]').checked=true;
          for(let k in r.continua) { if(r.continua[k]) $('#cont_'+k).checked=true; }
       }
    }
    $('#cui_obs').value = r.obs || '';
    updateUI();
    st.editIndex = i;
    $('#btnAddCuidados').style.display='none'; $('#btnUpdateCuidados').style.display='inline-flex'; $('#btnCancelEditCuidados').style.display='inline-flex';
  }

  function bindEvents() {
    const card = $('#cuidados-card'); if(!card) return;
    card.addEventListener('click', e => {
      const btn = e.target.closest('button'); if(!btn) return; e.preventDefault();
      if(btn.id==='btnAddCuidados') onAdd(); else if(btn.id==='btnUpdateCuidados') onUpdate(); else if(btn.id==='btnCancelEditCuidados') onCancel(); else if(btn.id==='btnVaciarCuidados') onVaciar();
      const act=btn.dataset.action, idx=parseInt(btn.dataset.index, 10);
      if(!isNaN(idx)) { if(act==='edit') onEdit(idx); if(act==='del') onDelete(idx); }
    });
  }

  function limpiarFormulario() {
    document.querySelectorAll('#cuidados-card input[type="checkbox"]').forEach(c => c.checked=false);
    document.querySelectorAll('#cuidados-card input[type="radio"][value="no"]').forEach(c => c.checked=true);
    document.querySelectorAll('#cuidados-card select').forEach(s => s.value='');
    $('#cui_obs').value='';
    updateUI();
  }

  function renderTable() {
    const tbody = $('#tablaCuidados tbody'); if(!tbody) return; tbody.innerHTML='';
    const arr = (GlobalState.cuidados||[]).slice().reverse();
    if(!arr.length) { tbody.innerHTML='<tr><td colspan="8" style="text-align:center">Sin registros</td></tr>'; return; }
    arr.forEach((r, i) => {
      const realIdx = GlobalState.cuidados.length - 1 - i;
      const date = r.timestamp ? new Date(r.timestamp).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'}) : '-';
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${date}</td><td>${(r.general||[]).join(', ')}</td><td>${r.diuresis?.si?r.diuresis.tipo:'No'}</td><td>${r.depos?'Sí':'No'}</td><td>${r.mon?'Sí':'No'}</td><td>${r.obs||''}</td>
        <td><div style="display:flex;gap:4px"><button class="btn btn-sm" data-action="edit" data-index="${realIdx}"><i class="fas fa-pen"></i></button><button class="btn btn-sm danger" data-action="del" data-index="${realIdx}"><i class="fas fa-trash"></i></button></div></td>`;
      tbody.appendChild(tr);
    });
  }

  function fillPautaSelects() {
    const opts = st.pautas.map(p => `<option value="${p}">${p}</option>`).join('');
    ['ta','temp','fc','sat','glu','gcs'].forEach(k => { const s=$('#int_'+k+'_pauta'); if(s) s.innerHTML='<option value="">Frec...</option>'+opts; });
  }

  function attachIntermitenteEnhancements() {
    ['ta','temp','fc','sat','glu','gcs'].forEach(k => {
      const chk=$('#int_'+k), sel=$('#int_'+k+'_pauta');
      if(chk && sel) chk.addEventListener('change', () => { if(chk.checked && !sel.value) sel.value=st.pautas[1]||'Cada 8 horas'; });
    });
  }

  // SUSCRIPCIÓN
  StateManager.subscribe((n, a, c) => { if (c.cuidados !== undefined) renderTable(); });

  return { init, renderTable, add: onAdd, update: onUpdate, cancel: onCancel, clear: onVaciar };
})();

export default CuidadosModule;