// ======================
// 🧠 Agudeza mental (cálculo rápido)
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  const DURATION = 60000; // 60s
  let timer = 0, tEnd = 0, running = false;
  let ans = 0, score = 0, streak = 0, qCount = 0, hits = 0, misses = 0;

  function $(s, el=root){ return (el||root).querySelector(s); }
  function el(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==="class") n.className=v;
      // --- CAMBIO: Añadido 'id' para facilitar CSS ---
      else if(k==="id") n.id=v;
      else if(k==="html") n.innerHTML=v;
      else if(k.startsWith("on") && typeof v==="function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k,v);
    }
    (Array.isArray(children)?children:[children]).forEach(c=>c!=null&&n.append(c));
    return n;
  }
  function injectCss(){
    if(document.getElementById("mental-lite-css")) return;
    const css = `
    .mt-panel{width:min(760px,100%);display:grid;gap:.9rem}
    .kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem}
    .kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem; text-align: center;}
    .kpi .box .muted{font-size: 0.85rem; color: #6b7280;}
    .kpi .box div:last-child{font-weight: 700; font-size: 1.1rem;}
    .mt-q{font-size:1.6rem;font-weight:800;letter-spacing:.5px;text-align:center; margin-top: .5rem;}
    .mt-opts{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:.5rem}
    .mt-opts button{padding:.65rem .8rem;border:1px solid #e5e7eb;background:#f8fafc;border-radius:10px;text-align:center;cursor:pointer; font-size: 1.1rem;}
    
    /* --- CAMBIO: Estilos para cajas de aciertos y fallos --- */
    #box-hits { background: #dcfce7; border-color: #86efac; }
    #box-hits .muted { color: #15803d; }
    #box-hits div:last-child { color: #166534; }
    
    #box-misses { background: #fee2e2; border-color: #fca5a5; }
    #box-misses .muted { color: #b91c1c; }
    #box-misses div:last-child { color: #991b1b; }
    `;
    const s=document.createElement("style"); s.id="mental-lite-css"; s.textContent=css; document.head.append(s);
  }

  function layout(){
    root.innerHTML = "";
    const panel = el("div",{class:"mt-panel"});
    // --- CAMBIO: Añadidos IDs 'box-hits' y 'box-misses' ---
    const kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class:"muted"},"Tiempo"), el("div",{id:"t"},"60")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Puntos"), el("div",{id:"s"},"0")]),
      el("div",{class:"box", id:"box-hits"},[el("div",{class:"muted"},"Aciertos"), el("div",{id:"h"},"0")]),
      el("div",{class:"box", id:"box-misses"},[el("div",{class:"muted"},"Fallos"), el("div",{id:"m"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Racha"), el("div",{id:"st"},"0")]),
      el("div",{class:"box"},[el("div",{class:"muted"},"Jugador"), el("div",{} ,getAlias())])
    ]);
    const q = el("div",{class:"mt-q",id:"q"},"—");
    const opts = el("div",{class:"mt-opts",id:"opts"});
    const nav = el("div",{class:"qz-meta"},[
      el("button",{class:"btn btn-primary",id:"start",onClick:()=>start()},"Comenzar"),
      el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver")
    ]);
    panel.append(kpi,q,opts,nav);
    root.append(panel);
  }

  function gen(){
    const ops = ["+","-","×","÷"];
    const op = ops[(Math.random()*ops.length)|0];
    let a = (Math.random()*25|0)+2;
    let b = (Math.random()*25|0)+2;
    let res=0, expr="";
    if(op==="÷"){
      const d=(Math.random()*9|0)+2;
      const q=(Math.random()*12|0)+2;
      a=d*q; b=d; res=q; expr=`${a} ÷ ${b}`;
    }else if(op==="×"){ res=a*b; expr=`${a} × ${b}`; }
    else if(op==="-"){ res=a-b; expr=`${a} − ${b}`; }
    else { res=a+b; expr=`${a} + ${b}`; }
    
    const set = new Set([res]);
    while(set.size<4){
      let v = res + ((Math.random()*17|0)-8);
      if(v===res) v++;
      set.add(v);
    }
    const arr = [...set].sort(()=>Math.random()-0.5);
    $("#q").textContent = expr+" = ?";
    const cont = $("#opts"); cont.innerHTML = "";
    arr.forEach(v=>{
      const b = el("button",{onClick:()=>pick(v)}, String(v));
      cont.append(b);
    });
    ans = res;
  }

  function pick(v){
    if(!running) return;
    qCount++;
    if(v===ans){
      hits++;
      let bonus = (streak>=2)? 2: 0;
      score += 10 + bonus;
      streak++;
    }else{
      misses++;
      score = Math.max(0, score-5);
      streak = 0;
    }
    $("#s").textContent = String(score);
    $("#st").textContent = String(streak);
    $("#h").textContent = String(hits);
    $("#m").textContent = String(misses);
    gen();
  }

  function tick(){
    const left = Math.max(0, tEnd - performance.now());
    $("#t").textContent = String(Math.ceil(left/1000));
    if(left<=0){
      running = false;
      end();
    }else{
      timer = requestAnimationFrame(tick);
    }
  }

  function start(){
    score=0; streak=0; qCount=0; hits=0; misses=0;
    $("#s").textContent="0"; $("#st").textContent="0";
    $("#h").textContent="0"; $("#m").textContent="0";
    
    running = true; tEnd = performance.now()+DURATION;
    gen();
    cancelAnimationFrame(timer);
    timer = requestAnimationFrame(tick);
  }

  function end(){
    cancelAnimationFrame(timer);
    saveLocalScore("agudeza-mental", score);
    updateBestBadge("agudeza-mental");
    root.innerHTML = "";
    root.append(
      el("div",{class:"mt-panel"},[
        el("h2",{},"🏁 Resultado"),
        el("div",{} ,`Puntuación: ${score}`),
        el("div",{} ,`Aciertos: ${hits} / ${qCount}`),
        el("div",{} ,`Fallos: ${misses}`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem"},[
          el("a",{class:"btn btn-primary",href:location.href.replace(location.search,"")+"?game=agudeza-mental"},"Jugar de nuevo"),
          el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  injectCss();
  layout();
}