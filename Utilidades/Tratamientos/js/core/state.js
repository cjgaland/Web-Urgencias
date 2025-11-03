// core/state.js - Estado global con gestión de suscriptores

// ===== Estado global inicial =====
export const GlobalState = {
  paciente: {
    alergias: [],
    insuf_renal: 'no',
    insuf_hepatica: 'no'
  },
  prescripciones: [],
  domicilio: [],
  opcionales: [],
  puntuales: [],
  dietas: [],
  fluidos: [],
  cuidados: [],      // ← array
  oxigenacion: [],   // ← MODIFICADO: Debe ser un array
  pruebas: [],       // ← array
  let: null,
  editingIndex: -1,
  editingType: null,
  intoleranciasDisponibles: []
};

// ===== Suscriptores =====
const subscribers = [];

/**
 * Gestor centralizado del estado global
 */
export const StateManager = {
  subscribe(callback) {
    if (typeof callback !== 'function') {
      console.warn('StateManager.subscribe: callback debe ser una función');
      return;
    }
    subscribers.push(callback);
    console.log(`Nuevo suscriptor agregado. Total: ${subscribers.length}`);
  },

  updateState(newState) {
    if (typeof newState !== 'object' || newState === null) {
      console.warn('StateManager.updateState: newState debe ser un objeto');
      return;
    }
    const previousState = { ...GlobalState };
    Object.assign(GlobalState, newState);

    console.log('Estado actualizado:', {
      anterior: previousState,
      nuevo: GlobalState,
      cambios: newState
    });

    this.notifySubscribers(GlobalState, previousState, newState);
  },

  notifySubscribers(currentState, previousState, changes) {
    subscribers.forEach((cb, i) => {
      try { cb(currentState, previousState, changes); }
      catch (err) { console.error(`Error en suscriptor ${i}:`, err); }
    });
  },

  getState() {
    return { ...GlobalState };
  },

  getStateByPath(path) {
    const keys = path.split('.');
    let value = GlobalState;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) value = value[key];
      else return undefined;
    }
    return Array.isArray(value) ? [...value]
      : (value && typeof value === 'object') ? { ...value }
      : value;
  },

  setStateByPath(path, value) {
    const keys = path.split('.');
    const newState = { ...GlobalState };
    let current = newState;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || current[k] == null || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    this.updateState(newState);
  },

  unsubscribe(callback) {
    const idx = subscribers.indexOf(callback);
    if (idx !== -1) {
      subscribers.splice(idx, 1);
      console.log(`Suscriptor removido. Total: ${subscribers.length}`);
    }
  },

  clearSubscribers() {
    subscribers.length = 0;
    console.log('Todos los suscriptores removidos');
  },

  getSubscriberCount() {
    return subscribers.length;
  },

  resetState() {
    const defaultState = {
      paciente: { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' },
      prescripciones: [],
      domicilio: [],
      opcionales: [],
      puntuales: [],
      dietas: [],
      fluidos: [],
      cuidados: [],     // ← array
      oxigenacion: [],  // ← MODIFICADO: Debe ser un array
      pruebas: [],      // ← array
      let: null,
      editingIndex: -1,
      editingType: null,
      intoleranciasDisponibles: []
    };
    this.updateState(defaultState);
    console.log('Estado resetado a valores por defecto');
  },

  /**
   * Valida la estructura del estado (distingue array vs object)
   */
  validateState() {
    const schema = {
      paciente: 'object',
      prescripciones: 'array',
      domicilio: 'array',
      opcionales: 'array',
      puntuales: 'array',
      dietas: 'array',
      fluidos: 'array',
      cuidados: 'array',     // ← array
      oxigenacion: 'array',  // ← MODIFICADO: Debe ser un array
      pruebas: 'array',      // ← array
      let: ['string', 'null'],
      editingIndex: 'number',
      editingType: ['string', 'null'],
      intoleranciasDisponibles: 'array'
    };

    const typeOf = (v) => {
      if (Array.isArray(v)) return 'array';
      if (v === null) return 'null';
      return typeof v; // 'object', 'string', 'number', etc.
    };

    for (const [key, expected] of Object.entries(schema)) {
      const expectedTypes = Array.isArray(expected) ? expected : [expected];
      const actualType = typeOf(GlobalState[key]);
      if (!expectedTypes.includes(actualType)) {
        console.warn(`Estado inválido: ${key} debería ser ${expectedTypes.join('/')} pero es ${actualType}`);
        return false;
      }
    }
    return true;
  }
};

/**
 * Acciones de estado
 */
export const StateActions = {
  // Paciente
  setPaciente(pacienteData) {
    StateManager.updateState({ paciente: { ...GlobalState.paciente, ...pacienteData } });
  },
  addAlergia(alergia) {
    const nuevas = [...(GlobalState.paciente?.alergias || []), alergia];
    StateManager.setStateByPath('paciente.alergias', nuevas);
  },
  removeAlergia(index) {
    const arr = (GlobalState.paciente?.alergias || []).filter((_, i) => i !== index);
    StateManager.setStateByPath('paciente.alergias', arr);
  },

  // Arrays genéricos
  addToArray(arrayName, item) {
    const current = Array.isArray(GlobalState[arrayName]) ? GlobalState[arrayName] : [];
    StateManager.setStateByPath(arrayName, [...current, item]);
  },
  removeFromArray(arrayName, index) {
    const current = Array.isArray(GlobalState[arrayName]) ? GlobalState[arrayName] : [];
    const next = current.filter((_, i) => i !== index);
    StateManager.setStateByPath(arrayName, next);
  },
  updateInArray(arrayName, index, item) {
    const current = Array.isArray(GlobalState[arrayName]) ? GlobalState[arrayName] : [];
    const next = [...current];
    next[index] = { ...next[index], ...item };
    StateManager.setStateByPath(arrayName, next);
  },
  clearArray(arrayName) {
    StateManager.setStateByPath(arrayName, []);
  },

  // LET y edición
  setLET(letValue) {
    StateManager.updateState({ let: letValue });
  },
  setEditing(index, type) {
    StateManager.updateState({ editingIndex: index, editingType: type });
  },
  clearEditing() {
    StateManager.updateState({ editingIndex: -1, editingType: null });
  }
};

// ===== Inicialización y autoparches antes de validar =====
console.log('StateManager inicializado');

// Autocorrección de tipos comunes (por si llega un JSON antiguo)
if (!Array.isArray(GlobalState.prescripciones)) GlobalState.prescripciones = [];

['domicilio', 'opcionales', 'puntuales', 'dietas', 'fluidos', 'cuidados', 'pruebas']
  .forEach(k => { if (!Array.isArray(GlobalState[k])) GlobalState[k] = []; });

// MODIFICADO: Asegura que oxigenacion sea un array
if (!Array.isArray(GlobalState.oxigenacion)) {
  GlobalState.oxigenacion = [];
}

StateManager.validateState();

export default { GlobalState, StateManager, StateActions };