// js/modules/data-loader.js
import { showToast } from '../core/utils.js';

export class DataLoader {
    static async cargarArchivo(archivo, opciones = {}) {
        const {
            filtroLineasVacios = true,
            filtroComentarios = true,
            prefijoRuta = 'data/'
        } = opciones;

        try {
            const response = await fetch(`${prefijoRuta}${archivo}`);
            
            if (!response.ok) {
                throw new Error(`Error ${response.status} cargando ${archivo}`);
            }
            
            const texto = await response.text();
            let lineas = texto.split('\n').map(linea => linea.trim());
            
            // Aplicar filtros
            if (filtroLineasVacios) {
                lineas = lineas.filter(linea => linea.length > 0);
            }
            
            if (filtroComentarios) {
                // MODIFICADO: Ignora también las líneas que empiezan con #
                lineas = lineas.filter(linea => !linea.startsWith('//') && !linea.startsWith('#'));
            }
            
            console.log(`Archivo ${archivo} cargado: ${lineas.length} elementos`);
            return lineas;
            
        } catch (error) {
            console.error(`Error cargando ${archivo}:`, error);
            showToast(`Error cargando ${archivo}`, 'error');
            return [];
        }
    }

    static async cargarEspecialidades() {
        return await this.cargarArchivo('especialidades.txt');
    }

    static async cargarProfesionales() {
        const lineas = await this.cargarArchivo('profesionales.txt');
        return lineas.map(linea => {
            const [apellido, nombre] = linea.split(',').map(part => part.trim());
            if (nombre && apellido) {
                const titulo = nombre.endsWith('a') ? 'Dra.' : 'Dr.';
                return `${titulo} ${nombre} ${apellido}`;
            }
            return linea;
        });
    }

    static async cargarDietas() {
        return await this.cargarArchivo('dietas.txt');
    }

    static async cargarConsistencias() {
        return await this.cargarArchivo('consistencia_dieta.txt');
    }

    static async cargarIntolerancias() {
        return await this.cargarArchivo('intol_alimentarias.txt');
    }

    static async cargarSoluciones() {
        return await this.cargarArchivo('soluciones.txt');
    }

    // +++ FUNCIÓN MODIFICADA +++
    static async cargarMedicamentos() {
        const lineas = await this.cargarArchivo('medicamentos.txt');
        
        // Parsear cada línea en un objeto
        return lineas.map(linea => {
            const partes = linea.split('|').map(s => s.trim());
            const [nombre, dosis, via, indicacion] = partes;

            // Si falta información básica, no lo incluimos
            if (!nombre || !dosis || !via) return null;

            // Creamos un 'valor' único para el datalist
            const value = `${nombre} (${dosis}, ${via})`;

            return {
                value: value,       // Ej: "Paracetamol (1 g, IV)"
                nombre: nombre,     // Ej: "Paracetamol"
                dosis: dosis,       // Ej: "1 g"
                via: via,           // Ej: "IV"
                indicacion: indicacion || '' // Ej: "Dolor o fiebre"
            };
        }).filter(Boolean); // Filtra cualquier línea nula o mal formada
    }
    // +++ FIN DE LA MODIFICACIÓN +++

    static async cargarViasAdministracion() {
        return await this.cargarArchivo('vias_administracion.txt');
    }

    static async cargarPautas() {
        return await this.cargarArchivo('pauta.txt');
    }
    

    // Método para cargar datos con transformación personalizada
    static async cargarDatos(archivo, transformador = null) {
        const datos = await this.cargarArchivo(archivo);
        return transformador ? datos.map(transformador) : datos;
    }

    // Método para verificar disponibilidad de archivos
    static async verificarArchivos() {
        const archivos = [
            'especialidades.txt',
            'profesionales.txt', 
            'dietas.txt',
            'consistencia_dieta.txt',
            'intol_alimentarias.txt',
            'soluciones.txt',
            'vias_administracion.txt',
            'pauta.txt',
            'medicamentos.txt' // <-- Añadido para verificación
        ];

        const resultados = {};
        
        for (const archivo of archivos) {
            try {
                const response = await fetch(`data/${archivo}`);
                resultados[archivo] = response.ok;
            } catch (error) {
                resultados[archivo] = false;
            }
        }

        return resultados;
    }
}

// Exportación para módulos ES6
export default DataLoader;