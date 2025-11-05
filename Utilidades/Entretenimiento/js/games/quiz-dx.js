// ======================
// 🩺 Quiz diagnóstico por síntomas (Modo Rápido v2)
// Módulo compatible con games-core.js (initGame)
// Auto-avance y revisión de fallos al final.
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  const ROUNDS = 10;
  const TIME_PER_Q = 20000;
  const DATA_URL = "./data/quiz-dx.json";

  // ---------- Estado (Global al módulo) ----------
  const st = {
    i: 0, score: 0, streak: 0,
    questionPool: [],
    review: [], // Array para guardar fallos
    totals: { answered:0, correct:0, timeMs:0 }
  };
  let BANK = [];
  let tStart = 0, raf = 0, answered = false, current = null;

  // ---------- Util ----------
  const $ = (s, el=root) => el.querySelector(s);
  const $$ = (s, el=root) => [...el.querySelectorAll(s)];
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
  const shuffle = (a) => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);

  // ---------- Lógica de juego ----------

  function buildGameUI() {
    root.innerHTML = ""; 

    const panel  = el("div",{class:"qz-panel"});
    const top    = el("div",{class:"qz-top", id:"qzTop", style:"display:none"});
    const prog   = el("div",{class:"qz-progress", id:"qzProgress"});
    const bar    = el("div",{class:"qz-timerbar"});
    const fill   = el("i",{class:"qz-timerbar-fill"});
    bar.append(fill);

    const badges = el("div",{class:"qz-badges"}, [
      el("span",{class:"badge", id:"bScore"}),
      el("span",{class:"badge", id:"bStreak"}),
      el("span",{class:"badge", id:"bPlayerName"})
    ]);

    const dots = Array.from({length:ROUNDS}, ( _, i )=>el("span",{class:"qz-dot"}, String(i+1)));
    dots.forEach(d=>prog.append(d));

    top.append(prog, bar, badges);

    const stem  = el("div",{class:"qz-stem", id:"stem"});
    const opts  = el("div",{class:"qz-opts", id:"opts"});
    const exp   = el("div",{class:"qz-exp", id:"exp", style:"display:none"}); 
    
    // --- 👇 CORRECCIÓN ---
    // 'nav' completamente vacío, ya no hay botón "Siguiente"
    const nav   = el("div",{class:"qz-meta", id:"qzNav", style:"display:none"});
    // --- 👆 FIN CORRECCIÓN ---

    panel.append(top, stem, opts, exp, nav);
    root.append(panel);

    window.addEventListener("keydown", (e)=>{
      if($("#qzNav")?.style.display === 'none' || answered) return;
      const n = Number(e.key);
      if(n>=1 && n<=4){
        const btn = $$(".qz-opt")[n-1];
        btn?.click();
      }
    });
  }

  function showStartScreen() {
    buildGameUI(); 
    
    $("#bPlayerName").textContent = "Jugador: " + getAlias();
    $("#stem").innerHTML = `Juego de <strong>Quiz Clínico</strong>. Tienes ${TIME_PER_Q/1000} segundos por pregunta.<br>Pulsa 'Comenzar' cuando estés listo.`;
    $("#opts").append(
      el("button", {
        class: "btn btn-primary", 
        style: "font-size:1.2rem; padding: 0.8rem 1.2rem; margin: 1rem auto; display: block;",
        onClick: startGame
      }, "Comenzar Partida")
    );
  }

  function startGame() {
    st.i = 0;
    st.score = 0;
    st.streak = 0;
    st.review = []; 
    st.totals = { answered: 0, correct: 0, timeMs: 0 };
    $("#bScore").textContent = "Puntos: 0";
    $("#bStreak").textContent = "Racha: 0";

    $$(".qz-dot").forEach(d => {
      d.className = "qz-dot";
    });

    const shuffledBank = shuffle([...BANK]);
    st.questionPool = shuffledBank.slice(0, ROUNDS);

    $("#qzTop").style.display = "flex";
    $("#qzNav").style.display = "flex";
    $("#opts").innerHTML = ""; 

    nextQ();
  }


  function tick(){
    const elapsed = performance.now() - tStart;
    const left = Math.max(0, TIME_PER_Q - elapsed);
    $(".qz-timerbar-fill").style.transform = `scaleX(${left / TIME_PER_Q})`;
    if(!answered && left>0) raf = requestAnimationFrame(tick);
    else if(!answered) timeOver();
  }

  function startTimer(){
    cancelAnimationFrame(raf);
    tStart = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function timeOver(){
    if(answered) return;
    answered = true;
    cancelAnimationFrame(raf);
    
    st.review.push({
      pregunta: current.stem,
      correcta: current.opciones[current.correcta],
      explicacion: current.explicacion || ""
    });
    
    reveal(null, false, TIME_PER_Q);
  }

  function pick(idx, btn){
    if(answered) return;
    answered = true;
    cancelAnimationFrame(raf);

    const elapsed = performance.now() - tStart;
    $$(".qz-opt").forEach(o=>o.disabled=true);
    
    const ok = idx === current.shuffledCorrectIndex;
    
    if(ok) btn.classList.add("correct"); else btn.classList.add("wrong");
    
    if (!ok) {
      st.review.push({
        pregunta: current.stem,
        correcta: current.opciones[current.correcta],
        explicacion: current.explicacion || ""
      });
    }
    
    reveal(idx, ok, elapsed);
  }

  function reveal(idx, ok, elapsed){
    const btns = $$(".qz-opt");
    btns[current.shuffledCorrectIndex]?.classList.add("correct");

    const currentDot = $$(".qz-dot")[st.i];
    if (currentDot) {
      currentDot.classList.add(ok ? "correct" : "wrong");
    }

    st.totals.answered++;
    st.totals.timeMs += Math.min(elapsed, TIME_PER_Q);

    if(ok){
      st.totals.correct++;
      st.streak++;
      const base = 10;
      const speed = Math.max(0, 5 - Math.floor(elapsed/1000));
      st.score += base + speed;
    }else{
      st.streak = 0;
    }

    $("#bScore").textContent  = `Puntos: ${st.score}`;
    $("#bStreak").textContent = `Racha: ${st.streak}`;

    // --- 👇 CORRECCIÓN ---
    // Ya no se muestra la explicación aquí
    // $("#exp").style.display = "block";
    // ...
    // --- 👆 FIN CORRECCIÓN ---

    st.i++;
    setTimeout(() => nextQ(), 600); // Avanza solo tras 600ms
  }

  function nextQ(){
    if(st.i >= ROUNDS) return endGame();

    $("#exp").style.display = "none";
    $("#opts").innerHTML = "";
    
    $$(".qz-dot").forEach((d, idx) => d.classList.toggle("on", idx === st.i));
    
    answered = false;
    current = st.questionPool[st.i];

    const correctText = current.opciones[current.correcta];
    const shuffledOptions = shuffle([...current.opciones]);
    const newCorrectIndex = shuffledOptions.indexOf(correctText);
    current.shuffledCorrectIndex = newCorrectIndex;

    $("#stem").innerHTML = `<strong>Síntomas:</strong> ${current.stem}`;
    
    shuffledOptions.forEach((txt, idx)=>{
      const b = el("button",{class:"qz-opt", onClick:()=>pick(idx,b), tabindex:0}, [
        el("strong",{} , String(idx+1)+". "), " ", txt
      ]);
      $("#opts").append(b);
    });

    startTimer();
  }

  function endGame(){
    cancelAnimationFrame(raf);
    const mean = st.totals.answered ? Math.round(st.totals.timeMs / st.totals.answered) : 0;
    
    saveLocalScore("quiz-dx", st.score);
    updateBestBadge("quiz-dx");

    root.innerHTML = "";
    const box = el("div",{class:"qz-panel"});
    box.append(
      el("h2",{},"🏁 Resultado"),
      el("div",{} , `Correctas: ${st.totals.correct}/${st.totals.answered}`),
      el("div",{} , `Puntuación: ${st.score}`),
      el("div",{} , `Tiempo medio por pregunta: ${mean} ms`)
    );
    
    const errors = st.review;
    if (errors.length > 0) {
      box.append(el("h3", { style: "margin-top: 1.5rem; margin-bottom: 0.5rem;" }, "Revisión de errores:"));
      const errList = el("div", { class: "quiz-errors-list" });
      errors.forEach(err => {
        errList.append(
          el("div", { class: "quiz-error-item" }, [
            el("div", { class: "quiz-error-q" }, `P: ${err.pregunta}`),
            el("div", { class: "quiz-error-a" }, `R: ${err.correcta}`),
            err.explicacion ? el("div", { class: "quiz-error-exp" }, err.explicacion) : null
          ])
        );
      });
      box.append(errList);
    }
    
    box.append(
      el("div",{class:"qz-meta", style:"margin-top:.6rem;"},[
        el("button",{class:"btn btn-primary", onClick: showStartScreen}, "Jugar de nuevo")
      ])
    );
    root.append(box);
  }

  // ---------- Estilos ----------
  function injectLiteStyles(){
    if(document.getElementById("quizdx-lite-css")) return;
    const css = `
      .qz-panel{width:min(760px,100%);display:grid;gap:.9rem}
      .qz-top{display:flex;align-items:center;gap:.5rem; flex-wrap: wrap;}
      
      .qz-progress{display:flex;gap:.25rem;align-items:center;flex: 1 1 auto; order: 3; min-width: 100%;}
      .qz-dot{
        flex-basis: 28px;
        flex-grow: 1;
        height: 28px;
        border-radius: 6px;
        background: #e5e7eb;
        color: #6b7280;
        font-size: 0.8rem;
        font-weight: 700;
        display: grid;
        place-items: center;
        line-height: 1;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }
      .qz-dot.on{
        border-color: #0d6efd;
        box-shadow: 0 0 5px rgba(13,110,253,.5);
      }
      .qz-dot.correct{
        background: #dcfce7;
        color: #166534;
        border-color: #86efac;
      }
      .qz-dot.wrong{
        background: #fee2e2;
        color: #991b1b;
        border-color: #fca5a5;
      }

      .qz-timerbar{position:relative;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;flex: 1 1 200px; order: 1;}
      .qz-timerbar-fill{display:block;height:100%;width:100%;background:#0d6efd;transform-origin:left center;transform:scaleX(1)}
      .qz-badges{order: 2;}

      .qz-stem{font-size:1.05rem}
      .qz-opts{display:grid;gap:.5rem}
      .qz-opt{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:.65rem .8rem;text-align:left;cursor:pointer}
      .qz-opt.correct{background:#ecfdf5;border-color:#bbf7d0}
      .qz-opt.wrong{opacity:.65}
      .qz-badges .badge{font-size:.8rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .5rem}
      .qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-start;margin-top: .75rem;}
      .qz-exp{background:#fbfbfe;border:1px solid #eef;padding:.6rem .7rem;border-radius:10px}
      .qz-opt:focus{outline:2px solid #0d6efd;outline-offset:2px}
      
      .quiz-errors-list { display: grid; gap: 0.75rem; }
      .quiz-error-item { 
        background: #fdf2f2; border: 1px solid #fecaca; 
        border-radius: 8px; padding: 0.5rem 0.75rem;
        text-align: left;
      }
      .quiz-error-q { font-weight: 700; color: #991b1b; }
      .quiz-error-a { color: #166534; }
      .quiz-error-exp { font-size: 0.9rem; color: #444; margin-top: 0.25rem; }
    `;
    const style = document.createElement("style");
    style.id = "quizdx-lite-css";
    style.textContent = css;
    document.head.append(style);
  }

  // ---------- Inicio ----------
  injectLiteStyles();
  try{
    const res = await fetch(DATA_URL + "?t=" + Date.now(), {cache:"no-store"});
    BANK = await res.json();
    BANK = BANK.filter(q=>q && Array.isArray(q.opciones) && typeof q.correcta === "number");
    showStartScreen(); 
  }catch(err){
    root.textContent = "No se pudo cargar el banco de preguntas.";
    console.error(err);
    return;
  }
}