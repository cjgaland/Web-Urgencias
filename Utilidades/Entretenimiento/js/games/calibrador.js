// ======================
// ⚠️ Desafío Seguridad · Hotspots con Editor (arrastre global + JSHint friendly)
// - Juego + Calibrar + Mostrar/Ocultar zonas
// - Editor: crear / mover / redimensionar / renombrar / exportar JSON
// - Datos legacy [y,x,w,h] -> normaliza a [x,y,w,h] al pintar
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {

  // ---------- Config ----------
  const LEVELS = {
    l1: {
      name: "Nivel 1: Habitación",
      time: 90, mult: 1.0, img: "./img/seg-habitacion.png",
      // DATOS ANTIGUOS [y,x,w,h] -> se normalizan al pintar
      riesgos: [
        { nombre: "Paciente sin pulsera identificativa", coords: [38, 29, 11, 7] },
        { nombre: "Barandilla de la cama bajada",        coords: [31, 41, 38, 13] },
        { nombre: "Suelo mojado (sin señalizar)",        coords: [38, 75, 38, 13] },
        { nombre: "Timbre fuera del alcance",            coords: [54, 66, 8, 5]   },
        { nombre: "Agujas en mesilla",                   coords: [71, 20, 14, 5]  }
      ]
    },
    l2: {
      name: "Nivel 2: Carro de Medicación",
      time: 75, mult: 1.5, img: "./img/seg-carro.png",
      riesgos: [
        { nombre: "Carro abierto sin supervisión",       coords: [53, 58, 33, 15] },
        { nombre: "Alto riesgo mal separado",            coords: [26, 51, 23, 14] },
        { nombre: "Jeringa sin identificar",             coords: [10, 33, 24, 6]  },
        { nombre: "Frasco caducado",                     coords: [31, 27, 12, 7]  },
        { nombre: "Contenedor punzantes lleno",          coords: [55, 31, 22, 28] }
      ]
    },
    l3: { name: "Nivel 3 (Próximamente)", time: 0, mult: 2.0, img: "", riesgos: [] },
    l4: { name: "Nivel 4 (Próximamente)", time: 0, mult: 2.0, img: "", riesgos: [] }
  };

  // ---------- Estado ----------
  const st = {
    level: "l1", running: false, tLeft: 0, raf: 0,
    score: 0, found: 0, misses: 0,
    hotspots: [], lock: false,
    showZones: false,
    calibrating: false,
    dragStart: null,
    overlay: null,
    imgEl: null,

    // Editor
    editing: false,
    editorMode: null,     // 'new'|'move'|'resize:nw|ne|sw|se'|null
    selected: null,
    startBox: null,       // caja original [x,y,w,h] (%)
    startPtPx: null       // punto (px) de inicio para mover/resize
  };

  // ---------- Utils ----------
  function $(s, el){ return (el||root).querySelector(s); }
  function el(tag, attrs, children){
    const n = document.createElement(tag);
    attrs = attrs || {};
    for (const k in attrs){
      const v = attrs[k];
      if (k === "class") n.className = v;
      else if (k === "id") n.id = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") {
        n.addEventListener(k.slice(2).toLowerCase(), v);
      } else n.setAttribute(k, v);
    }
    if (children != null){
      (Array.isArray(children)?children:[children]).forEach(function(c){ if(c!=null) n.append(c); });
    }
    return n;
  }
  // LEGADO [y,x,w,h] -> estándar [x,y,w,h]
  function normalizeCoords(coords){ var y=coords[0], x=coords[1], w=coords[2], h=coords[3]; return [x, y, w, h]; }
  function normalizeCoordsIfNeeded(coords){ return normalizeCoords(coords); }

  // px<->% helpers (respecto al overlay)
  function pctToPxX(p){ return (p/100) * st.overlay.clientWidth; }
  function pctToPxY(p){ return (p/100) * st.overlay.clientHeight; }
  function pxToPctX(px){ return (px / st.overlay.clientWidth) * 100; }
  function pxToPctY(py){ return (py / st.overlay.clientHeight) * 100; }
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
  function fmt2(n){ return +Number(n).toFixed(2); }
  function copy(txt){ try{ navigator.clipboard.writeText(txt); }catch(e){} }
  function bestLocal(gameKey){
    try{
      const arr = JSON.parse(localStorage.getItem("urgent-games-scores")||"[]").filter(function(x){ return x.game === gameKey; });
      if (!arr.length) return 0;
      var max = 0;
      for (var i=0;i<arr.length;i++){
        var sc = Number(arr[i].score)||0;
        if (sc > max) max = sc;
      }
      return max;
    }catch(e){ return 0; }
  }

  function injectCss(){
    if (document.getElementById("seguridad-css")) return;
    const css = [
      '.mt-panel{width:min(760px,100%);display:grid;gap:.9rem}',
      '.levelbar{display:flex;gap:.4rem;flex-wrap:wrap}',
      '.levelbar .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:.45rem .75rem;font-weight:700;cursor:pointer}',
      '.levelbar .btn.active{background:#003a6b;color:#fff;border-color:#003a6b}',
      '.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:.5rem}',
      '.kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center}',
      '.kpi .box .muted{font-size:.85rem;color:#6b7280}',
      '.kpi .box div:last-child{font-weight:700;font-size:1.1rem}',
      '#box-found{background:#dcfce7;border-color:#86efac}',
      '#box-found .muted{color:#15803d}',
      '#box-found div:last-child{color:#166534}',
      '#box-miss{background:#fee2e2;border-color:#fca5a5}',
      '#box-miss .muted{color:#b91c1c}',
      '#box-miss div:last-child{color:#991b1b}',
      '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-start;margin-top:.75rem}',
      '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
      '.btn-primary{background:#0d6efd;color:#fff}',
      '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,.12)}',
      '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}',

      '.sec-wrapper{position:relative;width:100%;max-width:760px;margin:0 auto;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden}',
      '.sec-canvas{position:relative;width:100%;height:auto}',
      '.sec-canvas img{display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none}',
      '.hs-overlay{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10}',

      '.sec-hotspot{position:absolute;left:0;top:0;width:0;height:0;background:transparent;border:0;cursor:pointer;pointer-events:auto}',
      '.zones-on .sec-hotspot{background:rgba(255,0,0,.10);border:2px dashed rgba(255,0,0,.6)}',
      '.zones-on .sec-hotspot:hover{background:rgba(255,0,0,.20)}',
      '.sec-hotspot.found{background:rgba(21,128,61,.25)!important;border:2px solid #16a34a!important;cursor:default}',
      '.sec-hotspot.missed{background:rgba(255,0,0,.25)!important;border:2px solid #b91c1c!important;cursor:default}',

      /* Editor */
      '.edit-on .hs-overlay{pointer-events:auto}',
      '.hs-item{position:absolute;border:2px solid #2563eb;background:rgba(37,99,235,.08);cursor:move}',
      '.hs-item.sel{border-color:#0d9488;background:rgba(13,148,136,.12)}',
      '.hs-label{position:absolute;left:0;top:-22px;background:#0f172a;color:#fff;padding:2px 6px;border-radius:6px;font-size:12px;white-space:nowrap}',
      '.hs-badge{position:absolute;right:-2px;bottom:-22px;background:#111827;color:#fff;padding:2px 6px;border-radius:6px;font-size:11px}',
      '.hs-handle{position:absolute;width:12px;height:12px;background:#fff;border:2px solid #2563eb;border-radius:2px;cursor:nwse-resize}',
      '.hs-handle.nw{left:-7px;top:-7px}',
      '.hs-handle.ne{right:-7px;top:-7px;cursor:nesw-resize}',
      '.hs-handle.sw{left:-7px;bottom:-7px;cursor:nesw-resize}',
      '.hs-handle.se{right:-7px;bottom:-7px}',
      '.hs-actions{position:absolute;right:0;top:-26px;display:flex;gap:6px}',
      '.hs-btn{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 6px;font-size:12px;cursor:pointer}',
      '.calib-on{cursor:crosshair}',
      '.calib-rect{position:absolute;border:2px solid #0d6efd;background:rgba(13,110,253,.15);pointer-events:none;z-index:20}',
      '.calib-dot{position:absolute;width:8px;height:8px;border-radius:999px;background:#0d6efd;transform:translate(-50%,-50%);pointer-events:none;z-index:21}',

      '.sec-review-list{list-style:none;padding:0;margin:0;text-align:left}',
      '.sec-review-list li{background:#fdf2f2;border:1px solid #fecaca;padding:.4rem .6rem;border-radius:6px;font-size:.9rem;color:#991b1b}'
    ].join('');
    const s = document.createElement("style"); s.id="seguridad-css"; s.textContent = css; document.head.appendChild(s);
  }

  // ---------- UI ----------
  function layout(){
    root.innerHTML = "";
    const panel = el("div",{class:"mt-panel"});

    const topRow = el("div",{class:"levelbar"},[
      el("button",{class:"btn",id:"btnL1",onClick:function(){setLevel("l1");}},"L1"),
      el("button",{class:"btn",id:"btnL2",onClick:function(){setLevel("l2");}},"L2"),
      el("button",{class:"btn",id:"btnL3",onClick:function(){setLevel("l3");}},"L3 (N/D)"),
      el("button",{class:"btn",id:"btnL4",onClick:function(){setLevel("l4");}},"L4 (N/D)"),
      el("span",{class:"badge",id:"lvName",style:"margin-left:.5rem"},""),
      el("span",{class:"badge",id:"bestLocalChip",style:"margin-left:auto"},"Mejor nivel: —")
    ]);

    const kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"—")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box",id:"box-found"},[el("div",{class:"muted"},"Riesgos"), el("div",{id:"f"},"0 / 0")]),
      el("div",{class:"box",id:"box-miss"},[el("div",{class:"muted"},"Fallos"), el("div",{id:"m"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAlias()||"Anónimo")])
    ]);

    const gameArea = el("div",{class:"sec-wrapper", id:"gameArea"},[
      el("div",{class:"sec-canvas", id:"canvas"},
        el("p",{class:"muted", style:"padding:2rem;text-align:center"},"Elige un nivel y pulsa Comenzar")
      )
    ]);

    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:start},"Comenzar"),
      el("button",{class:"btn btn-ghost",id:"toggleZones",onClick:toggleZones},"👁️ Mostrar zonas"),
      el("button",{class:"btn btn-ghost",id:"calibrate",onClick:toggleCalib},"📐 Calibrar"),
      el("button",{class:"btn btn-ghost",id:"edit",onClick:toggleEdit},"✏️ Editor"),
      el("button",{class:"btn btn-ghost",id:"export",onClick:exportJSON},"💾 Exportar")
    ]);

    panel.appendChild(topRow);
    panel.appendChild(kpi);
    panel.appendChild(gameArea);
    panel.appendChild(nav);
    root.appendChild(panel);

    refreshLevelButtons();
    setLevel("l1");
  }

  function setLevel(lk){
    st.level = lk;
    const cfg = LEVELS[lk];
    $("#lvName").textContent = cfg.name;
    refreshLevelButtons();
    refreshBestChips();
    const canvas = $("#canvas");
    canvas.innerHTML = "";
    if (cfg.img) {
      st.imgEl = el("img", {id:"sceneImg", src: cfg.img, alt: cfg.name});
      canvas.appendChild(st.imgEl);
    } else {
      canvas.innerHTML = '<p class="muted" style="padding:2rem;text-align:center">Nivel no disponible.</p>';
    }
  }
  function refreshLevelButtons(){
    ["btnL1","btnL2","btnL3","btnL4"].forEach(function(id,i){
      const b = document.getElementById(id); if (!b) return;
      const lk = "l"+(i+1);
      if (st.level === lk) b.classList.add("active"); else b.classList.remove("active");
    });
  }
  function refreshBestChips(){
    const gameKey = "seguridad-"+st.level;
    const best = bestLocal(gameKey);
    const blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor nivel: "+best;
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);
  }

  // ---------- Zonas / Calibrar ----------
  function toggleZones(){
    st.showZones = !st.showZones;
    const area = $("#gameArea");
    if (st.showZones) { area.classList.add("zones-on"); $("#toggleZones").textContent = "👁️ Ocultar zonas"; }
    else { area.classList.remove("zones-on"); $("#toggleZones").textContent = "👁️ Mostrar zonas"; }
  }
  function toggleCalib(){
    st.calibrating = !st.calibrating;
    const area = $("#gameArea");
    if (st.calibrating) { area.classList.add("calib-on"); $("#calibrate").textContent = "📐 Salir calib."; }
    else {
      area.classList.remove("calib-on"); $("#calibrate").textContent = "📐 Calibrar";
      var rc = document.getElementById("calibRect"); if (rc) rc.remove();
      var dt = document.getElementById("calibDot"); if (dt) dt.remove();
    }
  }

  // ---------- Editor (core con arrastre global) ----------
  function toggleEdit(){
    st.editing = !st.editing;
    const btn = $("#edit");
    if (st.editing) { btn.textContent = "✅ Salir Editor"; $("#gameArea").classList.add("edit-on"); enterEditor(); }
    else { btn.textContent = "✏️ Editor"; $("#gameArea").classList.remove("edit-on"); exitEditor(); }
  }
  function enterEditor(){
    if (st.running) { cancelAnimationFrame(st.raf); st.running = false; }
    const cfg = LEVELS[st.level];
    renderSceneForEditor(cfg);
  }
  function exitEditor(){
    st.selected = null;
    if (st.overlay) st.overlay.innerHTML = "";
    removeDocDragListeners();
    st.editorMode = null;
  }

  function renderSceneForEditor(cfg){
    const canvas = $("#canvas");
    canvas.innerHTML = "";
    const img = el("img",{id:"sceneImg", src: cfg.img, alt: cfg.name});
    st.imgEl = img;
    canvas.appendChild(img);

    img.addEventListener("load", function(){
      if (st.overlay) st.overlay.remove();
      st.overlay = el("div",{class:"hs-overlay", id:"hsOverlay"});
      canvas.appendChild(st.overlay);
      placeOverlay();

      const ro = new ResizeObserver(placeOverlay);
      ro.observe(canvas); ro.observe(img);
      window.addEventListener('resize', placeOverlay);

      st.hotspots = cfg.riesgos.map(function(r){ return {...r, found:false, el:null}; });
      st.hotspots.forEach(function(spot){ createEditorItem(spot); });

      // Crear NUEVO rectángulo (arrastrar sobre overlay vacío)
      st.overlay.addEventListener('mousedown', onNewRectMouseDown);
      // Calibración (solo info)
      setupCalibration(st.overlay, true);
    }, {once:true});

    function placeOverlay(){
      const imgRect = st.imgEl.getBoundingClientRect();
      const canvRect = canvas.getBoundingClientRect();
      const left = imgRect.left - canvRect.left;
      const top  = imgRect.top  - canvRect.top;
      st.overlay.style.left = left + 'px';
      st.overlay.style.top = top + 'px';
      st.overlay.style.width = st.imgEl.clientWidth + 'px';
      st.overlay.style.height = st.imgEl.clientHeight + 'px';
    }
  }

  // --- Crear NUEVO rectángulo: mousedown en overlay vacío + arrastre global ---
  function onNewRectMouseDown(e){
    if (e.target !== st.overlay) return;
    e.preventDefault();
    const start = getRelPoint(e);
    st.editorMode = 'new';
    st.startBox = [start.x, start.y, 0, 0];
    st.startPtPx = null; // no se usa en 'new'
    const tmp = { nombre: "Nuevo riesgo", coords: [start.x, start.y, 0, 0], el: null, _temp: true };
    st.selected = tmp;
    createEditorItem(tmp);
    addDocDragListeners();
  }

  // --- Crear item editor y enganchar handlers de mover/resize ---
  function createEditorItem(spot){
    var baseCoords;
    if (Array.isArray(spot.coords) && spot.coords.length===4){
      baseCoords = spot._fromEditor ? spot.coords : normalizeCoordsIfNeeded(spot.coords);
    } else {
      baseCoords = [0,0,10,10];
    }
    spot.coords = [fmt2(baseCoords[0]),fmt2(baseCoords[1]),fmt2(baseCoords[2]),fmt2(baseCoords[3])];

    const d = el("div",{class:"hs-item"});
    const lbl = el("div",{class:"hs-label"}, spot.nombre || "Riesgo");
    const badge = el("div",{class:"hs-badge"}, toBadgeText(spot.coords));
    const actions = el("div",{class:"hs-actions"},[
      el("button",{class:"hs-btn",onClick:function(){renameSpot(spot);}},"✎"),
      el("button",{class:"hs-btn",onClick:function(){deleteSpot(spot);}},"🗑")
    ]);
    const hNW = el("div",{class:"hs-handle nw"}), hNE = el("div",{class:"hs-handle ne"});
    const hSW = el("div",{class:"hs-handle sw"}), hSE = el("div",{class:"hs-handle se"});

    d.appendChild(lbl); d.appendChild(badge); d.appendChild(actions);
    d.appendChild(hNW); d.appendChild(hNE); d.appendChild(hSW); d.appendChild(hSE);
    st.overlay.appendChild(d);
    spot.el = d;

    updateEditorItem(spot);

    // MOVER: mousedown sobre el rectángulo
    d.addEventListener('mousedown', function(e){
      // Si es sobre un tirador, lo maneja el handler de resize
      if (e.target.classList.contains('hs-handle')) return;
      e.preventDefault();
      st.selected = spot;
      markSelected(spot);
      st.editorMode = 'move';
      st.startPtPx = getRelPointPx(e);
      st.startBox = [spot.coords[0],spot.coords[1],spot.coords[2],spot.coords[3]];
      addDocDragListeners();
    });

    // RESIZE: mousedown en cada tirador
    hNW.addEventListener('mousedown', startResize('nw', spot));
    hNE.addEventListener('mousedown', startResize('ne', spot));
    hSW.addEventListener('mousedown', startResize('sw', spot));
    hSE.addEventListener('mousedown', startResize('se', spot));

    // Doble clic para renombrar
    d.addEventListener('dblclick', function(){ renameSpot(spot); });
  }

  function updateEditorItem(spot){
    const x = spot.coords[0], y = spot.coords[1], w = spot.coords[2], h = spot.coords[3];
    spot.el.style.left = pctToPxX(x)+'px';
    spot.el.style.top = pctToPxY(y)+'px';
    spot.el.style.width = pctToPxX(w)+'px';
    spot.el.style.height = pctToPxY(h)+'px';
    const badge = spot.el.querySelector('.hs-badge');
    if (badge) badge.textContent = toBadgeText(spot.coords);
    const lbl = spot.el.querySelector('.hs-label');
    if (lbl) lbl.textContent = spot.nombre || "Riesgo";
  }
  function markSelected(spot){
    const items = st.overlay.querySelectorAll('.hs-item');
    for (var i=0;i<items.length;i++){ items[i].classList.remove('sel'); }
    if (spot && spot.el){ spot.el.classList.add('sel'); }
  }

  function startResize(dir, spot){
    return function(e){
      e.preventDefault();
      st.selected = spot;
      markSelected(spot);
      st.editorMode = 'resize:'+dir;
      st.startPtPx = getRelPointPx(e);
      st.startBox = [spot.coords[0],spot.coords[1],spot.coords[2],spot.coords[3]];
      addDocDragListeners();
    };
  }

  // --- Drag global en document (robusto) ---
  function onDocMouseMove(e){
    if (!st.editorMode) return;

    if (st.editorMode === 'new' && st.selected && st.selected._temp){
      const p = getRelPoint(e);
      const x1 = Math.min(st.startBox[0], p.x), y1 = Math.min(st.startBox[1], p.y);
      const w = Math.abs(p.x - st.startBox[0]), h = Math.abs(p.y - st.startBox[1]);
      st.selected.coords = [fmt2(x1), fmt2(y1), fmt2(w), fmt2(h)];
      updateEditorItem(st.selected);
      return;
    }

    if (st.editorMode === 'move' && st.selected && st.startPtPx){
      const p = getRelPointPx(e);
      const dx = p.x - st.startPtPx.x, dy = p.y - st.startPtPx.y;
      const x = st.startBox[0], y = st.startBox[1], w2 = st.startBox[2], h2 = st.startBox[3];
      const nx = clamp(pxToPctX(pctToPxX(x)+dx), 0, 100 - w2);
      const ny = clamp(pxToPctY(pctToPxY(y)+dy), 0, 100 - h2);
      st.selected.coords = [fmt2(nx), fmt2(ny), w2, h2];
      updateEditorItem(st.selected);
      return;
    }

    if (st.editorMode && st.editorMode.indexOf('resize:')===0 && st.selected && st.startPtPx){
      const dir = st.editorMode.split(':')[1];
      const p = getRelPoint(e);
      var x = st.startBox[0], y = st.startBox[1], w3 = st.startBox[2], h3 = st.startBox[3];
      const x2 = x + w3, y2 = y + h3;
      if (dir==='nw'){ x = Math.min(p.x, x2); y = Math.min(p.y, y2); w3 = Math.abs(x2-x); h3 = Math.abs(y2-y); }
      if (dir==='ne'){ y = Math.min(p.y, y2); w3 = Math.abs(p.x - x); h3 = Math.abs(y2-y); }
      if (dir==='sw'){ x = Math.min(p.x, x2); w3 = Math.abs(x2-x); h3 = Math.abs(p.y - y); }
      if (dir==='se'){ w3 = Math.abs(p.x - x); h3 = Math.abs(p.y - y); }
      x = clamp(x, 0, 100); y = clamp(y, 0, 100); w3 = clamp(w3, 0, 100 - x); h3 = clamp(h3, 0, 100 - y);
      st.selected.coords = [fmt2(x), fmt2(y), fmt2(w3), fmt2(h3)];
      updateEditorItem(st.selected);
    }
  }
  function onDocMouseUp(){
    if (!st.editorMode) return;

    if (st.editorMode === 'new' && st.selected && st.selected._temp){
      delete st.selected._temp;
      const nombre = prompt("Nombre del riesgo:", st.selected.nombre || "Riesgo") || "Riesgo";
      st.selected.nombre = nombre;
    }
    st.editorMode = null;
    st.startBox = null;
    st.startPtPx = null;
    removeDocDragListeners();
  }
  function addDocDragListeners(){
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
  }
  function removeDocDragListeners(){
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
  }

  function renameSpot(spot){
    const n = prompt("Nuevo nombre:", spot.nombre || "Riesgo");
    if (n != null && n.trim()){
      spot.nombre = n.trim();
      updateEditorItem(spot);
    }
  }
  function deleteSpot(spot){
    if (!confirm('Eliminar "'+(spot.nombre||'Riesgo')+'"?')) return;
    if (spot.el) spot.el.remove();
    const i = st.hotspots.indexOf(spot);
    if (i>=0) st.hotspots.splice(i,1);
    st.selected = null;
  }
  function toBadgeText(arr){
    return fmt2(arr[0])+','+fmt2(arr[1])+','+fmt2(arr[2])+','+fmt2(arr[3])+' %';
  }

  function getRelPoint(ev){
    const r = st.overlay.getBoundingClientRect();
    const x = clamp(((ev.clientX - r.left)/r.width)*100, 0, 100);
    const y = clamp(((ev.clientY - r.top )/r.height)*100, 0, 100);
    return {x:fmt2(x), y:fmt2(y)};
  }
  function getRelPointPx(ev){
    const r = st.overlay.getBoundingClientRect();
    const x = clamp((ev.clientX - r.left), 0, r.width);
    const y = clamp((ev.clientY - r.top ), 0, r.height);
    return {x:x, y:y};
  }

  function exportJSON(){
    const data = st.hotspots.map(function(sp){
      return { nombre: sp.nombre, coords: [fmt2(sp.coords[0]),fmt2(sp.coords[1]),fmt2(sp.coords[2]),fmt2(sp.coords[3])] };
    });
    const json = JSON.stringify(data, null, 2);
    copy(json);
    alert("Exportado al portapapeles.\nPega esto en el array 'riesgos' del nivel.\n\n" + json);
    console.log("💾 Export:", json);
  }

  // ---------- Juego ----------
  function start(){
    const cfg = LEVELS[st.level];
    if (!cfg || !cfg.img || !cfg.riesgos.length) { alert("Este nivel no está disponible todavía."); return; }
    st.running = true;
    st.tLeft = cfg.time; st.score = 0; st.found = 0; st.misses = 0;
    st.hotspots = cfg.riesgos.map(function(r){ return {...r, found:false, el:null, _fromEditor:false}; });

    $("#s").textContent = "0"; $("#f").textContent = "0 / " + st.hotspots.length;
    $("#m").textContent = "0"; $("#t").textContent = String(st.tLeft);
    $("#start").style.display = "none";

    renderSceneAndHotspots(cfg);
    cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(tick);
  }

  function renderSceneAndHotspots(cfg){
    const canvas = $("#canvas");
    canvas.innerHTML = "";
    const img = el("img",{id:"sceneImg", src: cfg.img, alt: cfg.name});
    st.imgEl = img; canvas.appendChild(img);

    img.addEventListener("load", function(){
      if (st.overlay) st.overlay.remove();
      st.overlay = el("div",{class:"hs-overlay", id:"hsOverlay"});
      canvas.appendChild(st.overlay);

      placeOverlay();

      const ro = new ResizeObserver(placeOverlay);
      ro.observe(canvas); ro.observe(img);
      window.addEventListener('resize', placeOverlay);

      st.hotspots.forEach(function(spot){
        const arr = normalizeCoords(spot.coords);
        const x=arr[0], y=arr[1], w=arr[2], h=arr[3];
        const d = el("div",{class:"sec-hotspot"});
        d.style.left = pctToPxX(x)+'px';
        d.style.top = pctToPxY(y)+'px';
        d.style.width = pctToPxX(w)+'px';
        d.style.height = pctToPxY(h)+'px';
        d.title = spot.nombre;
        d.addEventListener("click", function(e){
          if (st.calibrating) return;
          e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
          onHotspotClick(spot);
        }, true);
        spot.el = d; st.overlay.appendChild(d);
      });

      const area = $("#gameArea");
      area.onclick = function(e){
        if (!st.running || st.lock || st.calibrating) return;
        if (e.target.classList.contains('sec-hotspot')) return;
        onMissClick();
      };

      setupCalibration(st.overlay, false);
    }, {once:true});

    function placeOverlay(){
      const imgRect = st.imgEl.getBoundingClientRect();
      const canvRect = canvas.getBoundingClientRect();
      const left = imgRect.left - canvRect.left;
      const top  = imgRect.top  - canvRect.top;
      st.overlay.style.left = left + 'px';
      st.overlay.style.top = top + 'px';
      st.overlay.style.width = st.imgEl.clientWidth + 'px';
      st.overlay.style.height = st.imgEl.clientHeight + 'px';
    }
  }

  function onHotspotClick(spot){
    if (!st.running || st.lock || spot.found) return;
    st.lock = true;
    spot.found = true;
    if (spot.el) {
      spot.el.classList.add("found");
      spot.el.title = "ENCONTRADO: " + spot.nombre;
    }
    st.found++; st.score += 100;
    $("#s").textContent = String(st.score);
    $("#f").textContent = st.found + " / " + st.hotspots.length;
    if (st.found === st.hotspots.length) end(true);
    setTimeout(function(){ st.lock = false; }, 100);
  }
  function onMissClick(){
    if (!st.running || st.lock) return;
    st.misses++; st.score = Math.max(0, st.score - 25);
    $("#s").textContent = String(st.score);
    $("#m").textContent = String(st.misses);
    const area = $("#gameArea"); area.style.borderColor = "#b91c1c";
    setTimeout(function(){ area.style.borderColor = "#e5e7eb"; }, 200);
  }
  function tick(){
    if (!st.running) return;
    st.tLeft -= 0.016;
    if (st.tLeft <= 0){ st.tLeft = 0; $("#t").textContent = "0"; end(false); return; }
    $("#t").textContent = String(Math.ceil(st.tLeft));
    st.raf = requestAnimationFrame(tick);
  }
  function end(won){
    cancelAnimationFrame(st.raf); st.running = false;
    if (won) st.score += Math.round(st.tLeft * 10);

    const missed = [];
    st.hotspots.forEach(function(spot){
      if (!spot.found){
        if (spot.el && spot.el.classList) { spot.el.classList.add("missed"); }
        if (spot.el) { spot.el.title = "NO ENCONTRADO: " + spot.nombre; }
        missed.push(spot.nombre);
      }
      if (spot.el) { spot.el.style.cursor = "default"; }
    });

    const gameKey = "seguridad-"+st.level;
    saveLocalScore(gameKey, st.score);
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);

    root.innerHTML = "";
    const panel = el("div",{class:"mt-panel"});
    panel.appendChild(el("h2",{},"🏁 Resultado"));
    panel.appendChild(el("div",{}, (won ? "✅ Riesgos localizados" : "⏱ Tiempo agotado")));
    panel.appendChild(el("div",{},"Nivel: "+LEVELS[st.level].name));
    panel.appendChild(el("div",{},"Puntuación: "+st.score));
    panel.appendChild(el("div",{}, "Riesgos encontrados: " + st.found + " / " + st.hotspots.length));
    panel.appendChild(el("div",{}, "Clics erróneos: " + st.misses));

    if (missed.length){
      panel.appendChild(el("h3",{style:"margin-top:1.5rem;margin-bottom:.5rem"},"Riesgos no encontrados:"));
      const list = el("ul",{class:"sec-review-list"});
      missed.forEach(function(n){ list.appendChild(el("li",{},n)); });
      panel.appendChild(list);
      panel.appendChild(el("p",{class:"muted",style:"text-align:center"},"(Revisa la imagen para verlos marcados en rojo)"));
    }

    const savedArea = el("div",{class:"sec-wrapper", id:"gameArea"});
    const canvas = el("div",{class:"sec-canvas", id:"canvas"});
    if (st.imgEl) { canvas.appendChild(st.imgEl); }
    if (st.overlay) { canvas.appendChild(st.overlay); }
    savedArea.appendChild(canvas);
    panel.appendChild(savedArea);

    panel.appendChild(
      el("div",{class:"qz-meta",style:"margin-top:.6rem"},[
        el("button",{class:"btn btn-primary",onClick:function(){ layout(); setLevel('l1'); }},"Jugar de nuevo")
      ])
    );
    root.appendChild(panel);
  }

  // ---------- Calibración (común a juego/editor) ----------
  function setupCalibration(layer, isEditor){
    layer.onmousedown = function(e){
      if (!st.calibrating || (isEditor && e.target!==layer)) return;
      e.preventDefault();
      const p = getRelPoint(e);
      st.dragStart = p;
      var dot = document.getElementById("calibDot");
      if (!dot){ dot = el("div",{id:"calibDot", class:"calib-dot"}); layer.appendChild(dot); }
      dot.style.left = p.x+"%"; dot.style.top = p.y+"%";
      var rect = document.getElementById("calibRect");
      if (!rect){ rect = el("div",{id:"calibRect", class:"calib-rect"}); layer.appendChild(rect); }
      rect.style.left = p.x+"%"; rect.style.top  = p.y+"%";
      rect.style.width = "0%"; rect.style.height= "0%";
    };
    layer.onmousemove = function(e){
      if (!st.calibrating || !st.dragStart) return;
      const p = getRelPoint(e);
      const x1 = Math.min(st.dragStart.x, p.x);
      const y1 = Math.min(st.dragStart.y, p.y);
      const x2 = Math.max(st.dragStart.x, p.x);
      const y2 = Math.max(st.dragStart.y, p.y);
      const rect = document.getElementById("calibRect"); if (!rect) return;
      rect.style.left = x1+"%"; rect.style.top  = y1+"%";
      rect.style.width  = (x2-x1)+"%"; rect.style.height = (y2-y1)+"%";
    };
    layer.onmouseup = function(e){
      if (!st.calibrating || !st.dragStart) return;
      const p = getRelPoint(e);
      const x1 = Math.min(st.dragStart.x, p.x);
      const y1 = Math.min(st.dragStart.y, p.y);
      const x2 = Math.max(st.dragStart.x, p.x);
      const y2 = Math.max(st.dragStart.y, p.y);
      st.dragStart = null;

      const coords = [ fmt2(x1), fmt2(y1), fmt2(x2-x1), fmt2(y2-y1) ];
      const snippet = '{ nombre: "Riesgo nuevo", coords: ['+coords.join(", ")+'] }';
      console.log("📐 Coordenadas:", snippet);
      copy(snippet);
      alert("Coordenadas copiadas:\n" + snippet);
    };
    layer.onclick = function(e){
      if (!st.calibrating) return;
      e.stopPropagation();
      const p = getRelPoint(e);
      console.log("📐 Punto:", [fmt2(p.x), fmt2(p.y), 1, 1]);
    };
  }

  // ---------- Inicio ----------
  injectCss();
  layout();
  setLevel("l1");
}
