// ======================
// 👀 Agudeza visual (pupilas)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  const ROUNDS = 10;
  const SIZE = { miotica:8, media:14, midriatica:20 }; // px de radio (aprox)
  let st = { i:0, score:0, streak:0, totals:{answered:0, correct:0, timeMs:0}};
  let tStart=0, answered=false;

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
  function injectCss(){
    if(document.getElementById("visual-lite-css")) return;
    const css = `
    .av-panel{width:min(760px,100%);display:grid;gap:.9rem}
    .av-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    .av-card{border:1px solid #eef;background:#fbfbfe;border-radius:12px;padding:.6rem .7rem}
    .av-opts{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:.5rem}
    .av-opts button{padding:.65rem .8rem;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;text-align:left;cursor:pointer}
    .badge{font-size:.8rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .5rem}
    .av-svg{display:block;margin-inline:auto;width:260px;height:120px}
    `;
    const s=document.createElement("style"); s.id="visual-lite-css"; s.textContent=css; document.head.append(s);
  }
  function rndItem(arr){ return arr[(Math.random()*arr.length)|0]; }

  function drawPupils(svg, rOD, rOI){
    svg.innerHTML = "";
    const NS="http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS,"svg");
    s.setAttribute("viewBox","0 0 260 120"); s.setAttribute("class","av-svg");
    // globo ocular
    const sclera=(cx)=>{ const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",cx); c.setAttribute("cy",60); c.setAttribute("r",40); c.setAttribute("fill","#fff"); c.setAttribute("stroke","#e5e7eb"); return c; };
    // iris
    const iris=(cx)=>{ const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",cx); c.setAttribute("cy",60); c.setAttribute("r",26); c.setAttribute("fill","#93c5fd"); c.setAttribute("stroke","#60a5fa"); return c; };
    // pupila
    const pupil=(cx,r)=>{ const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",cx); c.setAttribute("cy",60); c.setAttribute("r",r); c.setAttribute("fill","#0f172a"); return c; };

    [65,195].forEach(cx=>{
      s.append(sclera(cx)); s.append(iris(cx));
    });
    s.append(pupil(65, rOD)); s.append(pupil(195, rOI));
    svg.append(s);
  }

  function layout(){
    root.innerHTML = "";
    const panel = el("div",{class:"av-panel"});
    const kpi = el("div",{},[
      el("span",{class:"badge",id:"bScore"},"Puntos: 0"),
      el("span",{class:"badge",id:"bStreak"},"Racha: 0"),
      el("span",{class:"badge"},"Jugador: "+getAlias())
    ]);

    const vis = el("div",{class:"av-card"});
    const svgBox = el("div",{id:"svgBox"}); vis.append(svgBox);

    const q = el("div",{class:"av-row"},[
      el("div",{class:"av-card"},[
        el("div",{}, "¿Son isocóricas?"),
        el("div",{class:"av-opts"},[
          el("button",{onClick:()=>pick("iso-si")},"Sí"),
          el("button",{onClick:()=>pick("iso-no")},"No")
        ])
      ]),
      el("div",{class:"av-card"},[
        el("div",{}, "¿Son reactivas a la luz?"),
        el("div",{class:"av-opts"},[
          el("button",{onClick:()=>pick("rx-si")},"Sí"),
          el("button",{onClick:()=>pick("rx-no")},"No")
        ])
      ])
    ]);

    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:()=>start()},"Comenzar"),
      el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver")
    ]);

    panel.append(kpi, vis, q, nav);
    root.append(panel);
  }

  let truth = { iso:true, rx:true };
  let sel = { iso:null, rx:null };

  function newCase(){
    // genera caso aleatorio
    const sizes = Object.values(SIZE);
    const base = rndItem(sizes);
    const delta = Math.random()<0.5 ? 0 : (Math.random()<0.5 ? -4 : 4); // anisocoria leve
    const rOD = base;
    const rOI = Math.max(6, Math.min(22, base + delta));
    truth.iso = (Math.abs(rOD - rOI) <= 2); // ≤2 px ≈ isocóricas
    truth.rx  = Math.random()<0.8; // 80% reactivas (azar simple)

    // si “reactivas”, contrae ligeramente ambas pupilas (simulación)
    const adjOD = truth.rx ? Math.max(6, rOD - 2) : rOD;
    const adjOI = truth.rx ? Math.max(6, rOI - 2) : rOI;

    drawPupils($("#svgBox"), adjOD, adjOI);
    sel = { iso:null, rx:null };
    answered=false; tStart = performance.now();
  }

  function pick(key){
    if(answered) return;
    if(key==="iso-si") sel.iso = true;
    if(key==="iso-no") sel.iso = false;
    if(key==="rx-si")  sel.rx  = true;
    if(key==="rx-no")  sel.rx  = false;

    if(sel.iso!==null && sel.rx!==null){
      answered = true;
      const elapsed = performance.now() - tStart;
      st.totals.answered++; st.totals.timeMs += elapsed;

      const okIso = (sel.iso===truth.iso);
      const okRx  = (sel.rx===truth.rx);
      let gain = 0;
      if(okIso) gain+=10;
      if(okRx)  gain+=10;
      if(okIso && okRx && elapsed<3000) gain+=5; // bonus rapidez

      if(gain>0){ st.totals.correct++; st.streak++; }
      else { st.streak = 0; }

      st.score += gain;
      $("#bScore").textContent  = `Puntos: ${st.score}`;
      $("#bStreak").textContent = `Racha: ${st.streak}`;

      st.i++;
      if(st.i>=ROUNDS) return end();
      newCase();
    }
  }

  function start(){
    st = { i:0, score:0, streak:0, totals:{answered:0, correct:0, timeMs:0}};
    $("#bScore").textContent="Puntos: 0"; $("#bStreak").textContent="Racha: 0";
    newCase();
  }

  function end(){
    saveLocalScore("agudeza-visual", st.score);
    updateBestBadge("agudeza-visual");
    const mean = st.totals.answered ? Math.round(st.totals.timeMs / st.totals.answered) : 0;
    root.innerHTML = "";
    root.append(
      el("div",{class:"av-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{} ,`Aciertos: ${st.totals.correct}/${st.totals.answered}`),
        el("div",{} ,`Puntuación: ${st.score}`),
        el("div",{} ,`Tiempo medio: ${mean} ms`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem"},[
          el("a",{class:"btn btn-primary",href:location.href.replace(location.search,"")+"?game=agudeza-visual"},"Jugar de nuevo"),
          el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  injectCss();
  layout();
}
