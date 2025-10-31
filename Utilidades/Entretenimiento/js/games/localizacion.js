// ======================
// 📍 Localiza la lesión
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  const ROUNDS = 10;

  const here = location.pathname.replace(/[^/]+$/, "");
  const DATA_URLS = [
    here + "data/localizacion.json",
    "./data/localizacion.json",
    "../data/localizacion.json"
  ];

  const REGIONS = [
    {id:"cabeza",   x:110,y:10,w:80,h:60, label:"Cabeza"},
    {id:"torax",    x:95,y:75,w:110,h:70, label:"Tórax"},
    {id:"abd-der",  x:95,y:150,w:55,h:60, label:"Abdomen D"},
    {id:"abd-izq",  x:150,y:150,w:55,h:60, label:"Abdomen I"},
    {id:"pelvis",   x:110,y:215,w:80,h:50, label:"Pelvis"},
    {id:"ms-der",   x:35,y:85,w:55,h:130, label:"MS Dcha"},
    {id:"ms-izq",   x:210,y:85,w:55,h:130, label:"MS Izda"},
    {id:"mi-der",   x:110,y:270,w:35,h:120, label:"MI Dcha"},
    {id:"mi-izq",   x:155,y:270,w:35,h:120, label:"MI Izda"}
  ];

  const st = { i:0, score:0, streak:0, totals:{answered:0, correct:0, timeMs:0}};
  let BANK = [];
  let answered=false, tStart=0, current=null;

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
    const FALLBACK = [
      {id:"l01", enunciado:"Dolor en fosa ilíaca derecha", region:"abd-der"},
      {id:"l02", enunciado:"Traumatismo craneoencefálico", region:"cabeza"},
      {id:"l03", enunciado:"Dolor torácico opresivo", region:"torax"},
      {id:"l04", enunciado:"Herida en antebrazo derecho", region:"ms-der"},
      {id:"l05", enunciado:"Dolor en hemiabdomen izquierdo", region:"abd-izq"},
      {id:"l06", enunciado:"Dolor pélvico agudo", region:"pelvis"},
      {id:"l07", enunciado:"Esguince de tobillo izquierdo", region:"mi-izq"},
      {id:"l08", enunciado:"Fractura de fémur derecho", region:"mi-der"}
    ];
    for(const u of DATA_URLS){
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
    if(document.getElementById("loc-lite-css")) return;
    const css = `
    .lc-panel{width:min(820px,100%);display:grid;gap:.9rem}
    .lc-kpi .badge{font-size:.8rem;background:#f3f6ff;border:1px solid #e6ecff;border-radius:999px;padding:.15rem .5rem}
    .lc-map{border:1px solid #eef;background:#fff;border-radius:12px;padding:.4rem}
    .lc-q{border:1px solid #eef;background:#fbfbfe;border-radius:12px;padding:.6rem .7rem}
    .lc-legend{display:flex;gap:.5rem;flex-wrap:wrap}
    .hit{fill:rgba(13,110,253,.06);stroke:#6ea8fe;cursor:pointer}
    .hit:hover{fill:rgba(13,110,253,.12)}
    .hit.ok{fill:#ecfdf5;stroke:#86efac}
    .hit.ko{fill:#fee2e2;stroke:#fecaca}
    `;
    const s=document.createElement("style"); s.id="loc-lite-css"; s.textContent=css; document.head.append(s);
  }

  function mapSvg(){
    const NS="http://www.w3.org/2000/svg";
    const s=document.createElementNS(NS,"svg");
    s.setAttribute("viewBox","0 0 300 420");
    s.setAttribute("style","width:100%;height:auto;display:block");
    // cuerpo simplificado (silhueta ligera)
    const body=document.createElementNS(NS,"rect");
    body.setAttribute("x","90"); body.setAttribute("y","60");
    body.setAttribute("width","120"); body.setAttribute("height","330");
    body.setAttribute("rx","60"); body.setAttribute("fill","#f8fafc");
    body.setAttribute("stroke","#e5e7eb");
    s.append(body);
    // zonas clicables
    REGIONS.forEach(r=>{
      const hit=document.createElementNS(NS,"rect");
      hit.setAttribute("x",String(r.x));
      hit.setAttribute("y",String(r.y));
      hit.setAttribute("width",String(r.w));
      hit.setAttribute("height",String(r.h));
      hit.setAttribute("class","hit");
      hit.dataset.id = r.id;
      hit.addEventListener("click", ()=>pick(r.id, hit));
      s.append(hit);
    });
    return s;
  }

  function layout(){
    root.innerHTML = "";
    const panel = el("div",{class:"lc-panel"});
    const kpi = el("div",{class:"lc-kpi"},[
      el("span",{class:"badge",id:"bScore"},"Puntos: 0"),
      el("span",{class:"badge",id:"bStreak"},"Racha: 0"),
      el("span",{class:"badge"},"Jugador: "+getAlias())
    ]);
    const q = el("div",{class:"lc-q"},[
      el("div",{id:"stem"},"Pulsa «Comenzar»")
    ]);

    const map = el("div",{class:"lc-map"},[]);
    map.append(mapSvg());

    const legend = el("div",{class:"lc-legend"}, REGIONS.map(r=>el("span",{class:"badge"}, r.label)));

    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",onClick:()=>start()},"Comenzar"),
      el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver")
    ]);

    panel.append(kpi,q,map,legend,nav);
    root.append(panel);
  }

  function newCase(){
    current = BANK[(Math.random()*BANK.length)|0];
    $("#stem").textContent = current.enunciado;
    answered=false; tStart=performance.now();
    // limpiamos clases previas
    root.querySelectorAll(".hit").forEach(h=>h.classList.remove("ok","ko"));
  }

  function pick(id, hitEl){
    if(answered) return;
    answered = true;
    const elapsed = performance.now()-tStart;
    const ok = (id === current.region);
    st.totals.answered++; st.totals.timeMs += elapsed;

    if(ok){
      st.totals.correct++; st.streak++;
      const pts = Math.max(10, Math.round(100 - 0.1*elapsed)); // rápido = más puntos
      st.score += pts;
      hitEl.classList.add("ok");
    }else{
      st.streak = 0;
      hitEl.classList.add("ko");
      // marcar correcta
      const right = root.querySelector(`.hit[data-id="${current.region}"]`);
      if(right) right.classList.add("ok");
    }

    $("#bScore").textContent  = `Puntos: ${st.score}`;
    $("#bStreak").textContent = `Racha: ${st.streak}`;

    st.i++;
    setTimeout(()=>{
      if(st.i>=ROUNDS) return end();
      newCase();
    }, 600);
  }

  function start(){
    st.i=0; st.score=0; st.streak=0; st.totals={answered:0,correct:0,timeMs:0};
    $("#bScore").textContent="Puntos: 0"; $("#bStreak").textContent="Racha: 0";
    newCase();
  }

  function end(){
    const mean = st.totals.answered ? Math.round(st.totals.timeMs/st.totals.answered) : 0;
    saveLocalScore("localizacion", st.score);
    updateBestBadge("localizacion");
    root.innerHTML = "";
    root.append(
      el("div",{class:"lc-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{} ,`Aciertos: ${st.totals.correct}/${st.totals.answered}`),
        el("div",{} ,`Puntuación: ${st.score}`),
        el("div",{} ,`Tiempo medio: ${mean} ms`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem"},[
          el("a",{class:"btn btn-primary",href:location.href.replace(location.search,"")+"?game=localizacion"},"Jugar de nuevo"),
          el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  injectCss();
  layout();
  BANK = await loadBank();
}
