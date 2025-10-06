// =========================
// BUSCADOR GLOBAL - Web Urgencias
// =========================

// Índice de búsqueda
const SEARCH_INDEX = [
  // Páginas principales
  { title: "Algoritmos diagnósticos", url: "Algoritmos/index.html", section: "Algoritmos", tags: ["algoritmos","protocolos","decisión"], desc: "IAM, ictus, sepsis, EPOC, dolor, TEP..." },
  { title: "Calculadoras médicas", url: "Calculadoras/index.html", section: "Calculadoras", tags: ["calculadoras","escalas","dosificación"], desc: "IMC, BSA, osmolaridad, CURB-65, Wells, PESI..." },
  { title: "Enlaces útiles", url: "Enlaces/index.html", section: "Enlaces", tags: ["accesos","aplicaciones","herramientas"], desc: "Correo, Portal TIC, visor de imágenes, intranet..." },
  { title: "Formación", url: "Formacion/index.html", section: "Formación", tags: ["docencia","cursos","sesiones","protocolos"], desc: "Sesiones clínicas, protocolos y e-learning." },
  { title: "Documentos y plantillas", url: "Documentos/documentos.html", section: "Documentos", tags: ["documentos","plantillas","formularios"], desc: "Consentimientos, checklists, plantillas de informe." },
  { title: "Calidad y Seguridad del Paciente", url: "Calidad/calidad.html", section: "Calidad", tags: ["calidad","seguridad","indicadores"], desc: "Indicadores, notificación de incidentes, materiales." },

  // Algoritmos → ejemplos directos ya creados (emergencias)
  { title: "SVB Instrumentalizado · Adulto", url: "Algoritmos/Emergencias/SVAB/index.html", section: "Algoritmos > Emergencias", tags: ["rcp","parada","svb","adulto"], desc: "Algoritmo visual + PDF." },
  { title: "SVA · Adulto", url: "Algoritmos/Emergencias/SVAA/index.html", section: "Algoritmos > Emergencias", tags: ["rcp","parada","sva","adulto"], desc: "Algoritmo visual + PDF." },
  { title: "SVB · Infantil", url: "Algoritmos/Emergencias/SVIB/index.html", section: "Algoritmos > Emergencias", tags: ["rcp","pediatría","svb"], desc: "Secuencia pediátrica." },
  { title: "SVA · Infantil", url: "Algoritmos/Emergencias/SVIA/index.html", section: "Algoritmos > Emergencias", tags: ["rcp","pediatría","sva"], desc: "Avanzado pediátrico." },
  { title: "Código ICTUS", url: "Algoritmos/Emergencias/ICTUS/index.html", section: "Algoritmos > Emergencias", tags: ["ictus","código","neurología"], desc: "Ventanas terapéuticas y derivación." },
  { title: "Código Sepsis", url: "Algoritmos/Emergencias/SEPSIS/index.html", section: "Algoritmos > Emergencias", tags: ["sepsis","shock séptico"], desc: "Bundle de la primera hora." },
  { title: "Intoxicaciones", url: "Algoritmos/Emergencias/INTOX/index.html", section: "Algoritmos > Emergencias", tags: ["tóxicos","antídotos"], desc: "Evaluación ABC, antídotos y criterios de ingreso." },

  // Calculadoras → ejemplos
  { title: "IMC (Índice de masa corporal)", url: "Calculadoras/Antropometricos/imc.html", section: "Calculadoras > Antropométricos", tags: ["imc","peso","talla"], desc: "Unidades convertibles y categorías." },
  { title: "Osmolalidad plasmática", url: "Calculadoras/Nefrologia/osmolalidad.html", section: "Calculadoras > Nefrología", tags: ["osmolalidad","Na","glucosa","urea"], desc: "Fórmula estándar con conversión de unidades." },

  // Formación → Sesiones Clínicas por años
  { title: "Sesiones clínicas ≤2019", url: "Formacion/Sesiones/hasta-2019/index.html", section: "Formación > Sesiones", tags: ["sesiones","histórico"], desc: "Documentos históricos." },
  { title: "Sesiones clínicas 2020", url: "Formacion/Sesiones/2020/index.html", section: "Formación > Sesiones", tags: ["sesiones","2020"], desc: "PDF/PPT/DOC del año 2020." },
  { title: "Sesiones clínicas 2021", url: "Formacion/Sesiones/2021/index.html", section: "Formación > Sesiones", tags: ["sesiones","2021"], desc: "Yearbook 2021." },
  { title: "Sesiones clínicas 2022", url: "Formacion/Sesiones/2022/index.html", section: "Formación > Sesiones", tags: ["sesiones","2022"], desc: "Yearbook 2022." },
  { title: "Sesiones clínicas 2023", url: "Formacion/Sesiones/2023/index.html", section: "Formación > Sesiones", tags: ["sesiones","2023"], desc: "Yearbook 2023." },
  { title: "Sesiones clínicas 2024", url: "Formacion/Sesiones/2024/index.html", section: "Formación > Sesiones", tags: ["sesiones","2024"], desc: "Yearbook 2024." },
  { title: "Sesiones clínicas 2025", url: "Formacion/Sesiones/2025/index.html", section: "Formación > Sesiones", tags: ["sesiones","2025"], desc: "Yearbook 2025." },

  // Formación → Protocolos y Procedimientos
  { title: "Protocolos / Procedimientos (Administrativos)", url: "Formacion/Protocolos/Administrativos/index.html", section: "Formación > Protocolos > Administrativos", tags: ["protocolos","procedimientos","administrativos"], desc: "Repositorio interno." },
  { title: "Protocolos / Procedimientos (Clinicos)", url: "Formacion/Protocolos/Clinicos/index.html", section: "Formación > Protocolos > Clinicos", tags: ["protocolos","procedimientos","clinicos"], desc: "Repositorio interno." },
    
  // Formación → E-learning (internos + externos)   
  { title: "E-learning · Enlaces útiles", url: "Formacion/ELearning/index.html", section: "Formación > E-learning", tags: ["elearning","recursos"], desc: "Selección interna de plataformas." },
  { title: "GESFORMA", url: "https://web.sas.junta-andalucia.es/servicioandaluzdesalud/profesionales/formacion/gesforma", section: "Formación > E-learning", tags: ["gesforma","formación"], desc: "Gestión de formación continuada." },
  { title: "EASP", url: "https://www.easp.es/", section: "Formación > E-learning", tags: ["easp","cursos"], desc: "Escuela Andaluza de Salud Pública." },
  { title: "Fisterra", url: "https://www.fisterra.com/", section: "Formación > E-learning", tags: ["fisterra","consulta clínica"], desc: "Recursos clínicos." },

  // Documentos y Calidad → atajos frecuentes
  { title: "Consentimientos informados", url: "Documentos/documentos.html", section: "Documentos", tags: ["consentimientos","formularios"], desc: "Modelos oficiales/adaptados." },
  { title: "Notificación de incidentes", url: "Calidad/calidad.html", section: "Calidad", tags: ["seguridad","incidentes"], desc: "Sistema de registro y aprendizaje." }
];

// Utilidades DOM (se evita $ por convención de jQuery)
function getElement(sel, ctx = document) {
  return ctx.querySelector(sel);
}

function getAllElements(sel, ctx = document) {
  return Array.from(ctx.querySelectorAll(sel));
}

// Función para normalizar texto (sin acentos, minúsculas)
function normalize(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// Puntuación de relevancia del item
function scoreItem(item, q) {
  const nq = normalize(q);
  const inTitle = normalize(item.title).includes(nq) ? 3 : 0;
  const inTags = (item.tags || []).some(t => normalize(t).includes(nq)) ? 2 : 0;
  const inDesc = normalize(item.desc).includes(nq) ? 1 : 0;
  const inSection = normalize(item.section).includes(nq) ? 1 : 0;
  return inTitle + inTags + inDesc + inSection;
}

// Resaltar coincidencias en el texto
function highlight(text, q) {
  if (!q) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return text.substring(0, idx) + "<mark>" + text.substring(idx, idx + q.length) + "</mark>" + text.substring(idx + q.length);
}

// Renderizar resultados de búsqueda
function renderResults(items, q) {
  const resultsBox = getElement('#results');
  
  if (!q || items.length === 0) {
    resultsBox.innerHTML = "";
    resultsBox.classList.remove('visible');
    return;
  }
  
  const html = items.slice(0, 12).map(it => `
    <a class="result-item" href="${it.url}" role="option">
      <div class="result-title">${highlight(it.title, q)}</div>
      <div class="result-meta">
        <span class="badge">${it.section}</span>
        <span class="desc">${it.desc || ""}</span>
      </div>
    </a>
  `).join("");
  
  resultsBox.innerHTML = html;
  resultsBox.classList.add('visible');
}

// Realizar búsqueda
function onSearch() {
  const input = getElement('#q');
  const q = input.value.trim();
  
  if (!q) {
    renderResults([], "");
    return;
  }
  
  const ranked = SEARCH_INDEX
    .map(item => ({ item, s: scoreItem(item, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.item);
    
  renderResults(ranked, q);
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  const input = getElement('#q');
  const clearBtn = getElement('#clearBtn');
  let debounceTimer = null;

  // Búsqueda con debounce
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onSearch, 140);
  });

  // Mostrar resultados al enfocar
  input.addEventListener('focus', onSearch);
  
  // Limpiar búsqueda
  clearBtn.addEventListener('click', () => {
    input.value = "";
    input.focus();
    renderResults([], "");
  });

  // Cerrar resultados al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!getElement('.site-search').contains(e.target)) {
      renderResults([], "");
    }
  });

  // Enter abre primer resultado
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const resultsBox = getElement('#results');
      const first = getElement('.result-item', resultsBox);
      if (first) {
        window.location.href = first.getAttribute('href');
      }
    }
  });
});