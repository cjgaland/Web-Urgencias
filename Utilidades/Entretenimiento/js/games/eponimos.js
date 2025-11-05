'use strict';
// ======================
// 🏷️ Epónimos médicos (quiz 4 opciones)
// - 10 preguntas por partida
// - 20 s por pregunta
// - Ranking clave: "eponimos"
// - Revisión de fallos al final
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {

  // ---------- Config ----------
  var TOTAL_Q    = 10;
  var TIME_PER_Q = 20000; // ms

  // ---------- Estado ----------
  var st = {
    ready: false,
    running: false,
    qIdx: 0,
    score: 0,
    hits: 0,
    misses: 0,
    streak: 0,
    bank: [],      // banco normalizado
    quiz: [],      // preguntas seleccionadas
    tDeadline: 0,
    raf: 0,
    review: []     // { enunciado, correcta }
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
  function injectCss(){
    if (document.getElementById("epon-css")) return;
    var css = [
      '.mt-panel{width:min(860px,100%);display:grid;gap:.9rem}',
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
      '.q-text{font-size:1.05rem;font-weight:700;text-align:center;letter-spacing:.2px}',
      '.opts{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:.5rem}',
      '.opts button{padding:.65rem .8rem;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;text-align:center;cursor:pointer;font-size:1rem}',
      '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-start}',
      '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
      '.btn-primary{background:#0d6efd;color:#fff}',
      '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,0.12)}',
      '.review{background:#fff;border:1px solid #eef;border-radius:10px;padding:.8rem}',
      '.review h3{margin:.1rem 0 .6rem;font-size:1.05rem}',
      '.review table{width:100%;border-collapse:collapse}',
      '.review th,.review td{padding:.5rem;border-top:1px solid #eee;text-align:left}',
      '.review th{background:#f8fafc}'
    ].join('');
    var s = document.createElement("style");
    s.id = "epon-css";
    s.textContent = css;
    document.head.append(s);
  }

  // ---------- Datos ----------
  async function loadBank(){
    var urls = [
      "../../data/eponimos.json",
      "../data/eponimos.json",
      "./data/eponimos.json"
    ];
    var lastErr = null, raw = null;
    for (var i=0;i<urls.length;i++){
      try{
        var r = await fetch(urls[i] + "?t=" + Date.now(), {cache:"no-store"}); // Añadido cache-buster
        if (r.ok){ raw = await r.json(); break; }
      }catch(e){ lastErr = e; }
    }
    if (!raw) throw (lastErr || new Error("No se pudo cargar eponimos.json"));

    // Normaliza a { eponimo, pregunta, correcta (texto), distractores[3] }
    function toItem(it){
      it = it || {};
      var ep = (it.epónimo || it.eponimo || it.nombre || "").toString().trim();
      var pregunta = (it.pregunta || "").toString().trim();

      // Esquema A: opciones[] + correcta (índice)
      if (Array.isArray(it.opciones) && typeof it.correcta !== "undefined"){
        var opts = it.opciones.map(function(x){ return String(x||"").trim(); }).filter(Boolean);
        var idx  = Number(it.correcta);
        if (opts.length >= 4 && idx >= 0 && idx < opts.length){
          var ok = opts[idx];
          var ds = opts.filter(function(_,i){ return i !== idx; }).slice(0,3);
          if (pregunta && ok && ds.length === 3) {
            return { eponimo: ep, pregunta: pregunta, correcta: ok, distractores: ds };
          }
          return null;
        }
        return null;
      }

      // Esquema B: correcta texto + distractores[3]
      var okText = (it.correcta || it.respuesta || "").toString().trim();
      var dsList = Array.isArray(it.distractores) ? it.distractores.map(function(x){return String(x).trim();}) : [];
      if (pregunta && okText && dsList.length >= 3) {
        return { eponimo: ep, pregunta: pregunta, correcta: okText, distractores: dsList.slice(0, 3) };
      }
      return null;
    }

    var out = [];
    for (var j=0;j<raw.length;j++){
      var norm = toItem(raw[j]);
      if (norm) out.push(norm);
    }
    st.bank = out.filter(function(x){
      return x && x.pregunta && x.correcta && Array.isArray(x.distractores) && x.distractores.length === 3;
    });
  }

  function buildQuiz(){
    var pool = shuffle(st.bank.slice());
    var take = Math.min(TOTAL_Q, pool.length);
    var qs = [];
    for (var i=0;i<take;i++){
      var it = pool[i];
      var qText = it.pregunta.replace(/\s+$/, '');
      if (!/rov|signo|síndrome|triada|maniobra|prueba|escala/i.test(qText) && it.eponimo){
        qText = it.eponimo + ": " + qText;
      }
      var opts = shuffle([it.correcta].concat(it.distractores.slice(0,3)));
      qs.push({ enunciado: qText, correcta: it.correcta, opciones: opts });
    }
    st.quiz = qs;
  }

  // ---------- UI ----------
  function layout(){
    root.innerHTML = "";
    var panel = el("div",{class:"mt-panel"});

    var kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Pregunta"), el("div",{id:"qi"},"0 / "+TOTAL_Q)]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"—")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box",id:"box-hits"},[el("div",{class:"muted"},"Aciertos"), el("div",{id:"h"},"0")]),
      el("div",{class:"box",id:"box-miss"},[el("div",{class:"muted"},"Fallos"), el("div",{id:"m"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAlias()||"Anónimo")])
    ]);

    var q = el("div",{class:"q-text",id:"q"},"Cargando banco de epónimos…");
    var opts = el("div",{class:"opts",id:"opts"});
    
    // --- 👇 CORRECCIÓN 1 ---
    // Eliminados botones "Volver" y "Ver ranking"
    var nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:start,disabled:true},"Comenzar")
    ]);
    // --- 👆 FIN CORRECCIÓN 1 ---

    panel.append(kpi,q,opts,nav);
    root.append(panel);
    window.addEventListener("keydown", onKey);

    if (typeof updateBestBadge === "function") updateBestBadge("eponimos");
  }

  function enableStartUI(){
    var startBtn = $("#start");
    var qEl = $("#q");
    if (startBtn) startBtn.disabled = false;
    if (qEl) qEl.textContent = "Pulsa Comenzar para iniciar la partida";
  }

  function showEmptyBankMessage(){
    var startBtn = $("#start");
    var qEl = $("#q");
    if (startBtn) startBtn.disabled = true;
    if (qEl) qEl.textContent = "No hay suficientes preguntas válidas en eponimos.json.";
  }

  function onKey(e){
    if (!st.running) return;
    var n = Number(e.key);
    if (n>=1 && n<=4){
      var btns = $("#opts").querySelectorAll("button");
      if (btns[n-1]) btns[n-1].click();
    }
  }

  function start(){
    if (!st.ready || !st.bank.length){
      return;
    }
    st.running = true;
    st.qIdx = 0; st.score = 0; st.hits = 0; st.misses = 0; st.streak = 0; st.review = [];
    $("#s").textContent = "0"; $("#h").textContent = "0"; $("#m").textContent = "0";
    $("#qi").textContent = "1 / "+TOTAL_Q;
    
    // Ocultar botón de start
    var startBtn = $("#start");
    if (startBtn) startBtn.style.display = "none";

    buildQuiz();
    if (!st.quiz.length){
      st.running = false;
      showEmptyBankMessage();
      return;
    }
    nextQuestion();
  }

  function renderOptions(optsArr){
    var cont = $("#opts");
    cont.innerHTML = "";

    for (var i=0;i<optsArr.length;i++){
      var v = optsArr[i];
      var b = el("button", {"data-val": String(v)}, String(v));
      b.addEventListener("click", onPickBtn);
      cont.append(b);
    }
  }

  function onPickBtn(e){
    var val = String(e.currentTarget.getAttribute("data-val"));
    pick(val);
  }

  function nextQuestion(){
    if (st.qIdx >= st.quiz.length){ end(); return; }
    var q = st.quiz[st.qIdx];
    $("#q").textContent = q.enunciado;
    renderOptions(q.opciones);

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
      st.review.push({ enunciado: q.enunciado, correcta: q.correcta });
      st.qIdx++;
      $("#qi").textContent = (st.qIdx+1> TOTAL_Q ? TOTAL_Q : (st.qIdx+1)) + " / " + TOTAL_Q;
      
      // Auto-avance
      setTimeout(nextQuestion, 300); // Pequeño delay
    } else {
      st.raf = requestAnimationFrame(tick);
    }
  }

  function pick(val){
    if (!st.running) return;
    cancelAnimationFrame(st.raf);

    var q = st.quiz[st.qIdx];
    var correct = String(q.correcta);
    disableOptions();
    
    var correctBtn = null, pickedBtn = null;
    $("#opts").querySelectorAll("button").forEach(function(b){
        if (b.getAttribute("data-val") === correct) correctBtn = b;
        if (b.getAttribute("data-val") === val) pickedBtn = b;
    });

    if (val === correct){
      if (pickedBtn) {
        pickedBtn.style.background = "#dcfce7"; // Verde
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
        pickedBtn.style.background = "#fee2e2"; // Rojo
        pickedBtn.style.borderColor = "#fca5a5";
      }
      if (correctBtn) {
        correctBtn.style.background = "#dcfce7"; // Verde
        correctBtn.style.borderColor = "#86efac";
      }
      
      st.misses++;
      st.streak = 0;
      $("#m").textContent = String(st.misses);
      st.review.push({ enunciado: q.enunciado, correcta: q.correcta });
    }

    st.qIdx++;
    $("#qi").textContent = (st.qIdx+1> TOTAL_Q ? TOTAL_Q : (st.qIdx+1)) + " / " + TOTAL_Q;
    
    // Auto-avance
    setTimeout(nextQuestion, 600); // Delay más largo para ver respuesta
  }

  function end(){
    st.running = false;
    cancelAnimationFrame(st.raf);

    if (!st.quiz.length){
      showEmptyBankMessage();
      return;
    }

    if (typeof saveLocalScore === "function") saveLocalScore("eponimos", st.score);
    if (typeof updateBestBadge === "function") updateBestBadge("eponimos");

    var reviewBlock = null;
    if (st.review.length){
      var table = el("table",{},[
        el("thead",{}, el("tr",{},[ el("th",{},"Pregunta"), el("th",{},"Respuesta correcta") ])),
        el("tbody",{}, st.review.map(function(row){
          return el("tr",{},[ el("td",{}, row.enunciado), el("td",{}, row.correcta) ]);
        }))
      ]);
      reviewBlock = el("div",{class:"review"},[
        el("h3",{},"Revisión de fallos"),
        table
      ]);
    }

    var panel = el("div",{class:"mt-panel"},[
      el("h2",{},"🏁 Resultado"),
      el("div",{},"Epónimos médicos"),
      el("div",{},"Preguntas: "+st.quiz.length),
      el("div",{},"Aciertos: "+st.hits),
      el("div",{},"Fallos: "+st.misses),
      el("div",{},"Puntuación: "+st.score),
      reviewBlock ? reviewBlock : null,
      
      // --- 👇 CORRECCIÓN 2 ---
      // Eliminados botones "Volver" y "Ranking"
      el("div",{class:"qz-meta",style:"margin-top:.6rem"},[
        el("button",{class:"btn btn-primary",onClick:function(){ layout(); enableStartUI(); }},"Volver a jugar")
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
    await loadBank();
    if (st.bank.length >= 1){
      st.ready = true;
      enableStartUI();
      if (typeof updateBestBadge === "function") updateBestBadge("eponimos");
    } else {
      showEmptyBankMessage();
    }
  }catch(e){
    var qEl = $("#q");
    if (qEl) qEl.textContent = "No se pudo cargar el banco de epónimos (eponimos.json).";
  }
}