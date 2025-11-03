// modules/paciente.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';
import LETModule from './let.js'; // <-- MODIFICACIÓN: Importar LETModule

const safeToast = (msg, type = 'info', ms = 2000) => {
  try { if (typeof showToast === 'function') showToast(msg, type, ms); } catch(_) {}
};

const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_')
  .trim();

// +++ AÑADIR ESTE HELPER +++
// Para escapar HTML y prevenir XSS simple
const esc = (s) => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


export const PacienteModule = (() => {
  const moduleState = {
    alergias: [],
    listas: {
      especialidades: [],
      profesionales: []
    }
  };

  // +++ 1. NUEVOS HELPERS (AÑADIR ESTOS DOS) +++
  const findSelectText = (selectElement) => {
      if (!selectElement) return '---';
      // Usamos el estado global si el select aún no tiene el valor (p.ej. en carga inicial)
      const val = selectElement.value || GlobalState.paciente?.area || '';
      const opt = selectElement.querySelector(`option[value="${val}"]`);
      return opt ? opt.textContent : (val || '---');
  };

  const formatFecha = (isoString) => {
      if (!isoString) return '---';
      try {
          const d = new Date(isoString);
          // Formato: 24/10/2025 14:30
          return d.toLocaleString('es-ES', { 
              day: '2-digit', month: '2-digit', year: 'numeric', 
              hour: '2-digit', minute: '2-digit' 
          });
      } catch (e) {
          return isoString; // fallback
      }
  };
  // +++ FIN HELPERS +++


  // +++ 2. FUNCIÓN DE SINCRONIZACIÓN (MODIFICADA) +++
  function syncPrintCard() {
      const p = GlobalState.paciente || {};

      // --- Datos a formatear ---
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

      // Tarjeta 1: HOJA DE TRATAMIENTO MÉDICO
      DOMHelpers.setInnerHTML('#print_pac_hisclin', hisclin);
      DOMHelpers.setInnerHTML('#print_pac_edad', edad);
      DOMHelpers.setInnerHTML('#print_pac_sexo', sexo);
      DOMHelpers.setInnerHTML('#print_pac_peso', peso);
      DOMHelpers.setInnerHTML('#print_pac_alergias', alergiasTxt);
      DOMHelpers.setInnerHTML('#print_pac_renal', renal);
      DOMHelpers.setInnerHTML('#print_pac_hepatica', hepatica);
      DOMHelpers.setInnerHTML('#print_pac_area', areaText);
      DOMHelpers.setInnerHTML('#print_pac_medico', medico);
      DOMHelpers.setInnerHTML('#print_pac_fecha', fecha);

      // Tarjeta 2: HOJA DE TRATAMIENTO · ENFERMERÍA
      DOMHelpers.setInnerHTML('#print_enf_hisclin', hisclin);
      DOMHelpers.setInnerHTML('#print_enf_edad', edad);
      DOMHelpers.setInnerHTML('#print_enf_sexo', sexo);
      DOMHelpers.setInnerHTML('#print_enf_peso', peso);
      DOMHelpers.setInnerHTML('#print_enf_alergias', alergiasTxt);
      DOMHelpers.setInnerHTML('#print_enf_renal', renal);
      DOMHelpers.setInnerHTML('#print_enf_hepatica', hepatica);
      DOMHelpers.setInnerHTML('#print_enf_area', areaText);
      DOMHelpers.setInnerHTML('#print_enf_fecha', fecha); // Datos del paciente
      DOMHelpers.setInnerHTML('#print_enf_fecha_firma', fecha); // Firma de enfermería
      
      
      // +++ AÑADIR ESTA SECCIÓN PARA LA TABLA DE MEDICACIÓN +++
      buildMedicoPrintTable();

      // +++ INICIO DE LA MODIFICACIÓN (Enfermería) +++
      // Llamar a la nueva función para la tabla de enfermería
      buildEnfermeriaPrintTable();
      // +++ FIN DE LA MODIFICACIÓN (Enfermería) +++

      // +++ (El bloque de LET ya está aquí, lo dejamos) +++
      const letContainer = $('#print_let_container');
      const letTexto = $('#print_let_texto');
      
      if (letContainer && letTexto) {
          // Usamos la función de let.js (que importamos)
          const letInfo = LETModule.getParaImpresion(); //
          
          if (letInfo.tieneLET) {
              letTexto.innerHTML = esc(letInfo.texto); //
              letContainer.style.display = 'block'; // Mostrar el contenedor
          } else {
              letTexto.innerHTML = '';
              letContainer.style.display = 'none'; // Ocultar si no hay LET
          }
      }
  }
  
  // +++ AÑADIR ESTA NUEVA FUNCIÓN COMPLETA +++
  /**
   * Construye la tabla unificada de medicación para la HOJA DE TRATAMIENTO MÉDICO
   */
  function buildMedicoPrintTable() {
      const tbody = $('#print_medico_tbody');
      if (!tbody) return;

      tbody.innerHTML = ''; // Limpiar tabla
      let combinedMeds = [];

      // 1. Medicación Actual (prescripciones)
      (GlobalState.prescripciones || []).forEach(p => {
          combinedMeds.push({
              tipo: 'Actual',
              farmaco: p.farmaco,
              dosis: p.dosis,
              via: p.via,
              pauta: `${p.pauta} (Inicio: ${p.inicio}, ${p.dias}d)`,
              obs: [p.indicacion, p.obs].filter(Boolean).join(' / ')
          });
      });

      // 2. Medicación Opcional (opcionales)
      (GlobalState.opcionales || []).forEach(o => {
          combinedMeds.push({
              tipo: 'Opcional',
              farmaco: o.farmaco,
              dosis: o.dosis,
              via: o.via,
              pauta: `${o.condicion} (Máx: ${o.freqmax})`,
              obs: o.obs
          });
      });

      // 3. Medicación Puntual (puntuales)
      (GlobalState.puntuales || []).forEach(p => {
          combinedMeds.push({
              tipo: 'Puntual',
              farmaco: p.farmaco,
              dosis: p.dosis,
              via: p.via,
              pauta: `Cuándo: ${p.cuando}`,
              obs: [p.indicacion, p.obs].filter(Boolean).join(' / ')
          });
      });
      
      // 4. Medicación Domiciliaria (domicilio)
      (GlobalState.domicilio || []).forEach(d => {
          combinedMeds.push({
              tipo: 'Domicilio',
              farmaco: d.farmaco,
              dosis: d.dosis,
              via: d.via,
              pauta: `${d.freq} (${d.inicio}, ${d.dias}d)`,
              obs: [d.indicacion, d.obs].filter(Boolean).join(' / ')
          });
      });

      // Renderizar filas
      if (combinedMeds.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Sin tratamiento farmacológico</td></tr>';
      } else {
          combinedMeds.forEach(med => {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                  <td><strong>${esc(med.tipo)}</strong></td>
                  <td>${esc(med.farmaco)}</td>
                  <td>${esc(med.dosis)}</td>
                  <td>${esc(med.via)}</td>
                  <td>${esc(med.pauta)}</td>
                  <td>${esc(med.obs)}</td>
              `;
              tbody.appendChild(tr);
          });
      }
  }
  // +++ FIN NUEVA FUNCIÓN +++


  // +++ INICIO NUEVA FUNCIÓN (Enfermería) +++
  /**
   * Construye la tabla de medicación para la HOJA DE TRATAMIENTO DE ENFERMERÍA
   */
  function buildEnfermeriaPrintTable() {
      const tbody = $('#print_enfermeria_tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      let combinedMeds = [];
      const esc = (s) => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

      // 1. Medicación Actual (prescripciones)
      (GlobalState.prescripciones || []).forEach(p => {
          combinedMeds.push({
              tipo: 'Actual',
              farmaco: p.farmaco,
              dosisVia: `${p.dosis} / ${p.via}`,
              pautaDias: `${p.pauta} / ${p.dias}d`,
              inicio: p.inicio,
              obs: [p.indicacion, p.obs].filter(Boolean).join(' / ')
          });
      });

      // 2. Medicación Opcional (opcionales)
      (GlobalState.opcionales || []).forEach(o => {
          combinedMeds.push({
              tipo: 'Opcional',
              farmaco: o.farmaco,
              dosisVia: `${o.dosis} / ${o.via}`,
              pautaDias: `${o.condicion} (Máx: ${o.freqmax})`,
              inicio: 'PRN', // Si precisa
              obs: o.obs
          });
      });

      // 3. Medicación Puntual (puntuales)
      (GlobalState.puntuales || []).forEach(p => {
          combinedMeds.push({
              tipo: 'Puntual',
              farmaco: p.farmaco,
              dosisVia: `${p.dosis} / ${p.via}`,
              pautaDias: `Indicación: ${p.indicacion || 's/i'}`,
              inicio: p.cuando, // 'ahora', 'preprueba', etc.
              obs: p.obs
          });
      });
      
      // 4. Medicación Domiciliaria (domicilio)
      (GlobalState.domicilio || []).forEach(d => {
          combinedMeds.push({
              tipo: 'Domicilio',
              farmaco: d.farmaco,
              dosisVia: `${d.dosis} / ${d.via}`,
              pautaDias: `${d.freq} / ${d.dias}d`,
              inicio: d.inicio,
              obs: [d.indicacion, d.obs].filter(Boolean).join(' / ')
          });
      });

      // Renderizar filas
      if (combinedMeds.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Sin tratamiento farmacológico</td></tr>';
      } else {
          combinedMeds.forEach(med => {
              const tr = document.createElement('tr');
              // La casilla de verificación de enfermería
              const registroCell = `
                  <div style="display: flex; align-items: center; gap: 8px;">
                      <input type="checkbox" style="width: 20px; height: 20px; display: inline-block;">
                      <span>${esc(med.inicio)}</span>
                  </div>
              `;
              
              tr.innerHTML = `
                  <td><strong>${esc(med.tipo)}</strong></td>
                  <td>${esc(med.farmaco)}</td>
                  <td>${esc(med.dosisVia)}</td>
                  <td>${esc(med.pautaDias)}</td>
                  <td>${registroCell}</td>
              `;
              tbody.appendChild(tr);
          });
      }
  }
  // +++ FIN NUEVA FUNCIÓN (Enfermería) +++


  async function init() {
    // 1) Cargar listas y pintar selects usando los arrays devueltos
    await cargarYpintarListas();

    // 2) Sincronizar formulario desde estado (si hay datos previos)
    cargarDesdeEstado(); // Esta función ahora llamará a syncPrintCard()

    // 3) Eventos
    bindEvents(); // Esta función ahora llamará a syncPrintCard()
  }

  async function cargarYpintarListas() {
    try {
      const [profesionales, especialidades] = await Promise.all([
        DataLoader.cargarProfesionales?.() || [],
        DataLoader.cargarEspecialidades?.() || []
      ]);

      moduleState.listas.especialidades = Array.isArray(especialidades) ? especialidades : [];
      moduleState.listas.profesionales  = Array.isArray(profesionales)  ? profesionales  : [];

      pintarEspecialidades(moduleState.listas.especialidades);
      pintarProfesionales(moduleState.listas.profesionales);

      // Si el estado ya tenía valores, recupéralos después de pintar
      const p = GlobalState.paciente || {};
      if (p.area)   DOMHelpers.setValue('#pac_area', p.area);
      if (p.medico) DOMHelpers.setValue('#pac_medico', p.medico);

    } catch (err) {
      console.error('Paciente: error cargando listas', err);
      safeToast('No se pudieron cargar profesionales/especialidades', 'error');
    }
  }

  function bindEvents() {
    const card = $('#paciente-card') || document;

    // Añadir alergia
    $('#btnAddAlergia')?.addEventListener('click', addAlergia);

    // Eliminar alergia (delegación en el contenedor de chips)
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-alergia-chip="remove"]');
      if (!btn) return;
      const value = btn.dataset.value;
      removeAlergia(value);
    });

    // Cambios de selects
    $('#pac_sexo')?.addEventListener('change', syncFormularioEnEstado);
    $('#pac_area')?.addEventListener('change', syncFormularioEnEstado);
    $('#pac_medico')?.addEventListener('change', syncFormularioEnEstado);
    $('#pac_fecha')?.addEventListener('change', syncFormularioEnEstado);

    // Inputs básicos
    $('#pac_hisclin')?.addEventListener('input', syncFormularioEnEstado);  
    $('#pac_edad')?.addEventListener('input', syncFormularioEnEstado);
    $('#pac_peso')?.addEventListener('input', syncFormularioEnEstado);
  }

  // ====== Alergias (chips como en Dietas) ======
  function addAlergia() {
    const input = $('#pac_alergia_input');
    if (!input) return;

    const raw = (input.value || '').trim();
    if (!raw) {
      safeToast('Escribe una alergia o intolerancia', 'warning', 1500);
      return;
    }

    const key = norm(raw);
    const exists = moduleState.alergias.some(a => norm(a) === key);
    if (exists) {
      safeToast('Esa alergia ya está añadida', 'info', 1500);
      input.value = '';
      return;
    }

    moduleState.alergias.push(raw);
    input.value = '';
    pintarAlergiasChips();
    volcarAlergiasEnEstado();
  }

  function removeAlergia(value) {
    moduleState.alergias = moduleState.alergias.filter(a => norm(a) !== value);
    pintarAlergiasChips();
    volcarAlergiasEnEstado();
  }

  function pintarAlergiasChips() {
    const wrap = $('#alergias-list');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (moduleState.alergias.length === 0) return;

    moduleState.alergias.forEach(txt => {
      const key = norm(txt);
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.marginRight = '6px';
      chip.innerHTML = `
        ${txt}
        <button class="chip-remove"
                data-alergia-chip="remove"
                data-value="${key}"
                title="Quitar">×</button>
      `;
      wrap.appendChild(chip);
    });
  }

  function volcarAlergiasEnEstado() {
    const newState = { ...GlobalState };
    newState.paciente = newState.paciente || {};
    newState.paciente.alergias = [...moduleState.alergias];
    StateManager.updateState(newState);

    // +++ 3. LLAMADA DE SINCRONIZACIÓN +++
    syncPrintCard();
  }

  // ====== Relleno de selects ======
  function pintarEspecialidades(lista) {
    const sel = $('#pac_area');
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccionar...</option>';
    (lista || []).forEach(txt => {
      const op = document.createElement('option');
      op.value = norm(txt);
      op.textContent = txt;
      sel.appendChild(op);
    });
  }

  function pintarProfesionales(lista) {
    const sel = $('#pac_medico');
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccionar médico...</option>';
    (lista || []).forEach(txt => {
      const op = document.createElement('option');
      // Para el médico guardamos el nombre tal cual
      op.value = txt;
      op.textContent = txt;
      sel.appendChild(op);
    });
  }

  // ====== Sincronización con estado global ======
  function syncFormularioEnEstado() {
    const newState = { ...GlobalState };
    newState.paciente = newState.paciente || {};
    newState.paciente.hisclin   = parseInt($('#pac_hisclin')?.value || '', 10) || null;
    newState.paciente.edad   = parseInt($('#pac_edad')?.value || '', 10) || null;
    newState.paciente.sexo   = $('#pac_sexo')?.value || '';
    newState.paciente.peso   = parseFloat($('#pac_peso')?.value || '') || null;
    newState.paciente.area   = $('#pac_area')?.value || '';   // valor normalizado
    newState.paciente.medico = $('#pac_medico')?.value || ''; // nombre literal
    newState.paciente.fecha  = $('#pac_fecha')?.value || '';

    StateManager.updateState(newState);

    // +++ 3. LLAMADA DE SINCRONIZACIÓN +++
    syncPrintCard();
  }

  function cargarDesdeEstado() {
    const p = GlobalState.paciente || {};
    DOMHelpers.setValue('#pac_hisclin', p.hisclin || '');
    DOMHelpers.setValue('#pac_edad', p.edad || '');
    DOMHelpers.setValue('#pac_sexo', p.sexo || '');
    DOMHelpers.setValue('#pac_peso', p.peso || '');
    DOMHelpers.setValue('#pac_area', p.area || '');
    DOMHelpers.setValue('#pac_medico', p.medico || '');
    DOMHelpers.setValue('#pac_fecha', p.fecha || '');

    // Refrescar botones de insuficiencia
    const btnRenalSi = $('.si-no-btn[data-tipo="renal"][data-valor="si"]');
    const btnRenalNo = $('.si-no-btn[data-tipo="renal"][data-valor="no"]');
    if (btnRenalSi && btnRenalNo) {
        btnRenalSi.classList.toggle('selected', p.insuf_renal === 'si');
        btnRenalNo.classList.toggle('selected', p.insuf_renal !== 'si');
    }
    
    const btnHepaSi = $('.si-no-btn[data-tipo="hepatica"][data-valor="si"]');
    const btnHepaNo = $('.si-no-btn[data-tipo="hepatica"][data-valor="no"]');
    if (btnHepaSi && btnHepaNo) {
        btnHepaSi.classList.toggle('selected', p.insuf_hepatica === 'si');
        btnHepaNo.classList.toggle('selected', p.insuf_hepatica !== 'si');
    }


    const alergias = Array.isArray(p.alergias) ? p.alergias : [];
    moduleState.alergias = [...alergias];
    pintarAlergiasChips();

    // +++ 3. LLAMADA DE SINCRONIZACIÓN +++
    syncPrintCard();
  }

  // ====== Insuficiencias (llamadas desde events.js) ======
function setInsuficiencia(payload) {
  if (!payload) return false;
  const { tipo, valor } = payload;                  // tipo: 'renal' | 'hepatica' ; valor: 'si' | 'no'
  if (!['renal','hepatica'].includes(tipo)) return false;
  if (!['si','no'].includes(valor)) return false;

  // Escribimos en las claves reales del estado global
  const newState = { ...GlobalState };
  newState.paciente = newState.paciente || {};

  if (tipo === 'renal') {
    newState.paciente.insuf_renal = valor;          // 'si' | 'no'
  } else {
    newState.paciente.insuf_hepatica = valor;       // 'si' | 'no'
  }

  StateManager.updateState(newState);

  // +++ 3. LLAMADA DE SINCRONIZACIÓN +++
  syncPrintCard();
  
  return true;
}


  // ====== API Pública ======
  return {
    init,
    // Alergias
    addAlergia,
    removeAlergia: (payload) => { if (payload?.value) removeAlergia(payload.value); },
    getAlergias: () => [...moduleState.alergias],

    // Insuficiencias
    setInsuficiencia,

    // --- CORRECCIÓN: Exponer la función para refrescar la UI ---
    cargarDesdeEstado: cargarDesdeEstado
  };
})();

export default PacienteModule;