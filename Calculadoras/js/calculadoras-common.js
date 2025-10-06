// ============================================
// FUNCIONES COMUNES PARA CALCULADORAS
// Web Urgencias - AGS Sur de Córdoba
// ============================================

// Funciones helper globales
const getElement = (id) => document.getElementById(id);

// Redondeo preciso
const round = (value, decimals = 3) => {
  return Math.round((value + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals);
};

// Conversión de unidades - Peso
function toKg(value, unit) {
  if (unit === 'lb') return value * 0.45359237;
  if (unit === 'g') return value / 1000;
  return value; // ya es kg
}

// Conversión de unidades - Altura
function toCm(value, unit) {
  if (unit === 'm') return value * 100;
  if (unit === 'in') return value * 2.54;
  return value; // ya es cm
}

// Conversión de unidades - Temperatura
function toCelsius(value, unit) {
  if (unit === 'F') return (value - 32) * 5 / 9;
  return value; // ya es Celsius
}

// Validación de número positivo
function isPositive(value) {
  return !isNaN(value) && value > 0;
}

// Validación de rango
function inRange(value, min, max) {
  return !isNaN(value) && value >= min && value <= max;
}

// ============================================
// FUNCIÓN DE COPIADO AL PORTAPAPELES
// ============================================
function setupCopyButton(buttonId, resultId) {
  const copyBtn = getElement(buttonId);
  const resultDiv = getElement(resultId);
  
  if (!copyBtn || !resultDiv) return;
  
  copyBtn.addEventListener('click', () => {
    const text = resultDiv.textContent || resultDiv.innerText || '';
    
    if (!text.trim() || text.includes('Introduce') || text.includes('Calcular')) {
      alert('No hay resultado para copiar.');
      return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '¡Copiado!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 900);
    }).catch(err => {
      console.error('Error al copiar:', err);
      alert('No se pudo copiar al portapapeles.');
    });
  });
}

// ============================================
// FUNCIÓN DE CIERRE INTELIGENTE DE VENTANA
// ============================================
function smartClose() {
  // Intenta cerrar la ventana si fue abierta por otra ventana
  try {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
  } catch (e) {
    // Error de CORS o permiso - continúa con alternativas
  }
  
  // Si hay historial, retrocede
  if (history.length > 1) {
    history.back();
  } else {
    // Vuelve al índice de calculadoras
    location.href = '../index.html';
  }
}

// ============================================
// CONFIGURACIÓN AUTOMÁTICA DEL BOTÓN CERRAR
// ============================================
function setupCloseButton(buttonId = 'closeBtn') {
  const closeBtn = getElement(buttonId);
  if (closeBtn) {
    closeBtn.addEventListener('click', smartClose);
  }
}

// ============================================
// RESET DEL RESULTADO AL LIMPIAR FORMULARIO
// ============================================
function setupFormReset(formId, resultId, defaultMessage = 'Introduce datos y pulsa "Calcular".') {
  const form = getElement(formId);
  const resultDiv = getElement(resultId);
  
  if (!form || !resultDiv) return;
  
  form.addEventListener('reset', () => {
    resultDiv.textContent = defaultMessage;
  });
}

// ============================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Configurar botón de cierre si existe
  setupCloseButton();
  
  // Configurar botón de copiar si existe
  if (getElement('copyBtn') && getElement('result')) {
    setupCopyButton('copyBtn', 'result');
  }
  
  // Configurar reset de formulario si existe
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    if (form.id && getElement('result')) {
      setupFormReset(form.id, 'result');
    }
  });
});

// ============================================
// FUNCIONES ESPECÍFICAS PARA CALCULADORAS
// ============================================

// Superficie corporal (BSA)
function calculateBSA_Mosteller(weightKg, heightCm) {
  return Math.sqrt((heightCm * weightKg) / 3600);
}

function calculateBSA_DuBois(weightKg, heightCm) {
  return 0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725);
}

function calculateBSA_Haycock(weightKg, heightCm) {
  return 0.024265 * Math.pow(weightKg, 0.5378) * Math.pow(heightCm, 0.3964);
}

// IMC
function calculateBMI(weightKg, heightM) {
  return weightKg / (heightM * heightM);
}

function getBMICategory(bmi) {
  if (bmi < 18.5) return 'Bajo peso';
  if (bmi < 25) return 'Normopeso';
  if (bmi < 30) return 'Sobrepeso';
  if (bmi < 35) return 'Obesidad grado I';
  if (bmi < 40) return 'Obesidad grado II';
  return 'Obesidad grado III (mórbida)';
}

// Consumo energético basal
function calculateBMR_MifflinStJeor(weightKg, heightCm, age, sex) {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  return sex === 'M' ? base + 5 : base - 161;
}

function calculateBMR_HarrisBenedict(weightKg, heightCm, age, sex) {
  if (sex === 'M') {
    return 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * age);
  } else {
    return 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * age);
  }
}

// Filtrado glomerular
function calculateGFR_MDRD(creatinineMgDl, age, sex, isBlack = false) {
  let gfr = 186 * Math.pow(creatinineMgDl, -1.154) * Math.pow(age, -0.203);
  if (sex === 'F') gfr *= 0.742;
  if (isBlack) gfr *= 1.212;
  return gfr;
}

function calculateGFR_CockcroftGault(creatinineMgDl, age, sex, weightKg) {
  const numerator = (140 - age) * weightKg;
  const denominator = 72 * creatinineMgDl;
  const gfr = numerator / denominator;
  return sex === 'F' ? gfr * 0.85 : gfr;
}

// Anión Gap
function calculateAnionGap(sodium, chloride, bicarbonate) {
  return sodium - (chloride + bicarbonate);
}

// Osmolalidad plasmática
function calculateOsmolality(sodium, glucose, bun) {
  return (2 * sodium) + (glucose / 18) + (bun / 2.8);
}

// Déficit de agua libre
function calculateWaterDeficit(sodium, weightKg, sex) {
  const tbw = sex === 'M' ? 0.6 : 0.5;
  return weightKg * tbw * ((sodium / 140) - 1);
}

// Fracción de excreción de sodio (FeNa)
function calculateFeNa(serumNa, urineNa, serumCr, urineCr) {
  return ((urineNa * serumCr) / (serumNa * urineCr)) * 100;
}

// QT corregido
function calculateQTc_Bazett(qt, hr) {
  const rr = 60 / hr;
  return qt / Math.sqrt(rr);
}

function calculateQTc_Fridericia(qt, hr) {
  const rr = 60 / hr;
  return qt / Math.pow(rr, 1 / 3);
}

// Wells TVP
function interpretWellsTVP(score) {
  if (score <= -2) return 'Probabilidad baja';
  if (score <= 0) return 'Probabilidad moderada';
  return 'Probabilidad alta';
}

// CURB-65
function interpretCURB65(score) {
  if (score === 0) return 'Riesgo bajo - Tratamiento ambulatorio';
  if (score <= 1) return 'Riesgo bajo - Considerar ambulatorio';
  if (score === 2) return 'Riesgo intermedio - Hospitalización recomendada';
  return 'Riesgo alto - Valorar UCI';
}

// Exportar funciones globales
window.CalcUtils = {
  getElement,
  round,
  toKg,
  toCm,
  toCelsius,
  isPositive,
  inRange,
  setupCopyButton,
  smartClose,
  setupCloseButton,
  setupFormReset,
  calculateBSA_Mosteller,
  calculateBSA_DuBois,
  calculateBSA_Haycock,
  calculateBMI,
  getBMICategory,
  calculateBMR_MifflinStJeor,
  calculateBMR_HarrisBenedict,
  calculateGFR_MDRD,
  calculateGFR_CockcroftGault,
  calculateAnionGap,
  calculateOsmolality,
  calculateWaterDeficit,
  calculateFeNa,
  calculateQTc_Bazett,
  calculateQTc_Fridericia,
  interpretWellsTVP,
  interpretCURB65
};