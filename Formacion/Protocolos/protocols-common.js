/* protocols-common.js — contadores + render de sesiones (robusto) */
(function(){
  // Registro global
  const REG = (window.__PROTOCOLS_REGISTRY__ = window.__PROTOCOLS_REGISTRY__ || {});

  // registerProtocols(category, arr) — lo llaman tus data.js
  const prevRegister = window.registerSessions;
  window.registerProtocols = function(category, arr){
    const key = String(category || "").trim();          // ← normaliza: quita espacios
    REG[key] = Array.isArray(arr) ? arr : [];
    if (typeof prevRegister === "function") {
      try { prevRegister(category, arr); } catch(e){}
    }
  };

  // Pintado del listado de una categoria (si usas esta función)
  window.renderProtocols = function(category){
    const data = (REG[category] || []).slice();
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
        <div class="meta"><span>Revisor/a: ${s.revised_by||"—"}</span><span> · Fecha: ${formatDateES(s.revised_on)||"—"}</span></div>
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
  function initCategoryCounters(opts){
    const categories = opts.categories || [];
    const base  = typeof opts.basePath === "string" ? opts.basePath : "";
    const selCard  = opts.cardSelector || ".category-card";
    const selBadge = opts.badgeSelector || ".category-count";

    const COUNTS = {};
    const origRegister = window.registerProtocols;
    window.registerProtocols = function(category, arr){
      const key = String(category||"").trim();              // ← normaliza
      COUNTS[key] = Array.isArray(arr) ? arr.length : 0;
      if (typeof origRegister === "function") {
        try { origRegister(category, arr); } catch(e){}
      }
    };

// ——— Sustituye en protocols-common.js ———

// Candidatos de nombre para data.js (se prueban todos)
function candidatePaths(base, y){
  const names = [
    'data.js','Data.js','DATA.js',
    'data.JS','Data.JS','DATA.JS'
  ];
  return names.map(n => `${base}${y}/${n}`);
}

    
// Carga probando distintas capitalizaciones hasta que una funcione
function loadCategoryWithVariants(base, y){
  return new Promise(resolve=>{
    const paths = candidatePaths(base, y);
    let i = 0;
    function tryNext(){
      if (i >= paths.length){
        console.warn(`[Protocolos] ${y}: ninguna variante de data.js cargó. Probadas:`, paths);
        resolve(false);
        return;
      }
      const url = paths[i++];
      const s = document.createElement("script");
      s.src = url + `?t=${Date.now()}`; // evita caché
      s.onload = () => {
        console.log(`[Protocolos] ${y}: OK`, url);
        resolve(true);
      };
      s.onerror = () => {
        console.log(`[Protocolos] ${y}: fallo`, url);
        tryNext();
      };
      document.head.appendChild(s);
    }
    tryNext();
  });
}
    


Promise.all(categories.map(y => loadCategoryWithVariants(base, y))).then(()=>{
  categories.forEach(y=>{
    const card  = document.querySelector(`${selCard}[data-category="${y}"]`);
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
  window.Protocols = window.Protocols || {};
  window.Protocols.initCategoryCounters = initCategoryCounters;
})();
