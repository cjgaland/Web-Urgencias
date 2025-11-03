// modules/fluidos.js
import { GlobalState, StateManager, StateActions } from '../core/state.js';
import { select as $, selectAll as $$, showToast, DOMHelpers, TextHelpers } from '../core/utils.js';
import DataLoader from './data-loader.js';

export const FluidosModule = (() => {
  const moduleState = {
    editingIndex: -1
  };

  async function init() {
    await cargarDatosFluidos();
    bindEvents();
    // Ocultar campos según la selección inicial
    toggleCamposSolucion();
    renderTable();
  }

  async function cargarDatosFluidos() {
    try {
      const [soluciones, pautas] = await Promise.all([
        DataLoader.cargarSoluciones?.(),
        DataLoader.cargarPautas?.()
      ]);
      
      llenarSelectSoluciones(soluciones || []);
      llenarSelectFrecuencia(pautas || []);
    } catch (error) {
      console.error('Error cargando datos de fluidos:', error);
      showToast('Error cargando datos disponibles', 'error');
    }
  }

  function llenarSelectSoluciones(soluciones) {
    const select = $('#fluido_solucion');
    if (!select) return;

    // Guardar la opción seleccionada actual si existe
    const valorActual = select.value;
    
    // Limpiar y volver a llenar el select
    select.innerHTML = '<option value="">Seleccionar solución...</option>';
    
    soluciones.forEach(solucion => {
      const option = document.createElement('option');
      option.value = normalizarTexto(solucion);
      option.textContent = solucion;
      select.appendChild(option);
    });
    
    // Restaurar la opción seleccionada si todavía existe
    if (valorActual && select.querySelector(`option[value="${valorActual}"]`)) {
      select.value = valorActual;
    }
  }

  function llenarSelectFrecuencia(pautas) {
    const select = $('#fluido_frecuencia');
    if (!select) return;

    // Guardar la opción seleccionada actual si existe
    const valorActual = select.value;
    
    // Limpiar y volver a llenar el select
    select.innerHTML = '<option value="">Seleccionar...</option>';
    
    pautas.forEach(pauta => {
      const option = document.createElement('option');
      option.value = normalizarTexto(pauta);
      option.textContent = pauta;
      select.appendChild(option);
    });
    
    // Restaurar la opción seleccionada si todavía existe
    if (valorActual && select.querySelector(`option[value="${valorActual}"]`)) {
      select.value = valorActual;
    }
  }

  function normalizarTexto(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, ''); // Eliminar caracteres especiales
  }

  function bindEvents() {
  const fluidosCard = $('#fluidos-card');
  if (fluidosCard) {
    fluidosCard.addEventListener('click', handleFluidosClick);
    fluidosCard.addEventListener('change', handleFluidosChange);
    fluidosCard.addEventListener('input', handleFluidosInput);
  }

  // Mostrar/ocultar campos según vía seleccionada
  const viaSelect = $('#fluido_via');
  if (viaSelect) {
    viaSelect.addEventListener('change', function() {
      toggleCamposSolucion();
      // Limpiar campos cuando no son "Con vía"
      if (this.value !== 'con') {
        DOMHelpers.setValue('#fluido_solucion', '');
        DOMHelpers.setValue('#fluido_ritmo', '');
      }
      // Si cambiamos a "con vía", intentar calcular el ritmo si hay datos
      if (this.value === 'con') {
        setTimeout(() => {
          calcularRitmoAutomatico();
        }, 100);
      }
    });
  }
}

  function handleFluidosClick(event) {
    const target = event.target;
    const button = target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const index = button.dataset.index ? parseInt(button.dataset.index, 10) : null;

    switch (action) {
      case 'edit-fluido':
        if (index !== null) editarFluido(index);
        break;
      case 'delete-fluido':
        if (index !== null) eliminarFluido(index);
        break;
      case 'calcular-ritmo':
        calcularRitmoAutomatico();
        break;
      default:
        // Botones de la cabecera (por id) los maneja events.js llamando a nuestras funciones públicas
        break;
    }
  }

  function handleFluidosChange(event) {
    const target = event.target;
    if ((target.id === 'fluido_volumen' || target.id === 'fluido_frecuencia') && 
        $('#fluido_via').value === 'con') {
      calcularRitmoAutomatico();
    }
  }

  function handleFluidosInput(event) {
    if (event.target.id === 'fluido_volumen' || event.target.id === 'fluido_ritmo') {
      validarCampoNumerico(event.target);
    }
  }

  function toggleCamposSolucion() {
  const via = $('#fluido_via').value;
  
  // Contenedores que deben mostrarse solo con "Con vía"
  const contenedoresConVia = [
    '#campos_fila_superior',
    '#campos_fila_inferior'
  ];
  
  // Mostrar/ocultar contenedores
  contenedoresConVia.forEach(selector => {
    const contenedor = $(selector);
    if (contenedor) {
      if (via === 'con') {
        contenedor.style.display = 'contents'; // Esto hace que los hijos se comporten como si el contenedor no existiera
      } else {
        contenedor.style.display = 'none';
      }
    }
  });
}
  function validarCampoNumerico(campo) {
    const valor = campo.value;
    if (valor && (isNaN(parseFloat(valor)) || parseFloat(valor) <= 0)) {
      campo.classList.add('error');
    } else {
      campo.classList.remove('error');
    }
  }

  function addFluido() {
    const via = $('#fluido_via').value;
    const solucion = $('#fluido_solucion').value;
    const volumen = $('#fluido_volumen').value;
    const frecuencia = $('#fluido_frecuencia').value;
    const ritmo = $('#fluido_ritmo').value;
    const obs = ($('#fluido_obs')?.value || '').trim();

    if (!validarFluido(via, solucion, volumen, frecuencia, ritmo)) {
      return;
    }

    const item = {
      via,
      solucion: via === 'con' ? solucion : '',
      volumen,
      frecuencia,
      ritmo: via === 'con' ? ritmo : '',
      obs
    };

    StateActions.addToArray('fluidos', item);
    limpiarFormulario();
    renderTable();
    showToast('Fluidoterapia añadida correctamente', 'success');
  }

  function editarFluido(index) {
    const fluido = GlobalState.fluidos[index];
    if (!fluido) return;

    DOMHelpers.setValue('#fluido_via', fluido.via);
    DOMHelpers.setValue('#fluido_solucion', fluido.solucion || '');
    DOMHelpers.setValue('#fluido_volumen', fluido.volumen);
    DOMHelpers.setValue('#fluido_frecuencia', fluido.frecuencia);
    DOMHelpers.setValue('#fluido_ritmo', fluido.ritmo || '');
    DOMHelpers.setValue('#fluido_obs', fluido.obs || '');

    toggleCamposSolucion();

    DOMHelpers.hideElement('#btnAddFluido');
    DOMHelpers.showElement('#btnUpdateFluido');
    DOMHelpers.showElement('#btnCancelEditFluido');

    moduleState.editingIndex = index;
  }

  function actualizarFluido() {
    if (moduleState.editingIndex === -1) return;

    const via = $('#fluido_via').value;
    const solucion = $('#fluido_solucion').value;
    const volumen = $('#fluido_volumen').value;
    const frecuencia = $('#fluido_frecuencia').value;
    const ritmo = $('#fluido_ritmo').value;
    const obs = ($('#fluido_obs')?.value || '').trim();

    if (!validarFluido(via, solucion, volumen, frecuencia, ritmo)) {
      return;
    }

    const item = {
      via,
      solucion: via === 'con' ? solucion : '',
      volumen,
      frecuencia,
      ritmo: via === 'con' ? ritmo : '',
      obs
    };

    StateActions.updateInArray('fluidos', moduleState.editingIndex, item);
    cancelarEdicion();
    renderTable();
    showToast('Fluidoterapia actualizada correctamente', 'success');
  }

  function validarFluido(via, solucion, volumen, frecuencia, ritmo) {
    if (!via) { showToast('Selecciona una vía', 'warning'); return false; }
    if (via === 'con' && !solucion) { showToast('Selecciona una solución para vía continua', 'warning'); return false; }
    if (!volumen) { showToast('Introduce el volumen', 'warning'); return false; }

    const volumenNum = parseFloat(volumen);
    if (isNaN(volumenNum) || volumenNum <= 0) { showToast('El volumen debe ser un número positivo', 'warning'); return false; }

    if (!frecuencia) { showToast('Selecciona una frecuencia', 'warning'); return false; }

    if (via === 'con') {
      if (!ritmo) { showToast('Introduce el ritmo de infusión', 'warning'); return false; }
      const ritmoNum = parseFloat(ritmo);
      if (isNaN(ritmoNum) || ritmoNum <= 0) { showToast('El ritmo debe ser un número positivo', 'warning'); return false; }
    }

    return true;
  }

  function calcularRitmoAutomatico() {
    const via = $('#fluido_via').value;
    // Solo calcular si la vía es "con"
    if (via !== 'con') return;

    const volumen = parseFloat($('#fluido_volumen').value);
    const frecuencia = $('#fluido_frecuencia').value;

    if (!volumen || !frecuencia || isNaN(volumen)) return;

    // Mapeo de frecuencias a horas (usando las opciones cargadas desde pauta.txt)
    const horasPorFrecuencia = {
      'ahora': 0.1, // Valor pequeño para "ahora"
      '1h': 1, '2h': 2, '4h': 4, '6h': 6,
      '8h': 8, '12h': 12, '24h': 24,
      'cada_1_hora': 1, 'cada_2_horas': 2, 'cada_4_horas': 4, 'cada_6_horas': 6,
      'cada_8_horas': 8, 'cada_12_horas': 12, 'cada_24_horas': 24
    };

    const horas = horasPorFrecuencia[frecuencia];
    if (horas && horas > 0) {
      const ritmo = Math.round(volumen / horas);
      DOMHelpers.setValue('#fluido_ritmo', ritmo);
      showToast(`Ritmo calculado: ${ritmo} ml/h`, 'info', 2000);
    }
  }

  function eliminarFluido(index) {
    StateActions.removeFromArray('fluidos', index);
    renderTable();
    showToast('Fluidoterapia eliminada', 'info');
  }

  function vaciarFluidos() {
    StateActions.clearArray('fluidos');
    renderTable();
    showToast('Fluidoterapia vaciada', 'info');
  }

  function renderTable() {
    const tbody = $('#tablaFluidos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!Array.isArray(GlobalState.fluidos) || GlobalState.fluidos.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align: center; color: #64748b;">No hay fluidoterapia registrada</td>`;
      tbody.appendChild(tr);
      return;
    }

    GlobalState.fluidos.forEach((fluido, idx) => {
      const esContinua = fluido.via === 'con';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${esContinua ? 'Continua' : 'Intermitente'}</td>
        <td>${fluido.solucion ? TextHelpers.solucionText(fluido.solucion) : 'N/A'}</td>
        <td>${fluido.volumen} ml</td>
        <td>${TextHelpers.frecuenciaText(fluido.frecuencia)}</td>
        <td>${esContinua ? `${fluido.ritmo} ml/h` : 'N/A'}</td>
        <td>${fluido.obs ? fluido.obs : '-'}</td>
        <td>
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn btn-sm edit"
                    data-action="edit-fluido"
                    data-index="${idx}"
                    title="Editar fluidoterapia">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm danger"
                    data-action="delete-fluido"
                    data-index="${idx}"
                    title="Eliminar fluidoterapia">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function limpiarFormulario() {
  DOMHelpers.setValue('#fluido_via', 'sin'); // Cambiar a "Sin vía" por defecto
  DOMHelpers.setValue('#fluido_solucion', '');
  DOMHelpers.setValue('#fluido_volumen', '');
  DOMHelpers.setValue('#fluido_frecuencia', '');
  DOMHelpers.setValue('#fluido_ritmo', '');
  DOMHelpers.setValue('#fluido_obs', '');

  // Forzar la actualización del layout según la vía seleccionada
  toggleCamposSolucion();

  $$('#fluidos-card .error').forEach(el => el.classList.remove('error'));
}

  function cancelarEdicion() {
    limpiarFormulario();

    DOMHelpers.showElement('#btnAddFluido');
    DOMHelpers.hideElement('#btnUpdateFluido');
    DOMHelpers.hideElement('#btnCancelEditFluido');

    moduleState.editingIndex = -1;
  }

  function getFluidosParaImpresion() {
    return GlobalState.fluidos.map(fluido => {
      const esContinua = fluido.via === 'con';
      return {
        tipo: esContinua ? 'Continua' : 'Intermitente',
        solucion: fluido.solucion ? TextHelpers.solucionText(fluido.solucion) : '',
        volumen: `${fluido.volumen} ml`,
        frecuencia: TextHelpers.frecuenciaText(fluido.frecuencia),
        ritmo: esContinua ? `${fluido.ritmo} ml/h` : 'N/A',
        observaciones: fluido.obs || '',
        // 👇 JSHint friendly: ternario en una sola línea y entre paréntesis
        texto: (esContinua ? `${TextHelpers.solucionText(fluido.solucion)} ${fluido.volumen} ml ${TextHelpers.frecuenciaText(fluido.frecuencia)} a ${fluido.ritmo} ml/h`
                          : `${TextHelpers.solucionText(fluido.solucion)} ${fluido.volumen} ml ${TextHelpers.frecuenciaText(fluido.frecuencia)}`)
      };
    });
  }

  function getResumenFluidos() {
    const continuos = GlobalState.fluidos.filter(f => f.via === 'con');
    const intermitentes = GlobalState.fluidos.filter(f => f.via !== 'con');

    return {
      total: GlobalState.fluidos.length,
      continuos: continuos.length,
      intermitentes: intermitentes.length,
      volumenTotal: GlobalState.fluidos.reduce((total, f) => total + parseFloat(f.volumen || 0), 0)
    };
  }

  return {
    init,

    // Alias que espera events.js
    addFluido,
    updateFluido: actualizarFluido,
    cancelarEdicion,

    // API adicional
    add: addFluido,
    editar: editarFluido,
    eliminar: eliminarFluido,
    vaciar: vaciarFluidos,
    calcularRitmo: calcularRitmoAutomatico,

    getFluidos: () => [...GlobalState.fluidos],
    getParaImpresion: getFluidosParaImpresion,
    getResumen: getResumenFluidos,
    setFluidos: (nuevosFluidos) => {
      const newState = { ...GlobalState };
      newState.fluidos = nuevosFluidos;
      StateManager.updateState(newState);
      renderTable();
    }
  };
})();

export default FluidosModule;