// modules/historial.js
import { select as $, selectAll as $$, showToast, StorageHelpers } from '../core/utils.js';

export const HistorialModule = (() => {
    
    function init() {
        bindEvents();
    }

    function bindEvents() {
        $('#btnHistorial')?.addEventListener('click', mostrarModalHistorial);
        $('#historialModalClose')?.addEventListener('click', cerrarModalHistorial);
        $('#historialOverlay')?.addEventListener('click', cerrarModalHistorial);
        $('#btnLimpiarHistorial')?.addEventListener('click', limpiarHistorial);
    }

    function mostrarModalHistorial() {
        const historial = StorageHelpers.get('tratamientosHistorial', []);
        const lista = $('#historialLista');
        
        if (!lista) return;
        
        if (historial.length === 0) {
            lista.innerHTML = '<p style="text-align:center;color:#64748b">No hay tratamientos guardados en el historial</p>';
        } else {
            lista.innerHTML = historial.map((item, idx) => `
                <div class="historial-item" data-index="${idx}">
                    <div class="historial-fecha">${formatearFecha(item.timestamp)}</div>
                    <div class="historial-info">
                        ${item.paciente.hisclin ? item.paciente.hisclin + '' : 'Historia no especificada'} | 
                        ${item.paciente.edad ? item.paciente.edad + ' años' : 'Edad no especificada'} | 
                        ${item.paciente.medico || 'Médico no especificado'} |
                    </div>
                    <div class="historial-acciones">
                        <button class="btn btn-sm" data-action="cargar-historial" data-index="${idx}" title="Cargar tratamiento">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm danger" data-action="eliminar-historial" data-index="${idx}" title="Eliminar del historial">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            // Añadir event listeners a los botones
            lista.addEventListener('click', handleHistorialClick);
        }
        
        $('#historialModal').classList.add('active');
        $('#historialOverlay').classList.add('active');
    }

    function handleHistorialClick(event) {
        const button = event.target.closest('button');
        if (!button) return;
        
        const action = button.dataset.action;
        const index = parseInt(button.dataset.index);
        
        if (action === 'cargar-historial') {
            cargarDelHistorial(index);
        } else if (action === 'eliminar-historial') {
            eliminarDelHistorial(index);
        }
    }

    function cargarDelHistorial(index) {
        const historial = StorageHelpers.get('tratamientosHistorial', []);
        if (!historial[index]) {
            showToast('Elemento del historial no encontrado', 'error');
            return;
        }
        
        // En una implementación real, aquí cargaríamos los datos completos
        // Por ahora solo mostramos un mensaje
        showToast('Funcionalidad de carga completa en desarrollo', 'info');
        cerrarModalHistorial();
    }

    function eliminarDelHistorial(index) {
        if (!confirm('¿Eliminar este tratamiento del historial?')) return;
        
        const historial = StorageHelpers.get('tratamientosHistorial', []);
        historial.splice(index, 1);
        StorageHelpers.set('tratamientosHistorial', historial);
        
        mostrarModalHistorial(); // Refrescar la vista
        showToast('Tratamiento eliminado del historial', 'info');
    }

    function limpiarHistorial() {
        if (!confirm('¿Eliminar todo el historial? Esta acción no se puede deshacer.')) return;
        
        StorageHelpers.remove('tratamientosHistorial');
        mostrarModalHistorial();
        showToast('Historial eliminado completamente', 'info');
    }

    function cerrarModalHistorial() {
        $('#historialModal').classList.remove('active');
        $('#historialOverlay').classList.remove('active');
    }

    function formatearFecha(timestamp) {
        return new Date(timestamp).toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getHistorial() {
        return StorageHelpers.get('tratamientosHistorial', []);
    }

    return {
        init,
        mostrar: mostrarModalHistorial,
        cerrar: cerrarModalHistorial,
        limpiar: limpiarHistorial,
        getHistorial
    };
})();

export default HistorialModule;