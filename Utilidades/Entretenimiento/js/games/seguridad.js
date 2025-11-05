// ======================
// Desafío Seguridad (SVG; marcadores numerados + carga robusta; ranking estilo calculo.js)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  const GAME_ID = "seguridad";

  // ⚠️ Rutas relativas a index.html
  const IMG_HAB = "img/seg-habitacion.png";
  const IMG_CAR  = "img/seg-carro.png";

  // Coords en % [x, y, w, h]
  const LEVELS = {
    l1: {
      name: "Nivel 1: Habitación",
      time: 45, mult: 1.0,
      img: IMG_HAB,
      riesgos: [
        { nombre: "Paciente sin pulsera identificativa", coords: [38.13, 30.28, 11.01, 5.73] },
        { nombre: "Barandilla de la cama bajada",        coords: [34.13, 41.71, 38.00, 13.00] },
        { nombre: "Suelo mojado (sin señalizar)",        coords: [34.52, 76.09, 38.00, 13.00] },
        { nombre: "Timbre fuera del alcance",            coords: [55.42, 66.04, 8.00, 5.00]   },
        { nombre: "Agujas en mesilla",                   coords: [70.00, 20.86, 14.00, 5.00]  }
      ]
    },
    l2: {
      name: "Nivel 2: Carro de Medicación",
      time: 45, mult: 1.5,
      img: IMG_CAR,
      riesgos: [
        { nombre: "Carro abierto sin supervisión",       coords: [53.37, 62.26, 33.00, 15.00] },
        { nombre: "Alto riesgo mal separado",            coords: [26.46, 50.47, 23.00, 14.00] },
        { nombre: "Jeringa sin identificar",             coords: [13.04, 35.04, 21.35, 5.16]  },
        { nombre: "Frasco caducado",                     coords: [30.83, 27.30, 11.83, 6.42]  },
        { nombre: "Contenedor punzantes lleno",          coords: [57.73, 32.14, 18.26, 25.46] }
      ]
    },
    l3: { name: "Nivel 3 (Próximamente)", time: 0, mult: 2.0, img: "", riesgos: [] },
    l4: { name: "Nivel 4 (Próximamente)", time: 0, mult: 2.0, img: "", riesgos: [] }
  };

  // ---------- Estado ----------
  const st = {
    level: "l1",
    running: false,
    ready: false,
    tLeft: 0,
    raf: 0,
    score: 0,
    found: 0,
    misses: 0,
    hotspots: [],
    lock: false,
    svg: null,
    vw: 0, vh: 0
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
      else if (k.indexOf("on") === 0 && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    if (children != null){ (Array.isArray(children)?children:[children]).forEach(function(c){ if(c!=null) n.append(c); }); }
    return n;
  }
  function svgEl(tag, attrs){
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in (attrs||{})){ n.setAttribute(k, String(attrs[k])); }
    return n;
  }
  function bestLocal(gameKey){
    try{
      const arr = JSON.parse(localStorage.getItem("urgent-games-scores")||"[]").filter(x => x.game === gameKey);
      if (!arr.length) return 0;
      return Math.max(...arr.map(a => Number(a.score)||0));
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
      '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}',

      '.sec-wrapper{position:relative;width:100%;max-width:760px;margin:0 auto;border:2px solid #e5e7eb;border-radius:8px;overflow:hidden}',
      '.sec-canvas{position:relative;width:100%}',
      '.scene{display:block;width:100%;height:auto}',

      '.hs{fill:transparent;stroke:none;cursor:pointer}',
      '.hs.found{fill:rgba(21,128,61,.25);stroke:#16a34a;stroke-width:1}',
      '.hs.missed{fill:rgba(255,0,0,.25);stroke:#b91c1c;stroke-width:1}',

      /* Marcadores numerados */
      '.num{font: 700 14px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial; fill:#fff; text-anchor:middle; dominant-baseline:middle}',
      '.chip-list{display:flex;flex-direction:column;gap:.4rem;margin:.4rem 0 0;padding:0}',
      '.chip{display:flex;align-items:center;gap:.5rem;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:.35rem .55rem}',
      '.dot{display:inline-flex;align-items:center;justify-content:center;width:1.4rem;height:1.4rem;border-radius:999px;color:#fff;font-weight:800}',
      '.dot.g{background:#16a34a}', /* verde */
      '.dot.r{background:#b91c1c}'  /* rojo  */
    ].join('');
    const s = document.createElement("style"); s.id="seguridad-css"; s.textContent = css; document.head.appendChild(s);
  }
  function pctToUnits(pct, total){ return (pct/100) * total; }

  // --------- Helpers de ranking (compatibles con calculo.js) ---------
  function getAliasSafe(){
    try {
      const a = (typeof getAlias === 'function' && getAlias()) || "";
      return a && String(a).trim() ? String(a).trim() : "Anónimo";
    } catch { return "Anónimo"; }
  }
  // Repara cualquier registro sin alias/user/name al iniciar el módulo
  function repairAllUndefinedAliases(){
    try{
      const K = "urgent-games-scores";
      const arr = JSON.parse(localStorage.getItem(K) || "[]");
      let changed = false;
      for (let i=0;i<arr.length;i++){
        const r = arr[i] || {};
        const hasName = (r.alias!=null) || (r.user!=null) || (r.name!=null);
        if (!hasName){
          r.alias = r.user = r.name = "Anónimo";
          arr[i] = r;
          changed = true;
        }
      }
      if (changed) localStorage.setItem(K, JSON.stringify(arr));
    }catch{}
  }
  // Tras guardar, asegura nombre en el último registro de este juego
  function normalizeLastScoreForGame(gameKey){
    try{
      const K = "urgent-games-scores";
      const arr = JSON.parse(localStorage.getItem(K) || "[]");
      const alias = getAliasSafe();
      for (let i = arr.length - 1; i >= 0; i--){
        const r = arr[i];
        if (r && r.game === gameKey){
          if (r.alias==null && r.user==null && r.name==null){
            r.alias = r.user = r.name = alias;
            localStorage.setItem(K, JSON.stringify(arr));
          }
          break;
        }
      }
    }catch{}
  }

  // --------- Reparación preventiva (una vez al cargar) ---------
  repairAllUndefinedAliases();

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
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAliasSafe())])
    ]);

    const gameArea = el("div",{class:"sec-wrapper", id:"gameArea"},[
      el("div",{class:"sec-canvas", id:"canvas"},
        el("p",{class:"muted", style:"padding:2rem;text-align:center"},"Elige un nivel y pulsa Comenzar")
      )
    ]);

    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",disabled:true,onClick:start},"Cargando imagen…")
    ]);

    panel.appendChild(topRow);
    panel.appendChild(kpi);
    panel.appendChild(gameArea);
    panel.appendChild(nav);
    root.appendChild(panel);

    refreshLevelButtons();
    setLevel("l1");
  }

  function getImgSrc(rel){
    const baseRel = (rel.startsWith("./") || rel.startsWith("/")) ? rel : ("./" + rel);
    const abs = new URL(baseRel, document.baseURI).href;
    const v = Date.now(); // cache buster
    return abs + (abs.includes("?") ? "&" : "?") + "v=" + v;
  }

  function setLevel(lk){
    st.level = lk;
    const cfg = LEVELS[lk];
    $("#lvName").textContent = cfg.name;
    refreshLevelButtons();
    refreshBestChips();

    const canvas = $("#canvas");
    const startBtn = $("#start");
    canvas.innerHTML = "";
    st.ready = false;
    startBtn.disabled = true;
    startBtn.textContent = "Cargando imagen…";

    if (!cfg.img || !cfg.riesgos.length){
      canvas.innerHTML = '<p class="muted" style="padding:2rem;text-align:center">Nivel no disponible.</p>';
      st.svg = null; st.vw = 0; st.vh = 0;
      return;
    }

    // Loader robusto con reintento
    const tryPaths = [];
    const primary = getImgSrc(cfg.img);
    tryPaths.push(primary);
    if (!cfg.img.startsWith("./") && !cfg.img.startsWith("/")) {
      tryPaths.push(getImgSrc("./" + cfg.img));
    }

    let attempt = 0;
    const probe = new Image();

    const loadAttempt = () => {
      const src = tryPaths[attempt];
      probe.onload = function(){
        st.vw = probe.naturalWidth;
        st.vh = probe.naturalHeight;

        const svg = svgEl("svg", {
          class: "scene",
          viewBox: "0 0 " + st.vw + " " + st.vh,
          preserveAspectRatio: "xMidYMid meet"
        });

        const img = svgEl("image", { x: 0, y: 0, width: st.vw, height: st.vh });
        try { img.setAttributeNS("http://www.w3.org/1999/xlink", "href", src); } catch(_){}
        img.setAttribute("href", src);

        svg.appendChild(img);
        svg.appendChild(svgEl("g", { id: "hsLayer" }));
        svg.appendChild(svgEl("g", { id: "labelLayer" })); // marcadores/labels
        canvas.appendChild(svg);

        st.svg = svg;
        st.ready = true;
        startBtn.disabled = false;
        startBtn.textContent = "Comenzar";
        startBtn.onclick = start;
      };

      probe.onerror = function(){
        attempt++;
        if (attempt < tryPaths.length) {
          loadAttempt();
        } else {
          canvas.innerHTML = '<p style="padding:2rem;text-align:center;color:#b91c1c">No puedo cargar la imagen: ' + cfg.img + '</p>';
          st.svg = null; st.vw = 0; st.vh = 0; st.ready = false;
          startBtn.disabled = true;
          startBtn.textContent = "Imagen no disponible";
        }
      };

      probe.src = src;
    };

    loadAttempt();
  }

  function refreshLevelButtons(){
    ["btnL1","btnL2","btnL3","btnL4"].forEach(function(id,i){
      const b = document.getElementById(id); if (!b) return;
      const lk = "l"+(i+1);
      if (st.level === lk) b.classList.add("active"); else b.classList.remove("active");
    });
  }
  function refreshBestChips(){
    const gameKey = GAME_ID+"-"+st.level;
    const best = bestLocal(gameKey);
    const blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor nivel: "+best;
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);
  }

  // ---------- Juego ----------
  function start(){
    const cfg = LEVELS[st.level];
    if (!st.ready) { alert("Cargando imagen…"); return; }
    if (!cfg || !cfg.riesgos.length) { alert("Este nivel no está disponible todavía."); return; }

    st.running = true;
    st.tLeft = cfg.time;
    st.score = 0;
    st.found = 0;
    st.misses = 0;
    st.hotspots = cfg.riesgos.map((r, i) => ({ idx:i+1, nombre:r.nombre, coords:r.coords, found:false, el:null }));

    $("#s").textContent = "0";
    $("#f").textContent = "0 / " + st.hotspots.length;
    $("#m").textContent = "0";
    $("#t").textContent = String(st.tLeft);

    renderHotspotsSVG();
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
    $("#start").style.display = "none";
  }

  function renderHotspotsSVG(){
    const layer = st.svg ? st.svg.querySelector("#hsLayer") : null;
    if (st.svg && layer){
      layer.innerHTML = "";
      st.hotspots.forEach(function(spot){
        const x = pctToUnits(spot.coords[0], st.vw);
        const y = pctToUnits(spot.coords[1], st.vh);
        const w = pctToUnits(spot.coords[2], st.vw);
        const h = pctToUnits(spot.coords[3], st.vh);
        const r = svgEl("rect", { x: x, y: y, width: w, height: h, class: "hs" });
        r.addEventListener("click", function(evt){
          evt.preventDefault(); evt.stopPropagation();
          onHotspotClick(spot, r);
        }, true);
        layer.appendChild(r);
        spot.el = r;
      });
      st.svg.addEventListener("click", onMissClickSvg, { once: true });
    }
  }

  function onMissClickSvg(e){
    if (e && e.target && e.target.classList && e.target.classList.contains("hs")) return;
    onMissClick();
    if (st.svg) st.svg.addEventListener("click", onMissClickSvg, { once: true });
  }

  function onMissClick(){
    if (!st.running || st.lock) return;
    st.misses++;
    st.score = Math.max(0, st.score - 25);
    $("#s").textContent = String(st.score);
    $("#m").textContent = String(st.misses);
  }

  function onHotspotClick(spot, node){
    if (!st.running || st.lock || spot.found) return;
    st.lock = true;
    spot.found = true;

    if (node) node.setAttribute("class","hs found");
    st.found++;
    st.score += 100;
    $("#s").textContent = String(st.score);
    $("#f").textContent = st.found + " / " + st.hotspots.length;

    if (st.found === st.hotspots.length) { end(true); }
    setTimeout(function(){ st.lock = false; }, 100);
  }

  function tick(){
    if (!st.running) return;
    st.tLeft -= 0.016;
    if (st.tLeft <= 0){
      st.tLeft = 0; $("#t").textContent = "0"; end(false); return;
    }
    $("#t").textContent = String(Math.ceil(st.tLeft));
    st.raf = requestAnimationFrame(tick);
  }

  // ---------- Resumen con marcadores numerados ----------
  function drawNumberMarker(x, y, color, text){
    const labelLayer = st.svg.querySelector("#labelLayer");
    const r = Math.max(12, Math.round(st.vw * 0.015));
    const cx = x + r;
    const cy = y + r;

    const circle = svgEl("circle", {
      cx, cy, r,
      fill: (color==='g' ? '#16a34a' : '#b91c1c'),
      stroke: '#000', 'stroke-width': 1, 'fill-opacity': 0.95
    });
    const t = svgEl("text", { x: cx, y: cy, class: 'num' });
    t.textContent = String(text);

    labelLayer.appendChild(circle);
    labelLayer.appendChild(t);
  }

  function end(won){
    cancelAnimationFrame(st.raf);
    st.running = false;
    if (won) st.score += Math.round(st.tLeft * 10);

    // Limpia marcadores anteriores
    const labelLayer = st.svg ? st.svg.querySelector("#labelLayer") : null;
    if (labelLayer) labelLayer.innerHTML = "";

    const foundList  = [];
    const missedList = [];

    // Marcar cada hotspot y preparar listas
    st.hotspots.forEach(spot => {
      if (!spot.el) return;
      const x = Number(spot.el.getAttribute("x"));
      const y = Number(spot.el.getAttribute("y"));
      if (spot.found){
        spot.el.setAttribute("class","hs found");
        drawNumberMarker(x, y, 'g', spot.idx);
        foundList.push(spot);
      } else {
        spot.el.setAttribute("class","hs missed");
        drawNumberMarker(x, y, 'r', spot.idx);
        missedList.push(spot);
      }
      spot.el.style.cursor = "default";
    });

    // === Guardar puntuación EXACTAMENTE como en calculo.js ===
    const gameKey = GAME_ID + "-" + st.level;
    if (typeof saveLocalScore === "function") saveLocalScore(gameKey, st.score);

    // Normaliza el último registro de este juego para que tenga nombre
    normalizeLastScoreForGame(gameKey);

    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);

    // --------- UI de resultado ----------
    root.innerHTML = "";
    const panel = el("div",{class:"mt-panel"});
    panel.appendChild(el("h2",{},"🏁 Resultado"));
    panel.appendChild(el("div",{}, (won ? "✅ Riesgos localizados" : "⏱ Tiempo agotado")));
    panel.appendChild(el("div",{},"Nivel: "+LEVELS[st.level].name));
    panel.appendChild(el("div",{},"Puntuación: "+st.score));
    panel.appendChild(el("div",{}, `Riesgos encontrados: ${st.found} / ${st.hotspots.length}`));
    panel.appendChild(el("div",{}, "Clics erróneos: " + st.misses));

    // Tablero con los marcadores
    const wrap = el("div",{class:"sec-wrapper"});
    const canv = el("div",{class:"sec-canvas"});
    canv.appendChild(st.svg);
    wrap.appendChild(canv);
    panel.appendChild(wrap);

    // Listas
    if (foundList.length){
      panel.appendChild(el("h3",{style:"margin:.8rem 0 .3rem"},"Riesgos encontrados"));
      const cont = el("div",{class:"chip-list"});
      foundList.sort((a,b)=>a.idx-b.idx).forEach(sp=>{
        cont.appendChild(
          el("div",{class:"chip"},[
            el("span",{class:"dot g"}, String(sp.idx)),
            el("span",{}, sp.nombre)
          ])
        );
      });
      panel.appendChild(cont);
    }
    if (missedList.length){
      panel.appendChild(el("h3",{style:"margin:.8rem 0 .3rem"},"Riesgos no encontrados"));
      const cont = el("div",{class:"chip-list"});
      missedList.sort((a,b)=>a.idx-b.idx).forEach(sp=>{
        cont.appendChild(
          el("div",{class:"chip"},[
            el("span",{class:"dot r"}, String(sp.idx)),
            el("span",{}, sp.nombre)
          ])
        );
      });
      panel.appendChild(cont);
    }

    // Botón: evitar duplicados → SOLO layout()
    panel.appendChild(
      el("div",{class:"qz-meta",style:"margin-top:.6rem"},[
        el("button",{class:"btn btn-primary",onClick:function(){ layout(); }},"Jugar de nuevo")
      ])
    );
    root.appendChild(panel);
  }

  // ---------- Inicio ----------
  injectCss();
  layout();
}
