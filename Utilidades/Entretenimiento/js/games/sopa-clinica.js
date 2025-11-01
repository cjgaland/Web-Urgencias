// ======================
// 🔎 Sopa Clínica (de términos)
// v5: Arregla bug de botón y añade Top 5
// ======================
export async function initGame({ root, saveLocalScore, getAlias, updateBestBadge }) {
  // ---------- Config ----------
  const GAME_ID = "sopa-clinica";
  const DATA_URL = "/Utilidades/Entretenimiento/data/sopa-clinica.json";
  const GRID_SIZE = 10;
  const WORD_COUNT = 5;
  const TIME_LIMIT = 90; // 90 segundos

  // ---------- Estado ----------
  let BANK = [], wordsToFind = [], grid = [];
  let score = 0, foundCount = 0;
  let timer = null, timeLeft = TIME_LIMIT, selStart = null, running = false;
  let wordPaths = new Map();

  // ---------- Util ----------
  function $(s, el=root){ return (el||root).querySelector(s); }
  function $$(s, el=root){ return [...(el||root).querySelectorAll(s)]; }
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
  const shuffle = (a) => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);

  // --- NUEVA FUNCIÓN: Lógica de ranking (copiada de ranking.html) ---
  function getTopLocal(game, limit=5){
    try{
      const arr = JSON.parse(localStorage.getItem("urgent-games-scores")||"[]")
        .filter(x=>x.game===game)
        .sort((a,b)=> (b.score||0) - (a.score||0))
        .slice(0,limit);
      return arr.map(r=>({...r, src:"local"}));
    }catch(e){ return []; }
  }

  // ---------- UI ----------
  function buildUI() {
    root.innerHTML = "";
    const kpi = el("div",{class:"kpi"},[
      el("div",{class:"box"},[el("div",{class: "l muted"},"Tiempo"), el("div",{class:"v", id:"tSopa"}, TIME_LIMIT)]),
      el("div",{class:"box"},[el("div",{class: "l muted"},"Encontradas"), el("div",{class:"v", id:"foundSopa"}, `0/${WORD_COUNT}`)]),
      el("div",{class:"box"},[el("div",{class: "l muted"},"Puntos"), el("div",{class:"v score", id:"sSopa"}, "0")])
    ]);
    
    const panel = el("div", {class:"sopa-panel"}, [
      el("div", {id:"sopaGrid", class:"letters"}),
      el("div", {class:"sopa-words"}, [
        el("p", {class:"muted"}, "Palabras a encontrar:"),
        el("ul", {class:"list", id:"wordList"}),
        el("button", {id:"startSopa", class:"btn btn-primary", onClick: startGame, disabled: true}, "Cargando..."),
        // El ranking se inyectará aquí
      ])
    ]);
    root.append(kpi, panel);
  }

  // ---------- Lógica de generación ----------
  function placeWords(words) {
    grid = Array.from({length:GRID_SIZE}, ()=>Array(GRID_SIZE).fill(null));
    wordPaths.clear();
    
    const dirs = [
      [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1]
    ];
    
    for(const w_original of words){
      const w = (Math.random() < 0.5) ? w_original : w_original.split('').reverse().join('');
      let placed=false, tries=0;

      while(!placed && tries<200){
        tries++;
        const [dx,dy] = dirs[rnd(0, dirs.length - 1)];
        const x0 = rnd(0, GRID_SIZE - 1), y0 = rnd(0, GRID_SIZE - 1);
        const x1 = x0 + dx*(w.length-1), y1 = y0 + dy*(w.length-1);
        
        if(x1<0||x1>=GRID_SIZE||y1<0||y1>=GRID_SIZE) continue;
        
        let ok=true;
        for(let i=0;i<w.length;i++){
          const x=x0+dx*i, y=y0+dy*i;
          if(grid[y][x] && grid[y][x]!==w[i]){ ok=false; break; }
        }
        if(!ok) continue;

        const path = [];
        for(let i=0;i<w.length;i++){
          const x=x0+dx*i, y=y0+dy*i;
          grid[y][x]=w[i];
          path.push([x, y]);
        }
        wordPaths.set(w_original, path);
        placed=true;
      }
      if (!placed) console.warn(`No se pudo colocar la palabra: ${w}`);
    }
    
    const letters="ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
    for(let y=0;y<GRID_SIZE;y++){
      for(let x=0;x<GRID_SIZE;x++){
        if(!grid[y][x]) grid[y][x]=letters[rnd(0,letters.length-1)];
      }
    }
  }

  // ---------- Lógica de pintado y selección ----------
  function renderGrid() {
    const g = $("#sopaGrid"); g.innerHTML = "";
    g.style.pointerEvents = "auto";
    grid.forEach((row,y)=>{
      row.forEach((ch,x)=>{
        const d = el("div", {
          class:"cell", 
          html: ch,
          onmousedown: () => startSel(d),
          onmouseup: () => endSel(d),
          onmouseenter: () => enterSel(d)
        });
        d.dataset.x=x; d.dataset.y=y;
        g.appendChild(d);
      });
    });
  }

  function renderWordList() {
    const ul = $("#wordList"); 
    ul.innerHTML = "";
    ul.style.display = "block"; // Asegura que se vea
    $(".sopa-words .muted").style.display = "block";
    wordsToFind.forEach(w => {
      ul.append(el("li", {id:"w-"+w}, w));
    });
  }

  // --- NUEVA FUNCIÓN: Pinta el ranking en la UI ---
  function renderTop5() {
    const oldRank = $(".sopa-ranking");
    if (oldRank) oldRank.remove(); // Borra el ranking anterior si existe

    const scores = getTopLocal(GAME_ID, 5);
    if (scores.length === 0) return; // No hacer nada si no hay puntuaciones

    const items = scores.map(s => 
      el("li", {}, [
        el("span", {class:"rank-score"}, s.score + " pts"),
        el("span", {class:"rank-user"}, s.user || "Anónimo")
      ])
    );

    const rankBox = el("div", {class:"sopa-ranking"}, [
      el("h4", {}, "🏆 Top 5 (Local)"),
      el("ul", {}, items)
    ]);
    $(".sopa-words").append(rankBox);
  }

  function startSel(el) {
    if (!running) return;
    $$(".cell").forEach(c=>c.classList.remove("sel"));
    el.classList.add("sel");
    selStart=el;
  }
  
  function enterSel(el) {
    if (!selStart) return;
    $$(".cell").forEach(c=>c.classList.remove("sel"));
    
    const x0=+selStart.dataset.x, y0=+selStart.dataset.y;
    const x1=+el.dataset.x, y1=+el.dataset.y;
    
    getPath(x0, y0, x1, y1).forEach(([x,y]) => {
      const c = $(`[data-x="${x}"][data-y="${y}"]`);
      c?.classList.add("sel");
    });
  }

  function endSel(el) {
    if(!selStart || !running) return;
    
    const x0=+selStart.dataset.x, y0=+selStart.dataset.y;
    const x1=+el.dataset.x, y1=+el.dataset.y;
    
    let word="", r_word="";
    const path = getPath(x0, y0, x1, y1);
    
    path.forEach(([x,y]) => {
      if(grid[y] && grid[y][x]) word += grid[y][x];
    });
    path.reverse().forEach(([x,y]) => {
      if(grid[y] && grid[y][x]) r_word += grid[y][x];
    });
    
    let foundWord = null;
    if (wordsToFind.includes(word)) foundWord = word;
    if (wordsToFind.includes(r_word)) foundWord = r_word;

    if(foundWord && !$("#w-"+foundWord).classList.contains("found")){
      getPath(x0, y0, x1, y1).forEach(([x,y]) => {
         $(`[data-x="${x}"][data-y="${y}"]`)?.classList.add("found");
      });
      
      const li = $("#w-"+foundWord); 
      if(li) li.classList.add("found");
      
      foundCount++;
      score += 30;
      $("#foundSopa").textContent = `${foundCount}/${WORD_COUNT}`;
      $("#sSopa").textContent = score;
      
      if(foundCount === WORD_COUNT){
        score += Math.max(0, timeLeft) * 2;
        $("#sSopa").textContent = score;
        endGame(true);
      }
    }
    selStart=null;
    $$(".cell").forEach(c=>c.classList.remove("sel"));
  }

  function getPath(x0,y0,x1,y1) {
    const path = [];
    if(y0===y1) {
      const [a,b] = x0<=x1 ? [x0,x1] : [x1,x0];
      for(let x=a;x<=b;x++) path.push([x,y0]);
    } else if(x0===x1) {
      const [a,b] = y0<=y1 ? [y0,y1] : [y1,y0];
      for(let y=a;y<=b;y++) path.push([x0,y]);
    } else if (Math.abs(x1-x0) === Math.abs(y1-y0)) {
      const len = Math.abs(x1-x0);
      const dx = (x1-x0) / len;
      const dy = (y1-y0) / len;
      for (let i=0; i<=len; i++) path.push([Math.round(x0 + dx*i), Math.round(y0 + dy*i)]);
    }
    return path;
  }

  // ---------- Flujo del juego ----------
  function tick(){
    $("#tSopa").textContent = timeLeft;
    if(timeLeft<=0){
      endGame(false);
      return;
    }
    timeLeft--;
    timer = setTimeout(tick, 1000);
  }

  function startGame() {
    if(running) return;
    running = true;
    clearTimeout(timer);
    
    score=0; foundCount=0; timeLeft = TIME_LIMIT;
    $("#sSopa").textContent = "0";
    $("#foundSopa").textContent = `0/${WORD_COUNT}`;
    $("#startSopa").style.display = "none";
    $(".sopa-words").style.display = "block";
    $(".sopa-ranking").style.display = "none"; // Oculta el ranking al empezar
    
    placeWords(wordsToFind);
    renderGrid();
    renderWordList();
    
    timer = setTimeout(tick, 1000);
  }

  function endGame(victoria) {
    running = false;
    clearTimeout(timer);
    saveLocalScore(GAME_ID, score);
    updateBestBadge(GAME_ID);
    
    if (victoria) {
      showEndScreen(true);
    } else {
      highlightMissedWords();
      $("#sopaGrid").style.pointerEvents = "none";
      
      // --- CAMBIO: Lógica del botón corregida ---
      $("#wordList").style.display = "none"; // Oculta solo la lista
      $(".sopa-words .muted").style.display = "none"; // Oculta el título
      
      const btn = $("#startSopa");
      btn.textContent = "Ver Puntuación";
      btn.style.display = "block";
      btn.onclick = () => showEndScreen(false);
    }
  }

  function highlightMissedWords() {
    for (const word of wordsToFind) {
      const li = $("#w-" + word);
      if (li && !li.classList.contains("found")) {
        const path = wordPaths.get(word);
        if (path) {
          for (const [x, y] of path) {
            $(`[data-x="${x}"][data-y="${y}"]`)?.classList.add("missed");
          }
        }
      }
    }
  }
  
  function showEndScreen(victoria) {
    root.innerHTML = "";
    root.append(
      el("div",{class:"mt-panel", style:"text-align:center"},[
        el("h2",{}, victoria ? "🏁 ¡Completado!" : "⌛ Tiempo agotado"),
        el("div",{} ,`Puntuación: ${score}`),
        el("div",{} ,`Encontradas: ${foundCount}/${WORD_COUNT}`),
        el("div",{class:"qz-badges",style:"margin-top:.6rem;display:flex;gap:.5rem;justify-content:center"},[
          el("button",{class:"btn btn-primary",onClick: init}, "Jugar de nuevo"),
          el("a",{class:"btn btn-ghost",href:"./index.html"},"Volver a Juegos")
        ])
      ])
    );
  }

  // ---------- CSS ----------
  function injectCss(){
    if(document.getElementById("sopa-lite-css")) return;
    const css = `
    .kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem; margin-bottom: 1rem;}
    .kpi .box{border:1px solid #eef;background:#fbfbfe;border-radius:10px;padding:.6rem .7rem; text-align: center;}
    .kpi .box .l{font-size: 0.85rem; color: #6b7280;}
    .kpi .box .v{font-weight: 700; font-size: 1.1rem;}
    .kpi .box .score{color:#0d6efd;}
    
    .sopa-panel { display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: flex-start; }
    .letters{display:grid;grid-template-columns:repeat(${GRID_SIZE},32px);gap:4px;justify-content:center; background: #fff; padding: 8px; border-radius: 8px; border: 1px solid #e5e7eb;}
    .cell{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:#f9fafb;border:1px solid #e5e7eb;color:#1f2937;font-weight:800;cursor:pointer;user-select:none; font-size: 0.9rem;}
    .cell.sel{background:#cffafe; border-color: #0d6efd;}
    .cell.found{background:#dcfce7;color:#166534;border-color:#86efac;}
    .cell.missed { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }

    .sopa-words .list { list-style: none; padding: 0; margin: 0.5rem 0; }
    .sopa-words .list li { color: #374151; }
    .sopa-words .list li.found { text-decoration: line-through; color: #16a34a; font-weight: 700; opacity: 0.8; }
    
    /* --- NUEVO: Estilos para el ranking --- */
    .sopa-ranking { margin-top: 1.5rem; border-top: 1px solid #eee; padding-top: 1rem; }
    .sopa-ranking h4 { margin: 0 0 0.5rem; font-size: 1rem; color: #111; }
    .sopa-ranking ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.25rem; }
    .sopa-ranking li { display: flex; justify-content: space-between; font-size: 0.9rem; }
    .sopa-ranking .rank-score { font-weight: 700; color: #0d6efd; }
    .sopa-ranking .rank-user { color: #6b7280; }
    `;
    const s=document.createElement("style"); s.id="sopa-lite-css"; s.textContent=css; document.head.append(s);
  }

  // ---------- Init ----------
  async function init() {
    injectCss();
    buildUI(); // Construye la UI base
    try {
      const res = await fetch(DATA_URL);
      BANK = await res.json();
      
      wordsToFind = shuffle([...BANK]).slice(0, WORD_COUNT);
      renderWordList(); // Pinta la lista
      renderTop5(); // Pinta el ranking
      
      $("#startSopa").disabled = false;
      $("#startSopa").textContent = "Comenzar";

    } catch (err) {
      $("#startSopa").textContent = "Error de carga";
      console.error(err);
    }
  }
  
  init();
}