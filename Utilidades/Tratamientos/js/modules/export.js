// modules/export.js
import { GlobalState, StateManager } from '../core/state.js';
import { select as $, selectAll as $$, showToast, StorageHelpers } from '../core/utils.js';

export const ExportModule = (() => {

    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randTime = () => `${String(randInt(0, 23)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`;
    // Mantenemos randBool siempre true para asegurar que se generen datos en las tablas
    const randBool = () => true; 
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').trim();
    
    function init() {
        bindEvents();
    }

    function bindEvents() {
        $('#btnLimpiar')?.addEventListener('click', resetAll);
        $('#btnMedico')?.addEventListener('click', () => imprimir('medico'));
        $('#btnEnfermeria')?.addEventListener('click', () => imprimir('enfermeria'));
        $('#fileJSON')?.addEventListener('change', importJSON);
        $('#btnCargarPlantilla')?.addEventListener('click', cargarPlantillaDesdeJSON);
    }

    function exportJSON() {
        const data = { ...GlobalState, timestamp: new Date().toISOString(), version: '1.0' };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `tratamiento-${new Date().toISOString().slice(0,10)}.json`;
        a.click(); URL.revokeObjectURL(url);
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
            } catch (err) { showToast('Error al cargar archivo', 'error'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    async function cargarPlantillaDesdeJSON() {
        if (!confirm('¿Cargar una plantilla? Los datos actuales se sobrescribirán.')) return;
        try {
            const response = await fetch('data/templates.json');
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const plantillas = await response.json();
            if (!plantillas.length) { showToast('No hay plantillas', 'warning'); return; }

            let msg = "Selecciona una plantilla:\n\n";
            plantillas.forEach((p, i) => { msg += `${i + 1}: ${p.nombre || p.id}\n`; });
            msg += "\nNº de plantilla:";
            const sel = prompt(msg);
            if (!sel) return;
            const index = parseInt(sel, 10) - 1;
            if (isNaN(index) || index < 0 || index >= plantillas.length) { showToast('Selección no válida', 'warning'); return; }
            cargarDatos(plantillas[index].datos);
            showToast('Plantilla cargada', 'success');
        } catch (err) { console.error(err); showToast('Error cargando plantilla', 'error'); }
    }

    function cargarDatos(data) {
        const newState = {
            paciente: data.paciente || { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' },
            prescripciones: data.prescripciones || [],
            domicilio: data.domicilio || [],
            opcionales: data.opcionales || [],
            puntuales: data.puntuales || [],
            dietas: data.dietas || [],
            fluidos: data.fluidos || [],
            cuidados: data.cuidados || [],
            oxigenacion: data.oxigenacion || data.respiratorio || [],
            pruebas: data.pruebas || [],
            let: data.let || null,
            editingIndex: -1,
            editingType: null
        };
        StateManager.updateState(newState);
        
        // Refrescar formulario paciente explícitamente
        const pacMod = window.App?.getAllModules?.().paciente;
        if (pacMod && typeof pacMod.cargarDesdeEstado === 'function') pacMod.cargarDesdeEstado();
    }

    function resetAll() {
        if (!confirm('¿Estás seguro de que quieres limpiar todos los datos?')) return;
        const defaultState = {
            paciente: { alergias: [], insuf_renal: 'no', insuf_hepatica: 'no' },
            prescripciones: [], domicilio: [], opcionales: [], puntuales: [],
            dietas: [], fluidos: [], cuidados: [], oxigenacion: [], pruebas: [],
            let: null, editingIndex: -1, editingType: null
        };
        StateManager.updateState(defaultState);
        
        if ($('#pac_hisclin')) $('#pac_hisclin').value = '';
        if ($('#pac_edad')) $('#pac_edad').value = '';
        if ($('#pac_sexo')) $('#pac_sexo').value = '';
        if ($('#pac_peso')) $('#pac_peso').value = '';
        if ($('#pac_medico')) $('#pac_medico').value = '';
        if ($('#pac_area')) $('#pac_area').value = '';
        if ($('#pac_fecha')) $('#pac_fecha').value = new Date().toISOString().slice(0, 16);
        
        $$('.let-btn').forEach(btn => btn.classList.remove('selected'));
        if ($('#letDisplay')) $('#letDisplay').style.display = 'none';
        $$('.si-no-btn').forEach(btn => btn.classList.remove('selected'));
        $$('.si-no-btn[data-valor="no"]').forEach(btn => btn.classList.add('selected'));

        const pacMod = window.App?.getAllModules?.().paciente;
        if (pacMod && typeof pacMod.cargarDesdeEstado === 'function') pacMod.cargarDesdeEstado();

        showToast('Todos los datos han sido reseteados', 'info');
    }

    function demoData() {
        if (!confirm('¿Cargar datos de demostración? Se perderán los datos actuales.')) return;

        const selMedico = document.getElementById('pac_medico');
        const selArea = document.getElementById('pac_area');
        const medicos = (selMedico && selMedico.options.length > 1) ? Array.from(selMedico.options).slice(1).map(o => o.value) : ['Dr. Ejemplo'];
        const areas = (selArea && selArea.options.length > 1) ? Array.from(selArea.options).slice(1).map(o => o.value) : ['observacion'];

        const LISTA_ALERGIAS = ['Penicilina', 'AAS', 'Ibuprofeno'];
        const LISTA_FARMACOS = ['Paracetamol', 'Nolotil', 'Amoxicilina', 'Enantyum', 'Omeprazol'];
        const LISTA_DOSIS = ['1 g', '575 mg', '500 mg', '25 mg'];
        const LISTA_VIAS = ['Oral', 'Venosa periférica', 'Intramuscular'];
        const LISTA_PAUTAS_TXT = ['Cada 8 horas', 'Cada 24 horas'];
        const MAPA_PAUTAS = { 'Cada 8 horas': 'q8', 'Cada 24 horas': 'q24' };
        const LISTA_DIETAS = ['Absoluta', 'Normal', 'Diabética', 'Hiposódica'];
        const LISTA_CONSISTENCIAS = ['Líquida', 'Triturada', 'Fácil masticación'];
        const LISTA_SOLUCIONES = ['Fisiológico', 'Glucosalino', 'Glucosado 5%'];
        const LISTA_COND_OPC = ['fiebre', 'dolor', 'nauseas'];
        const LISTA_DIURESIS = ['miccional', 'horaria', 'c8h'];

        const medicoRnd = randChoice(medicos);
        const areaRnd = randChoice(areas);
        const alergiasRnd = [randChoice(LISTA_ALERGIAS)];

        const prescripcionesRnd = [];
        for (let i = 0; i < 2; i++) {
            const pautaTxt = randChoice(LISTA_PAUTAS_TXT);
            prescripcionesRnd.push({
                farmaco: randChoice(LISTA_FARMACOS), dosis: randChoice(LISTA_DOSIS), via: randChoice(LISTA_VIAS),
                pauta: MAPA_PAUTAS[pautaTxt] || 'q8', inicio: randTime(), dias: randInt(1, 5), indicacion: 'Tratamiento activo', obs: '',
                timestamp: new Date().toISOString()
            });
        }
        
        const dietasRnd = [{
            tipo: norm(randChoice(LISTA_DIETAS)), tipo_text: 'Dieta Ejemplo',
            consistencia: norm(randChoice(LISTA_CONSISTENCIAS)), consistencia_text: 'Consistencia Ejemplo',
            celiaquia: 'no', intolerancias: [], observaciones: 'Dieta de ejemplo', timestamp: new Date().toISOString()
        }];

        const fluidoRnd = [{
            via: 'con', solucion: norm(randChoice(LISTA_SOLUCIONES)), volumen: '1000', frecuencia: 'cada_24_horas', ritmo: '42', obs: 'Mantenimiento', timestamp: new Date().toISOString()
        }];

        const domicilioRnd = [{
            farmaco: 'Adiro', dosis: '100 mg', via: 'Oral', freq: 'Cada 24 horas', inicio: '09:00', dias: 30, indicacion: 'Prevención', obs: '', timestamp: new Date().toISOString()
        }];

        const opcionalesRnd = [{
            condicion: 'dolor', farmaco: 'Paracetamol', dosis: '1 g', via: 'Oral', freqmax: 'q8', obs: 'Si dolor', timestamp: new Date().toISOString()
        }];

        const puntualesRnd = [{
            farmaco: 'Captopril', dosis: '25 mg', via: 'Sublingual', indicacion: 'TA > 180', cuando: 'ahora', obs: '', timestamp: new Date().toISOString()
        }];

        const oxigenacionRnd = [{
            oxigeno: 'si', dispositivo: 'gafas_nasales', litros: '2', porcentaje: '', aerosol: 'no', aerosoles: {}, vmni: 'no', tipo: '', vmniParams: {}, obs: 'Sat O2 > 92%', timestamp: new Date().toISOString()
        }];

        const cuidadosRnd = [{
            general: ['Cama cabecero elevado'], diuresis: { si: true, tipo: 'miccional' }, depos: true, mon: true, intermitente: { ta: {use:true, pauta:'Cada 8 horas'} }, continua: {}, obs: 'Vigilar constantes', timestamp: new Date().toISOString()
        }];

        const pruebasRnd = [{
            analiticas: { hemo: true, bioq: true, coag: true }, radiologia: { simple: true }, otras: {}, hojasConsulta: [], obs: 'Urgente', timestamp: new Date().toISOString()
        }];

        const demoState = {
            paciente: {
                hisclin: randInt(100000, 999999).toString(),
                edad: randInt(20, 90),
                sexo: randChoice(['M', 'F']),
                peso: randInt(50, 100),
                alergias: alergiasRnd,
                medico: medicoRnd,
                area: areaRnd,
                fecha: new Date().toISOString().slice(0, 16),
                // CAMBIO AQUI: Forzar SI en insuficiencias
                insuf_renal: 'si', 
                insuf_hepatica: 'si'
            },
            prescripciones: prescripcionesRnd,
            dietas: dietasRnd,
            fluidos: fluidoRnd,
            let: randChoice(['1', '2', '3']), 
            domicilio: domicilioRnd,
            opcionales: opcionalesRnd,
            puntuales: puntualesRnd,
            cuidados: cuidadosRnd,
            pruebas: pruebasRnd,
            oxigenacion: oxigenacionRnd,
            editingIndex: -1, editingType: null
        };
        
        cargarDatos(demoState);
        showToast('Datos de demostración cargados', 'success');
    }

    function imprimir(tipo) {
        document.body.classList.remove('print-medico', 'print-enfermeria');
        document.body.classList.add(`print-${tipo}`);
        const pacMod = window.App?.getAllModules?.().paciente;
        if (pacMod && typeof pacMod.cargarDesdeEstado === 'function') pacMod.cargarDesdeEstado();
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('print-medico', 'print-enfermeria');
            }, 1000);
        }, 100);
    }

    function guardarEnHistorial(data) {
        const historial = StorageHelpers.get('tratamientosHistorial', []);
        historial.unshift({
            timestamp: data.timestamp,
            paciente: { hisclin: data.paciente.hisclin, edad: data.paciente.edad, sexo: data.paciente.sexo, medico: data.paciente.medico },
            numPrescripciones: data.prescripciones.length,
            numDietas: data.dietas.length
        });
        if (historial.length > 50) historial.length = 50;
        StorageHelpers.set('tratamientosHistorial', historial);
    }

    return { init, exportar: exportJSON, importar: importJSON, reset: resetAll, demo: demoData, imprimir, cargarDatos };
})();

export default ExportModule;