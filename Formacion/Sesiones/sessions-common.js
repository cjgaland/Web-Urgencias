/* sessions-common.js — contadores + render de sesiones (robusto) */
(function(){
  // Registro global
  const REG = (window.__SESSIONS_REGISTRY__ = window.__SESSIONS_REGISTRY__ || {});

  // registerSessions(year, arr) — lo llaman tus data.js
  const prevRegister = window.registerSessions;
  window.registerSessions = function(year, arr){
    const key = String(year || "").trim();          // ← normaliza: quita espacios
    REG[key] = Array.isArray(arr) ? arr : [];
    if (typeof prevRegister === "function") {
      try { prevRegister(year, arr); } catch(e){}
    }
  };

  // Pintado del listado de un año (si usas esta función)
  window.renderSessions = function(year){
    const data = (REG[year] || []).slice();
    const grid = document.getElementById('grid');
    const input = document.getElementById('buscador');

    function formatDateES(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}-${m}-${y}`; }
    function iconFor(t){ t=(t||"").toLowerCase();
      if(t==="pdf")return"fa-file-pdf"; if(t==="ppt"||t==="pptx")return"fa-file-powerpoint";
      if(t==="xls"||t==="xlsx")return"fa-file-excel"; if(t==="doc"||t==="docx")return"fa-file-word";
      if(t==="zip"||t==="rar"||t==="7z")return"fa-file-archive"; if(t==="mp4"||t==="mpeg"||t==="avi")return"fa-video";
      return"fa-file";
    }
    function cardHTML(s){
      const tags=(s.tags||[]).map(t=>`<span class="tag">${t}</span>`).join("");
      let atts=Array.isArray(s.attachments)?[...s.attachments]:[];
      if(s.pdf) atts.push({label:"PDF",href:s.pdf,type:"pdf"});
      if(s.pptx)atts.push({label:"PPTX",href:s.pptx,type:"pptx"});
      if(s.xlsx)atts.push({label:"XLSX",href:s.xlsx,type:"xlsx"});
      const buttons=atts.map(a=>{
        const primary=(a.type||"").toLowerCase()==="pdf"?" btn primary":" btn";
        const label=a.label||((a.type||"").toUpperCase()||"Archivo");
        return `<a class="${primary}" href="${a.href}" target="_blank" rel="noopener"><i class="fa-solid ${iconFor(a.type)}"></i> ${label}</a>`;
      }).join("");
      return `<article class="link-card">
        <h3 class="title">${s.title||""}</h3>
        <div class="meta"><span>Autor/a: ${s.author||"—"}</span><span> · Fecha: ${formatDateES(s.date)||"—"}</span></div>
        <div class="meta">${tags}</div>
        <div class="actions">${buttons}</div>
      </article>`;
    }
    function render(list){ grid.innerHTML=list.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(cardHTML).join(""); }
    function filtrar(){ const q=(input?.value||"").toLowerCase().trim();
      render(data.filter(s => (`${s.title||""} ${(s.author||"")} ${(s.tags||[]).join(" ")}`).toLowerCase().includes(q)));
    }
    input?.addEventListener("input", filtrar); render(data);
  };

  // ================= Contadores automáticos en tarjetas de años =================
  function initYearCounters(opts){
    const years = opts.years || [];
    const base  = typeof opts.basePath === "string" ? opts.basePath : "";
    const selCard  = opts.cardSelector || ".year-card";
    const selBadge = opts.badgeSelector || ".year-count";

    const COUNTS = {};
    const origRegister = window.registerSessions;
    window.registerSessions = function(year, arr){
      const key = String(year||"").trim();              // ← normaliza
      COUNTS[key] = Array.isArray(arr) ? arr.length : 0;
      if (typeof origRegister === "function") {
        try { origRegister(year, arr); } catch(e){}
      }
    };

// ——— Sustituye en sessions-common.js ———

// Candidatos de nombre para data.js (se prueban todos)
function candidatePaths(base, y){
  const names = [
    'data.js','Data.js','DATA.js',
    'data.JS','Data.JS','DATA.JS'
  ];
  return names.map(n => `${base}${y}/${n}`);
}

// Carga probando distintas capitalizaciones hasta que una funcione
function loadYearWithVariants(base, y){
  return new Promise(resolve=>{
    const paths = candidatePaths(base, y);
    let i = 0;
    function tryNext(){
      if (i >= paths.length){
        console.warn(`[Sesiones] ${y}: ninguna variante de data.js cargó. Probadas:`, paths);
        resolve(false);
        return;
      }
      const url = paths[i++];
      const s = document.createElement("script");
      s.src = url + `?t=${Date.now()}`; // evita caché
      s.onload = () => {
        console.log(`[Sesiones] ${y}: OK`, url);
        resolve(true);
      };
      s.onerror = () => {
        console.log(`[Sesiones] ${y}: fallo`, url);
        tryNext();
      };
      document.head.appendChild(s);
    }
    tryNext();
  });
}


Promise.all(years.map(y => loadYearWithVariants(base, y))).then(()=>{
  years.forEach(y=>{
    const card  = document.querySelector(`${selCard}[data-year="${y}"]`);
    if(!card) return;
    const badge = card.querySelector(selBadge);
    if(!badge) return;
    const n = COUNTS[String(y).trim()] || 0;
    badge.textContent = n;
    badge.classList.toggle("count--has",  n > 0);
    badge.classList.toggle("count--zero", n === 0);
    badge.title = n === 1 ? "1 sesión" : `${n} sesiones`;
  });
});

  }

  // API pública
  window.Sessions = window.Sessions || {};
  window.Sessions.initYearCounters = initYearCounters;
})();
