// modules/paciente.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';
import LETModule from './let.js';

const safeToast = (msg, type = 'info', ms = 2000) => {
  try { if (typeof showToast === 'function') showToast(msg, type, ms); } catch(_) {}
};

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').trim();
const esc = (s) => (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PacienteModule = (() => {
  const moduleState = {
    alergias: [],
    listas: { especialidades: [], profesionales: [] }
  };

  const COL_WIDTHS = { col1: '15%', col2: '25%', col3: '15%', col4: '15%', col5: '30%' };
  const cellStyle = (width) => `width: ${width}; word-wrap: break-word; vertical-align: top;`;

  const findSelectText = (selectElement) => {
      if (!selectElement) return '---';
      const val = selectElement.value || GlobalState.paciente?.area || '';
      const opt = selectElement.querySelector(`option[value="${val}"]`);
      return opt ? opt.textContent : (val || '---');
  };

  const formatFecha = (isoString) => {
      if (!isoString) return '---';
      try { return new Date(isoString).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return isoString; }
  };

  const fmtFechaCorta = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); } catch(e) { return '-'; }
  };

  async function init() {
    await cargarYpintarListas();
    cargarDesdeEstado(); 
    bindEvents(); 
  }

  async function cargarYpintarListas() {
    try {
      const [profesionales, especialidades] = await Promise.all([DataLoader.cargarProfesionales?.() || [], DataLoader.cargarEspecialidades?.() || []]);
      moduleState.listas.especialidades = Array.isArray(especialidades) ? especialidades : [];
      moduleState.listas.profesionales  = Array.isArray(profesionales)  ? profesionales  : [];
      pintarEspecialidades(moduleState.listas.especialidades);
      pintarProfesionales(moduleState.listas.profesionales);
      const p = GlobalState.paciente || {};
      if (p.area) DOMHelpers.setValue('#pac_area', p.area);
      if (p.medico) DOMHelpers.setValue('#pac_medico', p.medico);
    } catch (err) { safeToast('Error cargando listas', 'error'); }
  }

  function bindEvents() {
    const card = $('#paciente-card') || document;
    $('#btnAddAlergia')?.addEventListener('click', addAlergia);
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-alergia-chip="remove"]');
      if (btn) removeAlergia(btn.dataset.value);
    });
    ['#pac_sexo', '#pac_area', '#pac_medico', '#pac_fecha'].forEach(id => $(id)?.addEventListener('change', syncFormularioEnEstado));
    ['#pac_hisclin', '#pac_edad', '#pac_peso', '#pac_diagnostico'].forEach(id => $(id)?.addEventListener('input', syncFormularioEnEstado));
  }

  function syncPrintCard() {
      const p = GlobalState.paciente || {};
      const hisclin = p.hisclin || '---';
      const edad = p.edad || '---';
      const sexo = p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : '---';
      const peso = p.peso ? `${p.peso} kg` : '---';
      const alergiasTxt = (p.alergias && p.alergias.length > 0) ? p.alergias.join(', ') : 'Ninguna conocida';
      const renal = p.insuf_renal === 'si' ? 'Sí' : 'No';
      const hepatica = p.insuf_hepatica === 'si' ? 'Sí' : 'No';
      const areaSelect = $('#pac_area');
      const areaText = areaSelect ? findSelectText(areaSelect) : (p.area || '---');
      const medico = p.medico || '---';
      const fecha = formatFecha(p.fecha);
      const diagnostico = p.diagnostico || '---';

      const mapIds = {
          '#print_pac_hisclin': hisclin, '#print_pac_edad': edad, '#print_pac_sexo': sexo, '#print_pac_peso': peso,
          '#print_pac_alergias': alergiasTxt, '#print_pac_renal': renal, '#print_pac_hepatica': hepatica,
          '#print_pac_area': areaText, '#print_pac_medico': medico, '#print_pac_fecha': fecha, '#print_pac_diagnostico': diagnostico,
          
          '#print_enf_hisclin': hisclin, '#print_enf_edad': edad, '#print_enf_sexo': sexo, '#print_enf_peso': peso,
          '#print_enf_alergias': alergiasTxt, '#print_enf_renal': renal, '#print_enf_hepatica': hepatica,
          '#print_enf_area': areaText, '#print_enf_fecha': fecha, '#print_enf_diagnostico': diagnostico
      };
      for (const [sel, val] of Object.entries(mapIds)) DOMHelpers.setInnerHTML(sel, val);

      fillInfoTable1x4();
      buildMedicoPrintTable();
      buildEnfermeriaPrintTable(); 
      buildExtraTablesPrint();

      const letInfo = LETModule.getParaImpresion();
      const showLET = (idC, idT) => {
          const c = $(idC), t = $(idT);
          if(c && t) {
             if(letInfo.tieneLET) { t.innerHTML = esc(letInfo.texto); c.style.display = 'block'; }
             else { t.innerHTML = ''; c.style.display = 'none'; }
          }
      };
      showLET('#print_let_container', '#print_let_texto');
      showLET('#print_let_container_enf', '#print_let_texto_enf');
  }

  function fillInfoTable1x4() {
      // 1. CUIDADOS
      const cuidadosList = [];
      (GlobalState.cuidados || []).forEach(c => {
          if(c.general && c.general.length) cuidadosList.push(c.general.join(', '));
          if(c.diuresis?.si) cuidadosList.push(`Diuresis: ${c.diuresis.tipo}`);
          if(c.mon) cuidadosList.push(`Monitorización`);
          if(c.obs) cuidadosList.push(c.obs);
      });
      DOMHelpers.setInnerHTML('#print_enf_info_cuidados', cuidadosList.join('<br>') || '-');

      // 2. DIETAS
      const dietasList = [];
      (GlobalState.dietas || []).forEach(d => {
          let txt = `<strong>${d.tipo_text}</strong>`;
          if(d.consistencia_text) txt += ` (${d.consistencia_text})`;
          if(d.celiaquia === 'si') txt += ' [CELIACO]';
          if(d.intolerancias?.length) txt += ` [INTOL: ${d.intolerancias.join(',')}]`;
          dietasList.push(txt);
      });
      DOMHelpers.setInnerHTML('#print_enf_info_dietas', dietasList.join('<br>') || '-');

      // 3. FLUIDOS
      const fluidosList = [];
      (GlobalState.fluidos || []).forEach(f => {
          let txt = `<strong>${f.solucion || 'Fisiológico'}</strong>`;
          if(f.volumen) txt += ` ${f.volumen}ml`;
          if(f.via === 'con' && f.ritmo) txt += ` a ${f.ritmo}ml/h`;
          else if(f.frecuencia) txt += ` (${f.frecuencia})`;
          fluidosList.push(txt);
      });
      DOMHelpers.setInnerHTML('#print_enf_info_fluidos', fluidosList.join('<br>') || '-');

      // 4. RESPIRATORIO
      const respList = [];
      (GlobalState.oxigenacion || []).forEach(r => {
          let txt = '';
          if(r.oxigeno === 'si') txt += `O2: ${r.dispositivo} ${r.litros}L `;
          if(r.aerosol === 'si') {
             const a = []; if(r.aerosoles?.salbutamol?.use) a.push('Salb'); if(r.aerosoles?.ipratropio?.use) a.push('Ipra'); if(r.aerosoles?.budesonida?.use) a.push('Bud');
             if(a.length) txt += `Aero: ${a.join('+')} `;
          }
          if(r.vmni === 'si') txt += `VMNI: ${r.tipo}`;
          if(txt) respList.push(txt);
      });
      DOMHelpers.setInnerHTML('#print_enf_info_resp', respList.join('<br>') || '-');
  }

  function buildMedicoPrintTable() {
      const tbody = $('#print_medico_tbody'); if (!tbody) return;
      const thead = tbody.parentElement.querySelector('thead');
      if (thead && thead.querySelectorAll('th').length === 6) {
          thead.innerHTML = `<tr><th style="${cellStyle(COL_WIDTHS.col1)}">Tipo</th><th style="${cellStyle(COL_WIDTHS.col2)}">Fármaco</th><th style="${cellStyle(COL_WIDTHS.col3)}">Dosis</th><th style="${cellStyle(COL_WIDTHS.col4)}">Vía</th><th style="${cellStyle(COL_WIDTHS.col5)}">Pauta / Obs</th></tr>`;
      }
      tbody.innerHTML = '';
      let combinedMeds = [];
      (GlobalState.prescripciones || []).forEach(p => combinedMeds.push({ tipo: 'Actual', farmaco: p.farmaco, dosis: p.dosis, via: p.via, pauta: `${p.pauta} (${p.inicio}, ${p.dias}d)`, obs: [p.indicacion, p.obs].filter(Boolean).join(' / ') }));
      (GlobalState.opcionales || []).forEach(o => combinedMeds.push({ tipo: 'Opcional', farmaco: o.farmaco, dosis: o.dosis, via: o.via, pauta: `${o.condicion} (Máx: ${o.freqmax})`, obs: o.obs }));
      (GlobalState.puntuales || []).forEach(p => combinedMeds.push({ tipo: 'Puntual', farmaco: p.farmaco, dosis: p.dosis, via: p.via, pauta: `Cuándo: ${p.cuando}`, obs: [p.indicacion, p.obs].filter(Boolean).join(' / ') }));
      (GlobalState.domicilio || []).forEach(d => combinedMeds.push({ tipo: 'Domicilio', farmaco: d.farmaco, dosis: d.dosis, via: d.via, pauta: `${d.freq} (${d.inicio}, ${d.dias}d)`, obs: [d.indicacion, d.obs].filter(Boolean).join(' / ') }));

      if (combinedMeds.length === 0) tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Sin tratamiento farmacológico</td></tr>';
      else combinedMeds.forEach(m => {
          const tr = document.createElement('tr');
          const pautaObs = [m.pauta, m.obs].filter(Boolean).join('<br><small><i>') + (m.obs ? '</i></small>' : '');
          tr.innerHTML = `<td style="${cellStyle(COL_WIDTHS.col1)}"><strong>${esc(m.tipo)}</strong></td><td style="${cellStyle(COL_WIDTHS.col2)}">${esc(m.farmaco)}</td><td style="${cellStyle(COL_WIDTHS.col3)}">${esc(m.dosis)}</td><td style="${cellStyle(COL_WIDTHS.col4)}">${esc(m.via)}</td><td style="${cellStyle(COL_WIDTHS.col5)}">${pautaObs}</td>`;
          tbody.appendChild(tr);
      });
  }

  function buildEnfermeriaPrintTable() {
      const headerRow = $('#enf_header_row');
      const tbody = $('#print_enfermeria_tbody');
      if (!headerRow || !tbody) return;

      let headerHTML = '<th class="col-info">TRATAMIENTO / HORARIO</th>';
      for (let i = 0; i < 24; i++) headerHTML += '<th class="col-hour"></th>';
      headerRow.innerHTML = headerHTML;
      tbody.innerHTML = '';

      const groups = { actual: [], opc: [], punt: [], dom: [] };

      // AÑADIDOS ICONOS A CADA TIPO DE MEDICACIÓN
      (GlobalState.prescripciones || []).forEach(p => groups.actual.push(`<i class="fas fa-pills"></i> ${p.farmaco} ${p.dosis} (${p.via}) - ${p.pauta}`));
      (GlobalState.opcionales || []).forEach(o => groups.opc.push(`<strong><i class="fas fa-lightbulb"></i> (OPC)</strong> ${o.farmaco} ${o.dosis} - ${o.condicion}`));
      (GlobalState.puntuales || []).forEach(p => groups.punt.push(`<strong><i class="fas fa-clock"></i> (PUN)</strong> ${p.farmaco} ${p.dosis} - ${p.cuando}`));
      (GlobalState.domicilio || []).forEach(d => groups.dom.push(`<strong><i class="fas fa-house-chimney"></i> (DOM)</strong> ${d.farmaco} ${d.dosis} - ${d.freq}`));

      const printGroup = (items) => {
          items.forEach((txt) => {
              const tr = document.createElement('tr');
              let html = `<td class="col-info">${txt}</td>`; // No usamos esc() porque ya contiene HTML seguro (iconos)
              for(let i=0; i<24; i++) html += `<td class="col-hour"></td>`;
              tr.innerHTML = html;
              tbody.appendChild(tr);
          });
      };

      printGroup(groups.actual);
      printGroup(groups.opc);
      printGroup(groups.punt);
      printGroup(groups.dom);

      for(let k=0; k<2; k++) {
          const tr = document.createElement('tr');
          let html = `<td class="col-info">&nbsp;</td>`;
          for(let i=0; i<24; i++) html += `<td class="col-hour"></td>`;
          tr.innerHTML = html;
          tbody.appendChild(tr);
      }
  }

  function buildExtraTablesPrint() {
    const container = $('#print_extra_tables_container');
    if (!container) return;
    container.innerHTML = ''; 
    const configs = [
        { t: 'Dietas', i: 'fas fa-utensils', d: GlobalState.dietas, c: ['Fecha','Tipo','Consistencia','Detalle','Obs'], m: d=>[fmtFechaCorta(d.timestamp), d.tipo_text, d.consistencia_text, [d.celiaquia==='si'?'Celíaco':'', (d.intolerancias||[]).join(',')].join(' '), d.observaciones] },
        { t: 'Fluidoterapia', i: 'fas fa-tint', d: GlobalState.fluidos, c: ['Fecha','Solución','Vol','Ritmo','Obs'], m: f=>[fmtFechaCorta(f.timestamp), f.solucion, f.volumen+'ml', (f.via==='con'?f.ritmo+' ml/h':f.frecuencia), f.obs] },
        { t: 'Respiratorio', i: 'fas fa-lungs', d: GlobalState.oxigenacion, c: ['Fecha','Oxígeno','Aerosol','VMNI','Obs'], m: r => {
                let ox = 'No'; if (r.oxigeno === 'si') ox = r.dispositivo === 'gafas_nasales' ? `Gafas ${r.litros}L` : `Venti ${r.porcentaje}`;
                let aero = 'No'; if (r.aerosol === 'si') { const a = []; if(r.aerosoles?.salbutamol?.use) a.push('Salbutamol'); if(r.aerosoles?.ipratropio?.use) a.push('Ipratropio'); if(r.aerosoles?.budesonida?.use) a.push('Budesonida'); aero = a.join(', '); }
                let vmni = (r.vmni === 'si') ? (r.tipo || '').toUpperCase() : 'No';
                return [fmtFechaCorta(r.timestamp), ox, aero, vmni, r.obs];
            } 
        },
        { t: 'Cuidados y Constantes', i: 'fas fa-heartbeat', d: GlobalState.cuidados, c: ['Fecha','General','Diuresis','Monitor','Obs'], m: c=>[fmtFechaCorta(c.timestamp), (c.general||[]).join(','), c.diuresis?.si?c.diuresis.tipo:'No', c.mon?'Sí':'No', c.obs] },
        { t: 'Pruebas y Consultas', i: 'fas fa-vial', d: GlobalState.pruebas, c: ['Fecha','Ana','Rad','Cons','Obs'], m: p=>[fmtFechaCorta(p.timestamp), p.analiticas?'Sí':'-', p.radiologia?'Sí':'-', (p.hojasConsulta||[]).join(','), p.obs] }
    ];

    configs.forEach(cfg => {
        if(!cfg.d || !cfg.d.length) return;
        const h3 = document.createElement('h3'); 
        h3.style.cssText="margin:15px 0 5px;border-bottom:1px solid #ccc;font-size:11pt"; 
        h3.innerHTML = `<i class="${cfg.i}"></i> ${cfg.t}`;
        container.appendChild(h3);
        
        const tbl = document.createElement('table'); tbl.className='print-table';
        let ths = ''; cfg.c.forEach((c,i)=>ths+=`<th style="${cellStyle(COL_WIDTHS['col'+(i+1)])}">${c}</th>`);
        tbl.innerHTML = `<thead><tr>${ths}</tr></thead><tbody></tbody>`;
        const tb = tbl.querySelector('tbody');
        [...cfg.d].reverse().forEach(it => {
            const row = cfg.m(it); let tds=''; row.forEach((t,i)=>tds+=`<td style="${cellStyle(COL_WIDTHS['col'+(i+1)])}">${t||'-'}</td>`);
            const tr=document.createElement('tr'); tr.innerHTML=tds; tb.appendChild(tr);
        });
        container.appendChild(tbl);
    });
  }

  function addAlergia() { const i=$('#pac_alergia_input'); const v=(i?.value||'').trim(); if(!v)return safeToast('Escribe alergia','warning'); if(moduleState.alergias.includes(v))return; moduleState.alergias.push(v); i.value=''; pintarAlergiasChips(); volcarAlergiasEnEstado(); }
  function removeAlergia(v) { moduleState.alergias=moduleState.alergias.filter(a=>a!==v); pintarAlergiasChips(); volcarAlergiasEnEstado(); }
  function pintarAlergiasChips() { const w=$('#alergias-list'); if(w){ w.innerHTML=''; moduleState.alergias.forEach(t=>{ w.innerHTML+=`<span class="chip">${t} <button class="chip-remove" data-alergia-chip="remove" data-value="${t}">×</button></span>`; }); } }
  function volcarAlergiasEnEstado() { const s={...GlobalState}; s.paciente.alergias=[...moduleState.alergias]; StateManager.updateState(s); syncPrintCard(); }
  function pintarEspecialidades(l) { const s=$('#pac_area'); if(s){ s.innerHTML='<option value="">...</option>'; l.forEach(t=>s.innerHTML+=`<option value="${norm(t)}">${t}</option>`); } }
  function pintarProfesionales(l) { const s=$('#pac_medico'); if(s){ s.innerHTML='<option value="">...</option>'; l.forEach(t=>s.innerHTML+=`<option value="${t}">${t}</option>`); } }
  function syncFormularioEnEstado() { 
      const s={...GlobalState}; s.paciente.hisclin=$('#pac_hisclin')?.value; s.paciente.edad=$('#pac_edad')?.value; 
      s.paciente.sexo=$('#pac_sexo')?.value; s.paciente.peso=$('#pac_peso')?.value; s.paciente.area=$('#pac_area')?.value; 
      s.paciente.medico=$('#pac_medico')?.value; s.paciente.fecha=$('#pac_fecha')?.value; 
      s.paciente.diagnostico=$('#pac_diagnostico')?.value; 
      StateManager.updateState(s); syncPrintCard(); 
  }
  function cargarDesdeEstado() {
      const p=GlobalState.paciente||{}; 
      DOMHelpers.setValue('#pac_hisclin',p.hisclin); DOMHelpers.setValue('#pac_edad',p.edad); 
      DOMHelpers.setValue('#pac_sexo',p.sexo); DOMHelpers.setValue('#pac_peso',p.peso); 
      DOMHelpers.setValue('#pac_area',p.area); DOMHelpers.setValue('#pac_medico',p.medico); 
      DOMHelpers.setValue('#pac_fecha',p.fecha); DOMHelpers.setValue('#pac_diagnostico',p.diagnostico || '');
      $$('.si-no-btn').forEach(b=>b.classList.remove('selected'));
      $(`.si-no-btn[data-tipo="renal"][data-valor="${p.insuf_renal||'no'}"]`)?.classList.add('selected');
      $(`.si-no-btn[data-tipo="hepatica"][data-valor="${p.insuf_hepatica||'no'}"]`)?.classList.add('selected');
      moduleState.alergias=[...(p.alergias||[])]; pintarAlergiasChips(); syncPrintCard();
  }
  function setInsuficiencia(p) { if(!p)return; const s={...GlobalState}; s.paciente[p.tipo==='renal'?'insuf_renal':'insuf_hepatica']=p.valor; StateManager.updateState(s); syncPrintCard(); return true; }

  StateManager.subscribe((n,a,c)=>{ if(c.paciente) cargarDesdeEstado(); });

  return { init, addAlergia, removeAlergia: p=>removeAlergia(p?.value), getAlergias:()=>[...moduleState.alergias], setInsuficiencia, cargarDesdeEstado };
})();

export default PacienteModule;