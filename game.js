const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const els = {
  planet: document.querySelector("#planet"),
  wave: document.querySelector("#wave"),
  level: document.querySelector("#level"),
  crystals: document.querySelector("#crystals"),
  coins: document.querySelector("#coins"),
  health: document.querySelector("#health"),
  healthBar: document.querySelector("#healthBar"),
  xpBar: document.querySelector("#xpBar"),
  waveBar: document.querySelector("#waveBar"),
  overlay: document.querySelector("#overlay"),
  pauseButton: document.querySelector("#pauseButton"),
  restartButton: document.querySelector("#restartButton"),
  helpButton: document.querySelector("#helpButton"),
  touchStick: document.querySelector("#touchStick"),
};

const TAU = Math.PI * 2;
const WORLD_WIDTH = 384;
const WORLD_HEIGHT = 240;
const SAVE_KEY = "asteroid-panic-save-v2";
const SETTINGS_KEY = "asteroid-panic-settings-v2";
const ASSET_MANIFEST_PATH = "Assets/Data/AssetManifest.json";

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const choose = (items) => items[Math.floor(Math.random() * items.length)];

class AssetManager {
  constructor(manifestPath) {
    this.manifestPath = manifestPath;
    this.manifest = { images: {}, audio: {}, atlases: {}, animations: {} };
    this.images = new Map();
    this.failed = new Set();
    this.ready = false;
  }

  async loadManifest() {
    try {
      const response = await fetch(this.manifestPath);
      if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
      this.manifest = await response.json();
      this.ready = true;
    } catch (error) {
      console.warn("Asset manifest unavailable; using procedural fallbacks.", error);
      this.ready = false;
    }
  }

  async preload(ids = Object.keys(this.manifest.images || {})) {
    await Promise.all(ids.map((id) => this.loadImage(id)));
  }

  loadImage(id) {
    if (this.images.has(id)) return Promise.resolve(this.images.get(id));
    if (this.failed.has(id)) return Promise.resolve(null);
    const entry = this.manifest.images?.[id];
    if (!entry?.path) {
      this.failed.add(id);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        this.images.set(id, image);
        resolve(image);
      };
      image.onerror = () => {
        this.failed.add(id);
        resolve(null);
      };
      image.src = entry.path;
    });
  }

  getImage(id) {
    const image = this.images.get(id);
    if (!image && this.ready && !this.failed.has(id)) this.loadImage(id);
    return image || null;
  }

  drawImage(ctx, id, x, y, size, options = {}) {
    const image = this.getImage(id);
    if (!image) return false;
    const width = options.width || size;
    const height = options.height || size;
    ctx.save();
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.translate(x, y);
    ctx.rotate(options.rotation || 0);
    if (options.shadowColor) {
      ctx.shadowColor = options.shadowColor;
      ctx.shadowBlur = options.shadowBlur ?? 12;
    }
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  drawSprite(ctx, id, frame, x, y, scale, options = {}) {
    const image = this.getImage(id);
    if (!image) return false;
    const width = frame.w * scale;
    const height = frame.h * scale;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = options.alpha ?? 1;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(options.rotation || 0);
    if (options.shadowColor) {
      ctx.shadowColor = options.shadowColor;
      ctx.shadowBlur = options.shadowBlur ?? 0;
    }
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }
}

// Frames from the licensed 8x8 Space Shooter pack. Keeping these coordinates
// centralized makes replacing or expanding the art pack straightforward.
const PIXEL_FRAMES = {
  player: { x: 40, y: 0, w: 8, h: 8 },
  scout: { x: 48, y: 8, w: 8, h: 8 },
  drone: { x: 56, y: 8, w: 8, h: 8 },
  tank: { x: 40, y: 24, w: 8, h: 8 },
  boss: { x: 32, y: 48, w: 24, h: 24 },
  coin: { x: 0, y: 0, w: 8, h: 8 },
  crystal: { x: 40, y: 40, w: 8, h: 8 },
  shield: { x: 0, y: 32, w: 8, h: 16 },
};

const PLANETS = [
  {
    name: "Tutorial",
    subtitle: "Learn the panic loop",
    colors: ["#07111f", "#1d3c6f", "#43d5ff"],
    asteroid: "#9aa7bd",
    enemies: ["drone", "asteroid"],
    mechanic: "Basic flight and manual fire",
    reward: { coins: 90, crystals: 18, title: "Cadet Defender" },
    boss: "warden",
  },
  {
    name: "Asteroid Belt",
    subtitle: "Rocks split into trouble",
    colors: ["#120f18", "#5a3f2e", "#ffd166"],
    asteroid: "#b08968",
    enemies: ["drone", "asteroid", "splitter"],
    mechanic: "Splitting enemies",
    reward: { coins: 130, crystals: 26, ship: "Comet" },
    boss: "crusher",
  },
  {
    name: "Frozen Sector",
    subtitle: "Cold shots slow the fight",
    colors: ["#07151b", "#18465a", "#9be7ff"],
    asteroid: "#9ad8e8",
    enemies: ["scout", "shooter", "tank"],
    mechanic: "Faster enemies",
    reward: { coins: 170, crystals: 34, color: "Ice Blue" },
    boss: "frostmaw",
  },
  {
    name: "Alien Hive",
    subtitle: "The swarm learns patterns",
    colors: ["#100a18", "#3b1765", "#77ef8f"],
    asteroid: "#7f6db5",
    enemies: ["scout", "laserDrone", "mineLayer"],
    mechanic: "Area denial mines",
    reward: { coins: 220, crystals: 44, weapon: "Ricochet" },
    boss: "broodmind",
  },
  {
    name: "Volcanic Planet",
    subtitle: "Everything hits harder",
    colors: ["#17090a", "#6f1f19", "#ff8b45"],
    asteroid: "#d45a35",
    enemies: ["tank", "kamikaze", "sniper"],
    mechanic: "Chargers and snipers",
    reward: { coins: 280, crystals: 56, trail: "Ember" },
    boss: "magmaCore",
  },
  {
    name: "Deep Space",
    subtitle: "No safe corner",
    colors: ["#030711", "#19203f", "#b083ff"],
    asteroid: "#8d8aa9",
    enemies: ["shooter", "shieldCarrier", "teleporter"],
    mechanic: "Shielded formations",
    reward: { coins: 350, crystals: 70, badge: "Void Runner" },
    boss: "voidRay",
  },
  {
    name: "Nebula Core",
    subtitle: "Visibility becomes a weapon",
    colors: ["#100719", "#751f7a", "#43d5ff"],
    asteroid: "#de7fff",
    enemies: ["laserDrone", "mineLayer", "teleporter", "splitter"],
    mechanic: "Teleport ambushes",
    reward: { coins: 430, crystals: 86, title: "Nebula Ace" },
    boss: "prismHeart",
  },
  {
    name: "Alien Homeworld",
    subtitle: "Final invasion",
    colors: ["#0d0812", "#214f30", "#ff5a6b"],
    asteroid: "#5bd68f",
    enemies: ["scout", "tank", "sniper", "shieldCarrier", "teleporter"],
    mechanic: "Combined threats",
    reward: { coins: 540, crystals: 110, ship: "Nova" },
    boss: "overlord",
  },
];

const ENEMY_TYPES = {
  asteroid: { name: "Asteroid", hp: 34, speed: 38, radius: 28, color: "#9aa7bd", value: 2, coin: 2, xp: 2, shape: "rock" },
  drone: { name: "Drone", hp: 18, speed: 112, radius: 14, color: "#ff5a6b", value: 1, coin: 2, xp: 2, shape: "dart" },
  scout: { name: "Fast Scout", hp: 16, speed: 168, radius: 12, color: "#43d5ff", value: 1, coin: 3, xp: 2, shape: "dart" },
  tank: { name: "Heavy Tank", hp: 86, speed: 54, radius: 24, color: "#b08968", value: 4, coin: 7, xp: 5, shape: "tank" },
  shooter: { name: "Alien Shooter", hp: 34, speed: 76, radius: 17, color: "#ffd166", value: 2, coin: 5, xp: 3, shape: "kite" },
  laserDrone: { name: "Laser Drone", hp: 38, speed: 84, radius: 16, color: "#ff5aee", value: 3, coin: 6, xp: 4, shape: "diamond" },
  mineLayer: { name: "Mine Layer", hp: 48, speed: 66, radius: 18, color: "#ff8b45", value: 3, coin: 7, xp: 4, shape: "round" },
  sniper: { name: "Sniper", hp: 30, speed: 54, radius: 15, color: "#f5f7fb", value: 4, coin: 8, xp: 5, shape: "needle" },
  kamikaze: { name: "Kamikaze", hp: 30, speed: 94, radius: 16, color: "#ff4d2f", value: 3, coin: 7, xp: 4, shape: "dart" },
  shieldCarrier: { name: "Shield Carrier", hp: 62, speed: 58, radius: 21, color: "#77ef8f", value: 4, coin: 9, xp: 5, shape: "shield" },
  splitter: { name: "Splitter", hp: 42, speed: 72, radius: 20, color: "#c7ff6b", value: 3, coin: 7, xp: 4, shape: "rock" },
  teleporter: { name: "Teleport Alien", hp: 36, speed: 72, radius: 17, color: "#b083ff", value: 5, coin: 10, xp: 6, shape: "diamond" },
};

const BOSSES = {
  warden: { name: "Orbital Warden", color: "#43d5ff", hp: 520, radius: 46 },
  crusher: { name: "Belt Crusher", color: "#ffd166", hp: 680, radius: 52 },
  frostmaw: { name: "Frostmaw", color: "#9be7ff", hp: 760, radius: 50 },
  broodmind: { name: "Broodmind", color: "#77ef8f", hp: 860, radius: 54 },
  magmaCore: { name: "Magma Core", color: "#ff8b45", hp: 960, radius: 58 },
  voidRay: { name: "Void Ray", color: "#b083ff", hp: 1080, radius: 56 },
  prismHeart: { name: "Prism Heart", color: "#ff5aee", hp: 1240, radius: 60 },
  overlord: { name: "Alien Overlord", color: "#ff5a6b", hp: 1500, radius: 64 },
};

const SHIPS = [
  { name: "Pioneer", color: "#43d5ff", trail: "#77ef8f", unlock: 0, speed: 1, fire: 1 },
  { name: "Comet", color: "#ffd166", trail: "#ff8b45", unlock: 1, speed: 1.08, fire: 0.96 },
  { name: "Nova", color: "#ff5aee", trail: "#b083ff", unlock: 7, speed: 1.03, fire: 1.08 },
];

const UPGRADE_POOL = [
  { id: "damage", name: "+20% Damage", desc: "All shots hit harder.", apply: (p) => (p.damage *= 1.2) },
  { id: "rate", name: "+15% Fire Rate", desc: "Less time between shots.", apply: (p) => (p.fireRate *= 1.15) },
  { id: "double", name: "Double Shot", desc: "Add one extra bullet.", apply: (p) => (p.bullets += 1) },
  { id: "triple", name: "Triple Shot", desc: "Add two extra bullets.", apply: (p) => (p.bullets += 2) },
  { id: "move", name: "+20% Movement", desc: "Accelerate and drift faster.", apply: (p) => (p.speed *= 1.2) },
  { id: "crit", name: "Critical Hits", desc: "More chance to deal burst damage.", apply: (p) => (p.crit += 0.12) },
  { id: "shield", name: "Shield", desc: "Gain a rechargeable shield.", apply: (p) => (p.shieldMax += 30, p.shield = p.shieldMax) },
  { id: "magnet", name: "Magnet", desc: "Pull rewards from farther away.", apply: (p) => (p.magnet += 55) },
  { id: "ricochet", name: "Ricochet", desc: "Shots bounce once off walls.", apply: (p) => (p.ricochet += 1) },
  { id: "freeze", name: "Freeze Bullets", desc: "Hits briefly slow enemies.", apply: (p) => (p.freeze += 0.18) },
  { id: "poison", name: "Poison", desc: "Shots leave damage over time.", apply: (p) => (p.poison += 4) },
  { id: "fire", name: "Fire Damage", desc: "Burn enemies after impact.", apply: (p) => (p.burn += 5) },
  { id: "drone", name: "Drone Companion", desc: "A helper orb fires beside you.", apply: (p) => (p.drones += 1) },
  { id: "dash", name: "Dash", desc: "Double tap movement with smoother bursts.", apply: (p) => (p.dash += 1) },
  { id: "emp", name: "EMP Blast", desc: "Periodic pulse damages nearby enemies.", apply: (p) => (p.emp += 1) },
  { id: "turret", name: "Auto Turret", desc: "Earth fires a defensive shot.", apply: (p) => (p.turrets += 1) },
  { id: "luck", name: "Lucky Drops", desc: "Enemies drop more coins and crystals.", apply: (p) => (p.luck += 0.18) },
  { id: "boom", name: "Explosion Radius", desc: "Kills splash damage to nearby enemies.", apply: (p) => (p.explosion += 22) },
];

let keys = new Set();
let pointerVector = { x: 0, y: 0 };
let pointerActive = false;
let lastTime = 0;
let state = null;
let save = loadSave();
let settings = loadSettings();
let audio = null;
const assetManager = new AssetManager(ASSET_MANIFEST_PATH);

const pools = {
  particles: [],
  numbers: [],
};

function loadSave() {
  const fallback = {
    unlockedPlanet: 0,
    selectedPlanet: 0,
    selectedShip: 0,
    coins: 0,
    crystals: 0,
    totalXp: 0,
    playerLevel: 1,
    dailyClaimed: "",
    achievements: [],
    unlocks: ["Pioneer"],
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function loadSettings() {
  const fallback = { sound: 0.7, music: 0.35, haptics: true, lowFx: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function ensureAudio() {
  if (audio) return audio;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext();
  const master = context.createGain();
  const music = context.createGain();
  master.gain.value = settings.sound;
  music.gain.value = settings.music;
  master.connect(context.destination);
  music.connect(master);
  audio = { context, master, music, musicOsc: null };
  startMusic("menu");
  return audio;
}

function playTone(freq, duration = 0.08, type = "sine", gain = 0.08, slide = 0) {
  const api = ensureAudio();
  if (!api || settings.sound <= 0) return;
  const now = api.context.currentTime;
  const osc = api.context.createOscillator();
  const amp = api.context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration);
  amp.gain.setValueAtTime(gain * settings.sound, now);
  amp.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(amp);
  amp.connect(api.master);
  osc.start(now);
  osc.stop(now + duration);
}

function startMusic(mode) {
  const api = ensureAudio();
  if (!api) return;
  if (api.musicOsc) api.musicOsc.stop();
  const osc = api.context.createOscillator();
  const amp = api.context.createGain();
  osc.type = "sine";
  osc.frequency.value = mode === "boss" ? 82 : mode === "game" ? 110 : 164;
  amp.gain.value = 0.025 * settings.music;
  osc.connect(amp);
  amp.connect(api.music);
  osc.start();
  api.musicOsc = osc;
}

function vibrate(pattern) {
  if (settings.haptics && navigator.vibrate) navigator.vibrate(pattern);
}

function resizeCanvas() {
  // Draw at a fixed low resolution and let CSS enlarge it with hard edges.
  // This gives every in-game object the same crisp pixel-art treatment.
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function makeState() {
  const width = canvas.width || WORLD_WIDTH;
  const height = canvas.height || WORLD_HEIGHT;
  const planetIndex = clamp(save.selectedPlanet, 0, PLANETS.length - 1);
  const ship = SHIPS[save.selectedShip] || SHIPS[0];
  return {
    mode: "menu",
    screen: "menu",
    planetIndex,
    planet: PLANETS[planetIndex],
    time: 0,
    wave: 1,
    waveInPlanet: 1,
    waveTarget: 12,
    killsThisWave: 0,
    spawnTimer: 0.8,
    boss: null,
    bossAnnounced: false,
    upgradeChoices: [],
    camera: { x: 0, y: 0, shake: 0, flash: 0 },
    background: createBackground(width, height, planetIndex),
    player: makePlayer(width, height, ship),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    mines: [],
    pickups: [],
    particles: [],
    numbers: [],
    rewards: { coins: 0, crystals: 0, score: 0 },
    transition: 0,
    turretCooldown: 0,
    empCooldown: 4,
  };
}

function makePlayer(width, height, ship) {
  return {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    recoil: 0,
    radius: 13,
    speed: 175 * ship.speed,
    accel: 1080,
    friction: 7.4,
    turnSpeed: 4.9,
    health: 100,
    maxHealth: 100,
    shield: 25,
    shieldMax: 25,
    shieldPulse: 0,
    level: 1,
    xp: 0,
    xpNext: 9,
    damage: 20,
    fireRate: 2.9 * ship.fire,
    fireCooldown: 0,
    bullets: 1,
    crit: 0.06,
    magnet: 92,
    explosion: 0,
    ricochet: 0,
    freeze: 0,
    poison: 0,
    burn: 0,
    drones: 0,
    dash: 0,
    emp: 0,
    turrets: 0,
    luck: 0,
    invuln: 1.1,
    color: ship.color,
    trail: ship.trail,
  };
}

function createBackground(width, height, planetIndex) {
  return {
    layers: [0.18, 0.36, 0.7].map((speed, layer) =>
      Array.from({ length: settings.lowFx ? 28 : 52 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rand(0.55, layer + 1.5),
        a: rand(0.24, 0.88),
        twinkle: rand(0.35, 1.25),
        phase: rand(0, TAU),
        speed: speed * rand(8, 26),
      })),
    ),
    nebulas: Array.from({ length: settings.lowFx ? 2 : 5 }, (_, i) => ({
      x: rand(0, width),
      y: rand(0, height),
      r: rand(120, 260),
      hue: PLANETS[planetIndex].colors[(i + 1) % 3],
      phase: rand(0, TAU),
      drift: rand(0.04, 0.16),
    })),
    shootingStars: [],
    shootingTimer: rand(4, 9),
  };
}

function hideOverlay() {
  els.overlay.classList.add("hidden");
}

function setOverlay(html, screen = "default") {
  els.overlay.dataset.screen = screen;
  const effects =
    screen === "victory"
      ? '<div class="screen-fx celebration"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
      : screen === "defeat"
        ? '<div class="screen-fx defeat-fx"><i></i><i></i><i></i></div>'
        : "";
  els.overlay.innerHTML = `${effects}${html}`;
  els.overlay.classList.remove("hidden");
}

function button(label, action, className = "") {
  return `<button type="button" class="${className}" data-action="${action}">${label}</button>`;
}

function renderMenu() {
  if (!state) state = makeState();
  state.mode = "menu";
  state.screen = "menu";
  startMusic("menu");
  const daily = getDailyBonusText();
  setOverlay(`
    <h1>Asteroid Panic</h1>
    <p>Turn, thrust, and fire through the invasion. Every shot travels exactly where your ship points.</p>
    <div class="how-to">
      <div><strong>Pilot</strong><span>W or Up thrusts. A/D or Left/Right turns. S or Down reverses.</span></div>
      <div><strong>Fire</strong><span>Hold Space to fire from the ship's nose. On phone, drag to steer, thrust, and fire.</span></div>
      <div><strong>Grow</strong><span>Collect crystals, beat bosses, unlock ships, trails, badges, and titles.</span></div>
    </div>
    <div class="menu-actions">
      ${button("Play", "play")}
      ${button("Level Select", "levels", "secondary")}
      ${button("Ship Select", "ships", "secondary")}
      ${button("Store", "store", "secondary")}
      ${button("Settings", "settings", "secondary")}
      ${button(daily, "daily", "secondary")}
    </div>`);
}

function renderLevelSelect() {
  const cards = PLANETS.map((planet, index) => {
    const locked = index > save.unlockedPlanet;
    return `<button type="button" class="screen-card ${locked ? "locked" : ""}" data-action="${locked ? "locked" : `select-level:${index}`}">
      <strong>${index + 1}. ${planet.name}</strong>
      <span>${planet.subtitle}</span>
      <span>New mechanic: ${planet.mechanic}</span>
    </button>`;
  }).join("");
  setOverlay(`<h1>Level Select</h1><p>Each planet introduces one new pressure point.</p><div class="screen-grid">${cards}</div><div class="menu-actions">${button("Back", "menu", "secondary")}</div>`);
}

function renderShipSelect() {
  const cards = SHIPS.map((ship, index) => {
    const locked = ship.unlock > save.unlockedPlanet;
    const selected = index === save.selectedShip ? "Selected" : "Choose";
    return `<button type="button" class="screen-card ${locked ? "locked" : ""}" data-action="${locked ? "locked" : `select-ship:${index}`}">
      <strong>${ship.name}</strong>
      <span>${locked ? `Unlock on planet ${ship.unlock + 1}` : selected}</span>
      <span>Speed x${ship.speed.toFixed(2)} | Fire x${ship.fire.toFixed(2)}</span>
    </button>`;
  }).join("");
  setOverlay(`<h1>Ship Select</h1><p>Unlock more ships by clearing planets.</p><div class="screen-grid">${cards}</div><div class="menu-actions">${button("Back", "menu", "secondary")}</div>`);
}

function renderStore() {
  setOverlay(`
    <h1>Store</h1>
    <p>Permanent unlocks are scaffolded for progression. Current balance: ${save.coins} coins, ${save.crystals} crystals.</p>
    <div class="screen-grid">
      <div class="screen-card"><strong>Skill Tree</strong><span>Permanent damage, health, magnet, and shield nodes. Coming online as purchasable nodes.</span></div>
      <div class="screen-card"><strong>Treasure Crates</strong><span>Bosses and achievements award crates with coins, crystals, colors, trails, titles, and badges.</span></div>
      <div class="screen-card"><strong>Cloud Save</strong><span>Local autosave is active. Cloud sync hook is ready for an account service.</span></div>
      <div class="screen-card"><strong>Achievements</strong><span>${save.achievements.length || 0} earned. More badges unlock from boss clears and survival streaks.</span></div>
    </div>
    <div class="menu-actions">${button("Open Crate", "crate")}${button("Back", "menu", "secondary")}</div>`);
}

function renderSettings() {
  setOverlay(`
    <h1>Settings</h1>
    <p>Tune feel for your phone or laptop.</p>
    <div class="screen-card">
      <label class="setting-row"><span>Sound Volume</span><input data-setting="sound" type="range" min="0" max="1" step="0.05" value="${settings.sound}"></label>
      <label class="setting-row"><span>Music Volume</span><input data-setting="music" type="range" min="0" max="1" step="0.05" value="${settings.music}"></label>
      <label class="setting-row"><span>Haptics</span><input data-setting="haptics" type="checkbox" ${settings.haptics ? "checked" : ""}></label>
      <label class="setting-row"><span>Low FX Mode</span><input data-setting="lowFx" type="checkbox" ${settings.lowFx ? "checked" : ""}></label>
    </div>
    <div class="menu-actions">${button("Back", "menu", "secondary")}</div>`);
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.setting;
      settings[key] = input.type === "checkbox" ? input.checked : Number(input.value);
      if (audio) {
        audio.master.gain.value = settings.sound;
        audio.music.gain.value = settings.music;
      }
      saveSettings();
    });
  });
}

function renderHelp() {
  const returnAction = state?.mode === "playing" ? "resume" : "menu";
  if (state?.mode === "playing") state.mode = "paused";
  setOverlay(`
    <h1>How to Play</h1>
    <p>Protect Earth, clear three waves, beat the planet boss, then unlock the next planet.</p>
    <div class="how-to">
      <div><strong>Controls</strong><span>W or Up thrusts, A/D or Left/Right turns, and S or Down reverses. Hold Space to fire in your current direction. Drag on mobile to steer, thrust, and fire. Press P to pause.</span></div>
      <div><strong>Rewards</strong><span>Green crystals level you up. Gold coins and boss chests feed permanent progression.</span></div>
      <div><strong>Survival</strong><span>Enemies never spawn directly on you. Shield absorbs hits, but reckless collisions still hurt.</span></div>
    </div>
    <div class="menu-actions">${button("Got It", returnAction)}</div>`);
}

function getDailyBonusText() {
  const today = new Date().toISOString().slice(0, 10);
  return save.dailyClaimed === today ? "Daily Claimed" : "Claim Daily";
}

function claimDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (save.dailyClaimed === today) {
    playTone(180, 0.08, "triangle", 0.05);
    return;
  }
  save.dailyClaimed = today;
  save.coins += 75;
  save.crystals += 12;
  saveGame();
  playTone(640, 0.18, "triangle", 0.08, 280);
  renderMenu();
}

function handleOverlayAction(action) {
  if (!action) return;
  playTone(320, 0.05, "square", 0.035);
  if (action === "play") startGame();
  else if (action === "menu") renderMenu();
  else if (action === "levels") renderLevelSelect();
  else if (action === "ships") renderShipSelect();
  else if (action === "store") renderStore();
  else if (action === "settings") renderSettings();
  else if (action === "daily") claimDaily();
  else if (action === "crate") openCrate();
  else if (action === "resume") resumeGame();
  else if (action === "restart") startGame();
  else if (action === "locked") playTone(120, 0.12, "sawtooth", 0.05, -40);
  else if (action.startsWith("select-level:")) {
    save.selectedPlanet = Number(action.split(":")[1]);
    saveGame();
    state = makeState();
    renderMenu();
  } else if (action.startsWith("select-ship:")) {
    save.selectedShip = Number(action.split(":")[1]);
    saveGame();
    state = makeState();
    renderShipSelect();
  } else if (action.startsWith("upgrade:")) {
    takeUpgrade(Number(action.split(":")[1]));
  }
}

function openCrate() {
  const coins = Math.floor(rand(35, 90));
  const crystals = Math.floor(rand(6, 18));
  save.coins += coins;
  save.crystals += crystals;
  saveGame();
  playTone(720, 0.22, "triangle", 0.08, 420);
  setOverlay(`<h1>Treasure Crate</h1><p>You found ${coins} coins and ${crystals} crystals.</p><div class="menu-actions">${button("Nice", "store")}</div>`);
}

function startGame() {
  ensureAudio();
  resizeCanvas();
  state = makeState();
  state.mode = "playing";
  hideOverlay();
  startMusic("game");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function pauseGame() {
  if (!state || state.mode === "menu" || state.mode === "upgrade" || state.mode === "gameover" || state.mode === "victory") return;
  state.mode = state.mode === "paused" ? "playing" : "paused";
  els.pauseButton.textContent = state.mode === "paused" ? "Resume" : "Pause";
  if (state.mode === "playing") resumeGame();
  else {
    setOverlay(`<h1>Paused</h1><p>Autosave is active. Cloud save placeholder is ready for account sync later.</p><div class="menu-actions">${button("Resume", "resume")}${button("Restart", "restart", "secondary")}${button("Settings", "settings", "secondary")}${button("Main Menu", "menu", "secondary")}</div>`);
  }
}

function resumeGame() {
  if (!state) return;
  hideOverlay();
  state.mode = "playing";
  els.pauseButton.textContent = "Pause";
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function beginUpgrade(reason = "Wave cleared") {
  if (state.mode !== "playing") return;
  state.mode = "upgrade";
  state.upgradeChoices = [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = state.upgradeChoices
    .map((upgrade, index) => `<button class="upgrade" data-action="upgrade:${index}" type="button"><strong>${upgrade.name}</strong><span>${upgrade.desc}</span></button>`)
    .join("");
  setOverlay(`<h1>Upgrade</h1><p>${reason}. Pick one boost before the panic resumes.</p><div class="upgrade-list">${choices}</div>`);
  playTone(520, 0.12, "triangle", 0.07, 180);
}

function takeUpgrade(index) {
  const upgrade = state.upgradeChoices[index] || state.upgradeChoices[0];
  upgrade.apply(state.player);
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 16);
  state.player.shield = Math.min(state.player.shieldMax, state.player.shield + 18);
  spawnText(state.player.x, state.player.y - 28, upgrade.name, "#77ef8f");
  state.mode = "playing";
  hideOverlay();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function getPilotInput() {
  const touchStrength = Math.min(1, Math.hypot(pointerVector.x, pointerVector.y));
  const touchAngle = touchStrength > 0.08 ? Math.atan2(pointerVector.y, pointerVector.x) : null;
  const turn = (keys.has("a") || keys.has("arrowleft") ? -1 : 0) + (keys.has("d") || keys.has("arrowright") ? 1 : 0);
  const thrust = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 0.55 : 0);
  return {
    turn,
    thrust: pointerActive ? touchStrength : thrust,
    touchAngle,
    firing: keys.has(" ") || keys.has("space") || pointerActive,
  };
}

function spawnWave(dt) {
  if (state.boss) return;
  if (state.killsThisWave >= state.waveTarget && state.enemies.length === 0) {
    if (state.waveInPlanet >= 3) spawnBoss();
    else advanceWave();
    return;
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  const aliveBudget = state.enemies.length < 10 + state.planetIndex * 2;
  if (!aliveBudget || state.killsThisWave + state.enemies.length >= state.waveTarget) return;

  const type = choose(state.planet.enemies);
  spawnAtEdge(type);
  state.spawnTimer = Math.max(0.22, 1.05 - state.planetIndex * 0.06 - state.waveInPlanet * 0.08);
}

function advanceWave() {
  state.wave += 1;
  state.waveInPlanet += 1;
  state.killsThisWave = 0;
  state.waveTarget = 12 + state.planetIndex * 4 + state.waveInPlanet * 5;
  state.camera.flash = 0.22;
  beginUpgrade("Wave cleared");
}

function spawnBoss() {
  const data = BOSSES[state.planet.boss];
  const hpScale = 1 + state.planetIndex * 0.28;
  state.boss = {
    ...data,
    type: "boss",
    x: canvas.width / 2,
    y: -90,
    targetY: Math.max(48, canvas.height * 0.22),
    hp: data.hp * hpScale,
    maxHp: data.hp * hpScale,
    phase: 1,
    cooldown: 1.2,
    spawnTime: 2.1,
    angle: 0,
    weakAngle: 0,
    hitFlash: 0,
    attackTell: 0,
    bobSeed: rand(0, TAU),
  };
  state.enemies.push(state.boss);
  state.bossAnnounced = true;
  state.camera.flash = 0.65;
  state.camera.shake = 12;
  startMusic("boss");
  spawnText(canvas.width / 2, 38, `${data.name} Appears`, data.color);
  playTone(90, 0.55, "sawtooth", 0.09, -35);
  vibrate([50, 40, 80]);
}

function spawnAtEdge(type) {
  const margin = 32;
  const attempts = 16;
  for (let i = 0; i < attempts; i += 1) {
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? -margin : side === 1 ? canvas.width + margin : rand(0, canvas.width);
    const y = side === 2 ? -margin : side === 3 ? canvas.height + margin : rand(0, canvas.height);
    if (dist({ x, y }, state.player) < 118) continue;
    if (state.enemies.some((enemy) => Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 28)) continue;
    spawnEnemy(type, x, y);
    return;
  }
}

function spawnEnemy(type, x, y) {
  const cfg = ENEMY_TYPES[type];
  const scale = 1 + state.planetIndex * 0.12 + (state.waveInPlanet - 1) * 0.06;
  state.enemies.push({
    ...cfg,
    type,
    x,
    y,
    hp: cfg.hp * scale,
    maxHp: cfg.hp * scale,
    speed: cfg.speed * (1 + state.planetIndex * 0.035),
    cooldown: rand(0.4, 1.8),
    charge: rand(0.6, 1.5),
    angle: rand(0, TAU),
    bobSeed: rand(0, TAU),
    attackTell: 0,
    hitFlash: 0,
    slow: 0,
    poison: 0,
    burn: 0,
    spawnGrace: 0.5,
  });
}

function updatePlayer(dt) {
  const p = state.player;
  const input = getPilotInput();
  const isThrusting = Math.abs(input.thrust) > 0.05;
  const targetSpeed = p.speed * (p.dash > 0 && isThrusting && keys.has("shift") ? 1.45 : 1);
  if (input.touchAngle !== null) p.angle = lerpAngle(p.angle, input.touchAngle, clamp(10 * dt, 0, 1));
  else p.angle += input.turn * p.turnSpeed * dt;
  const thrust = input.thrust * p.accel * dt;
  p.vx += Math.cos(p.angle) * thrust;
  p.vy += Math.sin(p.angle) * thrust;
  if (!isThrusting) {
    p.vx = lerp(p.vx, 0, clamp(p.friction * dt, 0, 1));
    p.vy = lerp(p.vy, 0, clamp(p.friction * dt, 0, 1));
  }
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > targetSpeed) {
    p.vx = (p.vx / speed) * targetSpeed;
    p.vy = (p.vy / speed) * targetSpeed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, p.radius, canvas.width - p.radius);
  p.y = clamp(p.y, p.radius, canvas.height - p.radius);
  p.invuln = Math.max(0, p.invuln - dt);
  p.recoil = Math.max(0, p.recoil - dt * 8);
  p.shieldPulse = Math.max(0, p.shieldPulse - dt * 3);
  if (p.shield < p.shieldMax) p.shield = Math.min(p.shieldMax, p.shield + dt * 1.6);

  if (speed > 15) exhaust(p.x - Math.cos(p.angle) * 16, p.y - Math.sin(p.angle) * 16, p.trail);

  p.fireCooldown -= dt;
  if (input.firing && p.fireCooldown <= 0) {
    fireForward(p);
    p.fireCooldown = 1 / p.fireRate;
  }

  updateCompanions(dt);
  updateTurret(dt);
  updateEmp(dt);
}

function lerpAngle(a, b, t) {
  const diff = ((b - a + Math.PI) % TAU) - Math.PI;
  return a + diff * t;
}

function fireAtNearestEnemy(x, y, fromDrone) {
  if (!state.enemies.length) return;
  const target = state.enemies.reduce((best, enemy) => (dist({ x, y }, enemy) < dist({ x, y }, best) ? enemy : best));
  const angle = Math.atan2(target.y - y, target.x - x);
  const bullets = fromDrone ? 1 : state.player.bullets;
  const spread = 0.18;
  for (let i = 0; i < bullets; i += 1) {
    const offset = (i - (bullets - 1) / 2) * spread;
    spawnBullet(x, y, angle + offset, fromDrone ? 0.55 : 1);
  }
  state.player.recoil = 1;
  playTone(fromDrone ? 440 : 620, 0.045, "triangle", 0.022, 80);
}

function fireForward(p) {
  const bullets = p.bullets;
  const spread = 0.14;
  const muzzle = p.radius + 6;
  for (let i = 0; i < bullets; i += 1) {
    const offset = (i - (bullets - 1) / 2) * spread;
    const angle = p.angle + offset;
    spawnBullet(p.x + Math.cos(angle) * muzzle, p.y + Math.sin(angle) * muzzle, angle, 1);
  }
  p.recoil = 1;
  playTone(620, 0.045, "triangle", 0.022, 80);
}

function spawnBullet(x, y, angle, multiplier) {
  const p = state.player;
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * 560,
    vy: Math.sin(angle) * 560,
    angle,
    radius: 5,
    life: 1.25,
    damage: p.damage * multiplier * (Math.random() < p.crit ? 2.2 : 1),
    pierce: p.ricochet > 0 ? 1 : 0,
    freeze: p.freeze,
    poison: p.poison,
    burn: p.burn,
    color: p.freeze > 0 ? "#9be7ff" : p.burn > 0 ? "#ff8b45" : "#55dcff",
  });
}

function updateCompanions(dt) {
  const p = state.player;
  if (!p.drones) return;
  p.droneCooldown = Math.max(0, (p.droneCooldown || 0) - dt);
  if (p.droneCooldown <= 0) {
    for (let i = 0; i < p.drones; i += 1) {
      const a = state.time * 2.2 + (i / p.drones) * TAU;
      fireAtNearestEnemy(p.x + Math.cos(a) * 35, p.y + Math.sin(a) * 35, true);
    }
    p.droneCooldown = 1.1;
  }
}

function updateTurret(dt) {
  const p = state.player;
  if (!p.turrets || !state.enemies.length) return;
  state.turretCooldown -= dt;
  if (state.turretCooldown <= 0) {
  const earth = { x: canvas.width / 2, y: canvas.height / 2 };
    const target = state.enemies.reduce((best, enemy) => (dist(earth, enemy) < dist(earth, best) ? enemy : best));
    const angle = Math.atan2(target.y - earth.y, target.x - earth.x);
    spawnBullet(earth.x, earth.y, angle, 0.7);
    state.turretCooldown = Math.max(0.35, 1.25 - p.turrets * 0.12);
  }
}

function updateEmp(dt) {
  const p = state.player;
  if (!p.emp) return;
  state.empCooldown -= dt;
  if (state.empCooldown <= 0) {
    for (const enemy of state.enemies) {
      if (dist(p, enemy) < 150 + p.emp * 28) {
        enemy.hp -= p.damage * 0.8;
        enemy.slow = Math.max(enemy.slow, 1.2);
        spawnText(enemy.x, enemy.y - enemy.radius, "EMP", "#9be7ff");
      }
    }
    ring(p.x, p.y, "#9be7ff", 28);
    state.empCooldown = Math.max(2.8, 6 - p.emp * 0.4);
  }
}

function updateEnemies(dt) {
  const p = state.player;
  for (const enemy of state.enemies) {
    enemy.spawnGrace = Math.max(0, enemy.spawnGrace - dt);
    enemy.cooldown -= dt;
    enemy.charge -= dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 8);
    enemy.angle += dt * 0.8;
    enemy.slow = Math.max(0, enemy.slow - dt);
    if (enemy.poison > 0) {
      enemy.hp -= enemy.poison * dt;
      enemy.poison = Math.max(0, enemy.poison - dt * 2);
    }
    if (enemy.burn > 0) {
      enemy.hp -= enemy.burn * dt;
      enemy.burn = Math.max(0, enemy.burn - dt * 3);
      if (Math.random() < dt * 8) smoke(enemy.x, enemy.y, "#ff8b45");
    }
    if (enemy.type === "boss") {
      updateBoss(enemy, dt);
      continue;
    }

    const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x);
    const slowMult = enemy.slow > 0 ? 0.52 : 1;
    const speed = enemy.speed * slowMult;

    if (enemy.type === "shooter" || enemy.type === "laserDrone" || enemy.type === "sniper") {
      const d = dist(p, enemy);
      const desired = enemy.type === "sniper" ? 330 : 220;
      const direction = d < desired ? -1 : 1;
      enemy.x += Math.cos(angle) * speed * direction * dt;
      enemy.y += Math.sin(angle) * speed * direction * dt;
      if (enemy.cooldown <= 0) {
        shootEnemy(enemy, angle, enemy.type === "sniper" ? 360 : enemy.type === "laserDrone" ? 300 : 250);
        enemy.cooldown = enemy.type === "sniper" ? 2.4 : 1.45;
      }
    } else if (enemy.type === "mineLayer") {
      enemy.x += Math.cos(angle + Math.sin(state.time)) * speed * 0.72 * dt;
      enemy.y += Math.sin(angle + Math.sin(state.time)) * speed * 0.72 * dt;
      if (enemy.cooldown <= 0) {
        state.mines.push({ x: enemy.x, y: enemy.y, radius: 12, life: 6, pulse: 0 });
        enemy.cooldown = 2.2;
      }
    } else if (enemy.type === "teleporter") {
      enemy.x += Math.cos(angle) * speed * 0.66 * dt;
      enemy.y += Math.sin(angle) * speed * 0.66 * dt;
      if (enemy.cooldown <= 0) {
        safeTeleport(enemy);
        enemy.cooldown = 2.5;
      }
    } else {
      const chargeMult = enemy.type === "kamikaze" && enemy.charge <= 0 ? 2.35 : 1;
      enemy.x += Math.cos(angle) * speed * chargeMult * dt;
      enemy.y += Math.sin(angle) * speed * chargeMult * dt;
    }

    if (enemy.type === "shieldCarrier") shieldNearbyEnemies(enemy);

    if (enemy.spawnGrace <= 0 && dist(p, enemy) < p.radius + enemy.radius && p.invuln <= 0) {
      damagePlayer(enemy.type === "kamikaze" ? 28 : 12);
      enemy.hp -= enemy.type === "kamikaze" ? 999 : 18;
      state.camera.shake = Math.max(state.camera.shake, 5);
    }
  }
}

function updateBoss(boss, dt) {
  boss.spawnTime = Math.max(0, boss.spawnTime - dt);
  boss.weakAngle += dt * (1 + boss.phase * 0.4);
  boss.phase = boss.hp < boss.maxHp * 0.35 ? 3 : boss.hp < boss.maxHp * 0.68 ? 2 : 1;
  if (boss.y < boss.targetY) {
    boss.y += 95 * dt;
    return;
  }
  boss.attackTell = boss.cooldown < 0.38 ? clamp(1 - boss.cooldown / 0.38, 0, 1) : 0;
  if (boss.attackTell > 0.75 && Math.random() < dt * 18) spark(boss.x + rand(-boss.radius, boss.radius), boss.y + rand(-boss.radius * 0.5, boss.radius * 0.5), boss.color, 1);
  boss.x += Math.sin(state.time * 0.9) * 36 * dt;
  boss.cooldown -= dt;
  if (boss.cooldown > 0) return;
  const attack = boss.phase === 1 ? 0 : Math.floor(rand(0, boss.phase + 1));
  if (attack === 0) {
    for (let i = 0; i < 7 + boss.phase * 2; i += 1) shootEnemy(boss, (i / (7 + boss.phase * 2)) * TAU + state.time * 0.4, 170 + state.planetIndex * 12);
  } else if (attack === 1) {
    for (let i = 0; i < boss.phase + 1; i += 1) spawnEnemy(choose(state.planet.enemies), boss.x + rand(-55, 55), boss.y + rand(10, 65));
  } else {
    state.mines.push({ x: boss.x + rand(-120, 120), y: boss.y + rand(70, 180), radius: 15, life: 5, pulse: 0 });
  }
  boss.cooldown = Math.max(0.75, 2 - boss.phase * 0.32);
}

function shootEnemy(enemy, angle, speed) {
  state.enemyBullets.push({
    x: enemy.x + Math.cos(angle) * enemy.radius,
    y: enemy.y + Math.sin(angle) * enemy.radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: enemy.type === "boss" ? 6 : 5,
    life: 4,
    color: enemy.color,
  });
}

function safeTeleport(enemy) {
  for (let i = 0; i < 12; i += 1) {
    const x = rand(26, canvas.width - 26);
    const y = rand(26, canvas.height - 26);
    if (dist({ x, y }, state.player) > 210) {
      ring(enemy.x, enemy.y, enemy.color, 10);
      enemy.x = x;
      enemy.y = y;
      ring(enemy.x, enemy.y, enemy.color, 16);
      return;
    }
  }
}

function shieldNearbyEnemies(carrier) {
  for (const enemy of state.enemies) {
    if (enemy !== carrier && enemy.type !== "boss" && dist(carrier, enemy) < 120) enemy.shielded = 0.12;
  }
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (!settings.lowFx && Math.random() < 0.65) {
      spawnParticle("trail", bullet.x - bullet.vx * 0.018, bullet.y - bullet.vy * 0.018, bullet.color, {
        speed: 0,
        radius: bullet.radius * 0.85,
        life: 0.16,
      });
    }
    if (bullet.pierce > 0 && (bullet.x < 0 || bullet.x > canvas.width)) {
      bullet.vx *= -1;
      bullet.pierce -= 1;
    }
    if (bullet.pierce > 0 && (bullet.y < 0 || bullet.y > canvas.height)) {
      bullet.vy *= -1;
      bullet.pierce -= 1;
    }
  }
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (!settings.lowFx && Math.random() < 0.45) {
      spawnParticle("trail", bullet.x - bullet.vx * 0.018, bullet.y - bullet.vy * 0.018, bullet.color || "#ffcf5a", {
        speed: 0,
        radius: bullet.radius * 0.75,
        life: 0.18,
      });
    }
    if (dist(bullet, state.player) < bullet.radius + state.player.radius) {
      bullet.life = 0;
      damagePlayer(10 + state.planetIndex);
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
  state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.life > 0);
}

function updateMines(dt) {
  for (const mine of state.mines) {
    mine.life -= dt;
    mine.pulse += dt;
    if (dist(mine, state.player) < mine.radius + state.player.radius + 10) {
      mine.life = 0;
      damagePlayer(18);
      explode(mine.x, mine.y, "#ff8b45", 18);
    }
  }
  state.mines = state.mines.filter((mine) => mine.life > 0);
}

function handleHits() {
  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (bullet.life <= 0 || dist(bullet, enemy) >= bullet.radius + enemy.radius) continue;
      bullet.life = bullet.pierce > 0 ? bullet.life : 0;
      if (bullet.pierce > 0) bullet.pierce -= 1;
      let damage = bullet.damage;
      if (enemy.shielded > 0) damage *= 0.45;
      if (enemy.type === "boss" && !hitBossWeakPoint(enemy, bullet)) damage *= 0.55;
      enemy.hp -= damage;
      enemy.hitFlash = 1;
      enemy.slow = Math.max(enemy.slow, bullet.freeze);
      enemy.poison = Math.max(enemy.poison, bullet.poison);
      enemy.burn = Math.max(enemy.burn, bullet.burn);
      spark(enemy.x, enemy.y, bullet.color, 5);
      spawnText(enemy.x, enemy.y - enemy.radius, Math.round(damage), damage > state.player.damage * 1.8 ? "#ffd166" : "#f5f7fb");
      if (state.player.explosion > 0 && enemy.hp <= 0) {
        for (const nearby of state.enemies) {
          if (nearby !== enemy && dist(enemy, nearby) < state.player.explosion) nearby.hp -= damage * 0.36;
        }
      }
    }
  }

  const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  for (const enemy of defeated) killEnemy(enemy);
}

function hitBossWeakPoint(boss, bullet) {
  const wx = boss.x + Math.cos(boss.weakAngle) * boss.radius * 0.78;
  const wy = boss.y + Math.sin(boss.weakAngle) * boss.radius * 0.56;
  return Math.hypot(bullet.x - wx, bullet.y - wy) < 24;
}

function killEnemy(enemy) {
  const isBoss = enemy.type === "boss";
  state.killsThisWave += isBoss ? state.waveTarget : 1;
  const rewardMult = 1 + state.player.luck;
  const coins = Math.ceil((isBoss ? 45 + state.planetIndex * 12 : enemy.coin) * rewardMult);
  const crystals = Math.ceil((isBoss ? 12 + state.planetIndex * 4 : enemy.value) * rewardMult);
  state.rewards.coins += coins;
  state.rewards.crystals += crystals;
  state.rewards.score += isBoss ? 1000 + state.planetIndex * 250 : enemy.xp * 10;
  dropPickup(enemy.x, enemy.y, "coin", coins);
  dropPickup(enemy.x, enemy.y, "crystal", crystals);
  explode(enemy.x, enemy.y, enemy.color, isBoss ? 70 : 18);
  debris(enemy.x, enemy.y, isBoss ? state.planet.asteroid : enemy.color, isBoss ? 26 : 8);
  playTone(isBoss ? 70 : 170, isBoss ? 0.55 : 0.12, "sawtooth", isBoss ? 0.09 : 0.045, isBoss ? -35 : -60);
  state.camera.shake = Math.max(state.camera.shake, isBoss ? 18 : 5);
  if (enemy.type === "asteroid" || enemy.type === "splitter") {
    if (enemy.radius > 15 && !isBoss) {
      spawnEnemy("drone", enemy.x + 16, enemy.y);
      spawnEnemy("drone", enemy.x - 16, enemy.y);
    }
  }
  if (isBoss) completePlanet();
}

function completePlanet() {
  const reward = state.planet.reward;
  save.coins += state.rewards.coins + reward.coins;
  save.crystals += state.rewards.crystals + reward.crystals;
  save.totalXp += state.rewards.score;
  save.playerLevel = Math.max(save.playerLevel, Math.floor(save.totalXp / 1000) + 1);
  save.unlockedPlanet = Math.max(save.unlockedPlanet, Math.min(PLANETS.length - 1, state.planetIndex + 1));
  for (const key of ["title", "ship", "weapon", "trail", "badge", "color"]) {
    if (reward[key] && !save.unlocks.includes(reward[key])) save.unlocks.push(reward[key]);
  }
  if (!save.achievements.includes(`Cleared ${state.planet.name}`)) save.achievements.push(`Cleared ${state.planet.name}`);
  saveGame();
  state.mode = "victory";
  startMusic("menu");
  for (let i = 0; i < 48; i += 1) spawnParticle("spark", canvas.width / 2, canvas.height / 2, choose(["#77ef8f", "#ffd166", "#43d5ff", "#f5f7fb"]), { speed: rand(80, 360), radius: rand(2, 5), life: rand(0.6, 1.4) });
  setOverlay(`
    <h1>Planet Cleared</h1>
    <p>${state.planet.name} defended. Reward chest unlocked: ${reward.coins} coins, ${reward.crystals} crystals${reward.ship ? `, ${reward.ship} ship` : ""}.</p>
    <div class="menu-actions">
      ${button("Next Planet", "levels")}
      ${button("Main Menu", "menu", "secondary")}
    </div>`, "victory");
}

function damagePlayer(amount) {
  const p = state.player;
  if (p.invuln > 0) return;
  p.invuln = 0.42;
  p.shieldPulse = 1;
  const shieldHit = Math.min(p.shield, amount);
  p.shield -= shieldHit;
  p.health -= amount - shieldHit;
  state.camera.shake = Math.max(state.camera.shake, 8);
  state.camera.flash = Math.max(state.camera.flash, 0.14);
  playTone(120, 0.12, "sawtooth", 0.06, -40);
  vibrate(35);
  if (p.health <= 0) {
    p.health = 0;
    state.mode = "gameover";
    startMusic("menu");
    for (let i = 0; i < 34; i += 1) smoke(p.x + rand(-18, 18), p.y + rand(-18, 18), "#ff5a6b");
    setOverlay(`<h1>Defeat</h1><p>You reached Planet ${state.planetIndex + 1}, Wave ${state.waveInPlanet}. Rewards banked this run: ${state.rewards.coins} coins and ${state.rewards.crystals} crystals.</p><div class="menu-actions">${button("Try Again", "restart")}${button("Main Menu", "menu", "secondary")}</div>`, "defeat");
  }
}

function dropPickup(x, y, type, count) {
  const maxDrops = Math.min(count, type === "coin" ? 8 : 12);
  for (let i = 0; i < maxDrops; i += 1) {
    state.pickups.push({
      x: clamp(x + rand(-18, 18), 20, canvas.width - 20),
      y: clamp(y + rand(-18, 18), 20, canvas.height - 20),
      vx: rand(-40, 40),
      vy: rand(-50, 15),
      radius: type === "coin" ? 5 : 6,
      type,
      value: Math.ceil(count / maxDrops),
      life: 18,
      spin: rand(0, TAU),
      bobSeed: rand(0, TAU),
      collected: false,
    });
  }
}

function updatePickups(dt) {
  const p = state.player;
  for (const pickup of state.pickups) {
    pickup.life -= dt;
    pickup.spin += dt * 3;
    pickup.vx *= 0.98;
    pickup.vy *= 0.98;
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt + Math.sin(state.time * 4 + pickup.spin) * 0.08;
    const d = dist(p, pickup);
    if (d < p.magnet) {
      const angle = Math.atan2(p.y - pickup.y, p.x - pickup.x);
      pickup.x += Math.cos(angle) * 360 * dt;
      pickup.y += Math.sin(angle) * 360 * dt;
    }
    if (d < p.radius + pickup.radius + 4) {
      pickup.collected = true;
      if (pickup.type === "crystal") {
        p.xp += pickup.value;
        sparkle(p.x, p.y, "#77ef8f");
        if (p.xp >= p.xpNext) {
          p.xp -= p.xpNext;
          p.level += 1;
          p.xpNext = Math.floor(p.xpNext * 1.42 + 4);
          beginUpgrade("Level up");
        }
      } else {
        sparkle(p.x, p.y, "#ffd166");
      }
      playTone(pickup.type === "coin" ? 540 : 740, 0.045, "triangle", 0.025, 140);
    }
  }
  state.pickups = state.pickups.filter((pickup) => !pickup.collected && pickup.life > 0);
}

function spawnParticle(kind, x, y, color, options = {}) {
  const particleCap = settings.lowFx ? 220 : 560;
  if (state.particles.length >= particleCap) return;
  const particle = pools.particles.pop() || {};
  const angle = options.angle ?? rand(0, TAU);
  const speed = options.speed ?? rand(40, 220);
  particle.kind = kind;
  particle.x = x;
  particle.y = y;
  particle.vx = Math.cos(angle) * speed + (options.vx || 0);
  particle.vy = Math.sin(angle) * speed + (options.vy || 0);
  particle.radius = options.radius ?? rand(2, 5);
  particle.life = options.life ?? rand(0.25, 0.8);
  particle.maxLife = particle.life;
  particle.color = color;
  particle.spin = rand(-4, 4);
  state.particles.push(particle);
}

function explode(x, y, color, count) {
  const amount = settings.lowFx ? Math.ceil(count * 0.45) : count;
  for (let i = 0; i < amount; i += 1) spawnParticle("spark", x, y, color, { speed: rand(90, 320), radius: rand(2, 5), life: rand(0.22, 0.78) });
  for (let i = 0; i < amount * 0.25; i += 1) smoke(x, y, color);
  ring(x, y, color, count);
}

function spark(x, y, color, count) {
  if (settings.lowFx) count = Math.ceil(count * 0.5);
  for (let i = 0; i < count; i += 1) spawnParticle("spark", x, y, color, { speed: rand(50, 170), radius: 2, life: rand(0.14, 0.34) });
}

function sparkle(x, y, color) {
  for (let i = 0; i < 5; i += 1) spawnParticle("spark", x, y, color, { speed: rand(30, 110), radius: 2, life: 0.28 });
}

function smoke(x, y, color) {
  spawnParticle("smoke", x + rand(-8, 8), y + rand(-8, 8), color, { speed: rand(8, 55), radius: rand(6, 13), life: rand(0.45, 1.1) });
}

function debris(x, y, color, count) {
  if (settings.lowFx) count = Math.ceil(count * 0.55);
  for (let i = 0; i < count; i += 1) spawnParticle("debris", x, y, color, { speed: rand(70, 250), radius: rand(3, 8), life: rand(0.6, 1.4) });
}

function exhaust(x, y, color) {
  if (Math.random() < 0.42 || settings.lowFx) return;
  spawnParticle("smoke", x, y, color, { speed: rand(12, 50), radius: rand(3, 7), life: rand(0.25, 0.5) });
}

function ring(x, y, color, size) {
  spawnParticle("ring", x, y, color, { speed: 0, radius: Math.max(12, size), life: 0.42 });
}

function spawnText(x, y, text, color) {
  const number = pools.numbers.pop() || {};
  number.x = x;
  number.y = y;
  number.vy = -38;
  number.life = 0.9;
  number.maxLife = 0.9;
  number.text = String(text);
  number.color = color;
  state.numbers.push(number);
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= particle.kind === "smoke" ? 0.985 : 0.96;
    particle.vy *= particle.kind === "smoke" ? 0.985 : 0.96;
    particle.life -= dt;
    if (particle.kind === "smoke") particle.radius += dt * 10;
    if (particle.kind === "ring") particle.radius += dt * 180;
  }
  for (const number of state.numbers) {
    number.y += number.vy * dt;
    number.life -= dt;
  }
  state.particles = state.particles.filter((particle) => {
    if (particle.life > 0) return true;
    if (pools.particles.length < 500) pools.particles.push(particle);
    return false;
  });
  state.numbers = state.numbers.filter((number) => {
    if (number.life > 0) return true;
    if (pools.numbers.length < 80) pools.numbers.push(number);
    return false;
  });
}

function updateBackground(dt) {
  const bg = state.background;
  const w = canvas.width;
  const h = canvas.height;
  for (const layer of bg.layers) {
    for (const star of layer) {
      star.y += star.speed * dt;
      star.x += Math.sin(state.time * 0.2 + star.y * 0.01) * dt * 8;
      if (star.y > h + 8) {
        star.y = -8;
        star.x = Math.random() * w;
      }
    }
  }
  for (const nebula of bg.nebulas) {
    nebula.x += Math.sin(state.time * nebula.drift) * dt * 4;
    nebula.y += Math.cos(state.time * nebula.drift) * dt * 3;
  }
  bg.shootingTimer -= dt;
  if (bg.shootingTimer <= 0 && !settings.lowFx) {
    bg.shootingStars.push({ x: rand(0, w), y: rand(0, h * 0.45), vx: rand(420, 680), vy: rand(160, 260), life: 0.75, maxLife: 0.75 });
    bg.shootingTimer = rand(5, 11);
  }
  for (const star of bg.shootingStars) {
    star.x += star.vx * dt;
    star.y += star.vy * dt;
    star.life -= dt;
  }
  bg.shootingStars = bg.shootingStars.filter((star) => star.life > 0);
}

function update(dt) {
  if (!state || state.mode !== "playing") return;
  state.time += dt;
  state.camera.shake = Math.max(0, state.camera.shake - dt * 22);
  state.camera.flash = Math.max(0, state.camera.flash - dt * 1.8);
  updateBackground(dt);
  spawnWave(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateMines(dt);
  handleHits();
  updatePickups(dt);
  updateParticles(dt);
  updateHud();
}

function updateHud() {
  const p = state.player;
  els.planet.textContent = state.planetIndex + 1;
  els.wave.textContent = state.waveInPlanet;
  els.level.textContent = p.level;
  els.crystals.textContent = save.crystals + state.rewards.crystals;
  els.coins.textContent = save.coins + state.rewards.coins;
  els.health.textContent = Math.ceil(p.health);
  els.healthBar.style.width = `${clamp(p.health / p.maxHealth, 0, 1) * 100}%`;
  els.xpBar.style.width = `${clamp(p.xp / p.xpNext, 0, 1) * 100}%`;
  const bossProgress = state.boss ? 1 - state.boss.hp / state.boss.maxHp : state.killsThisWave / state.waveTarget;
  els.waveBar.style.width = `${clamp(bossProgress, 0, 1) * 100}%`;
}

function draw() {
  if (!state) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawBackground(w, h);
  const shake = state.camera.shake;
  ctx.save();
  ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawPlanet(w, h);
  for (const pickup of state.pickups) drawPickup(pickup);
  for (const mine of state.mines) drawMine(mine);
  for (const bullet of state.bullets) drawPlayerBullet(bullet);
  for (const bullet of state.enemyBullets) drawEnemyBullet(bullet);
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const particle of state.particles) drawParticle(particle);
  drawPlayer();
  drawNumbers();
  ctx.restore();
  if (state.camera.flash > 0) {
    ctx.globalAlpha = state.camera.flash * 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawBackground(w, h) {
  const colors = state.planet.colors;
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.58, colors[1]);
  gradient.addColorStop(1, "#03040a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const nebula of state.background.nebulas) {
    const pulse = 1 + Math.sin(state.time * 0.35 + nebula.phase) * 0.04;
    const g = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r * pulse);
    g.addColorStop(0, `${nebula.hue}55`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nebula.x, nebula.y, nebula.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  for (const layer of state.background.layers) {
    for (const star of layer) {
      ctx.globalAlpha = star.a * (0.62 + Math.sin(state.time * star.twinkle + star.phase) * 0.28);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * (0.82 + Math.sin(state.time * star.twinkle + star.phase) * 0.18), 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (const star of state.background.shootingStars) {
    ctx.globalAlpha = star.life / star.maxLife;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(star.x, star.y);
    ctx.lineTo(star.x - 80, star.y - 30);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(w, h) {
  const x = w / 2;
  const y = h / 2;
  const r = 52;
  const colors = state.planet.colors;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.2);
  halo.addColorStop(0, `${colors[2]}55`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  const gradient = ctx.createRadialGradient(x - 18, y - 18, 8, x, y, r);
  gradient.addColorStop(0, colors[2]);
  gradient.addColorStop(0.5, colors[1]);
  gradient.addColorStop(1, colors[0]);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(x - 10, y - 10, 18, 8, -0.4, 0, TAU);
  ctx.ellipse(x + 20, y + 12, 16, 7, 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  const speed = Math.hypot(p.vx, p.vy);
  const idleBob = speed < 8 ? Math.sin(state.time * 3.2) * 2.5 : 0;
  const drewShip = assetManager.drawSprite(ctx, "pixel.ships", PIXEL_FRAMES.player, p.x, p.y + idleBob, 5 + p.recoil * 0.25, {
    rotation: p.angle + Math.PI / 2,
    shadowColor: p.color,
    shadowBlur: 6,
    alpha: p.invuln > 0 ? 0.82 : 1,
  });
  if (!drewShip) {
  ctx.save();
  ctx.translate(p.x, p.y + idleBob);
  ctx.rotate(p.angle);
  ctx.imageSmoothingEnabled = false;
  ctx.shadowBlur = 6;
  ctx.shadowColor = p.color;
  ctx.fillStyle = p.invuln > 0 ? "#ffffff" : p.color;
  ctx.beginPath();
  ctx.moveTo(20 - p.recoil * 4, 0);
  ctx.lineTo(-13, -12);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-13, 12);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = p.trail;
  ctx.beginPath();
  ctx.moveTo(-13, -6);
  ctx.lineTo(-24 - p.recoil * 8, 0);
  ctx.lineTo(-13, 6);
  ctx.fill();
  ctx.restore();
  }

  if (p.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28 + p.shieldPulse * 0.5;
    ctx.strokeStyle = "#77ef8f";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#77ef8f";
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.strokeRect(p.x - p.radius - 7, p.y - p.radius - 7, (p.radius + 7) * 2, (p.radius + 7) * 2);
    ctx.restore();
    assetManager.drawSprite(ctx, "pixel.projectiles", PIXEL_FRAMES.shield, p.x, p.y, 3.3 + p.shieldPulse * 0.25, {
      alpha: 0.2 + p.shieldPulse * 0.18,
    });
  }

  for (let i = 0; i < p.drones; i += 1) {
    const a = state.time * 2.2 + (i / p.drones) * TAU;
    drawGlowCircle(p.x + Math.cos(a) * 35, p.y + Math.sin(a) * 35, 6, "#b083ff");
  }
}

function drawEnemy(enemy) {
  const hover = enemy.type === "boss" ? 0 : Math.sin(state.time * 3 + enemy.bobSeed) * 3;
  const tellShake = enemy.attackTell > 0 ? rand(-enemy.attackTell * 4, enemy.attackTell * 4) : 0;
  const frame = getEnemyFrame(enemy);
  const scale = enemy.type === "boss" ? Math.max(2.4, enemy.radius / 10) : Math.max(2.2, enemy.radius / 4.2);
  ctx.save();
  ctx.translate(enemy.x + tellShake, enemy.y + hover);
  ctx.rotate(enemy.angle + Math.sin(state.time * 1.6 + enemy.bobSeed) * 0.04);
  ctx.globalAlpha = enemy.spawnGrace > 0 ? 0.55 : 1;
  ctx.imageSmoothingEnabled = false;
  ctx.shadowBlur = enemy.hitFlash > 0 ? 8 : 0;
  ctx.shadowColor = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  if (!assetManager.drawSprite(ctx, "pixel.ships", frame, 0, 0, scale, { alpha: enemy.hitFlash > 0 ? 0.78 : 1 })) {
    if (enemy.type === "boss") drawBossBody(enemy);
    else if (enemy.shape === "rock") drawRock(enemy.radius, enemy.type === "asteroid" ? state.planet.asteroid : enemy.color);
    else if (enemy.shape === "tank") drawTank(enemy.radius);
    else if (enemy.shape === "diamond") drawDiamond(enemy.radius);
    else if (enemy.shape === "round") drawRound(enemy.radius);
    else if (enemy.shape === "needle") drawNeedle(enemy.radius);
    else if (enemy.shape === "shield") drawShieldCarrier(enemy.radius);
    else drawDart(enemy.radius);
  }
  ctx.restore();

  if (enemy.shielded > 0) {
    enemy.shielded = Math.max(0, enemy.shielded - 0.016);
    ctx.strokeStyle = "rgba(119, 239, 143, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 9, 0, TAU);
    ctx.stroke();
  }

  if (enemy.hp < enemy.maxHp) drawHealthBar(enemy);
  if (enemy.type === "boss") drawWeakPoint(enemy);
}

function getEnemyFrame(enemy) {
  if (enemy.type === "boss") return PIXEL_FRAMES.boss;
  if (enemy.type === "tank" || enemy.type === "shieldCarrier") return PIXEL_FRAMES.tank;
  if (enemy.type === "shooter" || enemy.type === "laserDrone" || enemy.type === "sniper") return PIXEL_FRAMES.drone;
  return PIXEL_FRAMES.scout;
}

function drawBossBody(boss) {
  const pulse = 1 + boss.attackTell * 0.08 + Math.sin(state.time * 4) * 0.015;
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  ctx.ellipse(0, 0, boss.radius * 1.25, boss.radius * 0.76, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(-boss.radius * 0.62, -8, boss.radius * 1.24, 16);
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(-boss.radius * 0.38, -boss.radius * 0.16, 8, 0, TAU);
  ctx.arc(boss.radius * 0.38, -boss.radius * 0.16, 8, 0, TAU);
  ctx.fill();
}

function drawRock(radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * TAU;
    const r = radius * (0.78 + ((i * 37) % 19) / 100);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDart(radius) {
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(-radius, -radius * 0.72);
  ctx.lineTo(-radius * 0.45, 0);
  ctx.lineTo(-radius, radius * 0.72);
  ctx.closePath();
  ctx.fill();
}

function drawTank(radius) {
  ctx.fillRect(-radius, -radius * 0.7, radius * 2, radius * 1.4);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-radius * 0.2, -radius, radius * 0.4, radius * 2);
}

function drawDiamond(radius) {
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius, 0);
  ctx.lineTo(0, radius);
  ctx.lineTo(-radius, 0);
  ctx.closePath();
  ctx.fill();
}

function drawRound(radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.48, 0, TAU);
  ctx.fill();
}

function drawNeedle(radius) {
  ctx.beginPath();
  ctx.moveTo(radius * 1.25, 0);
  ctx.lineTo(-radius, -radius * 0.35);
  ctx.lineTo(-radius * 0.45, 0);
  ctx.lineTo(-radius, radius * 0.35);
  ctx.closePath();
  ctx.fill();
}

function drawShieldCarrier(radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(-radius * 0.48, -radius * 0.48, radius * 0.96, radius * 0.96);
}

function drawWeakPoint(boss) {
  const wx = boss.x + Math.cos(boss.weakAngle) * boss.radius * 0.78;
  const wy = boss.y + Math.sin(boss.weakAngle) * boss.radius * 0.56;
  drawGlowCircle(wx, wy, 10, "#ffd166");
}

function drawHealthBar(enemy) {
  const width = enemy.type === "boss" ? 170 : enemy.radius * 2;
  const y = enemy.y - enemy.radius - 13;
  ctx.fillStyle = "#1f2635";
  ctx.fillRect(enemy.x - width / 2, y, width, 5);
  ctx.fillStyle = enemy.type === "boss" ? "#ff5a6b" : "#77ef8f";
  ctx.fillRect(enemy.x - width / 2, y, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 5);
}

function drawPickup(pickup) {
  const bob = Math.sin(state.time * 5 + pickup.bobSeed) * 5;
  const scale = 1 + Math.sin(state.time * 4 + pickup.bobSeed) * 0.08;
  if (pickup.type === "coin") {
    if (assetManager.drawSprite(ctx, "pixel.misc", PIXEL_FRAMES.coin, pickup.x, pickup.y + bob, 2.6 * scale)) return;
    drawGlowCircle(pickup.x, pickup.y + bob, pickup.radius * scale, "#ffd166");
    ctx.fillStyle = "#5b3d00";
    ctx.fillRect(pickup.x - 1, pickup.y + bob - 4, 2, 8);
  } else {
    if (assetManager.drawSprite(ctx, "pixel.misc", PIXEL_FRAMES.crystal, pickup.x, pickup.y + bob, 2.8 * scale, { rotation: pickup.spin })) return;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.scale(scale, scale);
    ctx.rotate(pickup.spin);
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#77ef8f";
    ctx.fillStyle = "#77ef8f";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawMine(mine) {
  const pulse = 1 + Math.sin(mine.pulse * 8) * 0.16;
  drawGlowCircle(mine.x, mine.y, mine.radius * pulse, "#ff8b45");
}

function drawPlayerBullet(bullet) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(bullet.x), Math.round(bullet.y));
  ctx.rotate(bullet.angle || Math.atan2(bullet.vy, bullet.vx));
  ctx.fillStyle = bullet.color;
  ctx.fillRect(-2, -1, 6, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(2, 0, 2, 1);
  ctx.restore();
}

function drawEnemyBullet(bullet) {
  ctx.save();
  ctx.fillStyle = bullet.color || "#ffcf5a";
  ctx.fillRect(Math.round(bullet.x - bullet.radius), Math.round(bullet.y - bullet.radius), bullet.radius * 2, bullet.radius * 2);
  ctx.restore();
}

function drawGlowCircle(x, y, radius, color) {
  ctx.save();
  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawParticle(particle) {
  const alpha = clamp(particle.life / particle.maxLife, 0, 1);
  ctx.save();
  ctx.globalAlpha = particle.kind === "smoke" ? alpha * 0.35 : alpha;
  ctx.fillStyle = particle.color;
  if (particle.kind === "ring") {
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 3 * alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    ctx.stroke();
  } else if (particle.kind === "debris") {
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.spin * state.time);
    ctx.fillRect(-particle.radius * 0.5, -particle.radius * 0.3, particle.radius, particle.radius * 0.6);
  } else {
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawNumbers() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = '8px "Press Start 2P", monospace';
  for (const number of state.numbers) {
    ctx.globalAlpha = clamp(number.life / number.maxLife, 0, 1);
    ctx.fillStyle = number.color;
    ctx.fillText(number.text, number.x, number.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function loop(now) {
  if (!state || state.mode !== "playing") return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.add(key);
  if (key === "p") pauseGame();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  keys.delete(key);
});
window.addEventListener("resize", () => {
  resizeCanvas();
  if (state) state.background = createBackground(canvas.width, canvas.height, state.planetIndex);
  draw();
});

canvas.addEventListener("pointerdown", (event) => {
  pointerActive = true;
  updatePointer(event);
});
canvas.addEventListener("pointermove", updatePointer);
window.addEventListener("pointerup", () => {
  pointerActive = false;
  pointerVector = { x: 0, y: 0 };
  els.touchStick.querySelector("span").style.transform = "translate(0, 0)";
});

function updatePointer(event) {
  if (!pointerActive) return;
  const rect = canvas.getBoundingClientRect();
  const center = { x: rect.left + 70, y: rect.bottom - 70 };
  const x = clamp((event.clientX - center.x) / 45, -1, 1);
  const y = clamp((event.clientY - center.y) / 45, -1, 1);
  pointerVector = { x, y };
  els.touchStick.querySelector("span").style.transform = `translate(${x * 24}px, ${y * 24}px)`;
}

els.overlay.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  handleOverlayAction(action);
});
els.helpButton.addEventListener("click", renderHelp);
els.restartButton.addEventListener("click", startGame);
els.pauseButton.addEventListener("click", pauseGame);

resizeCanvas();
state = makeState();
updateHud();
renderMenu();
draw();
assetManager
  .loadManifest()
  .then(() => assetManager.preload())
  .then(() => draw());
