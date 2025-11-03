// js/app.js — Coordinador principal (limpio)
import { GlobalState, StateManager } from './core/state.js';
import { select as $, nowLocalISO, showToast } from './core/utils.js';
import { initEventSystems } from './core/events.js';

// Módulos
import DataLoader from './modules/data-loader.js';
import PacienteModule from './modules/paciente.js';
import PrescripcionesModule from './modules/prescripciones.js';
import DomicilioModule from './modules/domicilio.js';
import OpcionalesModule from './modules/opcionales.js';
import PuntualesModule from './modules/puntuales.js';
import DietasModule from './modules/dietas.js';
import FluidosModule from './modules/fluidos.js';
import LETModule from './modules/let.js';
import CuidadosModule from './modules/cuidados.js';
import OxigenacionModule from './modules/oxigenacion.js';
import PruebasModule from './modules/pruebas.js';

// --- CORRECCIÓN: Importar módulos faltantes ---
import ExportModule from './modules/export.js';
import HistorialModule from './modules/historial.js';


const App = (() => {
  const Modules = {
    paciente: PacienteModule,
    prescripciones: PrescripcionesModule,
    domicilio: DomicilioModule,
    opcionales: OpcionalesModule,
    puntuales: PuntualesModule,
    dietas: DietasModule,
    fluidos: FluidosModule,
    let: LETModule,
    cuidados: CuidadosModule,
    oxigenacion: OxigenacionModule,
    pruebas: PruebasModule,

    // --- CORRECCIÓN: Registrar módulos de cabecera ---
    export: ExportModule,
    historial: HistorialModule
  };

  function getAllModules() { return Modules; }
  function getAppState() { return GlobalState; }

  async function loadData() {
    await Promise.all([
      DataLoader.cargarProfesionales?.(),
      DataLoader.cargarEspecialidades?.(),
      DataLoader.cargarDietas?.(),
      DataLoader.cargarConsistencias?.(),
      DataLoader.cargarIntolerancias?.(),
      DataLoader.cargarSoluciones?.()
    ].filter(Boolean));
  }

  async function initModules() {
    for (const key of Object.keys(Modules)) {
      const mod = Modules[key];
      if (typeof mod?.init === 'function') {
        try {
            await mod.init();
        } catch (err) {
            console.error(`Error inicializando módulo: ${key}`, err);
        }
      }
    }
  }

  function onStateChange(newState) {
    if (typeof DietasModule?.render === 'function') DietasModule.render();
    if (typeof PrescripcionesModule?.render === 'function') PrescripcionesModule.render();
  }

  async function init() {
    try {
      const fecha = $('#pac_fecha');
      if (fecha) fecha.value = nowLocalISO();

      await loadData();
      await initModules();

      StateManager.subscribe(onStateChange);
      initEventSystems();

      console.log('✅ App iniciada');
      showToast?.('Aplicación lista', 'success');
    } catch (err) {
      console.error('Error al iniciar la App:', err);
      showToast?.('Error al iniciar la aplicación', 'error');
    }
  }

  function dispatch(action, el) {
    const moduleName = el?.dataset?.module;
    const target = el?.dataset?.target ? document.querySelector(el.dataset.target) : null;

    const tryInvoke = (mod, method) => {
      if (mod && typeof mod[method] === 'function') {
        return mod[method]({ source: el, target, state: GlobalState });
      }
      return false;
    };

    if (moduleName && Modules[moduleName]) {
      if (tryInvoke(Modules[moduleName], action) !== false) return;
    }

    const commonMap = [
      ['add-dieta', 'addDieta', 'dietas'],
      ['edit-dieta', 'editDieta', 'dietas'],
      ['delete-dieta', 'deleteDieta', 'dietas'],
      ['add-intolerancia', 'addIntolerancia', 'dietas'],
      ['remove-intolerancia', 'removeIntolerancia', 'dietas'],
      ['export-json', 'exportar', 'export'],
      ['add-prescripcion', 'addPrescripcion', 'prescripciones'],
      ['remove-prescripcion', 'removePrescripcion', 'prescripciones'],
      ['add-fluido', 'addFluido', 'fluidos'],
      ['remove-fluido', 'removeFluido', 'fluidos']
    ];

    for (const [attrAction, method, modName] of commonMap) {
      if (action === attrAction) {
        const mod = Modules[modName] || window.ExportModule;
        if (tryInvoke(mod, method) !== false) return;
      }
    }

    console.warn(`⚠️ Acción no manejada: "${action}"`);
  }

  return {
    init,
    dispatch,
    getAllModules,
    getState: getAppState
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;

export default App;
