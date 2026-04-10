// ============================================================
// Snake.io — Fully client-side game with AI bots + skins
// ============================================================

(() => {
  'use strict';

  // --- DOM ---
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const skinScreen = document.getElementById('skinScreen');
  const deathScreen = document.getElementById('deathScreen');
  const hud = document.getElementById('hud');
  const nameInput = document.getElementById('nameInput');
  const playBtn = document.getElementById('playBtn');
  const skinsBtn = document.getElementById('skinsBtn');
  const skinBackBtn = document.getElementById('skinBackBtn');
  const skinGrid = document.getElementById('skinGrid');
  const respawnBtn = document.getElementById('respawnBtn');
  const leaderboardEntries = document.getElementById('leaderboardEntries');
  const myScoreEl = document.getElementById('myScore');
  const finalScoreEl = document.getElementById('finalScore');
  const playerCountEl = document.getElementById('playerCount');
  const minimapCanvas = document.getElementById('minimap');
  const minimapCtx = minimapCanvas.getContext('2d');

  // --- Config ---
  const MAP_SIZE = 6000;
  const FOOD_COUNT = 800;
  const FOOD_RADIUS = 8;
  const SNAKE_SPEED = 200;
  const BOOST_SPEED = 400;
  const SEGMENT_SPACING = 16;
  const INITIAL_LENGTH = 10;
  const HEAD_RADIUS = 14;
  const BODY_RADIUS = 12;
  const BOOST_SHRINK_RATE = 0.5;
  const BOT_COUNT = 15;
  const COLORS = ['#0ff', '#f0f', '#0f0', '#ff0', '#f80', '#08f', '#f44', '#8f0'];
  const BOT_NAMES = [
    'Viper', 'Shadow', 'Blaze', 'Neon', 'Ghost', 'Toxic', 'Pixel', 'Glitch',
    'Storm', 'Bolt', 'Ember', 'Frost', 'Nova', 'Pulse', 'Drift', 'Surge',
    'Zenith', 'Razor', 'Flux', 'Echo', 'Orbit', 'Prism', 'Hex', 'Chrome'
  ];

  // --- Skins ---
  // Each skin has a name and a colors array.
  // Single-color = solid skin, multi-color = dots cycle through the palette.
  const SKINS = [
    { name: 'Cyan',       colors: ['#0ff'] },
    { name: 'Magenta',    colors: ['#f0f'] },
    { name: 'Lime',       colors: ['#0f0'] },
    { name: 'Gold',       colors: ['#ff0'] },
    { name: 'Coral',      colors: ['#f44'] },
    { name: 'Sky',        colors: ['#08f'] },
    { name: 'Sunset',     colors: ['#f80', '#f44', '#ff0'] },
    { name: 'Ocean',      colors: ['#0ff', '#08f', '#04d'] },
    { name: 'Toxic',      colors: ['#0f0', '#ff0', '#0f0'] },
    { name: 'Neon Party', colors: ['#f0f', '#0ff', '#ff0', '#0f0'] },
    { name: 'Fire',       colors: ['#f44', '#f80', '#ff0'] },
    { name: 'Galaxy',     colors: ['#a0f', '#08f', '#f0f', '#0ff'] },
    { name: 'Candy',      colors: ['#f0f', '#fff', '#f0f', '#fff'] },
    { name: 'Ice',        colors: ['#aef', '#0ff', '#fff'] },
    { name: 'Lava',       colors: ['#f44', '#f80', '#ff0', '#f44'] },
    { name: 'Rainbow',    colors: ['#f44', '#f80', '#ff0', '#0f0', '#08f', '#a0f'] },
  ];

  let selectedSkin = 0;

  // --- Build skin picker UI ---
  function buildSkinGrid() {
    skinGrid.innerHTML = '';
    SKINS.forEach((skin, idx) => {
      const card = document.createElement('div');
      card.className = 'skin-card' + (idx === selectedSkin ? ' selected' : '');
      card.dataset.idx = idx;

      const dotsDiv = document.createElement('div');
      dotsDiv.className = 'skin-dots';
      // Show up to 6 preview dots
      const previewCount = Math.min(skin.colors.length >= 2 ? 5 : 3, 6);
      for (let i = 0; i < previewCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'skin-dot';
        const c = skin.colors[i % skin.colors.length];
        dot.style.background = c;
        dot.style.boxShadow = `0 0 6px ${c}`;
        // Taper size for body feel
        const size = i === 0 ? 16 : 14 - i;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dotsDiv.appendChild(dot);
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'skin-name';
      nameDiv.textContent = skin.name;

      card.appendChild(dotsDiv);
      card.appendChild(nameDiv);

      card.addEventListener('click', () => {
        selectedSkin = idx;
        document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });

      skinGrid.appendChild(card);
    });
  }
  buildSkinGrid();

  // --- Skin screen nav ---
  skinsBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';
    skinScreen.style.display = 'flex';
  });
  skinBackBtn.addEventListener('click', () => {
    skinScreen.style.display = 'none';
    startScreen.style.display = 'flex';
  });

  // --- Game state ---
  let snakes = [];
  let food = [];
  let particles = [];
  let myId = null;
  let nextId = 1;
  let running = false;
  let camera = { x: 0, y: 0 };
  let mouseX = 0, mouseY = 0;
  let boosting = false;
  let screenShake = 0;
  let lastFrame = 0;
  let animTime = 0;

  // --- Resize ---
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Input ---
  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('mousedown', () => { boosting = true; });
  canvas.addEventListener('mouseup', () => { boosting = false; });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); boosting = true; } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') boosting = false; });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
    if (e.touches.length >= 2) boosting = true;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => { if (e.touches.length < 2) boosting = false; });

  // --- Play ---
  playBtn.addEventListener('click', startGame);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
  respawnBtn.addEventListener('click', startGame);

  function startGame() {
    const name = nameInput.value.trim() || 'Player';
    initGame(name);
    startScreen.style.display = 'none';
    skinScreen.style.display = 'none';
    deathScreen.style.display = 'none';
    hud.style.display = 'block';
    document.body.style.cursor = 'crosshair';
    running = true;
  }

  // --- Game init ---
  function initGame(playerName) {
    snakes = [];
    food = [];
    particles = [];
    nextId = 1;

    // Spawn player with selected skin
    const player = createSnake(playerName, false, selectedSkin);
    myId = player.id;

    // Spawn bots with random skins
    for (let i = 0; i < BOT_COUNT; i++) {
      createSnake(BOT_NAMES[i % BOT_NAMES.length], true, Math.floor(Math.random() * SKINS.length));
    }

    // Spawn food
    for (let i = 0; i < FOOD_COUNT; i++) {
      food.push(createFood());
    }

    camera.x = player.segments[0].x;
    camera.y = player.segments[0].y;
  }

  function createSnake(name, isBot, skinIdx) {
    const id = nextId++;
    const angle = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const y = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }
    const skin = SKINS[skinIdx] || SKINS[0];
    const snake = {
      id, name, segments, angle,
      targetAngle: angle,
      boosting: false,
      score: 0,
      skin: skinIdx,
      // Keep a single color index for food drops / minimap (first color of skin)
      color: COLORS.indexOf(skin.colors[0]) >= 0 ? COLORS.indexOf(skin.colors[0]) : 0,
      alive: true,
      isBot,
      boostAccum: 0,
      botTimer: 0,
      botWanderAngle: angle,
    };
    snakes.push(snake);
    return snake;
  }

  function createFood() {
    return {
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      color: Math.floor(Math.random() * COLORS.length),
      radius: FOOD_RADIUS + Math.random() * 4,
    };
  }

  // --- Get color for a specific segment index of a snake ---
  function getSegColor(snake, segIndex) {
    const skin = SKINS[snake.skin] || SKINS[0];
    return skin.colors[segIndex % skin.colors.length];
  }

  // --- Bot AI ---
  function updateBotAI(snake, dt) {
    snake.botTimer -= dt;
    if (snake.botTimer > 0) return;
    snake.botTimer = 0.3 + Math.random() * 0.5;

    const head = snake.segments[0];
    const half = MAP_SIZE / 2 - 200;

    if (Math.abs(head.x) > half || Math.abs(head.y) > half) {
      snake.targetAngle = Math.atan2(-head.y, -head.x);
      snake.boosting = true;
      return;
    }

    let closestFood = null;
    let closestDist = 400;
    for (const f of food) {
      const dx = f.x - head.x;
      const dy = f.y - head.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < closestDist) { closestDist = d; closestFood = f; }
    }

    let threatened = false;
    for (const other of snakes) {
      if (other.id === snake.id || !other.alive) continue;
      const ohead = other.segments[0];
      const dx = ohead.x - head.x;
      const dy = ohead.y - head.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 150) {
        snake.targetAngle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.5;
        snake.boosting = d < 80;
        threatened = true;
        break;
      }
    }

    if (!threatened) {
      if (closestFood) {
        snake.targetAngle = Math.atan2(closestFood.y - head.y, closestFood.x - head.x);
        snake.boosting = false;
      } else {
        snake.botWanderAngle += (Math.random() - 0.5) * 1.5;
        snake.targetAngle = snake.botWanderAngle;
        snake.boosting = false;
      }
    }
  }

  // --- Physics ---
  function updateSnake(snake, dt) {
    let angleDiff = snake.targetAngle - snake.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const turnSpeed = 4.0;
    if (Math.abs(angleDiff) < turnSpeed * dt) {
      snake.angle = snake.targetAngle;
    } else {
      snake.angle += Math.sign(angleDiff) * turnSpeed * dt;
    }

    const speed = snake.boosting ? BOOST_SPEED : SNAKE_SPEED;
    const head = snake.segments[0];
    const newHead = {
      x: head.x + Math.cos(snake.angle) * speed * dt,
      y: head.y + Math.sin(snake.angle) * speed * dt,
    };

    const half = MAP_SIZE / 2;
    if (newHead.x < -half || newHead.x > half || newHead.y < -half || newHead.y > half) {
      killSnake(snake, null);
      return;
    }

    snake.segments.unshift(newHead);
    const targetLength = INITIAL_LENGTH + snake.score;
    while (snake.segments.length > targetLength) snake.segments.pop();

    if (snake.boosting && snake.segments.length > 5) {
      snake.boostAccum += BOOST_SHRINK_RATE * dt;
      if (snake.boostAccum >= 1) {
        const removed = Math.floor(snake.boostAccum);
        snake.boostAccum -= removed;
        for (let i = 0; i < removed && snake.segments.length > 5; i++) {
          const tail = snake.segments.pop();
          snake.score = Math.max(0, snake.score - 1);
          food.push({ x: tail.x, y: tail.y, color: snake.color, radius: FOOD_RADIUS });
        }
      }
    }

    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i];
      const dx = newHead.x - f.x;
      const dy = newHead.y - f.y;
      if (dx * dx + dy * dy < (HEAD_RADIUS + f.radius) ** 2) {
        food.splice(i, 1);
        snake.score += 1;
        spawnEatParticles(f.x, f.y, f.color);
      }
    }
  }

  function checkCollisions() {
    for (let i = 0; i < snakes.length; i++) {
      const a = snakes[i];
      if (!a.alive) continue;
      const ahead = a.segments[0];

      for (let j = 0; j < snakes.length; j++) {
        if (i === j) continue;
        const b = snakes[j];
        if (!b.alive) continue;

        for (let k = 1; k < b.segments.length; k++) {
          const seg = b.segments[k];
          const dx = ahead.x - seg.x;
          const dy = ahead.y - seg.y;
          const dist = HEAD_RADIUS + BODY_RADIUS;
          if (dx * dx + dy * dy < dist * dist) {
            killSnake(a, b);
            b.score += Math.floor(a.segments.length / 2);
            break;
          }
        }
        if (!a.alive) break;
      }
    }
  }

  function killSnake(snake, killer) {
    if (!snake.alive) return;
    snake.alive = false;

    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      food.push({
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        color: snake.color,
        radius: FOOD_RADIUS + 3,
      });
    }

    spawnDeathParticles(snake.segments[0].x, snake.segments[0].y, snake.color);

    if (snake.id === myId) {
      finalScoreEl.textContent = snake.score;
      deathScreen.style.display = 'flex';
      document.body.style.cursor = 'default';
      screenShake = 15;
      running = false;
    }
  }

  function respawnBot(snake) {
    const angle = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const y = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    snake.segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      snake.segments.push({
        x: x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }
    snake.angle = angle;
    snake.targetAngle = angle;
    snake.score = 0;
    snake.alive = true;
    snake.boosting = false;
    snake.boostAccum = 0;
    snake.skin = Math.floor(Math.random() * SKINS.length);
    const skin = SKINS[snake.skin];
    snake.color = COLORS.indexOf(skin.colors[0]) >= 0 ? COLORS.indexOf(skin.colors[0]) : 0;
  }

  // --- Particles ---
  function spawnDeathParticles(x, y, colorIdx) {
    const color = COLORS[colorIdx] || COLORS[0];
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 200;
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, decay: 0.5 + Math.random(), size: 3 + Math.random() * 6, color
      });
    }
  }

  function spawnEatParticles(x, y, colorIdx) {
    const color = COLORS[colorIdx] || COLORS[0];
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 80;
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 1, decay: 1.5 + Math.random() * 1.5, size: 2 + Math.random() * 3, color
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // --- Rendering ---
  function drawGrid(cx, cy) {
    const gridSize = 60;
    const startX = Math.floor((cx - canvas.width / 2) / gridSize) * gridSize;
    const startY = Math.floor((cy - canvas.height / 2) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= startX + canvas.width + gridSize * 2; x += gridSize) {
      const sx = x - cx + canvas.width / 2;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height);
    }
    for (let y = startY; y <= startY + canvas.height + gridSize * 2; y += gridSize) {
      const sy = y - cy + canvas.height / 2;
      ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();
  }

  function drawBorder(cx, cy) {
    const half = MAP_SIZE / 2;
    const sx = -half - cx + canvas.width / 2;
    const sy = -half - cy + canvas.height / 2;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 20;
    ctx.strokeRect(sx, sy, MAP_SIZE, MAP_SIZE);
    ctx.shadowBlur = 0;
  }

  function drawFood(cx, cy) {
    for (const f of food) {
      const sx = f.x - cx + canvas.width / 2;
      const sy = f.y - cy + canvas.height / 2;
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) continue;

      const pulse = 0.8 + 0.2 * Math.sin(animTime * 3 + f.x * 0.01 + f.y * 0.01);
      const r = f.radius * pulse;
      const color = COLORS[f.color] || COLORS[0];

      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function drawSnake(snake, cx, cy) {
    const segs = snake.segments;
    if (segs.length < 2) return;

    const dotRadius = 9;
    const headColor = getSegColor(snake, 0);

    // Body dots with per-segment coloring
    ctx.shadowBlur = snake.boosting ? 20 : 10;

    for (let i = segs.length - 1; i >= 1; i--) {
      const seg = segs[i];
      const sx = seg.x - cx + canvas.width / 2;
      const sy = seg.y - cy + canvas.height / 2;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) continue;

      const t = 1 - (i / segs.length);
      const r = dotRadius * (0.65 + 0.35 * t);
      const segColor = getSegColor(snake, i);

      ctx.shadowColor = segColor;
      ctx.fillStyle = segColor;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(sx - r * 0.25, sy - r * 0.25, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Head
    const head = segs[0];
    const hx = head.x - cx + canvas.width / 2;
    const hy = head.y - cy + canvas.height / 2;
    const angle = Math.atan2(head.y - segs[1].y, head.x - segs[1].x);

    ctx.shadowColor = headColor;
    ctx.shadowBlur = snake.boosting ? 35 : 20;
    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    const eyeOff = HEAD_RADIUS * 0.5;
    const eyeR = HEAD_RADIUS * 0.28;
    const perp = angle + Math.PI / 2;
    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(angle) * HEAD_RADIUS * 0.3 + Math.cos(perp) * eyeOff * side;
      const ey = hy + Math.sin(angle) * HEAD_RADIUS * 0.3 + Math.sin(perp) * eyeOff * side;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex + Math.cos(angle) * eyeR * 0.3, ey + Math.sin(angle) * eyeR * 0.3, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boost trail
    if (snake.boosting && segs.length > 2 && Math.random() < 0.4) {
      const tail = segs[segs.length - 1];
      spawnEatParticles(tail.x, tail.y, snake.color);
    }

    // Name
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(snake.name, hx, hy - HEAD_RADIUS - 18);
    ctx.shadowBlur = 0;
    if (snake.score > 0) {
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(snake.score, hx, hy - HEAD_RADIUS - 5);
    }
  }

  function drawParticles(cx, cy) {
    for (const p of particles) {
      const sx = p.x - cx + canvas.width / 2;
      const sy = p.y - cy + canvas.height / 2;
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) continue;
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawMinimap(cx, cy) {
    const w = minimapCanvas.width, h = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, w, h);
    minimapCtx.fillStyle = 'rgba(0, 10, 20, 0.6)';
    minimapCtx.fillRect(0, 0, w, h);
    minimapCtx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, w, h);

    const scale = w / MAP_SIZE;
    const ox = w / 2, oy = h / 2;

    for (const snake of snakes) {
      if (!snake.alive || snake.segments.length === 0) continue;
      const head = snake.segments[0];
      const c = getSegColor(snake, 0);
      minimapCtx.fillStyle = snake.id === myId ? '#fff' : c;
      minimapCtx.globalAlpha = snake.id === myId ? 1 : 0.6;
      minimapCtx.beginPath();
      minimapCtx.arc(head.x * scale + ox, head.y * scale + oy, snake.id === myId ? 3 : 2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
    minimapCtx.globalAlpha = 1;

    const vw = canvas.width * scale, vh = canvas.height * scale;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    minimapCtx.strokeRect(cx * scale + ox - vw / 2, cy * scale + oy - vh / 2, vw, vh);
  }

  function updateLeaderboard() {
    const sorted = snakes
      .filter(s => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    leaderboardEntries.innerHTML = '';
    for (const s of sorted) {
      const div = document.createElement('div');
      div.className = 'entry' + (s.id === myId ? ' me' : '');
      div.innerHTML = `<span>${s.name}</span><span>${s.score}</span>`;
      leaderboardEntries.appendChild(div);
    }
    playerCountEl.textContent = `Players: ${snakes.filter(s => s.alive).length}`;
  }

  // --- Main loop ---
  let leaderboardTimer = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    animTime += dt;

    if (running) {
      const me = snakes.find(s => s.id === myId);
      if (me && me.alive) {
        me.targetAngle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
        me.boosting = boosting;
      }

      for (const snake of snakes) {
        if (snake.isBot && snake.alive) updateBotAI(snake, dt);
      }
      for (const snake of snakes) {
        if (snake.alive) updateSnake(snake, dt);
      }
      checkCollisions();
      for (const snake of snakes) {
        if (snake.isBot && !snake.alive) respawnBot(snake);
      }
      while (food.length < FOOD_COUNT) food.push(createFood());

      if (me && me.alive) {
        camera.x += (me.segments[0].x - camera.x) * 0.12;
        camera.y += (me.segments[0].y - camera.y) * 0.12;
        myScoreEl.textContent = `Score: ${me.score}`;
      }

      leaderboardTimer += dt;
      if (leaderboardTimer >= 1) {
        updateLeaderboard();
        leaderboardTimer = 0;
      }
    }

    updateParticles(dt);

    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
      shakeX = (Math.random() - 0.5) * screenShake;
      shakeY = (Math.random() - 0.5) * screenShake;
      screenShake *= 0.9;
      if (screenShake < 0.5) screenShake = 0;
    }
    const cx = camera.x + shakeX;
    const cy = camera.y + shakeY;

    // --- Draw ---
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.width * 0.2,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.7
    );
    grad.addColorStop(0, 'rgba(13, 27, 42, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(cx, cy);
    drawBorder(cx, cy);
    drawFood(cx, cy);

    for (const snake of snakes) {
      if (snake.alive && snake.id !== myId) drawSnake(snake, cx, cy);
    }
    const me = snakes.find(s => s.id === myId);
    if (me && me.alive) drawSnake(me, cx, cy);

    drawParticles(cx, cy);

    // In-game cursor
    if (running) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      const cr = 12;
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, cr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouseX - cr - 4, mouseY); ctx.lineTo(mouseX - cr + 4, mouseY);
      ctx.moveTo(mouseX + cr - 4, mouseY); ctx.lineTo(mouseX + cr + 4, mouseY);
      ctx.moveTo(mouseX, mouseY - cr - 4); ctx.lineTo(mouseX, mouseY - cr + 4);
      ctx.moveTo(mouseX, mouseY + cr - 4); ctx.lineTo(mouseX, mouseY + cr + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawMinimap(cx, cy);
  }

  requestAnimationFrame(frame);
})();
