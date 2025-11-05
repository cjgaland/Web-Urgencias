// ======================
// 🎮 games-core.js (mini-ranking unificado por clave exacta)
// Núcleo común de juegos · Urgencias AGS Sur de Córdoba
// ======================

// ----- Parámetro de URL -----
const params = new URLSearchParams(location.search);
const gameId = params.get("game") || "quiz-dx"; // por defecto

// ----- Elementos base -----
const root     = document.getElementById("game-root");
const titleEl  = document.getElementById("game-title");
const bestLabel= document.getElementById("best-label");
const resetBtn = document.getElementById("btn-reset");

// ----- Diccionario de nombres bonitos -----
const GAME_NAMES = {
  "calculo":       "🧮 Cálculo mental",
  "parejas":       "🃏 Parejas (Memoria)",
  "capitales":     "🌍 Capitales (Geografía)",
  "quiz-dx":       "🧠 Quiz diagnóstico rápido",
  "sopa-clinica":  "🔎 Sopa clínica",
  "iberico":       "🗺️ Ibérico",
  "eponimos":      "🧑‍⚕️ Epónimos médicos",
  "anagrama":      "✍️ Anagrama Clínico",
  "siglas":        "🔠 Siglas Médicas",
  "intruso":       "🕵️‍♂️ El Intruso",
  "seguridad":     "⚠️ Desafío de Seguridad",
};

// ===== Utilidades comunes =====
function getAlias() {
  try {
    const v = localStorage.getItem("urgent-games-player");
    return (v ? v.trim() : "") || "Anónimo";
  } catch (e) {
    return "Anónimo";
  }
}

function getTopLocal(game, limit=10){
  try{
    const arr = JSON.parse(localStorage.getItem("urgent-games-scores")||"[]")
      .filter(x=>x.game===game)
      .sort((a,b)=> (Number(b.score)||0) - (Number(a.score)||0))
      .slice(0,limit);
    return arr;
  }catch(e){ return []; }
}

// ----- Guardar puntuación local -----
function saveLocalScore(game, score) {
  try {
    const key = "urgent-games-scores";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({
      user: getAlias(),
      game,
      score: Number(score)||0,
      ts: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(arr));
    updateBestBadge(game);
    // Aviso para refrescar mini-ranking
    window.dispatchEvent(new CustomEvent("urgent-score-updated", { detail:{game, score:Number(score)||0} }));
  } catch (err) {
    console.warn("No se pudo guardar puntuación:", err);
  }
}

// ----- Obtener mejor puntuación local -----
function getBestScore(game) {
  try {
    const arr = JSON.parse(localStorage.getItem("urgent-games-scores") || "[]")
      .filter((x) => x.game === game);
    if (arr.length === 0) return 0;
    return Math.max(...arr.map((x) => Number(x.score) || 0));
  } catch {
    return 0;
  }
}

// ----- Actualizar chip “Mejor” -----
function updateBestBadge(game) {
  const best = getBestScore(game);
  if (bestLabel) bestLabel.textContent = `Mejor: ${best}`;
}

// ===== Mini-Ranking embebido (inyectado dentro del área del juego) =====
function ensureStage() {
  if (!root) return null;
  const parent = root.parentElement;
  if (!parent) return null;

  let stage = parent.closest(".game-stage");
  if (!stage || stage.contains(root) === false) {
    stage = document.createElement("div");
    stage.className = "game-stage";
    stage.style.position = "relative";
    stage.style.minHeight = "200px";
    parent.replaceChild(stage, root);
    stage.appendChild(root);
  }

  let slot = document.getElementById("rank-mini");
  if (!slot) {
    slot = document.createElement("aside");
    slot.id = "rank-mini";
    stage.appendChild(slot);
  }
  injectMiniRankCSS();
  return slot;
}

function injectMiniRankCSS(){
  if (document.getElementById("mini-rank-css")) return;
  const css = `
  .game-stage #rank-mini{
    position:absolute; right:10px; bottom:10px; z-index:10;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Arial;
  }
  .rank-mini-box{
    background: rgba(255,255,255,.92);
    backdrop-filter: blur(4px);
    border:1px solid #e5e7eb; border-radius:10px;
    box-shadow:0 6px 18px rgba(0,0,0,.12);
    width: 220px; overflow:hidden;
  }
  .rank-mini-head{ display:flex; align-items:center; gap:.4rem; padding:.35rem .45rem; border-bottom:1px solid #eef; }
  .rank-mini-head .toggle{
    border:1px solid #e5e7eb; background:#fff; border-radius:999px;
    padding:.2rem .45rem; cursor:pointer; font-size:.9rem;
  }
  .rank-mini-head .title{ font-weight:800; font-size:.9rem; color:#111827; }
  .rank-mini-head .me{ margin-left:auto; color:#6b7280; font-size:.8rem; }
  .rank-mini-list{ list-style:none; margin:0; padding:.35rem; max-height: 28vh; overflow:auto; }
  .rank-mini-item{
    display:grid; grid-template-columns: 24px 1fr auto; gap:.35rem;
    align-items:center; padding:.22rem .3rem; border-radius:8px;
    font-size:.86rem; color:#111827;
  }
  .rank-mini-item.me{ background:#eff6ff; border:1px solid #bfdbfe; }
  .rank-mini-pos{ font-weight:800; color:#6b7280; text-align:center; }
  .rank-mini-user{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rank-mini-score{ font-weight:800; color:#0d6efd; }
  .rank-mini.compact .rank-mini-list{ display:none; }
  .rank-mini.compact .rank-mini-head{ border-bottom:none; }
  `;
  const s = document.createElement("style");
  s.id = "mini-rank-css";
  s.textContent = css;
  document.head.appendChild(s);
}

function renderMiniRank(game, highlightScore=null){
  const slot = ensureStage();
  if (!slot) return;

  const compactPrefKey = `mini-rank-compact-${game}`;
  
  // --- 👇 CORRECCIÓN 3 ---
  // "1" = compacto, "0" = expandido.
  // Por defecto (null), queremos que sea compacto (true).
  // null !== "0" -> true (Compacto)
  // "1" !== "0" -> true (Compacto)
  // "0" !== "0" -> false (Expandido)
  const isCompactSaved = localStorage.getItem(compactPrefKey) !== "0";
  // --- 👆 FIN CORRECCIÓN 3 ---

  const rows = getTopLocal(game, 10);
  const me = getAlias();

  slot.innerHTML = "";
  const box  = document.createElement("div");
  box.className = `rank-mini ${isCompactSaved ? "compact":""} rank-mini-box`;

  const head = document.createElement("div");
  head.className = "rank-mini-head";

  const btn  = document.createElement("button");
  btn.className = "toggle";
  btn.textContent = "🏆";
  btn.title = "Mostrar/ocultar Top 10";

  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "Top 10";

  const meTag = document.createElement("span");
  meTag.className = "me";
  meTag.textContent = me ? `👤 ${me}` : "👤 Anónimo";

  head.append(btn, title, meTag);
  box.appendChild(head);

  const list = document.createElement("ol");
  list.className = "rank-mini-list";

  if (rows.length === 0){
    const li = document.createElement("li");
    li.className = "rank-mini-item";
    li.textContent = "Sin puntuaciones";
    list.appendChild(li);
  } else {
    rows.forEach((r, i)=>{
      const li = document.createElement("li");
      li.className = "rank-mini-item" + ((r.user||"Anónimo")===me && (highlightScore==null || r.score===highlightScore) ? " me":"");
      const pos = document.createElement("span"); pos.className="rank-mini-pos";   pos.textContent = String(i+1);
      const usr = document.createElement("span"); usr.className="rank-mini-user"; usr.textContent = r.user || "Anónimo";
      const sc  = document.createElement("span"); sc.className="rank-mini-score"; sc.textContent  = `${r.score} pts`;
      li.append(pos, usr, sc);
      list.appendChild(li);
    });

    if (isCompactSaved && rows[0]) {
      title.textContent = `#1 ${rows[0].user} · ${rows[0].score}`;
    }
  }

  box.appendChild(list);
  slot.appendChild(box);

  btn.addEventListener("click", ()=>{
    box.classList.toggle("compact");
    const compact = box.classList.contains("compact");
    // Sigue guardando '1' para compacto, '0' para expandido
    localStorage.setItem(compactPrefKey, compact ? "1":"0");
    if (compact && rows[0]) {
      title.textContent = `#1 ${rows[0].user} · ${rows[0].score}`;
    } else {
      title.textContent = "Top 10";
    }
  });
}

// ===== Cargar módulo del juego =====
async function loadGameModule(game) {
  const modulePath = `./games/${game}.js`;
  try {
    const mod = await import(modulePath);
    if (mod && typeof mod.initGame === "function") {
      root.innerHTML = ""; // limpiar área

      const enrichedUpdateBestBadge = function(gameKey) {
        updateBestBadge(gameKey);
        renderMiniRank(gameKey);
      };

      mod.initGame({
        root,
        saveLocalScore,
        getAlias,
        updateBestBadge: enrichedUpdateBestBadge
      });

      renderMiniRank(defaultRankKeyFor(game));

    } else {
      root.innerHTML = `<p style="color:#900">El módulo del juego no tiene una función <code>initGame()</code>.</p>`;
      renderMiniRank(defaultRankKeyFor(game));
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p style="color:#900">No se pudo cargar el módulo <strong>${game}</strong>.</p>`;
    renderMiniRank(defaultRankKeyFor(game));
  }
}

// Clave inicial por juego (para el primer mini-ranking y el chip “Mejor”)
function defaultRankKeyFor(g){
  if (g === 'calculo')   return 'calculo-l1';
  if (g === 'parejas')   return 'parejas-l1';
  if (g === 'capitales') return 'capitales-capital';
  if (g === 'iberico')   return 'iberico-locprov';
  if (g === 'anagrama')  return 'anagrama-l1';
  if (g === 'seguridad') return 'seguridad-l1';
  return g;
}

// ===== Inicializar =====
function init() {
  const niceName = GAME_NAMES[gameId] || "Juego";
  if (titleEl) titleEl.textContent = niceName;

  const initialKey = defaultRankKeyFor(gameId);
  updateBestBadge(initialKey);

  loadGameModule(gameId);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      loadGameModule(gameId);
    });
  }

  window.addEventListener("urgent-score-updated", (ev)=>{
    if (ev && ev.detail && typeof ev.detail.game === "string") {
      renderMiniRank(ev.detail.game, ev.detail.score);
      updateBestBadge(ev.detail.game);
    }
  });
}

init();