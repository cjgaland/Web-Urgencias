// modules/export.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast, StorageHelpers, TextHelpers } from '../core/utils.js';

export const ExportModule = (() => {

    // --- Helpers para datos aleatorios ---
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randTime = () => `${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`;
    const randBool = () => randChoice([true, false]);
    
    // Normalizador (basado en tus módulos de paciente.js y dietas.js)
    const norm = (s) => (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .trim();
    // --- Fin Helpers ---
    
    function init() {
        bindEvents();
    }

    function bindEvents() {
        // Botones de exportación
        //$('#btnGuardar')?.addEventListener('click', exportJSON);
        $('#btnLimpiar')?.addEventListener('click', resetAll);
        
        // --- CORRECCIÓN: Eliminamos el listener de btnDemo ---
        // 'events.js' se encargará de este botón
        // $('#btnDemo')?.addEventListener('click', demoData); // <-- ELIMINADO
        
        // Botones de impresión
        $('#btnMedico')?.addEventListener('click', () => imprimir('medico'));
        $('#btnEnfermeria')?.addEventListener('click', () => imprimir('enfermeria'));
        
        // Importación
        $('#fileJSON')?.addEventListener('change', importJSON);

        // Botón de plantillas (NUEVO)
        $('#btnCargarPlantilla')?.addEventListener('click', cargarPlantillaDesdeJSON);
    }

    function exportJSON() {
        syncAllData();
        
        const data = {
            paciente: GlobalState.paciente,
            prescripciones: GlobalState.prescripciones,
            domicilio: GlobalState.domicilio,
            opcionales: GlobalState.opcionales,
            puntuales: GlobalState.puntuales,
            dietas: GlobalState.dietas,
            fluidos: GlobalState.fluidos,
            cuidados: GlobalState.cuidados,
            oxigenacion: GlobalState.oxigenacion, // Corregido de 'respiratorio' a 'oxigenacion' según tu state.js
            pruebas: GlobalState.pruebas,
            let: GlobalState.let,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

    function importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                cargarDatos(data);
                showToast('Datos cargados correctamente', 'success');
            } catch (err) {
                showToast('Error al cargar el archivo: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // *** NUEVA FUNCIÓN ***
    async function cargarPlantillaDesdeJSON() {
        if (!confirm('¿Cargar una plantilla? Los datos actuales se sobrescribirán.')) return;

        try {
            const response = await fetch('data/templates.json');
            if (!response.ok) {
                throw new Error(`No se encontró data/templates.json (Error ${response.status})`);
            }
            
            const plantillas = await response.json(); //
            
            if (!Array.isArray(plantillas) || plantillas.length === 0) {
                showToast('No se encontraron plantillas válidas en el archivo', 'warning');
                return;
            }

            // 1. Construir el mensaje del prompt
            let mensajePrompt = "Selecciona una plantilla para cargar:\n\n";
            plantillas.forEach((p, index) => {
                mensajePrompt += `${index + 1}: ${p.nombre || p.id}\n`; //
                if (p.descripcion) {
                    mensajePrompt += `   (${p.descripcion})\n`; //
                }
            });
            mensajePrompt += "\nIntroduce el número de la plantilla:";

            // 2. Pedir al usuario que elija
            const seleccion = prompt(mensajePrompt);
            if (!seleccion) return; // El usuario canceló

            const index = parseInt(seleccion, 10) - 1;

            // 3. Validar selección
            if (isNaN(index) || index < 0 || index >= plantillas.length) {
                showToast('Selección no válida', 'warning');
                return;
            }

            // 4. Cargar los datos
            const plantillaSeleccionada = plantillas[index];
            if (!plantillaSeleccionada.datos) { //
                showToast('La plantilla seleccionada no tiene datos válidos', 'error');
                return;
            }

            // Usamos la misma función 'cargarDatos' que usa importJSON
            cargarDatos(plantillaSeleccionada.datos); //
            
            showToast(`Plantilla "${plantillaSeleccionada.nombre || plantillaSeleccionada.id}" cargada`, 'success');

        } catch (err) {
            console.error('Error cargando la plantilla:', err);
            showToast(`Error al cargar plantillas: ${err.message}`, 'error');
        }
    }

    function cargarDatos(data) {
        // Actualizar estado global con los datos importados
        const newState = {
            paciente: data.paciente || { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' },
            prescripciones: data.prescripciones || [],
            domicilio: data.domicilio || [],
            opcionales: data.opcionales || [],
            puntuales: data.puntuales || [],
            dietas: data.dietas || [],
            fluidos: data.fluidos || [],
            cuidados: data.cuidados || [],
            // MODIFICADO: Aceptar 'oxigenacion' o 'respiratorio' y asegurar que sea un array
            oxigenacion: data.oxigenacion || data.respiratorio || [],
            pruebas: data.pruebas || [],
            let: data.let || null,
            editingIndex: -1,
            editingType: null
        };
        
        StateManager.updateState(newState);
        
        // Notificar a los módulos para que actualicen sus UIs
        // Esta es la forma correcta de refrescar la UI del paciente
        const pacMod = window.App?.getAllModules?.().paciente;
        if (pacMod && typeof pacMod.cargarDesdeEstado === 'function') {
            pacMod.cargarDesdeEstado(); //
        } else {
            // Fallback general
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('datosCargados'));
            }, 100);
        }
    }

    function syncAllData() {
        // Sincronizar datos de formularios con el estado global
        // (Tu módulo paciente no tiene 'sincronizar', pero lo dejamos por si acaso)
        if (window.PacienteModule?.sincronizar) PacienteModule.sincronizar(); 
    }

    function resetAll() {
        if (!confirm('¿Estás seguro de que quieres limpiar todos los datos?')) return;
        
        const defaultState = {
            paciente: { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' },
            prescripciones: [],
            domicilio: [],
            opcionales: [],
            puntuales: [],
            dietas: [],
            fluidos: [],
            cuidados: [],
            oxigenacion: [], // MODIFICADO: Debe ser un array
            pruebas: [],
            let: null,
            editingIndex: -1,
            editingType: null
        };
        
        StateManager.updateState(defaultState);
        
        // Limpiar formularios
        $('#pac_edad').value = '';
        $('#pac_sexo').value = '';
        $('#pac_peso').value = '';
        $('#pac_medico').value = '';
        $('#pac_area').value = '';
        $('#pac_fecha').value = new Date().toISOString().slice(0, 16);
        
        // Refrescar UI del paciente
        const pacMod = window.App?.getAllModules?.().paciente;
        if (pacMod && typeof pacMod.cargarDesdeEstado === 'function') {
            pacMod.cargarDesdeEstado(); //
        }

        showToast('Todos los datos han sido reseteados', 'info');
    }

    // *** FUNCIÓN `demoData` REEMPLAZADA ***
    function demoData() {
        if (!confirm('¿Cargar datos de demostración aleatorios? Se perderán los datos actuales.')) return;

        // --- Listas de datos (basadas en tus archivos .txt) ---
        const LISTA_MEDICOS = [
            'Aguilera Peña, Manuel', 'Caballero, Martín', 'Cabello, Ángel', 
            'Fernández Romero, Enrique', 'Galán Doval, Carlos Javier', 'García, Inma', 
            'Guerrero, Aurora M.', 'Gómez Martín, Isabel', 'Lomas, Marta'
        ]; //
        
        const LISTA_ESPECIALIDADES_TXT = [
            'Observación', 'UCI', 'Pediatría', 'Medicina Interna', 'Neumología', 
            'Digestivo', 'Cardiología', 'Cirugía General', 'Traumatología'
        ]; //
        
        const LISTA_ALERGIAS = ['Penicilina', 'AAS', 'Ibuprofeno', 'Contraste Yodado', 'Polen', 'Ácaros', 'Gatos'];
        
        const LISTA_FARMACOS = ['Paracetamol', 'Nolotil', 'Amoxicilina', 'Enantyum', 'Omeprazol', 'Sintrom', 'Adiro', 'Furosemida'];
        const LISTA_DOSIS = ['1 g', '575 mg', '500 mg', '25 mg', '20 mg', '4 mg', '100 mg', '40 mg'];
        
        const LISTA_VIAS = [
            'Oral', 'Venosa periférica', 'Venosa Central', 
            'Intramuscular', 'Subcutanea', 'Inhalada'
        ]; //
        
        const LISTA_PAUTAS_TXT = [
            'Cada 4 horas', 'Cada 6 horas', 'Cada 8 horas', 
            'Cada 12 horas', 'Cada 24 horas', 'Si precisa'
        ]; //
        
        // Mapeamos pautas a sus valores normalizados (como en prescripciones.js)
        const MAPA_PAUTAS = {
            'Cada 4 horas': 'q4', 'Cada 6 horas': 'q6', 'Cada 8 horas': 'q8',
            'Cada 12 horas': 'q12', 'Cada 24 horas': 'q24', 'Si precisa': 'prn'
        };
        
        const LISTA_DIETAS = ['Absoluta', 'Normal', 'Diabética', 'Hiposódica', 'Protección biliar']; //
        const LISTA_CONSISTENCIAS = ['Líquida', 'Triturada', 'Fácil masticación', 'Astringente', 'Sin residuos']; //
        const LISTA_INTOLERANCIAS = ['Lactosa', 'Huevo', 'Frutos secos', 'Marisco', 'Fructosa']; //
        
        const LISTA_SOLUCIONES = ['Fisiológico', 'Glucosalino', 'Glucosado 5%', 'Ringer-Lactado', 'Gelafundina']; //
        
        // Listas adicionales para los nuevos módulos
        const LISTA_COND_OPC = ['fiebre', 'dolor', 'agitacion', 'nauseas', 'ta']; //
        const LISTA_COND_PUN = ['ahora', 'preprueba', 'postprueba']; //
        const LISTA_OX_VENTI = ['33%', '40%', '50%', 'Con bolsa reservorio']; //
        const LISTA_VMNI_TIPO = ['oaf', 'cpap', 'bipap']; //
        const LISTA_DIURESIS = ['miccional', 'horaria', 'c4h', 'c6h', 'c8h', 'c12h', '24h']; //
        // --- Fin Listas ---

        // 1. Paciente (Existente)
        const medicoRnd = randChoice(LISTA_MEDICOS);
        const areaRnd = randChoice(LISTA_ESPECIALIDADES_TXT);
        const numAlergias = randInt(0, 2);
        const alergiasRnd = [];
        for (let i = 0; i < numAlergias; i++) {
            alergiasRnd.push(randChoice(LISTA_ALERGIAS));
        }

        // 2. Prescripciones (Existente)
        const prescripcionesRnd = [];
        const numPrescripciones = randInt(1, 4);
        for (let i = 0; i < numPrescripciones; i++) {
            const farmacoRnd = randChoice(LISTA_FARMACOS);
            const pautaTxtRnd = randChoice(LISTA_PAUTAS_TXT);
            prescripcionesRnd.push({
                farmaco: farmacoRnd,
                dosis: randChoice(LISTA_DOSIS),
                via: randChoice(LISTA_VIAS),
                pauta: MAPA_PAUTAS[pautaTxtRnd] || 'q24', //
                inicio: randTime(),
                dias: randInt(1, 7),
                indicacion: randChoice(['Dolor', 'Fiebre', 'Infección', 'Profilaxis', '']),
                obs: ''
            });
        }
        
        // 3. Dieta (Existente)
        const dietaRnd = randChoice(LISTA_DIETAS);
        const consRnd = randChoice(LISTA_CONSISTENCIAS);
        const dietaDemo = [{
            tipo: norm(dietaRnd), //
            tipo_text: dietaRnd,
            consistencia: (dietaRnd === 'Absoluta') ? '' : norm(consRnd), //
            consistencia_text: (dietaRnd === 'Absoluta') ? '' : consRnd,
            celiaquia: randChoice(['no', 'si', 'sensibilidad']),
            intolerancias: randBool() ? [norm(randChoice(LISTA_INTOLERANCIAS))] : [], //
            observaciones: 'Dieta de ejemplo aleatoria'
        }];

        // 4. Fluido (Existente)
        const volRnd = randChoice([500, 1000, 1500, 2000]);
        const pautaFluidoTxt = randChoice(['Cada 8 horas', 'Cada 12 horas', 'Cada 24 horas']);
        const pautaFluidoNorm = norm(pautaFluidoTxt.replace(' ', '_')); //
        const horasMatch = pautaFluidoTxt.match(/\d+/);
        const horas = horasMatch ? parseInt(horasMatch[0]) : 24;
        const ritmoRnd = Math.round(volRnd / horas);
        const fluidoDemo = [{
            via: 'con', //
            solucion: norm(randChoice(LISTA_SOLUCIONES)), //
            volumen: volRnd,
            frecuencia: pautaFluidoNorm,
            ritmo: ritmoRnd,
            obs: ''
        }];

        // 5. Domicilio (NUEVO)
        const domicilioRnd = [];
        if (randBool()) {
            domicilioRnd.push({
                farmaco: randChoice(LISTA_FARMACOS),
                dosis: randChoice(LISTA_DOSIS),
                via: 'Oral', //
                freq: randChoice(LISTA_PAUTAS_TXT), //
                inicio: randTime(),
                dias: randInt(7, 30),
                indicacion: 'Tratamiento crónico',
                obs: ''
            });
        }

        // 6. Opcionales (NUEVO)
        const opcionalesRnd = [];
        if (randBool()) {
            opcionalesRnd.push({
                condicion: randChoice(LISTA_COND_OPC), //
                farmaco: 'Paracetamol',
                dosis: '1 g',
                via: 'Oral',
                freqmax: 'q8', //
                obs: 'Máximo 4g/día'
            });
        }

        // 7. Puntuales (NUEVO)
        const puntualesRnd = [];
        if (randBool()) {
            puntualesRnd.push({
                farmaco: 'Urbason',
                dosis: '40 mg',
                via: 'Venosa periférica',
                indicacion: 'Reacción alérgica',
                cuando: 'ahora', //
                obs: ''
            });
        }

        // 8. Respiratorio (NUEVO) -> AHORA ES 'oxigenacion'
        const oxigenacionRnd = []; // MODIFICADO: Clave y tipo
        const useAero = randBool();
        const useVMNI = !useAero && randBool();
        
        oxigenacionRnd.push({ // MODIFICADO: Clave
            oxigeno: randChoice(['si', 'no']),
            dispositivo: randChoice(['gafas_nasales', 'ventimask']),
            litros: randChoice(['2', '3', '4']),
            porcentaje: randChoice(LISTA_OX_VENTI),
            aerosol: useAero ? 'si' : 'no',
            aerosoles: {
                salbutamol: { use: useAero && randBool(), dosis: '5 mg', pauta: 'Cada 6 horas' },
                ipratropio: { use: useAero && randBool(), dosis: '0.5 mg', pauta: 'Cada 8 horas' },
                budesonida: { use: false, dosis: '', pauta: '' },
            }, //
            vmni: useVMNI ? 'si' : 'no',
            tipo: useVMNI ? randChoice(LISTA_VMNI_TIPO) : '',
            vmniParams: {
                oaf_flujo: randInt(5, 15).toString(),
                cpap_ipap: randInt(5, 12).toString(),
                bipap_ipap: randInt(12, 20).toString(),
                bipap_epap: randInt(4, 8).toString(),
                bipap_ie: '1:2'
            }, //
            obs: 'Vigilar patrón respiratorio'
        });

        // 9. Cuidados (NUEVO)
        const cuidadosRnd = [];
        cuidadosRnd.push({
            general: ['Cama cabecero elevado', 'Barandillas elevadas'], //
            diuresis: { si: true, tipo: randChoice(LISTA_DIURESIS) }, //
            depos: randBool(), //
            mon: true, //
            intermitente: {
                ta: { use: true, pauta: 'Cada 6 horas' },
                temp: { use: true, pauta: 'Cada 8 horas' },
                fc: { use: false, pauta: '' },
                sat: { use: true, pauta: 'Cada 6 horas' },
                glu: { use: randBool(), pauta: 'Cada 8 horas' },
                gcs: { use: false, pauta: '' }
            }, //
            continua: {
                ecg: randBool(),
                sat: randBool(),
                fc: false,
                ta: false
            }, //
            obs: 'Control de constantes y diuresis.'
        });

        // 10. Pruebas (NUEVO)
        const pruebasRnd = [];
        pruebasRnd.push({
            analiticas: { hemo: randBool(), bioq: true, coag: true, orina: randBool(), hemoc: false, uroc: false }, //
            radiologia: { simple: randBool(), eco: randBool(), tac_c: false, tac_s: randBool(), rmn: false }, //
            otras: { eda: false, colo: false, bronco: false }, //
            hojasConsulta: [randChoice(LISTA_ESPECIALIDADES_TXT)], //
            obs: 'Realizar pruebas en ayunas.'
        });


        // Construir el estado final
        const demoState = {
            paciente: {
                edad: randInt(20, 95),
                sexo: randChoice(['M', 'F']), //
                peso: randInt(50, 110),
                alergias: [...new Set(alergiasRnd)],
                medico: medicoRnd,
                area: norm(areaRnd), //
                fecha: new Date().toISOString().slice(0, 16),
                insuf_renal: randChoice(['no', 'si']), //
                insuf_hepatica: randChoice(['no', 'si']) //
            },
            prescripciones: prescripcionesRnd,
            dietas: dietaDemo,
            fluidos: fluidoDemo,
            let: randChoice(['1', '2', '3', '4', '5', null]), //
            
            // --- NUEVOS MÓDULOS ---
            domicilio: domicilioRnd,
            opcionales: opcionalesRnd,
            puntuales: puntualesRnd,
            cuidados: cuidadosRnd,
            pruebas: pruebasRnd,
            
            // --- CORRECCIÓN IMPORTANTE ---
            // Usamos la clave 'oxigenacion' y le pasamos el array
            oxigenacion: oxigenacionRnd, // <--- MODIFICADO
            
            editingIndex: -1,
            editingType: null
        };
        
        // --- CORRECCIÓN: Usamos cargarDatos para el refresco ---
        // 'cargarDatos' ya contiene la lógica para actualizar el estado
        // y notificar a los módulos (como paciente) para que refresquen su UI.
        cargarDatos(demoState); //

        showToast('Datos aleatorios de demostración cargados', 'success');
    }

    function imprimir(tipo) {
        syncAllData();
        
        // Preparar clases para impresión
        document.body.classList.remove('print-medico', 'print-enfermeria');
        document.body.classList.add(`print-${tipo}`);
        
        // Esperar un frame para que se apliquen los estilos
        setTimeout(() => {
            window.print();
            
            // Limpiar clases después de imprimir
            setTimeout(() => {
                document.body.classList.remove('print-medico', 'print-enfermeria');
            }, 1000);
        }, 100);
    }

    function guardarEnHistorial(data) {
        const historial = StorageHelpers.get('tratamientosHistorial', []);
        
        const entradaHistorial = {
            timestamp: data.timestamp,
            paciente: {
                hisclin: data.paciente.hisclin,
                edad: data.paciente.edad,
                sexo: data.paciente.sexo,
                medico: data.paciente.medico
            },
            numPrescripciones: data.prescripciones.length,
            numDietas: data.dietas.length
        };
        
        historial.unshift(entradaHistorial);
        
        // Mantener solo los últimos 50
        if (historial.length > 50) {
            historial.length = 50;
        }
        
        StorageHelpers.set('tratamientosHistorial', historial);
    }

    function getEstadoCompleto() {
        syncAllData();
        return { ...GlobalState };
    }

    return {
        init,
        exportar: exportJSON,
        importar: importJSON,
        reset: resetAll,
        demo: demoData,
        imprimir,
        getEstado: getEstadoCompleto,
        // Hacemos 'cargarDatos' accesible internamente si es necesario
        cargarDatos: cargarDatos 
    };
})();

export default ExportModule;