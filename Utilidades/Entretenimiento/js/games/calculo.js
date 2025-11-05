// ======================
// 🧮 Cálculo mental por niveles (L1–L4)
// KPI: Tiempo, Puntos, Aciertos (verde), Fallos (rojo), Racha, Jugador
// Ranking independiente por nivel: calculo-l1 .. calculo-l4
// Compatible con games-core.js (initGame)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  var ROUND_MS = 60000; // 60 s
  var LEVELS = {
    l1: { ops: 1, mult: 1.0, name: "Nivel 1 (1 operador)" },
    l2: { ops: 2, mult: 1.5, name: "Nivel 2 (2 operadores)" },
    l3: { ops: 3, mult: 2.0, name: "Nivel 3 (3 operadores)" },
    l4: { ops: 4, mult: 3.0, name: "Nivel 4 (4 operadores)" }
  };
  var NICE_OPS = ["+", "−", "×", "÷"]; // representación visual

  // ---------- Estado ----------
  var st = {
    level: "l1",
    running: false,
    tEnd: 0,
    raf: 0,
    score: 0,
    streak: 0,
    hits: 0,
    misses: 0,
    qCount: 0,
    ans: 0
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
  function rnd(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function shuffle(a){
    return a.map(function(v){return [Math.random(),v];})
            .sort(function(x,y){return x[0]-y[0];})
            .map(function(x){return x[1];});
  }

  function injectCss(){
    if (document.getElementById("calc-level-css")) return;
    var css = [
      '.mt-panel{width:min(760px,100%);display:grid;gap:.9rem}',
      '.levelbar{display:flex;gap:.4rem;flex-wrap:wrap}',
      '.levelbar .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:.45rem .75rem;font-weight:700;cursor:pointer}',
      '.levelbar .btn.active{background:#003a6b;color:#fff;border-color:#003a6b}',
      '.kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem}',
      '.kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center}',
      '.kpi .box .muted{font-size:.85rem;color:#6b7280}',
      '.kpi .box div:last-child{font-weight:700;font-size:1.1rem}',
      '#box-hits{background:#dcfce7;border-color:#86efac}',
      '#box-hits .muted{color:#15803d}',
      '#box-hits div:last-child{color:#166534}',
      '#box-misses{background:#fee2e2;border-color:#fca5a5}',
      '#box-misses .muted{color:#b91c1c}',
      '#box-misses div:last-child{color:#991b1b}',
      '.mt-q{font-size:1.6rem;font-weight:800;letter-spacing:.5px;text-align:center;margin-top:.5rem}',
      '.mt-opts{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:.5rem}',
      '.mt-opts button{padding:.65rem .8rem;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;text-align:center;cursor:pointer;font-size:1.1rem}',
      '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content: flex-start;margin-top: .75rem;',
      '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
      '.btn-primary{background:#0d6efd;color:#fff}',
      '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,.12)}',
      '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}'
    ].join('');
    var s = document.createElement("style");
    s.id = "calc-level-css";
    s.textContent = css;
    document.head.append(s);
  }

  // ---------- Evaluador seguro con precedencia (sin eval) ----------
  function evalPretty(exprPretty){
    var tokens = exprPretty.split(' ');
    // Pasa 1: × y ÷
    var tmp = [];
    var i = 0;
    while (i < tokens.length){
      var t = tokens[i];
      if (t === '×' || t === '÷'){
        var a = Number(tmp.pop());
        var b = Number(tokens[i+1]);
        if (t === '×') tmp.push(a * b);
        else {
          if (b === 0) return null;
          tmp.push(a / b);
        }
        i += 2;
      } else {
        tmp.push(t);
        i += 1;
      }
    }
    // Pasa 2: + y −
    var acc = Number(tmp[0]);
    for (var j = 1; j < tmp.length; j += 2){
      var op = tmp[j];
      var val = Number(tmp[j+1]);
      if (op === '+') acc = acc + val;
      else if (op === '−') acc = acc - val;
      else {
        if (op === '×') acc = acc * val;
        else if (op === '÷') {
          if (val === 0) return null;
          acc = acc / val;
        }
      }
    }
    return Math.round(acc);
  }

  function genExpression(nOps){
    var nums = [];
    for (var i=0;i<nOps+1;i++) nums.push(rnd(2,25));
    var ops = [];
    for (var j=0;j<nOps;j++) ops.push(NICE_OPS[rnd(0,NICE_OPS.length-1)]);

    for (var k=0;k<ops.length;k++){
      if (ops[k]==="÷"){
        nums[k+1] = rnd(2,12);
        var q = rnd(2,12);
        nums[k] = nums[k+1]*q;
      }
    }

    var parts = [];
    for (var t=0;t<ops.length;t++){
      parts.push(String(nums[t]));
      parts.push(ops[t]);
    }
    parts.push(String(nums[nums.length-1]));
    var expr = parts.join(" ");

    var value = evalPretty(expr);
    if (value === null || isNaN(value)) return genExpression(nOps); // reintenta
    return { exprText: expr, value: Math.round(value) };
  }

  function genQuestion(levelKey){
    var nOps = LEVELS[levelKey].ops;
    var e = genExpression(nOps);
    var correct = e.value;

    var map = {};
    map[correct] = true;
    while (Object.keys(map).length < 4){
      var delta = rnd(-12,12);
      if (delta === 0) delta = 1;
      map[correct + delta] = true;
    }
    var opts = Object.keys(map).map(function(x){ return Number(x); });
    opts = shuffle(opts);
    return { exprText: e.exprText, answer: correct, options: opts };
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

  // ---------- UI ----------
  function layout(){
    root.innerHTML = "";
    var panel = el("div",{class:"mt-panel"});

    var topRow = el("div",{class:"levelbar"},[
      el("button",{class:"btn",id:"btnL1",onClick:function(){setLevel("l1");}},"L1"),
      el("button",{class:"btn",id:"btnL2",onClick:function(){setLevel("l2");}},"L2"),
      el("button",{class:"btn",id:"btnL3",onClick:function(){setLevel("l3");}},"L3"),
      el("button",{class:"btn",id:"btnL4",onClick:function(){setLevel("l4");}},"L4"),
      el("span",{class:"badge",id:"lvName",style:"margin-left:.5rem"},"Nivel 1 (1 operador)"),
      el("span",{class:"badge",id:"bestLocalChip",style:"margin-left:auto"},"Mejor nivel: —")
    ]);

    var kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"60")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box",id:"box-hits"},[el("div",{class:"muted"},"Aciertos"), el("div",{id:"h"},"0")]),
      el("div",{class:"box",id:"box-misses"},[el("div",{class:"muted"},"Fallos"), el("div",{id:"m"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Racha"), el("div",{id:"st"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAlias()||"Anónimo")])
    ]);

    var q = el("div",{class:"mt-q",id:"q"},"Elige nivel y pulsa Comenzar");
    var opts = el("div",{class:"mt-opts",id:"opts"});
    
    // --- 👇 CORRECCIÓN 1 ---
    // Eliminado el botón "Volver"
    var nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:start},"Comenzar")
    ]);
    // --- 👆 FIN CORRECCIÓN 1 ---

    panel.append(topRow,kpi,q,opts,nav);
    root.append(panel);

    window.addEventListener("keydown", onKey);
    refreshLevelButtons();
    refreshBestChips();
  }

  function onKey(e){
    if (!st.running) return;
    var n = Number(e.key);
    if (n>=1 && n<=4){
      var btns = $("#opts").querySelectorAll("button");
      if (btns[n-1]) btns[n-1].click();
    }
  }

  function setLevel(lk){
    st.level = lk;
    $("#lvName").textContent = LEVELS[lk].name;
    refreshLevelButtons();
    refreshBestChips();
  }

  function refreshLevelButtons(){
    var ids = ["btnL1","btnL2","btnL3","btnL4"];
    for (var i=0;i<ids.length;i++){
      var b = document.getElementById(ids[i]);
      if (!b) continue;
      var lk = "l"+(i+1);
      if (st.level === lk) b.classList.add("active"); else b.classList.remove("active");
    }
  }

  function refreshBestChips(){
    var gameKey = "calculo-"+st.level;
    var best = bestLocal(gameKey);
    var blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor nivel: "+best;
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);
  }

  // ---------- Lógica ----------
  function gen(){
    var q = genQuestion(st.level);
    st.ans = q.answer;
    $("#q").textContent = q.exprText + " = ?";
    var cont = $("#opts"); cont.innerHTML = "";

    for (var i=0;i<q.options.length;i++){
      var v = q.options[i];
      var b = el("button", {"data-val": String(v)}, String(v));
      b.addEventListener("click", onPickBtn);
      cont.append(b);
    }
  }

  function onPickBtn(e){
    var v = Number(e.currentTarget.getAttribute("data-val"));
    pick(v);
  }

  function pick(v){
    if (!st.running) return;
    st.qCount++;
    if (v === st.ans){
      st.hits++;
      var bonus = (st.streak>=2)? 2 : 0;
      var mult = LEVELS[st.level].mult;
      st.score += Math.round((10 + bonus) * mult);
      st.streak++;
    } else {
      st.misses++;
      st.score = Math.max(0, st.score - 5);
      st.streak = 0;
    }
    $("#s").textContent = String(st.score);
    $("#st").textContent = String(st.streak);
    $("#h").textContent = String(st.hits);
    $("#m").textContent = String(st.misses);
    gen();
  }

  function tick(){
    var left = Math.max(0, st.tEnd - performance.now());
    $("#t").textContent = String(Math.ceil(left/1000));
    if (left <= 0){
      st.running = false;
      end();
    } else {
      st.raf = requestAnimationFrame(tick);
    }
  }

  function start(){
    st.score = 0; st.streak = 0; st.hits = 0; st.misses = 0; st.qCount = 0;
    $("#s").textContent = "0";
    $("#st").textContent = "0";
    $("#h").textContent = "0";
    $("#m").textContent = "0";

    st.running = true;
    st.tEnd = performance.now() + ROUND_MS;
    gen();
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  function end(){
    cancelAnimationFrame(st.raf);
    var gameKey = "calculo-"+st.level;
    if (typeof saveLocalScore === "function") saveLocalScore(gameKey, st.score);
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);

    root.innerHTML = "";
    root.append(
      el("div",{class:"mt-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{},"Nivel: "+LEVELS[st.level].name),
        el("div",{},"Puntuación: "+st.score),
        el("div",{},"Aciertos: "+st.hits+" / "+st.qCount),
        el("div",{},"Fallos: "+st.misses),
        // --- 👇 CORRECCIÓN 2 ---
        // Eliminado el botón "Volver a Juegos"
        el("div",{class:"qz-meta",style:"margin-top:.6rem"},[
          el("button",{class:"btn btn-primary",onClick:function(){ layout(); }},"Jugar de nuevo")
        ])
        // --- 👆 FIN CORRECCIÓN 2 ---
      ])
    );
  }

  // ---------- Inicio ----------
  injectCss();
  layout();
  setLevel("l1");
}