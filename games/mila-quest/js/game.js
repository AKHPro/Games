import * as THREE from "../assets/lib/three.module.js";
import { GLTFLoader } from "../assets/lib/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "../assets/lib/jsm/utils/SkeletonUtils.js";
import { WORDS } from "./data.js";
import { wordsForAge, speakText, spellTarget, questionOverride, validateAgeBanks } from "./age.js";
import { KEY, NEED_CLEAN, PTS, HEROES, BOSSES, ST, WORLDS, ACH, INTRO, NSTAGES, BOSS_ST } from "./config.js";
import { buildCourse, pathAt, pathFrame, worldOnPath, makeStoneTexture, makeDirtTexture, makeGrassTexture, makeValleyTexture, makeSmoothTree, makeMountains, makeMist, makeRibbonGeometry, makeSkirtGeometry, populateValley, scatterGroundDetails, plantCourseFlags, updateFlagWave, makeIsraelFlag } from "./worldkit.js";
import { themeOf, THEME_LOOK, THEME_MOUNTAINS, buildThemeCourse, buildThemeAmbience, makeThemeDecor, makeThemedHazard, fxTime } from "./themes.js";
import { GFX, setGfxLevel, N } from "./gfx.js";
import { mergeStatic } from "./merge.js";
import { NEW_THEMES, buildWorld2Course, buildWorld2Ambience, world2Decor, world2Hazard } from "./worlds2.js";
import { PROPS, stagePlan, stageSceneName, stageLook, stageDecorSpec, buildStageScatter, buildStageAtmos } from "./stages.js";
import { normSettings, difficultyFor, stageModes, worldMode, isListenMode, MODE_LABEL, MODE_DESC, QTYPES, DIFFS, GFX_OPTS, DEFAULT_SETTINGS, AGES, normAge } from "./settings.js";

let GPU_INFO = "";
function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      try {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        GPU_INFO = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
      } catch (e) {}
      try { const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext(); } catch (e) {}
    }
    return !!gl;
  } catch (e) { return false; }
}
if (!hasWebGL()) {
  location.replace("./index-v1-quiz.html");
  throw new Error("No WebGL");
}

const $ = (id) => document.getElementById(id);
const MP = (p) => "./assets/models/" + p;
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ===== SAVE ===== */
const def = () => ({ stagesV: 2, prog: {}, hero: 0, coins: 0, stars: 0, notebook: {}, known: {}, best: 0, runs: 0, ach: [], free: false, muted: false, quality: "high", settings: DEFAULT_SETTINGS(), autoTier: null });
let S;
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
  S = Object.assign(def(), raw);
  // v7 -> v8 migration: the old "💡 חסכונית" toggle becomes graphics = Low
  if (!raw.settings && raw.quality === "low") S.settings.gfx = "low";
  // v8a -> v8b: worlds had 5 stages (boss = index 4); now 7 (boss = index 6)
  if (!raw.stagesV && raw.prog) {
    const np = {};
    for (const [k, v] of Object.entries(raw.prog)) { const [w, t] = k.split("-"); np[w + "-" + (t === "4" ? 6 : +t)] = v; }
    S.prog = np;
  }
} catch (e) { S = def(); }
S.stagesV = 2;
S.settings = normSettings(S.settings);

const GAME_ID = "mila-quest";
const activeWords = () => wordsForAge(S.settings && S.settings.age, WORDS);
const refreshWordcount = () => { const n = activeWords().length; const el = $("wordcount"); if (el) el.textContent = n; };

const progressFields = (s) => ({
  stagesV: 2,
  prog: s.prog || {},
  hero: s.hero || 0,
  coins: s.coins || 0,
  stars: s.stars || 0,
  notebook: s.notebook || {},
  known: s.known || {},
  best: s.best || 0,
  runs: s.runs || 0,
  ach: Array.isArray(s.ach) ? s.ach.slice() : [],
  age: (s.settings && s.settings.age) || "de"
});
const keepDevice = (s) => ({
  muted: !!s.muted,
  quality: s.quality || "high",
  settings: s.settings,
  autoTier: s.autoTier,
  free: !!s.free,
  stagesV: 2
});
function applyProgressData(p) {
  const dev = keepDevice(S);
  S = Object.assign(def(), dev, p || {});
  S.settings = normSettings(dev.settings);
  S.settings.age = normAge(p && p.age);
  S.free = dev.free;
  S.muted = dev.muted;
  S.stagesV = 2;
  refreshWordcount();
}
function loadActiveProgress() {
  if (!window.Englishia || !Englishia.getName()) return;
  const p = Englishia.getProgress(GAME_ID);
  if (p) applyProgressData(p);
}
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  try {
    if (window.Englishia && Englishia.getName()) Englishia.setProgress(GAME_ID, progressFields(S));
  } catch (e) {}
};
loadActiveProgress();

/* ===== AUDIO ===== */
let muted = !!S.muted, ac = null;
function tone(f, d = .12, t = "sine", v = .07) {
  const vol = S.settings ? S.settings.sfx : 1;
  if (muted || vol <= 0) return;
  v *= vol;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = t; o.frequency.value = f; g.gain.value = v;
    o.connect(g); g.connect(ac.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + d); o.stop(ac.currentTime + d);
  } catch (e) {}
}
const sfx = {
  click: () => tone(420, .06, "triangle", .05),
  good: () => { tone(523, .08); setTimeout(() => tone(659, .08), 80); setTimeout(() => tone(784, .16), 160); },
  bad: () => tone(196, .28, "triangle", .06),
  coin: () => { tone(980, .06); setTimeout(() => tone(1320, .08), 60); },
  jump: () => tone(620, .07, "square", .03)
};
function say(w, rate, force) {
  let vol = S.settings ? S.settings.voice : 1;
  if (force) vol = Math.max(vol, 0.7);           // v9: the listening replay button always speaks
  else if (muted || vol <= 0) return;
  if (!window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US"; u.rate = rate || .82; u.volume = vol;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
/* v9 listening stages: speak the current word (never shown as text) */
function sayCurrent(slow, force) {
  if (!run || !run.cur) return;
  const D = run.layout && run.layout.diff;
  const r = (D && D.rate) || .82;
  say(run.speakText || speakText(run.cur), slow ? Math.max(0.55, r - 0.22) : r, force);
}
$("mute").textContent = muted ? "🔇" : "🔊";
function toggleMute() { muted = !muted; S.muted = muted; save(); $("mute").textContent = muted ? "🔇" : "🔊"; if ($("btn-hud-mute")) $("btn-hud-mute").textContent = muted ? "🔇" : "🔊"; }
$("mute").onclick = toggleMute;
if ($("btn-hud-mute")) { $("btn-hud-mute").textContent = muted ? "🔇" : "🔊"; $("btn-hud-mute").onclick = toggleMute; }

/* ===== PROGRESS HELPERS ===== */
const starSum = () => Object.values(S.prog).reduce((a, b) => a + b, 0);
const stDone = (w, t) => !!S.prog[w + "-" + t];
const bossDone = (wid) => !!S.prog[wid + "-" + BOSS_ST];
const keysOwned = () => WORLDS.filter((w) => bossDone(w.id)).map((w) => w.id);
const wOpen = (i) => S.free || i === 0 || bossDone(WORLDS[i - 1].id);
const sOpen = (i, t) => wOpen(i) && (S.free || t === 0 || stDone(WORLDS[i].id, t - 1) || stDone(WORLDS[i].id, t));
const nbs = () => activeWords().map((w) => ({ w, n: S.notebook[w.en] })).filter((x) => x.n);
const learnedCount = () => activeWords().filter((w) => (S.notebook[w.en] && S.notebook[w.en].learned) || S.known[w.en]).length;
const worldsDone = () => WORLDS.filter((w) => ST[w.id - 1].every((_, t) => stDone(w.id, t))).length;
function grantAch(id) { if (!S.ach.includes(id)) { S.ach.push(id); save(); } }

function record(word, ok, hint, wrongHere) {
  S.known = S.known || {};
  if (ok) {
    const clean = !hint && !wrongHere;
    const n = S.notebook[word.en];
    if (n) {
      n.right = (n.right || 0) + 1;
      n.streak = clean ? (n.streak || 0) + 1 : 0;
      if (n.streak >= NEED_CLEAN) n.learned = true;
    }
    S.known[word.en] = n ? !!n.learned : clean;
    if (hint >= 3) {
      const m = S.notebook[word.en] || (S.notebook[word.en] = { wrong: 0, right: 0, streak: 0, learned: false });
      m.learned = false; m.streak = 0; S.known[word.en] = false;
    }
  } else {
    const m = S.notebook[word.en] || (S.notebook[word.en] = { wrong: 0, right: 0, streak: 0, learned: false });
    m.wrong = (m.wrong || 0) + 1; m.streak = 0; m.learned = false; S.known[word.en] = false;
  }
  save();
}

/* ===== UI ===== */
function hideAll() {
  ["s-load", "s-title", "s-help", "s-map", "hud", "modal", "s-nb", "s-jr", "s-end", "dev-panel"].forEach((id) => $(id) && $(id).classList.add("hidden"));
}
function isDev() { return typeof window !== "undefined" && window.MQ_DEV === true; }
function syncDevButton(id) {
  const btn = $("btn-dev");
  if (!btn) return;
  const menu = isDev() && (id === "s-title" || id === "s-map" || id === "s-help" || id === "s-jr" || id === "s-nb");
  btn.classList.toggle("hidden", !menu);
}
function showUI(id) { hideAll(); $(id).classList.remove("hidden"); syncDevButton(id); document.body.dataset.ui = id; closeAccountMenu(); }
function showModal(html) {
  $("modal-box").innerHTML = html;
  $("modal").classList.remove("hidden");
}
function hideModal() { $("modal").classList.add("hidden"); }
function coinHtml(n) { return `<span class="ico-coin" aria-hidden="true"></span> ${n}`; }
function formatPlayTime(sec) {
  sec = Math.max(0, Math.round(+sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return h + " שע׳ " + m + " דק׳";
  if (m) return s ? (m + " דק׳ " + s + " שנ׳") : (m + " דק׳");
  return s + " שנ׳";
}
function formatLbDate(iso) {
  try { return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit" }); }
  catch (e) { return ""; }
}

function refreshMapStats() {
  S.stars = starSum();
  $("map-coins").textContent = S.coins;
  $("map-stars").textContent = S.stars;
  const ln = learnedCount();
  $("stat-learned").textContent = ln;
  $("stat-total").textContent = activeWords().length;
  $("stat-practice").textContent = nbs().filter((x) => !x.n.learned).length;
  $("stat-worlds").textContent = worldsDone();
  $("stat-bar").style.width = (ln / activeWords().length * 100).toFixed(1) + "%";
  const mk = $("map-keys");
  if (mk) mk.textContent = keysOwned().length;
}

function stageLabel(i, k) {
  const t = ST[i][k];
  if (t[1] === "boss") return t[0];
  return MODE_LABEL[worldMode(i + 1, S.settings)] || t[0];
}
/* v9: what changes inside a world (shown under the stage tile) */
function stageTwist(i, k) {
  const m = worldMode(i + 1, S.settings);
  const D = difficultyFor(i + 1, k, k === BOSS_ST, S.settings);
  let t = "";
  if (m === "picw") t = D.picRiddle ? "תמונה + חידה" : "תמונה בלבד";
  else if (m === "let") t = D.letMissing >= 2 ? "שתי אותיות" : "אות אחת";
  else if (m === "build") t = D.spellModel ? "עם דוגמה" : "בלי דוגמה";
  const fire = "⚡".repeat(Math.min(5, 1 + Math.floor((i * 6 + Math.min(k, 6)) / 10)));
  return `<div class="t-twist">${t ? esc(t) + " · " : ""}${fire}</div>`;
}
/* v9: the exercise type of world i (0-based), in Hebrew, after the settings toggles */
function worldTypeLabel(i) { return MODE_LABEL[worldMode(i + 1, S.settings)] || ""; }
function renderWorldChips() {
  const box = $("world-chips");
  if (!box) return;
  box.innerHTML = WORLDS.map((w, i) => {
    const done = ST[i].filter((_, k) => stDone(w.id, k)).length;
    return `<button class="wchip${i === selectedWorld ? " sel" : ""}${wOpen(i) ? "" : " lock"}" data-w="${i}">${w.icon} ${esc(w.name)} <span class="wtype">${esc(worldTypeLabel(i))}</span> ${wOpen(i) ? done + "/" + NSTAGES : "🔒"}</button>`;
  }).join("");
  box.onclick = (e) => {
    const b = e.target.closest("[data-w]");
    if (!b) return;
    selectedWorld = +b.dataset.w;
    highlightIsland(); renderStages(); focusIslandCam(selectedWorld); sfx.click();
  };
  const sel = box.querySelector(".sel");
  if (sel && sel.scrollIntoView) try { sel.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
}
function renderStages() {
  const i = selectedWorld;
  const w = WORLDS[i];
  const wt = $("world-type");
  if (wt) wt.innerHTML = `${w.icon} <b>${esc(w.name)}</b> · ${esc(worldTypeLabel(i))}: ${esc(MODE_DESC[worldMode(i + 1, S.settings)] || "")}`;
  $("stage-bar").innerHTML = ST[i].map((t, k) => {
    const op = sOpen(i, k);
    const n = S.prog[w.id + "-" + k] || 0;
    return `<button class="tile${k === BOSS_ST ? " boss" : ""}" data-st="${k}" ${op ? "" : "disabled"}>
      <small>${k === BOSS_ST ? "⚔️ בוס" : "שלב " + (k + 1)}</small><div class="t-mode">${stageLabel(i, k)}</div>${stageTwist(i, k)}
      <div class="t-scene">${esc(stageSceneName(w.id, k))}</div>
      <div>${op ? (n ? "⭐".repeat(n) : "▶") : "🔒"}</div>
    </button>`;
  }).join("");
  renderWorldChips();
  $("stage-bar").onclick = (e) => {
    const b = e.target.closest("[data-st]");
    if (b && !b.disabled) startLevel(WORLDS[selectedWorld].id, +b.dataset.st);
  };
}

/* ===== THREE CORE ===== */
const canvas = $("c");
/* ===== GRAPHICS QUALITY (v8) =====
   LOW    : renders at ~1/3 resolution, upscaled nearest-neighbour (retro pixel look), no shadows,
            no antialias, 2 lights instead of 5, half the scenery/stars, shorter fog distance.
   MEDIUM : 0.8x resolution (smooth), simple shadows, no antialias, 4 lights, reduced scenery.
   HIGH   : full v7 look (pixel ratio up to 1.5, soft shadows, antialias, all scenery).
   AUTO   : picks a tier from the GPU name / CPU cores / memory, then drops a tier if the
            measured frame rate in the first seconds of a run is too low (remembered). */
const TIERS = ["low", "medium", "high"];
const LOW_PR = 0.3;
let autoTier = null, autoReason = "";
function detectTier() {
  const g = GPU_INFO.toLowerCase();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (/swiftshader|llvmpipe|softpipe|software|basic render|gdi generic/.test(g)) { autoReason = "מעבד גרפי תוכנתי"; return "low"; }
  if (/gma|g41|g45|q45|mali-[2-4]\d\d|mali-t|adreno \(tm\) [2-4]\d\d|adreno [2-4]\d\d|powervr|sgx|vivante|videocore/.test(g) ||
      (/intel/.test(g) && /hd graphics( [2-5]\d{3})?(?!\s*\d)/.test(g))) { autoReason = "כרטיס מסך ישן"; return "low"; }
  if (cores <= 2 || mem <= 2) { autoReason = "מחשב חלש"; return "low"; }
  if (/intel|mali|adreno|apple gpu|radeon\(tm\) graphics|vega \d graphics/.test(g) || cores <= 4 || mem <= 4) { autoReason = "כרטיס מסך מובנה"; return "medium"; }
  autoReason = "מחשב חזק";
  return "high";
}
function computeAutoTier() {
  const h = detectTier();
  const saved = S.autoTier;
  if (saved && TIERS.indexOf(saved) >= 0 && TIERS.indexOf(saved) < TIERS.indexOf(h)) { autoReason = "נמדד קצב תמונות נמוך"; return saved; }
  return h;
}
function tier() {
  const g = S.settings.gfx;
  if (g === "low" || g === "medium" || g === "high") return g;
  if (!autoTier) autoTier = computeAutoTier();
  return autoTier;
}
function isHigh() { return tier() === "high"; }
setGfxLevel(tier());
const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier() === "high", powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMappingExposure = 1.18;
let lightsReady = false, shadowState = null, lightBoost = 1;
function markMaterialsDirty() {
  const touch = (o) => { const ms = [].concat(o.material || []); ms.forEach((m) => { if (m) m.needsUpdate = true; }); };
  if (lightsReady) { mapScene.traverse(touch); runScene.traverse(touch); }
}
function applyQuality() {
  const t = tier();
  setGfxLevel(t);
  const dpr = devicePixelRatio || 1;
  const pr = t === "high" ? Math.min(dpr, 1.5) : t === "medium" ? Math.min(dpr, 1) * 0.8 : LOW_PR;
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  canvas.style.imageRendering = t === "low" ? "pixelated" : "auto";
  canvas.classList.toggle("pixelated", t === "low");
  GFX.px.value = t === "low" ? 0.5 : pr;
  const sh = t !== "low";
  const type = t === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  const key = sh + ":" + type;
  if (shadowState !== null && shadowState !== key) markMaterialsDirty();
  shadowState = key;
  renderer.shadowMap.enabled = sh;
  renderer.shadowMap.type = type;
  applyLightTier();
}
function applyLightTier() {
  if (!lightsReady) return;
  const t = tier();
  const before = [runLights.rim.visible, playerFill.visible, playerKey.visible].join();
  runLights.rim.visible = t !== "low";
  mapLights.rim.visible = t !== "low";
  playerFill.visible = t === "high";
  playerKey.visible = t !== "low";
  lightBoost = t === "low" ? 1.32 : t === "medium" ? 1.08 : 1;
  mapLights.hemi.intensity = 1.28 * lightBoost;
  if (before !== [runLights.rim.visible, playerFill.visible, playerKey.visible].join()) markMaterialsDirty();
  if (run && run.layout) applyStageLook(WORLDS[run.world - 1]);
}
applyQuality();
renderer.setClearColor(0x62c8ff);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 520);
const mapScene = new THREE.Scene();
const runScene = new THREE.Scene();
mapScene.fog = new THREE.Fog(0x8ec8ff, 30, 125);
runScene.fog = new THREE.Fog(0x8fd4a2, 16, 68);

function addLights(scene, world) {
  const hemi = new THREE.HemisphereLight(world ? world.hemiSky : 0xc4f0ff, world ? world.hemiGround : 0x3a7a40, 1.28);
  hemi.name = "hemi";
  const dir = new THREE.DirectionalLight(world ? world.sun : 0xfff1c2, 1.48);
  dir.position.set(10, 18, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(512, 512);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 60;
  dir.shadow.camera.left = -22;
  dir.shadow.camera.right = 22;
  dir.shadow.camera.top = 22;
  dir.shadow.camera.bottom = -22;
  dir.name = "sun";
  const rim = new THREE.DirectionalLight(0xffe0b8, 1.08);
  rim.position.set(-10, 9, -8);
  rim.name = "rim";
  scene.add(hemi, dir, rim);
  scene.add(dir.target);
  scene.add(rim.target);
  return { hemi, dir, rim };
}
function makeSky() {
  const c = document.createElement("canvas");
  c.width = 4; c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(300, 24, 18),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  mesh.name = "sky";
  return mesh;
}
function paintSky(mesh, topHex, botHex) {
  if (!mesh || !mesh.material.map) return;
  const c = mesh.material.map.image;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  const top = "#" + topHex.toString(16).padStart(6, "0");
  const bot = "#" + botHex.toString(16).padStart(6, "0");
  const mid = "#" + ((((parseInt(top.slice(1), 16) & 0xfefefe) + (parseInt(bot.slice(1), 16) & 0xfefefe)) >> 1).toString(16).padStart(6, "0"));
  g.addColorStop(0, top);
  g.addColorStop(0.28, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(0.78, bot);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  mesh.material.map.needsUpdate = true;
}
function addHills(scene, color) {
  const group = new THREE.Group();
  group.name = "hills";
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(7 + (i % 4) * 2.2, 5 + (i % 3) * 2.4, 28),
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: false })
    );
    const side = i < 6 ? -1 : 1;
    m.position.set(side * (16 + (i % 6) * 2.4), 1.2, -8 - (i % 6) * 14);
    m.receiveShadow = true;
    group.add(m);
  }
  scene.add(group);
  return group;
}
const mapLights = addLights(mapScene);
const runLights = addLights(runScene, WORLDS[0]);
const playerFill = new THREE.PointLight(0xffe6c4, 2.15, 20, 1.05);
playerFill.name = "playerFill";
runScene.add(playerFill);
const playerKey = new THREE.DirectionalLight(0xfff3e0, 0.98);
playerKey.name = "playerKey";
playerKey.position.set(2, 5, 6);
runScene.add(playerKey);
runScene.add(playerKey.target);
runLights.fill = playerFill;
runLights.key = playerKey;
lightsReady = true;
applyLightTier();

/* v9: portrait + landscape on phones / tablets. The vertical FOV widens on narrow (portrait) screens so
   all three lanes stay visible; sizes are re-read on resize, orientationchange and visualViewport changes
   (iOS reports the new size late, so we re-check a few times and once per frame). */
const BASE_FOV = 52;
let viewW = 0, viewH = 0;
function fitView(force) {
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  if (!force && w === viewW && h === viewH) return false;
  viewW = w; viewH = h;
  const a = w / h;
  camera.aspect = a;
  const minA = 1.25; // below this aspect keep the horizontal view of a 1.25:1 screen
  camera.fov = a >= minA ? BASE_FOV : Math.min(80, 2 * Math.atan(Math.tan(BASE_FOV * Math.PI / 360) * minA / a) * 180 / Math.PI);
  camera.updateProjectionMatrix();
  document.documentElement.classList.toggle("portrait", a < 0.9);
  document.documentElement.classList.toggle("short", h <= 520);
  applyQuality();
  return true;
}
const refit = () => { fitView(); setTimeout(fitView, 120); setTimeout(fitView, 450); };
addEventListener("resize", refit);
addEventListener("orientationchange", refit);
if (window.visualViewport) visualViewport.addEventListener("resize", refit);
fitView(true);

/* ===== LOADER ===== */
function normAsset(u) {
  try { u = decodeURI(u); } catch (e) {}
  return String(u || "").replace(/^\.\//, "").split("?")[0].replace(/\\/g, "/");
}
function resolveAsset(url) {
  if (!window.MQ_EMBED || !url) return url;
  const raw = String(url);
  const looksTex = raw.includes("Textures/") || raw.includes("colormap.png");
  if (raw.indexOf("data:") === 0 && !looksTex) return url;
  if (looksTex && loadCtx) {
    const dir = loadCtx.replace(/\/[^/]+$/, "/");
    const tex = normAsset(dir + "Textures/colormap.png");
    if (window.MQ_EMBED[tex]) return window.MQ_EMBED[tex];
  }
  const n = normAsset(raw);
  if (window.MQ_EMBED[n]) return window.MQ_EMBED[n];
  for (const k of Object.keys(window.MQ_EMBED)) {
    if (n.endsWith(k) || k.endsWith(n)) return window.MQ_EMBED[k];
  }
  return url;
}
let loadCtx = "";
const gltfManager = new THREE.LoadingManager();
gltfManager.setURLModifier((url) => resolveAsset(url));
const gltfLoader = new GLTFLoader(gltfManager);
const gltfCache = new Map();
let loadTotal = 1, loadDone = 0;
function setLoad(msg) {
  $("load-msg").textContent = msg || "טוענים…";
  $("loadbar-i").style.width = Math.round((loadDone / loadTotal) * 100) + "%";
}
function loadGLTF(path) {
  if (gltfCache.has(path)) return Promise.resolve(gltfCache.get(path));
  loadCtx = path;
  const url = resolveAsset(path);
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (g) => { gltfCache.set(path, g); loadDone++; setLoad("טוענים מודלים"); resolve(g); }, undefined, reject);
  });
}
function normalize(model, height, maxWidth) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  let s = height / Math.max(size.y, 0.01);
  if (maxWidth) {
    const xz = Math.max(size.x, size.z);
    s = Math.min(s, maxWidth / Math.max(xz, 0.01));
  }
  model.scale.multiplyScalar(s);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.y -= box2.min.y;
}
function prepMeshes(root, cast = true) {
  // v8c: GLB primitives of one mesh can share a single NORMAL buffer (e.g. nature/tree_detailed.glb:
  // 3 primitives, 1 vertex buffer). computeVertexNormals() zeroes the whole shared buffer and refills
  // only its own triangles, so the last primitive wiped the others -> zero normals -> black model.
  // Give such primitives their own geometry copy before recomputing.
  const normalUsers = new Map();
  root.traverse((o) => {
    const n = o.isMesh && o.geometry && o.geometry.attributes.normal;
    if (n) normalUsers.set(n, (normalUsers.get(n) || 0) + 1);
  });
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = true;
      if (o.geometry && o.geometry.computeVertexNormals) {
        const n = o.geometry.attributes.normal;
        if (n && normalUsers.get(n) > 1) o.geometry = o.geometry.clone();
        o.geometry.computeVertexNormals();
      }
      const mats = [].concat(o.material || []);
      mats.forEach((m) => {
        if (!m) return;
        m.side = THREE.FrontSide;
        m.flatShading = false;
        if (m.normalizeNormalScale) {}
        m.needsUpdate = true;
      });
    }
  });
}
function isHeldWeapon(name) {
  return /knife|dagger|crossbow|throwable|wand|staff|spellbook|sword|axe|shield|1h_|2h_|mug|bow/.test(String(name || "").toLowerCase());
}
function hideHeldWeapons(root) {
  root.traverse((o) => {
    if (isHeldWeapon(o.name)) o.visible = false;
  });
}
/* v8c: Kenney nature/space GLBs also export metallicFactor 1 (glTF default) with no metalness
   texture; with no environment map in the map scene a fully metallic surface gets almost no diffuse
   light and looks near-black. Map copies get their own non-metal material (run props and the
   shared GLTF-cache materials stay untouched; actors already get this via polishActorMaterials). */
function fixGltfMetal(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const fix = (m) => {
      if (!m || !m.isMeshStandardMaterial || m.metalnessMap || m.envMap || (m.metalness || 0) < 0.5) return m;
      const n = m.clone();
      n.metalness = 0.1;
      return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
  });
  return root;
}
function polishActorMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const list = [].concat(o.material || []);
    list.forEach((m) => {
      if (!m || !m.color || m.map) return;
      const n = (m.name || "").toLowerCase();
      if (n.includes("skin")) {
        m.color.setHex(0xf0b48c);
        m.metalness = 0.06;
        m.roughness = 0.58;
      } else if (n === "face") {
        m.color.setHex(0xfff3dc);
        m.metalness = 0.04;
        m.roughness = 0.5;
      } else {
        m.color.r = Math.pow(Math.max(m.color.r, 0), 0.6);
        m.color.g = Math.pow(Math.max(m.color.g, 0), 0.6);
        m.color.b = Math.pow(Math.max(m.color.b, 0), 0.6);
        if (n.includes("gold")) { m.metalness = 0.72; m.roughness = 0.34; }
        else { m.metalness = Math.min(m.metalness ?? 0.4, 0.14); m.roughness = Math.max(m.roughness ?? 0.5, 0.55); }
      }
    });
  });
}
async function createActor(file, height, faceNegZ = true, stripWeapons = false) {
  try {
    const gltf = await loadGLTF(file);
    const model = (gltf.animations && gltf.animations.length) ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
    prepMeshes(model);
    polishActorMaterials(model);
    if (stripWeapons) hideHeldWeapons(model);
    normalize(model, height);
    if (faceNegZ) model.rotation.y = Math.PI;
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of gltf.animations || []) {
      const act = mixer.clipAction(clip);
      actions[clip.name] = act;
      const short = clip.name.split("|").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!actions[short]) actions[short] = act;
    }
    return { model, mixer, actions };
  } catch (e) {
    console.warn("model fail", file, e);
    const model = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffc83d }));
    model.position.y = 0.7;
    return { model, mixer: null, actions: {} };
  }
}
async function createProp(file, height) {
  try {
    const gltf = await loadGLTF(file);
    const model = gltf.scene.clone(true);
    prepMeshes(model, true);
    if (height) normalize(model, height, 2.6);
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.userData.gltf = true; // shares cached glTF geometry: never dispose
    return wrap;
  } catch (e) {
    const wrap = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, height || 1, 0.6), new THREE.MeshStandardMaterial({ color: 0x6aa84f }));
    m.position.y = (height || 1) / 2;
    wrap.add(m);
    return wrap;
  }
}
function resolveClip(actor, name) {
  if (!actor || !actor.actions) return null;
  if (actor.actions[name]) return name;
  const aliases = {
    sprint: ["running_a", "running_b", "run", "running", "walk", "walkcarry"],
    walk: ["walking_a", "walk"],
    idle: ["idle", "unarmed_idle"],
    jump: ["jump_full_short", "jump_start", "jump_full_long", "jump", "pickup"],
    crouch: ["sit_floor_idle", "crouch", "slide", "sitdown", "sit"],
    sit: ["sit_floor_idle", "sitdown", "sit"],
    fall: ["hit_a", "hit_b", "death_a", "recievehit", "receivehit", "defeat", "hit", "fall", "death"],
    "emote-yes": ["cheer", "victory", "emoteyes", "yes"]
  };
  const want = (aliases[name] || [name]).map((x) => String(x).toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const a of want) {
    if (actor.actions[a]) return a;
    const k = Object.keys(actor.actions).find((x) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === a);
    if (k) return k;
  }
  return null;
}
function playAnim(actor, name, fade = 0.16, once = false) {
  if (!actor || !actor.actions) return;
  const resolved = resolveClip(actor, name);
  if (!resolved) return;
  if (actor.current === resolved && name !== "jump") return;
  const next = actor.actions[resolved];
  const prev = actor.current && actor.actions[actor.current];
  if (prev && prev !== next) prev.fadeOut(fade);
  next.reset().fadeIn(fade);
  next.timeScale = (name === "sprint" && /walk/i.test(resolved)) ? 1.7 : 1;
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = once;
  next.play();
  actor.current = resolved;
}

/* ===== TEXT LABELS ===== */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function makeTextTexture(text, opt = {}) {
  const w = opt.w || 1024, h = opt.h || 384;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = opt.bg || "#ffe34a";
  ctx.fillRect(0, 0, w, h);
  roundRect(ctx, 10, 10, w - 20, h - 20, 44); ctx.fill();
  ctx.strokeStyle = opt.bd || "#140818";
  ctx.lineWidth = 22; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.direction = /[\u0590-\u05FF]/.test(String(text)) ? "rtl" : "ltr";
  const raw = String(text || "");
  const maxW = w - 80;
  let font = opt.font || 168;
  const min = 28;
  ctx.font = `800 ${font}px Rubik, Fredoka, Arial, sans-serif`;
  while (font > min && ctx.measureText(raw).width + font * 0.16 > maxW) {
    font -= 4;
    ctx.font = `800 ${font}px Rubik, Fredoka, Arial, sans-serif`;
  }
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.min(14, Math.max(6, font * 0.08));
  ctx.strokeStyle = "#fff8dc";
  ctx.strokeText(raw, w / 2, h / 2);
  ctx.fillStyle = opt.fg || "#140818";
  ctx.fillText(raw, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.userData = { font, textW: ctx.measureText(raw).width, canvasW: w, raw };
  return tex;
}
function roundedBoardGeo(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2 });
}
/* v8: small letter signs (letter-collection stage) share one texture/material per glyph and
   shared geometries, instead of a new 768x280 canvas texture for every single letter. */
const SMALL_SIGN = { tex: new Map(), rimGeo: null, faceGeo: null, rimMat: null };
function smallSign(text) {
  const key = String(text);
  let ent = SMALL_SIGN.tex.get(key);
  if (!ent) {
    const tex = makeTextTexture(key, { w: 768, h: 280, font: 140 });
    ent = { tex, mat: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }) };
    SMALL_SIGN.tex.set(key, ent);
  }
  const W = 1.05, H = W * (280 / 768);
  if (!SMALL_SIGN.rimGeo) {
    SMALL_SIGN.rimGeo = new THREE.BoxGeometry(W + 0.05, H + 0.05, 0.055);
    SMALL_SIGN.faceGeo = new THREE.PlaneGeometry(W, H);
    SMALL_SIGN.rimMat = new THREE.MeshBasicMaterial({ color: 0xffe34a, toneMapped: false });
  }
  const g = new THREE.Group();
  const rim = new THREE.Mesh(SMALL_SIGN.rimGeo, SMALL_SIGN.rimMat);
  const faceF = new THREE.Mesh(SMALL_SIGN.faceGeo, ent.mat);
  faceF.position.z = 0.03; faceF.renderOrder = 2;
  const faceB = new THREE.Mesh(SMALL_SIGN.faceGeo, ent.mat);
  faceB.position.z = -0.03; faceB.rotation.y = Math.PI; faceB.renderOrder = 2;
  g.add(rim, faceF, faceB);
  g.userData.fit = ent.tex.userData;
  g.userData.signSize = { W, H };
  g.userData.shared = true;
  return g;
}
/* free GPU memory of a per-question object (gate) when it leaves the scene */
function disposeObj(root) {
  if (!root) return;
  if (root.parent) root.parent.remove(root);
  if (root.userData && root.userData.shared) return;
  root.traverse((o) => {
    if (o.geometry && !(o.parent && o.parent.userData.shared)) o.geometry.dispose();
    if (o.userData && o.userData.ownMat) {
      [].concat(o.material || []).forEach((m) => { if (!m) return; if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}
/* v8: free everything a stage built (procedural geometry, materials, canvas textures) when the
   next stage replaces it. Skips cached glTF props and shared letter signs. Three.js re-uploads
   anything disposed that is used again, so shared caches stay correct. */
function disposeDeep(root) {
  if (!root) return;
  if (root.parent) root.parent.remove(root);
  const walk = (o) => {
    if (o.userData && (o.userData.gltf || o.userData.shared)) return;
    if (o.geometry) o.geometry.dispose();
    if (o.material) [].concat(o.material).forEach((m) => {
      if (!m) return;
      for (const k of ["map", "emissiveMap", "alphaMap", "normalMap", "roughnessMap"]) if (m[k] && m[k].dispose) m[k].dispose();
      m.dispose();
    });
    for (const c of o.children) walk(c);
  };
  walk(root);
}
function makeSign(text, big = true) {
  if (!big) return smallSign(text);
  const g = new THREE.Group();
  const tw = big ? 1024 : 768;
  const th = big ? 360 : 280;
  const tex = makeTextTexture(text, { w: tw, h: th, font: big ? 176 : 140 });
  const span = (typeof laneXs === "function") ? (laneXs()[2] - laneXs()[1]) : 2;
  const W = big ? Math.min(1.86, span * 0.9) : 1.05;
  const H = W * (th / tw);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.05, H + 0.05, 0.055),
    new THREE.MeshBasicMaterial({ color: 0xffe34a, toneMapped: false })
  );
  const matF = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false });
  const matB = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false });
  const faceF = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matF);
  faceF.position.z = 0.03;
  faceF.renderOrder = 2;
  const faceB = new THREE.Mesh(new THREE.PlaneGeometry(W, H), matB);
  faceB.position.z = -0.03;
  faceB.rotation.y = Math.PI;
  faceB.renderOrder = 2;
  rim.userData.ownMat = faceF.userData.ownMat = true;
  faceB.material = matF; matB.dispose();
  g.add(rim, faceF, faceB);
  g.userData.fit = tex.userData;
  g.userData.signSize = { W, H };
  return g;
}
function makeGoldKey() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.22, emissive: 0xaa7700, emissiveIntensity: 0.4 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), gold);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.58), gold);
  shaft.position.z = -0.4;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.14), gold);
  bit.position.set(0, -0.08, -0.64);
  const bit2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.09), gold);
  bit2.position.set(0, -0.05, -0.5);
  g.add(ring, shaft, bit, bit2);
  return g;
}
function makeLockMesh() {
  const g = new THREE.Group();
  g.name = "lock";
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2438, metalness: 0.55, roughness: 0.35, emissive: 0x16101f, emissiveIntensity: 0.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.8, roughness: 0.25, emissive: 0xaa7700, emissiveIntensity: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.42), iron);
  body.position.y = 2.85;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 8, 16), gold);
  shackle.position.y = 3.55;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshBasicMaterial({ color: 0x110814 }));
  hole.position.set(0, 2.75, 0.22);
  g.add(body, shackle, hole);
  g.position.set(0, 0.35, 1.85);
  return g;
}

/* ===== MAP / TITLE SCENE ===== */
let titleHeroes = [];
let islands = [];
let selectedWorld = 0;
let mapMixers = [];
const camGoal = new THREE.Vector3(0, 5.2, 12.5);
const lookGoal = new THREE.Vector3(0, 1.15, 0);
let appMode = "load"; // load | title | map | run

function makeIslandMesh(world) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.9, 1.15, 12), new THREE.MeshStandardMaterial({ color: world.ground, roughness: 0.82 }));
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 2.1, 2.5, 12), new THREE.MeshStandardMaterial({ color: 0x6a4322, roughness: 1 }));
  dirt.position.y = -1.7;
  top.receiveShadow = dirt.receiveShadow = true;
  top.castShadow = dirt.castShadow = true;
  g.add(dirt, top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.08, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.0 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; ring.name = "ring";
  g.add(ring);
  return g;
}

async function buildMap() {
  const ocean = new THREE.Mesh(new THREE.CircleGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x1f7caa, roughness: 0.35, metalness: 0.1 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = -3.4; ocean.receiveShadow = true;
  mapScene.add(ocean);
  const sky = makeSky();
  paintSky(sky, 0x6ec8ff, 0xd8f3ff);
  mapScene.add(sky);
  for (let ci = 0; ci < 8; ci++) {
    const cl = new THREE.Mesh(
      new THREE.SphereGeometry(1.7 + (ci % 3) * 0.4, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: false })
    );
    cl.scale.y = 0.42;
    cl.position.set(((ci % 4) - 1.5) * 12, 9 + (ci % 3), -6 - ci * 3.5);
    mapScene.add(cl);
  }

  const positions = [
    [0, 0, -2],
    [-12, 0.4, -10],
    [12, 0.3, -10],
    [-8, 0.6, -22],
    [8, 0.5, -22],
    [-15, 0.5, -34],
    [15, 0.4, -34],
    [0, 0.7, -45]
  ];
  const showcase = [
    "nature/tree_detailed.glb",
    "pirate/palm-straight.glb",
    "platformer/tree.glb",
    "space/craft_speederA.glb",
    "holiday/tree-snow-a.glb"
  ];
  // v8b: procedural showcase pieces for the new worlds
  const showcase2 = { 5: () => PROPS.pyramidSmall(), 6: () => PROPS.coral(), 7: () => PROPS.volcanoSmall() };
  const showScale = { 5: 0.22, 6: 1.4, 7: 0.22 };
  for (let i = 0; i < WORLDS.length; i++) {
    const world = WORLDS[i];
    const isle = makeIslandMesh(world);
    isle.position.set(...positions[i]);
    isle.userData.worldIndex = i;
    let prop;
    if (showcase[i]) prop = fixGltfMetal(await createProp(MP(showcase[i]), i === 3 ? 1.6 : 2.8));
    else { prop = showcase2[i](); prop.scale.multiplyScalar(showScale[i]); }
    prop.position.set(0.6, 0.58, -0.4);
    isle.add(prop);
    if (i === 5) { const c = PROPS.cactus(); c.scale.setScalar(0.7); c.position.set(-1.6, 0.58, 0.2); isle.add(c); }
    if (i === 6) { const c = PROPS.brainCoral(); c.position.set(-1.5, 0.58, 0.3); isle.add(c); const k = PROPS.seaweed(); k.position.set(1.8, 0.58, 0.6); isle.add(k); }
    if (i === 7) { const d = PROPS.dino(); d.scale.setScalar(0.45); d.position.set(-1.7, 0.58, 0.2); isle.add(d); }
    const extras = world.decor.slice(1, 3);
    for (let e = 0; e < extras.length; e++) {
      const p2 = fixGltfMetal(await createProp(MP(extras[e]), 1.5 + e * 0.35));
      p2.position.set(-1.7 + e * 2.2, 0.58, -1.5 + (e % 2) * 1.1);
      p2.rotation.y = e * 1.1;
      isle.add(p2);
    }
    // stage pins
    for (let k = 0; k < NSTAGES; k++) {
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshStandardMaterial({ color: k === BOSS_ST ? 0xe8553d : 0xffc83d }));
      pin.position.set(-1.86 + k * 0.62, 1.05, 1.5);
      pin.userData.pin = { world: i, stage: k };
      isle.add(pin);
    }
    isle.add(makeLockMesh());
    mapScene.add(isle);
    islands.push(isle);
  }
  refreshLocks();
  // title podium
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.55 }));
  pod.position.set(0, 0.1, 3.2);
  pod.receiveShadow = true;
  mapScene.add(pod);

  for (let i = 0; i < HEROES.length; i++) {
    const actor = await createActor(MP(HEROES[i].file), 1.45, true, true);
    actor.model.position.set((i - 1) * 1.7, 0.32, 3.4);
    mapScene.add(actor.model);
    playAnim(actor, "idle");
    titleHeroes.push(actor);
    if (actor.mixer) mapMixers.push(actor.mixer);
  }
  highlightHero();
}

function highlightHero() {
  titleHeroes.forEach((h, i) => {
    h.model.position.y = 0.32 + (S.hero === i ? 0.12 : 0);
    playAnim(h, S.hero === i ? "idle" : "sit");
  });
}
function highlightIsland() {
  islands.forEach((isle, i) => {
    const ring = isle.getObjectByName("ring");
    if (ring) ring.material.opacity = i === selectedWorld ? 0.95 : 0.0;
  });
  refreshLocks();
}
function refreshLocks() {
  islands.forEach((isle, i) => {
    const lock = isle.getObjectByName("lock");
    if (lock) lock.visible = !wOpen(i);
  });
}
let keyFx = null, unlockFx = null, pendingUnlock = null, trailAcc = 0;
function startKeyReward() {
  if (!player || !runScene) return;
  const key = makeGoldKey();
  key.scale.setScalar(1.8);
  key.position.copy(player.group.position).add(new THREE.Vector3(0, 1.7, -1.1));
  runScene.add(key);
  keyFx = { mesh: key, t: 0, mode: "spin" };
  burst(key.position.clone(), 0xffc83d);
}
function playIslandUnlock(i) {
  if (!islands[i]) return;
  const isle = islands[i];
  selectedWorld = i;
  highlightIsland();
  focusIslandCam(i);
  const lock = isle.getObjectByName("lock");
  if (lock) { lock.visible = true; lock.scale.setScalar(1); lock.rotation.z = 0; }
  const key = makeGoldKey();
  key.scale.setScalar(2.1);
  key.position.set(0, 3.4, 0);
  isle.add(key);
  unlockFx = { isle, lock, key, t: 0 };
}
function updateKeyFx(dt) {
  if (keyFx) {
    keyFx.t += dt;
    keyFx.mesh.rotation.y += dt * 4.2;
    keyFx.mesh.rotation.x = Math.sin(keyFx.t * 3) * 0.25;
    if (keyFx.mode === "spin") {
      keyFx.mesh.position.y += dt * 0.9;
      if (keyFx.t > 0.85) keyFx.mode = "fly";
    } else {
      const target = camera.position.clone().add(new THREE.Vector3(-1.35, 0.9, -1.8));
      keyFx.mesh.position.lerp(target, Math.min(1, dt * 3.2));
      const s = Math.max(0.15, 1.8 - keyFx.t * 0.55);
      keyFx.mesh.scale.setScalar(s);
      if (keyFx.t > 2.3) {
        if (keyFx.mesh.parent) keyFx.mesh.parent.remove(keyFx.mesh);
        keyFx = null;
      }
    }
  }
  if (unlockFx) {
    unlockFx.t += dt;
    unlockFx.key.rotation.y += dt * 5;
    unlockFx.key.position.y = 3.2 + Math.sin(unlockFx.t * 5) * 0.18;
    if (unlockFx.lock && unlockFx.t > 0.45) {
      unlockFx.lock.scale.multiplyScalar(Math.max(0.82, 1 - dt * 2.4));
      unlockFx.lock.rotation.z += dt * 4;
      if (unlockFx.lock.scale.x < 0.1) {
        unlockFx.lock.visible = false;
        unlockFx.lock.scale.setScalar(1);
        unlockFx.lock.rotation.z = 0;
        unlockFx.lock = null;
      }
    }
    if (unlockFx.t > 2.5) {
      unlockFx.isle.remove(unlockFx.key);
      unlockFx = null;
      refreshLocks();
    }
  }
}
function focusTitleCam() {
  camGoal.set(0, 4.6, 11.2);
  lookGoal.set(0, 1.2, 2.6);
}
function focusMapCam() {
  camGoal.set(0, 44, 24);
  lookGoal.set(0, 0, -8);
}
function focusIslandCam(i) {
  const p = islands[i].position;
  camGoal.set(p.x, p.y + 8.5, p.z + 13);
  lookGoal.set(p.x, p.y + 1, p.z);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pick(ev) {
  if (appMode !== "title" && appMode !== "map") return;
  const r = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (appMode === "title") {
    const hits = raycaster.intersectObjects(titleHeroes.map((h) => h.model), true);
    if (hits.length) {
      // find which hero
      let obj = hits[0].object;
      while (obj.parent && !titleHeroes.some((h) => h.model === obj)) obj = obj.parent;
      const idx = titleHeroes.findIndex((h) => h.model === obj);
      if (idx >= 0) { S.hero = idx; save(); highlightHero(); drawHeroBtns(); sfx.click(); }
    }
    return;
  }
  const hits = raycaster.intersectObjects(islands, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && obj.userData.worldIndex === undefined && obj.userData.pin === undefined) obj = obj.parent;
  if (obj && obj.userData.pin) {
    const { world, stage } = obj.userData.pin;
    if (sOpen(world, stage)) startLevel(WORLDS[world].id, stage);
    else { selectedWorld = world; highlightIsland(); renderStages(); focusIslandCam(world); }
    return;
  }
  if (obj && obj.userData.worldIndex !== undefined) {
    selectedWorld = obj.userData.worldIndex;
    highlightIsland(); renderStages(); focusIslandCam(selectedWorld); sfx.click();
    if (!wOpen(selectedWorld)) {
      showModal(`<h2>🔒 העולם נעול</h2><p>נצחו את הבוס בעולם הקודם וקבלו מפתח זהב כדי לפתוח את האי הזה.</p><button class="btn" id="mgo">הבנתי</button>`);
      $("mgo").onclick = hideModal;
    }
  }
}
canvas.addEventListener("pointerdown", pick);

/* ===== RUNNER ===== */
const LANE_X = [-2, 0, 2];
const SEG_LEN = 3.6, NSEG = 42;
let player = null;
let bossActor = null;
let run = null; // gameplay state
let finishGate = null;
let paused = true;
let holdCam = false;
let shakeT = 0;
const pathSegs = [];
const decors = [];
const coins = [];
const obstacles = [];
const gates = [];
const letters = [];
const particles = [];
let pathMat = null, stripeMat = null, sideMat = null, stoneMat = null;
let spaceStars = null;
let runSky = null, runHills = null, runSunDisk = null, runMist = null;
let themeAmb = null;

let courseVisual = null;
let skirtMat = null, railMat = null, valleyMat = null;
function buildPath() {
  pathMat = new THREE.MeshStandardMaterial({ map: makeDirtTexture(), color: 0xe8c888, roughness: 0.82, flatShading: false });
  stoneMat = new THREE.MeshStandardMaterial({ map: makeStoneTexture(), color: 0xffffff, roughness: 0.54, metalness: 0.08, flatShading: false });
  stripeMat = new THREE.MeshBasicMaterial({ color: WORLDS[0].pathB });
  sideMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(8, 36), color: WORLDS[0].ground, roughness: 0.92, flatShading: false });
  skirtMat = new THREE.MeshStandardMaterial({ color: 0x5a5348, roughness: 0.74, metalness: 0.06, flatShading: false, side: THREE.DoubleSide });
  railMat = new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.45, metalness: 0.18, flatShading: false });
  valleyMat = new THREE.MeshStandardMaterial({ map: makeValleyTexture(), color: 0xe6d7b4, roughness: 0.94, metalness: 0, emissive: 0x6a5a3c, emissiveIntensity: 0.24, flatShading: false });
  for (let i = 0; i < 56; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffc83d }));
    m.visible = false;
    runScene.add(m);
    particles.push({ mesh: m, v: new THREE.Vector3(), life: 0, kind: "burst" });
  }
}

function applyWorldTheme(world) {
  runScene.background = new THREE.Color(world.sky);
  runScene.fog.color.setHex(world.fog);
  renderer.setClearColor(world.sky);
  pathMat.color.setHex(world.pathA);
  stripeMat.color.setHex(world.pathB);
  sideMat.color.setHex(world.ground);
  runLights.hemi.color.setHex(world.hemiSky);
  runLights.hemi.groundColor.setHex(world.hemiGround);
  runLights.dir.color.setHex(world.sun);
  if (spaceStars) spaceStars.visible = false; // v7: space uses the themed star sky instead
  if (runSky) paintSky(runSky, world.sky, world.fog);
  if (runSky) runSky.visible = themeOf(world.id) !== "space";
  if (runSunDisk) runSunDisk.visible = THEME_LOOK[themeOf(world.id)] ? !!THEME_LOOK[themeOf(world.id)].showSun : true;
  if (run && run.layout) applyStageLook(world);
}
function applyStageLook(world) {
  const L = run && run.layout;
  if (!L) return;
  const look = stageLook(THEME_LOOK[themeOf(world.id)], world.id, run.st);
  if (look) {
    renderer.toneMappingExposure = look.exp;
    runLights.hemi.intensity = look.hemi * lightBoost;
    runLights.hemi.color.setHex(look.hemiSky);
    runLights.hemi.groundColor.setHex(look.hemiGround);
    runLights.dir.intensity = look.dir;
    runLights.dir.color.setHex(look.sun);
    runScene.fog.color.setHex(look.fog);
    runScene.fog.near = look.fogNear;
    runScene.fog.far = look.fogFar;
    applyDrawDistance();
    runScene.background = new THREE.Color(look.clear);
    renderer.setClearColor(look.clear);
    if (runSky) {
      runSky.visible = themeOf(world.id) !== "space";
      paintSky(runSky, look.skyTop, look.skyBot);
    }
    if (runSunDisk) {
      runSunDisk.visible = !!look.showSun;
      if (look.sunDisk) runSunDisk.material.color.setHex(look.sunDisk);
    }
    layoutPathFromCourse();
    return;
  }
  if (runSky) runSky.visible = true;
  if (runSunDisk) runSunDisk.visible = true;
  const tod = {
    morning: { exp: 1.22, hemi: 0.95, dir: 1.15, fogNear: 22, fogFar: 260 },
    noon: { exp: 1.18, hemi: 0.88, dir: 1.35, fogNear: 20, fogFar: 250 },
    sunset: { exp: 1.16, hemi: 0.86, dir: 1.25, fogNear: 18, fogFar: 290 },
    dusk: { exp: 0.98, hemi: 0.62, dir: 0.85, fogNear: 16, fogFar: 230 },
    storm: { exp: 0.9, hemi: 0.55, dir: 0.75, fogNear: 14, fogFar: 200 }
  }[L.tod] || { exp: 1.15, hemi: 0.85, dir: 1.2, fogNear: 14, fogFar: 56 };
  renderer.toneMappingExposure = tod.exp;
  runLights.hemi.intensity = tod.hemi * lightBoost;
  runLights.dir.intensity = tod.dir;
  runScene.fog.near = tod.fogNear;
  runScene.fog.far = tod.fogFar;
  applyDrawDistance();
  const JT = {
    morning: { dir: 0xfff0d0, hemi: 0xd8ecff, gnd: 0x4a6a3a, fog: 0xc8e4f0, clear: 0x9ad0ff, top: 0x5ab0ff, bot: 0xe0f4ff, sun: 0xfff2b0 },
    noon: { dir: 0xffffff, hemi: 0xe0f0ff, gnd: 0x5a7a3a, fog: 0xd0ecff, clear: 0x8ac8ff, top: 0x3a98f0, bot: 0xd0ecff, sun: 0xfffbe0 },
    dusk: { dir: 0x9bb6ff, hemi: 0x7a88c8, gnd: 0x2a2a3a, fog: 0x4a3a6a, clear: 0x3a2a5a, top: 0x1a1a4a, bot: 0x8a5a8a, sun: 0xc8d6ff },
    storm: { dir: 0x9bb0c8, hemi: 0x6a7a8a, gnd: 0x2a3028, fog: 0x4a5058, clear: 0x3a4048, top: 0x2a3038, bot: 0x6a7078, sun: 0xc8d6ff }
  }[L.tod];
  if (JT) {
    runLights.dir.color.setHex(JT.dir);
    runLights.hemi.color.setHex(JT.hemi);
    runLights.hemi.groundColor.setHex(JT.gnd);
    runScene.fog.color.setHex(JT.fog);
    runScene.background = new THREE.Color(JT.clear);
    renderer.setClearColor(JT.clear);
    if (runSky) paintSky(runSky, JT.top, JT.bot);
    if (runSunDisk) { runSunDisk.material.color.setHex(JT.sun); runSunDisk.visible = L.tod !== "storm"; }
  } else if (L.tod === "sunset") {
    runScene.background = new THREE.Color(0xff8a54);
    runLights.dir.color.setHex(0xff9a5c);
    runLights.hemi.color.setHex(0xffc9a0);
    runLights.hemi.groundColor.setHex(0x6a3a28);
    runScene.fog.color.setHex(0xe8b888);
    renderer.setClearColor(0xff8a54);
    if (runSky) paintSky(runSky, 0xff7a3a, 0xffd2a0);
    if (runSunDisk) runSunDisk.material.color.setHex(0xff8a4a);
  } else if (L.tod === "dusk" || L.tod === "storm") {
    runLights.dir.color.setHex(0x9bb6ff);
    runLights.hemi.color.setHex(0x6a88c8);
    runScene.fog.color.setHex(world.id === 4 ? world.fog : 0x3a3a6a);
    if (runSunDisk) runSunDisk.material.color.setHex(0xc8d6ff);
  } else if (runSunDisk) runSunDisk.material.color.setHex(0xfff2b0);
  layoutPathFromCourse();
}

function applyDrawDistance() {
  const low = GFX.level === "low";
  if (low) {
    runScene.fog.far = Math.min(runScene.fog.far, 190);
    runScene.fog.near = Math.min(runScene.fog.near, 34);
  }
  const far = low ? 320 : 520;
  if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
}
function makeStars() {
  const geo = new THREE.BufferGeometry();
  const n = 400;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 80;
    arr[i * 3 + 1] = Math.random() * 40 + 4;
    arr[i * 3 + 2] = -Math.random() * 90;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  spaceStars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12 }));
  spaceStars.visible = false;
  runScene.add(spaceStars);
}

function ensureRunAmbience() {
  if (!runSky) {
    runSky = makeSky();
    runScene.add(runSky);
    paintSky(runSky, WORLDS[0].sky, WORLDS[0].fog);
  }
  if (!runHills) runHills = makeMountains(WORLDS[0].ground);
  runScene.add(runHills);
  if (!runSunDisk) {
    runSunDisk = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false, depthWrite: false })
    );
    runSunDisk.position.set(18, 26, -22);
    runScene.add(runSunDisk);
  }
}

const CONFETTI = [0xffc83d, 0xff5b8a, 0x4ecdc4, 0x7cff6b, 0xfff1a8, 0x6a8cff, 0xffffff];
function burst(pos, color) {
  let used = 0;
  for (const p of particles) {
    if (p.life > 0) continue;
    p.life = 1.15;
    p.kind = "burst";
    p.mesh.visible = true;
    p.mesh.material.color.setHex(color || CONFETTI[used % CONFETTI.length]);
    p.mesh.position.copy(pos);
    p.v.set((Math.random() - 0.5) * 10, Math.random() * 10 + 3, (Math.random() - 0.5) * 10);
    p.mesh.scale.setScalar(0.65 + Math.random() * 0.7);
    if (++used >= 22) break;
  }
}
function emitTrail(dt) {
  trailAcc += dt;
  if (trailAcc < 0.07) return;
  trailAcc = 0;
  if (!player || GFX.level === "low") return;
  for (const p of particles) {
    if (p.life > 0) continue;
    p.life = 0.5;
    p.kind = "trail";
    p.mesh.visible = true;
    p.mesh.material.color.setHex(Math.random() > 0.5 ? 0xfff2a0 : 0xffc83d);
    p.mesh.position.copy(player.group.position);
    p.mesh.position.x += (Math.random() - 0.5) * 0.3; p.mesh.position.y += 0.35 + Math.random() * 0.45; p.mesh.position.z += 0.4;
    p.v.set((Math.random() - 0.5) * 0.5, 0.7, 1.4);
    p.mesh.scale.setScalar(0.45);
    break;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt * (p.kind === "trail" ? 2.4 : 1.45);
    if (p.kind !== "trail") p.v.y -= 12 * dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.mesh.visible = p.life > 0;
    if (p.life <= 0) p.mesh.scale.setScalar(1);
  }
}

function recycleZ(obj, far = 16) {
  if (obj.position.z > player.z + far) obj.position.z -= NSEG * SEG_LEN;
}

function layoutPath() { layoutPathFromCourse(); }
function disposeCourseVisual() {
  if (!courseVisual) return;
  disposeDeep(courseVisual);
  courseVisual = null;
}
function rebuildCourseRibbon() {
  if (!run || !run.course) return;
  disposeCourseVisual();
  const course = run.course;
  const narrow = !!(run.layout && run.layout.narrow);
  const th = themeOf(run.world);
  const plan = stagePlan(run.world, run.st) || {};
  const base = plan.base != null ? plan.base : 1;
  if (th !== "jungle") {
    const tg = NEW_THEMES.includes(th)
      ? buildWorld2Course(th, course, { narrow, high: isHigh(), baseScale: base })
      : buildThemeCourse(th, course, { narrow, high: isHigh(), baseScale: base });
    const ss = buildStageScatter(run.world, run.st, course, isHigh());
    tg.add(ss);
    const prevU = tg.userData.update;
    tg.userData.update = (dt, t, ctx) => { if (prevU) prevU(dt, t, ctx); ss.userData.update(dt, t, ctx); };
    tg.add(plantCourseFlags(course, isHigh()));
    tg.userData.mergeStats = mergeStatic(tg);
    courseVisual = tg;
    runScene.add(tg);
    if (tg.userData.ships && tg.userData.ships.length) spawnShips(tg);
    return;
  }
  const pathW = narrow ? 5.5 : 7.3;
  const group = new THREE.Group();
  group.name = "courseVisual";
  const dirt = new THREE.Mesh(makeRibbonGeometry(course, { width: pathW, yLift: 0.03, pred: (s) => s.kind !== "causeway", vScale: 0.1 }), pathMat);
  dirt.receiveShadow = true;
  dirt.name = "ribbonDirt";
  const grass = new THREE.Mesh(makeRibbonGeometry(course, { width: 14, yLift: -0.05, pred: (s) => s.kind !== "causeway" && s.kind !== "turn", vScale: 0.07 }), sideMat);
  grass.receiveShadow = true;
  grass.name = "ribbonGrass";
  const turnGrass = new THREE.Mesh(makeRibbonGeometry(course, { width: 8.6, yLift: -0.05, pred: (s) => s.kind === "turn", vScale: 0.07 }), sideMat);
  turnGrass.receiveShadow = true;
  const stone = new THREE.Mesh(makeRibbonGeometry(course, { width: 6.8, yLift: 0.05, pred: (s) => s.kind === "causeway", vScale: 0.4, uRepeat: 3 }), stoneMat);
  stone.receiveShadow = true;
  stone.name = "ribbonStone";
  const skirt = new THREE.Mesh(makeSkirtGeometry(course, { width: 6.8, depth: 4.4, pred: (s) => s.kind === "causeway" }), skirtMat);
  skirt.name = "ribbonSkirt";
  const valley = new THREE.Mesh(makeRibbonGeometry(course, { width: 92, yLift: -6.4, pred: (s) => s.kind === "causeway", vScale: 0.04 }), valleyMat);
  valley.receiveShadow = true;
  valley.name = "ribbonValley";
  const railL = new THREE.Mesh(makeRibbonGeometry(course, { width: 0.16, yLift: 0.56, xOffset: -3.32, pred: (s) => s.kind === "causeway" }), railMat);
  const railR = new THREE.Mesh(makeRibbonGeometry(course, { width: 0.16, yLift: 0.56, xOffset: 3.32, pred: (s) => s.kind === "causeway" }), railMat);
  railL.castShadow = railR.castShadow = true;
  const stripeL = new THREE.Mesh(makeRibbonGeometry(course, { width: 0.1, yLift: 0.058, xOffset: -1.05, pred: (s) => s.kind !== "causeway" }), stripeMat);
  const stripeR = new THREE.Mesh(makeRibbonGeometry(course, { width: 0.1, yLift: 0.058, xOffset: 1.05, pred: (s) => s.kind !== "causeway" }), stripeMat);
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.95, 6);
  for (let i = 0; i < course.samples.length; i += 2) {
    const s = course.samples[i];
    if (s.kind !== "causeway") continue;
    const rx = Math.cos(s.heading), rz = Math.sin(s.heading);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(s.x + side * rx * 3.32, s.y + 0.52, s.z + side * rz * 3.32);
      post.castShadow = true;
      group.add(post);
    }
  }
  const follow = new THREE.Mesh(
    new THREE.CircleGeometry(220, 64),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(30, 30), color: sideMat.color, roughness: 0.94, flatShading: false })
  );
  follow.rotation.x = -Math.PI / 2;
  follow.position.y = -0.32;
  follow.name = "followGround";
  follow.receiveShadow = true;
  const haze = new THREE.Mesh(
    makeRibbonGeometry(course, { width: 58, yLift: -3.15, pred: (s) => s.kind === "causeway", vScale: 0.05 }),
    new THREE.MeshBasicMaterial({ color: 0xffe6c2, transparent: true, opacity: 0.32, depthWrite: false, fog: true, side: THREE.DoubleSide })
  );
  haze.name = "valleyHaze";
  const theme = "jungle";
  const valleyBits = populateValley(course, theme, isHigh());
  const scatter = scatterGroundDetails(course, theme, isHigh(), Math.max(0.3, base));
  const flags = plantCourseFlags(course, isHigh());
  const ss = buildStageScatter(run.world, run.st, course, isHigh());
  group.add(ss);
  group.userData.update = (dt, t, ctx) => ss.userData.update(dt, t, ctx);
  group.add(follow, scatter, grass, turnGrass, dirt, stripeL, stripeR, valley, valleyBits, haze, skirt, stone, railL, railR, flags);
  group.userData.mergeStats = mergeStatic(group);
  courseVisual = group;
  runScene.add(courseVisual);
}
async function spawnShips(tg) {
  const bobbing = [];
  for (const sp of tg.userData.ships) {
    const ship = await createProp(MP("pirate/ship-pirate-small.glb"), 2.6);
    if (courseVisual !== tg) return;
    ship.scale.setScalar(4.2);
    ship.position.set(sp.x, sp.y - 0.2, sp.z);
    ship.rotation.y = -sp.heading + Math.PI;
    ship.userData.baseY = ship.position.y;
    ship.userData.ph = Math.random() * 6;
    tg.add(ship);
    bobbing.push(ship);
  }
  const prev = tg.userData.update;
  tg.userData.update = (dt, t, ctx) => {
    if (prev) prev(dt, t, ctx);
    bobbing.forEach((s) => {
      s.position.y = s.userData.baseY + Math.sin(t * 0.9 + s.userData.ph) * 0.25;
      s.rotation.z = Math.sin(t * 0.7 + s.userData.ph) * 0.04;
    });
  };
}
function layoutPathFromCourse() {
  if (!run || !run.course || !player) return;
  if (!courseVisual) rebuildCourseRibbon();
}
function trackHalfWidth() {
  const narrow = !!(run && run.layout && run.layout.narrow);
  return (narrow ? 5.5 : 7.3) * 0.5;
}
function laneLateral(lane) {
  if (lane === 0 || lane === 1 || lane === 2) return laneXs()[lane];
  if (typeof lane === "number" && Number.isFinite(lane)) return lane;
  return 0;
}
function trackFrameAt(s) {
  return pathFrame(run.course, s);
}
function trackPoint(s, lateral, yOff = 0) {
  const f = trackFrameAt(s);
  return f.pos.clone().addScaledVector(f.right, lateral).addScaledVector(f.up, yOff);
}
function trackLateralOf(pos, s) {
  const f = trackFrameAt(s);
  return new THREE.Vector3().subVectors(pos, f.pos).dot(f.right);
}
function playerLaneNow() {
  if (!player) return 1;
  const lat = player.laneShift != null ? player.laneShift : laneLateral(player.lane);
  const xs = laneXs();
  let best = player.lane || 0, bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(lat - xs[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
function placeOnCourse(obj, s, lane, upright) {
  const off = laneLateral(lane);
  if (!run || !run.course) {
    obj.position.set(off, 0, -s);
    return;
  }
  const f = trackFrameAt(s);
  obj.position.copy(f.pos).addScaledVector(f.right, off);
  obj.rotation.order = "YXZ";
  obj.rotation.y = upright ? -f.heading : f.heading;
  obj.rotation.x = upright ? 0 : (f.pitch || 0);
  obj.rotation.z = 0;
  obj.userData.pathS = s;
}
function syncPlayerPose() {
  if (!player || !run || !run.course) return;
  const f = pathFrame(run.course, player.s);
  const x = player.laneShift != null ? player.laneShift : laneXs()[player.lane];
  player.group.position.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, player.y || 0);
  player.group.rotation.order = "YXZ";
  player.group.rotation.y = -f.heading;
  player.group.rotation.x = (f.pitch || 0) * 0.45;
  player.z = -player.s;
}

async function ensureWorldAssets(world) {
  const files = [...world.decor, ...world.obstacle, ...world.extra, "platformer/coin-gold.glb", BOSSES[world.id - 1].file];
  for (const f of files) {
    try { await loadGLTF(MP(f)); } catch (e) { console.warn(e); }
  }
}

function placeDecor(d) {
  if (!run || !run.course || d.userData.pathS == null) return;
  const df = pathFrame(run.course, d.userData.pathS);
  const side = d.userData.side || 1;
  const spec = d.userData.spec;
  d.position.copy(df.pos).addScaledVector(df.right, side * (d.userData.sideOff || 6));
  if (spec) {
    if (spec.align) d.rotation.y = -df.heading + (spec.outward ? side * Math.PI / 2 : 0);
    if (spec.float) d.position.y += spec.float + Math.sin(performance.now() * 0.0012 + d.userData.pathS) * 0.25;
    if (spec.spin) { d.rotation.x += 0.004; d.rotation.y += 0.006; }
    d.visible = !(spec.align && df.kind === "turn");
  } else {
    d.visible = df.kind !== "causeway";
  }
}
async function spawnDecor(world) {
  decors.forEach((d) => disposeDeep(d));
  decors.length = 0;
  const theme = themeOf(world.id);
  const n = N(isHigh(), 26, 16);
  for (let i = 0; i < n; i++) {
    const spec = stageDecorSpec(world.id, run ? run.st : 0, i)
      || (theme === "jungle" ? null : NEW_THEMES.includes(theme) ? world2Decor(theme, i) : makeThemeDecor(theme, i, isHigh()));
    let m;
    if (spec) m = spec.obj || await createProp(MP(spec.glb), spec.height);
    else m = makeSmoothTree(theme);
    if (spec && spec.obj && !spec.spin) mergeStatic(m); // v8b: one draw call per material per side prop
    if (spec && spec.glb && theme === "space") {
      m.traverse((o) => {
        if (!o.isMesh || !o.material || !o.material.color) return;
        const nrm = o.geometry && o.geometry.attributes.normal;
        if (nrm) {
          const a = nrm.array;
          for (let k = 0; k + 2 < a.length; k += 3) {
            const x = a[k], y = a[k + 1], z = a[k + 2];
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || x * x + y * y + z * z < 1e-8) {
              a[k] = 0; a[k + 1] = 1; a[k + 2] = 0;
            }
          }
          nrm.needsUpdate = true;
        }
        o.material = o.material.clone();
        o.material.metalness = Math.min(o.material.metalness || 0, 0.25);
        o.material.roughness = Math.max(o.material.roughness || 0, 0.45);
        o.material.emissive = o.material.color.clone().multiplyScalar(0.6);
        o.material.emissiveIntensity = 1;
      });
    }
    m.userData.pathS = 6 + i * 10;
    m.userData.side = i % 2 === 0 ? -1 : 1;
    m.userData.sideOff = spec ? spec.sideOff : 6.9 + (i % 5) * 0.4;
    m.userData.spec = spec;
    if (!spec || !spec.align) m.rotation.y = (i % 5) * 0.4 + (run && run.course ? pathFrame(run.course, m.userData.pathS).heading : 0);
    placeDecor(m);
    runScene.add(m);
    decors.push(m);
  }
}

function buildGate(options) {
  const g = new THREE.Group();
  const halfW = trackHalfWidth();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe0b15a, roughness: 0.42, metalness: 0.12, emissive: 0xc48a28, emissiveIntensity: 0.18 });
  [-halfW, halfW].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.4, 10), mat);
    post.position.set(x, 2.2, 0);
    post.name = "gatePost";
    post.userData.side = x < 0 ? -1 : 1;
    post.castShadow = true;
    g.add(post);
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, halfW * 2, 10), mat);
  beam.userData.ownMat = true;
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, 4.35, 0); beam.castShadow = true; g.add(beam);
  const xs = laneXs();
  options.forEach((opt, i) => {
    const sign = makeSign(opt, true);
    sign.position.set(xs[i], 2.32, 0.2);
    sign.name = "laneSign";
    sign.userData.lane = i;
    if (opt === CLOSED && sign.children[0] && sign.children[0].material) sign.children[0].material.color.setHex(0x8a8a8a);
    g.add(sign);
  });
  if (!run || run.i % 2 === 0) {
    const hi = typeof isHigh === "function" ? isHigh() : true;
    [-1, 1].forEach((side) => {
      const fl = makeIsraelFlag({ size: 0.48, poleHeight: 0.92, high: hi });
      fl.position.set(side * halfW, 4.42, 0);
      fl.name = "gateFlag";
      if (side < 0) fl.scale.x = -1;
      g.add(fl);
    });
  }
  return g;
}

function finishAt() {
  if (!run || !run.course) return 1;
  return Math.max(20, run.course.length - 30);
}
function scoreMul() {
  const m = run && run.layout && run.layout.diff && run.layout.diff.scoreMul;
  return m > 0 ? m : 1;
}
function makeCheckerTex(repX, repY) {
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const g = c.getContext("2d");
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = ((x + y) & 1) ? "#f4f4f4" : "#161616";
    g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX || 6, repY || 2);
  return t;
}
function buildFinishGate() {
  const g = new THREE.Group();
  g.name = "finishGate";
  const halfW = trackHalfWidth();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.08 });
  [-halfW, halfW].forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.2, 8), postMat);
    post.position.set(x, 2.6, 0);
    post.castShadow = true;
    g.add(post);
  });
  const bannerTex = makeCheckerTex(8, 2);
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 0.3, 1.2), bannerMat);
  banner.position.set(0, 4.4, 0);
  g.add(banner);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.55, 0.18, 0.18), postMat);
  beam.position.set(0, 5.08, 0);
  g.add(beam);
  const groundTex = makeCheckerTex(8, 2);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2 + 1.6, 1.5), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.09, 0);
  g.add(ground);
  return g;
}
function clearFinishGate() {
  if (!finishGate) return;
  if (finishGate.parent) finishGate.parent.remove(finishGate);
  disposeDeep(finishGate);
  finishGate = null;
}
function spawnFinishGate() {
  clearFinishGate();
  if (!run || !run.course) return;
  const s = finishAt();
  run.finishS = s;
  finishGate = buildFinishGate();
  placeOnCourse(finishGate, s, null, true);
  runScene.add(finishGate);
}
function updateTrackBar() {
  const bar = $("track-bar");
  if (!bar) return;
  if (!run || !player || appMode !== "run") { bar.classList.add("hidden"); return; }
  bar.classList.remove("hidden");
  const end = run.finishS || finishAt();
  const p = Math.max(0, Math.min(1, (player.s || 0) / end));
  bar.style.setProperty("--p", (p * 100).toFixed(2) + "%");
  bar.setAttribute("aria-valuenow", String(Math.round(p * 100)));
  const boss = $("track-bar-boss");
  if (boss) boss.classList.toggle("hidden", !run.boss);
}
function updateFinishCue() {
  const el = $("finish-cue");
  if (!el || !run || !player) return;
  const end = run.finishS || finishAt();
  const near = player.s > end - 32 && player.s < end + 4;
  const turning = $("turn-cue") && !$("turn-cue").classList.contains("hidden");
  el.classList.toggle("hidden", !near || turning);
}

function clearDyn() {
  [...gates, ...coins, ...letters].forEach((o) => {
    if (o.mesh) runScene.remove(o.mesh);
    if (o.group) disposeObj(o.group);
  });
  obstacles.forEach((o) => disposeDeep(o.mesh));
  gates.length = coins.length = obstacles.length = letters.length = 0;
  clearFinishGate();
}

function runnerModeOf(mode) {
  if (mode === "match") return "tr";
  if (mode === "memory" || mode === "pic") return "rev";
  return mode;
}
function laneXs() {
  const span = (run && run.layout && run.layout.narrow) ? 1.7 : 2;
  return [-span, 0, span];
}
function pathBend(z) {
  if (run && run.course) return pathAt(run.course, Math.max(0, -z)).x;
  if (!run || !run.layout || !run.layout.curve) return 0;
  return Math.sin(z * 0.085) * run.layout.curve;
}
function laneWorldX(lane, z) {
  if (run && run.course) return worldOnPath(run.course, Math.max(0, -z), laneXs()[lane]).x;
  return laneXs()[lane] + pathBend(z);
}
function stageProfile(st, boss, wid) {
  const i = boss ? BOSS_ST : st;
  const table = [
    { speed: 7.5, curve: 1.15, hillAmp: 5.8, turnDir: -1, bridge: 0, narrow: 0, tod: "sunset", density: 0.32, types: ["wall", "low"] },
    { speed: 8.0, curve: 1.35, hillAmp: 6.0, turnDir: 1, bridge: 0, narrow: 0, tod: "sunset", density: 0.52, types: ["wall", "hole", "low"] },
    { speed: 8.35, curve: 1.2, hillAmp: 5.4, turnDir: -1, bridge: 1, narrow: 0, tod: "sunset", density: 0.68, types: ["wall", "hole", "beam", "low"] },
    { speed: 8.7, curve: 1.4, hillAmp: 6.2, turnDir: 1, bridge: 0, narrow: 1, tod: "dusk", density: 0.82, types: ["wall", "hole", "beam", "roll"] },
    { speed: 8.5, curve: 1.3, hillAmp: 5.9, turnDir: -1, bridge: 0, narrow: 0, tod: "sunset", density: 0.75, types: ["wall", "hole", "beam", "low"] },
    { speed: 9.0, curve: 1.45, hillAmp: 6.3, turnDir: 1, bridge: 0, narrow: 1, tod: "dusk", density: 0.85, types: ["wall", "hole", "beam", "roll"] },
    { speed: 8.15, curve: 1.05, hillAmp: 5.5, turnDir: -1, bridge: 0, narrow: 0, tod: "storm", density: 0.62, types: ["wall", "hole", "beam", "roll"] }
  ];
  const L = Object.assign({}, table[Math.max(0, Math.min(BOSS_ST, i))]);
  // v8: speed / obstacles / time-to-answer / words / boss scale per world, stage and difficulty
  const D = difficultyFor(wid || 1, st, boss, S.settings);
  L.speed = D.speed; L.density = D.density; L.types = D.types; L.diff = D;
  L.causeway = wid === 1;
  if (wid === 1) { const pl = stagePlan(1, boss ? BOSS_ST : st); L.tod = (pl && pl.tod) || "sunset"; }
  else L.tod = themeOf(wid);
  return L;
}

function pickWords(wid, st, lost, n = 8, mix = [1, 0, 0], filter = null) {
  if (lost) {
    const hard = shuffle(nbs().filter((x) => !x.n.learned).map((x) => x.w));
    return hard.slice(0, Math.min(10, Math.max(hard.length, 0)));
  }
  let arr = activeWords().filter((w) => w.w === wid);
  if (filter) { const f = arr.filter(filter); if (f.length >= n) arr = f; }
  // v8: words are drawn by level (1 basic / 2 intermediate / 3 advanced) using the world's mix;
  // not-yet-known words first inside each level.
  const fresh = (w) => !(S.known && S.known[w.en]);
  const buckets = [1, 2, 3].map((l) => {
    const b = arr.filter((w) => (w.lvl || 1) === l);
    return shuffle(b.filter(fresh)).concat(shuffle(b.filter((w) => !fresh(w))));
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    let r = Math.random(), l = 0;
    while (l < 2 && r >= (mix[l] || 0)) { r -= (mix[l] || 0); l++; }
    const order = [l, l - 1, l + 1, l - 2, l + 2].filter((x) => x >= 0 && x <= 2);
    const b = order.map((x) => buckets[x]).find((x) => x.length);
    if (!b) break;
    out.push(b.shift());
  }
  return shuffle(out);
}
function simScore(a, b, field) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  let sc = 0;
  if (a[0] === b[0]) sc += 2;
  if (a.slice(-1) === b.slice(-1)) sc += field === "en" ? 0.8 : 1;
  if (field === "en" && a.slice(-2) === b.slice(-2)) sc += 0.8;
  sc -= Math.abs(a.length - b.length) * 0.5;
  const set = new Set(a.replace(/\s/g, ""));
  for (const c of set) if (b.includes(c)) sc += 0.3;
  return sc;
}
/* v8: distractors become more similar to the answer (same first letter, length, endings)
   as similarity grows with world / stage / difficulty. Never repeats the answer text. */
function itemField(word, field) {
  if (!word) return "";
  if (field === "en") return word.sentence || word.en || "";
  if (field === "he") return word.he || "";
  if (field === "ans") return word.ans || "";
  if (field === "ansHe") return word.ansHe || "";
  return word[field] || "";
}
function distractors(word, field, k, sim = 0, answerOverride) {
  const ans = answerOverride != null ? answerOverride : itemField(word, field);
  const used = new Set([ans]);
  const pool = activeWords().filter((x) => x.en !== word.en && itemField(x, field) && itemField(x, field) !== ans);
  const same = pool.filter((x) => x.w === word.w);
  const out = [];
  for (let j = 0; j < k; j++) {
    let cand = null;
    const free = same.filter((x) => !used.has(itemField(x, field)));
    if (free.length && Math.random() < sim) {
      cand = free.map((x) => [simScore(ans, itemField(x, field), field) + Math.random() * 1.2, x]).sort((p, q) => q[0] - p[0])[0][1];
    }
    if (!cand) cand = shuffle(free)[0] || shuffle(pool.filter((x) => !used.has(itemField(x, field))))[0];
    if (!cand) break;
    used.add(itemField(cand, field));
    out.push(itemField(cand, field));
  }
  return out;
}
const CONFUSE = ["AEIOU", "EIY", "BDP", "MN", "CKSQ", "GJ", "VWF", "TDF", "HN", "RP", "LI", "UVW"];
function letterDistractors(c, k, sim = 0) {
  const out = new Set();
  if (Math.random() < sim) {
    const grp = shuffle([...new Set(CONFUSE.filter((g) => g.includes(c)).join(""))].filter((x) => x !== c));
    for (const ch of grp) { if (out.size >= k) break; out.add(ch); }
  }
  while (out.size < k) {
    const ch = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    if (ch !== c) out.add(ch);
  }
  return [...out];
}
const isSpellMode = (m) => m === "build" || m === "let";
const spellOK = (w) => /^[A-Za-z]{3,14}$/.test(spellTarget(w));
function spellable(list) {
  return list.filter((w) => /^[A-Za-z]+$/.test(w.en) && w.en.length >= 3 && w.en.length <= 10);
}

function popEl(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
}
function flashHearts() {
  popEl("hud-hearts");
}
function setLaneOpts(opts) {
  const row = $("lane-opts");
  if (!row) return;
  if (!opts || !opts.length) { row.classList.add("hidden"); return; }
  row.classList.remove("hidden");
  opts.forEach((o, i) => {
    const el = $("lane-opt-" + i);
    if (!el) return;
    el.textContent = o;
    el.classList.toggle("closed", o === CLOSED);
    const n = String(o).length;
    el.classList.toggle("long", n >= 16);
    el.style.fontSize = n >= 28 ? "14px" : n >= 22 ? "16px" : n >= 16 ? "18px" : n >= 12 ? "18px" : n >= 10 ? "22px" : n >= 8 ? "26px" : n >= 6 ? "30px" : "";
  });
}
function setPrompt(sub, q, emoji) {
  $("prompt-sub").textContent = sub || "";
  const deco = emoji ? `<span class="deco-emoji">${emoji}</span>` : "";
  $("prompt-q").innerHTML = q ? `${deco}${q}` : "";
  $("prompt-emoji").textContent = "";
  popEl("prompt");
}
function updateHud() {
  document.body.classList.toggle("mq-run", appMode === "run");
  if (!run) return;
  $("hud-hearts").textContent = "❤️".repeat(run.hearts) + "🖤".repeat(Math.max(0, (run.maxHearts || 3) - run.hearts));
  $("hud-score").textContent = "⭐ " + run.score;
  $("hud-combo").textContent = "🔥 " + run.combo;
  $("hud-coins").innerHTML = coinHtml(S.coins);
  updateTrackBar();
  if (run.boss) $("hud-prog").textContent = BOSSES[run.world - 1].name + " " + "❤️".repeat(run.bossHP) + "🖤".repeat(Math.max(0, run.bossMax - run.bossHP));
  else $("hud-prog").textContent = `${Math.min(run.i + 1, run.queue.length)}/${run.queue.length}`;
}

function clearLetters() {
  letters.forEach((L) => { if (L.mesh && L.mesh.parent) runScene.remove(L.mesh); });
  letters.length = 0;
}
const picCountMap = () => { const c = {}; activeWords().forEach((w) => { if (w.pic) c[w.pic] = (c[w.pic] || 0) + 1; }); return c; };
const picOK = (w) => !!(w && w.pic && picCountMap()[w.pic] === 1);
const CLOSED = "✖";                       // v9 easy: the third lane is closed (only 2 answers)
function laneOptions(answer, wrong, nOpts) {
  const list = shuffle([answer, ...wrong.slice(0, Math.max(1, nOpts - 1))]);
  while (list.length < 3) list.splice(Math.floor(Math.random() * (list.length + 1)), 0, CLOSED);
  return list.slice(0, 3);
}
function pairDistractors(pair, k, sim) {
  const out = new Set();
  let guard = 0;
  while (out.size < k && guard++ < 60) {
    const which = guard % 3;
    const a = which === 1 ? pair[0] : letterDistractors(pair[0], 1, sim)[0];
    const b = which === 2 ? pair[1] : letterDistractors(pair[1], 1, sim)[0];
    const c = a + b;
    if (c !== pair) out.add(c);
  }
  return [...out];
}
function setupQuestion() {
  if (!run || run.i >= run.queue.length) return;
  clearLetters();
  const w = run.queue[run.i];
  run.cur = w; run.hint = 0; run.wrongHere = false;
  const modes = run.modes || [run.qmode];
  let mode = modes[run.i % modes.length];
  if (isSpellMode(mode) && !spellOK(w)) mode = modes.find((m) => !isSpellMode(m)) || "en2he";
  if (mode === "picw" && !picOK(w)) mode = modes.find((m) => m !== "picw" && !isSpellMode(m)) || "tr";
  run.activeMode = mode;
  const D = (run.layout && run.layout.diff) || {};
  const sim = D.similarity || 0;
  const nOpts = D.options || 3;
  $("prompt").classList.toggle("listen", isListenMode(mode));
  run.speakText = speakText(w);
  if (mode === "build") {
    setLaneOpts(null);
    setPrompt("אספו את האותיות לפי הסדר", w.he, w.pic);
    spawnLetterWord(w);
    return;
  }
  let opts, sub, q, emoji = "", answer, extraT = 0;
  const over = questionOverride(mode, w);
  if (over) {
    answer = over.answer;
    let wrong = (over.wrong && over.wrong.length) ? over.wrong.slice() : [];
    const field = (answer === w.he || answer === w.ansHe) ? "he" : "en";
    if (wrong.length < 2) wrong = wrong.concat(distractors(w, field, 2, sim, answer));
    wrong = wrong.filter((x, i, a) => x && x !== answer && a.indexOf(x) === i);
    opts = laneOptions(answer, wrong, nOpts);
    sub = over.sub;
    q = over.q || "";
    emoji = over.emoji || "";
    extraT = over.extraT || 0;
    if (over.speak) run.speakText = over.speak;
    if (over.listen) {
      q = `<span class="listen-ico" aria-hidden="true">🎧</span><button type="button" class="btn p replay-btn" id="btn-replay">🔊 שמעו שוב <small>(R)</small></button>`
        + (muted ? `<div class="riddle">🔇 הצליל כבוי – לחצו על «שמעו שוב» כדי לשמוע</div>` : "")
        + (over.q || "");
      run.listenAt = performance.now();
      setTimeout(() => { if (run && run.cur === w && !paused) sayCurrent(false); }, 120);
    }
  } else if (mode === "let") {
    const E = w.en.toUpperCase();
    const two = (D.letMissing || 1) >= 2 && E.length >= 5;
    const span = two ? 2 : 1;
    const lo = D.letAny ? 0 : 1, hi = D.letAny ? E.length - span : E.length - span - 1;
    const kk = E.length <= 3 ? 1 : lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1));
    answer = E.slice(kk, kk + span);
    opts = laneOptions(answer, two ? pairDistractors(answer, 2, sim) : letterDistractors(answer, 2, sim), nOpts);
    sub = two ? "אילו שתי אותיות חסרות?" : "איזו אות חסרה?";
    q = `<span class="en">${esc(E.slice(0, kk))}${two ? "__" : "_"}${esc(E.slice(kk + span))}</span>`;
    emoji = D.picRiddle ? w.pic : "";
    if (!D.picRiddle) q += `<div class="riddle">${esc(w.he)}</div>`;
  } else if (mode === "en2he") {
    answer = w.he;
    opts = laneOptions(answer, distractors(w, "he", 2, sim), nOpts);
    sub = "מה הפירוש בעברית? רצו אל השער";
    q = `<span class="en">${esc(w.en)}</span>`;
  } else if (mode === "picw") {
    // picture -> pick the English word (distractors never share the picture); late stages: no riddle text
    const bank = activeWords();
    const ds = distractors(w, "en", 5, sim).filter((d) => { const x = bank.find((y) => (y.sentence || y.en) === d || y.en === d); return !x || x.pic !== w.pic; }).slice(0, 2);
    while (ds.length < 2) { const x = bank[Math.floor(Math.random() * bank.length)]; const val = (x && (x.en)) || ""; if (x && x.pic !== w.pic && x.en !== w.en && val && !ds.includes(val)) ds.push(val); if (ds.length < 2 && bank.length < 3) break; }
    answer = w.en;
    opts = laneOptions(answer, ds, nOpts);
    sub = D.picRiddle ? "מה בתמונה? רצו אל המילה באנגלית" : "מה בתמונה? (בלי חידה!) רצו אל המילה באנגלית";
    q = `<span class="pic-big">${w.pic}</span>${D.picRiddle ? `<div class="riddle">${esc(w.clue || "מה רואים בתמונה?")}</div>` : ""}`;
    extraT = D.picRiddle ? 0.4 : 0.2;
  } else if (mode === "rev" || mode === "hear") {
    // v9 listening: the word is ONLY spoken. Nothing on screen shows it (no text, no picture, no clue).
    const field = mode === "rev" ? "he" : "en";
    answer = w[field];
    opts = laneOptions(answer, distractors(w, field, 2, sim), nOpts);
    sub = mode === "rev" ? "🎧 הקשיבו למילה באנגלית – מה הפירוש בעברית?" : "🎧 הקשיבו – איזו מילה באנגלית שמעתם?";
    q = `<span class="listen-ico" aria-hidden="true">🎧</span><button type="button" class="btn p replay-btn" id="btn-replay">🔊 שמעו שוב <small>(R)</small></button>`
      + (muted ? `<div class="riddle">🔇 הצליל כבוי – לחצו על «שמעו שוב» כדי לשמוע</div>` : "");
    extraT = 0.8;
    run.listenAt = performance.now();
    setTimeout(() => { if (run && run.cur === w && !paused) sayCurrent(false); }, 120);
  } else {
    answer = w.en;
    opts = laneOptions(answer, distractors(w, "en", 2, sim), nOpts);
    sub = "איך אומרים באנגלית? רצו אל השער";
    q = esc(w.he);
  }
  const ans = opts.indexOf(answer);
  run.opts = opts; run.ans = ans;
  setLaneOpts(opts);
  setPrompt(sub, q, emoji);
  const rb = $("btn-replay");
  if (rb) rb.onclick = (e) => { e.stopPropagation(); sayCurrent(false, true); };
  // v9: the gate distance comes from the answer time (seconds) x the current base speed
  const baseSpeed = (run.layout && run.layout.speed) || 8;
  const lead = D.answerTime ? Math.max(14, (D.answerTime + extraT) * baseSpeed) : (D.lead || 20);
  const s = player.s + (gates.length ? lead : Math.max(12, lead * 0.75));
  const group = buildGate(opts);
  placeOnCourse(group, s, null, true);
  runScene.add(group);
  gates.push({ group, s, z: -s, ans, word: w, resolved: false });
}

/* v8 letter collection: rows are far apart (gap / clear zone from the difficulty table), never on a
   sharp turn, and obstacles near the rows are removed. Missing a row re-spawns the rest of the word. */
function nearTurn(s) {
  if (!run || !run.course || !run.course.turns) return null;
  return run.course.turns.find((t) => s > t.sEnter - 7 && s < t.sExit + 5) || null;
}
function letterRowS(s) {
  for (let k = 0; k < 6; k++) { const t = nearTurn(s); if (!t) break; s = t.sExit + 5.5; }
  return s;
}
function spawnLetterWord(w, fromIdx = 0) {
  const E = (spellTarget(w) || w.en || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!fromIdx) run.spell = { rest: E, idx: 0, rows: [] };
  const D = run.layout && run.layout.diff;
  const gap = (D && D.letterGap) || 15;
  const sim = (D && D.letterSim != null) ? D.letterSim : ((D && D.similarity) || 0);
  let s = letterRowS(player.s + ((D && D.letterFirst) || 18));
  const rows = run.spell.rows;
  E.split("").forEach((ch, idx) => {
    if (idx < fromIdx) return;
    if (idx > fromIdx) s = letterRowS(s + gap);
    rows[idx] = s;
    const correctLane = Math.floor(Math.random() * 3);
    const wrong = letterDistractors(ch, 2, sim);
    for (let lane = 0; lane < 3; lane++) {
      let glyph = ch;
      if (lane !== correctLane) glyph = wrong[lane < correctLane ? lane : lane - 1];
      const sign = makeSign(glyph, false);
      sign.scale.setScalar(1.35);
      placeOnCourse(sign, s, lane);
      sign.position.y += 1.25 + Math.sin(idx) * 0.08;
      runScene.add(sign);
      letters.push({ mesh: sign, lane, ch: glyph, need: ch, index: idx, taken: false, s });
    }
  });
  run.spell.zone = [rows[fromIdx] - ((D && D.letterClear) || 7), s + ((D && D.letterClear) || 7)];
  updateSpellHud();
  // clear obstacles that were already spawned inside the letter zone
  for (const o of obstacles) {
    if (o.hit) continue;
    if (o.s > run.spell.zone[0] && o.s < run.spell.zone[1] && !letterObstacleOK(o.s)) { o.hit = true; disposeDeep(o.mesh); }
  }
}
/* letter stage HUD: the 3 letters of the next row in big HTML (same as gate answers) and the word
   progress (collected letters; on EASY / world 1 the rest of the word is shown faintly as a model). */
function updateSpellHud() {
  if (!run || !run.spell || !run.cur) return;
  const sp = run.spell;
  const row = letters.filter((l) => l.index === sp.idx && !l.taken).sort((a, b) => a.lane - b.lane);
  setLaneOpts(row.length === 3 ? row.map((l) => l.ch) : null);
  const reveal = !!(run.layout && run.layout.diff && run.layout.diff.spellModel);
  const slots = sp.rest.split("").map((c, i) => i < sp.idx ? `<b class="sp-ok">${c}</b>`
    : i === sp.idx ? `<b class="sp-next">${reveal ? c : "?"}</b>` : `<span class="sp-rest">${reveal ? c : "_"}</span>`).join("");
  $("prompt-sub").textContent = "אספו את האותיות לפי הסדר";
  $("prompt-q").innerHTML = `<span class="deco-emoji">${run.cur.pic || ""}</span>${esc(run.cur.he)}<div class="spell-line en">${slots}</div>`;
}
function letterObstacleOK(s) {
  if (!run || run.activeMode !== "build" || !run.spell || !run.spell.zone) return true;
  const z = run.spell.zone;
  if (s < z[0] || s > z[1]) return true;
  const D = run.layout && run.layout.diff;
  const clear = (D && D.letterClear) || 7;
  if (!D || !D.letterObs) return false;                       // early worlds / easy: no obstacles at all
  if (run.spell.rows.some((r) => r != null && Math.abs(r - s) < clear)) return false;
  return Math.random() < D.letterObs;                         // later worlds: a few, only between rows
}

function spawnCoinRow(s) {
  if (run && run.activeMode === "build" && run.spell && run.spell.rows && run.spell.rows.some((r) => r != null && Math.abs(r - s) < 3)) return;
  const lane = Math.floor(Math.random() * 3);
  const mesh = run.coinProto ? run.coinProto.clone(true) : new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.6, roughness: 0.3 }));
  placeOnCourse(mesh, s, lane);
  mesh.position.y += 0.7;
  mesh.rotation.x = Math.PI / 2;
  runScene.add(mesh);
  coins.push({ mesh, taken: false, s, lane });
}
function cautionTex() {
  if (cautionTex._t) return cautionTex._t;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a1208"; ctx.fillRect(0, 0, 256, 64);
  for (let i = -1; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "#ffd000" : "#1a1208";
    ctx.beginPath();
    ctx.moveTo(i * 28, 0); ctx.lineTo(i * 28 + 22, 0);
    ctx.lineTo(i * 28 + 6, 64); ctx.lineTo(i * 28 - 16, 64);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cautionTex._t = t;
  return t;
}
function hazardMark(kind) {
  const th = run ? themeOf(run.world) : "jungle";
  if (NEW_THEMES.includes(th)) return world2Hazard(th, kind, cautionTex());
  if (th !== "jungle") return makeThemedHazard(th, kind, cautionTex());
  const g = new THREE.Group();
  if (kind === "hole") {
    const pit = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 2.3), new THREE.MeshStandardMaterial({ color: 0x0a0610, roughness: 1, emissive: 0x220814, emissiveIntensity: 0.28 }));
    pit.position.y = -0.08;
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.06, 2.45), new THREE.MeshBasicMaterial({ map: cautionTex() }));
    rim.position.y = 0.04;
    g.add(pit, rim);
  } else if (kind === "wall") {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.55, 0.38), new THREE.MeshStandardMaterial({ color: 0xc4482a, roughness: 0.48, metalness: 0.14, emissive: 0x4a1208, emissiveIntensity: 0.18 }));
    wall.position.y = 0.78; wall.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.28), new THREE.MeshBasicMaterial({ map: cautionTex() }));
    stripe.position.set(0, 1.28, 0.21);
    g.add(wall, stripe);
  } else if (kind === "beam") {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.72, 10), new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.32, emissive: 0xffaa00, emissiveIntensity: 0.4 }));
    beam.rotation.z = Math.PI / 2;
    beam.position.y = 1.18; beam.castShadow = true;
    [-0.78, 0.78].forEach((x) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.22, 8), new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.6 }));
      post.position.set(x, 0.61, 0);
      g.add(post);
    });
    g.add(beam);
  } else {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.55, 12), new THREE.MeshStandardMaterial({ color: 0x8b4a1e, roughness: 0.68 }));
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.44; log.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.18, 12), new THREE.MeshBasicMaterial({ color: 0xffd000 }));
    stripe.rotation.z = Math.PI / 2; stripe.position.y = 0.44;
    g.add(log, stripe);
  }
  return g;
}

const ANIMAL_BY_WORLD = {
  1: ["snake", "monkey"],
  2: ["crab", "seagull"],
  3: ["bat", "cat"],
  4: ["alien", "blob"],
  5: ["penguin", "seal"],
  6: ["scorpion", "snake"],
  7: ["fish", "jellyfish"],
  8: ["dino", "lizard"]
};
function pickAnimalKind(wid) {
  const list = ANIMAL_BY_WORLD[wid] || ANIMAL_BY_WORLD[1];
  return list[Math.floor(Math.random() * list.length)];
}
function animalMove(kind) {
  return (kind === "snake" || kind === "crab" || kind === "scorpion" || kind === "lizard" || kind === "seal") ? "sidestep" : "hop";
}
function buildAnimal(kind) {
  const g = new THREE.Group();
  g.name = "animal-" + kind;
  const segs = isHigh() ? 8 : 5;
  const M = (c, em) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.58, metalness: 0.06, flatShading: true, emissive: em || 0x000000, emissiveIntensity: em ? 0.16 : 0 });
  const add = (geom, mat, x, y, z, rx, ry, rz, part) => {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    if (isHigh()) m.castShadow = true;
    if (part) m.userData.part = part;
    m.userData.base = { x: m.position.x, y: m.position.y, z: m.position.z, rx: m.rotation.x, ry: m.rotation.y, rz: m.rotation.z };
    g.add(m);
    return m;
  };
  const sph = (r) => new THREE.SphereGeometry(r, segs, segs - 1);
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c);
  const cyl = (t, b, h) => new THREE.CylinderGeometry(t, b, h, segs);
  if (kind === "snake") {
    const m = M(0x2f9a4c, 0x145020); const eye = M(0x1a1a1a);
    add(sph(0.16), m, 0.42, 0.2, 0, 0, 0, 0, "head");
    add(sph(0.14), m, 0.12, 0.16, 0);
    add(sph(0.12), m, -0.16, 0.14, 0);
    add(sph(0.09), m, -0.4, 0.12, 0, 0, 0, 0, "tail");
    add(sph(0.035), eye, 0.5, 0.26, 0.08); add(sph(0.035), eye, 0.5, 0.26, -0.08);
  } else if (kind === "monkey") {
    const fur = M(0x8a4a22), face = M(0xe8c090), eye = M(0x1a1a1a);
    add(sph(0.28), fur, 0, 0.38, 0);
    add(sph(0.18), face, 0, 0.68, 0.08, 0, 0, 0, "head");
    add(sph(0.035), eye, 0.07, 0.74, 0.2); add(sph(0.035), eye, -0.07, 0.74, 0.2);
    add(cyl(0.05, 0.05, 0.32), fur, 0.28, 0.42, 0, 0, 0, 0.7, "armR");
    add(cyl(0.05, 0.05, 0.32), fur, -0.28, 0.42, 0, 0, 0, -0.7, "armL");
    add(cyl(0.06, 0.06, 0.22), fur, 0.12, 0.16, 0, 0, 0, 0, "legR");
    add(cyl(0.06, 0.06, 0.22), fur, -0.12, 0.16, 0, 0, 0, 0, "legL");
  } else if (kind === "crab") {
    const sh = M(0xd4482a), claw = M(0xc43818);
    add(sph(0.22), sh, 0, 0.2, 0);
    g.children[0].scale.set(1.35, 0.55, 1);
    add(box(0.16, 0.08, 0.12), claw, 0.32, 0.22, 0.12, 0, 0, 0, "clawR");
    add(box(0.16, 0.08, 0.12), claw, -0.32, 0.22, 0.12, 0, 0, 0, "clawL");
    add(cyl(0.025, 0.025, 0.16), sh, 0.16, 0.08, 0.1, 0, 0, 0, "legR");
    add(cyl(0.025, 0.025, 0.16), sh, -0.16, 0.08, 0.1, 0, 0, 0, "legL");
    add(sph(0.04), M(0x1a1a1a), 0.1, 0.28, 0.16);
    add(sph(0.04), M(0x1a1a1a), -0.1, 0.28, 0.16);
  } else if (kind === "seagull") {
    const w = M(0xf4f4f0), beak = M(0xffb02a), eye = M(0x1a1a1a);
    add(sph(0.16), w, 0, 0.42, 0);
    add(sph(0.11), w, 0, 0.55, 0.1, 0, 0, 0, "head");
    add(box(0.62, 0.04, 0.16), w, 0, 0.46, 0, 0, 0, 0, "wing");
    add(cyl(0.02, 0.04, 0.14), beak, 0, 0.52, 0.22, Math.PI / 2);
    add(sph(0.03), eye, 0.05, 0.58, 0.16);
  } else if (kind === "bat") {
    const d = M(0x3a2a55, 0x1a1030), eye = M(0xffe080, 0xffaa33);
    add(sph(0.14), d, 0, 0.5, 0, 0, 0, 0, "head");
    add(box(0.72, 0.06, 0.22), d, 0, 0.5, 0, 0, 0, 0, "wing");
    add(sph(0.04), eye, 0.06, 0.54, 0.1); add(sph(0.04), eye, -0.06, 0.54, 0.1);
    add(box(0.08, 0.12, 0.04), d, 0.08, 0.64, 0);
    add(box(0.08, 0.12, 0.04), d, -0.08, 0.64, 0);
  } else if (kind === "cat") {
    const fur = M(0xc4843a), eye = M(0x222222);
    add(sph(0.2), fur, 0, 0.28, 0);
    add(sph(0.14), fur, 0.22, 0.38, 0.06, 0, 0, 0, "head");
    add(box(0.08, 0.12, 0.04), fur, 0.18, 0.52, 0.04);
    add(box(0.08, 0.12, 0.04), fur, 0.28, 0.52, 0.04);
    add(cyl(0.03, 0.03, 0.28), fur, -0.22, 0.34, 0, 0, 0, 0.8, "tail");
    add(sph(0.03), eye, 0.28, 0.42, 0.16); add(sph(0.03), eye, 0.16, 0.42, 0.16);
    add(cyl(0.045, 0.045, 0.16), fur, 0.08, 0.12, 0.06, 0, 0, 0, "legR");
    add(cyl(0.045, 0.045, 0.16), fur, -0.08, 0.12, 0.06, 0, 0, 0, "legL");
  } else if (kind === "alien") {
    const sk = M(0x6adf4a, 0x2a8a20), eye = M(0x111111);
    add(sph(0.22), sk, 0, 0.34, 0);
    g.children[0].scale.set(1, 1.25, 0.9);
    add(sph(0.16), sk, 0, 0.62, 0, 0, 0, 0, "head");
    add(sph(0.08), eye, 0.06, 0.66, 0.12); add(sph(0.08), eye, -0.06, 0.66, 0.12);
    add(cyl(0.03, 0.03, 0.2), sk, 0.16, 0.14, 0, 0, 0, 0, "legR");
    add(cyl(0.03, 0.03, 0.2), sk, -0.16, 0.14, 0, 0, 0, 0, "legL");
  } else if (kind === "blob") {
    const sk = M(0x7a5cff, 0x3a20aa);
    add(sph(0.32), sk, 0, 0.32, 0, 0, 0, 0, "head");
    g.children[0].scale.set(1.15, 0.85, 1.15);
    add(sph(0.07), M(0x111111), 0.1, 0.4, 0.22); add(sph(0.07), M(0x111111), -0.1, 0.4, 0.22);
  } else if (kind === "penguin") {
    const blk = M(0x1c1c24), wh = M(0xf6f6f2), beak = M(0xffb02a);
    add(sph(0.2), blk, 0, 0.36, 0);
    g.children[0].scale.set(0.9, 1.25, 0.85);
    add(sph(0.12), wh, 0, 0.34, 0.1);
    add(sph(0.12), blk, 0, 0.62, 0, 0, 0, 0, "head");
    add(cyl(0.025, 0.04, 0.1), beak, 0, 0.58, 0.14, Math.PI / 2);
    add(box(0.16, 0.04, 0.1), beak, 0.07, 0.08, 0.06, 0, 0, 0, "legR");
    add(box(0.16, 0.04, 0.1), beak, -0.07, 0.08, 0.06, 0, 0, 0, "legL");
  } else if (kind === "seal") {
    const fur = M(0x8aa0b4), eye = M(0x111111);
    add(sph(0.2), fur, 0, 0.2, 0);
    g.children[0].scale.set(1.5, 0.75, 0.9);
    add(sph(0.13), fur, 0.32, 0.26, 0.06, 0, 0, 0, "head");
    add(sph(0.03), eye, 0.4, 0.32, 0.1);
    add(box(0.18, 0.04, 0.1), fur, -0.1, 0.12, 0.16, 0, 0, 0, "wingL");
    add(box(0.18, 0.04, 0.1), fur, -0.1, 0.12, -0.16, 0, 0, 0, "wingR");
  } else if (kind === "scorpion") {
    const sh = M(0xc46a1a), dk = M(0x8a4010);
    add(sph(0.16), sh, 0, 0.16, 0);
    g.children[0].scale.set(1.3, 0.55, 0.9);
    add(sph(0.08), dk, 0.28, 0.16, 0, 0, 0, 0, "head");
    add(cyl(0.035, 0.035, 0.28), sh, -0.22, 0.32, 0, 0, 0, -0.9, "tail");
    add(sph(0.06), dk, -0.36, 0.48, 0);
    add(box(0.12, 0.06, 0.08), sh, 0.22, 0.18, 0.16, 0, 0, 0, "clawR");
    add(box(0.12, 0.06, 0.08), sh, 0.22, 0.18, -0.16, 0, 0, 0, "clawL");
  } else if (kind === "fish") {
    const sc = M(0x2db8d8, 0x146888), fin = M(0xff8a3a);
    add(sph(0.2), sc, 0, 0.32, 0);
    g.children[0].scale.set(1.35, 0.8, 0.7);
    add(box(0.16, 0.16, 0.04), fin, -0.28, 0.32, 0, 0, 0, 0, "tail");
    add(box(0.12, 0.1, 0.03), fin, 0, 0.5, 0, 0, 0, 0, "wing");
    add(sph(0.035), M(0x111111), 0.16, 0.36, 0.12);
  } else if (kind === "jellyfish") {
    const cap = M(0xd890ff, 0x8040c0), arm = M(0xe8b0ff, 0x8040c0);
    add(sph(0.22), cap, 0, 0.5, 0, 0, 0, 0, "head");
    g.children[0].scale.set(1.15, 0.6, 1.15);
    add(cyl(0.02, 0.02, 0.32), arm, 0.08, 0.28, 0.06, 0, 0, 0, "tentacle");
    add(cyl(0.02, 0.02, 0.28), arm, -0.08, 0.26, 0, 0, 0, "tentacle");
    add(cyl(0.02, 0.02, 0.3), arm, 0, 0.27, -0.08, 0, 0, 0, "tentacle");
  } else if (kind === "dino") {
    const sc = M(0x3aaa4a, 0x1a5a20), eye = M(0x111111);
    add(sph(0.22), sc, 0, 0.34, 0);
    add(sph(0.14), sc, 0.28, 0.5, 0.04, 0, 0, 0, "head");
    add(cyl(0.05, 0.07, 0.32), sc, -0.28, 0.34, 0, 0, 0, 1.1, "tail");
    add(cyl(0.05, 0.05, 0.2), sc, 0.1, 0.14, 0.06, 0, 0, 0, "legR");
    add(cyl(0.05, 0.05, 0.2), sc, -0.08, 0.14, 0.06, 0, 0, 0, "legL");
    add(sph(0.03), eye, 0.36, 0.54, 0.12);
  } else {
    // lizard
    const sc = M(0x6a8a2a);
    add(sph(0.14), sc, 0.2, 0.16, 0, 0, 0, 0, "head");
    add(sph(0.12), sc, -0.04, 0.14, 0);
    add(cyl(0.04, 0.05, 0.32), sc, -0.32, 0.14, 0, 0, 0, 1.2, "tail");
    add(cyl(0.03, 0.03, 0.12), sc, 0.1, 0.08, 0.1, 0, 0, 0, "legR");
    add(cyl(0.03, 0.03, 0.12), sc, 0.1, 0.08, -0.1, 0, 0, 0, "legL");
    add(sph(0.025), M(0x111111), 0.3, 0.2, 0.08);
  }
  return g;
}
function animateAnimal(o, dt) {
  if (!o.mesh) return;
  o.t = (o.t || 0) + dt;
  const t = o.t;
  // walk / run along the track toward the player; collision uses the updated o.s
  if (player && o.s != null && o.s > (player.s || 0) - 1) {
    const runSp = (run && run.layout && run.layout.speed) || 8;
    const approach = Math.max(1.2, Math.min(2.0, runSp * 0.24));
    o.s -= approach * dt;
  }
  placeOnCourse(o.mesh, o.s, o.lane);
  const hop = o.move === "hop";
  if (hop) {
    const phase = Math.sin(t * 6.4);
    const up = Math.abs(phase) * 0.88;
    o.mesh.position.y += up;
    o.mesh.rotation.x += -0.2 - up * 0.18;
    o.mesh.rotation.z += phase * 0.16;
    o.mesh.rotation.y += Math.sin(t * 3.2) * 0.1;
  } else {
    const amp = 1.08; // much of a lane width (lanes are ~2 units apart)
    const sway = Math.sin(t * 2.05) * amp;
    const v = Math.cos(t * 2.05);
    if (run && run.course) {
      const f = trackFrameAt(o.s);
      o.mesh.position.addScaledVector(f.right, sway);
    } else {
      o.mesh.position.x += sway;
    }
    o.mesh.rotation.y += Math.atan2(v, 1.55);
    o.mesh.rotation.z += -v * 0.25;
    o.mesh.position.y += Math.abs(Math.sin(t * 7.5)) * 0.12;
  }
  // limb / head / tail / wing motion — also on Low (classroom projector)
  const swing = hop ? 8.4 : 7.2;
  o.mesh.traverse((m) => {
    const p = m.userData && m.userData.part;
    const b = m.userData && m.userData.base;
    if (!p || !b) return;
    m.position.set(b.x, b.y, b.z);
    m.rotation.set(b.rx, b.ry, b.rz);
    if (p === "head") {
      m.rotation.y += Math.sin(t * 4.4) * 0.42;
      m.rotation.x += Math.sin(t * 3.2) * 0.14;
    } else if (p === "tail") {
      m.rotation.z += Math.sin(t * 5.6) * 0.75;
      m.rotation.y += Math.sin(t * 4.2) * 0.38;
    } else if (p === "legL" || p === "armL") {
      m.rotation.x += Math.sin(t * swing) * 0.75;
    } else if (p === "legR" || p === "armR") {
      m.rotation.x += Math.sin(t * swing + Math.PI) * 0.75;
    } else if (p === "wingL") {
      m.rotation.z += Math.sin(t * 10.5) * 0.6;
    } else if (p === "wingR") {
      m.rotation.z += -Math.sin(t * 10.5) * 0.6;
    } else if (p === "wing") {
      m.rotation.z += Math.sin(t * 10.5) * 0.5;
      m.rotation.x += Math.sin(t * 10.5) * 0.18;
    } else if (p === "clawL") {
      m.rotation.y += Math.sin(t * 5.2) * 0.45;
    } else if (p === "clawR") {
      m.rotation.y += -Math.sin(t * 5.2) * 0.45;
    } else if (p === "tentacle") {
      m.rotation.x += Math.sin(t * 6.2 + (b.x || 0) * 10) * 0.55;
    }
  });
}

function hitObstacle(o) {
  if (o.hit) return;
  o.hit = true;
  if (o.mesh) disposeDeep(o.mesh);
  if (!run || run.iFrames > 0) return;
  run.stumbleT = 0.55;
  run.iFrames = 1.15;
  shakeT = 0.22;
  sfx.bad();
  playAnim(player, "fall", 0.08, true);
  run.hearts--;
  run.wrong++;
  run.combo = 0;
  flashHearts();
  updateHud();
  if (run.hearts <= 0) finishLevel(false);
}

function spawnEarlyAnimal() {
  if (!run || !run.course || !player) return;
  const s = 12;
  const lane = 1;
  const kind = pickAnimalKind(run.world);
  const mesh = buildAnimal(kind);
  placeOnCourse(mesh, s, lane);
  runScene.add(mesh);
  obstacles.push({ mesh, lane, type: "animal", hit: false, spin: 0, s, kind, move: animalMove(kind), t: 0 });
  run.sawAnimal = true;
}
function spawnObstacle(s) {
  const L = (run && run.layout) || stageProfile(run ? run.st : 0, run && run.boss, run && run.world);
  const needAnimal = run && !run.sawAnimal;
  if (!needAnimal && Math.random() > L.density) return;
  if (!letterObstacleOK(s)) return;
  // v9 fairness: never put an obstacle right in front of (or inside) an answer gate
  if (gates.some((g) => !g.resolved && s > g.s - 7 && s < g.s + 2.5)) return;
  const type = needAnimal ? "animal" : L.types[Math.floor(Math.random() * L.types.length)];
  if (type === "animal" && run) run.sawAnimal = true;
  const dbl = L.diff ? L.diff.doubleBlock : 0.28;
  const blocked = type === "beam" ? [0, 1, 2] : shuffle([0, 1, 2]).slice(0, (Math.random() < dbl && L.density > 0.35) ? 2 : 1);
  blocked.forEach((lane) => {
    let mesh;
    let move = null, kind = null;
    if (type === "animal") {
      kind = pickAnimalKind(run.world);
      mesh = buildAnimal(kind);
      move = animalMove(kind);
    } else if (type === "low") {
      const world = WORLDS[run.world - 1];
      const file = world.obstacle[Math.floor(Math.random() * world.obstacle.length)];
      const proto = run.obsProtos && run.obsProtos[file];
      mesh = proto ? proto.clone(true) : hazardMark("wall");
    } else mesh = hazardMark(type);
    placeOnCourse(mesh, s, lane);
    runScene.add(mesh);
    obstacles.push({ mesh, lane, type, hit: false, spin: type === "roll" ? 4 : 0, s, kind, move, t: Math.random() * 4 });
  });
}

function nextAfterResolve() {
  run.i++;
  if (run.boss && run.bossHP <= 0) return finishLevel(true);
  if (run.i >= run.queue.length) {
    if (run.boss && run.bossHP > 0) {
      run.queue = run.queue.concat(shuffle(run.queue.slice(0, 6)));
      setupQuestion(); updateHud(); return;
    }
    return finishLevel(true);
  }
  setupQuestion(); updateHud();
}

function onCorrect() {
  const w = run.cur;
  const p = Math.round(PTS[Math.min(run.hint, 3)] * (run.wrongHere ? 0.5 : 1) * scoreMul());
  run.score += p; run.combo++;
  const c = Math.max(1, Math.round(p / 20) + Math.min(3, run.combo >> 1));
  S.coins += c; run.coins += c;
  if (!run.hint && !run.wrongHere) run.firstTry++;
  if (run.boss) run.bossHP = Math.max(0, run.bossHP - 1);
  record(w, true, run.hint, run.wrongHere);
  sfx.good();
  const bp = player.group.position.clone().add(new THREE.Vector3(0, 1.35, -1));
  burst(bp);
  burst(bp.clone().add(new THREE.Vector3(0.4, 0.3, 0)));
  popEl("prompt");
  popEl("hud-combo");
  if (!isListenMode(run.activeMode)) say(run.speakText || speakText(w) || w.en);
  nextAfterResolve();
}
function onWrong() {
  const w = run.cur;
  run.wrong++; run.wrongHere = true; run.combo = 0; run.hearts = Math.max(0, run.hearts - 1);
  record(w, false, run.hint, true);
  sfx.bad(); shakeT = 0.28;
  playAnim(player, "fall", 0.08, true);
  run.stumbleT = 0.7;
  const D = (run.layout && run.layout.diff) || {};
  if (isListenMode(run.activeMode) && !(D.reveal && S.settings.showAnswer)) {
    // v9: listening stages never show the word (only EASY reveals it after a miss)
    setPrompt("לא הפעם – הקשיבו שוב", `<span class="listen-ico">🎧</span><div class="riddle">המילה תחזור שוב בהמשך</div>`);
    say(w.en, D.rate);
  } else if (S.settings.showAnswer) {
    setPrompt("כמעט! התשובה היא", `<span class="en">${esc(w.en)}</span> — ${esc(w.he)}`, w.pic);
    say(w.en);
  } else {
    setPrompt("לא הפעם", "המילה תחזור שוב בהמשך", "💪");
  }
  updateHud();
  if (run.hearts <= 0) return finishLevel(false);
  // requeue word and continue shortly
  run.queue.splice(Math.min(run.i + 3, run.queue.length), 0, w);
  setTimeout(() => { if (run && !paused) { run.i++; setupQuestion(); updateHud(); } }, 900);
}

function resolveGate(g) {
  if (g.resolved) return;
  g.resolved = true;
  if (playerLaneNow() === g.ans) onCorrect();
  else onWrong();
}

function showEndScreen(ok, st, title, nx) {
  showUI("s-end");
  $("s-end").innerHTML = `<div class="glass pop" style="padding:22px;max-width:640px">
    <h2>${title}</h2>
    <div style="font-size:48px">${"⭐".repeat(st)}${"☆".repeat(3 - st)}</div>
    <p>ניקוד: <b>${run.score}</b> <span class="score-mul">×${scoreMul()} (${esc((DIFFS[(run.layout && run.layout.diff && run.layout.diff.level)] || DIFFS.normal).label)})</span> · ${coinHtml("+" + run.coins)} · נכון בניסיון ראשון: ${run.firstTry}/${run.queue.length}</p>
    ${ok && run.boss && run.bossHP <= 0 && run.world < WORLDS.length ? "<p>🔑 קיבלתם מפתח זהב! העולם הבא נפתח.</p>" : ""}
  </div>
  <div class="row" style="margin-top:12px">${nx}
    <button class="btn" id="again">שוב</button>
    <button class="btn" id="to-map">למפה</button>
  </div>`;
  $("to-map").onclick = () => goMapMode();
  $("again").onclick = () => startLevel(run.world, run.st, run.lost);
  const nxb = $("nx");
  if (nxb) nxb.onclick = () => {
    if (run.st < BOSS_ST) startLevel(run.world, run.st + 1);
    else startLevel(run.world + 1, 0);
  };
}
function recordRunSession() {
  if (!run || run.recorded) return;
  run.recorded = true;
  try {
    if (window.Englishia && Englishia.getName()) {
      Englishia.recordSession(GAME_ID, run.score || 0, Math.max(0, Math.round(run.playSec || 0)));
    }
  } catch (e) {}
}
function finishLevel(ok) {
  paused = true;
  recordRunSession();
  if (player) playAnim(player, ok ? "emote-yes" : "idle");
  const acc = run.queue.length ? run.firstTry / Math.max(1, run.queue.length) : 0;
  const st = !ok ? 1 : acc >= .85 ? 3 : acc >= .6 ? 2 : 1;
  if (ok && !run.lost) {
    const key = run.world + "-" + run.st;
    if (st > (S.prog[key] || 0)) S.prog[key] = st;
  }
  S.stars = starSum(); S.best = Math.max(S.best, run.score); save();
  if (S.runs >= 1) grantAch("first_run");
  if (st === 3) grantAch("stars3");
  const bossWin = !!(ok && run.boss && run.bossHP <= 0);
  if (bossWin) {
    grantAch("boss1");
    if (run.world < WORLDS.length) pendingUnlock = run.world;
    startKeyReward();
    appMode = "run";
  } else {
    appMode = "map";
  }
  if (stDone(1, BOSS_ST)) grantAch("world1");
  if (worldsDone() >= WORLDS.length) grantAch("worlds5");
  const ln = learnedCount();
  if (ln >= 10) grantAch("learn10");
  if (ln >= 50) grantAch("learn50");
  if (ln >= 100) grantAch("learn100");
  if (run.score >= 800) grantAch("score800");
  if (ok && run.wrong === 0) grantAch("perfect");

  const title = !ok ? "💪 נסו שוב — הלבבות נגמרו" :
    (bossWin ? "🏆 ניצחתם את " + BOSSES[run.world - 1].name + "!" : "🏁 השלב הושלם!");
  let nx = "";
  if (ok && !run.lost) {
    if (run.st < BOSS_ST) nx = `<button class="btn g" id="nx">לשלב הבא ▶</button>`;
    else if (WORLDS[run.world]) nx = `<button class="btn g" id="nx">לעולם הבא ▶</button>`;
  }
  if (bossWin) {
    setTimeout(() => showEndScreen(ok, st, title, nx), 1600);
  } else {
    showEndScreen(ok, st, title, nx);
  }
}

/* some GLBs ship zero-length normals -> NaN lighting -> pure black silhouettes; recompute those */
function fixZeroNormals(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.normal) return;
    const a = o.geometry.attributes.normal.array;
    let bad = false;
    for (let k = 0; k + 2 < a.length; k += 3) {
      const x = a[k], y = a[k + 1], z = a[k + 2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || x * x + y * y + z * z < 1e-8) { bad = true; break; }
    }
    if (bad) { o.geometry = o.geometry.clone(); o.geometry.computeVertexNormals(); }
  });
}
function tintActor(root, hex) {
  const c = new THREE.Color(hex);
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    // fresh standard material (cloning some GLB materials rendered pure black in the storm stage)
    const tint = (m) => {
      const n = new THREE.MeshStandardMaterial({ map: m.map || null, color: (m.color ? m.color.clone() : new THREE.Color(0xffffff)).lerp(c, m.map ? 0.35 : 0.55),
        roughness: m.roughness != null ? m.roughness : 0.7, metalness: Math.min(m.metalness || 0, 0.3), emissive: c, emissiveIntensity: 0.12, transparent: !!m.transparent, opacity: m.opacity != null ? m.opacity : 1, side: m.side });
      return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
}
async function startLevel(wid, st, lost, opt) {
  wid = wid || 1; st = st || 0;
  const world = WORLDS[wid - 1];
  if (!world) return false;
  const bypass = isDev() && opt && opt.bypassLock;
  if (!lost && !bypass && !sOpen(wid - 1, st)) return false;
  hideModal();
  try { if (window.EnglishiaAuth && EnglishiaAuth.user) EnglishiaAuth.logEvent("stage_reached", GAME_ID, `עולם ${wid} · ${st === BOSS_ST ? "בוס" : "שלב " + (st + 1)}`); } catch (e) {}
  showTurnCue(null);
  showUI("s-load");
  $("load-msg").textContent = "מכינים את המסלול…";
  await ensureWorldAssets(world);
  await ensurePlayer();
  if (bossActor && bossActor.model && bossActor.model.parent) bossActor.model.parent.remove(bossActor.model);
  bossActor = null;

  const stageMode = lost ? "tr" : ST[wid - 1][st][1];
  const boss = stageMode === "boss";
  // v9: every stage (and the boss) of a world uses the world's exercise type; the library mixes translation
  let modes = stageModes(wid, st, boss, S.settings);
  if (lost) { const tr = [S.settings.types.en2he ? "en2he" : null, S.settings.types.he2en ? "tr" : null].filter(Boolean); modes = tr.length ? tr : modes; }
  const mode = modes[0];
  const layout = stageProfile(st, boss, wid);
  const D = layout.diff;
  const allSpell = modes.every(isSpellMode);
  let queue = pickWords(wid, st, lost, allSpell && modes.includes("build") ? 6 : 8, D.lvlMix, allSpell ? spellOK : null);
  if (lost && queue.length < 2) {
    showUI("s-map"); refreshMapStats(); renderStages();
    showModal(`<h2>📚 ספריית המילים האבודות</h2><p>עדיין אין מילים קשות — כל הכבוד!</p><button class="btn" id="mgo">חזרה</button>`);
    $("mgo").onclick = hideModal;
    return;
  }
  if (allSpell) {
    const sp = spellable(queue);
    if (sp.length >= 4) queue = sp;
  }
  if (boss) queue = pickWords(wid, BOSS_ST, false, Math.max(10, D.bossHP + 2), D.lvlMix, allSpell ? spellOK : (modes.length === 1 && modes[0] === "picw" ? picOK : null));
  else if (!lost && modes.length === 1 && modes[0] === "picw") queue = pickWords(wid, st, false, 8, D.lvlMix, picOK);
  else if (!lost && modes.length > 2) queue = pickWords(wid, st, false, 10, D.lvlMix);

  run = {
    world: wid, st, lost, mode, qmode: mode, modes, boss, queue, i: 0, score: 0, coins: 0,
    hint: 0, wrong: 0, firstTry: 0, hearts: D.hearts, maxHearts: D.hearts, combo: 0, stumbleT: 0, iFrames: 0,
    bossHP: boss ? D.bossHP : 0, bossMax: boss ? D.bossHP : 0, nextCoinS: 8, nextObsS: 18, glanceT: 0, forceGlance: false,
    layout, playSec: 0, recorded: false
  };
  fpsMon.runStart = performance.now();
  // v8: course long enough for the stage (letter rows are now far apart)
  const spellLen = queue.reduce((a, w) => a + w.en.replace(/[^A-Za-z]/g, "").length, 0);
  const needLen = modes.includes("build")
    ? (D.letterFirst + 10) * queue.length + spellLen * D.letterGap * 1.25 + 200
    : queue.length * (D.lead + 0.8 * D.speed) * (boss ? 3.4 : 2.2) + 260;
  run.course = buildCourse({
    curve: run.layout.curve,
    hillAmp: run.layout.hillAmp,
    turnDir: run.layout.turnDir,
    causeway: run.layout.causeway,
    minLength: Math.min(2400, Math.round(needLen))
  });
  S.runs++; save(); grantAch("first_run");

  applyWorldTheme(world);
  {
    const pl = lost ? null : stagePlan(wid, st);
    if (pl && pl.grass) sideMat.color.setHex(pl.grass);
    if (pl && pl.path) pathMat.color.setHex(pl.path);
  }
  applyStageLook(world);
  if (runHills && runHills.parent) runScene.remove(runHills);
  if (runHills) disposeDeep(runHills);
  runHills = null;
  const theme = themeOf(wid);
  if (theme === "jungle") {
    const hillCol = run.layout.tod === "sunset" ? 0x7a5a38
      : (run.layout.tod === "dusk" || run.layout.tod === "storm") ? 0x3a3a58
      : world.ground;
    runHills = makeMountains(hillCol, { count: N(isHigh(), 12, 8) });
  } else if (THEME_MOUNTAINS[theme]) {
    runHills = makeMountains(THEME_MOUNTAINS[theme].color, { count: N(isHigh(), 12, 8), top: THEME_MOUNTAINS[theme].top });
  }
  if (runHills) runScene.add(runHills);
  if (themeAmb) {
    runScene.remove(themeAmb);
    if (themeAmb.userData.far) runScene.remove(themeAmb.userData.far);
    disposeDeep(themeAmb);
    if (themeAmb.userData.far) disposeDeep(themeAmb.userData.far);
    themeAmb = null;
  }
  if (theme !== "jungle") {
    themeAmb = NEW_THEMES.includes(theme) ? buildWorld2Ambience(theme, isHigh()) : buildThemeAmbience(theme, isHigh());
    if (themeAmb.userData.far) themeAmb.userData.far.userData.mergeStats = mergeStatic(themeAmb.userData.far);
    runScene.add(themeAmb);
    if (themeAmb.userData.far) runScene.add(themeAmb.userData.far);
  } else {
    themeAmb = new THREE.Group();
    themeAmb.name = "jungleAmb";
    runScene.add(themeAmb);
  }
  // v8b: per-stage weather / sky extras (rain, fireflies, aurora, embers…) ride on the ambience group
  {
    const atm = buildStageAtmos(wid, lost ? 0 : st, isHigh());
    if (atm) {
      themeAmb.add(atm);
      const prevU = themeAmb.userData.update;
      themeAmb.userData.update = (dt, t, ctx) => { if (prevU) prevU(dt, t, ctx); if (atm.userData.update) atm.userData.update(dt, t, ctx); };
    }
  }
  if (runMist) disposeDeep(runMist);
  runMist = makeMist();
  runScene.add(runMist);
  clearDyn();
  await spawnDecor(world);
  rebuildCourseRibbon();
  layoutPathFromCourse();
  spawnFinishGate();
  spawnEarlyAnimal();
  run.coinProto = await createProp(MP("platformer/coin-gold.glb"), 0.42);
  run.obsProtos = {};
  for (const f of world.obstacle) run.obsProtos[f] = await createProp(MP(f), 0.7);

  player.lane = 1; player.s = 0; player.z = 0; player.y = 0; player.vy = 0;
  player.laneShift = 0;
  player.jumping = false; player.sliding = false;
  syncPlayerPose();
  syncWorldFollowers();
  playAnim(player, "sprint");
  runScene.add(player.group);

  if (boss) {
    const b = BOSSES[wid - 1];
    bossActor = await createActor(MP(b.file), b.height, true);
    fixZeroNormals(bossActor.model);
    if (b.tint != null) tintActor(bossActor.model, b.tint);
    placeOnCourse(bossActor.model, 0, 0);
    runScene.add(bossActor.model);
    playAnim(bossActor, "sprint");
  }

  camera.position.set(0, 3.6, 7.4);
  camera.lookAt(0, 1.1, -4);
  appMode = "run";
  setupQuestion();
  updateHud();
  const title = lost ? "📚 ספריית המילים האבודות" : (boss ? "⚔️ " + BOSSES[wid - 1].name : stageLabel(wid - 1, st));
  const scene = lost ? "" : `<p class="scene-name">${esc(stageSceneName(wid, st))}</p>`;
  showUI("hud");
  $("btn-hint").classList.toggle("hidden", !(S.settings.hints && D.hints));
  const how = lost ? "" : `<p class="mode-how">${esc(MODE_DESC[worldMode(wid, S.settings)] || "")}</p>`;
  const lvl = `<p class="lvl-line">רמת קושי: <b>${esc(DIFFS[D.level].label)}</b> · ×${D.scoreMul} · ❤️ ${D.hearts} · ${D.options === 2 ? "2 תשובות" : "3 תשובות"}${boss ? "" : " · שלב " + (st + 1) + " מתוך 6"}</p>`;
  showModal(`<h2>${title}</h2>${scene}${how}<p>${boss ? "הבוס רץ מאחוריכם! ענו נכון כדי להחליש אותו!" : (st === 0 && !lost ? INTRO[wid - 1] : "כל שלב קשה יותר מהקודם. קדימה, אתם יכולים!")}</p>${lvl}
    <button class="btn g" id="mgo">יוצאים לדרך ▶</button>${opt && opt.quick ? `<p class="mgo-count" id="mgo-count"></p>` : ""}`);
  if (opt && opt.quick) {
    // v9: from «שחקו!» the run starts by itself after a short countdown (no extra click needed)
    let left = isListenMode(run.activeMode) ? 6 : 4;
    const tickDown = () => {
      const c = $("mgo-count"), b = $("mgo");
      if (!c || !b || appMode !== "run") return;
      if (left <= 0) { b.click(); return; }
      c.textContent = `מתחילים לבד בעוד ${left}…`;
      left--; setTimeout(tickDown, 1000);
    };
    tickDown();
  }
  $("mgo").onclick = () => {
    hideModal(); paused = false; playAnim(player, "sprint");
    if (run && isListenMode(run.activeMode)) sayCurrent(false);
    // v8b: re-validate the boss shader once the run's light/shadow setup is final (fixes a black jungle boss)
    const touchBoss = () => { if (bossActor && bossActor.model) bossActor.model.traverse((o) => { if (o.isMesh) [].concat(o.material || []).forEach((m) => { if (m) m.needsUpdate = true; }); }); };
    touchBoss(); setTimeout(touchBoss, 400);
  };
  return true;
}

async function ensurePlayer() {
  if (player && player.hero === S.hero) return;
  if (player && player.group.parent) player.group.parent.remove(player.group);
  const actor = await createActor(MP(HEROES[S.hero].file), 1.52, true, true);
  const group = new THREE.Group();
  group.add(actor.model);
  player = { ...actor, group, hero: S.hero, lane: 1, s: 0, z: 0, laneShift: 0, y: 0, vy: 0, jumping: false, sliding: false, slideT: 0, current: null };
}

/* ===== INPUT ===== */
function currentTurn(s) {
  if (!run || !run.course) return null;
  return run.course.turns.find((t) => s > t.sEnter - 4 && s < t.sExit + 1) || null;
}
function showTurnCue(t) {
  const el = $("turn-cue");
  if (!el) return;
  if (!t || t.committed) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.textContent = t.dir < 0 ? "⬅️ פנייה חדה שמאלה!" : "פנייה חדה ימינה! ➡️";
}
function missSharpTurn() {
  showTurnCue(null);
  if (!run || run.iFrames > 0) return;
  run.stumbleT = 0.7;
  run.iFrames = 1.2;
  shakeT = 0.28;
  sfx.bad();
  playAnim(player, "fall", 0.08, true);
  run.hearts--; run.wrong++; run.combo = 0;
  flashHearts(); updateHud();
  if (run.hearts <= 0) finishLevel(false);
}
function changeLane(dir) {
  if (!player || paused || appMode !== "run") return;
  const t = currentTurn(player.s);
  if (t && !t.committed && player.s < t.sApex + 1.4) {
    if (dir === t.dir) { t.committed = "ok"; showTurnCue(null); sfx.coin(); }
    else { t.committed = "miss"; missSharpTurn(); }
    return;
  }
  player.lane = Math.max(0, Math.min(2, player.lane + dir));
}
function jump() {
  if (!player || paused || appMode !== "run") return;
  if (player.jumping) { if (player.vy < 0 && player.y < 0.75) player.jumpQ = true; return; }
  player.jumping = true; player.vy = 11; player.sliding = false;
  playAnim(player, "jump", 0.08, true); sfx.jump();
}
function slide() {
  if (!player || paused || appMode !== "run" || player.jumping) return;
  player.sliding = true; player.slideT = 0.62;
  playAnim(player, "crouch", 0.08);
}
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); changeLane(-1); }
  else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); changeLane(1); }
  else if (e.key === "ArrowUp" || e.key === " " ) { e.preventDefault(); jump(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); slide(); }
  else if ((e.code === "KeyR" || e.key === "r" || e.key === "R" || e.key === "ר") && appMode === "run" && run && isListenMode(run.activeMode)) { e.preventDefault(); sayCurrent(false, true); }
  else if ((e.key === "Escape" || e.key === "p" || e.key === "P") && appMode === "run" && run && $("s-settings").classList.contains("hidden")) {
    e.preventDefault();
    if (!$("modal").classList.contains("hidden") && $("pause-box")) { $("p-resume").click(); }
    else if (!paused) openPause();
  }
  else if (e.key === "Enter" && !$("modal").classList.contains("hidden")) {
    const b = $("mgo") || $("modal-box").querySelector("button");
    if (b) b.click();
  }
});
let tx = 0, ty = 0;
canvas.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
canvas.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) changeLane(dx > 0 ? 1 : -1);
  else if (dy < -28) jump();
  else if (dy > 28) slide();
});

/* ===== LOOP ===== */
let last = performance.now();
/* v8 AUTO quality: measure real frame rate while running; drop one tier if it is too low */
const fpsMon = { n: 0, t: 0, fps: 0, winN: 0, winT: 0, runStart: 0, drops: 0 };
function monitorFps(raw) {
  if (raw <= 0 || raw > 0.5) return; // tab switch / first frame
  fpsMon.n++; fpsMon.t += raw;
  if (fpsMon.t >= 1) { fpsMon.fps = +(fpsMon.n / fpsMon.t).toFixed(1); fpsMon.n = 0; fpsMon.t = 0; }
  if (S.settings.gfx !== "auto" || appMode !== "run" || paused) { fpsMon.winN = 0; fpsMon.winT = 0; return; }
  if (performance.now() - fpsMon.runStart < 1500) return; // warm-up (shader compile, uploads)
  fpsMon.winN++; fpsMon.winT += raw;
  if (fpsMon.winT < 3) return;
  const fps = fpsMon.winN / fpsMon.winT;
  fpsMon.winN = 0; fpsMon.winT = 0;
  const t = tier();
  if (fps < 26 && t !== "low" && fpsMon.drops < 2) {
    autoTier = TIERS[TIERS.indexOf(t) - 1];
    autoReason = "נמדד קצב תמונות נמוך";
    S.autoTier = autoTier; save();
    fpsMon.drops++;
    fpsMon.runStart = performance.now();
    applyQuality();
  }
}
function tick(now) {
  if (innerWidth !== viewW || innerHeight !== viewH) fitView();
  requestAnimationFrame(tick);
  const raw = (now - last) / 1000 || 0;
  const dt = Math.min(0.05, raw); last = now;
  monitorFps(raw);
  if (appMode === "title" || appMode === "map" || appMode === "load") {
    camera.position.lerp(camGoal, 1 - Math.pow(0.012, dt * 60));
    camera.lookAt(lookGoal);
    mapMixers.forEach((m) => m.update(dt));
    titleHeroes.forEach((h, i) => {
      if (S.hero === i) h.model.rotation.y = Math.PI + Math.sin(now * 0.001) * 0.15;
    });
    islands.forEach((isle, i) => { isle.position.y = (i % 2 ? 0.4 : 0) + Math.sin(now * 0.001 + i) * 0.18; });
    updateKeyFx(dt);
    renderer.render(mapScene, camera);
    return;
  }
  if (appMode === "run" && player) {
    updateFlagWave(now * 0.001);
    if (!paused) updateRunner(dt);
    else if (player.mixer) player.mixer.update(dt);
    updateKeyFx(dt);
    if (!holdCam) updateRunCamera(dt);
    if (runSky) runSky.position.copy(camera.position);
    updateThemeFx(dt, now * 0.001);
    renderer.render(runScene, camera);
  }
}

const _camDir = new THREE.Vector3();
function updateThemeFx(dt, t) {
  fxTime.value = t;
  camera.getWorldDirection(_camDir);
  _camDir.y = 0;
  if (_camDir.lengthSq() < 1e-6) _camDir.set(0, 0, -1);
  _camDir.normalize();
  const ctx = { center: player ? player.group.position : camera.position, fwd: _camDir };
  if (themeAmb) {
    themeAmb.position.copy(camera.position);
    if (themeAmb.userData.update) themeAmb.userData.update(dt, t, ctx);
  }
  if (courseVisual && courseVisual.userData.update) courseVisual.userData.update(dt, t, ctx);
}
const _SUN_OFF = new THREE.Vector3(16, 24, 10);
function syncWorldFollowers() {
  if (!run || !run.course || !player) return;
  const f = pathFrame(run.course, player.s);
  if (runLights.fill) {
    runLights.fill.position.copy(player.group.position).addScaledVector(f.up, 2.5).addScaledVector(f.right, 1.05).addScaledVector(f.fwd, -1.2);
  }
  if (runLights.key) {
    runLights.key.position.copy(player.group.position).addScaledVector(f.up, 4.4).addScaledVector(f.fwd, -5.2).addScaledVector(f.right, 1.6);
    runLights.key.target.position.copy(player.group.position);
    runLights.key.target.updateMatrixWorld();
  }
  if (runLights.rim) {
    runLights.rim.position.copy(player.group.position).addScaledVector(f.up, 2.9).addScaledVector(f.right, -4.1).addScaledVector(f.fwd, 3.4);
    runLights.rim.target.position.copy(player.group.position);
    runLights.rim.target.updateMatrixWorld();
  }
  if (runLights.dir) {
    runLights.dir.position.copy(player.group.position).add(_SUN_OFF);
    runLights.dir.target.position.copy(player.group.position);
    runLights.dir.target.updateMatrixWorld();
  }
  if (runSunDisk) {
    runSunDisk.position.copy(f.pos).addScaledVector(f.fwd, 48).addScaledVector(f.up, 16).addScaledVector(f.right, 30);
  }
  if (runMist) {
    const onCauseway = f.kind === "causeway";
    runMist.visible = onCauseway;
    runMist.position.copy(f.pos).addScaledVector(f.up, -3.2).addScaledVector(f.fwd, 4);
  }
  if (runHills) runHills.position.set(f.x, 0, f.z);
  if (courseVisual) {
    if (courseVisual.userData._gnd === undefined) courseVisual.userData._gnd = courseVisual.getObjectByName("followGround") || null;
    const gnd = courseVisual.userData._gnd;
    if (gnd) {
      const gy = gnd.userData.y != null ? gnd.userData.y : -0.32;
      gnd.position.set(f.x, gy, f.z);
      gnd.visible = f.kind !== "causeway";
      if (sideMat && gnd.userData.y == null) gnd.material.color.copy(sideMat.color);
    }
  }
  if (runSky) runSky.position.copy(camera.position);
  if (themeAmb) {
    themeAmb.position.copy(camera.position);
    if (themeAmb.userData.far) themeAmb.userData.far.position.set(f.x, 0, f.z);
  }
  if (bossActor && run.boss) {
    const bs = Math.max(0, player.s - 3.4);
    const bf = pathFrame(run.course, bs);
    const sideOff = 1.7 + Math.sin(performance.now() * 0.002) * 0.2;
    bossActor.model.position.copy(worldOnPath(run.course, bs, sideOff, 0));
    bossActor.model.rotation.order = "YXZ";
    bossActor.model.rotation.y = -bf.heading;
    bossActor.model.rotation.x = bf.pitch || 0;
  }
}
function updateRunner(dt) {
  run.playSec = (run.playSec || 0) + dt;
  const world = WORLDS[run.world - 1];
  let base = (run.layout && run.layout.speed) || 8.2;
  if (run.activeMode === "build" && run.layout && run.layout.diff) base *= run.layout.diff.letterSpeed || 1;
  const cap = (run.layout && run.layout.diff && run.layout.diff.comboCap != null) ? run.layout.diff.comboCap : 0.42;
  let speed = base * (1 + Math.min(run.activeMode === "build" ? Math.min(0.15, cap) : cap, run.combo * 0.028));
  if (run.stumbleT > 0) { run.stumbleT -= dt; speed *= 0.4; }
  if (run.iFrames > 0) run.iFrames -= dt;
  player.s = (player.s || 0) + speed * dt;
  player.z = -player.s;
  const want = laneXs()[player.lane];
  player.laneShift = (player.laneShift == null ? want : player.laneShift);
  player.laneShift += (want - player.laneShift) * Math.min(1, dt * 11);
  if (player.jumping) {
    player.vy += -20 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0; player.vy = 0; player.jumping = false; if (player.jumpQ) { player.jumpQ = false; jump(); }
      playAnim(player, player.sliding ? "crouch" : "sprint");
    }
  }
  if (player.sliding) {
    player.slideT -= dt;
    if (player.slideT <= 0) { player.sliding = false; if (!player.jumping) playAnim(player, "sprint"); }
  }
  syncPlayerPose();
  if (player.s > run.course.length - 30) { // safety: never run off the end of the track
    return finishLevel(run.boss ? run.bossHP <= 0 : run.i >= Math.ceil(run.queue.length / 2));
  }
  const turn = currentTurn(player.s);
  showTurnCue(turn && !turn.committed ? turn : null);
  updateTrackBar();
  updateFinishCue();
  if (turn && !turn.committed && player.s > turn.sApex) {
    turn.committed = "miss";
    missSharpTurn();
  }
  if (player.mixer) player.mixer.update(dt);
  if (player.current === "fall" && run.stumbleT <= 0 && !player.jumping) playAnim(player, "sprint");
  emitTrail(dt);
  for (const gt of gates) {
    if (gt.resolved || !gt.group) continue;
    if (gt.glow === undefined) gt.glow = gt.group.getObjectByName("gateGlow") || null;
    const glow = gt.glow;
    if (glow) glow.material.opacity = 0.11 + Math.sin(performance.now() * 0.006) * 0.09;
    const bob = 2.32 + Math.sin(performance.now() * 0.005) * 0.06;
    const ch = gt.group.children;
    for (let k = 0; k < ch.length; k++) if (ch[k].name === "laneSign") ch[k].position.y = bob;
  }

  const now = performance.now();
  if (bossActor && bossActor.mixer) bossActor.mixer.update(dt);
  syncWorldFollowers();

  layoutPathFromCourse();
  decors.forEach((d) => {
    if (d.userData.pathS != null && player.s - d.userData.pathS > 16) {
      d.userData.pathS += 220;
    }
    placeDecor(d);
  });

  if (player.s > run.nextCoinS) {
    spawnCoinRow(player.s + 16);
    run.nextCoinS += 5 + Math.random() * 4;
  }
  if (player.s > run.nextObsS) {
    spawnObstacle(player.s + Math.max(20, base * 1.9));
    run.nextObsS += ((run.layout && run.layout.diff && run.layout.diff.spacing) || 10.5) + Math.random() * 4;
  }

  for (const c of coins) {
    if (c.taken) continue;
    c.mesh.rotation.z += dt * 3;
    if ((c.s != null ? c.s : 0) < player.s - 4) { c.taken = true; runScene.remove(c.mesh); continue; }
    if (Math.abs((c.s || 0) - player.s) < 0.6 && c.lane === playerLaneNow() && player.y < 1.2) {
      c.taken = true; runScene.remove(c.mesh);
      S.coins += 1; run.coins += 1; run.score += Math.round(10 * scoreMul()); sfx.coin(); updateHud();
    }
  }
  for (const o of obstacles) {
    if (o.hit) continue;
    if (o.spin) o.mesh.rotation.x += dt * o.spin;
    if ((o.s != null ? o.s : 0) < player.s - 4) { o.hit = true; disposeDeep(o.mesh); continue; }
    if (o.type === "animal") animateAnimal(o, dt);
    if (Math.abs((o.s || 0) - player.s) < 0.7 && o.lane === playerLaneNow()) {
      if ((o.type === "low" || o.type === "hole" || o.type === "roll" || o.type === "animal") && player.y > 0.28) continue;
      if (o.type === "wall" && player.y > 1.3) continue;
      if (o.type === "beam" && (player.sliding || player.y > 1.45)) continue;
      hitObstacle(o);
    }
  }
  for (const g of gates) {
    if (!g.resolved && player.s > (g.s != null ? g.s : -g.group.position.z) - 0.45) resolveGate(g);
    if (g.resolved && g.group.parent && (g.s != null ? g.s : 0) < player.s - 8) disposeObj(g.group);
  }
  if (run.activeMode === "build") {
    for (const L of letters) {
      if (L.taken) continue;
      if ((L.s != null ? L.s : 0) < player.s - 4) continue;
      const pr = (run.layout && run.layout.diff && run.layout.diff.letterReach) || 1.1;
      if (L.index === run.spell.idx && Math.abs((L.s || 0) - player.s) < pr && L.lane === playerLaneNow()) {
        L.taken = true; runScene.remove(L.mesh);
        const need = run.spell.rest[run.spell.idx];
        if (L.ch === need) {
          // take the whole row away so the other two letters can't be hit by accident
          letters.forEach((o) => { if (o.index === L.index && !o.taken) { o.taken = true; runScene.remove(o.mesh); } });
          run.spell.idx++; sfx.coin(); burst(L.mesh.position, 0x4ecdc4);
          if (run.spell.idx >= run.spell.rest.length) onCorrect();
          else updateSpellHud();
        } else if (run.layout && run.layout.diff && run.layout.diff.letterForgive) {
          // gentle mode (EASY / early worlds): wrong letter costs points, not a heart; the row comes again
          run.wrongHere = true; run.combo = 0;
          record(run.cur, false, run.hint, true);
          sfx.bad(); shakeT = 0.2;
          clearLetters();
          spawnLetterWord(run.cur, run.spell.idx);
          $("prompt-sub").textContent = "זו לא האות " + need + " — נסו שוב";
          popEl("prompt"); updateHud();
        } else {
          run.activeMode = "wait";
          onWrong();
        }
        break;
      }
    }
    // passed the current row without collecting its letter
    const row = run.activeMode === "build" && run.spell.rows ? run.spell.rows[run.spell.idx] : null;
    if (row != null && player.s > row + 1.6) {
      const D = run.layout && run.layout.diff;
      if (D && D.letterForgive) {
        run.wrongHere = true;
        const ch = run.spell.rest[run.spell.idx];
        clearLetters();
        sfx.bad();
        spawnLetterWord(run.cur, run.spell.idx);
        $("prompt-sub").textContent = "פספסתם את האות " + ch + " — היא מגיעה שוב";
        popEl("prompt");
      } else {
        run.activeMode = "wait";
        onWrong();
      }
    }
  }
  if (coins.length > 40) { for (let k = coins.length - 1; k >= 0; k--) if (coins[k].taken) coins.splice(k, 1); }
  if (obstacles.length > 40) { for (let k = obstacles.length - 1; k >= 0; k--) if (obstacles[k].hit) obstacles.splice(k, 1); }
  if (gates.length > 6) { for (let k = gates.length - 1; k >= 0; k--) if (gates[k].resolved && !gates[k].group.parent) gates.splice(k, 1); }
  updateParticles(dt);
}

function updateRunCamera(dt) {
  if (!player || !run || !run.course) return;
  const f = pathFrame(run.course, player.s);
  let glance = 0;
  if (run.forceGlance) glance = 1;
  else if (run.boss) {
    run.glanceT = (run.glanceT || 0) + dt;
    const w = Math.sin(run.glanceT * 0.48);
    glance = w > 0.58 ? (w - 0.58) / 0.42 : 0;
  }
  let sx = 0, sy = 0;
  if (shakeT > 0) { shakeT -= dt; sx = (Math.random() - 0.5) * 0.25; sy = (Math.random() - 0.5) * 0.18; }
  const bossBias = run.boss ? -2.05 : 0;
  const back = f.pos.clone()
    .addScaledVector(f.fwd, run.boss ? -8.6 : -7.7)
    .addScaledVector(f.up, 3.7 + player.y * 0.25 + sy)
    .addScaledVector(f.right, (player.laneShift || 0) * 0.42 + sx + bossBias);
  const side = f.pos.clone()
    .addScaledVector(f.right, -4.4)
    .addScaledVector(f.fwd, -8.4)
    .addScaledVector(f.up, 3.25);
  const ideal = back.lerp(side, glance);
  const look = f.pos.clone()
    .addScaledVector(f.fwd, 4.6)
    .addScaledVector(f.up, 1.15 + player.y)
    .addScaledVector(f.right, glance * 0.8);
  if (glance > 0.15 && bossActor) {
    const bp = bossActor.model.position.clone();
    bp.y += 1.2;
    look.lerp(bp, glance * 0.22);
  }
  camera.position.lerp(ideal, 1 - Math.pow(0.0008, dt));
  camera.lookAt(look);
}

/* ===== HINT / MENUS ===== */
function openHint() {
  if (!run || !run.cur) return;
  if (run.layout && run.layout.diff && run.layout.diff.hints === false) return; // v9: no hints on HARD
  grantAch("hint");
  paused = true;
  helpCard(Math.max(run.hint, 1) || 1);
}
function helpCard(l) {
  const w = run.cur, e = w.en.toUpperCase();
  const D = (run.layout && run.layout.diff) || {};
  const listen = isListenMode(run.activeMode);
  // v9 listening: hint 1 = hear it again slowly (no text). Letters / answer only on EASY after a miss.
  const maxL = listen ? ((D.reveal && run.wrongHere) ? 3 : 1) : 3;
  l = Math.min(l, maxL);
  run.hint = Math.max(run.hint, l);
  let body;
  if (listen && l === 1) {
    body = `<div style="font-size:64px">🎧</div><p>הקשיבו שוב – הפעם לאט יותר.</p><button class="btn s" id="hsay">🔊 שמעו שוב לאט</button>`;
    sayCurrent(true, true);
  } else if (l === 1) body = `<div style="font-size:64px">${w.pic}</div><p>${esc(w.clue)}</p>`;
  else if (l === 2) {
    const sp = e.split("").map((c, i) => (i === 0 || i === e.length - 1) ? c : (i % 2 ? "_" : c)).join(" ");
    body = `<p>${e.replace(/ /g, "").length} אותיות. האות הראשונה: <b class="en">${esc(e[0])}</b></p><div class="en" style="font-size:36px;font-weight:800">${esc(sp)}</div>`;
  } else {
    body = `<p>התשובה:</p><div class="en" style="font-size:42px;font-weight:800">${esc(w.en)}</div><p>${w.pic} ${esc(w.he)}</p>
      <button class="btn s" id="hsay">🔊 שמעו איך אומרים</button>`;
    say(w.en);
  }
  showModal(`<h2>🦉 הינשוף החכם (רמז ${l}/3)</h2>${body}
    <div class="row" style="margin-top:10px">
      <button class="btn g" id="hback">חוזרים לריצה</button>
      ${l < maxL ? `<button class="btn s" id="hmore">עוד רמז</button>` : ""}
    </div>`);
  $("hback").onclick = () => { hideModal(); paused = false; };
  const more = $("hmore"); if (more) more.onclick = () => helpCard(l + 1);
  const hs = $("hsay"); if (hs) hs.onclick = () => (listen && l === 1 ? sayCurrent(true, true) : say(w.en, 0, true));
}

function goMapMode() {
  paused = true; appMode = "map";
  hideModal(); showUI("s-map");
  refreshMapStats(); renderStages(); highlightIsland(); refreshLocks();
  if (pendingUnlock != null) {
    const idx = pendingUnlock;
    pendingUnlock = null;
    playIslandUnlock(idx);
  } else {
    focusMapCam();
  }
}
function goTitle() {
  paused = true; appMode = "title";
  showUI("s-title"); highlightHero(); focusTitleCam(); refreshPlayNext(); refreshPlayerChip();
}
/* v9 one-click start: the next stage that is open and not finished yet (World 1 · Stage 1 for new players) */
function nextStage() {
  for (let i = 0; i < WORLDS.length; i++) {
    if (!wOpen(i)) break;
    for (let k = 0; k < NSTAGES; k++) if (sOpen(i, k) && !stDone(WORLDS[i].id, k)) return { wid: WORLDS[i].id, st: k };
  }
  // everything open is done: replay the last open world's boss
  let last = 0;
  for (let i = 0; i < WORLDS.length; i++) if (wOpen(i)) last = i;
  return { wid: WORLDS[last].id, st: BOSS_ST };
}
function refreshPlayNext() {
  const el = $("play-next");
  if (!el) return;
  const n = nextStage(), w = WORLDS[n.wid - 1];
  const fresh = !Object.keys(S.prog || {}).length;
  el.textContent = (fresh ? "מתחילים: " : "ממשיכים: ") + `${w.icon} ${w.name} · ${n.st === BOSS_ST ? "בוס" : "שלב " + (n.st + 1)} · ${worldTypeLabel(n.wid - 1)}`;
}
function playNow() {
  sfx.click();
  if (!(window.Englishia && Englishia.getName())) {
    askPlayerName(() => playNow());
    return;
  }
  const n = nextStage();
  selectedWorld = n.wid - 1;
  startLevel(n.wid, n.st, false, { quick: true });
}


/* v11.1: persistent top-right Englishia account button */
function accountUser() {
  try { if (window.EnglishiaAuth) return EnglishiaAuth.user || null; } catch (e) {}
  return null;
}
function closeAccountMenu() {
  const m = $("mq-account-menu");
  const b = $("mq-account-btn");
  if (m) { m.classList.add("hidden"); m.setAttribute("hidden", ""); m.innerHTML = ""; }
  if (b) b.setAttribute("aria-expanded", "false");
}
function accSet(id, text) { const el = $(id); if (el) el.textContent = text; }
function fillAccountMenu(u) {
  const menu = $("mq-account-menu");
  if (!menu || !u) return;
  const local = (window.Englishia && Englishia.getProfile && Englishia.getProfile()) || {};
  const g = (local.games && local.games[GAME_ID]) || {};
  const gameScore = g.totalScore || g.best || 0;
  const gameTime = formatPlayTime(g.seconds || 0);
  const platScore = local.totalScore || 0;
  const platTime = formatPlayTime(local.totalSeconds || 0);
  menu.innerHTML = `<div class="mq-acc-head"><span class="ico-user" aria-hidden="true"></span><span class="mq-acc-name">${esc(u.displayName || u.username || "")}</span></div>
    <div class="mq-acc-stats" id="mq-account-game-stats">
      <h3>הפרופיל שלי · מילה קווסט</h3>
      <p>ניקוד: <b id="mq-acc-game-score">${gameScore}</b></p>
      <p>זמן משחק: <b id="mq-acc-game-time">${esc(gameTime)}</b></p>
    </div>
    <div class="mq-acc-stats" id="mq-account-eng-stats">
      <h3>סיכום אינגלישיה</h3>
      <p>ניקוד בכל המשחקים: <b id="mq-acc-eng-score">${platScore}</b></p>
      <p>זמן כולל: <b id="mq-acc-eng-time">${esc(platTime)}</b></p>
    </div>
    <div class="mq-acc-actions">
      <button type="button" class="btn s" id="mq-account-profile" role="menuitem">הפרופיל שלי</button>
      <button type="button" class="btn s" id="mq-account-summary" role="menuitem">סיכום אינגלישיה</button>
      ${u.isAdmin ? '<button type="button" class="btn s p" id="mq-account-admin" role="menuitem">ניהול</button>' : ""}
      <button type="button" class="btn s mq-acc-out" id="mq-account-logout" role="menuitem">התנתקות</button>
    </div>`;
  if ($("mq-account-profile")) $("mq-account-profile").onclick = () => { closeAccountMenu(); if (window.EnglishiaAuth) EnglishiaAuth.openProfile(GAME_ID); };
  if ($("mq-account-summary")) $("mq-account-summary").onclick = () => { closeAccountMenu(); if (window.EnglishiaAuth) EnglishiaAuth.openProfile(); };
  if ($("mq-account-admin")) $("mq-account-admin").onclick = () => { closeAccountMenu(); if (window.EnglishiaAuth) EnglishiaAuth.openAdmin(); };
  if ($("mq-account-logout")) $("mq-account-logout").onclick = () => {
    closeAccountMenu();
    if (window.EnglishiaAuth) EnglishiaAuth.logout().then(() => { location.reload(); }).catch(() => { location.reload(); });
  };
  if (window.EnglishiaAuth) {
    EnglishiaAuth.getGameProfile(GAME_ID).then((gp) => {
      if (!gp || $("mq-account-menu").classList.contains("hidden")) return;
      accSet("mq-acc-game-score", String(gp.totalScore || gp.best || 0));
      accSet("mq-acc-game-time", formatPlayTime(gp.seconds || 0));
    }).catch(() => {});
    EnglishiaAuth.getPlatformProfile().then((pp) => {
      if (!pp || $("mq-account-menu").classList.contains("hidden")) return;
      accSet("mq-acc-eng-score", String(pp.totalScore || 0));
      accSet("mq-acc-eng-time", formatPlayTime(pp.totalSeconds || 0));
    }).catch(() => {});
  }
}
function toggleAccountMenu() {
  const u = accountUser();
  const menu = $("mq-account-menu");
  const btn = $("mq-account-btn");
  if (!u) {
    closeAccountMenu();
    if (window.EnglishiaAuth && EnglishiaAuth.openLogin) EnglishiaAuth.openLogin();
    else openProfilePicker();
    return;
  }
  const willOpen = menu && menu.classList.contains("hidden");
  if (willOpen) {
    fillAccountMenu(u);
    menu.classList.remove("hidden");
    menu.removeAttribute("hidden");
    if (btn) btn.setAttribute("aria-expanded", "true");
  } else closeAccountMenu();
}
function refreshAccountButton() {
  const btn = $("mq-account-btn");
  const nameEl = $("mq-account-label");
  if (!btn || !nameEl) return;
  const u = accountUser();
  btn.classList.toggle("signed", !!u);
  if (u) {
    const nm = u.displayName || u.username || "החשבון שלי";
    nameEl.textContent = nm;
    btn.setAttribute("aria-label", "החשבון של " + nm);
    btn.setAttribute("aria-haspopup", "true");
  } else {
    nameEl.textContent = "התחברות";
    btn.setAttribute("aria-label", "התחברות לאינגלישיה");
    btn.setAttribute("aria-haspopup", "dialog");
    closeAccountMenu();
  }
}
function initAccountButton() {
  const btn = $("mq-account-btn");
  if (!btn || btn.dataset.ready) return;
  btn.dataset.ready = "1";
  btn.onclick = () => { try { sfx.click(); } catch (e) {} toggleAccountMenu(); };
  document.addEventListener("click", (e) => {
    const wrap = $("mq-account");
    if (wrap && !wrap.contains(e.target)) closeAccountMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAccountMenu(); });
  if (window.EnglishiaAuth && EnglishiaAuth.onChange) {
    EnglishiaAuth.onChange(() => { refreshAccountButton(); });
    if (EnglishiaAuth.ready) EnglishiaAuth.ready().then(() => refreshAccountButton()).catch(() => {});
  }
  refreshAccountButton();
}

function refreshPlayerChip() {
  const chip = $("player-chip");
  const el = $("player-chip-name");
  if (!chip || !el) return;
  const name = window.Englishia ? Englishia.getName() : "";
  if (name) {
    el.textContent = "שלום, " + name + "!";
    chip.classList.remove("hidden");
  } else if (window.Englishia && Englishia.listProfiles().length) {
    el.textContent = "בחרו פרופיל";
    chip.classList.remove("hidden");
  } else {
    el.textContent = "";
    chip.classList.add("hidden");
  }
}
function applyProfileState() {
  muted = !!S.muted;
  if ($("mute")) $("mute").textContent = muted ? "🔇" : "🔊";
  if ($("btn-hud-mute")) $("btn-hud-mute").textContent = muted ? "🔇" : "🔊";
  refreshPlayerChip();
  refreshAccountButton();
  refreshPlayNext();
  drawHeroBtns();
  highlightHero();
  if (appMode === "map") {
    refreshMapStats(); renderStages(); refreshLocks(); highlightIsland();
  }
}
function switchToProfile(id) {
  if (!window.Englishia) return;
  save();
  if (!Englishia.switchProfile(id)) return;
  const p = Englishia.getProgress(GAME_ID);
  applyProgressData(p || {});
  save();
  applyProfileState();
  ensurePlayer().catch(() => {});
}
function createNewProfile(name) {
  if (!window.Englishia) return "";
  save();
  const first = Englishia.listProfiles().length === 0;
  const id = Englishia.createProfile(name);
  if (!id) return "";
  if (!first) applyProgressData({});
  Englishia.setProgress(GAME_ID, progressFields(S));
  save();
  applyProfileState();
  ensurePlayer().catch(() => {});
  return id;
}
function deleteAndRefresh(id) {
  if (!window.Englishia) return;
  save();
  Englishia.deleteProfile(id);
  const name = Englishia.getName();
  if (name) {
    const p = Englishia.getProgress(GAME_ID);
    applyProgressData(p || {});
  } else {
    applyProgressData({});
  }
  save();
  applyProfileState();
  ensurePlayer().catch(() => {});
}
function askPlayerName(onOk, opts) {
  opts = opts || {};
  const back = !!opts.backToPicker;
  showModal(`<h2>מה השם שלך?</h2>
    <input id="player-name-in" maxlength="20" autocomplete="nickname" dir="rtl" placeholder="השם שלי">
    <p class="name-err hidden" id="name-err">צריך לכתוב שם</p>
    <div class="row" style="margin-top:12px">
      <button class="btn g" id="btn-name-save">שמירה</button>
      ${back ? '<button class="btn s" id="btn-name-back">חזרה</button>' : ""}
    </div>
    ${window.EnglishiaAuth ? '<p class="note" style="margin-top:14px">יש לכם חשבון באינגלישיה? כך ההתקדמות נשמרת בכל מחשב.</p><button class="btn" id="btn-name-login">👤 כניסה או הרשמה לאינגלישיה</button>' : ""}`);
  const inp = $("player-name-in");
  const err = $("name-err");
  const go = () => {
    const n = (inp.value || "").replace(/\s+/g, " ").trim();
    if (!n) { err.classList.remove("hidden"); inp.focus(); return; }
    err.classList.add("hidden");
    if (createNewProfile(n)) {
      hideModal();
      if (onOk) onOk();
    } else {
      err.textContent = "לא ניתן להוסיף עוד פרופילים במכשיר הזה";
      err.classList.remove("hidden");
    }
  };
  $("btn-name-save").onclick = go;
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  if ($("btn-name-back")) $("btn-name-back").onclick = () => openProfilePicker();
  if ($("btn-name-login")) $("btn-name-login").onclick = () => { hideModal(); window.EnglishiaAuth.openLogin(); };
  setTimeout(() => inp.focus(), 50);
}
function profileSummary(p) {
  const g = (p.games && p.games[GAME_ID]) || {};
  const parts = [];
  if (g.stars) parts.push("⭐ " + g.stars);
  if (g.stages) parts.push(g.stages + " שלבים");
  if (p.totalScore) parts.push("ניקוד " + p.totalScore);
  return parts.join(" · ") || "שחקן חדש";
}
function openProfilePicker() {
  if (!window.Englishia) return;
  const list = Englishia.listProfiles();
  const aid = Englishia.getActiveId();
  if (!list.length) { askPlayerName(); return; }
  const rows = list.map((p) => `<div class="profile-row">
      <button type="button" class="btn profile-pick ${p.id === aid ? "sel" : ""}" data-id="${esc(p.id)}">
        <b>${esc(p.name)}</b><small>${esc(profileSummary(p))}</small>
      </button>
      <button type="button" class="btn s profile-del" data-del="${esc(p.id)}" aria-label="מחיקת ${esc(p.name)}">✖</button>
    </div>`).join("");
  showModal(`<h2>החלפת פרופיל</h2>
    <div class="profile-list">${rows}</div>
    <div class="row">
      <button class="btn g" id="btn-new-profile">+ פרופיל חדש</button>
      <button class="btn s" id="btn-picker-close">סגירה</button>
    </div>`);
  $("btn-new-profile").onclick = () => askPlayerName(null, { backToPicker: true });
  $("btn-picker-close").onclick = hideModal;
  $("modal-box").querySelectorAll("[data-id]").forEach((b) => {
    b.onclick = () => { switchToProfile(b.getAttribute("data-id")); hideModal(); sfx.click(); };
  });
  $("modal-box").querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => confirmDeleteProfile(b.getAttribute("data-del"));
  });
}
function confirmDeleteProfile(id) {
  const p = (window.Englishia ? Englishia.listProfiles() : []).find((x) => x.id === id);
  if (!p) return;
  showModal(`<h2>למחוק את הפרופיל?</h2>
    <p>יימחקו כל ההתקדמות והניקוד של <b>${esc(p.name)}</b> במכשיר הזה.</p>
    <div class="row" style="margin-top:12px">
      <button class="btn" id="btn-del-yes" style="background:#e8553d;color:#fff;box-shadow:0 6px 0 #8a2a18">מחיקה</button>
      <button class="btn" id="btn-del-no">ביטול</button>
    </div>`);
  $("btn-del-no").onclick = () => openProfilePicker();
  $("btn-del-yes").onclick = () => { deleteAndRefresh(id); hideModal(); sfx.click(); };
}
function openProfilePanel() {
  if (!window.Englishia) return;
  if (!Englishia.getName()) { askPlayerName(() => openProfilePanel()); return; }
  const p = Englishia.getProfile();
  const g = (p.games && p.games[GAME_ID]) || { best: 0, plays: 0, totalScore: 0, seconds: 0 };
  const lb = Englishia.getLeaderboard(GAME_ID);
  const rows = lb.length ? lb.map((e, i) => {
    const rank = i === 0 ? `<span class="ico-gold" aria-label="מקום ראשון">1</span>` : (i + 1);
    return `<tr class="${i === 0 ? "rank1" : ""}"><td>${rank}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${esc(formatLbDate(e.date))}</td></tr>`;
  }).join("") : `<tr><td colspan="4">עדיין אין שיאים במכשיר הזה</td></tr>`;
  showModal(`<h2>פרופיל</h2>
    <p class="player-hello">שלום, ${esc(p.name)}!</p>
    <div class="profile-stats">
      <p>ניקוד כולל: <b>${p.totalScore}</b></p>
      <p>זמן משחק כולל: <b>${formatPlayTime(p.totalSeconds)}</b></p>
      <h3 style="margin:12px 0 4px">מילה קווסט</h3>
      <p>שיא: <b>${g.best || 0}</b> · משחקים: <b>${g.plays || 0}</b></p>
    </div>
    <h3 style="margin:14px 0 4px">טבלת שיאים</h3>
    <table class="lb-table"><tr><th>#</th><th>שם</th><th>ניקוד</th><th>תאריך</th></tr>${rows}</table>
    <p class="profile-note">כרגע הנתונים נשמרים רק במכשיר הזה</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="btn-profile-close">סגירה</button></div>`);
  $("btn-profile-close").onclick = hideModal;
}

function drawHeroBtns() {
  $("hero-btns").innerHTML = HEROES.map((h, i) =>
    `<button class="hero-btn ${S.hero === i ? "sel" : ""}" data-h="${i}">${esc(h.name)}</button>`).join("");
}
$("hero-btns").onclick = (e) => {
  const b = e.target.closest("[data-h]");
  if (!b) return;
  S.hero = +b.dataset.h; save(); highlightHero(); drawHeroBtns(); sfx.click();
};
$("btn-start").onclick = () => goMapMode();
$("btn-play").onclick = () => playNow();
if ($("btn-profiles")) $("btn-profiles").onclick = () => { sfx.click(); openProfilePicker(); };
initAccountButton();
if ($("btn-profile")) $("btn-profile").onclick = () => { sfx.click(); openProfilePanel(); };
$("btn-title-settings").onclick = () => { sfx.click(); openSettings(); };
$("btn-help").onclick = () => { showUI("s-help"); appMode = "title"; };
$("btn-help-back").onclick = () => goTitle();
initSettingsUI();
$("btn-map-back").onclick = () => goTitle();
$("btn-hud-map").onclick = () => { if (confirm("לחזור למפה? ההתקדמות בשלב הזה לא תישמר.")) goMapMode(); };
$("btn-hint").onclick = openHint;
$("btn-journey").onclick = openJourney;
$("btn-library").onclick = () => { grantAch("library"); startLevel(1, 0, true); };
$("btn-review").onclick = () => {
  const hard = nbs().filter((x) => !x.n.learned);
  if (hard.length < 2) {
    showModal(`<h2>✨ כל הכבוד!</h2><p>אין כרגע מילים לתרגול.</p><button class="btn" id="mgo">סגור</button>`);
    $("mgo").onclick = hideModal;
  } else startLevel(1, 0, true);
};

function openNotebook() {
  const r = nbs();
  appMode = "map";
  showUI("s-nb");
  $("s-nb").innerHTML = `<div class="glass" style="padding:16px;max-width:860px;max-height:70vh;overflow:auto">
    <h2>📒 מחברת המילים שלי</h2>
    ${r.length ? `<table><tr><th>עברית</th><th>English</th><th></th><th>טעיתי</th><th>הצלחתי</th><th>סטטוס</th></tr>
      ${r.map(({ w, n }) => `<tr><td>${esc(w.he)}</td><td class="en"><b>${esc(w.en)}</b></td><td>${w.pic}</td><td>${n.wrong || 0}</td><td>${n.right || 0}</td><td>${n.learned ? "✅" : "🔁"}</td></tr>`).join("")}
    </table>` : "<p>עדיין ריק.</p>"}
  </div><button class="btn" id="nbback" style="margin-top:10px">חזרה למפה</button>`;
  $("nbback").onclick = goMapMode;
}
function openJourney() {
  const ln = learnedCount(), pr = nbs().filter((x) => !x.n.learned).length;
  const achHtml = ACH.map((a) => `<span class="pill" style="margin:3px;opacity:${S.ach.includes(a.id) ? 1 : .45}">${S.ach.includes(a.id) ? "🏅" : "▫️"} ${esc(a.name)}</span>`).join("");
  showUI("s-jr"); appMode = "map";
  $("s-jr").innerHTML = `<div class="glass" style="padding:18px;max-width:640px">
    <h2>🌍 המסע שלי</h2>
    <p>מילים שנלמדו: <b>${ln}</b> מתוך ${activeWords().length}</p>
    <div class="bar"><i style="width:${ln / activeWords().length * 100}%"></i></div>
    <p>לתרגול: <b>${pr}</b> · עולמות: <b>${worldsDone()}</b>/${WORLDS.length} · שלבים: ${Object.keys(S.prog).length}/${WORLDS.length * NSTAGES}</p>
    <p>${coinHtml(S.coins)} · ⭐ ${starSum()}</p>
    <div class="row">${achHtml}</div>
  </div>
  <div class="row" style="margin-top:10px">
    <button class="btn" id="jrback">חזרה למפה</button>
    <button class="btn s" id="jreset">איפוס</button>
    <button class="btn s" id="jnb">📒 מחברת</button>
  </div>`;
  $("jrback").onclick = goMapMode;
  $("jnb").onclick = openNotebook;
  $("jreset").onclick = () => {
    if (!confirm("למחוק את כל ההתקדמות?")) return;
    const hero = S.hero, settings = S.settings; S = def(); S.hero = hero; S.settings = settings; save(); goTitle();
  };
  bindTeacherUnlock($("s-jr").querySelector("h2"));
}
function bindTeacherUnlock(el) {
  if (!el) return;
  let timer = null;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener("pointerdown", () => { clear(); timer = setTimeout(askTeacherPin, 1500); });
  el.addEventListener("pointerup", clear);
  el.addEventListener("pointerleave", clear);
}
function askTeacherPin() {
  showModal(`<h2>👩‍🏫 כניסת מורה</h2><p>הזינו את הקוד</p>
    <input id="tpin" type="password" inputmode="numeric" maxlength="8" style="font-size:28px;padding:8px;text-align:center;width:180px;border-radius:12px;border:3px solid #8a5a2b">
    <div class="row" style="margin-top:10px"><button class="btn" id="mgo">אישור</button></div>`);
  const go = () => {
    if (($("tpin").value || "").trim() === "3141") {
      hideModal();
      showModal(`<h2>מצב מורה</h2><p>פתיחת כל העולמות לתרגול חופשי.</p>
        <div class="row"><button class="btn g" id="jfree">${S.free ? "לנעול בחזרה לפי המפתחות" : "לפתוח את כל העולמות"}</button>
        <button class="btn" id="mgo">סגור</button></div>`);
      $("jfree").onclick = () => { S.free = !S.free; save(); refreshLocks(); renderStages(); hideModal(); openJourney(); };
      $("mgo").onclick = hideModal;
    } else {
      $("tpin").style.outline = "3px solid #e8553d";
    }
  };
  $("mgo").onclick = go;
  $("tpin").onkeydown = (e) => { if (e.key === "Enter") go(); };
  setTimeout(() => { try { $("tpin").focus(); } catch (e) {} }, 50);
}

function fillDevGrid() {
  const grid = $("dev-grid");
  if (!grid) return;
  grid.innerHTML = WORLDS.map((w, i) => {
    const stages = ST[i].map((t, k) => {
      const locked = !sOpen(i, k);
      const label = (k === BOSS_ST ? "⚔️ " : "") + stageLabel(i, k) + (k === BOSS_ST ? " (בוס)" : "") + " · " + stageSceneName(w.id, k);
      const extra = locked ? " 🔒" : "";
      return `<button class="btn s${k === BOSS_ST ? " boss" : ""}" data-dev-w="${w.id}" data-dev-st="${k}">${esc(label)}${extra}</button>`;
    }).join("");
    return `<div class="dev-world"><h3>${w.icon} ${esc(w.name)}</h3><div class="dev-stages">${stages}</div></div>`;
  }).join("");
}
function openDevPanel() {
  if (!isDev()) return false;
  fillDevGrid();
  const box = $("dev-unlock-all");
  if (box) box.checked = !!S.free;
  if ($("dev-panel")) $("dev-panel").classList.remove("hidden");
  return true;
}
function hideDevPanel() {
  if ($("dev-panel")) $("dev-panel").classList.add("hidden");
}
function initDevTools() {
  const btn = $("btn-dev");
  if (!btn || !isDev()) {
    if (btn) btn.classList.add("hidden");
    return;
  }
  btn.onclick = () => openDevPanel();
  const close = $("btn-dev-close");
  if (close) close.onclick = hideDevPanel;
  const grid = $("dev-grid");
  if (grid) {
    grid.onclick = (e) => {
      const b = e.target.closest("[data-dev-w]");
      if (!b) return;
      hideDevPanel();
      startLevel(+b.dataset.devW, +b.dataset.devSt, false, { bypassLock: true });
    };
  }
  const unlock = $("dev-unlock-all");
  if (unlock) {
    unlock.checked = !!S.free;
    unlock.onchange = () => {
      S.free = !!unlock.checked;
      save();
      refreshLocks();
      renderStages();
      fillDevGrid();
    };
  }
  const rst = $("btn-dev-reset");
  if (rst) {
    rst.onclick = () => {
      if (!confirm("לאפס את כל ההתקדמות השמורה? הפעולה הזו נשמרת.")) return;
      const hero = S.hero, quality = S.quality, wasMuted = S.muted, settings = S.settings, at = S.autoTier;
      S = def();
      S.hero = hero;
      S.quality = quality;
      S.muted = wasMuted;
      S.settings = settings;
      S.autoTier = at;
      save();
      refreshLocks();
      renderStages();
      refreshMapStats();
      drawHeroBtns();
      highlightHero();
      if (unlock) unlock.checked = false;
      fillDevGrid();
    };
  }
}

/* ===== SETTINGS + PAUSE (v8) ===== */
const TIER_HE = { low: "נמוכה (פיקסלים)", medium: "בינונית", high: "גבוהה" };
let settingsBack = null;
function segRow(name, opts, cur) {
  return `<div class="seg" role="radiogroup" data-set="${name}">${opts.map((o) =>
    `<button type="button" class="seg-b${String(o.v) === String(cur) ? " on" : ""}" data-v="${o.v}" role="radio" aria-checked="${String(o.v) === String(cur)}">${esc(o.label)}</button>`).join("")}</div>`;
}
function renderSettings(msg) {
  const st = S.settings;
  const ex = (t) => `<p class="set-explain">${t}</p>`;
  const autoNow = st.gfx === "auto" ? `כרגע נבחרה: <b>${TIER_HE[tier()]}</b>${autoReason ? " · " + esc(autoReason) : ""}` : "";
  const ageNow = st.age || "de";
  const ageInfo = AGES.find((a) => a.key === ageNow) || AGES[0];
  $("set-body").innerHTML = `
    <div class="set-sec" id="set-age"><h3>שכבת גיל</h3>
      ${ex("בחרו את שכבת הגיל של השחקן. התוכן משתנה לפי הגיל: בד׳–ה׳ מילים, אותיות ותמונות; בשכבות הגבוהות יותר אוצר מילים ארוך יותר, משפטים, השלמת פערים במשפט, הווה פשוט (do/does, he/she +s), הווה ממושך, עבר פשוט, there is/are, מילות יחס והבנת הנקרא. בי׳–י״ב אוצר מילים וזמנים בסגנון בגרות. רמת הקושי (מהירות וניקוד) נשארת נפרדת.")}
      ${segRow("age", AGES.map((a) => ({ v: a.key, label: a.label })), ageNow)}
      <p class="set-note">${esc(ageInfo.blurb)}</p></div>
    <div class="set-sec"><h3>🎯 רמת קושי</h3>
      ${ex("כמה המשחק קשה: מהירות הריצה, מספר הלבבות, כמה זמן יש לענות, קושי השאלות, ומכפיל הניקוד. ככל שהרמה גבוהה יותר — רצים מהר יותר ומרוויחים יותר נקודות.")}
      ${segRow("difficulty", Object.keys(DIFFS).map((k) => ({ v: k, label: DIFFS[k].label })), st.difficulty)}
      <ul class="diff-desc">${Object.keys(DIFFS).map((k) => `<li class="${k === st.difficulty ? "on" : ""}"><b>${esc(DIFFS[k].label)}:</b> ${esc(DIFFS[k].desc)}</li>`).join("")}</ul>
      <p class="set-note">בכל רמה: כל שלב קשה יותר מהקודם, וכל עולם קשה יותר מהעולם שלפניו. מהירות הריצה נקבעת לפי רמת הקושי.</p></div>
    <div class="set-sec"><h3>❓ סוגי תרגילים</h3>
      ${ex("אילו תרגילים יופיעו במשחק. מסמנים ✔ את מה שרוצים לתרגל, ומורידים את הסימון ממה שלא.")}
      <div class="set-checks">${QTYPES.map((q) => `<label class="set-check"><input type="checkbox" data-type="${q.key}" ${st.types[q.key] ? "checked" : ""}> ${esc(q.label)}</label>`).join("")}</div>
      <p class="set-note" id="set-types-msg">${msg ? esc(msg) : "לכל עולם יש סוג תרגיל משלו. עולם שהסוג שלו כבוי יקבל סוג דומה אחר."}</p></div>
    <div class="set-sec"><h3>🖥️ איכות גרפיקה</h3>
      ${ex("כמה יפה התמונה. אם המשחק איטי או נתקע – בחרו «נמוכה». «אוטומטי» בוחר לבד לפי המחשב.")}
      ${segRow("gfx", GFX_OPTS, st.gfx)}
      <p class="set-note">נמוכה: תמונה מפוקסלת ברזולוציה נמוכה, הכי מהירה למחשבים ישנים. ${autoNow}</p></div>
    <div class="set-sec"><h3>🔊 צלילים</h3>
      <div class="set-item">${ex("עוצמת אפקטי הצליל: מטבעות, קפיצות, תשובה נכונה או שגויה.")}
      <label class="set-range">אפקטים <input type="range" min="0" max="100" step="10" data-range="sfx" value="${Math.round(st.sfx * 100)}"><span>${Math.round(st.sfx * 100)}%</span></label></div>
      <div class="set-item">${ex("עוצמת הקול שמקריא את המילים באנגלית. בעולמות ההאזנה חייבים לשמוע אותו!")}
      <label class="set-range">הקראה באנגלית <input type="range" min="0" max="100" step="10" data-range="voice" value="${Math.round(st.voice * 100)}"><span>${Math.round(st.voice * 100)}%</span></label></div>
      <div class="set-item">${ex("לוחצים כדי לבדוק שהרמקולים עובדים ושומעים את ההקראה.")}
      <button type="button" class="btn s" id="set-test-voice">🔊 בדיקת הקראה</button></div></div>
    <div class="set-sec"><h3>🦉 עזרה</h3>
      <div class="set-item">${ex("מציג את כפתור הינשוף בזמן הריצה – אפשר לבקש רמז כשתקועים. (ברמות «קשה», «קשה מאוד» ו«אלוף» אין רמזים.)")}
        <label class="set-check"><input type="checkbox" data-flag="hints" ${st.hints ? "checked" : ""}> כפתור רמזים (הינשוף)</label></div>
      <div class="set-item">${ex("אחרי טעות מופיעה התשובה הנכונה, כדי ללמוד ממנה. (בעולמות ההאזנה – רק ברמות «קל מאוד» ו«קל».)")}
        <label class="set-check"><input type="checkbox" data-flag="showAnswer" ${st.showAnswer ? "checked" : ""}> הצגת התשובה הנכונה אחרי טעות</label></div></div>
    <p class="set-note">${appMode === "run" ? "שינוי ברמת הקושי ובסוגי התרגילים ייכנס לתוקף מהשלב הבא. גרפיקה וצלילים משתנים מיד." : "ההגדרות נשמרות במחשב הזה."}</p>`;
}
function applySettingChange(kind) {
  S.settings = normSettings(S.settings);
  save();
  if (kind === "gfx") { autoTier = null; if (S.settings.gfx === "auto") { S.autoTier = null; fpsMon.drops = 0; save(); } applyQuality(); if (appMode === "run" && run) applyStageLook(WORLDS[run.world - 1]); }
  if (kind === "types" || kind === "difficulty" || kind === "age") { if (appMode === "map") renderStages(); fillDevGrid(); refreshPlayNext(); refreshWordcount(); }
  if (kind === "flag" && appMode === "run") $("btn-hint").classList.toggle("hidden", !(S.settings.hints && !(run && run.layout && run.layout.diff && run.layout.diff.hints === false)));
}
function openSettings(back) {
  settingsBack = back || null;
  if (appMode === "run" && !paused) { paused = true; settingsBack = settingsBack || "resume"; }
  renderSettings();
  $("s-settings").classList.remove("hidden");
  document.body.classList.add("set-open");
}
function closeSettings() {
  $("s-settings").classList.add("hidden");
  document.body.classList.remove("set-open");
  const b = settingsBack; settingsBack = null;
  if (b === "pause") openPause();
  else if (b === "resume" && appMode === "run" && run && $("modal").classList.contains("hidden")) paused = false;
}
function openPause() {
  if (appMode !== "run" || !run) return;
  paused = true;
  showModal(`<div id="pause-box"><h2>⏸️ הפסקה</h2>
    <div class="row" style="margin-top:10px">
      <button class="btn g" id="p-resume">▶ ממשיכים</button>
      <button class="btn" id="p-settings">⚙️ הגדרות</button>
      <button class="btn s" id="p-map">🗺️ למפה</button>
    </div></div>`);
  $("p-resume").onclick = () => { hideModal(); paused = false; };
  $("p-settings").onclick = () => { hideModal(); openSettings("pause"); };
  $("p-map").onclick = () => { if (confirm("לחזור למפה? ההתקדמות בשלב הזה לא תישמר.")) goMapMode(); };
}
function initSettingsUI() {
  const gear = $("btn-settings");
  if (gear) gear.onclick = () => { sfx.click(); openSettings(); };
  const pz = $("btn-pause");
  if (pz) pz.onclick = () => openPause();
  $("btn-set-close").onclick = () => closeSettings();
  $("btn-set-reset").onclick = () => {
    S.settings = normSettings(DEFAULT_SETTINGS()); save();
    autoTier = null; applyQuality(); applySettingChange("types");
    renderSettings("ההגדרות חזרו לברירת המחדל.");
  };
  const body = $("set-body");
  body.addEventListener("click", (e) => {
    const b = e.target.closest(".seg-b");
    if (b) {
      const name = b.parentElement.dataset.set;
      const v = b.dataset.v;
      S.settings[name] = name === "speed" ? +v : v;
      sfx.click();
      applySettingChange(name);
      renderSettings();
      return;
    }
    if (e.target.id === "set-test-voice") say("Hello! Welcome to Mila Quest");
  });
  body.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.type) {
      const next = Object.assign({}, S.settings.types, { [t.dataset.type]: t.checked });
      if (!QTYPES.some((q) => next[q.key])) {
        t.checked = true;
        renderSettings("חייב להשאיר לפחות סוג שאלה אחד.");
        return;
      }
      S.settings.types = next;
      applySettingChange("types");
    } else if (t.dataset.flag) {
      S.settings[t.dataset.flag] = t.checked;
      applySettingChange("flag");
    }
  });
  body.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.range) return;
    S.settings[t.dataset.range] = (+t.value) / 100;
    const sp = t.parentElement.querySelector("span");
    if (sp) sp.textContent = t.value + "%";
    save();
  });
  body.addEventListener("change", (e) => { if (e.target.dataset.range === "sfx") sfx.coin(); });
}

/* ===== BOOT ===== */
const ready = (async function boot() {
  initDevTools();
  $("wordcount").textContent = activeWords().length;
  drawHeroBtns();
  buildPath();
  makeStars();
  ensureRunAmbience();
  const bootFiles = [
    ...HEROES.map((h) => h.file),
    "nature/tree_detailed.glb", "nature/tree_default.glb", "nature/tree_palm.glb",
    "pirate/palm-straight.glb", "pirate/ship-pirate-small.glb",
    "platformer/tree.glb", "platformer/coin-gold.glb",
    "space/craft_speederA.glb", "holiday/tree-snow-a.glb", "holiday/snowman-hat.glb",
    "heroes/boss-wizard.glb", "heroes/boss-soldier.glb", "heroes/boss-pirate.glb"
  ];
  loadTotal = bootFiles.length + 3;
  loadDone = 0; setLoad("טוענים דמויות");
  for (const f of bootFiles) {
    try { await loadGLTF(MP(f)); } catch (e) { console.warn("skip", f, e); loadDone++; }
  }
  setLoad("בונים את המפה");
  await buildMap();
  await ensurePlayer();
  focusTitleCam();
  camera.position.copy(camGoal);
  camera.lookAt(lookGoal);
  appMode = "title";
  showUI("s-title");
  refreshPlayNext();
  refreshPlayerChip();
  requestAnimationFrame(tick);
})();


function checkLaneAlignment() {
  if (!run) return { ok: false, error: "no run" };
  const saved = { course: run.course, layout: run.layout };
  const signErrs = [];
  const postErrs = [];
  const failures = [];
  let nGates = 0, nSigns = 0, nPosts = 0;
  const stages = [];
  try {
    for (let wi = 1; wi <= WORLDS.length; wi++) {
      for (let st = 0; st < NSTAGES; st++) {
        const layout = stageProfile(st, st === BOSS_ST, wi);
        run.layout = layout;
        run.course = buildCourse({
          curve: layout.curve,
          hillAmp: layout.hillAmp,
          turnDir: layout.turnDir,
          causeway: layout.causeway
        });
        const xs = laneXs();
        const laneW = Math.abs(xs[1] - xs[0]);
        const signTol = 0.1 * laneW;
        const halfW = trackHalfWidth();
        const spots = [12, 28, 48, 90, 140];
        const lm = run.course.landmarks || {};
        ["curve", "hill", "turn", "causeway"].forEach((k) => {
          if (lm[k] != null) spots.push(lm[k]);
        });
        const uniq = [];
        spots.forEach((s) => {
          const v = Math.max(2, Math.min((run.course.length || 500) - 4, s));
          if (!uniq.some((u) => Math.abs(u - v) < 1)) uniq.push(v);
        });
        const stageFails = [];
        for (const s of uniq) {
          const group = buildGate(["L", "C", "R"]);
          placeOnCourse(group, s, null, true);
          group.updateMatrixWorld(true);
          nGates++;
          const f = trackFrameAt(s);
          const signs = group.children.filter((c) => c.name === "laneSign");
          signs.forEach((sign, i) => {
            const wp = new THREE.Vector3();
            sign.getWorldPosition(wp);
            const lat = new THREE.Vector3().subVectors(wp, f.pos).dot(f.right);
            const err = Math.abs(lat - xs[i]);
            signErrs.push(err);
            nSigns++;
            if (err >= signTol) {
              const rec = { world: wi, stage: st, s: +s.toFixed(2), kind: (f.kind || "?"), lane: i, expected: xs[i], lateral: +lat.toFixed(4), err: +err.toFixed(4) };
              failures.push(rec);
              stageFails.push(rec);
            }
          });
          group.children.filter((c) => c.name === "gatePost").forEach((post) => {
            const wp = new THREE.Vector3();
            post.getWorldPosition(wp);
            const lat = new THREE.Vector3().subVectors(wp, f.pos).dot(f.right);
            const exp = (post.userData.side || Math.sign(lat) || 1) * halfW;
            const err = Math.abs(lat - exp);
            postErrs.push(err);
            nPosts++;
            if (err >= signTol) {
              const rec = { world: wi, stage: st, s: +s.toFixed(2), kind: (f.kind || "?"), part: "post", expected: exp, lateral: +lat.toFixed(4), err: +err.toFixed(4) };
              failures.push(rec);
              stageFails.push(rec);
            }
          });
          group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        }
        stages.push({
          world: wi,
          stage: st,
          narrow: !!layout.narrow,
          causeway: !!layout.causeway,
          laneW: +laneW.toFixed(3),
          halfW: +halfW.toFixed(3),
          gates: uniq.length,
          fail: stageFails.length
        });
      }
    }
  } finally {
    run.course = saved.course;
    run.layout = saved.layout;
  }
  const maxSign = signErrs.length ? Math.max(...signErrs) : 0;
  const maxPost = postErrs.length ? Math.max(...postErrs) : 0;
  const meanSign = signErrs.length ? signErrs.reduce((a, b) => a + b, 0) / signErrs.length : 0;
  const meanPost = postErrs.length ? postErrs.reduce((a, b) => a + b, 0) / postErrs.length : 0;
  const laneW0 = 2;
  return {
    ok: failures.length === 0,
    threshold: 0.1,
    thresholdUnitsNote: "0.1 * lane width (lane width is distance between adjacent lane centers)",
    nWorlds: WORLDS.length,
    nStages: WORLDS.length * NSTAGES,
    nGates,
    nSigns,
    nPosts,
    maxSignError: +maxSign.toFixed(5),
    meanSignError: +meanSign.toFixed(5),
    maxPostError: +maxPost.toFixed(5),
    meanPostError: +meanPost.toFixed(5),
    nSignFails: failures.filter((f) => f.lane != null).length,
    nPostFails: failures.filter((f) => f.part === "post").length,
    failures: failures.slice(0, 20),
    stages
  };
}

window.MQ = {
  ready,
  startLevel,
  goMapMode,
  goTitle,
  isDev,
  openDevPanel,
  checkLaneAlignment,
  getMode: () => appMode,
  worldMode: (w) => worldMode(w, S.settings),
  stageModes: (w, st, b) => stageModes(w, st, b, S.settings),
  getRun: () => run,
  getPlayer: () => player,
  getGates: () => gates,
  getBoss: () => bossActor,
  getLetters: () => letters,
  setLane: (i) => { if (player) player.lane = i; },
  setPaused: (v) => { paused = v; },
  getS: () => S,
  save,
  setupQuestion,
  WORDS,
  activeWords,
  AGES,
  wordsForAge: (a) => wordsForAge(a, WORDS),
  validateAgeBanks: () => validateAgeBanks(WORDS),
  getAge: () => (S.settings && S.settings.age) || "de",
  camera,
  renderer,
  THREE,
  wOpen: (i) => wOpen(i),
  sOpen: (i, t) => sOpen(i, t),
  keysOwned: () => keysOwned(),
  getObstacles: () => obstacles,
  stageProfile,
  isHigh,
  tier,
  getFps: () => fpsMon.fps,
  getGpu: () => GPU_INFO,
  forceAutoTier: (t) => { S.settings.gfx = "auto"; S.autoTier = null; autoTier = t; fpsMon.drops = 0; applyQuality(); return tier(); },
  setGfx: (v) => { S.settings.gfx = v; applySettingChange("gfx"); return tier(); },
  setSetting: (k, v) => { S.settings[k] = v; applySettingChange(k === "types" ? "types" : k); return S.settings; },
  openSettings,
  closeSettings,
  openPause,
  difficultyFor: (w, st, b) => difficultyFor(w, st, b, S.settings),
  runScene,
  measureSign: (text) => makeTextTexture(text).userData,
  buildTestGate: (opts) => {
    gates.forEach((g) => { if (g.group && g.group.parent) runScene.remove(g.group); });
    gates.length = 0;
    const s = (player.s || 0) + 11.5;
    const group = buildGate(opts);
    placeOnCourse(group, s, null, true);
    runScene.add(group);
    gates.push({ group, s, z: -s, ans: 0, word: run && run.cur, resolved: false });
    setLaneOpts(opts);
    return gates[0];
  },
  spawnHazardsAt: (s) => {
    ["hole", "wall", "beam", "roll"].forEach((type, i) => {
      const lane = i === 2 ? 1 : i % 3;
      const mesh = hazardMark(type);
      const ps = (s || player.s || 0) + i * 6;
      placeOnCourse(mesh, ps, lane);
      runScene.add(mesh);
      obstacles.push({ mesh, lane, type, hit: false, spin: type === "roll" ? 4 : 0, s: ps });
    });
  },
  spawnTypedObstacle: (type, s, lane) => {
    lane = lane == null ? 1 : lane;
    const ps = s == null ? (player.s || 0) + 10 : s;
    let mesh, move = null, kind = null;
    if (type === "animal") {
      kind = pickAnimalKind(run && run.world);
      mesh = buildAnimal(kind);
      move = animalMove(kind);
    } else mesh = type === "low" ? hazardMark("low") : hazardMark(type);
    placeOnCourse(mesh, ps, lane);
    runScene.add(mesh);
    const o = { mesh, lane, type, hit: false, spin: type === "roll" ? 4 : 0, s: ps, kind, move, t: 0 };
    obstacles.push(o);
    return o;
  },
  clearObstacles: () => {
    obstacles.forEach((o) => { o.hit = true; if (o.mesh) disposeDeep(o.mesh); });
    obstacles.length = 0;
  },
  hitObstacle,
  holdCam: (v) => { holdCam = !!v; },
  getCourse: () => run && run.course,
  getMergeStats: () => ({ course: courseVisual && courseVisual.userData.mergeStats, far: themeAmb && themeAmb.userData.far && themeAmb.userData.far.userData.mergeStats }),
  teleportTo: (kind) => {
    if (!run || !run.course || !run.course.landmarks[kind]) return null;
    const s = run.course.landmarks[kind];
    const pad = { turn: 7, hill: 12, curve: 8, causeway: 7 };
    player.s = Math.max(0, s - (pad[kind] != null ? pad[kind] : 9));
    player.z = -player.s;
    syncPlayerPose();
    syncWorldFollowers();
    layoutPathFromCourse();
    if (kind === "turn") showTurnCue(currentTurn(player.s));
    updateRunCamera(1);
    if (runSky) runSky.position.copy(camera.position);
    return { kind, s, playerS: player.s };
  },
  teleportS: (s) => {
    if (!player || !run) return 0;
    player.s = Math.max(0, s);
    player.z = -player.s;
    syncPlayerPose();
    syncWorldFollowers();
    layoutPathFromCourse();
    updateRunCamera(1);
    if (runSky) runSky.position.copy(camera.position);
    return player.s;
  },
  frameLandmark: (kind) => {
    if (!run || !run.course || !run.course.landmarks[kind]) return null;
    showTurnCue(null);
    const s = run.course.landmarks[kind];
    const pad = { turn: 7, hill: 12, curve: 7, causeway: 6 };
    player.s = Math.max(0, s - (pad[kind] != null ? pad[kind] : 9));
    player.z = -player.s;
    syncPlayerPose();
    syncWorldFollowers();
    const f = pathFrame(run.course, player.s);
    if (kind === "hill") {
      const look = pathFrame(run.course, s + 8);
      camera.position.copy(f.pos).addScaledVector(f.fwd, -11).addScaledVector(f.up, 6.4).addScaledVector(f.right, 1.5);
      camera.lookAt(look.pos.clone().addScaledVector(look.up, 1.3));
    } else if (kind === "turn") {
      const apex = pathFrame(run.course, s);
      const t = run.course.turns[0];
      const out = t ? -t.dir : 1;
      camera.position.copy(f.pos).addScaledVector(f.fwd, -5.2).addScaledVector(f.up, 7.1).addScaledVector(f.right, out * 7.2);
      camera.lookAt(apex.pos.clone().addScaledVector(apex.up, 0.7));
      showTurnCue(currentTurn(player.s));
    } else if (kind === "causeway") {
      const look = pathFrame(run.course, player.s + 20);
      camera.position.copy(f.pos).addScaledVector(f.fwd, -8.4).addScaledVector(f.up, 4.8).addScaledVector(f.right, 2.1);
      camera.lookAt(look.pos.clone().addScaledVector(look.up, 0.35));
    } else if (kind === "curve") {
      const look = pathFrame(run.course, player.s + 18);
      camera.position.copy(f.pos).addScaledVector(f.fwd, -8.6).addScaledVector(f.up, 4.4).addScaledVector(f.right, 0.6);
      camera.lookAt(look.pos.clone().addScaledVector(look.up, 1.05));
    } else {
      updateRunCamera(1);
    }
    if (runSky) runSky.position.copy(camera.position);
    return { kind, s, playerS: player.s };
  },
  frameBossChase: () => {
    if (!run || !player) return null;
    showTurnCue(null);
    player.s = Math.max(player.s, 48);
    player.z = -player.s;
    syncPlayerPose();
    if (run) run.forceGlance = false;
    syncWorldFollowers();
    const f = pathFrame(run.course, player.s);
    camera.position.copy(f.pos)
      .addScaledVector(f.fwd, -9.1)
      .addScaledVector(f.right, -3.7)
      .addScaledVector(f.up, 3.35);
    const look = f.pos.clone().addScaledVector(f.fwd, 4.2).addScaledVector(f.up, 1.2).addScaledVector(f.right, 0.7);
    camera.lookAt(look);
    if (runSky) runSky.position.copy(camera.position);
    return {
      playerS: player.s,
      player: player.group.position.toArray(),
      boss: bossActor ? bossActor.model.position.toArray() : null,
      cam: camera.position.toArray()
    };
  },
  forceGlance: (v) => { if (run) run.forceGlance = !!v; },
  // test hook: advance the game logic without rendering (bot = per-step callback)
  simulate: (sec, bot, step = 1 / 30) => {
    let t = 0;
    while (t < sec && appMode === "run" && run && !paused) {
      if (bot) bot();
      if (paused) break;
      updateRunner(step);
      t += step;
    }
    return t;
  },
  changeLane, jump, slide, currentTurn: () => player && currentTurn(player.s),
  syncPlayerPose,
  syncWorldFollowers,
  finishAt,
  updateTrackBar,
  GAME_ID,
  refreshPlayerChip,
  refreshAccountButton,
  closeAccountMenu,
  applyProfileState,
  switchToProfile,
  createNewProfile,
  deleteAndRefresh,
  openProfilePicker,
  openProfilePanel,
  askPlayerName,
  formatPlayTime,
  coinHtml
};
