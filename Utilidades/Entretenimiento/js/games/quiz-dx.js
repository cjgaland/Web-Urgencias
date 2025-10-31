// ======================
// 🩺 Quiz diagnóstico por síntomas
// Módulo compatible con games-core.js (initGame)
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

  // --- CAMBIO ---
  // Esta función ahora construye TODA la UI del juego desde cero.
  // Esto soluciona el error al "Jugar de nuevo".
  function buildGameUI() {
    root.innerHTML = ""; // Limpia todo

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

    // --- CAMBIO ---
    // Crea las 10 tarjetas numeradas en lugar de puntos
    const dots = Array.from({length:ROUNDS}, ( _, i )=>el("span",{class:"qz-dot"}, String(i+1)));
    dots.forEach(d=>prog.append(d));
    // --- FIN CAMBIO ---

    top.append(prog, bar, badges);

    const stem  = el("div",{class:"qz-stem", id:"stem"});
    const opts  = el("div",{class:"qz-opts", id:"opts"});
    const exp   = el("div",{class:"qz-exp", id:"exp", style:"display:none"});
    const nav   = el("div",{class:"qz-meta", id:"qzNav", style:"display:none"},[
      el("button",{class:"btn btn-secondary", id:"btnNext", disabled:true, onClick:()=>nextQ()}, "Siguiente"),
      el("a",{class:"btn btn-ghost", href:"./index.html"},"Volver")
    ]);

    panel.append(top, stem, opts, exp, nav);
    root.append(panel);

    // Accesibilidad teclado (1–4)
    window.addEventListener("keydown", (e)=>{
      if($("#qzNav")?.style.display === 'none') return;
      const n = Number(e.key);
      if(n>=1 && n<=4){
        const btn = $$(".qz-opt")[n-1];
        btn?.click();
      }
    });
  }

  function showStartScreen() {
    buildGameUI(); // Construye la UI
    
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
    // 1. Reiniciar estadísticas
    st.i = 0;
    st.score = 0;
    st.streak = 0;
    st.totals = { answered: 0, correct: 0, timeMs: 0 };
    $("#bScore").textContent = "Puntos: 0";
    $("#bStreak").textContent = "Racha: 0";

    // --- CAMBIO ---
    // 2. Resetear las tarjetas a su estado original
    $$(".qz-dot").forEach(d => {
      d.className = "qz-dot"; // Quita .correct, .wrong, .on
    });
    // --- FIN CAMBIO ---

    // 3. Seleccionar 10 preguntas al azar
    const shuffledBank = shuffle([...BANK]);
    st.questionPool = shuffledBank.slice(0, ROUNDS);

    // 4. Mostrar la UI del juego
    $("#qzTop").style.display = "flex";
    $("#qzNav").style.display = "flex";
    $("#opts").innerHTML = ""; // Limpiar el botón "Comenzar"

    // 5. Cargar la primera pregunta
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
    reveal(idx, ok, elapsed);
  }

  function reveal(idx, ok, elapsed){
    const btns = $$(".qz-opt");
    btns[current.shuffledCorrectIndex]?.classList.add("correct");

    // --- CAMBIO ---
    // Pinta la tarjeta de rojo o verde según el resultado
    const currentDot = $$(".qz-dot")[st.i];
    if (currentDot) {
      currentDot.classList.add(ok ? "correct" : "wrong");
    }
    // --- FIN CAMBIO ---

    // scoring
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

    $("#exp").style.display = "block";
    $("#exp").innerHTML = `
      <div><strong>Diagnóstico correcto:</strong> ${current.opciones[current.correcta]}</div>
      ${current.explicacion ? `<div style="margin-top:.35rem">${current.explicacion}</div>` : ""}
      ${current.tags?.length ? `<div class="qz-badges" style="margin-top:.35rem">${current.tags.map(t=>`<span class="badge">${t}</span>`).join("")}</div>` : ""}
    `;

    st.i++;
    $("#btnNext").disabled = false;
  }

  function nextQ(){
    if(st.i >= ROUNDS) return endGame();

    $("#btnNext").disabled = true;
    $("#exp").style.display = "none";
    $("#opts").innerHTML = "";
    
    // --- CAMBIO ---
    // Marca la tarjeta actual con la clase 'on' (borde azul)
    $$(".qz-dot").forEach((d, idx) => d.classList.toggle("on", idx === st.i));
    // --- FIN CAMBIO ---
    
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
    const mean = st.totals.answered ? Math.round(st.totals.timeMs / st.totals.answered) : 0;
    
    saveLocalScore("quiz-dx", st.score);
    updateBestBadge("quiz-dx");

    root.innerHTML = ""; // Limpia la UI del juego
    const box = el("div",{class:"qz-panel"});
    box.append(
      el("h2",{},"🏁 Resultado"),
      el("div",{} , `Correctas: ${st.totals.correct}/${st.totals.answered}`),
      el("div",{} , `Puntuación: ${st.score}`),
      el("div",{} , `Tiempo medio por pregunta: ${mean} ms`),
      el("div",{class:"qz-badges", style:"margin-top:.6rem;display:flex;gap:.5rem"},[
        // Llama a showStartScreen para reconstruir la UI
        el("button",{class:"btn btn-primary", onClick: showStartScreen}, "Jugar de nuevo"),
        el("a",{class:"btn btn-ghost", href:"./index.html"},"Volver a Juegos")
      ])
    );
    root.append(box);
  }

  // ---------- Estilos ----------
  function injectLiteStyles(){
    if(document.getElementById("quizdx-lite-css")) return;
    const css = `
      .qz-panel{width:min(760px,100%);display:grid;gap:.9rem}
      .qz-top{display:flex;align-items:center;gap:.5rem; flex-wrap: wrap;} /* wrap porsiaca */
      
      /* --- INICIO CAMBIO CSS TARJETAS --- */
      .qz-progress{display:flex;gap:.25rem;align-items:center;flex: 1 1 auto; order: 3; min-width: 100%;}
      .qz-dot{
        flex-basis: 28px; /* Ancho base */
        flex-grow: 1; /* Crecer para ocupar espacio */
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
        background: #dcfce7; /* Verde */
        color: #166534;
        border-color: #86efac;
      }
      .qz-dot.wrong{
        background: #fee2e2; /* Rojo */
        color: #991b1b;
        border-color: #fca5a5;
      }
      /* --- FIN CAMBIO CSS TARJETAS --- */

      .qz-timerbar{position:relative;height:10px;background:#eef2ff;border-radius:999px;overflow:hidden;flex: 1 1 200px; order: 1;}
      .qz-timerbar-fill{display:block;height:100%;width:100%;background:#0d6efd;transform-origin:left center;transform:scaleX(1)}
      .qz-badges{order: 2;}

      .qz-stem{font-size:1.05rem}
      .qz-opts{display:grid;gap:.5rem}
      .qz-opt{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:.65rem .8rem;text-align:left;cursor:pointer}
      .qz-opt.correct{background:#ecfdf5;border-color:#bbf7d0}
      .qz-opt.wrong{opacity:.65}
      .qz-badges .badge{font-size:.8rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .5rem}
      .qz-meta{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end}
      .qz-exp{background:#fbfbfe;border:1px solid #eef;padding:.6rem .7rem;border-radius:10px}
      .qz-opt:focus{outline:2px solid #0d6efd;outline-offset:2px}
    `;
    const style = document.createElement("style");
    style.id = "quizdx-lite-css";
    style.textContent = css;
    document.head.append(style);
  }

  // ---------- Inicio ----------
  injectLiteStyles();
  try{
    const res = await fetch(DATA_URL, {cache:"no-store"});
    BANK = await res.json();
    BANK = BANK.filter(q=>q && Array.isArray(q.opciones) && typeof q.correcta === "number");
    showStartScreen(); // Arranca el juego mostrando la pantalla de inicio
  }catch(err){
    root.textContent = "No se pudo cargar el banco de preguntas.";
    console.error(err);
    return;
  }
}