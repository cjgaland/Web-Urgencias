'use strict';
// ======================
// 🗺️ Geografía Ibérica (dos modos)
// - Modo "locprov": ¿A qué provincia pertenece «LOCALIDAD»? → opciones: provincias
// - Modo "provloc": ¿Cuál de estas localidades pertenece a «PROVINCIA»? → opciones: localidades
// Partida: 10 preguntas, 20 s/ítem, bonus rapidez (<5 s) y racha (≥2)
// Ranking por modo: "iberico-locprov" y "iberico-provloc"
// Requiere: ../data/iberico.json con { poblacion|municipio, provincia }
// Compatible con games-core.js (initGame)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {

  // ---------- Config ----------
  var TOTAL_Q = 10;
  var TIME_PER_Q = 20000; // 20 s
  var MODES = {
    locprov: { key: "iberico-locprov", name: "Localidad → Provincia" },
    provloc: { key: "iberico-provloc", name: "Provincia → Localidad" }
  };

  // ---------- Estado ----------
  var st = {
    mode: "locprov",
    running: false,
    qIdx: 0,
    score: 0,
    hits: 0,
    misses: 0,
    streak: 0,
    data: [],        // [{poblacion, provincia}]
    quiz: [],        // [{qText, correct, options[4], meta}]
    tDeadline: 0,
    raf: 0,
    review: []       // [{left,right}] (según modo)
  };

  // ---------- Utils ----------
  function $(s, el){ return (el||root).querySelector(s); }
  function el(tag, attrs, children){
    var n = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs){
      var v = attrs[k];
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
  function shuffle(a){
    return a.map(function(v){return [Math.random(),v];})
            .sort(function(x,y){return x[0]-y[0];})
            .map(function(x){return x[1];});
  }
  function uniq(arr){
    var m = Object.create(null), out = [];
    for (var i=0;i<arr.length;i++){
      var v = String(arr[i]).trim();
      if (!m[v] && v) { m[v]=1; out.push(v); }
    }
    return out;
  }

  function injectCss(){
    if (document.getElementById("iberico-css")) return;
    var css = [
      '.mt-panel{width:min(860px,100%);display:grid;gap:.9rem}',
      '.modebar{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}',
      '.modebar .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:.45rem .75rem;font-weight:700;cursor:pointer}',
      '.modebar .btn.active{background:#003a6b;color:#fff;border-color:#003a6b}',
      '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}',
      '.kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem}',
      '.kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center}',
      '.kpi .box .muted{font-size:.85rem;color:#6b7280}',
      '.kpi .box div:last-child{font-weight:700;font-size:1.1rem}',
      '#box-hits{background:#dcfce7;border-color:#86efac}',
      '#box-hits .muted{color:#15803d}',
      '#box-hits div:last-child{color:#166534}',
      '#box-miss{background:#fee2e2;border-color:#fca5a5}',
      '#box-miss .muted{color:#b91c1c}',
      '#box-miss div:last-child{color:#991b1b}',
      '.q-text{font-size:1.15rem;font-weight:700;text-align:center;letter-spacing:.2px}',
      '.opts{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:.5rem}',
      '.opts button{padding:.65rem .8rem;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;text-align:center;cursor:pointer;font-size:1rem}',
      '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-start}',
      '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
      '.btn-primary{background:#0d6efd;color:#fff}',
      '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,0.12)}',
      /* revisión */
      '.review{background:#fff;border:1px solid #eef;border-radius:10px;padding:.8rem}',
      '.review h3{margin:.1rem 0 .6rem;font-size:1.05rem}',
      '.review table{width:100%;border-collapse:collapse}',
      '.review th,.review td{padding:.5rem;border-top:1px solid #eee;text-align:left}',
      '.review th{background:#f8fafc}'
    ].join('');
    var s = document.createElement("style");
    s.id = "iberico-css";
    s.textContent = css;
    document.head.append(s);
  }

  // ---------- Carga de datos ----------
  async function loadData(){
    var urls = [
      "./data/iberico.json",
      "../data/iberico.json",
      "../../data/iberico.json"
    ];
    var lastErr = null, raw=null;
    for (var i=0;i<urls.length;i++){
      try{
        var r = await fetch(urls[i] + "?t=" + Date.now(), {cache:"no-store"}); // cache-buster
        if (r.ok){ raw = await r.json(); break; }
      }catch(e){ lastErr = e; }
    }
    if (!raw) throw (lastErr || new Error("No se pudo cargar iberico.json"));

    // Normaliza y limpia
    var out = [];
    for (var j=0;j<raw.length;j++){
      var it = raw[j] || {};
      var pobl = (it.poblacion || it.Poblacion || it.municipio || it.Municipio || "").toString().trim();
      var prov = (it.provincia || it.Provincia || "").toString().trim();
      if (pobl && prov) out.push({ poblacion: pobl, provincia: prov });
    }
    var seen = Object.create(null), clean = [];
    for (var k=0;k<out.length;k++){
      var key = out[k].poblacion+"|"+out[k].provincia;
      if (!seen[key]){ seen[key]=1; clean.push(out[k]); }
    }
    st.data = clean;
  }

  // ---------- Generación de preguntas ----------
  function buildQuiz(){
    var pool = shuffle(st.data.slice());
    var take = Math.min(TOTAL_Q, pool.length);
    var qs = [];

    var allProv = uniq(pool.map(function(x){return x.provincia;}));
    var allPobl = uniq(pool.map(function(x){return x.poblacion;}));

    for (var i=0;i<take;i++){
      var item = pool[i];

      if (st.mode === "locprov"){
        var correctProv = item.provincia;
        var qText1 = "¿A qué provincia pertenece «"+ item.poblacion +"»?";
        var options1 = buildOptionsProvincia(correctProv, allProv);
        qs.push({ qText:qText1, correct:correctProv, options:options1, meta:item });

      } else {
        var correctLoc = item.poblacion;
        var prov = item.provincia;
        var qText2 = "¿Cuál de estas localidades pertenece a «"+ prov +"»?";
        var options2 = buildOptionsLocalidad(correctLoc, prov, pool, allPobl);
        qs.push({ qText:qText2, correct:correctLoc, options:options2, meta:item });
      }
    }
    st.quiz = qs;
  }

  function buildOptionsProvincia(correctProv, allProv){
    var avoid = Object.create(null);
    avoid[correctProv] = 1;
    var distract = [];
    var shuffled = shuffle(allProv.slice());
    for (var i=0;i<shuffled.length && distract.length<3;i++){
      var p = shuffled[i];
      if (!avoid[p]){ avoid[p]=1; distract.push(p); }
    }
    return shuffle([correctProv].concat(distract)).slice(0,4);
  }

  function buildOptionsLocalidad(correctLoc, prov, pool, allPobl){
    var avoid = Object.create(null);
    avoid[correctLoc] = 1;

    var opts = [correctLoc];

    var shuffled = shuffle(pool.slice());
    for (var i=0;i<shuffled.length && opts.length<4;i++){
      var it = shuffled[i];
      if (it.provincia === prov) continue;
      var cand = it.poblacion;
      if (!avoid[cand]){ avoid[cand]=1; opts.push(cand); }
    }

    if (opts.length < 4){
      var more = shuffle(allPobl.slice());
      for (var j=0;j<more.length && opts.length<4;j++){
        var m = more[j];
        if (!avoid[m]){ avoid[m]=1; opts.push(m); }
      }
    }
    return shuffle(opts).slice(0,4);
  }

  // ---------- UI ----------
  function layout(){
    root.innerHTML = "";
    var panel = el("div",{class:"mt-panel"});

    var top = el("div",{class:"modebar"},[
      el("button",{class:"btn",id:"btnLocProv",onClick:function(){setMode("locprov");}},"Localidad → Provincia"),
      el("button",{class:"btn",id:"btnProvLoc",onClick:function(){setMode("provloc");}},"Provincia → Localidad"),
      el("span",{class:"badge",id:"modeName",style:"margin-left:.5rem"},"Localidad → Provincia"),
      el("span",{class:"badge",id:"bestLocalChip",style:"margin-left:auto"},"Mejor (modo): —")
    ]);

    var kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Pregunta"), el("div",{id:"qi"},"0 / "+TOTAL_Q)]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"—")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box",id:"box-hits"},[el("div",{class:"muted"},"Aciertos"), el("div",{id:"h"},"0")]),
      el("div",{class:"box",id:"box-miss"},[el("div",{class:"muted"},"Fallos"), el("div",{id:"m"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAlias()||"Anónimo")])
    ]);

    var q = el("div",{class:"q-text",id:"q"},"Elige un modo y pulsa Comenzar");
    var opts = el("div",{class:"opts",id:"opts"});

    // --- 👇 CORRECCIÓN 1 ---
    // Eliminados botones "Volver" y "Ver ranking"
    var nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:start},"Comenzar")
    ]);
    // --- 👆 FIN CORRECCIÓN 1 ---

    panel.append(top,kpi,q,opts,nav);
    root.append(panel);
    window.addEventListener("keydown", onKey);
    refreshModeButtons();
    refreshBestChip();
  }

  function refreshModeButtons(){
    var a = $("#btnLocProv"), b = $("#btnProvLoc");
    if (!a || !b) return;
    if (st.mode === "locprov"){ a.classList.add("active"); b.classList.remove("active"); }
    else { b.classList.add("active"); a.classList.remove("active"); }
  }
  function setMode(mode){
    st.mode = mode;
    $("#modeName").textContent = MODES[mode].name;
    refreshModeButtons();
    refreshBestChip();
  }

  function bestLocal(gameKey){
    try{
      var arr = JSON.parse(localStorage.getItem("urgent-games-scores")||"[]")
        .filter(function(x){ return x.game === gameKey; });
      if (!arr.length) return 0;
      var max = 0;
      for (var i=0;i<arr.length;i++){
        var n = Number(arr[i].score)||0;
        if (n > max) max = n;
      }
      return max;
    }catch(e){ return 0; }
  }
  function refreshBestChip(){
    var key = MODES[st.mode].key;
    var best = bestLocal(key);
    var blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor (modo): "+best;
    if (typeof updateBestBadge === "function") updateBestBadge(key);
  }

  // ---------- Lógica ----------
  function onKey(e){
    if (!st.running) return;
    var n = Number(e.key);
    if (n>=1 && n<=4){
      var btns = $("#opts").querySelectorAll("button");
      if (btns[n-1]) btns[n-1].click();
    }
  }

  function start(){
    st.running = true;
    st.qIdx = 0; st.score = 0; st.hits = 0; st.misses = 0; st.streak = 0; st.review = [];
    $("#s").textContent = "0"; $("#h").textContent = "0"; $("#m").textContent = "0";
    $("#qi").textContent = "1 / "+TOTAL_Q;
    
    // Ocultar botón de start
    var startBtn = $("#start");
    if (startBtn) startBtn.style.display = "none";

    buildQuiz();
    nextQuestion();
  }

  function nextQuestion(){
    if (st.qIdx >= st.quiz.length){ end(); return; }
    var q = st.quiz[st.qIdx];
    $("#q").textContent = q.qText;

    var cont = $("#opts"); cont.innerHTML = "";
    for (var i=0;i<q.options.length;i++){
      var v = q.options[i];
      var b = el("button", {"data-val": String(v)}, String(v));
      b.addEventListener("click", onPick);
      cont.append(b);
    }

    st.tDeadline = performance.now() + TIME_PER_Q;
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  function disableOptions(){
    var cont = $("#opts");
    if (!cont) return;
    cont.querySelectorAll("button").forEach(function(b){
      b.disabled = true;
      b.style.opacity = 0.8;
      b.style.cursor = "default";
    });
  }

  function tick(){
    var left = Math.max(0, st.tDeadline - performance.now());
    $("#t").textContent = String(Math.ceil(left/1000));
    if (left <= 0){
      cancelAnimationFrame(st.raf);
      var q = st.quiz[st.qIdx];
      st.misses++;
      st.streak = 0;
      $("#m").textContent = String(st.misses);
      disableOptions();
      
      if (st.mode === "locprov"){
        st.review.push({ left: q.meta.poblacion, right: q.correct });
      } else {
        st.review.push({ left: q.meta.provincia, right: q.correct });
      }
      st.qIdx++;
      $("#qi").textContent = (st.qIdx+1> TOTAL_Q ? TOTAL_Q : (st.qIdx+1)) + " / " + TOTAL_Q;
      
      // Auto-avance
      setTimeout(nextQuestion, 300);
    } else {
      st.raf = requestAnimationFrame(tick);
    }
  }

  function onPick(e){
    if (!st.running) return;
    cancelAnimationFrame(st.raf);

    var val = String(e.currentTarget.getAttribute("data-val"));
    var q = st.quiz[st.qIdx];
    var correct = String(q.correct);

    disableOptions();

    var correctBtn = null, pickedBtn = null;
    $("#opts").querySelectorAll("button").forEach(function(b){
        if (b.getAttribute("data-val") === correct) correctBtn = b;
        if (b.getAttribute("data-val") === val) pickedBtn = b;
    });

    if (val === correct){
      if (pickedBtn) {
        pickedBtn.style.background = "#dcfce7";
        pickedBtn.style.borderColor = "#86efac";
      }
      
      st.hits++;
      var timeLeft = Math.max(0, st.tDeadline - performance.now());
      var fastBonus = (timeLeft > 15000) ? 5 : 0;
      var streakBonus = (st.streak >= 2) ? 2 : 0;
      st.score += (10 + fastBonus + streakBonus);
      st.streak++;
      $("#h").textContent = String(st.hits);
      $("#s").textContent = String(st.score);
    } else {
      if (pickedBtn) {
        pickedBtn.style.background = "#fee2e2";
        pickedBtn.style.borderColor = "#fca5a5";
      }
      if (correctBtn) {
        correctBtn.style.background = "#dcfce7";
        correctBtn.style.borderColor = "#86efac";
      }
      
      st.misses++;
      st.streak = 0;
      $("#m").textContent = String(st.misses);
      
      if (st.mode === "locprov"){
        st.review.push({ left: q.meta.poblacion, right: correct });
      } else {
        st.review.push({ left: q.meta.provincia, right: correct });
      }
    }

    st.qIdx++;
    $("#qi").textContent = (st.qIdx+1> TOTAL_Q ? TOTAL_Q : (st.qIdx+1)) + " / " + TOTAL_Q;
    
    // Auto-avance
    setTimeout(nextQuestion, 600);
  }

  function end(){
    st.running = false;
    cancelAnimationFrame(st.raf);

    var key = MODES[st.mode].key;
    if (typeof saveLocalScore === "function") saveLocalScore(key, st.score);
    if (typeof updateBestBadge === "function") updateBestBadge(key);

    var reviewBlock = null;
    if (st.review.length){
      var th1 = (st.mode==="locprov") ? "Localidad" : "Provincia";
      var th2 = (st.mode==="locprov") ? "Provincia correcta" : "Localidad correcta";
      var table = el("table",{},[
        el("thead",{}, el("tr",{},[ el("th",{},th1), el("th",{},th2) ])),
        el("tbody",{}, st.review.map(function(row){
          return el("tr",{},[ el("td",{}, row.left), el("td",{}, row.right) ]);
        }))
      ]);
      reviewBlock = el("div",{class:"review"},[
        el("h3",{},"Revisión de fallos"),
        table
      ]);
    }

    var panel = el("div",{class:"mt-panel"},[
      el("h2",{},"🏁 Resultado"),
      el("div",{},""+MODES[st.mode].name),
      el("div",{},"Preguntas: "+st.quiz.length),
      el("div",{},"Aciertos: "+st.hits),
      el("div",{},"Fallos: "+st.misses),
      el("div",{},"Puntuación: "+st.score),
      reviewBlock ? reviewBlock : null,
      
      // --- 👇 CORRECCIÓN 2 ---
      // Eliminados botones "Volver" y "Ranking"
      el("div",{class:"qz-meta",style:"margin-top:.6rem"},[
        el("button",{class:"btn btn-primary",onClick:function(){ layout(); }},"Volver a jugar")
      ])
      // --- 👆 FIN CORRECCIÓN 2 ---
    ]);

    root.innerHTML = "";
    root.append(panel);
  }

  // ---------- Inicio ----------
  injectCss();
  layout();
  try{
    await loadData();
  }catch(e){
    $("#q").textContent = "No se pudo cargar el banco ibérico (iberico.json).";
    return;
  }
  setMode("locprov");
}