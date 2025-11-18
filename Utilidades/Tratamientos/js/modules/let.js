// modules/let.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers } from '../core/utils.js';

// ===== Helper: toast seguro (no rompe si showToast no existe) =====
const safeToast = (msg, type = 'info') => {
  try { if (typeof showToast === 'function') showToast(msg, type); } catch (_) {}
};

// Datos de Limitación del Esfuerzo Terapéutico
const LET_DATA = {
  1: {
    titulo: "LET 1 - Soporte total",
    actitud: "SOPORTE TOTAL",
    aclaracion: "LET 1 - El paciente recibe todas las medidas necesarias, sin excepción."
  },
  2: {
    titulo: "LET 2 - Soporte total salvo RCP",
    actitud: "SOPORTE TOTAL SALVO RCP (\"ORDENES DE NO RCP\")",
    aclaracion: "LET 2 - Pacientes donde la situación basal anterior a la enfermedad es mala, con pobre calidad de vida, donde la enfermedad puede ser tratada, pero que si en el transcurso de la evolución surge una parada cardiaca, empeoraría el cuadro y pronóstico."
  },
  3: {
    titulo: "LET 3 - No aplicar medidas extraordinarias",
    actitud: "LET 3 - NO APLICAR MEDIDAS EXTRAORDINARIAS",
    aclaracion: "En general, en esta categoría se incluyen pacientes con fracaso de diversos órganos y función cerebral mínima, en los que ni siquiera existen esperanzas remotas de recobrar una función cerebral aceptable."
  },
  4: {
    titulo: "LET 4 - No aumentar medidas extraordinarias",
    actitud: "LET 4 - NO AUMENTAR Y/O NO APLICAR MAS MEDIDAS EXTRAORDINARIAS",
    aclaracion: "En esta categoría se incluyen los pacientes del grupo anterior y pacientes con fracasos de varios órganos, en los que se han aplicado algunas medidas extraordinarias."
  },
  5: {
    titulo: "LET 5 - Retirada de todas las medidas",
    actitud: "LET 5 - RETIRADA DE TODAS LAS MEDIDAS",
    aclaracion: "Cuando se cumplen los criterios de muerte encefálica, salvo en el caso de donación de órganos."
  }
};

export const LETModule = (() => {

  function init() {
    bindEvents();
    renderLETDisplay();
  }

  function bindEvents() {
    // Event delegation para botones LET
    const letContainer = $('#let-container');
    if (letContainer) {
      letContainer.addEventListener('click', handleLETClick);
    }

    // Modal LET
    $('#btnInfoLET')?.addEventListener('click', mostrarModalLET);
    $('#letModalClose')?.addEventListener('click', cerrarModalLET);
    $('#letOverlay')?.addEventListener('click', cerrarModalLET);

    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#letModal')?.classList.contains('active')) {
        cerrarModalLET();
      }
    });
  }

  function handleLETClick(event) {
    const button = event.target.closest('.let-btn');
    if (!button) return;

    const letValue = button.dataset.let;
    if (!letValue) return;

    seleccionarLET(letValue);
  }

  function seleccionarLET(letValue) {
    // Validar que el LET existe
    if (!LET_DATA[letValue]) {
      safeToast('Nivel LET no válido', 'error');
      return;
    }

    // Actualizar estado global
    const newState = { ...GlobalState };
    newState.let = letValue;
    StateManager.updateState(newState);

    // Actualizar UI
    actualizarBotonesLET(letValue);
    renderLETDisplay();

    safeToast(`LET ${letValue} seleccionado`, 'success');
  }

  function actualizarBotonesLET(letValue) {
    // Remover selección de todos los botones
    $$('.let-btn').forEach(btn => {
      btn.classList.remove('selected');
    });

    // Seleccionar el botón correspondiente
    const btnSeleccionado = $(`.let-btn[data-let="${letValue}"]`);
    if (btnSeleccionado) {
      btnSeleccionado.classList.add('selected');
    }
  }

  function renderLETDisplay() {
    const display = $('#letDisplay');
    const actitud = $('#letActitud');
    const aclaracion = $('#letAclaracion');

    if (!display || !actitud || !aclaracion) return;

    if (GlobalState.let && LET_DATA[GlobalState.let]) {
      const letData = LET_DATA[GlobalState.let];
      actitud.textContent = letData.actitud;
      aclaracion.textContent = letData.aclaracion;
      // Mostrar sin depender de DOMHelpers
      display.style.display = '';
    } else {
      // Ocultar sin depender de DOMHelpers
      display.style.display = 'none';
    }
  }

  function mostrarModalLET() {
    const modal = $('#letModal');
    const overlay = $('#letOverlay');
    const title = $('#letModalTitle');
    const content = $('#letModalContent');

    if (!modal || !overlay || !title || !content) {
      safeToast('Error al cargar información LET', 'error');
      return;
    }

    title.textContent = "Información completa - Limitación de Esfuerzo Terapéutico";

    let html = '';
    for (let i = 1; i <= 5; i++) {
      const data = LET_DATA[i];
      const isSelected = GlobalState.let === i.toString();
      const selectedClass = isSelected ? 'modal-section-selected' : '';

      html += `
        <div class="modal-section ${selectedClass}" data-let="${i}">
          <h4>${data.titulo}</h4>
          <p><strong>Actitud:</strong> ${data.actitud}</p>
          <p><strong>Aclaración:</strong> ${data.aclaracion}</p>
          ${isSelected ? '<div class="selected-badge">Seleccionado</div>' : ''}
        </div>
      `;
    }

    content.innerHTML = html;

    // Añadir event listeners a las secciones
    $$('.modal-section').forEach(section => {
      section.addEventListener('click', () => {
        const letValue = section.dataset.let;
        seleccionarLET(letValue);
        cerrarModalLET();
      });
    });

    modal.classList.add('active');
    overlay.classList.add('active');

    // Prevenir scroll del body
    document.body.style.overflow = 'hidden';
  }

  function cerrarModalLET() {
    const modal = $('#letModal');
    const overlay = $('#letOverlay');

    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');

    // Restaurar scroll del body
    document.body.style.overflow = '';
  }

  function deseleccionarLET() {
    const newState = { ...GlobalState };
    newState.let = null;
    StateManager.updateState(newState);

    // Actualizar UI
    $$('.let-btn').forEach(btn => {
      btn.classList.remove('selected');
    });

    const display = $('#letDisplay');
    if (display) display.style.display = 'none';

    safeToast('LET deseleccionado', 'info');
  }

  function getLETSeleccionado() {
    return GlobalState.let ? LET_DATA[GlobalState.let] : null;
  }

  function getTextoLET() {
    if (!GlobalState.let || !LET_DATA[GlobalState.let]) {
      return '';
    }
    const letData = LET_DATA[GlobalState.let];
    return `LET ${GlobalState.let}: ${letData.actitud}`;
  }

  function getLETParaImpresion() {
    if (!GlobalState.let || !LET_DATA[GlobalState.let]) {
      return { tieneLET: false, texto: '' };
    }

    const letData = LET_DATA[GlobalState.let];
    return {
      tieneLET: true,
      nivel: GlobalState.let,
      actitud: letData.actitud,
      aclaracion: letData.aclaracion,
      texto: `LET ${GlobalState.let} - ${letData.actitud}`
    };
  }

  function validarLET() {
    if (!GlobalState.let) {
      return { valido: true, mensaje: '' }; // LET es opcional
    }
    if (!LET_DATA[GlobalState.let]) {
      return { valido: false, mensaje: 'Nivel LET no válido' };
    }
    return { valido: true, mensaje: '' };
  }

  // Suscribirse a cambios de estado para actualizar la UI
  StateManager.subscribe((nuevoEstado, estadoAnterior, cambios) => {
    if (cambios.let !== undefined) {
      renderLETDisplay();
      // CORRECCIÓN FALLO 1 Y 2: Actualizar visualmente los botones
      actualizarBotonesLET(nuevoEstado.let); 
    }
  });

  return {
    init,
    seleccionar: seleccionarLET,
    deseleccionar: deseleccionarLET,
    mostrarModal: mostrarModalLET,
    cerrarModal: cerrarModalLET,
    getSeleccionado: getLETSeleccionado,
    getTexto: getTextoLET,
    getParaImpresion: getLETParaImpresion,
    validar: validarLET,
    getDatos: () => LET_DATA,
    getNivel: () => GlobalState.let
  };
})();

// Exportar para uso global
export default LETModule;
