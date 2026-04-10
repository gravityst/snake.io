// ============================================================
// Snake.io Client — Canvas rendering + WebSocket networking
// ============================================================

(() => {
  'use strict';

  // --- DOM refs ---
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const deathScreen = document.getElementById('deathScreen');
  const hud = document.getElementById('hud');
  const nameInput = document.getElementById('nameInput');
  const playBtn = document.getElementById('playBtn');
  const respawnBtn = document.getElementById('respawnBtn');
  const leaderboardEntries = document.getElementById('leaderboardEntries');
  const myScoreEl = document.getElementById('myScore');
  const finalScoreEl = document.getElementById('finalScore');
  const playerCountEl = document.getElementById('playerCount');
  const pingEl = document.getElementById('ping');
  const minimapCanvas = document.getElementById('minimap');
  const minimapCtx = minimapCanvas.getContext('2d');

  // --- Constants ---
  const MAP_SIZE = 6000;
  const COLORS = [
    '#0ff', '#f0f', '#0f0', '#ff0', '#f80', '#08f', '#f44', '#8f0'
  ];
  const FOOD_GLOW_COLORS = [
    'rgba(0,255,255,', 'rgba(255,0,255,', 'rgba(0,255,0,', 'rgba(255,255,0,',
    'rgba(255,136,0,', 'rgba(0,136,255,', 'rgba(255,68,68,', 'rgba(136,255,0,'
  ];

  // --- State ---
  let ws = null;
  let myId = null;
  let snakes = [];
  let food = [];
  let orbs = [];
  let leaderboard = [];
  let mouseX = 0, mouseY = 0;
  let targetAngle = 0;
  let boosting = false;
  let camera = { x: 0, y: 0, zoom: 1 };
  let lastPingSent = 0;
  let currentPing = 0;
  let particles = [];
  let screenShake = 0;
  let lastFrame = performance.now();
  let animTime = 0;

  // --- Resize ---
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Input ---
  canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  canvas.addEventListener('mousedown', () => { setBoosting(true); });
  canvas.addEventListener('mouseup', () => { setBoosting(false); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); setBoosting(true); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') setBoosting(false); });

  // Touch controls
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    mouseX = t.clientX;
    mouseY = t.clientY;
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    mouseX = t.clientX;
    mouseY = t.clientY;
    if (e.touches.length >= 2) setBoosting(true);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) setBoosting(false);
  });

  function setBoosting(val) {
    boosting = val;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const buf = new Uint8Array(2);
    buf[0] = 0x02;
    buf[1] = val ? 1 : 0;
    ws.send(buf);
  }

  // --- Play / Respawn ---
  playBtn.addEventListener('click', startGame);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
  respawnBtn.addEventListener('click', startGame);

  function startGame() {
    const name = nameInput.value.trim() || 'Player';
    connect(name);
    startScreen.style.display = 'none';
    deathScreen.style.display = 'none';
    hud.style.display = 'block';
    document.body.style.cursor = 'none';
  }

  // --- WebSocket ---
  function connect(name) {
    if (ws) ws.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      const nameBytes = new TextEncoder().encode(name.substring(0, 16));
      const buf = new Uint8Array(1 + nameBytes.length);
      buf[0] = 0x03;
      buf.set(nameBytes, 1);
      ws.send(buf);
    };

    ws.onmessage = (event) => {
      const buf = new DataView(event.data);
      const type = buf.getUint8(0);

      if (type === 0x02) {
        // Welcome
        myId = buf.getUint16(1, true);
      } else if (type === 0x01) {
        parseState(buf);
      } else if (type === 0x03) {
        // Death
        const deadId = buf.getUint16(1, true);
        if (deadId === myId) {
          onDeath();
        }
      } else if (type === 0x04) {
        // Kill feed — spawn particles at killed snake
        const killedId = buf.getUint16(3, true);
        const killed = snakes.find(s => s.id === killedId);
        if (killed && killed.segments.length > 0) {
          spawnDeathParticles(killed.segments[0].x, killed.segments[0].y, killed.color);
        }
      } else if (type === 0x05) {
        parseLeaderboard(buf);
      }
    };

    ws.onclose = () => {
      // Attempt reconnect after delay
      setTimeout(() => {
        if (hud.style.display === 'block') {
          connect(name);
        }
      }, 2000);
    };
  }

  function parseState(buf) {
    let offset = 1;
    const snakeCount = buf.getUint16(offset, true); offset += 2;
    const newSnakes = [];

    for (let i = 0; i < snakeCount; i++) {
      const id = buf.getUint16(offset, true); offset += 2;
      const color = buf.getUint8(offset); offset += 1;
      const isBoosting = buf.getUint8(offset) === 1; offset += 1;
      const score = buf.getUint16(offset, true); offset += 2;
      const nameLen = buf.getUint8(offset); offset += 1;
      const nameBytes = new Uint8Array(buf.buffer, offset, nameLen);
      const name = new TextDecoder().decode(nameBytes); offset += nameLen;
      const segCount = buf.getUint16(offset, true); offset += 2;
      const segments = [];
      for (let j = 0; j < segCount; j++) {
        segments.push({
          x: buf.getInt16(offset, true),
          y: buf.getInt16(offset + 2, true)
        });
        offset += 4;
      }
      newSnakes.push({ id, color, boosting: isBoosting, score, name, segments });
    }

    const foodCount = buf.getUint16(offset, true); offset += 2;
    const newFood = [];
    for (let i = 0; i < foodCount; i++) {
      newFood.push({
        x: buf.getInt16(offset, true),
        y: buf.getInt16(offset + 2, true),
        color: buf.getUint8(offset + 4),
        radius: buf.getUint8(offset + 5)
      });
      offset += 6;
    }

    const orbCount = buf.getUint16(offset, true); offset += 2;
    const newOrbs = [];
    for (let i = 0; i < orbCount; i++) {
      newOrbs.push({
        x: buf.getInt16(offset, true),
        y: buf.getInt16(offset + 2, true),
        color: buf.getUint8(offset + 4)
      });
      offset += 5;
    }

    snakes = newSnakes;
    food = newFood;
    orbs = newOrbs;
  }

  function parseLeaderboard(buf) {
    let offset = 1;
    const count = buf.getUint8(offset); offset += 1;
    const lb = [];
    for (let i = 0; i < count; i++) {
      const id = buf.getUint16(offset, true); offset += 2;
      const score = buf.getUint16(offset, true); offset += 2;
      const nameLen = buf.getUint8(offset); offset += 1;
      const nameBytes = new Uint8Array(buf.buffer, offset, nameLen);
      const name = new TextDecoder().decode(nameBytes); offset += nameLen;
      lb.push({ id, score, name });
    }
    leaderboard = lb;
    updateLeaderboardUI();
  }

  function onDeath() {
    const mySnake = snakes.find(s => s.id === myId);
    const score = mySnake ? mySnake.score : 0;
    finalScoreEl.textContent = score;
    deathScreen.style.display = 'flex';
    document.body.style.cursor = 'default';
    screenShake = 15;
    myId = null;
  }

  // --- Leaderboard UI ---
  function updateLeaderboardUI() {
    leaderboardEntries.innerHTML = '';
    let playerCount = 0;
    for (const entry of leaderboard) {
      const div = document.createElement('div');
      div.className = 'entry' + (entry.id === myId ? ' me' : '');
      div.innerHTML = `<span>${entry.name}</span><span>${entry.score}</span>`;
      leaderboardEntries.appendChild(div);
      playerCount++;
    }
    playerCountEl.textContent = `Players: ${snakes.length}`;
  }

  // --- Particles ---
  function spawnDeathParticles(x, y, colorIdx) {
    const color = COLORS[colorIdx] || COLORS[0];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.5 + Math.random() * 1.0,
        size: 3 + Math.random() * 6,
        color
      });
    }
  }

  function spawnEatParticles(x, y, colorIdx) {
    const color = COLORS[colorIdx] || COLORS[0];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 80;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 1.5 + Math.random() * 1.5,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  // --- Send direction ---
  function sendDirection() {
    if (!ws || ws.readyState !== WebSocket.OPEN || myId === null) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    targetAngle = Math.atan2(mouseY - centerY, mouseX - centerX);

    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, 0x01);
    view.setFloat32(1, targetAngle, true);
    ws.send(buf);
  }

  // --- Rendering ---
  function drawGrid(cx, cy) {
    const gridSize = 60;
    const startX = Math.floor((cx - canvas.width / 2) / gridSize) * gridSize;
    const startY = Math.floor((cy - canvas.height / 2) / gridSize) * gridSize;
    const endX = startX + canvas.width + gridSize * 2;
    const endY = startY + canvas.height + gridSize * 2;

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      const sx = x - cx + canvas.width / 2;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      const sy = y - cy + canvas.height / 2;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();
  }

  function drawBorder(cx, cy) {
    const half = MAP_SIZE / 2;
    const sx = -half - cx + canvas.width / 2;
    const sy = -half - cy + canvas.height / 2;
    const size = MAP_SIZE;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 20;
    ctx.strokeRect(sx, sy, size, size);
    ctx.shadowBlur = 0;
  }

  function drawFood(cx, cy) {
    for (const f of food) {
      const sx = f.x - cx + canvas.width / 2;
      const sy = f.y - cy + canvas.height / 2;

      // Skip if off-screen
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) continue;

      const pulse = 0.8 + 0.2 * Math.sin(animTime * 3 + f.x * 0.01 + f.y * 0.01);
      const r = f.radius * pulse;
      const color = COLORS[f.color] || COLORS[0];
      const glowBase = FOOD_GLOW_COLORS[f.color] || FOOD_GLOW_COLORS[0];

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright spot
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function drawOrbs(cx, cy) {
    for (const o of orbs) {
      const sx = o.x - cx + canvas.width / 2;
      const sy = o.y - cy + canvas.height / 2;
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) continue;

      const pulse = 1 + 0.3 * Math.sin(animTime * 5 + o.x * 0.02);
      const r = 11 * pulse;
      const color = COLORS[o.color] || COLORS[0];

      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  function drawSnake(snake, cx, cy) {
    const segs = snake.segments;
    if (segs.length < 2) return;

    const color = COLORS[snake.color] || COLORS[0];
    const isMe = snake.id === myId;
    const headRadius = 14;
    const bodyRadius = 12;

    // Draw body segments with gradient from thick to thin
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Neon glow under the body
    ctx.shadowColor = color;
    ctx.shadowBlur = snake.boosting ? 25 : 15;

    // Draw body as connected circles for smooth look
    for (let i = segs.length - 1; i >= 1; i--) {
      const seg = segs[i];
      const sx = seg.x - cx + canvas.width / 2;
      const sy = seg.y - cy + canvas.height / 2;
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) continue;

      const t = 1 - (i / segs.length);
      const r = bodyRadius * (0.6 + 0.4 * t);

      // Alternating brightness for segment pattern
      const bright = (i % 3 === 0) ? 1.0 : 0.7;

      ctx.fillStyle = color;
      ctx.globalAlpha = bright * 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw connecting lines between segments for smooth body
    ctx.strokeStyle = color;
    ctx.lineWidth = bodyRadius * 1.6;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    const first = segs[segs.length - 1];
    ctx.moveTo(first.x - cx + canvas.width / 2, first.y - cy + canvas.height / 2);
    for (let i = segs.length - 2; i >= 0; i--) {
      ctx.lineTo(segs[i].x - cx + canvas.width / 2, segs[i].y - cy + canvas.height / 2);
    }
    ctx.stroke();

    ctx.globalAlpha = 1;

    // Head
    const head = segs[0];
    const hx = head.x - cx + canvas.width / 2;
    const hy = head.y - cy + canvas.height / 2;
    const angle = segs.length > 1
      ? Math.atan2(head.y - segs[1].y, head.x - segs[1].x)
      : 0;

    // Head glow
    ctx.shadowColor = color;
    ctx.shadowBlur = snake.boosting ? 35 : 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Eyes
    const eyeOffset = headRadius * 0.5;
    const eyeR = headRadius * 0.28;
    const perpAngle = angle + Math.PI / 2;

    for (const side of [-1, 1]) {
      const ex = hx + Math.cos(angle) * headRadius * 0.3 + Math.cos(perpAngle) * eyeOffset * side;
      const ey = hy + Math.sin(angle) * headRadius * 0.3 + Math.sin(perpAngle) * eyeOffset * side;

      // White of eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(
        ex + Math.cos(angle) * eyeR * 0.3,
        ey + Math.sin(angle) * eyeR * 0.3,
        eyeR * 0.55, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // Boost trail particles
    if (snake.boosting && segs.length > 2) {
      const tail = segs[segs.length - 1];
      if (Math.random() < 0.4) {
        spawnEatParticles(tail.x, tail.y, snake.color);
      }
    }

    // Name tag
    const nameY = hy - headRadius - 18;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(snake.name, hx, nameY);
    ctx.shadowBlur = 0;

    // Score under name
    if (snake.score > 0) {
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(snake.score, hx, nameY + 14);
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
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    minimapCtx.clearRect(0, 0, w, h);

    // Background
    minimapCtx.fillStyle = 'rgba(0, 10, 20, 0.6)';
    minimapCtx.fillRect(0, 0, w, h);

    // Border
    minimapCtx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, w, h);

    const scale = w / MAP_SIZE;
    const offsetX = w / 2;
    const offsetY = h / 2;

    // Draw all snakes as dots
    for (const snake of snakes) {
      if (snake.segments.length === 0) continue;
      const head = snake.segments[0];
      const mx = head.x * scale + offsetX;
      const my = head.y * scale + offsetY;
      const color = COLORS[snake.color] || COLORS[0];

      minimapCtx.fillStyle = snake.id === myId ? '#fff' : color;
      minimapCtx.globalAlpha = snake.id === myId ? 1 : 0.6;
      minimapCtx.beginPath();
      minimapCtx.arc(mx, my, snake.id === myId ? 3 : 2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
    minimapCtx.globalAlpha = 1;

    // Viewport box
    const vw = canvas.width * scale;
    const vh = canvas.height * scale;
    const vx = cx * scale + offsetX - vw / 2;
    const vy = cy * scale + offsetY - vh / 2;
    minimapCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    minimapCtx.strokeRect(vx, vy, vw, vh);
  }

  // --- Main loop ---
  let sendTimer = 0;

  function frame(now) {
    requestAnimationFrame(frame);

    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    animTime += dt;

    // Send direction at ~20 Hz
    sendTimer += dt;
    if (sendTimer >= 0.05) {
      sendDirection();
      sendTimer = 0;
    }

    // Update camera
    const mySnake = snakes.find(s => s.id === myId);
    if (mySnake && mySnake.segments.length > 0) {
      const head = mySnake.segments[0];
      // Smooth camera follow
      camera.x += (head.x - camera.x) * 0.12;
      camera.y += (head.y - camera.y) * 0.12;

      // Update score display
      myScoreEl.textContent = `Score: ${mySnake.score}`;
    }

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
      shakeX = (Math.random() - 0.5) * screenShake;
      shakeY = (Math.random() - 0.5) * screenShake;
      screenShake *= 0.9;
      if (screenShake < 0.5) screenShake = 0;
    }

    // Update particles
    updateParticles(dt);

    // --- Draw ---
    const cx = camera.x + shakeX;
    const cy = camera.y + shakeY;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle radial vignette
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
    drawOrbs(cx, cy);

    // Draw snakes (me last so I'm on top)
    for (const snake of snakes) {
      if (snake.id !== myId) drawSnake(snake, cx, cy);
    }
    if (mySnake) drawSnake(mySnake, cx, cy);

    drawParticles(cx, cy);
    drawMinimap(cx, cy);
  }

  requestAnimationFrame(frame);
})();
