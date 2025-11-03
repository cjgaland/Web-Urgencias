// js/core/events.js — Sistema de eventos global (con soporte por IDs)
function callFirst(mod, candidates, payload) {
  if (!mod) return false;
  for (const name of candidates) {
    const fn = mod[name];
    if (typeof fn === 'function') {
      try { fn(payload); return true; } catch (e) { console.error(e); return false; }
    }
  }
  return false;
}

function byId(id) { return document.getElementById(id); }

export function initEventSystems() {
  // 1) Delegación genérica por data-action (si en el futuro lo añades)
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action?.trim();
    if (!action) return;
    if (window.App && typeof window.App.dispatch === 'function') {
      window.App.dispatch(action, btn);
    }
  });

  // 2) Enlaces directos por ID (tu HTML actual)
  const map = [
    // Dietas
    { id: 'btnAddIntolerancia', module: 'dietas', methods: ['addIntolerancia','add_intolerancia'] },
    { id: 'btnAddDieta',        module: 'dietas', methods: ['addDieta','agregarDieta','createDieta'] },
    { id: 'btnUpdateDieta',     module: 'dietas', methods: ['updateDieta','guardarDieta','saveDieta'] },
    { id: 'btnCancelEditDieta', module: 'dietas', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarDietas',    module: 'dietas', methods: ['vaciar','vaciarDietas','clear','clearDietas'] },

    // LET (añadir estos 3)
    { id: 'btnInfoLET',    module: 'let', methods: ['mostrarModal','mostrar','open'] },
    { id: 'letModalClose', module: 'let', methods: ['cerrarModal','cerrar','close'] },
    { id: 'letOverlay',    module: 'let', methods: ['cerrarModal','cerrar','close'] },
  
      
    // Fluidos
    { id: 'btnAddFluido',        module: 'fluidos', methods: ['addFluido','agregarFluido','createFluido'] },
    { id: 'btnUpdateFluido',     module: 'fluidos', methods: ['updateFluido','guardarFluido','saveFluido'] },
    { id: 'btnCancelEditFluido', module: 'fluidos', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarFluidos',    module: 'fluidos', methods: ['vaciar','vaciarFluidos','clear','clearFluidos'] },

    // Prescripciones (medicación actual)
    { id: 'btnAdd',           module: 'prescripciones', methods: ['addPrescripcion','add','createPrescripcion'] },
    { id: 'btnUpdate',        module: 'prescripciones', methods: ['updatePrescripcion','guardar','savePrescripcion'] },
    { id: 'btnCancelEdit',    module: 'prescripciones', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarTabla',   module: 'prescripciones', methods: ['vaciar','vaciarTabla','clear'] },

    // Medicación opcional
    { id: 'btnAddOpcional',        module: 'opcionales', methods: ['addOpcional','add','createOpcional'] },
    { id: 'btnUpdateOpcional',     module: 'opcionales', methods: ['updateOpcional','guardar','saveOpcional'] },
    { id: 'btnCancelEditOpcional', module: 'opcionales', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarOpcional',     module: 'opcionales', methods: ['vaciar','vaciarTabla','clear'] },

    // Medicación puntual
    { id: 'btnAddPuntual',        module: 'puntuales', methods: ['addPuntual','add','createPuntual'] },
    { id: 'btnUpdatePuntual',     module: 'puntuales', methods: ['updatePuntual','guardar','savePuntual'] },
    { id: 'btnCancelEditPuntual', module: 'puntuales', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarPuntual',     module: 'puntuales', methods: ['vaciar','vaciarTabla','clear'] },

    // Medicación domiciliaria
    { id: 'btnAddDom',          module: 'domicilio', methods: ['add','addDomicilio','create'] },
    { id: 'btnUpdateDom',       module: 'domicilio', methods: ['actualizar','update','save'] },
    { id: 'btnCancelEditDom',   module: 'domicilio', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarDom',       module: 'domicilio', methods: ['vaciar','clear'] },
    
    // Respiratorio (Oxigenacion)
    { id: 'btnAddResp',        module: 'oxigenacion', methods: ['add','agregar','create', 'addRegistro'] },
    { id: 'btnUpdateResp',     module: 'oxigenacion', methods: ['actualizar','update','save', 'actualizarRegistro'] },
    { id: 'btnCancelEditResp', module: 'oxigenacion', methods: ['cancelarEdicion','cancelEdit','cancelar'] },
    { id: 'btnVaciarResp',     module: 'oxigenacion', methods: ['vaciar','clear','reset', 'vaciarRegistros'] },


    // Oxigenación / Cuidados / Pruebas (Botones de guardar simples, si los tuvieras)
    // { id: 'btnGuardarOxigenacion', module: 'oxigenacion', methods: ['guardar','save','commit'] },
    // { id: 'btnGuardarCuidados',    module: 'cuidados',    methods: ['guardar','save','commit'] },
    // { id: 'btnGuardarPruebas',     module: 'pruebas',     methods: ['guardar','save','commit'] },

    // Historial
    { id: 'btnLimpiarHistorial', module: 'historial', methods: ['limpiar','clear','vaciar'] },

    // --- CORRECCIÓN: Botones de Toolbar apuntando a 'export' e 'historial' ---
    { id: 'btnDemo',     module: 'export',        methods: ['demo', 'demoData'] },
    { id: 'btnGuardar',  module: 'export',        methods: ['exportar','guardar','save', 'exportJSON'] },
    { id: 'btnHistorial',module: 'historial',     methods: ['abrir','open','mostrar', 'mostrarModalHistorial'] },
    { id: 'btnMedico',   module: 'export',        methods: ['imprimirMedico','imprimir_medico','printMedico', 'imprimir'] },
    { id: 'btnEnfermeria',module: 'export',       methods: ['imprimirEnfermeria','imprimir_enfermeria','printEnfermeria', 'imprimir'] },
    { id: 'btnLimpiar',  module: 'export',        methods: ['limpiarTodo','reset','clearAll', 'resetAll'] },
  ];

  function getModule(name) {
    return window.App?.getAllModules?.()[name] || window[name] || null;
  }

  // Vincular clicks por ID
  map.forEach(entry => {
    const el = byId(entry.id);
    if (!el) {
        // No advertir sobre botones de toolbar que podrían no existir
        const toolbarButtons = ['btnDemo', 'btnGuardar', 'btnHistorial', 'btnMedico', 'btnEnfermeria', 'btnLimpiar', 'btnCargarPlantilla'];
        if (!toolbarButtons.includes(entry.id)) {
             console.warn(`[events] Elemento no encontrado: #${entry.id}`);
        }
        return;
    }
    el.addEventListener('click', (e) => {
      const mod = getModule(entry.module);
      // Para impresión, pasamos el payload correcto
      if (entry.id === 'btnMedico') {
          callFirst(mod, entry.methods, 'medico');
          return;
      }
      if (entry.id === 'btnEnfermeria') {
          callFirst(mod, entry.methods, 'enfermeria');
          return;
      }

      if (!callFirst(mod, entry.methods, { source: e.currentTarget })) {
        console.warn(`[events] No se encontró método en módulo "${entry.module}" para #${entry.id}. Métodos intentados: ${entry.methods.join(', ')}`);
      }
    });
  });

  // Inputs especiales

  // LET: botones .let-btn con data-let (robusto aunque falte #let-container)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.let-btn[data-let]');
  if (!btn) return;
  const letValue = btn.dataset.let;
  const mod = getModule('let');
  if (!mod) { console.warn('[events] Módulo LET no disponible'); return; }
  // Llamada directa con el valor esperado por el módulo
  if (callFirst(mod, ['seleccionar', 'select', 'setNivel', 'setLevel'], letValue)) {
      return;
  }
  console.warn('[events] LET: no hay método seleccionar/select/setNivel/setLevel en el módulo.');
});

  // Si/No insuficiencias (renal/hepática)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.si-no-btn');
    if (!btn) return;
    const tipo = btn.dataset.tipo;  // 'renal' | 'hepatica'
    const valor = btn.dataset.valor; // 'si' | 'no'
    const mod = getModule('paciente');
    if (callFirst(mod, ['setInsuficiencia','toggleInsuficiencia','setFlag'], { tipo, valor, source: btn })) {
      // toggles visuales sencillos
      const wrapper = btn.closest('.si-no-buttons');
      if (wrapper) {
        wrapper.querySelectorAll('.si-no-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }
    } else {
      console.warn('[events] Paciente: método setInsuficiencia/toggleInsuficiencia no encontrado.');
    }
  });

  // Importar JSON (file input)
  const file = byId('fileJSON');
  if (file) {
    file.addEventListener('change', (e) => {
      const mod = getModule('export') || getModule('historial') || getModule('paciente');
      if (!callFirst(mod, ['importar','importJSON','cargarJSON'], e)) { // Pasamos el evento completo
        console.warn('[events] Importar JSON: no hay método importar/importJSON/cargarJSON.');
      }
    });
  }
}
