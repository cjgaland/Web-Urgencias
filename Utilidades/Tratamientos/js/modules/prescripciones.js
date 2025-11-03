// js/modules/prescripciones.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, showToast, DOMHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const PrescripcionesModule = (() => {
  const moduleState = { 
    editingIndex: -1,
    medicamentosDB: [] // Base de datos de medicamentos cargada
  };

  // Almacenamos aquí las opciones cargadas para poder mostrar el texto en la tabla
  let VIA_OPCIONES = [];              // ['Oral', 'Venosa periférica', ...]
  let FREQ_OPCIONES = [];             // [{value:'q6', text:'Cada 6 horas'}, ...]

  // --- Utilidades de carga -----------------------------------------------

  async function leerLineas(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error ${res.status} cargando ${path}`);
    const text = await res.text();
    return text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function cargarVias() {
    // 1) Intentar DataLoader si existe
    if (typeof DataLoader?.cargarViasAdministracion === 'function') {
      try {
        const vias = await DataLoader.cargarViasAdministracion();
        if (Array.isArray(vias) && vias.length) return vias;
      } catch (e) { /* seguimos al fetch */ }
    }
    // 2) Fallback directo al fichero
    return await leerLineas('data/vias_administracion.txt');
  }

  async function cargarMedicamentos() {
    if (typeof DataLoader?.cargarMedicamentos === 'function') {
      try {
        // Ahora devuelve un array de objetos: [{ value, nombre, dosis, via, indicacion }, ...]
        const meds = await DataLoader.cargarMedicamentos(); 
        if (Array.isArray(meds) && meds.length) {
          moduleState.medicamentosDB = meds; // Almacenamos los objetos
          return;
        }
      } catch (e) { /* fallback */ }
    }
    moduleState.medicamentosDB = [];
  }

  function mapearPautaTextoAValor(txt) {
    const t = (txt || '').toLowerCase();
    if (t.includes('ahora')) return 'ahora';
    if (t.includes('prn') || t.includes('precisa')) return 'prn';

    // buscar "cada X hora(s)"
    const m = t.match(/cada\s+(\d+)\s*hora/);
    if (m) {
      const h = parseInt(m[1], 10);
      if ([1,2,4,6,8,12,24].includes(h)) return `q${h}`;
    }
    return t || ''; // fallback literal
  }

  async function cargarPautas() {
    // 1) Si tienes un DataLoader.cargarPauta, lo probamos
    if (typeof DataLoader?.cargarPauta === 'function') {
      try {
        const freqs = await DataLoader.cargarPauta();
        if (Array.isArray(freqs) && freqs.length) {
          return freqs.map(text => ({ value: mapearPautaTextoAValor(text), text }));
        }
      } catch (e) { /* seguimos al fetch */ }
    }
    // 2) Fallback directo al fichero pauta.txt
    const lineas = await leerLineas('data/pauta.txt');
    return lineas.map(text => ({ value: mapearPautaTextoAValor(text), text }));
  }

  // --- Poblar selects -----------------------------------------------------

  function poblarDatalistMedicamentos(selector, meds) { // meds es el array de objetos
    const datalist = $(selector);
    if (!datalist) return;
    datalist.innerHTML = '';
    meds.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.value; // Ej: "Paracetamol (1 g, IV)"
      datalist.appendChild(opt);
    });
  }

  function poblarSelectVias(selector, vias) {
    const sel = $(selector);
    if (!sel) return;
    sel.innerHTML = ''; // sustituimos por lo cargado

    // Placeholder
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = 'Seleccionar...';
    sel.appendChild(ph);

    vias.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;      // Guardamos el texto literal como value
      opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function poblarSelectPautas(selector, opciones, setDefault = true) {
  const sel = $(selector);
  if (!sel) return;
  sel.innerHTML = '';

  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = 'Seleccionar...';
  sel.appendChild(ph);

  opciones.forEach(({ value, text }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    sel.appendChild(opt);
  });

  // Solo establecer 'q24' por defecto si se solicita explícitamente
  if (setDefault && sel.querySelector('option[value="q24"]')) {
    sel.value = 'q24';
  }
}

  function textoPautaDesdeValor(val) {
    const found = FREQ_OPCIONES.find(o => o.value === val);
    return found ? found.text : (val || '');
  }

  // --- Init y eventos -----------------------------------------------------

  async function init() {
    // Asegurar estructura del estado global
    if (!Array.isArray(GlobalState.prescripciones)) {
      const newState = { ...GlobalState, prescripciones: [] };
      StateManager.updateState(newState);
    }

    // Cargar data de selects
    try {
      VIA_OPCIONES = await cargarVias();
    } catch (e) {
      // fallback mínimo
      VIA_OPCIONES = ['Oral', 'Venosa periférica', 'Venosa central', 'Intramuscular', 'Subcutánea', 'Inhalada'];
    }
    try {
      FREQ_OPCIONES = await cargarPautas();
    } catch (e) {
      FREQ_OPCIONES = [
        { value: 'q1',  text: 'Cada hora' },
        { value: 'q2',  text: 'Cada 2 horas' },
        { value: 'q4',  text: 'Cada 4 horas' },
        { value: 'q6',  text: 'Cada 6 horas' },
        { value: 'q8',  text: 'Cada 8 horas' },
        { value: 'q12', text: 'Cada 12 horas' },
        { value: 'q24', text: 'Cada 24 horas' },
        { value: 'prn', text: 'Si precisa' },
        { value: 'ahora', text: 'Ahora' }
      ];
    }
    
    try {
      await cargarMedicamentos(); // Carga y almacena en moduleState
    } catch (e) {
      console.warn('No se pudo cargar la lista de medicamentos', e);
    }

    // Poblar selects con lo cargado
    poblarSelectVias('#p_via', VIA_OPCIONES);
    // +++ AÑADIMOS TAMBIÉN LAS VÍAS AL RESTO DE TARJETAS +++
    poblarSelectVias('#opc_via', VIA_OPCIONES);
    poblarSelectVias('#pun_via', VIA_OPCIONES);
    poblarSelectVias('#dom_via', VIA_OPCIONES);
    
    poblarSelectPautas('#p_freq', FREQ_OPCIONES, true); // true = establecer q24 por defecto
    
    // Poblar el datalist global con los medicamentos
    poblarDatalistMedicamentos('#medicamentos-list', moduleState.medicamentosDB);

    // Añadir listeners para autocompletado
    attachAutocompleteListeners();

    // Render inicial
    renderTable();
  }

  function attachAutocompleteListeners() {
    const ids = ['#p_farmaco', '#opc_farmaco', '#pun_farmaco', '#dom_farmaco'];
    ids.forEach(id => {
      const input = $(id);
      if (input) {
        // Usamos 'input' para que se dispare al seleccionar del datalist
        input.addEventListener('input', onFarmacoInput);
      }
    });
  }

  // +++ AÑADIR ESTE MAPA DE TRADUCCIÓN +++
  // Mapea el código corto de medicamentos.txt  al texto completo de vias_administracion.txt
  const VIA_MAP = {
      'IV': 'Venosa periférica',
      'VO': 'Oral',
      'IM': 'Intramuscular',
      'SC': 'Subcutanea',
      'V.C.': 'Venosa Central',
      'INHALADO': 'Inhalada', // De medicamentos.txt
      'INHAL': 'Inhalada', // Abreviatura común
      'SUBLINGUAL': 'Sublingual',
      'SL': 'Sublingual',
      'TRANSDÉRMICO': 'Transdérmico',
      'TÓPICO': 'Tópico',
      'BUCAL': 'Bucal',
      'NASAL': 'Nasal',
      'RECTAL': 'Rectal',
      'VAGINAL': 'Vaginal'
      // Añade más si son necesarios
  };

  /**
   * Busca el valor correcto para el <select> de Vía.
   * Intenta encontrar el texto completo (p.ej. "Venosa periférica") que coincide con el código (p.ej. "IV").
   */
  function findViaValue(selectElement, viaCodigo) {
      if (!selectElement || !viaCodigo) return "";

      const codigoUpper = viaCodigo.toUpperCase();
      
      // 1. Traducir el código a texto largo (Ej: "IV" -> "Venosa periférica")
      const viaLarga = VIA_MAP[codigoUpper] || viaCodigo; // Fallback al propio texto si no hay mapa

      // 2. Buscar si una <option> tiene ESE valor
      for (const opt of selectElement.options) {
          // Comparamos el valor de la opción (texto completo) con nuestra traducción
          if (opt.value.toUpperCase() === viaLarga.toUpperCase()) {
              return opt.value;
          }
      }

      // 3. Fallback: Si no encontramos la traducción exacta (ej: "Transdérmico" no está en vias_administracion.txt)
      // devolvemos el código original, y el select quedará en "Seleccionar..." (comportamiento esperado)
      console.warn(`No se encontró coincidencia de vía para "${viaCodigo}" (traducido como "${viaLarga}")`);
      return ""; // Devolver vacío para forzar "Seleccionar..."
  }


  // +++ FUNCIÓN ONFARMACOINPUT (MODIFICADA) +++
  function onFarmacoInput(e) {
    const input = e.target;
    const currentValue = input.value;
    const prefix = input.id.split('_')[0]; // 'p', 'opc', 'pun', 'dom'
    
    // Buscar si el valor actual coincide exactamente con una opción
    const match = moduleState.medicamentosDB.find(m => m.value === currentValue);
    
    if (match) {
      // Encontramos un match, autocompletamos
      
      // 1. Rellenar el nombre real del fármaco (sin la info extra)
      DOMHelpers.setValue(`#${prefix}_farmaco`, match.nombre);
      
      // 2. Rellenar Dosis
      DOMHelpers.setValue(`#${prefix}_dosis`, match.dosis);
      
      // 3. Rellenar Vía (¡AQUÍ ESTÁ LA CORRECCIÓN!)
      const viaSelectElement = $(`#${prefix}_via`);
      if (viaSelectElement) {
          // Usamos el helper para encontrar el valor correcto
          const viaValue = findViaValue(viaSelectElement, match.via);
          DOMHelpers.setValue(`#${prefix}_via`, viaValue); 
      }
      
      // 4. Rellenar Indicación (si el campo existe en esa tarjeta)
      const indicacionInput = $(`#${prefix}_indicacion`);
      if (indicacionInput) {
        DOMHelpers.setValue(`#${prefix}_indicacion`, match.indicacion);
      }
    }
  }
  // +++ FIN DE LAS FUNCIONES NUEVAS/MODIFICADAS +++


  // Los botones se gestionan desde events.js; aquí implementamos la lógica pública

  function addPrescripcion() {
    const farmaco    = $('#p_farmaco')?.value?.trim() || '';
    const dosis      = $('#p_dosis')?.value?.trim() || '';
    const via        = $('#p_via')?.value || '';
    const pauta      = $('#p_freq')?.value || ''; // código (q6, prn, ahora...)
    const inicio     = $('#p_inicio')?.value || '';
    const dias       = $('#p_dias')?.value || '';
    const indicacion = $('#p_indicacion')?.value?.trim() || '';
    const obs        = $('#p_obs')?.value?.trim() || '';

    if (!farmaco)  return showToast('Indica el fármaco', 'warning');
    if (!dosis)    return showToast('Indica la dosis', 'warning');
    if (!via)      return showToast('Selecciona la vía', 'warning');
    if (!pauta)    return showToast('Selecciona la pauta', 'warning');
    if (!inicio)   return showToast('Indica la hora de inicio', 'warning');
    if (!dias || Number(dias) <= 0) return showToast('Indica los días (>0)', 'warning');

    StateActions.addToArray('prescripciones', { farmaco, dosis, via, pauta, inicio, dias, indicacion, obs });
    limpiarFormulario();
    renderTable();
    showToast('Prescripción añadida', 'success');
  }

  function editarPrescripcion(index) {
    const p = GlobalState.prescripciones[index];
    if (!p) return;

    DOMHelpers.setValue('#p_farmaco', p.farmaco);
    DOMHelpers.setValue('#p_dosis', p.dosis);
    DOMHelpers.setValue('#p_via', p.via);
    DOMHelpers.setValue('#p_freq', p.pauta);
    DOMHelpers.setValue('#p_inicio', p.inicio);
    DOMHelpers.setValue('#p_dias', p.dias);
    DOMHelpers.setValue('#p_indicacion', p.indicacion);
    DOMHelpers.setValue('#p_obs', p.obs || '');

    DOMHelpers.hideElement('#btnAdd');
    DOMHelpers.showElement('#btnUpdate');
    DOMHelpers.showElement('#btnCancelEdit');

    moduleState.editingIndex = index;
  }

  function updatePrescripcion() {
    if (moduleState.editingIndex === -1) return;

    const farmaco    = $('#p_farmaco')?.value?.trim() || '';
    const dosis      = $('#p_dosis')?.value?.trim() || '';
    const via        = $('#p_via')?.value || '';
    const pauta      = $('#p_freq')?.value || '';
    const inicio     = $('#p_inicio')?.value || '';
    const dias       = $('#p_dias')?.value || '';
    const indicacion = $('#p_indicacion')?.value?.trim() || '';
    const obs        = $('#p_obs')?.value?.trim() || '';

    if (!farmaco)  return showToast('Indica el fármaco', 'warning');
    if (!dosis)    return showToast('Indica la dosis', 'warning');
    if (!via)      return showToast('Selecciona la vía', 'warning');
    if (!pauta)    return showToast('Selecciona la pauta', 'warning');
    if (!inicio)   return showToast('Indica la hora de inicio', 'warning');
    if (!dias || Number(dias) <= 0) return showToast('Indica los días (>0)', 'warning');

    const item = { farmaco, dosis, via, pauta, inicio, dias, indicacion, obs };
    StateActions.updateInArray('prescripciones', moduleState.editingIndex, item);

    cancelarEdicion();
    renderTable();
    showToast('Prescripción actualizada', 'success');
  }

  function eliminarPrescripcion(index) {
    StateActions.removeFromArray('prescripciones', index);
    renderTable();
    showToast('Prescripción eliminada', 'info');
  }

  function vaciarTabla() {
  StateActions.clearArray('prescripciones');
  limpiarFormulario(); // ← AÑADE ESTA LÍNEA
  renderTable();
  showToast('Tabla vaciada', 'info');
}

  function renderTable() {
    const tbody = $('#tabla tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!Array.isArray(GlobalState.prescripciones) || GlobalState.prescripciones.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="10" style="text-align:center;color:#64748b">No hay prescripciones</td>`;
      tbody.appendChild(tr);
      return;
    }

    GlobalState.prescripciones.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${p.farmaco}</td>
        <td>${p.dosis}</td>
        <td>${p.via}</td>
        <td>${textoPautaDesdeValor(p.pauta)}</td>
        <td>${p.inicio}</td>
        <td>${p.dias} día(s)</td>
        <td>${p.indicacion || '-'}</td>
        <td>${p.obs || '-'}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="btn btn-sm edit" data-action="edit-prescripcion" data-index="${idx}" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm danger" data-action="delete-prescripcion" data-index="${idx}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      // Delegación de clicks por fila (una sola vez)
      tr.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const index = parseInt(btn.dataset.index, 10);
        if (Number.isNaN(index)) return;
        if (action === 'edit-prescripcion') return editarPrescripcion(index);
        if (action === 'delete-prescripcion') return eliminarPrescripcion(index);
      });
    });
  }

  function limpiarFormulario() {
  DOMHelpers.setValue('#p_farmaco', '');
  DOMHelpers.setValue('#p_dosis', '');
  DOMHelpers.setValue('#p_via', '');

  // CORREGIDO: Siempre limpiar pauta a vacío
  DOMHelpers.setValue('#p_freq', '');

  // NUEVOS VALORES POR DEFECTO
  DOMHelpers.setValue('#p_inicio', '08:00');
  DOMHelpers.setValue('#p_dias', '1');
  
  DOMHelpers.setValue('#p_indicacion', '');
  DOMHelpers.setValue('#p_obs', '');

  DOMHelpers.showElement('#btnAdd');
  DOMHelpers.hideElement('#btnUpdate');
  DOMHelpers.hideElement('#btnCancelEdit');

  moduleState.editingIndex = -1;
}

  function cancelarEdicion() {
  limpiarFormulario();
}

  return {
    init,
    addPrescripcion,
    updatePrescripcion,
    cancelarEdicion,
    vaciar: vaciarTabla,

    // alias por si acaso
    add: addPrescripcion,
    guardar: updatePrescripcion,
    clear: vaciarTabla
  };
})();

export default PrescripcionesModule;