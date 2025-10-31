// ======================
// 🎮 games-core.js
// Núcleo común de juegos · Urgencias AGS Sur de Córdoba
// ======================

// ----- Parámetro de URL -----
const params = new URLSearchParams(location.search);
const gameId = params.get("game") || "quiz-dx"; // por defecto

// ----- Elementos base -----
const root = document.getElementById("game-root");
const titleEl = document.getElementById("game-title");
const bestLabel = document.getElementById("best-label");
const resetBtn = document.getElementById("btn-reset");

// ----- Diccionario de nombres bonitos -----
const GAME_NAMES = {
  "quiz-dx": "Quiz diagnóstico rápido",
  "reflejos": "Reflejos clínicos",
  "agudeza-visual": "Agudeza visual",
  "agudeza-mental": "Agudeza mental",
  "localizacion": "Localiza la lesión"
};

// ----- Alias del jugador -----
function getAlias() {
  try {
    const v = localStorage.getItem("urgent-games-player");
    return v?.trim() || "Anónimo";
  } catch {
    return "Anónimo";
  }
}

// ----- Guardar puntuación local -----
function saveLocalScore(game, score) {
  try {
    const key = "urgent-games-scores";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push({
      user: getAlias(),
      game,
      score,
      ts: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(arr));
    updateBestBadge(game);
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
    return Math.max(...arr.map((x) => x.score || 0));
  } catch {
    return 0;
  }
}

// ----- Actualizar chip “Mejor” -----
function updateBestBadge(game) {
  const best = getBestScore(game);
  bestLabel.textContent = `Mejor: ${best}`;
}

// ----- Cargar módulo del juego -----
async function loadGameModule(game) {
  const modulePath = `./games/${game}.js`;
  try {
    const mod = await import(modulePath);
    if (mod?.initGame) {
      root.innerHTML = ""; // limpiar área
      mod.initGame({ root, saveLocalScore, getAlias, updateBestBadge });
    } else {
      root.innerHTML = `<p style="color:#900">El módulo del juego no tiene una función <code>initGame()</code>.</p>`;
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p style="color:#900">No se pudo cargar el módulo <strong>${game}</strong>.</p>`;
  }
}

// ----- Inicializar -----
function init() {
  const niceName = GAME_NAMES[gameId] || "Juego";
  titleEl.textContent = niceName;
  updateBestBadge(gameId);
  loadGameModule(gameId);
  resetBtn.addEventListener("click", () => {
    loadGameModule(gameId);
  });
}

init();
