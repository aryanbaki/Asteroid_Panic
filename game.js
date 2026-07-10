const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const els = {
  wave: document.querySelector("#wave"),
  level: document.querySelector("#level"),
  crystals: document.querySelector("#crystals"),
  health: document.querySelector("#health"),
  healthBar: document.querySelector("#healthBar"),
  xpBar: document.querySelector("#xpBar"),
  waveBar: document.querySelector("#waveBar"),
  overlay: document.querySelector("#overlay"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  restartButton: document.querySelector("#restartButton"),
  touchStick: document.querySelector("#touchStick"),
};

const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let keys = new Set();
let pointerVector = { x: 0, y: 0 };
let pointerActive = false;
let lastTime = 0;
let state;

const upgradePool = [
  { name: "+20% Damage", apply: () => (state.player.damage *= 1.2) },
  { name: "+15% Fire Rate", apply: () => (state.player.fireRate *= 1.15) },
  { name: "+1 Bullet", apply: () => (state.player.bullets += 1) },
  { name: "+20% Movement", apply: () => (state.player.speed *= 1.2) },
  { name: "Critical Hits", apply: () => (state.player.crit += 0.12) },
  { name: "Shield", apply: () => (state.player.shield = Math.min(70, state.player.shield + 35)) },
  { name: "Magnet", apply: () => (state.player.magnet += 45) },
  { name: "Explosion Radius", apply: () => (state.player.explosion += 15) },
];

function makeState() {
  const width = canvas.clientWidth || 960;
  const height = canvas.clientHeight || 600;
  return {
    mode: "menu",
    time: 0,
    wave: 1,
    killsThisWave: 0,
    waveTarget: 12,
    spawnTimer: 0,
    bossSpawned: false,
    upgradeChoices: [],
    stars: Array.from({ length: 100 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: rand(0.5, 1.8),
      a: rand(0.2, 0.8),
    })),
    player: {
      x: width / 2,
      y: height / 2,
      radius: 16,
      speed: 245,
      health: 100,
      maxHealth: 100,
      shield: 0,
      level: 1,
      xp: 0,
      xpNext: 8,
      crystals: 0,
      damage: 20,
      fireRate: 2.8,
      fireCooldown: 0,
      bullets: 1,
      crit: 0.05,
      magnet: 82,
      explosion: 0,
      invuln: 0,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    crystals: [],
    particles: [],
  };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startGame() {
  resizeCanvas();
  state = makeState();
  state.mode = "playing";
  els.overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function pauseGame() {
  if (!state || state.mode === "menu" || state.mode === "gameover") return;
  state.mode = state.mode === "paused" ? "playing" : "paused";
  els.pauseButton.textContent = state.mode === "paused" ? "Resume" : "Pause";
  if (state.mode === "playing") {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  } else {
    showOverlay("Paused", "Catch your breath. The asteroids can wait.", "Resume");
  }
}

function showOverlay(title, text, buttonText) {
  els.overlay.innerHTML = `<h1>${title}</h1><p>${text}</p><button id="overlayButton" type="button">${buttonText}</button>`;
  els.overlay.classList.remove("hidden");
  document.querySelector("#overlayButton").addEventListener("click", () => {
    if (state.mode === "paused") pauseGame();
    else if (state.mode === "upgrade") takeUpgrade(0);
    else startGame();
  });
}

function getMoveVector() {
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  if (pointerActive) {
    x += pointerVector.x;
    y += pointerVector.y;
  }
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length, moving: Math.abs(x) + Math.abs(y) > 0 };
}

function spawnAtEdge(type) {
  const side = Math.floor(Math.random() * 4);
  const margin = 35;
  const x = side === 0 ? -margin : side === 1 ? canvas.clientWidth + margin : rand(0, canvas.clientWidth);
  const y = side === 2 ? -margin : side === 3 ? canvas.clientHeight + margin : rand(0, canvas.clientHeight);
  spawnEnemy(type, x, y);
}

function spawnEnemy(type, x, y) {
  const base = {
    x,
    y,
    type,
    cooldown: rand(0.2, 1.4),
    charge: rand(0.6, 1.5),
    angle: rand(0, TAU),
  };
  const settings = {
    asteroid: { radius: 28, hp: 34, speed: 46, color: "#9aa7bd", value: 2 },
    drone: { radius: 14, hp: 18, speed: 112, color: "#ff5a6b", value: 1 },
    shooter: { radius: 17, hp: 32, speed: 72, color: "#ffd166", value: 2 },
    kamikaze: { radius: 16, hp: 28, speed: 86, color: "#ff8b45", value: 3 },
    mother: { radius: 42, hp: 420 + state.wave * 70, speed: 36, color: "#b083ff", value: 16 },
  };
  state.enemies.push({ ...base, ...settings[type], maxHp: settings[type].hp });
}

function spawnWave(dt) {
  if (state.killsThisWave >= state.waveTarget && state.enemies.length === 0) {
    beginUpgrade();
    return;
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.killsThisWave + state.enemies.length < state.waveTarget) {
    const roll = Math.random();
    const type =
      state.wave % 5 === 0 && !state.bossSpawned
        ? "mother"
        : roll < 0.28
          ? "asteroid"
          : roll < 0.62
            ? "drone"
            : roll < 0.82
              ? "shooter"
              : "kamikaze";
    if (type === "mother") state.bossSpawned = true;
    spawnAtEdge(type);
    state.spawnTimer = Math.max(0.25, 1.15 - state.wave * 0.055);
  }
}

function beginUpgrade() {
  state.mode = "upgrade";
  state.wave += 1;
  state.killsThisWave = 0;
  state.waveTarget = 10 + state.wave * 4;
  state.bossSpawned = false;
  state.upgradeChoices = [...upgradePool].sort(() => Math.random() - 0.5).slice(0, 3);
  const buttons = state.upgradeChoices
    .map((upgrade, index) => `<button class="upgrade" data-upgrade="${index}" type="button">${upgrade.name}</button>`)
    .join("");
  els.overlay.innerHTML = `<h1>Upgrade</h1><p>Wave cleared. Pick a boost before the panic resumes.</p><div class="upgrade-list">${buttons}</div>`;
  els.overlay.classList.remove("hidden");
  document.querySelectorAll(".upgrade").forEach((button) => {
    button.addEventListener("click", () => takeUpgrade(Number(button.dataset.upgrade)));
  });
}

function takeUpgrade(index) {
  const upgrade = state.upgradeChoices[index] || state.upgradeChoices[0];
  upgrade.apply();
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 18);
  state.mode = "playing";
  els.overlay.classList.add("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function updatePlayer(dt) {
  const player = state.player;
  const move = getMoveVector();
  if (move.moving) {
    player.x += move.x * player.speed * dt;
    player.y += move.y * player.speed * dt;
  }
  player.x = clamp(player.x, player.radius, canvas.clientWidth - player.radius);
  player.y = clamp(player.y, player.radius, canvas.clientHeight - player.radius);
  player.invuln = Math.max(0, player.invuln - dt);

  player.fireCooldown -= dt;
  if (player.fireCooldown <= 0) {
    fireAtNearestEnemy();
    player.fireCooldown = 1 / player.fireRate;
  }
}

function fireAtNearestEnemy() {
  if (!state.enemies.length) return;
  const player = state.player;
  const target = state.enemies.reduce((best, enemy) => (dist(player, enemy) < dist(player, best) ? enemy : best));
  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  const spread = 0.22;
  for (let i = 0; i < player.bullets; i += 1) {
    const offset = (i - (player.bullets - 1) / 2) * spread;
    state.bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle + offset) * 520,
      vy: Math.sin(angle + offset) * 520,
      radius: 5,
      life: 1.2,
      damage: player.damage * (Math.random() < player.crit ? 2.2 : 1),
    });
  }
}

function updateEnemies(dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.cooldown -= dt;
    enemy.charge -= dt;

    if (enemy.type === "shooter") {
      const d = dist(player, enemy);
      const direction = d < 210 ? -1 : 1;
      enemy.x += Math.cos(angle) * enemy.speed * direction * dt;
      enemy.y += Math.sin(angle) * enemy.speed * direction * dt;
      if (enemy.cooldown <= 0) {
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 240,
          vy: Math.sin(angle) * 240,
          radius: 5,
          life: 3,
        });
        enemy.cooldown = 1.6;
      }
    } else if (enemy.type === "mother") {
      enemy.x += Math.cos(angle) * enemy.speed * dt;
      enemy.y += Math.sin(angle) * enemy.speed * dt;
      if (enemy.cooldown <= 0) {
        spawnEnemy(Math.random() < 0.5 ? "drone" : "shooter", enemy.x + rand(-35, 35), enemy.y + rand(-35, 35));
        enemy.cooldown = 2.1;
      }
    } else {
      const speed = enemy.type === "kamikaze" && enemy.charge <= 0 ? enemy.speed * 2.3 : enemy.speed;
      enemy.x += Math.cos(angle) * speed * dt;
      enemy.y += Math.sin(angle) * speed * dt;
    }

    if (dist(player, enemy) < player.radius + enemy.radius && player.invuln <= 0) {
      damagePlayer(enemy.type === "kamikaze" ? 24 : 12);
      enemy.hp -= enemy.type === "kamikaze" ? 999 : 16;
    }
  }
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (dist(bullet, state.player) < bullet.radius + state.player.radius) {
      bullet.life = 0;
      damagePlayer(10);
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0);
  state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.life > 0);
}

function handleHits() {
  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (bullet.life > 0 && dist(bullet, enemy) < bullet.radius + enemy.radius) {
        bullet.life = 0;
        enemy.hp -= bullet.damage;
        burst(enemy.x, enemy.y, enemy.color, 4);
        if (state.player.explosion > 0) {
          for (const nearby of state.enemies) {
            if (nearby !== enemy && dist(enemy, nearby) < state.player.explosion) nearby.hp -= bullet.damage * 0.35;
          }
        }
      }
    }
  }

  const defeated = state.enemies.filter((enemy) => enemy.hp <= 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  for (const enemy of defeated) {
    state.killsThisWave += enemy.type === "mother" ? 6 : 1;
    dropCrystal(enemy.x, enemy.y, enemy.value);
    burst(enemy.x, enemy.y, enemy.color, enemy.type === "mother" ? 30 : 12);
    if (enemy.type === "asteroid" && enemy.radius > 16) {
      spawnEnemy("drone", enemy.x + 10, enemy.y);
      spawnEnemy("drone", enemy.x - 10, enemy.y);
    }
  }
}

function damagePlayer(amount) {
  const player = state.player;
  player.invuln = 0.45;
  const shieldHit = Math.min(player.shield, amount);
  player.shield -= shieldHit;
  player.health -= amount - shieldHit;
  if (player.health <= 0) {
    player.health = 0;
    state.mode = "gameover";
    showOverlay("Game Over", `You reached wave ${state.wave} and banked ${player.crystals} crystals.`, "Play Again");
  }
}

function dropCrystal(x, y, value) {
  for (let i = 0; i < value; i += 1) {
    state.crystals.push({ x: x + rand(-10, 10), y: y + rand(-10, 10), radius: 6, value: 1 });
  }
}

function updateCrystals(dt) {
  const player = state.player;
  for (const crystal of state.crystals) {
    const d = dist(player, crystal);
    if (d < player.magnet) {
      const angle = Math.atan2(player.y - crystal.y, player.x - crystal.x);
      crystal.x += Math.cos(angle) * 300 * dt;
      crystal.y += Math.sin(angle) * 300 * dt;
    }
    if (d < player.radius + crystal.radius) {
      crystal.collected = true;
      player.crystals += crystal.value;
      player.xp += crystal.value;
      if (player.xp >= player.xpNext) {
        player.xp -= player.xpNext;
        player.level += 1;
        player.xpNext = Math.floor(player.xpNext * 1.45 + 2);
        beginUpgrade();
      }
    }
  }
  state.crystals = state.crystals.filter((crystal) => !crystal.collected);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, TAU);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * rand(60, 240),
      vy: Math.sin(angle) * rand(60, 240),
      life: rand(0.25, 0.65),
      color,
    });
  }
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function update(dt) {
  if (state.mode !== "playing") return;
  state.time += dt;
  spawnWave(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  handleHits();
  updateCrystals(dt);
  updateParticles(dt);
  updateHud();
}

function updateHud() {
  const player = state.player;
  els.wave.textContent = state.wave;
  els.level.textContent = player.level;
  els.crystals.textContent = player.crystals;
  els.health.textContent = Math.ceil(player.health);
  els.healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
  els.xpBar.style.width = `${(player.xp / player.xpNext) * 100}%`;
  els.waveBar.style.width = `${clamp(state.killsThisWave / state.waveTarget, 0, 1) * 100}%`;
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#080b12";
  ctx.fillRect(0, 0, w, h);

  for (const star of state.stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x % w, star.y % h, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawEarth(w, h);
  for (const crystal of state.crystals) drawCrystal(crystal);
  for (const bullet of state.bullets) drawCircle(bullet.x, bullet.y, bullet.radius, "#55dcff");
  for (const bullet of state.enemyBullets) drawCircle(bullet.x, bullet.y, bullet.radius, "#ffcf5a");
  for (const enemy of state.enemies) drawEnemy(enemy);
  for (const particle of state.particles) drawCircle(particle.x, particle.y, 3, particle.color, particle.life);
  drawPlayer();
}

function drawEarth(w, h) {
  const x = w / 2;
  const y = h / 2;
  const r = 54;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#43d5ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + Math.sin(state.time * 2) * 4, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const gradient = ctx.createRadialGradient(x - 18, y - 18, 8, x, y, r);
  gradient.addColorStop(0, "#81f4ff");
  gradient.addColorStop(0.48, "#2072d6");
  gradient.addColorStop(1, "#102a64");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(119, 239, 143, 0.85)";
  ctx.beginPath();
  ctx.ellipse(x - 10, y - 8, 18, 9, -0.4, 0, TAU);
  ctx.ellipse(x + 18, y + 11, 13, 7, 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(state.time * 3);
  ctx.fillStyle = p.invuln > 0 ? "#ffffff" : "#43d5ff";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (p.shield > 0) {
    ctx.strokeStyle = "rgba(119, 239, 143, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 8, 0, TAU);
    ctx.stroke();
  }
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.angle + state.time);
  ctx.fillStyle = enemy.color;
  if (enemy.type === "asteroid") {
    ctx.beginPath();
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * TAU;
      const r = enemy.radius * rand(0.72, 1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (enemy.type === "mother") {
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.radius * 1.25, enemy.radius * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#271046";
    ctx.fillRect(-24, -7, 48, 14);
  } else {
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(-enemy.radius, -enemy.radius * 0.75);
    ctx.lineTo(-enemy.radius * 0.55, 0);
    ctx.lineTo(-enemy.radius, enemy.radius * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  if (enemy.hp < enemy.maxHp) {
    ctx.fillStyle = "#1f2635";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2, 4);
    ctx.fillStyle = "#77ef8f";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 4);
  }
}

function drawCrystal(crystal) {
  ctx.save();
  ctx.translate(crystal.x, crystal.y);
  ctx.rotate(state.time * 2);
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

function drawCircle(x, y, radius, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
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
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "p") pauseGame();
});

window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("resize", resizeCanvas);

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

els.startButton.addEventListener("click", startGame);
els.restartButton.addEventListener("click", startGame);
els.pauseButton.addEventListener("click", pauseGame);

resizeCanvas();
state = makeState();
draw();
