// ========== ESTADO GLOBAL ==========
const state = {
  paciente: {
    alergias: [],
    insuf_renal: 'no',
    insuf_hepatica: 'no'
  },
  prescripciones: [],
  opcionales: [],
  puntuales: [],
  dietas: [],
  fluidos: [],
  cuidados: {},
  oxigenacion: {},
  pruebas: {},
  let: null,
  editingIndex: -1,
  editingType: null
};

// ========== FUNCIONES BÁSICAS ==========
const _$ = s => document.querySelector(s);
const _$$ = s => Array.from(document.querySelectorAll(s));

function nowLocalISO(){
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,16);
}

function esc(s){ return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// ========== NOTIFICACIONES TOAST ==========
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info-circle';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'exclamation-circle';
  if (type === 'warning') icon = 'exclamation-triangle';
  
  toast.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}

// ========== DATOS LET ==========
const LET_DATA = {
  1: { titulo: "LET 1 - Soporte total", actitud: "Soporte total", aclaracion: "El paciente recibe todas las medidas necesarias, sin excepción." },
  2: { titulo: "LET 2 - Soporte total salvo RCP", actitud: "SOPORTE TOTAL SALVO RCP (\"ORDENES DE NO RCP\")", aclaracion: "Pacientes donde la situación basal anterior a la enfermedad es mala, con pobre calidad de vida." },
  3: { titulo: "LET 3 - No aplicar medidas extraordinarias", actitud: "NO APLICAR MEDIDAS EXTRAORDINARIAS", aclaracion: "En general, en esta categoría se incluyen pacientes con fracaso de diversos órganos." },
  4: { titulo: "LET 4 - No aumentar medidas extraordinarias", actitud: "NO AUMENTAR Y/O NO APLICAR MAS MEDIDAS EXTRAORDINARIAS", aclaracion: "En esta categoría se incluyen los pacientes del grupo anterior." },
  5: { titulo: "LET 5 - Retirada de todas las medidas", actitud: "RETIRADA DE TODAS LAS MEDIDAS", aclaracion: "Cuando se cumplen los criterios de muerte encefálica." }
};

// ========== INICIALIZACIÓN ==========
async function init(){
  console.log('Inicializando aplicación...');
  $('#pac_fecha').value = nowLocalISO();
  await cargarProfesionales();
  
  // INICIALIZAR SISTEMA DE ALERGIAS
  $('#btnAddAlergia').addEventListener('click', function() {
    const alergiaInput = $('#pac_alergia_input');
    const alergia = alergiaInput.value.trim();
    
    if (alergia) {
      if (!state.paciente.alergias) state.paciente.alergias = [];
      state.paciente.alergias.push(alergia);
      renderAlergiasList();
      alergiaInput.value = '';
      showToast('Alergia añadida', 'success');
    }
  });

  // Permitir añadir alergia con Enter
  $('#pac_alergia_input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      $('#btnAddAlergia').click();
      e.preventDefault();
    }
  });

  // INICIALIZAR BOTONES SÍ/NO
  $$('.si-no-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tipo = this.dataset.tipo;
      const valor = this.dataset.valor;
      
      // Remover selección de todos los botones del mismo tipo
      $$(`.si-no-btn[data-tipo="${tipo}"]`).forEach(b => b.classList.remove('selected'));
      
      // Seleccionar el botón clickeado
      this.classList.add('selected');
      
      // Actualizar estado
      if (tipo === 'renal') {
        state.paciente.insuf_renal = valor;
      } else if (tipo === 'hepatica') {
        state.paciente.insuf_hepatica = valor;
      }
    });
  });

  initEventListeners();
  bind();
  renderAllTables();
  renderSheets();
  renderAlergiasList();
  
  showToast('Aplicación cargada correctamente', 'success');
}

async function cargarProfesionales(){
  try {
    console.log('Cargando profesionales...');
    const response = await fetch('data/profesionales.txt');
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    const profesionales = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//'))
      .map(line => {
        const [apellido, nombre] = line.split(',').map(part => part.trim());
        if (nombre && apellido) {
          const titulo = nombre.endsWith('a') ? 'Dra.' : 'Dr.';
          return `${titulo} ${nombre} ${apellido}`;
        }
        return line;
      });
    
    const select = $('#pac_medico');
    select.innerHTML = '<option value="">Seleccionar médico...</option>';
    
    profesionales.forEach(prof => {
      const option = document.createElement('option');
      option.value = prof;
      option.textContent = prof;
      select.appendChild(option);
    });
    
    console.log('Profesionales cargados:', profesionales);
    showToast(`${profesionales.length} profesionales cargados`, 'success');
    
  } catch (error) {
    console.error('Error cargando profesionales:', error);
    showToast('Error cargando profesionales. Usando lista por defecto.', 'error');
    
    const defaultProfs = [
      'Dr. Carlos Galán',
      'Dra. Marta Lomas', 
      'Dr. Manuel Aguilera',
      'Dra. Elena Ruiz',
      'Dr. Javier Moreno'
    ];
    
    const select = $('#pac_medico');
    select.innerHTML = '<option value="">Seleccionar médico...</option>';
    defaultProfs.forEach(prof => {
      const option = document.createElement('option');
      option.value = prof;
      option.textContent = prof;
      select.appendChild(option);
    });
  }
}

// ========== SISTEMA LET ==========
function initEventListeners(){
  console.log('Inicializando event listeners...');
  
  // Botones LET
  $$('.let-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      console.log('Botón LET clickeado:', e.target.dataset.let);
      const letValue = e.target.dataset.let;
      $$('.let-btn').forEach(b => b.classList.remove('selected'));
      e.target.classList.add('selected');
      state.let = letValue;
      const display = $('#letDisplay');
      const letData = LET_DATA[letValue];
      if (letData) {
        $('#letActitud').textContent = letData.actitud;
        $('#letAclaracion').textContent = letData.aclaracion;
        display.style.display = 'block';
      }
      renderSheets();
    });
  });

  // Modal LET
  $('#btnInfoLET').addEventListener('click', mostrarModalLET);
  $('#letModalClose').addEventListener('click', cerrarModalLET);
  $('#letOverlay').addEventListener('click', cerrarModalLET);
}

function mostrarModalLET(){
  console.log('Mostrando modal LET');
  const modal = $('#letModal');
  const overlay = $('#letOverlay');
  const title = $('#letModalTitle');
  const content = $('#letModalContent');

  title.textContent = "Información completa - Limitación de Esfuerzo Terapéutico";
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const data = LET_DATA[i];
    html += `
      <div class="modal-section">
        <h4>${data.titulo}</h4>
        <p><strong>Actitud:</strong> ${data.actitud}</p>
        <p><strong>Aclaración:</strong> ${data.aclaracion}</p>
      </div>
    `;
  }
  content.innerHTML = html;
  modal.classList.add('active');
  overlay.classList.add('active');
}

function cerrarModalLET(){
  $('#letModal').classList.remove('active');
  $('#letOverlay').classList.remove('active');
}

// ========== SISTEMA DE EDICIÓN PARA MEDICACIÓN ACTUAL ==========
function editarPrescripcion(index) {
    const prescripcion = state.prescripciones[index];
    
    // Llenar el formulario con los datos existentes
    $('#p_farmaco').value = prescripcion.farmaco;
    $('#p_dosis').value = prescripcion.dosis;
    $('#p_via').value = prescripcion.via;
    $('#p_freq').value = prescripcion.freq;
    $('#p_inicio').value = prescripcion.inicio;
    $('#p_dias').value = prescripcion.dias;
    $('#p_indicacion').value = prescripcion.indicacion;
    $('#p_obs').value = prescripcion.obs;
    
    // Cambiar el botón a modo edición
    $('#btnAdd').style.display = 'none';
    $('#btnUpdate').style.display = 'inline-flex';
    $('#btnCancelEdit').style.display = 'inline-flex';
    
    // Guardar el índice que estamos editando
    state.editingIndex = index;
    state.editingType = 'prescripcion';
}

function actualizarPrescripcion() {
    if (state.editingIndex === -1 || state.editingType !== 'prescripcion') return;
    
    const farmaco = $('#p_farmaco').value.trim();
    if(!farmaco){ 
        showToast('Introduce el nombre del fármaco', 'warning');
        return; 
    }
    
    const item = {
        farmaco,
        dosis: $('#p_dosis').value.trim(),
        via: $('#p_via').value,
        freq: $('#p_freq').value,
        inicio: $('#p_inicio').value || '10:00',
        dias: parseInt($('#p_dias').value||'1',10),
        indicacion: $('#p_indicacion').value.trim(),
        obs: $('#p_obs').value.trim()
    };
    
    // Actualizar el elemento
    state.prescripciones[state.editingIndex] = item;
    
    // Limpiar formulario y restaurar botones
    cancelarEdicionPrescripcion();
    
    renderAllTables();
    renderSheets();
    showToast('Medicación actualizada correctamente', 'success');
}

function cancelarEdicionPrescripcion() {
    $('#p_farmaco').value=''; 
    $('#p_dosis').value=''; 
    $('#p_via').value='VO'; 
    $('#p_freq').value='q24'; 
    $('#p_inicio').value='10:00'; 
    $('#p_dias').value=1;
    $('#p_indicacion').value=''; 
    $('#p_obs').value='';
    
    $('#btnAdd').style.display = 'inline-flex';
    $('#btnUpdate').style.display = 'none';
    $('#btnCancelEdit').style.display = 'none';
    
    state.editingIndex = -1;
    state.editingType = null;
}

// ========== MEDICACIÓN ACTUAL ==========
function addPrescripcion(){
  console.log('Añadiendo prescripción...');
  const farmaco = $('#p_farmaco').value.trim();
  if(!farmaco){ 
    showToast('Introduce el nombre del fármaco', 'warning');
    return; 
  }
  
  const item = {
    farmaco,
    dosis: $('#p_dosis').value.trim(),
    via: $('#p_via').value,
    freq: $('#p_freq').value,
    inicio: $('#p_inicio').value || '10:00',
    dias: parseInt($('#p_dias').value||'1',10),
    indicacion: $('#p_indicacion').value.trim(),
    obs: $('#p_obs').value.trim()
  };
  
  state.prescripciones.push(item);
  console.log('Prescripción añadida:', item);
  
  // Limpiar formulario
  $('#p_farmaco').value=''; 
  $('#p_dosis').value=''; 
  $('#p_via').value='VO'; 
  $('#p_freq').value='q24'; 
  $('#p_inicio').value='10:00'; 
  $('#p_dias').value=1;
  $('#p_indicacion').value=''; 
  $('#p_obs').value='';
  
  renderAllTables(); 
  renderSheets();
  showToast('Medicación añadida correctamente', 'success');
}

// ========== SISTEMA DE EDICIÓN PARA MEDICACIÓN OPCIONAL ==========
function editarOpcional(index) {
    const opcional = state.opcionales[index];
    
    // Llenar el formulario con los datos existentes
    $('#opc_condicion').value = opcional.condicion;
    $('#opc_farmaco').value = opcional.farmaco;
    $('#opc_dosis').value = opcional.dosis;
    $('#opc_via').value = opcional.via;
    $('#opc_freqmax').value = opcional.freqmax;
    $('#opc_obs').value = opcional.obs;
    
    // Cambiar el botón a modo edición
    $('#btnAddOpcional').style.display = 'none';
    $('#btnUpdateOpcional').style.display = 'inline-flex';
    $('#btnCancelEditOpcional').style.display = 'inline-flex';
    
    // Guardar el índice que estamos editando
    state.editingIndex = index;
    state.editingType = 'opcional';
}

function actualizarOpcional() {
    if (state.editingIndex === -1 || state.editingType !== 'opcional') return;
    
    const condicion = $('#opc_condicion').value;
    const farmaco = $('#opc_farmaco').value.trim();
    if(!condicion || !farmaco){ 
        showToast('Completa condición y fármaco', 'warning');
        return; 
    }
    
    const item = {
        condicion,
        farmaco,
        dosis: $('#opc_dosis').value.trim(),
        via: $('#opc_via').value,
        freqmax: $('#opc_freqmax').value,
        obs: $('#opc_obs').value.trim()
    };
    
    // Actualizar el elemento
    state.opcionales[state.editingIndex] = item;
    
    // Limpiar formulario y restaurar botones
    cancelarEdicionOpcional();
    
    renderAllTables();
    showToast('Medicación opcional actualizada', 'success');
}

function cancelarEdicionOpcional() {
    $('#opc_condicion').value=''; 
    $('#opc_farmaco').value=''; 
    $('#opc_dosis').value='';
    $('#opc_via').value='VO'; 
    $('#opc_freqmax').value='q8'; 
    $('#opc_obs').value='';
    
    $('#btnAddOpcional').style.display = 'inline-flex';
    $('#btnUpdateOpcional').style.display = 'none';
    $('#btnCancelEditOpcional').style.display = 'none';
    
    state.editingIndex = -1;
    state.editingType = null;
}

// ========== MEDICACIÓN OPCIONAL ==========
function addOpcional(){
  console.log('Añadiendo medicación opcional...');
  const condicion = $('#opc_condicion').value;
  const farmaco = $('#opc_farmaco').value.trim();
  if(!condicion || !farmaco){ 
    showToast('Completa condición y fármaco', 'warning');
    return; 
  }
  
  const item = {
    condicion,
    farmaco,
    dosis: $('#opc_dosis').value.trim(),
    via: $('#opc_via').value,
    freqmax: $('#opc_freqmax').value,
    obs: $('#opc_obs').value.trim()
  };
  
  state.opcionales.push(item);
  console.log('Medicación opcional añadida:', item);
  
  // Limpiar formulario
  $('#opc_condicion').value=''; 
  $('#opc_farmaco').value=''; 
  $('#opc_dosis').value='';
  $('#opc_via').value='VO'; 
  $('#opc_freqmax').value='q8'; 
  $('#opc_obs').value='';
  
  renderAllTables();
  showToast('Medicación opcional añadida', 'success');
}

// ========== SISTEMA DE EDICIÓN PARA DIETAS ==========
function editarDieta(index) {
    const dieta = state.dietas[index];
    
    // Llenar el formulario con los datos existentes
    $('#dieta_tipo').value = dieta.tipo;
    $('#dieta_consistencia').value = dieta.consistencia;
    $('#dieta_obs').value = dieta.obs || '';
    
    // Cambiar el botón a modo edición
    $('#btnAddDieta').style.display = 'none';
    $('#btnUpdateDieta').style.display = 'inline-flex';
    $('#btnCancelEditDieta').style.display = 'inline-flex';
    
    // Guardar el índice que estamos editando
    state.editingIndex = index;
    state.editingType = 'dieta';
}

function actualizarDieta() {
    if (state.editingIndex === -1 || state.editingType !== 'dieta') return;
    
    const tipo = $('#dieta_tipo').value;
    const consistencia = $('#dieta_consistencia').value;
    const obs = $('#dieta_obs').value.trim();
    
    if (!tipo) {
        showToast('Selecciona el tipo de dieta', 'warning');
        return;
    }
    
    // Actualizar el elemento
    state.dietas[state.editingIndex] = { tipo, consistencia, obs };
    
    // Limpiar formulario y restaurar botones
    cancelarEdicionDieta();
    
    renderAllTables();
    showToast('Dieta actualizada correctamente', 'success');
}

function cancelarEdicionDieta() {
    $('#dieta_tipo').value = '';
    $('#dieta_consistencia').value = '';
    $('#dieta_obs').value = '';
    
    $('#btnAddDieta').style.display = 'inline-flex';
    $('#btnUpdateDieta').style.display = 'none';
    $('#btnCancelEditDieta').style.display = 'none';
    
    state.editingIndex = -1;
    state.editingType = null;
}

// ========== DIETAS ==========
function addDieta(){
  console.log('Añadiendo dieta...');
  const tipo = $('#dieta_tipo').value;
  const consistencia = $('#dieta_consistencia').value;
  const obs = $('#dieta_obs').value.trim();
  
  if(!tipo){ 
    showToast('Selecciona el tipo de dieta', 'warning');
    return; 
  }
  
  const item = { tipo, consistencia, obs };
  state.dietas.push(item);
  console.log('Dieta añadida:', item);
  
  // Limpiar formulario
  $('#dieta_tipo').value = '';
  $('#dieta_consistencia').value = '';
  $('#dieta_obs').value = '';
  
  renderAllTables();
  showToast('Dieta añadida correctamente', 'success');
}

// ========== SISTEMA DE EDICIÓN PARA FLUIDOTERAPIA ==========
function editarFluido(index) {
    const fluido = state.fluidos[index];
    
    // Llenar el formulario con los datos existentes
    $('#fluido_via').value = fluido.via;
    $('#fluido_solucion').value = fluido.solucion;
    $('#fluido_volumen').value = fluido.volumen;
    $('#fluido_frecuencia').value = fluido.frecuencia;
    $('#fluido_ritmo').value = fluido.ritmo;
    
    // Cambiar el botón a modo edición
    $('#btnAddFluido').style.display = 'none';
    $('#btnUpdateFluido').style.display = 'inline-flex';
    $('#btnCancelEditFluido').style.display = 'inline-flex';
    
    // Guardar el índice que estamos editando
    state.editingIndex = index;
    state.editingType = 'fluido';
}

function actualizarFluido() {
    if (state.editingIndex === -1 || state.editingType !== 'fluido') return;
    
    const via = $('#fluido_via').value;
    const solucion = $('#fluido_solucion').value;
    const volumen = $('#fluido_volumen').value;
    const frecuencia = $('#fluido_frecuencia').value;
    const ritmo = $('#fluido_ritmo').value;
    
    if (via === 'con' && !solucion) {
        showToast('Selecciona una solución', 'warning');
        return;
    }
    
    // Actualizar el elemento
    state.fluidos[state.editingIndex] = { via, solucion, volumen, frecuencia, ritmo };
    
    // Limpiar formulario y restaurar botones
    cancelarEdicionFluido();
    
    renderAllTables();
    showToast('Fluidoterapia actualizada correctamente', 'success');
}

function cancelarEdicionFluido() {
    $('#fluido_solucion').value = '';
    $('#fluido_volumen').value = '';
    $('#fluido_frecuencia').value = '';
    $('#fluido_ritmo').value = '';
    
    $('#btnAddFluido').style.display = 'inline-flex';
    $('#btnUpdateFluido').style.display = 'none';
    $('#btnCancelEditFluido').style.display = 'none';
    
    state.editingIndex = -1;
    state.editingType = null;
}

// ========== FLUIDOTERAPIA ==========
function addFluido(){
  console.log('Añadiendo fluidoterapia...');
  const via = $('#fluido_via').value;
  const solucion = $('#fluido_solucion').value;
  const volumen = $('#fluido_volumen').value;
  const frecuencia = $('#fluido_frecuencia').value;
  const ritmo = $('#fluido_ritmo').value;
  
  if(via === 'con' && !solucion){ 
    showToast('Selecciona una solución', 'warning');
    return; 
  }
  
  const item = { via, solucion, volumen, frecuencia, ritmo };
  state.fluidos.push(item);
  console.log('Fluidoterapia añadida:', item);
  
  // Limpiar formulario
  $('#fluido_solucion').value = '';
  $('#fluido_volumen').value = '';
  $('#fluido_frecuencia').value = '';
  $('#fluido_ritmo').value = '';
  
  renderAllTables();
  showToast('Fluidoterapia añadida correctamente', 'success');
}

// ========== BLOQUES DE CONFIGURACIÓN ==========
function guardarCuidados(){
  console.log('Guardando cuidados...');
  state.cuidados = {
    general: {
      cama: $('#cuidado_cama')?.checked || false,
      sedestacion: $('#cuidado_sedestacion')?.checked || false,
      deambular: $('#cuidado_deambular')?.checked || false
    },
    monitorizacion: $('#monitorizacion')?.value || 'no',
    constantes: $('#constantes_frecuencia')?.value || ''
  };
  showToast('Cuidados guardados correctamente', 'success');
}

function guardarOxigenacion(){
  console.log('Guardando oxigenación...');
  state.oxigenacion = {
    oxigeno: $('#oxigeno')?.value || 'no',
    dispositivo: $('#oxigeno_dispositivo')?.value || '',
    parametro: $('#oxigeno_parametro')?.value || '',
    reservorio: $('#oxigeno_reservorio')?.value || 'no'
  };
  showToast('Oxigenación guardada correctamente', 'success');
}

function guardarPruebas(){
  console.log('Guardando pruebas...');
  state.pruebas = {
    analitica: {
      hemograma: $('#analitica_hemograma')?.checked || false,
      bioquimica: $('#analitica_bioquimica')?.checked || false,
      coagulacion: $('#analitica_coagulacion')?.checked || false
    },
    radiologia: {
      simple: $('#radio_simple')?.checked || false,
      eco: $('#radio_eco')?.checked || false,
      tac: $('#radio_tac')?.checked || false
    }
  };
  showToast('Pruebas guardadas correctamente', 'success');
}

// ========== RENDERIZADO DE TABLAS ==========
function renderAllTables(){
  console.log('Renderizando todas las tablas...');
  renderTablaActual();
  renderTablaOpcional();
  renderTablaDietas();
  renderTablaFluidos();
}

function renderTablaActual(){
  const tbody = $('#tabla tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  state.prescripciones.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${esc(p.farmaco)}</td>
      <td>${esc(p.dosis)}</td>
      <td>${esc(p.via)}</td>
      <td>${freqText(p.freq)}</td>
      <td>${esc(p.inicio)}</td>
      <td>${p.dias}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm edit" onclick="editarPrescripcion(${idx})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm danger" onclick="eliminarPrescripcion(${idx})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaOpcional(){
  const tbody = $('#tablaOpcional tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  state.opcionales.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${condicionText(p.condicion)}</td>
      <td>${esc(p.farmaco)}</td>
      <td>${esc(p.dosis)}</td>
      <td>${esc(p.via)}</td>
      <td>${freqText(p.freqmax)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm edit" onclick="editarOpcional(${idx})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm danger" onclick="eliminarOpcional(${idx})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaDietas(){
  const tbody = $('#tablaDietas tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  state.dietas.forEach((dieta, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${dietaTipoText(dieta.tipo)}</td>
      <td>${dietaConsistenciaText(dieta.consistencia)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm edit" onclick="editarDieta(${idx})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm danger" onclick="eliminarDieta(${idx})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTablaFluidos(){
  const tbody = $('#tablaFluidos tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  state.fluidos.forEach((fluido, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${solucionText(fluido.solucion)}</td>
      <td>${fluido.volumen} ml</td>
      <td>${frecuenciaText(fluido.frecuencia)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-sm edit" onclick="editarFluido(${idx})" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm danger" onclick="eliminarFluido(${idx})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ========== ELIMINACIÓN DE ELEMENTOS ==========
function eliminarPrescripcion(index){ 
  state.prescripciones.splice(index, 1); 
  renderAllTables(); 
  renderSheets(); 
  showToast('Medicación eliminada', 'info');
}

function eliminarOpcional(index){ 
  state.opcionales.splice(index, 1); 
  renderAllTables(); 
  showToast('Medicación opcional eliminada', 'info');
}

function eliminarDieta(index){ 
  state.dietas.splice(index, 1); 
  renderAllTables(); 
  showToast('Dieta eliminada', 'info');
}

function eliminarFluido(index){ 
  state.fluidos.splice(index, 1); 
  renderAllTables(); 
  showToast('Fluidoterapia eliminada', 'info');
}

// ========== FUNCIONES DE TEXTO ==========
function condicionText(k){
  const map = {
    'fiebre': 'Si fiebre >38°C', 
    'dolor': 'Si dolor', 
    'agitacion': 'Si agitación',
    'nauseas': 'Si náuseas/vómitos', 
    'ta': 'Si TA elevada'
  };
  return map[k] || k;
}

function freqText(k){
  const map = {
    'q24': 'Cada 24 h',
    'q12': 'Cada 12 h', 
    'q8': 'Cada 8 h', 
    'q6': 'Cada 6 h', 
    'q4': 'Cada 4 h',
    'prn': 'Si precisa (PRN)'
  };
  return map[k] || k;
}

function dietaTipoText(tipo){
  const map = {
    'absoluta': 'Absoluta', 
    'normal': 'Normal', 
    'diabetica': 'Diabética',
    'hiposodica': 'Hiposódica', 
    'hiposodica_diabetica': 'Hiposódica/Diabética',
    'proteccion_biliar': 'Protección biliar'
  };
  return map[tipo] || tipo;
}

function dietaConsistenciaText(consistencia){
  const map = {
    'iniciar_tolerancia': 'Iniciar tolerancia', 
    'liquida': 'Líquida', 
    'triturada': 'Triturada',
    'facil_masticacion': 'Fácil masticación', 
    'astringente': 'Astringente',
    'rica_residuos': 'Rica en residuos', 
    'sin_residuos': 'Sin residuos'
  };
  return map[consistencia] || consistencia;
}

function solucionText(solucion){
  const map = {
    'fisiologico': 'Fisiológico', 
    'glucosalino': 'Glucosalino', 
    'glucosado5': 'Glucosado 5%',
    'glucosado10': 'Glucosado 10%', 
    'ringer': 'Ringer', 
    'hipertonico3': 'Hipertónico 3%',
    'hipotonico': 'Hipotónico'
  };
  return map[solucion] || solucion;
}

function frecuenciaText(freq){
  const map = {
    'ahora': 'Ahora', 
    '1h': 'c/1 hora', 
    '2h': 'c/2 horas', 
    '4h': 'c/4 horas',
    '6h': 'c/6 horas', 
    '8h': 'c/8 horas', 
    '12h': 'c/12 horas', 
    '24h': 'c/24 horas'
  };
  return map[freq] || freq;
}

// ========== BINDS PRINCIPALES ==========
function bind(){
  console.log('Configurando event bindings...');
  
  // Botones principales de añadir
  $('#btnAdd').addEventListener('click', addPrescripcion);
  $('#btnAddOpcional').addEventListener('click', addOpcional);
  $('#btnAddDieta').addEventListener('click', addDieta);
  $('#btnAddFluido').addEventListener('click', addFluido);
  
  // Botones de actualizar
  $('#btnUpdate').addEventListener('click', actualizarPrescripcion);
  $('#btnUpdateOpcional').addEventListener('click', actualizarOpcional);
  $('#btnUpdateDieta').addEventListener('click', actualizarDieta);
  $('#btnUpdateFluido').addEventListener('click', actualizarFluido);
  
  // Botones de cancelar edición
  $('#btnCancelEdit').addEventListener('click', cancelarEdicionPrescripcion);
  $('#btnCancelEditOpcional').addEventListener('click', cancelarEdicionOpcional);
  $('#btnCancelEditDieta').addEventListener('click', cancelarEdicionDieta);
  $('#btnCancelEditFluido').addEventListener('click', cancelarEdicionFluido);
  
  // Botones de vaciar
  $('#btnVaciarTabla').addEventListener('click', () => { 
    state.prescripciones = []; 
    renderAllTables(); 
    renderSheets(); 
    showToast('Medicación actual vaciada', 'info');
  });
  $('#btnVaciarOpcional').addEventListener('click', () => { 
    state.opcionales = []; 
    renderAllTables(); 
    showToast('Medicación opcional vaciada', 'info');
  });
  $('#btnVaciarDietas').addEventListener('click', () => { 
    state.dietas = []; 
    renderAllTables(); 
    showToast('Dietas vaciadas', 'info');
  });
  $('#btnVaciarFluidos').addEventListener('click', () => { 
    state.fluidos = []; 
    renderAllTables(); 
    showToast('Fluidoterapia vaciada', 'info');
  });
  
  // Botones de guardar configuración
  $('#btnGuardarCuidados').addEventListener('click', guardarCuidados);
  $('#btnGuardarOxigenacion').addEventListener('click', guardarOxigenacion);
  $('#btnGuardarPruebas').addEventListener('click', guardarPruebas);
  
  // Botones de sistema
  $('#btnLimpiar').addEventListener('click', () => { 
    if(confirm('¿Limpiar todos los datos?')) resetAll(); 
  });
  $('#btnGuardar').addEventListener('click', exportJSON);
  $('#btnHistorial').addEventListener('click', mostrarModalHistorial);
  $('#fileJSON').addEventListener('change', importJSON);
  $('#btnMedico').addEventListener('click', () => { 
    syncPaciente(); 
    renderSheets(); 
    document.body.classList.remove('print-enfermeria'); 
    document.body.classList.add('print-medico'); 
    window.print(); 
  });
  $('#btnEnfermeria').addEventListener('click', () => { 
    syncPaciente(); 
    renderSheets(); 
    document.body.classList.remove('print-medico'); 
    document.body.classList.add('print-enfermeria'); 
    window.print(); 
  });
  $('#btnDemo').addEventListener('click', demoData);

  // Modales
  $('#historialModalClose').addEventListener('click', cerrarModalHistorial);
  $('#historialOverlay').addEventListener('click', cerrarModalHistorial);
  $('#btnLimpiarHistorial').addEventListener('click', () => {
    if(confirm('¿Eliminar todo el historial?')) {
      localStorage.removeItem('tratamientosHistorial');
      mostrarModalHistorial();
    }
  });
  
  console.log('Event bindings configurados correctamente');
}

// ========== SISTEMA DE DATOS ==========
function syncPaciente(){
  state.paciente = {
    edad: $('#pac_edad').value,
    sexo: $('#pac_sexo').value,
    peso: $('#pac_peso').value,
    alergias: state.paciente.alergias || [],
    medico: $('#pac_medico').value.trim(),
    area: $('#pac_area').value,
    fecha: $('#pac_fecha').value,
    insuf_renal: state.paciente.insuf_renal || 'no',
    insuf_hepatica: state.paciente.insuf_hepatica || 'no'
  };
}

function resetAll(){
  console.log('Reseteando todos los datos...');
  state.paciente = {
    alergias: [],
    insuf_renal: 'no',
    insuf_hepatica: 'no'
  };
  state.prescripciones = [];
  state.opcionales = [];
  state.puntuales = [];
  state.dietas = [];
  state.fluidos = [];
  state.cuidados = {};
  state.oxigenacion = {};
  state.pruebas = {};
  state.let = null;
  
  // Limpiar formularios
  $$('#pac_edad, #pac_sexo, #pac_peso, #pac_alergia_input, #pac_medico, #pac_area').forEach(e => e.value = '');
  $('#pac_sexo').value = '';
  $('#pac_area').value = '';
  $('#pac_fecha').value = nowLocalISO();
  
  // Limpiar alergias
  renderAlergiasList();
  
  // Resetear botones Sí/No
  $$('.si-no-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  $$('.si-no-btn.no').forEach(btn => {
    btn.classList.add('selected');
  });
  
  // Limpiar LET
  $$('.let-btn').forEach(b => b.classList.remove('selected'));
  const letDisplay = $('#letDisplay');
  if (letDisplay) letDisplay.style.display = 'none';
  
  // Cancelar cualquier edición en curso
  state.editingIndex = -1;
  state.editingType = null;
  $$('#btnUpdate, #btnUpdateOpcional, #btnUpdateDieta, #btnUpdateFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnCancelEdit, #btnCancelEditOpcional, #btnCancelEditDieta, #btnCancelEditFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnAdd, #btnAddOpcional, #btnAddDieta, #btnAddFluido').forEach(b => {
    if (b) b.style.display = 'inline-flex';
  });
  
  renderAllTables();
  renderSheets();
  showToast('Todos los datos han sido reseteados', 'info');
  console.log('Datos reseteados correctamente');
}

// ========== RENDERIZADO PARA IMPRESIÓN ==========
function renderSheets(){
  syncPaciente();
  
  // Esta función se simplifica para la nueva estructura
  console.log('Renderizando hojas de impresión...');
  // La implementación completa de renderSheets se mantendría aquí
}

// ========== SISTEMA DE GUARDADO/CARGA ==========
function exportJSON(){
  syncPaciente();
  const data = {
    paciente: state.paciente,
    prescripciones: state.prescripciones,
    opcionales: state.opcionales,
    puntuales: state.puntuales,
    dietas: state.dietas,
    fluidos: state.fluidos,
    cuidados: state.cuidados,
    oxigenacion: state.oxigenacion,
    pruebas: state.pruebas,
    let: state.let,
    timestamp: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tratamiento-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Guardar en historial
  guardarEnHistorial(data);
  showToast('Datos guardados correctamente', 'success');
}

function importJSON(e){
  const file = e.target.files[0];
  if(!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      const data = JSON.parse(e.target.result);
      cargarDatos(data);
      showToast('Datos cargados correctamente', 'success');
    } catch(err){
      showToast('Error al cargar el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function cargarDatos(data){
  state.paciente = data.paciente || { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' };
  state.prescripciones = data.prescripciones || [];
  state.opcionales = data.opcionales || [];
  state.puntuales = data.puntuales || [];
  state.dietas = data.dietas || [];
  state.fluidos = data.fluidos || [];
  state.cuidados = data.cuidados || {};
  state.oxigenacion = data.oxigenacion || {};
  state.pruebas = data.pruebas || {};
  state.let = data.let || null;
  
  // Actualizar formularios
  if(state.paciente.edad) $('#pac_edad').value = state.paciente.edad;
  if(state.paciente.sexo) $('#pac_sexo').value = state.paciente.sexo;
  if(state.paciente.peso) $('#pac_peso').value = state.paciente.peso;
  if(state.paciente.medico) $('#pac_medico').value = state.paciente.medico;
  if(state.paciente.area) $('#pac_area').value = state.paciente.area;
  if(state.paciente.fecha) $('#pac_fecha').value = state.paciente.fecha;
  
  // Actualizar alergias
  renderAlergiasList();
  
  // Actualizar botones Sí/No
  $$('.si-no-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  if(state.paciente.insuf_renal === 'si') {
    $$('.si-no-btn[data-tipo="renal"][data-valor="si"]').forEach(btn => btn.classList.add('selected'));
  } else {
    $$('.si-no-btn[data-tipo="renal"][data-valor="no"]').forEach(btn => btn.classList.add('selected'));
  }
  if(state.paciente.insuf_hepatica === 'si') {
    $$('.si-no-btn[data-tipo="hepatica"][data-valor="si"]').forEach(btn => btn.classList.add('selected'));
  } else {
    $$('.si-no-btn[data-tipo="hepatica"][data-valor="no"]').forEach(btn => btn.classList.add('selected'));
  }
  
  // Actualizar LET
  $$('.let-btn').forEach(b => b.classList.remove('selected'));
  if(state.let){
    const btn = $(`.let-btn[data-let="${state.let}"]`);
    if(btn) btn.classList.add('selected');
    const letData = LET_DATA[state.let];
    if(letData){
      $('#letActitud').textContent = letData.actitud;
      $('#letAclaracion').textContent = letData.aclaracion;
      $('#letDisplay').style.display = 'block';
    }
  }
  
  // Cancelar cualquier edición en curso
  state.editingIndex = -1;
  state.editingType = null;
  $$('#btnUpdate, #btnUpdateOpcional, #btnUpdateDieta, #btnUpdateFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnCancelEdit, #btnCancelEditOpcional, #btnCancelEditDieta, #btnCancelEditFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnAdd, #btnAddOpcional, #btnAddDieta, #btnAddFluido').forEach(b => {
    if (b) b.style.display = 'inline-flex';
  });
  
  renderAllTables();
  renderSheets();
}

// ========== SISTEMA DE HISTORIAL ==========
function guardarEnHistorial(data){
  const historial = JSON.parse(localStorage.getItem('tratamientosHistorial') || '[]');
  historial.unshift({
    timestamp: data.timestamp,
    paciente: data.paciente,
    numPrescripciones: data.prescripciones.length
  });
  
  // Mantener solo los últimos 50
  if(historial.length > 50) historial.length = 50;
  
  localStorage.setItem('tratamientosHistorial', JSON.stringify(historial));
}

function mostrarModalHistorial(){
  const historial = JSON.parse(localStorage.getItem('tratamientosHistorial') || '[]');
  const lista = $('#historialLista');
  
  if(historial.length === 0){
    lista.innerHTML = '<p style="text-align:center;color:#64748b">No hay tratamientos guardados en el historial</p>';
  } else {
    lista.innerHTML = historial.map((item, idx) => `
      <div style="padding:12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;cursor:pointer" 
           onclick="cargarDelHistorial(${idx})">
        <div style="font-weight:600">${new Date(item.timestamp).toLocaleString()}</div>
        <div style="font-size:12px;color:#64748b">
          ${item.paciente.edad ? item.paciente.edad + ' años' : 'Edad no especificada'} | 
          ${item.paciente.medico || 'Médico no especificado'} |
          ${item.numPrescripciones} medicación(es)
        </div>
      </div>
    `).join('');
  }
  
  $('#historialModal').classList.add('active');
  $('#historialOverlay').classList.add('active');
}

function cerrarModalHistorial(){
  $('#historialModal').classList.remove('active');
  $('#historialOverlay').classList.remove('active');
}

function cargarDelHistorial(index){
  const historial = JSON.parse(localStorage.getItem('tratamientosHistorial') || '[]');
  if(historial[index]){
    cerrarModalHistorial();
    showToast('Funcionalidad de carga completa del historial en desarrollo', 'info');
  }
}

// ========== SISTEMA DE ALERGIAS ==========
function renderAlergiasList() {
  const container = $('#alergias-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.paciente.alergias && state.paciente.alergias.length > 0) {
    state.paciente.alergias.forEach((alergia, index) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.innerHTML = `
        ${alergia}
        <button type="button" class="btn-icon btn-sm alt" onclick="eliminarAlergia(${index})" style="margin-left:4px">
          <i class="fas fa-times"></i>
        </button>
      `;
      container.appendChild(chip);
    });
  }
}

function eliminarAlergia(index) {
  state.paciente.alergias.splice(index, 1);
  renderAlergiasList();
  showToast('Alergia eliminada', 'info');
}

// ========== DATOS DE DEMOSTRACIÓN ==========
function demoData(){
  if(!confirm('¿Cargar datos de demostración? Se perderán los datos actuales.')) return;
  
  state.paciente = {
    edad: '65',
    sexo: 'M',
    peso: '75',
    alergias: ['Penicilina', 'Ibuprofeno'],
    medico: 'Dr. Carlos Galán',
    area: 'medicina_interna',
    fecha: nowLocalISO(),
    insuf_renal: 'no',
    insuf_hepatica: 'si'
  };
  
  state.prescripciones = [
    {
      farmaco: 'Paracetamol',
      dosis: '1 g',
      via: 'VO',
      freq: 'q8',
      inicio: '08:00',
      dias: 3,
      indicacion: 'Fiebre',
      obs: 'Con las comidas'
    }
  ];
  
  state.opcionales = [
    {
      condicion: 'dolor',
      farmaco: 'Metamizol',
      dosis: '575 mg',
      via: 'VO',
      freqmax: 'q8',
      obs: 'Si dolor moderado-intenso'
    }
  ];
  
  state.dietas = [
    {
      tipo: 'absoluta',
      consistencia: 'iniciar_tolerancia',
      obs: 'Reevaluar en 6h'
    }
  ];
  
  state.fluidos = [
    {
      via: 'con',
      solucion: 'fisiologico',
      volumen: '1000',
      frecuencia: '24h',
      ritmo: '42'
    }
  ];
  
  state.let = '2';
  
  // Actualizar formularios
  $('#pac_edad').value = state.paciente.edad;
  $('#pac_sexo').value = state.paciente.sexo;
  $('#pac_peso').value = state.paciente.peso;
  $('#pac_medico').value = state.paciente.medico;
  $('#pac_area').value = state.paciente.area;
  $('#pac_fecha').value = state.paciente.fecha;
  
  // Actualizar alergias
  renderAlergiasList();
  
  // Actualizar botones Sí/No
  $$('.si-no-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  $$('.si-no-btn[data-tipo="renal"][data-valor="no"]').forEach(btn => btn.classList.add('selected'));
  $$('.si-no-btn[data-tipo="hepatica"][data-valor="si"]').forEach(btn => btn.classList.add('selected'));
  
  // Actualizar LET
  $$('.let-btn').forEach(b => b.classList.remove('selected'));
  const btn = $(`.let-btn[data-let="${state.let}"]`);
  if(btn) btn.classList.add('selected');
  const letData = LET_DATA[state.let];
  $('#letActitud').textContent = letData.actitud;
  $('#letAclaracion').textContent = letData.aclaracion;
  $('#letDisplay').style.display = 'block';
  
  // Cancelar cualquier edición en curso
  state.editingIndex = -1;
  state.editingType = null;
  $$('#btnUpdate, #btnUpdateOpcional, #btnUpdateDieta, #btnUpdateFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnCancelEdit, #btnCancelEditOpcional, #btnCancelEditDieta, #btnCancelEditFluido').forEach(b => {
    if (b) b.style.display = 'none';
  });
  $$('#btnAdd, #btnAddOpcional, #btnAddDieta, #btnAddFluido').forEach(b => {
    if (b) b.style.display = 'inline-flex';
  });
  
  renderAllTables();
  renderSheets();
  showToast('Datos de demostración cargados', 'success');
}

// ========== INICIALIZACIÓN FINAL ==========
document.addEventListener('DOMContentLoaded', init);