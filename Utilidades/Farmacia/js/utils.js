/* =========================================================
   Utils básicos para Farmacia
   Mantener este archivo pequeño y reutilizable
   ========================================================= */
window.Utils = {
  /* Normaliza rutas relativas tipo "../" → "./" para evitar
     saltos de nivel que rompan imágenes/JSON en subpáginas. */
  normalizePath(p){
    if (!p || typeof p !== 'string') return p;
    return p.startsWith('../') ? ('./' + p.slice(3)) : p;
  },

  /* Lectura rápida de parámetros de la URL (?id=...) */
  getParam(name, url){
    const u = new URL(url || window.location.href);
    return u.searchParams.get(name);
  },

  /* Construye un enlace con querystring (sin navegar) */
  buildLink(page, params){
    const u = new URL(page, window.location.href);
    Object.entries(params || {}).forEach(([k,v])=>{
      if (v !== undefined && v !== null) u.searchParams.set(k, v);
    });
    return u.toString();
  }
};
