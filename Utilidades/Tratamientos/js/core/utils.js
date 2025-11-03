// core/utils.js
/* jshint esversion: 6 */
/* jshint browser: true */
/* jshint jquery: false */

// Renombrar las funciones para evitar conflictos
export const select = s => document.querySelector(s);
export const selectAll = s => Array.from(document.querySelectorAll(s));

// Alias alternativos sin usar $ para evitar conflictos con jQuery
export const q = select;
export const qq = selectAll;

export function nowLocalISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

export function esc(s) { 
    return (s || '').replace(/[&<>"]/g, c => 
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
    );
}

export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, duration);
}

// Funciones de validación
export const Validators = {
    isNotEmpty(value) {
        return typeof value === 'string' && value.trim().length > 0;
    },
    
    isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    isPositiveNumber(value) {
        return this.isNumber(value) && parseFloat(value) > 0;
    },
    
    isInRange(value, min, max) {
        const num = parseFloat(value);
        return this.isNumber(value) && num >= min && num <= max;
    },
    
    isValidTime(timeString) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString);
    },
    
    isValidDate(dateString) {
        return !isNaN(Date.parse(dateString));
    }
};

// Funciones de formato
export const Formatters = {
    formatDias(dias) {
        return `${dias} día${dias !== 1 ? 's' : ''}`;
    },
    
    formatPeso(peso) {
        return `${peso} kg`;
    },
    
    formatEdad(edad) {
        return `${edad} años`;
    },
    
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    truncateText(text, maxLength = 50) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};

// Funciones de texto para display
export const TextHelpers = {
    condicionText(k) {
        const map = {
            'fiebre': 'Si fiebre >38°C', 
            'dolor': 'Si dolor', 
            'agitacion': 'Si agitación',
            'nauseas': 'Si náuseas/vómitos', 
            'ta': 'Si TA elevada'
        };
        return map[k] || k;
    },
    
    freqText(k) {
        const freqMap = { 
            q24: 'Cada 24 h', 
            q12: 'Cada 12 h', 
            q8: 'Cada 8 h', 
            q6: 'Cada 6 h', 
            q4: 'Cada 4 h', 
            prn: 'Si precisa (PRN)' 
        };
        return freqMap[k] || k;
    },
    
    dietaTipoText(tipo) {
        const map = {
            'absoluta': 'Absoluta', 
            'normal': 'Normal', 
            'diabetica': 'Diabética',
            'hiposodica': 'Hiposódica', 
            'hiposodica_diabetica': 'Hiposódica/Diabética',
            'proteccion_biliar': 'Protección biliar'
        };
        return map[tipo] || tipo;
    },
    
    dietaConsistenciaText(consistencia) {
        const map = {
            'iniciar_tolerancia': 'Iniciar tolerancia', 
            'liquida': 'Líquida', 
            'triturada': 'Triturada',
            'facil_masticacion': 'Fácil masticación', 
            'astringente': 'Astringente',
            'rica_residuos': 'Rica en residuos', 
            'sin_residuos': 'Sin residuos'
        };
        return map[consistencia] || consistencia;
    },
    
    solucionText(solucion) {
        const map = {
            'fisiologico': 'Fisiológico', 
            'glucosalino': 'Glucosalino', 
            'glucosado5': 'Glucosado 5%',
            'glucosado10': 'Glucosado 10%', 
            'ringer': 'Ringer', 
            'hipertonico3': 'Hipertónico 3%',
            'hipotonico': 'Hipotónico'
        };
        return map[solucion] || solucion;
    },
    
    frecuenciaText(freq) {
        const map = {
            'ahora': 'Ahora', 
            '1h': 'c/1 hora', 
            '2h': 'c/2 horas', 
            '4h': 'c/4 horas',
            '6h': 'c/6 horas', 
            '8h': 'c/8 horas', 
            '12h': 'c/12 horas', 
            '24h': 'c/24 horas'
        };
        return map[freq] || freq;
    },
    
    cuandoText(k) {
        const map = {
            'ahora': 'Ahora', 
            'preprueba': 'Pre-prueba', 
            'postprueba': 'Post-prueba'
        };
        return map[k] || k;
    },
    
    servicioText(servicio) {
        const map = {
            'observacion': 'Observación',
            'pediatria': 'Pediatría',
            'uci': 'UCI',
            'medicina_interna': 'Medicina Interna',
            'neumologia': 'Neumología',
            'cardiologia': 'Cardiología',
            'digestivo': 'Digestivo',
            'ginecologia': 'Ginecología',
            'cirugia_general': 'Cirugía General',
            'urologia': 'Urología',
            'traumatologia': 'Traumatología'
        };
        return map[servicio] || servicio;
    },
    
    celiaquiaText(celiaquia) {
        const map = {
            'no': 'No',
            'si': 'Sí celíaco', 
            'sensibilidad': 'Sensibilidad gluten'
        };
        return map[celiaquia] || celiaquia;
    }
};

// Funciones de DOM manipulation
export const DOMHelpers = {
    showElement(selector) {
        const element = select(selector);
        if (element) element.style.display = 'block';
    },
    
    hideElement(selector) {
        const element = select(selector);
        if (element) element.style.display = 'none';
    },
    
    toggleElement(selector) {
        const element = select(selector);
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    },
    
    enableElement(selector) {
        const element = select(selector);
        if (element) element.disabled = false;
    },
    
    disableElement(selector) {
        const element = select(selector);
        if (element) element.disabled = true;
    },
    
    setInnerHTML(selector, html) {
        const element = select(selector);
        if (element) element.innerHTML = html;
    },
    
    setValue(selector, value) {
        const element = select(selector);
        if (element) element.value = value;
    },
    
    getValue(selector) {
        const element = select(selector);
        return element ? element.value : '';
    },
    
    clearElement(selector) {
        const element = select(selector);
        if (element) element.innerHTML = '';
    },
    
    addClass(selector, className) {
        const element = select(selector);
        if (element) element.classList.add(className);
    },
    
    removeClass(selector, className) {
        const element = select(selector);
        if (element) element.classList.remove(className);
    },
    
    toggleClass(selector, className) {
        const element = select(selector);
        if (element) element.classList.toggle(className);
    }
};

// Funciones de arrays y objetos
export const CollectionHelpers = {
    findIndex(array, predicate) {
        return array.findIndex(predicate);
    },
    
    findItem(array, predicate) {
        return array.find(predicate);
    },
    
    filterArray(array, predicate) {
        return array.filter(predicate);
    },
    
    sortByKey(array, key) {
        return [...array].sort((a, b) => {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
            return 0;
        });
    },
    
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
        }, {});
    },
    
    removeDuplicates(array) {
        return [...new Set(array)];
    },
    
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
};

// Funciones de storage
export const StorageHelpers = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
            return false;
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error leyendo de localStorage:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removiendo de localStorage:', error);
            return false;
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error limpiando localStorage:', error);
            return false;
        }
    }
};

// Exportar todas las utilidades
export default {
    select,
    selectAll,
    q,
    qq,
    nowLocalISO,
    esc,
    showToast,
    Validators,
    Formatters,
    TextHelpers,
    DOMHelpers,
    CollectionHelpers,
    StorageHelpers
};