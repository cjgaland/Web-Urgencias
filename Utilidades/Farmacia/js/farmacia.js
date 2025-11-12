// ./js/farmacia.js
;(function(){
  const toLower = s => (s||'').toString().trim().toLowerCase();

  // --- Mapea abreviaturas antiguas a la via nueva
  const VIA_MAP = new Map([
    ['vo','oral'], ['oral','oral'],
    ['iv','iv'], ['intravenosa','iv'],
    ['im','im'], ['intramuscular','im'],
    ['sc','sc'], ['subcutanea','sc'], ['subcutánea','sc'],
    ['rectal','rectal']
  ]);

  // Humaniza la via para mostrar en ficha
  function humanVia(v){
    const t = toLower(v);
    if(t==='oral') return 'Vía oral';
    if(t==='iv') return 'Vía intravenosa';
    if(t==='im') return 'Vía intramuscular';
    if(t==='sc') return 'Vía subcutánea';
    if(t==='rectal') return 'Vía rectal';
    return v || '—';
  }

  // --- Normalizador de un fármaco (convierte estructura vieja/nueva a una interfaz común)
  function normalizeDrug(drug){
    if(!drug || typeof drug!=='object') return { raw:drug };

    // via: preferir nueva 'via'; si no, deducir de 'vias[0]' (VO/IV/IM/SC/Rectal)
    let via = drug.via;
    if(!via && Array.isArray(drug.vias) && drug.vias.length){
      const cand = toLower(drug.vias[0]).replace(/\./g,'').replace(/\s+/g,'');
      via = VIA_MAP.get(cand) || cand || null;
    }

    // forma: preferir 'forma'; si no, el primer valor de 'formas'
    let forma = drug.forma || (Array.isArray(drug.formas) ? drug.formas[0] : null);

    // dosis / posología
    const dosis = drug.dosis || null;
    const posologia = drug.posologia_texto || null;

    // etiquetas para la UI
    const viaLabel = humanVia(via);
    const viasDisplay = via ? viaLabel : (
      Array.isArray(drug.vias) && drug.vias.length ? drug.vias.join(', ') : '—'
    );

    return {
      raw: drug,
      id: drug.id || '',
      nombre: drug.nombre || drug.principio_activo || drug.id || '—',
      principio_activo: drug.principio_activo || '—',
      imagen_producto: drug?.imagenes?.producto || drug.img || null,

      via,              // canonical: 'oral' | 'iv' | 'im' | 'sc' | 'rectal' | null
      via_label: viaLabel,
      vias_display: viasDisplay,

      forma: forma || null,
      dosis,            // objeto tal cual si existe
      posologia_texto: posologia,

      indicaciones: Array.isArray(drug.indicaciones) ? drug.indicaciones : [],
      advertencias: Array.isArray(drug.advertencias) ? drug.advertencias : [],

      localizacion: drug.localizacion || null
    };
  }

  // --- Alto Riesgo
  function buildRiskMap(riskArray){
    const m = new Map();
    (Array.isArray(riskArray)?riskArray:[]).forEach(x=>{
      const pa = toLower(x?.principio_activo);
      if(!pa) return;
      m.set(pa, { grupo: x?.grupo_terapeutico || x?.grupo || '' });
    });
    return m;
  }

  function getRiskInfo(drugOrPA, riskMap){
  let pa;
  if (typeof drugOrPA === 'string') {
    pa = toLower(drugOrPA);
  } else if (drugOrPA && typeof drugOrPA.principio_activo === 'string') {
    pa = toLower(drugOrPA.principio_activo);
  } else {
    pa = null;
  }

  if (!pa) return null;
  return (riskMap && typeof riskMap.get === 'function') ? (riskMap.get(pa) || null) : null;
}


  // --- Cabecera de riesgo: SOLO cabecera en rojo y orden pedido: "Ficha breve  [⚠] ALTO RIESGO · Grupo"
  function applyRiskHeader({ headerEl, baseTitle='Ficha breve', drug, riskMap }){
    if(!headerEl) return;
    const info = getRiskInfo(drug, riskMap);
    if(info){
      headerEl.classList.add('risk');
      headerEl.innerHTML = `${baseTitle}&nbsp;&nbsp;<span class="risk-badge"><i class="fa-solid fa-triangle-exclamation"></i> <strong>ALTO RIESGO</strong> · ${info.grupo||'—'}</span>`;
    }else{
      headerEl.classList.remove('risk');
      headerEl.textContent = baseTitle;
    }
  }

  // --- Navegación entre páginas con ?id=
  function linkTo(page, params){
    const u = new URL(page, window.location.href);
    Object.entries(params||{}).forEach(([k,v])=>{
      if(v!=null && v!=='') u.searchParams.set(k, String(v));
    });
    return u.pathname + u.search + u.hash;
  }

  // API pública
  window.Farmacia = {
    // normalizador v1 (estructura unificada para UI)
    normalizeDrug,

    // riesgo
    buildRiskMap,
    getRiskInfo,
    applyRiskHeader,

    // links
    linkTo
  };
  

// SISTEMA DE CARGA MÚLTIPLE - FÁRMACOS + MATERIALES + EQUIPOS
Farmacia.cargarTodosFarmacos = async function () {
  let todosFarmacos = [];
  let totalCategorias = 0;
  let totalMateriales = 0;
  let totalEquipos = 0;

  console.log('🔄 Cargando datos de Farmacia (fármacos, materiales y equipos)…');

  // Helper: carga un JSON si existe y devuelve array (o [])
  const cargaArray = async (ruta, etiqueta = '') => {
    try {
      const r = await fetch(`${ruta}?cb=${Date.now()}`);
      if (!r.ok) return [];
      const arr = await r.json();
      if (Array.isArray(arr) && arr.length) {
        console.log(`✅ ${etiqueta || ruta}: ${arr.length} items`);
        return arr;
      }
    } catch (e) {
      // Silencioso: que no corte el flujo si no existe o está vacío
    }
    return [];
  };

  // 1) Intentar cargar el archivo principal (compatibilidad con tu flujo antiguo)
  let principal = await cargaArray('./data/farmacos.json', 'farmacos.json');
  if (principal.length) {
    todosFarmacos = todosFarmacos.concat(principal);
    console.log(`📦 Base principal: ${principal.length} fármacos`);
  } else {
    // 2) SOLO si no existe farmacos.json, cargar por categorías
    console.log('📁 Cargando por categorías (no se encontró farmacos.json)…');
    const categorias = [
      'analgesicos_opiaceos', 'analgesicos_no_opiaceos', 'anestesicos', 'ansioliticos','antiagregantes', 'antiarritmicos', 
      'antibioticos', 'anticoagulantes', 'antidepresivos', 'antidiabeticos', 'antiepilepticos', 'antifungicos', 'antivirales',
      'antihipertensivos', 'antihistaminicos', 'antipsicoticos', 'broncodilatadores', 'colirios', 'corticosteroides', 'diureticos',
      'emergencias_reanimacion', 'gastrointestinales', 'antidiabeticos', 'anticoagulantes', 'antiagregantes', 'relajantes_musculares',
      'contrastes_medios', 'soluciones_intravenosas', 'vitaminas_suplementos', 'otros'
    ];

    for (const categoria of categorias) {
      const arr = await cargaArray(`./data/${categoria}.json`, `${categoria}.json`);
      if (arr.length) {
        todosFarmacos = todosFarmacos.concat(arr);
        totalCategorias += arr.length;
      }
    }
    console.log(`🎯 TOTAL categorías: ${totalCategorias} fármacos`);
  }

  // 3) SIEMPRE: intentar añadir materiales y equipos (no farmacológico)
  const materiales = await cargaArray('./data/materiales.json', 'materiales.json');
  if (materiales.length) {
    todosFarmacos = todosFarmacos.concat(materiales);
    totalMateriales = materiales.length;
  }

  const equipos = await cargaArray('./data/equipos.json', 'equipos.json');
  if (equipos.length) {
    todosFarmacos = todosFarmacos.concat(equipos);
    totalEquipos = equipos.length;
  }

  // 4) Deduplicar por id (por si algún elemento aparece en varias fuentes)
  const vistos = new Set();
  todosFarmacos = todosFarmacos.filter(it => {
    const id = it && it.id ? String(it.id) : '';
    if (!id || vistos.has(id)) return false;
    vistos.add(id);
    return true;
  });

  // Resumen
  const total = todosFarmacos.length;
  console.log(
    `📊 Resumen carga → Principal:${principal.length} · Categorías:${totalCategorias} · ` +
    `Materiales:${totalMateriales} · Equipos:${totalEquipos} · TOTAL:${total}`
  );

  return todosFarmacos;
};

  
})();
