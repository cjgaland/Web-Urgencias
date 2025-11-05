// ======================
// ✍️ Anagrama Clínico (CON NIVELES L1-L3)
// Módulo compatible con games-core.js (initGame)
// L1: <6 letras, L2: 6-7 letras, L3: >7 letras
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  const GAME_ID = "anagrama";
  const ROUNDS = 10;
  const TIME_PER_Q = 20000; // 20 segundos
  const DATA_URL = "./data/anagramas.json";
  
  var LEVELS = {
    l1: { min: 1, max: 5, name: "Nivel 1 (< 6 letras)", mult: 1.0 },
    l2: { min: 6, max: 7, name: "Nivel 2 (6-7 letras)", mult: 1.5 },
    l3: { min: 8, max: 99, name: "Nivel 3 (> 7 letras)", mult: 2.0 }
  };

  // ---------- Estado (Global al módulo) ----------
  const st = {
    level: "l1",
    running: false,
    i: 0, score: 0, streak: 0, hits: 0, misses: 0,
    questionPool: [],
    results: [], 
    totals: { answered: 0, correct: 0, timeMs: 0 }
  };
  let BANK = []; 
  let tStart = 0, raf = 0, answered = false, current = null;

  // ---------- Util ----------
  const $ = (s, el = root) => (el || root).querySelector(s);
  const $$ = (s, el = root) => [...(el || root).querySelectorAll(s)];
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => c != null && n.append(c));
    return n;
  };
  const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

  function scrambleWord(word) {
    let scrambled = shuffle(word.split("")).join("");
    if (scrambled === word && word.length > 1) return scrambleWord(word);
    return scrambled;
  }
  
  function bestLocal(gameKey) {
    try {
      const arr = JSON.parse(localStorage.getItem("urgent-games-scores") || "[]")
        .filter((x) => x.game === gameKey);
      if (arr.length === 0) return 0;
      return Math.max(...arr.map((x) => Number(x.score) || 0));
    } catch {
      return 0;
    }
  }

  function setLevel(lk) {
    st.level = lk;
    $("#lvName").textContent = LEVELS[lk].name;
    refreshLevelButtons();
    refreshBestChips();
  }

  function refreshLevelButtons() {
    ["btnL1", "btnL2", "btnL3"].forEach((id, i) => {
      const b = $(`#${id}`);
      if (!b) return;
      const lk = "l" + (i + 1);
      if (st.level === lk) b.classList.add("active");
      else b.classList.remove("active");
    });
  }

  function refreshBestChips() {
    var gameKey = "anagrama-" + st.level;
    var best = bestLocal(gameKey);
    var blc = $("#bestLocalChip"); if (blc) blc.textContent = "Mejor nivel: " + best;
    if (typeof updateBestBadge === "function") updateBestBadge(gameKey);
  }
  
  // ---------- Lógica de juego ----------

  function layout() {
    root.innerHTML = "";
    const panel = el("div", { class: "mt-panel" });

    const topRow = el("div", { class: "levelbar" }, [
      el("button", { class: "btn", id: "btnL1", onClick: () => setLevel("l1") }, "L1"),
      el("button", { class: "btn", id: "btnL2", onClick: () => setLevel("l2") }, "L2"),
      el("button", { class: "btn", id: "btnL3", onClick: () => setLevel("l3") }, "L3"),
      el("span", { class: "badge", id: "lvName", style: "margin-left:.5rem" }, ""),
      el("span", { class: "badge", id: "bestLocalChip", style: "margin-left:auto" }, "Mejor nivel: —")
    ]);

    const totalTimeSecs = Math.ceil((ROUNDS * TIME_PER_Q) / 1000);
    const kpi = el("div", { class: "kpi" }, [
      el("div", { class: "box" }, [el("div", { class: "muted" }, "Tiempo"), el("div", { id: "t" }, totalTimeSecs)]),
      el("div", { class: "box" }, [el("div", { class: "muted" }, "Puntos"), el("div", { id: "s" }, "0")]),
      el("div", { class: "box", id: "box-hits" }, [el("div", { class: "muted" }, "Aciertos"), el("div", { id: "h" }, "0")]),
      el("div", { class: "box", id: "box-misses" }, [el("div", { class: "muted" }, "Fallos"), el("div", { id: "m" }, "0")]),
      el("div", { class: "box" }, [el("div", { class: "muted" }, "Racha"), el("div", { id: "st" }, "0")]),
      el("div", { class: "box" }, [el("div", { class: "muted" }, "Jugador"), el("div", {}, getAlias() || "Anónimo")])
    ]);
    
    const gameArea = el("div", { class: "qz-panel", style: "gap: .9rem; width: 100%;" });
    const top = el("div", { class: "qz-top", id: "qzTop", style: "display:none" });
    const prog = el("div", { class: "qz-progress", id: "qzProgress" });
    const bar = el("div", { class: "qz-timerbar" });
    const fill = el("i", { class: "qz-timerbar-fill" });
    bar.append(fill);
    
    const dots = Array.from({ length: ROUNDS }, (_, i) => el("span", { class: "qz-dot" }, String(i + 1)));
    dots.forEach(d => prog.append(d));
    top.append(prog, bar);

    const stem = el("div", { class: "qz-stem", id: "stem" }, "Elige nivel y pulsa Comenzar");
    
    const inputArea = el("div", { class: "anag-input-area", id: "opts", style: "display: none;" }, [
      el("input", {
        type: "text",
        id: "anagInput",
        placeholder: "Escribe la palabra y pulsa Intro...",
        autocomplete: "off",
        autocapitalize: "none"
      })
    ]);
    gameArea.append(top, stem, inputArea);
    
    // --- 👇 CORRECCIÓN 1 ---
    // Botón "Volver" eliminado
    const nav = el("div", { class: "qz-meta" }, [
      el("button", { class: "btn btn-primary", id: "startAnag", onClick: startGame }, "Comenzar")
    ]);
    // --- 👆 FIN CORRECCIÓN 1 ---

    panel.append(topRow, kpi, gameArea, nav);
    root.append(panel);

    $("#anagInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !answered) checkAnswer();
    });
  }

  function startGame() {
    st.running = true;
    st.i = 0;
    st.score = 0;
    st.streak = 0;
    st.hits = 0;
    st.misses = 0;
    st.results = [];
    st.totals = { answered: 0, correct: 0, timeMs: 0 };
    
    const levelConf = LEVELS[st.level];
    const wordPool = BANK.filter(w => w.length >= levelConf.min && w.length <= levelConf.max);
    
    if (wordPool.length < ROUNDS) {
      $("#stem").innerHTML = `<span style="color: #900;">Error: No hay suficientes palabras (${wordPool.length}) para el ${levelConf.name}. Se necesitan ${ROUNDS}.</span>`;
      st.running = false;
      return;
    }
    
    st.questionPool = shuffle(wordPool).slice(0, ROUNDS);

    $("#s").textContent = "0";
    $("#st").textContent = "0";
    $("#h").textContent = "0";
    $("#m").textContent = "0";
    $$(".qz-dot").forEach(d => d.className = "qz-dot");
    $("#qzTop").style.display = "flex";
    $("#opts").style.display = "flex";
    $("#startAnag").style.display = "none";
    
    nextQ();
  }

  function tick() {
    const elapsed = performance.now() - tStart;
    const left = Math.max(0, TIME_PER_Q - elapsed);
    $(".qz-timerbar-fill").style.transform = `scaleX(${left / TIME_PER_Q})`;
    
    const totalElapsed = (st.i * TIME_PER_Q) + elapsed;
    const totalLeft = Math.max(0, (ROUNDS * TIME_PER_Q) - totalElapsed);
    $("#t").textContent = String(Math.ceil(totalLeft / 1000));
    
    if (!answered && left > 0) raf = requestAnimationFrame(tick);
    else if (!answered) timeOver();
  }

  function startTimer() {
    cancelAnimationFrame(raf);
    tStart = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function timeOver() {
    if (answered) return;
    answered = true;
    cancelAnimationFrame(raf);
    
    st.results.push({
      correct: false,
      user: "[TIEMPO AGOTADO]",
      answer: current.answer,
      scrambled: current.scrambled
    });
    
    reveal(false, TIME_PER_Q);
  }

  function checkAnswer() {
    if (answered) return;
    answered = true;
    cancelAnimationFrame(raf);

    const elapsed = performance.now() - tStart;
    const inp = $("#anagInput");
    inp.disabled = true;

    const userInput = inp.value.trim().toUpperCase();
    const correct = current.answer.toUpperCase();
    const ok = (userInput === correct);

    st.results.push({
      correct: ok,
      user: userInput,
      answer: current.answer,
      scrambled: current.scrambled
    });
    
    reveal(ok, elapsed);
  }

  function reveal(ok, elapsed) {
    const currentDot = $$(".qz-dot")[st.i];
    if (currentDot) {
      currentDot.classList.add(ok ? "correct" : "wrong");
    }

    const inp = $("#anagInput");
    inp.classList.add(ok ? "correct" : "wrong");

    st.totals.answered++;
    st.totals.timeMs += Math.min(elapsed, TIME_PER_Q);

    if (ok) {
      st.totals.correct++;
      st.streak++;
      st.hits++;
      const base = 10;
      const speed = Math.max(0, 5 - Math.floor(elapsed / 3000));
      st.score += Math.round((base + speed) * LEVELS[st.level].mult);
    } else {
      st.streak = 0;
      st.misses++;
    }

    $("#s").textContent = String(st.score);
    $("#st").textContent = String(st.streak);
    $("#h").textContent = String(st.hits);
    $("#m").textContent = String(st.misses);

    st.i++;
    setTimeout(() => nextQ(), 300); 
  }

  function nextQ() {
    if (st.i >= ROUNDS) return endGame();

    $$(".qz-dot").forEach((d, idx) => d.classList.toggle("on", idx === st.i));
    
    answered = false;
    current = {
      answer: st.questionPool[st.i],
      scrambled: scrambleWord(st.questionPool[st.i])
    };
    
    $("#stem").innerHTML = `<strong>Anagrama:</strong> <span class="anag-scrambled">${current.scrambled}</span>`;
    
    const inp = $("#anagInput");
    inp.value = "";
    inp.disabled = false;
    inp.classList.remove("correct", "wrong");
    inp.focus();

    startTimer();
  }

  function endGame() {
    st.running = false;
    cancelAnimationFrame(raf);
    
    const gameKey = "anagrama-" + st.level;
    saveLocalScore(gameKey, st.score);
    updateBestBadge(gameKey);

    root.innerHTML = "";
    const box = el("div", { class: "mt-panel" });
    
    box.append(
      el("h2", {}, "🏁 Resultado"),
      el("div", {}, `Nivel: ${LEVELS[st.level].name}`),
      el("div", {}, `Puntuación: ${st.score}`),
      el("div", {}, `Correctas: ${st.totals.correct}/${st.totals.answered}`)
    );

    const errors = st.results.filter(r => !r.correct);
    if (errors.length > 0) {
      box.append(el("h3", { style: "margin-top: 1.5rem; margin-bottom: 0.5rem;" }, "Revisión de errores:"));
      const errList = el("div", { class: "anag-errors-list" });
      errors.forEach(err => {
        errList.append(
          el("div", { class: "anag-error-item" }, [
            el("span", { class: "anag-scrambled-err" }, err.scrambled),
            el("span", {}, "→"),
            el("strong", { class: "anag-correct-ans" }, err.answer)
          ])
        );
      });
      box.append(errList);
    }

    // --- 👇 CORRECCIÓN 2 ---
    // Botón "Volver" eliminado y estilo de alineación quitado
    box.append(
      el("div", { class: "qz-meta", style: "margin-top:1.5rem;" }, [
        el("button", { class: "btn btn-primary", onClick: () => { layout(); setLevel("l1"); } }, "Jugar de nuevo")
      ])
    );
    // --- 👆 FIN CORRECCIÓN 2 ---
    
    root.append(box);
  }

  // ---------- Estilos ----------
  function injectCss() {
    if (!document.getElementById("calc-level-css")) {
      const cssCalc = [
        '.mt-panel{width:min(760px,100%);display:grid;gap:.9rem}',
        '.levelbar{display:flex;gap:.4rem;flex-wrap:wrap}',
        '.levelbar .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:.45rem .75rem;font-weight:700;cursor:pointer}',
        '.levelbar .btn.active{background:#003a6b;color:#fff;border-color:#003a6b}',
        '.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:.5rem}',
        '.kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center}',
        '.kpi .box .muted{font-size:.85rem;color:#6b7280}',
        '.kpi .box div:last-child{font-weight:700;font-size:1.1rem}',
        '#box-hits{background:#dcfce7;border-color:#86efac}',
        '#box-hits .muted{color:#15803d}',
        '#box-hits div:last-child{color:#166534}',
        '#box-misses{background:#fee2e2;border-color:#fca5a5}',
        '#box-misses .muted{color:#b91c1c}',
        '#box-misses div:last-child{color:#991b1b}',
        '.qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content: flex-start;margin-top: .75rem;',
        '.btn{border:0;border-radius:10px;padding:.55rem .9rem;cursor:pointer;font-weight:700;line-height:1}',
        '.btn-primary{background:#0d6efd;color:#fff}',
        '.btn-ghost{background:transparent;border:1px solid rgba(0,0,0,.12)}',
        '.badge{font-size:.85rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .55rem}'
      ].join('');
      const s = document.createElement("style");
      s.id = "calc-level-css";
      s.textContent = cssCalc;
      document.head.append(s);
    }
    
    if (!document.getElementById("quizdx-lite-css")) {
       const cssQuiz = `
        .qz-panel{width:100%;display:grid;gap:.9rem}
        .qz-top{display:flex;align-items:center;gap:.5rem; flex-wrap: wrap;}
        .qz-progress{display:flex;gap:.25rem;align-items:center;flex: 1 1 auto; order: 3; min-width: 100%;}
        .qz-dot{
          flex-basis: 28px; flex-grow: 1; height: 28px;
          border-radius: 6px; background: #e5e7eb; color: #6b7280;
          font-size: 0.8rem; font-weight: 700;
          display: grid; place-items: center; line-height: 1;
          transition: all 0.2s ease; border: 1px solid transparent;
        }
        .qz-dot.on{ border-color: #0d6efd; box-shadow: 0 0 5px rgba(13,110,253,.5); }
        .qz-dot.correct{ background: #dcfce7; color: #166534; border-color: #86efac; }
        .qz-dot.wrong{ background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .qz-timerbar{position:relative;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;flex: 1 1 200px; order: 1;}
        .qz-timerbar-fill{display:block;height:100%;width:100%;background:#0d6efd;transform-origin:left center;transform:scaleX(1)}
        .qz-stem{font-size:1.05rem}
        .qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end}
        .qz-exp{background:#fbfbfe;border:1px solid #eef;padding:.6rem .7rem;border-radius:10px}
      `;
      const s = document.createElement("style");
      s.id = "quizdx-lite-css";
      s.textContent = cssQuiz;
      document.head.append(s);
    }
    
    if (!document.getElementById("anagrama-css")) {
      const cssAnag = `
        /* FIX: Forzar alineación de botones a la izquierda, como en calculo.js */
        .mt-panel .qz-meta {
          justify-content: flex-start;
        }
        
        .anag-scrambled { font-size: 1.5rem; font-weight: 700; color: #003a6b; letter-spacing: 2px; }
        .anag-input-area { display: flex; gap: 0.5rem; width: 100%; }
        #anagInput { 
          flex-grow: 1; width: 100%; box-sizing: border-box;
          border:1px solid #e5e7eb; 
          border-radius:10px; 
          padding:.65rem .8rem; 
          font-size: 1.1rem;
        }
        #anagInput:focus { outline: 2px solid #0d6efd; outline-offset: 2px; }
        #anagInput.correct { background: #ecfdf5; border-color: #bbf7d0; }
        #anagInput.wrong { background: #fee2e2; border-color: #fca5a5; }
        .anag-errors-list { display: grid; gap: 0.5rem; }
        .anag-error-item { 
          background: #fdf2f2; border: 1px solid #fecaca; 
          border-radius: 8px; padding: 0.5rem 0.75rem;
          display: flex; justify-content: space-between; align-items: center;
        }
        .anag-scrambled-err { font-style: italic; color: #991b1b; }
        .anag-correct-ans { color: #166534; }
      `;
      const style = document.createElement("style");
      style.id = "anagrama-css";
      style.textContent = cssAnag;
      document.head.append(style);
    }
  }

  // ---------- Inicio ----------
  injectCss();
  try {
    const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const jsonData = await res.json();
    BANK = jsonData.filter(q => typeof q === "string" && q.length > 2).map(q => q.toUpperCase());
    
    if (BANK.length < 10) throw new Error("Banco de datos insuficiente.");
    
    layout();
    setLevel("l1");
    
  } catch (err) {
    root.textContent = `No se pudo cargar el banco de preguntas (${DATA_URL}). ${err.message}`;
    console.error(err);
  }
}