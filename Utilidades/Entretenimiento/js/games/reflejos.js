// ======================
// ⚡ Reflejos clínicos
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  const ROUNDS = 10;
  const MIN_DELAY = 800;   // ms
  const MAX_DELAY = 2500;  // ms
  const ACTIONS = ["Oxígeno", "Desfibrilar", "Adrenalina", "Vía aérea", "Reposo"];

  const here = location.pathname.replace(/[^/]+$/, "");
  const DATA_URLS = [
    here + "data/reflejos.json",
    "./data/reflejos.json",
    "../data/reflejos.json"
  ];

  const st = { i:0, score:0, streak:0, totals:{answered:0, correct:0, timeMs:0}};
  let BANK = [];
  let ready = false, fired = false, tStart = 0, cueTimer = 0;

  function $(s, el=root){ return (el||root).querySelector(s); }
  function el(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==="class") n.className=v;
      else if(k==="html") n.innerHTML=v;
      else if(k.startsWith("on") && typeof v==="function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k,v);
    }
    (Array.isArray(children)?children:[children]).forEach(c=>c!=null&&n.append(c));
    return n;
  }
  const shuffle = a => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);

  async function loadBank(){
    // fallback interno mínimo
    const FALLBACK = [
      {id:"r01", stim:"Parada con ritmo FV/TV sin pulso", ok:"Desfibrilar"},
      {id:"r02", stim:"Anafilaxia con hipotensión y sibilancias", ok:"Adrenalina"},
      {id:"r03", stim:"Insuficiencia respiratoria hipoxémica", ok:"Oxígeno"},
      {id:"r04", stim:"Glasgow 7 con vía aérea no protegida", ok:"Vía aérea"},
      {id:"r05", stim:"Crisis de ansiedad sin signos de gravedad", ok:"Reposo"},
      {id:"r06", stim:"Hipoxia por neumonía grave", ok:"Oxígeno"},
      {id:"r07", stim:"PCR con asistolia prolongada", ok:"Adrenalina"},
      {id:"r08", stim:"Obstrucción severa vía aérea", ok:"Vía aérea"},
      {id:"r09", stim:"FV persistente tras RCP", ok:"Desfibrilar"},
      {id:"r10", stim:"Mareo leve sin hipotensión", ok:"Reposo"}
    ];
    for (const u of DATA_URLS){
      try{
        const r = await fetch(u, {cache:"no-store"});
        if(r.ok){
          const d = await r.json();
          if(Array.isArray(d) && d.length) return d;
        }
      }catch{}
    }
    return FALLBACK;
  }

  function injectCss(){
    if(document.getElementById("reflejos-lite-css")) return;
    const css = `
    .rx-panel{width:min(760px,100%);display:grid;gap:.9rem}
    .rx-top{display:flex;align-items:center;gap:.5rem}
    .rx-stim{font-size:1.05rem;padding:.6rem .7rem;border:1px solid #eef;background:#fbfbfe;border-radius:10px}
    .rx-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.5rem}
    .rx-opts button{padding:.65rem .8rem;border-radius:10px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer;text-align:left}
    .rx-badges .badge{font-size:.8rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .5rem}
    .rx-signal{display:inline-block;padding:.25rem .5rem;border-radius:999px;border:1px solid #e6ecff;background:#edf2ff}
    `;
    const s = document.createElement("style");
    s.id = "reflejos-lite-css"; s.textContent = css; document.head.append(s);
  }

  function layout(){
    root.innerHTML = "";
    const panel = el("div",{class:"rx-panel"});
    const top   = el("div",{class:"rx-top"});
    const badges = el("div",{class:"rx-badges"},[
      el("span",{class:"badge",id:"bScore"},"Puntos: 0"),
      el("span",{class:"badge",id:"bStreak"},"Racha: 0"),
      el("span",{class:"badge"},"Jugador: "+getAlias()),
      el("span",{class:"rx-signal",id:"signal"},"—")
    ]);
    top.append(badges);

    const stim = el("div",{class:"rx-stim",id:"stim"},"Pulsa «Comenzar»");
    const opts = el("div",{class:"rx-opts",id:"opts"});
    ACTIONS.forEach(a=>{
      opts.append(el("button",{onClick:()=>act(a)}, a));
    });

    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"btnStart",onClick:()=>next()}, "Comenzar"),
      el("button",{class:"btn btn-secondary",id:"btnNext",disabled:true,onClick:()=>next()}, "Siguiente"),
      el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver")
    ]);

    panel.append(top, stim, opts, nav);
    root.append(panel);
  }

  function setSignal(txt){ $("#signal").textContent = txt; }

  function next(){
    $("#btnStart").disabled = true;
    $("#btnNext").disabled = true;
    ready = false; fired = false;
    setSignal("Preparado…");

    if(st.i >= ROUNDS) return end();

    // elige estímulo
    let pool = BANK;
    const q = pool[Math.floor(Math.random()*pool.length)];
    $("#stim").textContent = q.stim;

    // espera aleatoria y dispara
    const delay = Math.round(Math.random()*(MAX_DELAY-MIN_DELAY))+MIN_DELAY;
    clearTimeout(cueTimer);
    cueTimer = setTimeout(()=>{
      // ¡ACTÚA!
      fired = true; ready = true; setSignal("¡ACTÚA!");
      tStart = performance.now();
    }, delay);
  }

  function act(action){
    // si actúa antes de señal → nulo/penalización leve
    if(!ready){
      st.streak = 0;
      setSignal("Antes de tiempo");
      $("#btnNext").disabled = false;
      return;
    }
    const elapsed = performance.now() - tStart;
    const stimTxt = $("#stim").textContent;
    const q = BANK.find(x=>x.stim===stimTxt);
    const ok = q && q.ok === action;

    st.totals.answered++;
    st.totals.timeMs += elapsed;

    if(ok){
      st.totals.correct++;
      st.streak++;
      // 200 - 0.2*ms (mín 10)
      const pts = Math.max(10, Math.round(200 - 0.2*elapsed));
      st.score += pts;
      setSignal(`✔ ${action} (+${pts})`);
    }else{
      st.streak = 0;
      setSignal(`✖ ${action}`);
    }

    $("#bScore").textContent  = `Puntos: ${st.score}`;
    $("#bStreak").textContent = `Racha: ${st.streak}`;
    $("#btnNext").disabled = false;
  }

  function end(){
    const mean = st.totals.answered ? Math.round(st.totals.timeMs / st.totals.answered) : 0;
    saveLocalScore("reflejos", st.score);
    updateBestBadge("reflejos");
    root.innerHTML = "";
    root.append(
      el("div",{class:"rx-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{} ,`Correctas: ${st.totals.correct}/${st.totals.answered}`),
        el("div",{} ,`Puntuación: ${st.score}`),
        el("div",{} ,`Tiempo medio de reacción: ${mean} ms`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem"},[
          el("a",{class:"btn btn-primary",href:location.href.replace(location.search,"")+"?game=reflejos"},"Jugar de nuevo"),
          el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  // init
  injectCss();
  layout();
  BANK = await loadBank();
}
