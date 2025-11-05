// ======================
// 🧠 Parejas (memoria visual) por niveles (L1–L4)
// Niveles: L1 4x3 (6 parejas), L2 4x4 (8), L3 5x4 (10), L4 6x4 (12)
// KPI: Tiempo, Puntos, Aciertos (parejas), Intentos, Mejor racha, Jugador
// Ranking independiente por nivel: parejas-l1 .. parejas-l4
// Compatible con games-core.js (initGame)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  var LEVELS = {
    l1: { rows: 3, cols: 4, pairs: 6,  time: 60,  mult: 1.0, name: "Nivel 1 (4×3 · 6 parejas)" },
    l2: { rows: 4, cols: 4, pairs: 8,  time: 75,  mult: 1.2, name: "Nivel 2 (4×4 · 8 parejas)" },
    l3: { rows: 4, cols: 5, pairs: 10, time: 90,  mult: 1.5, name: "Nivel 3 (5×4 · 10 parejas)" },
    l4: { rows: 4, cols: 6, pairs: 12, time: 105, mult: 2.0, name: "Nivel 4 (6×4 · 12 parejas)" }
  };
  // Iconos (unicode, no dependencias)
  var ICONS = ["🫀","🧠","🫁","🩸","🧬","🦴","🩺","💊","🧪","🧯","⚕️","🚑","🦠","🧼","🩹","🧷","🪥","🦷","🔬","📈","📉","📋","🧴","🪡","🪢","📦","🧯","🧫","🏥","🛏️"];

  // ---------- Estado ----------
  var st = {
    level: "l1",
    running: false,
    tLeft: 0,
    raf: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    pairsFound: 0,
    tries: 0,
    firstPick: null,
    lock: false,
    deck: [] // [{id, icon, matched, flipped, el}]
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
    if (document.getElementById("pairs-css")) return;
    var css = [
      '.mt-panel{width:min(920px,100%);display:grid;gap:.9rem}',
      '.levelbar{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}',
      '.levelbar .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:.45rem .75rem;font-weight:700;cursor:pointer}',
      '.levelbar .btn.active{background:#003a6b;color:#fff;border-color:#003a6b}',
      '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}',
      '.kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem}',
      '.kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center}',
      '.kpi .box .muted{font-size:.85rem;color:#6b7280}',
      '.kpi .box div:last-child{font-weight:700;font-size:1.1rem}',
      '#box-pairs{background:#dcfce7;border-color:#86efac}',
      '#box-pairs .muted{color:#15803d}',
      '#box-pairs div:last-child{color:#166534}',
      '#box-tries{background:#fff7ed;border-color:#fed7aa}',
      '#box-tries .muted{color:#9a3412}',
      '#box-tries div:last-child{color:#7c2d12}',
      '.board{display:grid;gap:.5rem;justify-content:center}',
      '.card{width:88px;height:108px;border-radius:12px;border:1px solid #e5e7eb;background:#f8fafc;display:grid;place-items:center;cursor:pointer;position:relative;user-select:none;transform-style:preserve-3d;transition:transform .35s}',
      '.card.flipped{transform:rotateY(180deg)}',
      '.card .front,.card .back{position:absolute;inset:0;display:grid;place-items:center;border-radius:12px;backface-visibility:hidden}',
      '.card .front{background:#fff}',
      '.card .back{background:#0d6efd;color:#fff;transform:rotateY(180deg);font-size:2rem}',
      '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-start;margin-top:.75rem}',
      '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
      '.btn-primary{background:#0d6efd;color:#fff}',
      '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,.12)}'
    ].join('');
    var s = document.createElement("style");
    s.id = "pairs-css";
    s.textContent = css;
    document.head.append(s);
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
      el("span",{class:"badge",id:"lvName",style:"margin-left:.5rem"},"Nivel 1 (4×3 · 6 parejas)"),
      el("span",{class:"badge",id:"bestLocalChip",style:"margin-left:auto"},"Mejor nivel: —")
    ]);

    var kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"—")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box",id:"box-pairs"},[el("div",{class:"muted"},"Parejas"), el("div",{id:"p"},"0")]),
      el("div",{class:"box",id:"box-tries"},[el("div",{class:"muted"},"Intentos"), el("div",{id:"tr"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Mejor racha"), el("div",{id:"st"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{}, getAlias()||"Anónimo")])
    ]);

    var boardWrap = el("div",{id:"board-wrap"});
    
    // --- 👇 CORRECCIÓN 1 ---
    // Eliminado el botón "Volver"
    var nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:start},"Comenzar")
    ]);
    // --- 👆 FIN CORRECCIÓN 1 ---

    panel.append(topRow,kpi,boardWrap,nav);
    root.append(panel);

    refreshLevelButtons();
    refreshBestChips();
    drawBoardSkeleton();
  }

  function setLevel(lk){
    st.level = lk;
    $("#lvName").textContent = LEVELS[lk].name;
    refreshLevelButtons();
    refreshBestChips();
    drawBoardSkeleton();
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
    var gameKey = "parejas-"+st.level;
    var best = bestLocal(gameKey);
    var blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor nivel: "+best;
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);
  }

  function drawBoardSkeleton(){
    var cfg = LEVELS[st.level];
    var boardWrap = $("#board-wrap");
    if (!boardWrap) return;
    boardWrap.innerHTML = "";
    var board = el("div",{class:"board",id:"board"});
    board.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    for (var i=0;i<cfg.rows*cfg.cols;i++){
      board.append(el("div",{class:"card"},[
        el("div",{class:"front"}, ""),
        el("div",{class:"back"}, "❓")
      ]));
    }
    boardWrap.append(board);
  }

  // ---------- Lógica ----------
  function buildDeck(){
    var cfg = LEVELS[st.level];
    var needed = cfg.pairs;
    var base = shuffle(ICONS.slice()).slice(0, needed);
    var deck = [];
    var id = 0;
    base.forEach(function(icon){
      deck.push({ id: id++, icon: icon, matched:false, flipped:false, el:null });
      deck.push({ id: id++, icon: icon, matched:false, flipped:false, el:null });
    });
    deck = shuffle(deck);
    st.deck = deck;
  }

  function renderDeck(){
    var board = $("#board");
    if (!board) return;
    board.innerHTML = "";
    st.deck.forEach(function(card){
      var node = el("div",{class:"card", "data-id": String(card.id)});
      var front = el("div",{class:"front"}, ""); // reverso
      var back  = el("div",{class:"back"}, card.icon);
      node.append(front, back);
      node.addEventListener("click", onFlip);
      card.el = node;
      board.append(node);
    });
  }

  function onFlip(e){
    if (!st.running || st.lock) return;
    var node = e.currentTarget;
    var id = Number(node.getAttribute("data-id"));
    var card = st.deck.find(function(c){ return c.id===id; });
    if (!card || card.flipped || card.matched) return;

    flip(card, true);

    if (!st.firstPick){
      st.firstPick = card;
      return;
    }
    // Segundo click
    st.lock = true;
    st.tries++;
    $("#tr").textContent = String(st.tries);

    if (st.firstPick.icon === card.icon){
      // match
      card.matched = st.firstPick.matched = true;
      st.streak++;
      if (st.streak > st.bestStreak) st.bestStreak = st.streak;
      st.pairsFound++;
      $("#p").textContent = String(st.pairsFound);

      var mult = LEVELS[st.level].mult;
      var bonus = (st.streak>=2)? 5 : 0;
      st.score += Math.round((20 + bonus) * mult);
      $("#s").textContent = String(st.score);

      st.firstPick = null;
      st.lock = false;

      var cfg = LEVELS[st.level];
      if (st.pairsFound === cfg.pairs){
        end(true);
      }
    } else {
      // fail
      st.streak = 0;
      setTimeout(function(){
        flip(st.firstPick, false);
        flip(card, false);
        st.firstPick = null;
        st.lock = false;
      }, 650);
    }
  }

  function flip(card, on){
    card.flipped = on;
    if (!card.el) return;
    if (on) card.el.classList.add("flipped");
    else card.el.classList.remove("flipped");
  }

  function tick(){
    if (!st.running) return;
    st.tLeft -= 0.016; // ~60 FPS
    if (st.tLeft <= 0){
      st.tLeft = 0;
      $("#t").textContent = "0";
      end(false);
      return;
    }
    $("#t").textContent = String(Math.ceil(st.tLeft));
    st.raf = requestAnimationFrame(tick);
  }

  function start(){
    var cfg = LEVELS[st.level];
    st.running = true;
    st.tLeft = cfg.time;
    st.score = 0;
    st.streak = 0;
    st.bestStreak = 0;
    st.pairsFound = 0;
    st.tries = 0;
    st.firstPick = null;
    st.lock = false;

    $("#s").textContent = "0";
    $("#p").textContent = "0";
    $("#tr").textContent = "0";
    $("#st").textContent = "0";
    $("#t").textContent = String(cfg.time);
    
    // Ocultar botón de start
    var startBtn = $("#start");
    if (startBtn) startBtn.style.display = "none";

    buildDeck();
    renderDeck();

    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(tick);
  }

  function end(won){
    cancelAnimationFrame(st.raf);
    st.running = false;

    if (won && st.tLeft > 0){
      st.score += Math.round(st.tLeft * 2);
    }
    $("#s").textContent = String(st.score);
    $("#st").textContent = String(st.bestStreak);

    var gameKey = "parejas-"+st.level;
    if (typeof saveLocalScore === "function") saveLocalScore(gameKey, st.score);
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);

    root.innerHTML = "";
    root.append(
      el("div",{class:"mt-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{},""+(won?"✅ Completado":"⏱ Tiempo agotado")),
        el("div",{},"Nivel: "+LEVELS[st.level].name),
        el("div",{},"Parejas: "+st.pairsFound+" / "+LEVELS[st.level].pairs),
        el("div",{},"Intentos: "+st.tries),
        el("div",{},"Mejor racha: "+st.bestStreak),
        el("div",{},"Puntuación: "+st.score),
        
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