// Formacion/Protocolos/protocols-common.js

// Registro global por categoría (ej: 'ADMIN', 'CLINICOS')
window.__PROTOCOLS_REGISTRY__ = window.__PROTOCOLS_REGISTRY__ || {};
window.registerProtocols = function(key, arr){ window.__PROTOCOLS_REGISTRY__[key] = arr || []; };

// Renderizador
window.renderProtocols = function(key){
  const data = (window.__PROTOCOLS_REGISTRY__ && window.__PROTOCOLS_REGISTRY__[key]) || [];
  const grid = document.getElementById('grid');
  const input = document.getElementById('buscador');

  // utilidades
  function formatDateES(isoDate){
    if (!isoDate) return '—';
    const [y,m,d] = (isoDate||'').split('-');
    return `${d}-${m}-${y}`;
  }
  function tagHTML(tags){ return (tags||[]).map(t=>`<span class="tag">${t}</span>`).join(''); }
  function iconFor(type){
    const t=(type||'').toLowerCase();
    if(t==='pdf') return 'fa-file-pdf';
    if(t==='ppt'||t==='pptx') return 'fa-file-powerpoint';
    if(t==='xls'||t==='xlsx') return 'fa-file-excel';
    if(t==='doc'||t==='docx') return 'fa-file-word';
    if(t==='zip'||t==='rar'||t==='7z') return 'fa-file-archive';
    return 'fa-file';
  }

  function cardHTML(p){
    const atts = Array.isArray(p.attachments) ? p.attachments : [];
    const buttons = atts.map(a=>{
      const primary = (a.type||'').toLowerCase()==='pdf' ? ' btn primary' : ' btn';
      return `<a class="${primary}" href="${a.href}" target="_blank" rel="noopener">
        <i class="fa-solid ${iconFor(a.type)}"></i> ${a.label||'Archivo'}
      </a>`;
    }).join('');
    return `
      <article class="link-card" data-title="${p.title||''}" data-tags="${(p.tags||[]).join(' ')}"
               data-created="${p.created_on||''}" data-revised="${p.revised_on||''}">
        <h3 class="title">${p.title||''}</h3>
        <div class="meta">
          <span>Creación: ${formatDateES(p.created_on)} ${p.created_by? '· '+p.created_by : ''}</span>
        </div>
        <div class="meta">
          <span>Última revisión: ${p.revised_on ? formatDateES(p.revised_on) : '—'} ${p.revised_by? '· '+p.revised_by : ''}</span>
        </div>
        <div class="meta">${tagHTML(p.tags)}</div>
        <div class="actions">${buttons}</div>
      </article>
    `;
  }

  function render(list){
    // opcional: orden por fecha de revisión (desc) y, si no hay, por creación
    const items = [...list].sort((a,b)=>{
      const ar = a.revised_on||''; const br = b.revised_on||'';
      if (ar!==br) return br.localeCompare(ar);
      return (b.created_on||'').localeCompare(a.created_on||'');
    });
    grid.innerHTML = items.map(cardHTML).join('');
  }

  function filtrar(){
    const q=(input?.value||'').toLowerCase().trim();
    const list = data.filter(p=>{
      const hay = (p.title+' '+(p.tags||[]).join(' ')+' '+(p.created_by||'')+' '+(p.revised_by||'')).toLowerCase();
      return hay.includes(q);
    });
    render(list);
  }

  input?.addEventListener('input', filtrar);
  render(data);
};
