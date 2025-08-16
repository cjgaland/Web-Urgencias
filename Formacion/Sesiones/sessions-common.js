// Formacion/Sesiones/sessions-common.js

// Registro global por año
window.__SESSIONS_REGISTRY__ = window.__SESSIONS_REGISTRY__ || {};
window.registerSessions = function(year, arr){ window.__SESSIONS_REGISTRY__[year] = arr || []; };

// Renderizador común
window.renderSessions = function(year){
  const data = (window.__SESSIONS_REGISTRY__ && window.__SESSIONS_REGISTRY__[year]) || [];
  const grid = document.getElementById('grid');
  const input = document.getElementById('buscador');
  
function formatDateES(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
  };


function cardHTML(s){
  const tags = (s.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('');

  // Compatibilidad hacia atrás: si vienen pdf/pptx sueltos, conviértelos a adjuntos
  let attachments = Array.isArray(s.attachments) ? [...s.attachments] : [];
  if (s.pdf)  attachments.push({ label: "PDF",  href: s.pdf,  type: "pdf"  });
  if (s.pptx) attachments.push({ label: "PPTX", href: s.pptx, type: "pptx" });
  if (s.xlsx) attachments.push({ label: "XLSX", href: s.xlsx, type: "xlsx" });

  // Icono por tipo (fallback genérico)
  const iconFor = (type) => {
    const t = (type||"").toLowerCase();
    if (t === "pdf")  return "fa-file-pdf";
    if (t === "ppt" || t === "pptx") return "fa-file-powerpoint";
    if (t === "xls" || t === "xlsx") return "fa-file-excel";
    if (t === "doc" || t === "docx") return "fa-file-word";
    if (t === "zip" || t === "rar" || t === "7z") return "fa-file-archive";
    return "fa-file";
  };

  const buttons = attachments.map(att => {
    const safeLabel = att.label || (att.type ? att.type.toUpperCase() : "Archivo");
    const clsPrimary = (att.type||"").toLowerCase() === "pdf" ? " btn primary" : " btn";
    return `<a class="${clsPrimary}" href="${att.href}" target="_blank" rel="noopener">
              <i class="fa-solid ${iconFor(att.type)}"></i> ${safeLabel}
            </a>`;
  }).join('');

  return `
    <article class="link-card" data-title="${(s.title||'')}" data-author="${(s.author||'')}" data-tags="${(s.tags||[]).join(' ')}" data-date="${s.date||''}">
      <h3 class="title">${s.title}</h3>
      <div class="meta">
        <span>Autor/a: ${s.author || '—'}</span>
        <span>· Fecha: ${formatDateES(s.date) || '—'}</span>
      </div>
      <div class="meta">${tags}</div>
      <div class="actions">${buttons}</div>
    </article>
  `;
}


  function render(list){
    // Orden descendente por fecha
    const items = [...list].sort((a,b)=> (b.date||'').localeCompare(a.date||''));
    grid.innerHTML = items.map(s => cardHTML(s)).join('');
  }

  function filtrar(){
    const q=(input?.value||'').toLowerCase().trim();
    const list = data.filter(s=>{
      const hay = (s.title+' '+s.author+' '+(s.tags||[]).join(' ')).toLowerCase();
      return hay.includes(q);
    });
    render(list);
  }

  input?.addEventListener('input', filtrar);
  render(data);
};
