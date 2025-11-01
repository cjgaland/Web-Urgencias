// ======================
// 🔎 Sopa Clínica (de términos)
// v11: URL relativa como en quiz-dx (./data/...), sin import.meta,
// sin ranking propio (lo pinta games-core.js), con cache-buster al init.
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  const GAME_ID    = "sopa-clinica";
  const GRID_SIZE  = 10;
  const WORD_COUNT = 5;
  const TIME_LIMIT = 90; // segundos
  const DATA_URL   = "./data/sopa-clinica.json"; // ← igual que quiz-dx

  // ---------- Estado ----------
  let BANK = [], wordsToFind = [], grid = [];
  let score = 0, foundCount = 0;
  let timer = null, timeLeft = TIME_LIMIT, selStart = null, running = false;
  const wordPaths = new Map();

  // ---------- Util ----------
  const $  = (s, el=root) => (el||root).querySelector(s);
  const $$ = (s, el=root) => [...(el||root).querySelectorAll(s)];
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "id") n.id = v;
      else if (k === "html") n.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => c != null && n.append(c));
    return n;
  };
  const rnd = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const shuffle = a => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);

  // ---------- UI ----------
  function buildUI() {
    root.innerHTML = "";
    root.append(
      el("div",{class:"kpi"},[
        el("div",{class:"box"},[el("div",{class:"l muted"},"Tiempo"),      el("div",{class:"v", id:"tSopa"}, TIME_LIMIT)]),
        el("div",{class:"box"},[el("div",{class:"l muted"},"Encontradas"), el("div",{class:"v", id:"foundSopa"}, `0/${WORD_COUNT}`)]),
        el("div",{class:"box"},[el("div",{class:"l muted"},"Puntos"),      el("div",{class:"v score", id:"sSopa"}, "0")])
      ]),
      el("div",{class:"sopa-panel"},[
        el("div",{id:"sopaGrid", class:"letters"}),
        el("div",{class:"sopa-words"},[
          el("p",{class:"muted"},"Palabras a encontrar:"),
          el("ul",{class:"list", id:"wordList"}),
          el("button",{id:"startSopa", class:"btn btn-primary", onClick:startGame, disabled:true},"Cargando...")
        ])
      ])
    );
  }

  // ---------- Lógica de colocación ----------
  function placeWords(words) {
    grid.length = 0;
    for (let y=0; y<GRID_SIZE; y++) grid.push(Array(GRID_SIZE).fill(null));
    wordPaths.clear();

    const dirs = [[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,-1],[1,-1],[-1,1]];
    for (const w0 of words) {
      const w = (Math.random()<0.5) ? w0 : w0.split("").reverse().join("");
      let okPlaced = false, tries = 0;
      while (!okPlaced && tries < 200) {
        tries++;
        const [dx,dy] = dirs[rnd(0,dirs.length-1)];
        const x0 = rnd(0, GRID_SIZE-1), y0 = rnd(0, GRID_SIZE-1);
        const x1 = x0 + dx*(w.length-1), y1 = y0 + dy*(w.length-1);
        if (x1<0||x1>=GRID_SIZE||y1<0||y1>=GRID_SIZE) continue;
        let ok=true;
        for (let i=0;i<w.length;i++){
          const x=x0+dx*i, y=y0+dy*i;
          if (grid[y][x] && grid[y][x]!==w[i]) { ok=false; break; }
        }
        if (!ok) continue;

        const path = [];
        for (let i=0;i<w.length;i++){
          const x=x0+dx*i, y=y0+dy*i;
          grid[y][x]=w[i];
          path.push([x,y]);
        }
        wordPaths.set(w0, path);
        okPlaced = true;
      }
    }
    const letters="ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
    for (let y=0;y<GRID_SIZE;y++){
      for (let x=0;x<GRID_SIZE;x++){
        if (!grid[y][x]) grid[y][x]=letters[rnd(0,letters.length-1)];
      }
    }
  }

  // ---------- Pintado y selección ----------
  function renderGrid() {
    const g = $("#sopaGrid"); g.innerHTML = ""; g.style.pointerEvents = "auto";
    grid.forEach((row,y)=>{
      row.forEach((ch,x)=>{
        const d = el("div",{
          class:"cell", html:ch,
          onmousedown:()=>startSel(d),
          onmouseup:()=>endSel(d),
          onmouseenter:()=>enterSel(d)
        });
        d.dataset.x=x; d.dataset.y=y;
        g.appendChild(d);
      });
    });
  }
  function renderWordList(){
    const ul = $("#wordList"); ul.innerHTML = "";
    $(".sopa-words .muted").style.display = "block";
    wordsToFind.forEach(w => ul.append(el("li",{id:"w-"+w}, w)));
  }

  function startSel(elm){ if(!running) return; $$(".cell").forEach(c=>c.classList.remove("sel")); elm.classList.add("sel"); selStart=elm; }
  function enterSel(elm){
    if(!selStart) return;
    $$(".cell").forEach(c=>c.classList.remove("sel"));
    const x0=+selStart.dataset.x, y0=+selStart.dataset.y;
    const x1=+elm.dataset.x,     y1=+elm.dataset.y;
    getPath(x0,y0,x1,y1).forEach(([x,y])=> $(`[data-x="${x}"][data-y="${y}"]`)?.classList.add("sel"));
  }
  function endSel(elm){
    if(!selStart || !running) return;
    const x0=+selStart.dataset.x, y0=+selStart.dataset.y;
    const x1=+elm.dataset.x,     y1=+elm.dataset.y;

    const path = getPath(x0,y0,x1,y1);
    let fwd="", rev="";
    path.forEach(([x,y]) => { if(grid[y]&&grid[y][x]) fwd += grid[y][x]; });
    path.slice().reverse().forEach(([x,y]) => { if(grid[y]&&grid[y][x]) rev += grid[y][x]; });

    let foundWord = null;
    if (wordsToFind.includes(fwd)) foundWord = fwd;
    if (wordsToFind.includes(rev)) foundWord = rev;

    if (foundWord && !$("#w-"+foundWord).classList.contains("found")) {
      getPath(x0,y0,x1,y1).forEach(([x,y]) => $(`[data-x="${x}"][data-y="${y}"]`)?.classList.add("found"));
      $("#w-"+foundWord)?.classList.add("found");
      foundCount++; score += 30;
      $("#foundSopa").textContent = `${foundCount}/${WORD_COUNT}`;
      $("#sSopa").textContent     = score;

      if (foundCount === WORD_COUNT) {
        score += Math.max(0, timeLeft) * 2;
        $("#sSopa").textContent = score;
        endGame(true);
      }
    }
    selStart=null; $$(".cell").forEach(c=>c.classList.remove("sel"));
  }

  function getPath(x0,y0,x1,y1){
    const path=[];
    if (y0===y1){
      const [a,b]=x0<=x1?[x0,x1]:[x1,x0];
      for(let x=a;x<=b;x++) path.push([x,y0]);
    } else if (x0===x1){
      const [a,b]=y0<=y1?[y0,y1]:[y1,y0];
      for(let y=a;y<=b;y++) path.push([x0,y]);
    } else if (Math.abs(x1-x0)===Math.abs(y1-y0)){
      const len=Math.abs(x1-x0);
      const dx=(x1-x0)/len, dy=(y1-y0)/len;
      for(let i=0;i<=len;i++) path.push([Math.round(x0+dx*i), Math.round(y0+dy*i)]);
    }
    return path;
  }

  // ---------- Flujo ----------
  function tick(){
    $("#tSopa").textContent = timeLeft;
    if (timeLeft<=0) { endGame(false); return; }
    timeLeft--; timer = setTimeout(tick, 1000);
  }

  function startGame(){
    if (running) return;
    running = true;
    clearTimeout(timer); score=0; foundCount=0; timeLeft=TIME_LIMIT;
    $("#sSopa").textContent = "0";
    $("#foundSopa").textContent = `0/${WORD_COUNT}`;
    $("#startSopa").style.display = "none";

    placeWords(wordsToFind);
    renderGrid(); renderWordList();
    timer = setTimeout(tick, 1000);
  }

  function endGame(victoria){
    running = false;
    clearTimeout(timer);

    // Snapshot ANTES de tocar nada
    const snap = { victoria:!!victoria, score, found:foundCount, total:WORD_COUNT };

    // Guardar y actualizar etiqueta "Mejor" (games-core.js pintará mini-ranking)
    saveLocalScore(GAME_ID, snap.score);
    updateBestBadge(GAME_ID);

    if (snap.victoria) {
      showEndScreen(snap);
    } else {
      highlightMissedWords();
      $("#sopaGrid").style.pointerEvents = "none";
      const btn = $("#startSopa");
      btn.textContent = "Ver puntuación";
      btn.style.display = "block";
      btn.onclick = () => showEndScreen(snap);
    }
  }

  function highlightMissedWords(){
    for (const w of wordsToFind) {
      const li = $("#w-"+w);
      if (li && !li.classList.contains("found")) {
        const path = wordPaths.get(w);
        if (path) path.forEach(([x,y]) => $(`[data-x="${x}"][data-y="${y}"]`)?.classList.add("missed"));
      }
    }
  }

  function showEndScreen({victoria, score, found, total}){
    root.innerHTML = "";
    root.append(
      el("div",{class:"mt-panel", style:"text-align:center"},[
        el("h2",{}, victoria ? "🏁 ¡Completado!" : "⌛ Tiempo agotado"),
        el("div",{}, `Puntuación: ${score}`),
        el("div",{}, `Encontradas: ${found}/${total}`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem;justify-content:center"},[
          el("button",{class:"btn btn-primary", onClick: init}, "Jugar de nuevo"),
          el("a",{class:"btn btn-ghost", href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  // ---------- CSS mínimo del juego ----------
  function injectCss(){
    const OLD = document.getElementById("sopa-lite-css");
    if (OLD) OLD.remove();
    const css = `
      .kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1rem;}
      .kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem;text-align:center;}
      .kpi .box .l{font-size:.85rem;color:#6b7280;}
      .kpi .box .v{font-weight:700;font-size:1.1rem;}
      .kpi .box .score{color:#0d6efd;}

      .sopa-panel{display:grid;grid-template-columns:auto 1fr;gap:1.5rem;align-items:flex-start;}
      .letters{display:grid;grid-template-columns:repeat(${GRID_SIZE},32px);gap:4px;justify-content:center;background:#fff;padding:8px;border-radius:8px;border:1px solid #e5e7eb;}
      .cell{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#f9fafb;border:1px solid #e5e7eb;color:#1f2937;font-weight:800;cursor:pointer;user-select:none;font-size:.9rem;}
      .cell.sel{background:#cffafe;border-color:#0d6efd;}
      .cell.found{background:#dcfce7;color:#166534;border-color:#86efac;}
      .cell.missed{background:#fee2e2;color:#b91c1c;border-color:#fca5a5;}

      .sopa-words .list{list-style:none;padding:0;margin:.5rem 0;}
      .sopa-words .list li{color:#374151;}
      .sopa-words .list li.found{text-decoration:line-through;color:#16a34a;font-weight:700;opacity:.8;}
    `;
    const s = document.createElement("style");
    s.id = "sopa-lite-css";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- Pantalla de inicio ----------
  function showStartScreen(){
    buildUI();
    // Botón ya queda enlazado a startGame en buildUI()
  }

  // ---------- Init ----------
  async function init(){
    injectCss();
    buildUI();
    try{
      // Igual que en quiz-dx: URL relativa + cache-buster para reinicios seguidos
      const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache:"no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      BANK = await res.json();

      // Asegura que BANK sea un array de strings (palabras) o array de objetos con .palabra
      const normalized = [];
      for (const w of BANK){
        if (typeof w === "string") normalized.push(w.toUpperCase());
        else if (w && typeof w.palabra === "string") normalized.push(w.palabra.toUpperCase());
      }
      // Selección
      wordsToFind = shuffle(normalized).slice(0, WORD_COUNT);
      renderWordList();

      const btn = document.getElementById("startSopa");
      btn.disabled = false;
      btn.textContent = "Comenzar";
    }catch(err){
      console.error("Fallo cargando el banco de la sopa:", err);
      const btn = document.getElementById("startSopa");
      if (btn){
        btn.disabled = true;
        btn.textContent = "Error de carga";
        btn.title = "No se pudo cargar ./data/sopa-clinica.json (revisa ruta y mayúsculas/minúsculas en GitHub).";
      }
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "No se pudo cargar: " + DATA_URL;
      document.querySelector(".sopa-words")?.appendChild(p);
    }
  }
  init();
}
