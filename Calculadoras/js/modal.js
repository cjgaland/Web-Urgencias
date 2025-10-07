// /Calculadoras/js/modal.js - VERSIÓN MEJORADA
function abrirCalculadora(ruta) {
    // Prevenir el comportamiento por defecto del enlace
    event.preventDefault();
    
    // Verificar si el archivo existe primero
    const rutaCompleta = ruta;
    console.log('📍 Intentando abrir:', rutaCompleta);
    
    // Usar un pequeño retraso para asegurar que es una acción directa del usuario
    setTimeout(() => {
        try {
            // Intentar abrir la ventana emergente
            const ventana = window.open(rutaCompleta, 'CalculadoraMedica', 
                'width=700,height=800,scrollbars=yes,resizable=yes,location=no,toolbar=no');
            
            if (ventana) {
                console.log('✅ Ventana abierta correctamente');
                ventana.focus();
                
                // Verificar si la ventana se cargó correctamente
                ventana.addEventListener('load', function() {
                    console.log('✅ Calculadora cargada en ventana emergente');
                });
                
                ventana.addEventListener('error', function() {
                    console.error('❌ Error al cargar la calculadora');
                    // Fallback: abrir en pestaña nueva
                    window.open(rutaCompleta, '_blank');
                });
                
            } else {
                console.warn('⚠️ El navegador bloqueó la ventana emergente');
                
                // Fallback 1: Pedir permiso al usuario
                if (confirm('Para abrir la calculadora en ventana emergente, necesitas permitir pop-ups. ¿Quieres abrirla en una pestaña nueva en su lugar?')) {
                    window.open(rutaCompleta, '_blank');
                }
            }
        } catch (error) {
            console.error('❌ Error al abrir ventana:', error);
            // Fallback 2: Abrir en pestaña nueva
            window.open(rutaCompleta, '_blank');
        }
    }, 100);
    
    return false;
}