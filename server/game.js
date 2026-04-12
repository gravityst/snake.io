const WebSocket = require('ws');

// =====================================================
// Server-side authoritative game loop
// All physics, collision, AI, food spawning runs here.
// Clients send input → server broadcasts state.
// =====================================================

// --- Constants (match client for consistency) ---
const MAP_SIZE = 9000;
const FOOD_COUNT = 1000;
const SNAKE_SPEED = 200;
const BOOST_SPEED = 380;
const SEGMENT_SPACING = 24;
const DOT_RADIUS = 9;
const INITIAL_LENGTH = 10;
const HEAD_RADIUS = 14;
const BOOST_SHRINK_RATE = 2.5;
const BOT_COUNT = 20;         // fewer bots since real players fill in
const MEGA_ORB_COUNT = 12;
const TICK_RATE = 30;          // server ticks per second
const TICK_MS = 1000 / TICK_RATE;
const BROADCAST_RATE = 20;     // state broadcasts per second
const BROADCAST_MS = 1000 / BROADCAST_RATE;
const MAX_ADVANCED_BOTS = 2;

const SKILL_BEGINNER = 0;
const SKILL_AMATEUR = 1;
const SKILL_ADVANCED = 2;

const COLORS = ['#0ff', '#f0f', '#0f0', '#ff0', '#f80', '#08f', '#f44', '#8f0'];
const SKINS_COUNT = 43;        // must match client SKINS array length
const BOT_NAMES = [
  'Viper', 'Shadow', 'Blaze', 'Neon', 'Ghost', 'Toxic', 'Pixel', 'Glitch',
  'Storm', 'Bolt', 'Ember', 'Frost', 'Nova', 'Pulse', 'Drift', 'Surge',
  'Zenith', 'Razor', 'Flux', 'Echo', 'Orbit', 'Prism', 'Hex', 'Chrome',
];

// =====================================================
// Binary Protocol
// =====================================================
// Client → Server:
//   [0x01] [float32 angle]                   direction update
//   [0x02] [uint8 boosting]                  boost toggle
//   [0x03] [uint8 skinIdx] [utf8 name...]    join game
//
// Server → Client:
//   [0x01] [state...]                        world state update
//   [0x02] [uint16 yourId]                   welcome (your snake id)
//   [0x03] [uint16 deadId]                   you died
//   [0x04] [uint16 killerId] [uint16 killedId] kill event
//   [0x05] [leaderboard...]                  leaderboard update

class GameServer {
  constructor(httpServer) {
    this.MAP_SIZE = MAP_SIZE;
    this.wss = new WebSocket.Server({ server: httpServer });
    this.snakes = new Map();      // id → snake
    this.food = [];
    this.megaOrbs = [];
    this.bots = [];               // bot snake ids
    this.nextId = 1;
    this.clients = new Map();     // ws → playerId

    this.spawnFood();
    this.spawnMegaOrbs();
    this.spawnBots();

    this.wss.on('connection', (ws) => this.onConnection(ws));

    // Game loop
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);

    // Broadcast loop (separate from tick for bandwidth control)
    this.lastBroadcast = Date.now();
    this.broadcastInterval = setInterval(() => {
      this.broadcastState();
      this.broadcastLeaderboard();
    }, BROADCAST_MS);

    // Ping clients every 10s
    setInterval(() => {
      for (const [ws] of this.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }, 10000);
  }

  // --- Helpers ---
  randomZonedPosition(power = 1.5) {
    const r = Math.pow(Math.random(), power) * (MAP_SIZE / 2 - 100);
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  getThickness(snake) {
    return 1 + Math.min(snake.score / 80, 2.5);
  }

  randomBotSkill() {
    const advCount = this.bots.filter(id => {
      const s = this.snakes.get(id);
      return s && s.alive && s.skill === SKILL_ADVANCED;
    }).length;
    const r = Math.random();
    if (r < 0.05 && advCount < MAX_ADVANCED_BOTS) return SKILL_ADVANCED;
    if (r < 0.30) return SKILL_AMATEUR;
    return SKILL_BEGINNER;
  }

  // --- Food ---
  spawnFood() {
    while (this.food.length < FOOD_COUNT) this.food.push(this.createFood());
  }

  createFood() {
    const r = Math.random();
    let radius, value, tier;
    if (r < 0.35)      { radius = 3 + Math.random()*2; value = 1;  tier = 0; }
    else if (r < 0.58) { radius = 5 + Math.random()*2; value = 2;  tier = 1; }
    else if (r < 0.75) { radius = 7 + Math.random()*2; value = 3;  tier = 2; }
    else if (r < 0.87) { radius = 9 + Math.random()*2; value = 5;  tier = 3; }
    else if (r < 0.94) { radius = 11+ Math.random()*2; value = 8;  tier = 4; }
    else if (r < 0.975){ radius = 13+ Math.random()*2; value = 12; tier = 5; }
    else if (r < 0.99) { radius = 15+ Math.random()*2; value = 18; tier = 6; }
    else if (r < 0.997){ radius = 18+ Math.random()*2; value = 26; tier = 7; }
    else               { radius = 21+ Math.random()*3; value = 35; tier = 8; }

    const pos = this.randomZonedPosition(1.5);
    return { x: pos.x, y: pos.y, color: Math.floor(Math.random()*8), radius, value, tier };
  }

  // --- Mega Orbs ---
  spawnMegaOrbs() {
    while (this.megaOrbs.length < MEGA_ORB_COUNT) this.megaOrbs.push(this.createMegaOrb());
  }

  createMegaOrb() {
    const a = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 25;
    const pos = this.randomZonedPosition(1.3);
    return {
      x: pos.x, y: pos.y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      radius: 22 + Math.random() * 8,
      value: 50 + Math.floor(Math.random() * 31),
      color: Math.floor(Math.random() * 8),
      spin: Math.random() * Math.PI * 2,
    };
  }

  // --- Bots ---
  spawnBots() {
    for (let i = 0; i < BOT_COUNT; i++) {
      const skill = this.randomBotSkill();
      const snake = this.createSnake(BOT_NAMES[i % BOT_NAMES.length], true,
        Math.floor(Math.random() * SKINS_COUNT), skill);
      this.bots.push(snake.id);
    }
  }

  // --- Snake creation ---
  createSnake(name, isBot, skinIdx, skill) {
    const id = this.nextId++;
    const angle = Math.random() * Math.PI * 2;
    const pos = isBot ? this.randomZonedPosition(1.2) : this.randomZonedPosition(2.5);
    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: pos.x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: pos.y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }
    const snake = {
      id, name, segments, angle,
      targetAngle: angle,
      boosting: false,
      score: 0,
      skin: skinIdx,
      color: Math.floor(Math.random() * 8),
      alive: true,
      isBot,
      skill: skill ?? SKILL_BEGINNER,
      boostAccum: 0,
      botTimer: 0,
      botWanderAngle: angle,
    };
    this.snakes.set(id, snake);
    return snake;
  }

  // --- Player connection ---
  onConnection(ws) {
    ws.binaryType = 'arraybuffer';
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length < 1) return;
      const type = buf[0];

      if (type === 0x03) {
        // Join: [0x03][skinIdx][name...]
        const skinIdx = buf.length > 1 ? buf[1] : 0;
        const name = buf.slice(2).toString('utf8').substring(0, 16) || 'Player';
        this.playerJoin(ws, name, skinIdx);
        return;
      }

      const playerId = this.clients.get(ws);
      if (playerId === undefined) return;
      const snake = this.snakes.get(playerId);
      if (!snake || !snake.alive) return;

      if (type === 0x01 && buf.length >= 5) {
        snake.targetAngle = buf.readFloatLE(1);
      } else if (type === 0x02 && buf.length >= 2) {
        snake.boosting = buf[1] === 1;
      }
    });

    ws.on('close', () => {
      const playerId = this.clients.get(ws);
      if (playerId !== undefined) {
        this.killSnake(playerId, null);
        this.clients.delete(ws);
      }
    });
  }

  playerJoin(ws, name, skinIdx) {
    if (this.clients.has(ws)) return;
    const snake = this.createSnake(name, false, skinIdx, SKILL_BEGINNER);

    this.clients.set(ws, snake.id);

    // Send welcome with player id
    const welcome = Buffer.alloc(3);
    welcome[0] = 0x02;
    welcome.writeUInt16LE(snake.id, 1);
    ws.send(welcome);

    console.log(`Player "${name}" joined (id=${snake.id}, skin=${skinIdx})`);
  }

  // --- Kill ---
  killSnake(id, killerId) {
    const snake = this.snakes.get(id);
    if (!snake || !snake.alive) return;
    snake.alive = false;

    // Drop food from body
    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      this.food.push({
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        color: snake.color, radius: 8 + Math.random() * 4,
        value: 3 + Math.floor(Math.random() * 3), tier: 2,
      });
    }

    // Broadcast kill event
    if (killerId !== null) {
      const buf = Buffer.alloc(5);
      buf[0] = 0x04;
      buf.writeUInt16LE(killerId, 1);
      buf.writeUInt16LE(id, 3);
      this.broadcast(buf);
    }

    // Send death to the dead player's client
    for (const [ws, pid] of this.clients) {
      if (pid === id) {
        const deathBuf = Buffer.alloc(3);
        deathBuf[0] = 0x03;
        deathBuf.writeUInt16LE(id, 1);
        if (ws.readyState === WebSocket.OPEN) ws.send(deathBuf);
        this.clients.delete(ws);
        break;
      }
    }

    // If bot, respawn after delay
    if (snake.isBot) {
      setTimeout(() => this.respawnBot(id), 2000);
    }

    this.snakes.delete(id);
  }

  respawnBot(oldId) {
    // The old snake was deleted; create a fresh one
    const skill = this.randomBotSkill();
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const snake = this.createSnake(name, true, Math.floor(Math.random() * SKINS_COUNT), skill);
    // Replace the old id in bots array
    const idx = this.bots.indexOf(oldId);
    if (idx >= 0) this.bots[idx] = snake.id;
    else this.bots.push(snake.id);
  }

  // --- Main tick ---
  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.05);
    this.lastTick = now;

    // Update mega orbs
    this.updateMegaOrbs(dt);

    // Update bot AI
    for (const [id, snake] of this.snakes) {
      if (snake.isBot && snake.alive) this.updateBotAI(snake, dt);
    }

    // Update all snakes
    for (const [id, snake] of this.snakes) {
      if (snake.alive) this.updateSnake(snake, dt);
    }

    // Check collisions
    this.checkCollisions();

    // Replenish food
    this.spawnFood();
    this.spawnMegaOrbs();
  }

  // --- Snake physics ---
  updateSnake(snake, dt) {
    let angleDiff = snake.targetAngle - snake.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const turnSpeed = 4.0;
    if (Math.abs(angleDiff) < turnSpeed * dt) snake.angle = snake.targetAngle;
    else snake.angle += Math.sign(angleDiff) * turnSpeed * dt;

    if (snake.boosting && snake.score <= 0) snake.boosting = false;

    const speed = snake.boosting ? BOOST_SPEED : SNAKE_SPEED;
    const head = snake.segments[0];
    head.x += Math.cos(snake.angle) * speed * dt;
    head.y += Math.sin(snake.angle) * speed * dt;

    // Bounds
    const half = MAP_SIZE / 2;
    if (head.x < -half || head.x > half || head.y < -half || head.y > half) {
      this.killSnake(snake.id, null);
      return;
    }

    // Insert anchors at fixed spacing
    while (snake.segments.length >= 2) {
      const dx = head.x - snake.segments[1].x;
      const dy = head.y - snake.segments[1].y;
      const distSq = dx * dx + dy * dy;
      if (distSq < SEGMENT_SPACING * SEGMENT_SPACING) break;
      const dist = Math.sqrt(distSq);
      const t = SEGMENT_SPACING / dist;
      snake.segments.splice(1, 0, {
        x: snake.segments[1].x + dx * t,
        y: snake.segments[1].y + dy * t,
      });
    }

    const targetLength = INITIAL_LENGTH + Math.floor(snake.score / 6);
    while (snake.segments.length > targetLength) snake.segments.pop();

    // Boost cost
    if (snake.boosting && snake.score > 0) {
      snake.boostAccum += BOOST_SHRINK_RATE * dt;
      if (snake.boostAccum >= 1) {
        const removed = Math.floor(snake.boostAccum);
        snake.boostAccum -= removed;
        snake.score = Math.max(0, snake.score - removed);
        if (snake.segments.length > 0) {
          const tail = snake.segments[snake.segments.length - 1];
          this.food.push({
            x: tail.x + (Math.random()-0.5)*14,
            y: tail.y + (Math.random()-0.5)*14,
            color: snake.color, radius: 5+Math.random()*2, value: 1, tier: 0,
          });
        }
      }
    }

    // Eat food
    const headR = HEAD_RADIUS * this.getThickness(snake);
    const eatRange = headR + 30;
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      const dx = f.x - head.x;
      if (dx > eatRange || dx < -eatRange) continue;
      const dy = f.y - head.y;
      if (dy > eatRange || dy < -eatRange) continue;
      const sumR = headR + f.radius;
      if (dx*dx + dy*dy < sumR*sumR) {
        this.food.splice(i, 1);
        snake.score += f.value || 1;
      }
    }

    // Eat mega orbs
    for (let i = this.megaOrbs.length - 1; i >= 0; i--) {
      const m = this.megaOrbs[i];
      const dx = head.x - m.x;
      const dy = head.y - m.y;
      if (dx*dx + dy*dy < (headR + m.radius)**2) {
        this.megaOrbs.splice(i, 1);
        snake.score += m.value;
      }
    }
  }

  updateMegaOrbs(dt) {
    const half = MAP_SIZE / 2 - 50;
    for (const m of this.megaOrbs) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.spin += dt * 1.5;
      if (m.x < -half) { m.x = -half; m.vx = Math.abs(m.vx); }
      if (m.x > half)  { m.x = half;  m.vx = -Math.abs(m.vx); }
      if (m.y < -half) { m.y = -half; m.vy = Math.abs(m.vy); }
      if (m.y > half)  { m.y = half;  m.vy = -Math.abs(m.vy); }
    }
  }

  // --- Collisions ---
  checkCollisions() {
    const arr = Array.from(this.snakes.values()).filter(s => s.alive);
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (!a.alive) continue;
      const ahead = a.segments[0];
      const aHeadR = HEAD_RADIUS * this.getThickness(a);

      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const b = arr[j];
        if (!b.alive) continue;
        const bDotR = DOT_RADIUS * this.getThickness(b);
        const dist = aHeadR + bDotR;
        const distSq = dist * dist;

        for (let k = 1; k < b.segments.length; k++) {
          const seg = b.segments[k];
          const dx = ahead.x - seg.x;
          const dy = ahead.y - seg.y;
          if (dx*dx + dy*dy < distSq) {
            this.killSnake(a.id, b.id);
            b.score += Math.floor(a.segments.length / 2 + a.score / 4);
            break;
          }
        }
        if (!a.alive) break;
      }
    }
  }

  // --- Bot AI ---
  updateBotAI(snake, dt) {
    if (snake.skill === SKILL_ADVANCED) this.advancedAI(snake, dt);
    else if (snake.skill === SKILL_AMATEUR) this.amateurAI(snake, dt);
    else this.beginnerAI(snake, dt);
  }

  beginnerAI(snake, dt) {
    snake.botTimer -= dt;
    if (snake.botTimer > 0) return;
    snake.botTimer = 0.7 + Math.random() * 0.8;
    const head = snake.segments[0];
    const half = MAP_SIZE / 2 - 250;

    if (Math.abs(head.x) > half || Math.abs(head.y) > half) {
      snake.targetAngle = Math.atan2(-head.y, -head.x);
      snake.boosting = false;
      return;
    }
    if (Math.random() < 0.25) {
      snake.botWanderAngle += (Math.random()-0.5) * 2.5;
      snake.targetAngle = snake.botWanderAngle;
      snake.boosting = false;
      return;
    }
    let closest = null, closestSq = 250*250;
    for (const f of this.food) {
      const dx = f.x - head.x;
      if (dx > 250 || dx < -250) continue;
      const dy = f.y - head.y;
      if (dy > 250 || dy < -250) continue;
      const d2 = dx*dx + dy*dy;
      if (d2 < closestSq) { closestSq = d2; closest = f; }
    }
    if (closest) snake.targetAngle = Math.atan2(closest.y - head.y, closest.x - head.x);
    else { snake.botWanderAngle += (Math.random()-0.5)*2; snake.targetAngle = snake.botWanderAngle; }
    snake.boosting = false;
  }

  amateurAI(snake, dt) {
    snake.botTimer -= dt;
    if (snake.botTimer > 0) return;
    snake.botTimer = 0.3 + Math.random() * 0.4;
    const head = snake.segments[0];
    const half = MAP_SIZE / 2 - 250;

    if (Math.abs(head.x) > half || Math.abs(head.y) > half) {
      snake.targetAngle = Math.atan2(-head.y, -head.x);
      snake.boosting = true;
      return;
    }
    let closestFood = null, closestSq = 450*450;
    for (const f of this.food) {
      const dx = f.x - head.x;
      if (dx > 450 || dx < -450) continue;
      const dy = f.y - head.y;
      if (dy > 450 || dy < -450) continue;
      const d2 = dx*dx + dy*dy;
      if (d2 < closestSq) { closestSq = d2; closestFood = f; }
    }
    for (const [, other] of this.snakes) {
      if (other.id === snake.id || !other.alive) continue;
      const dx = other.segments[0].x - head.x;
      const dy = other.segments[0].y - head.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 180) {
        snake.targetAngle = Math.atan2(-dy, -dx) + (Math.random()-0.5)*0.5;
        snake.boosting = d < 90;
        return;
      }
    }
    if (closestFood) {
      snake.targetAngle = Math.atan2(closestFood.y - head.y, closestFood.x - head.x);
      snake.boosting = false;
    } else {
      snake.botWanderAngle += (Math.random()-0.5)*1.2;
      snake.targetAngle = snake.botWanderAngle;
      snake.boosting = false;
    }
  }

  advancedAI(snake, dt) {
    snake.botTimer -= dt;
    if (snake.botTimer > 0) return;
    snake.botTimer = 0.1;
    const head = snake.segments[0];
    const half = MAP_SIZE / 2 - 250;

    if (Math.abs(head.x) > half || Math.abs(head.y) > half) {
      snake.targetAngle = Math.atan2(-head.y, -head.x);
      snake.boosting = false;
      return;
    }
    // Threats
    for (const [, other] of this.snakes) {
      if (other.id === snake.id || !other.alive) continue;
      const dx = other.segments[0].x - head.x;
      const dy = other.segments[0].y - head.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 220 && other.score >= snake.score * 0.85) {
        snake.targetAngle = Math.atan2(-dy, -dx) + (Math.random()<0.5 ? -0.3 : 0.3);
        snake.boosting = d < 130 && snake.score > 30;
        return;
      }
    }
    // Mega orbs
    let bestMega = null, bestMegaDist = 1500;
    for (const m of this.megaOrbs) {
      const d = Math.sqrt((m.x-head.x)**2 + (m.y-head.y)**2);
      if (d < bestMegaDist) { bestMegaDist = d; bestMega = m; }
    }
    if (bestMega) {
      const t = bestMegaDist / SNAKE_SPEED;
      snake.targetAngle = Math.atan2(
        bestMega.y + bestMega.vy*t - head.y,
        bestMega.x + bestMega.vx*t - head.x
      );
      snake.boosting = bestMegaDist > 500 && snake.score > 20;
      return;
    }
    // Hunt smaller snakes
    let bestPrey = null, bestPreyDist = 700;
    for (const [, other] of this.snakes) {
      if (other.id === snake.id || !other.alive || other.score >= snake.score*0.7) continue;
      const d = Math.sqrt((other.segments[0].x-head.x)**2 + (other.segments[0].y-head.y)**2);
      if (d < bestPreyDist) { bestPreyDist = d; bestPrey = other; }
    }
    if (bestPrey) {
      const la = 0.8 + bestPreyDist/400;
      snake.targetAngle = Math.atan2(
        bestPrey.segments[0].y + Math.sin(bestPrey.angle)*SNAKE_SPEED*la - head.y,
        bestPrey.segments[0].x + Math.cos(bestPrey.angle)*SNAKE_SPEED*la - head.x
      );
      snake.boosting = bestPreyDist > 250 && snake.score > 40;
      return;
    }
    // Value food
    let bestFood = null, bestRatio = 0;
    for (const f of this.food) {
      const dx = f.x - head.x;
      if (dx > 800 || dx < -800) continue;
      const dy = f.y - head.y;
      if (dy > 800 || dy < -800) continue;
      const ratio = (f.value||1) / (Math.sqrt(dx*dx+dy*dy) + 50);
      if (ratio > bestRatio) { bestRatio = ratio; bestFood = f; }
    }
    if (bestFood) {
      snake.targetAngle = Math.atan2(bestFood.y - head.y, bestFood.x - head.x);
      snake.boosting = false;
      return;
    }
    snake.botWanderAngle += (Math.random()-0.5)*0.5;
    snake.targetAngle = snake.botWanderAngle;
    snake.boosting = false;
  }

  // --- Broadcasting ---
  broadcastState() {
    for (const [ws, playerId] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const mySnake = this.snakes.get(playerId);
      if (!mySnake || !mySnake.alive) continue;

      const cx = mySnake.segments[0].x;
      const cy = mySnake.segments[0].y;
      const viewRange = 1800; // server-side view radius (wider than client screen)

      // Collect visible snakes
      const visSnakes = [];
      for (const [, snake] of this.snakes) {
        if (!snake.alive) continue;
        let inView = false;
        for (let i = 0; i < snake.segments.length; i += 3) {
          if (Math.abs(snake.segments[i].x - cx) < viewRange &&
              Math.abs(snake.segments[i].y - cy) < viewRange) {
            inView = true; break;
          }
        }
        if (inView) visSnakes.push(snake);
      }

      // Collect visible food (coarse box check)
      const visFood = [];
      for (const f of this.food) {
        if (Math.abs(f.x - cx) < viewRange && Math.abs(f.y - cy) < viewRange) {
          visFood.push(f);
        }
      }

      // Collect visible mega orbs
      const visMega = [];
      for (const m of this.megaOrbs) {
        if (Math.abs(m.x - cx) < viewRange && Math.abs(m.y - cy) < viewRange) {
          visMega.push(m);
        }
      }

      // Build binary packet
      // [0x01][snakeCount u16]
      // per snake: [id u16][skin u8][boosting u8][score u16][nameLen u8][name][segCount u16][segs as i16 pairs]
      // [foodCount u16][food as i16,i16,u8,u8,u8]  (x,y,color,radius,tier)
      // [megaCount u16][mega as i16,i16,u8,u8,u8]  (x,y,color,radius,value)

      let totalSegs = 0, totalNameBytes = 0;
      for (const s of visSnakes) {
        totalSegs += s.segments.length;
        totalNameBytes += Buffer.byteLength(s.name, 'utf8');
      }

      const bufSize = 1 + 2 +
        visSnakes.length * (2+1+1+2+1+2) + totalNameBytes + totalSegs * 4 +
        2 + visFood.length * 7 +
        2 + visMega.length * 7;

      const buf = Buffer.alloc(bufSize);
      let off = 0;

      buf[off++] = 0x01;
      buf.writeUInt16LE(visSnakes.length, off); off += 2;

      for (const snake of visSnakes) {
        buf.writeUInt16LE(snake.id, off); off += 2;
        buf[off++] = snake.skin;
        buf[off++] = snake.boosting ? 1 : 0;
        buf.writeUInt16LE(Math.min(snake.score, 65535), off); off += 2;
        const nameBytes = Buffer.from(snake.name, 'utf8');
        buf[off++] = nameBytes.length;
        nameBytes.copy(buf, off); off += nameBytes.length;
        buf.writeUInt16LE(snake.segments.length, off); off += 2;
        for (const seg of snake.segments) {
          buf.writeInt16LE(Math.round(seg.x), off); off += 2;
          buf.writeInt16LE(Math.round(seg.y), off); off += 2;
        }
      }

      buf.writeUInt16LE(visFood.length, off); off += 2;
      for (const f of visFood) {
        buf.writeInt16LE(Math.round(f.x), off); off += 2;
        buf.writeInt16LE(Math.round(f.y), off); off += 2;
        buf[off++] = f.color;
        buf[off++] = Math.round(f.radius);
        buf[off++] = f.tier;
      }

      buf.writeUInt16LE(visMega.length, off); off += 2;
      for (const m of visMega) {
        buf.writeInt16LE(Math.round(m.x), off); off += 2;
        buf.writeInt16LE(Math.round(m.y), off); off += 2;
        buf[off++] = m.color;
        buf[off++] = Math.round(m.radius);
        buf[off++] = Math.min(m.value, 255);
      }

      ws.send(buf.slice(0, off));
    }
  }

  broadcastLeaderboard() {
    const sorted = Array.from(this.snakes.values())
      .filter(s => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    let size = 2;
    for (const s of sorted) size += 5 + Buffer.byteLength(s.name, 'utf8');
    const buf = Buffer.alloc(size);
    let off = 0;
    buf[off++] = 0x05;
    buf[off++] = sorted.length;
    for (const s of sorted) {
      buf.writeUInt16LE(s.id, off); off += 2;
      buf.writeUInt16LE(Math.min(s.score, 65535), off); off += 2;
      const nameBytes = Buffer.from(s.name, 'utf8');
      buf[off++] = nameBytes.length;
      nameBytes.copy(buf, off); off += nameBytes.length;
    }
    this.broadcast(buf.slice(0, off));
  }

  broadcast(data) {
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }
}

module.exports = { GameServer };
