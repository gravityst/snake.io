const WebSocket = require('ws');

// --- Constants ---
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const MAP_SIZE = 6000;
const FOOD_COUNT = 1500;
const FOOD_RADIUS = 8;
const SNAKE_SPEED = 200; // pixels per second
const BOOST_SPEED = 400;
const SEGMENT_SPACING = 16;
const INITIAL_LENGTH = 10;
const FOOD_VALUE = 1; // segments worth per food
const HEAD_RADIUS = 14;
const BODY_RADIUS = 12;
const BOOST_SHRINK_RATE = 0.5; // segments lost per second while boosting
const ORB_VALUE = 2;
const MAX_SNAKES = 50;

// --- Binary Protocol ---
// Client -> Server:
//   [0x01, angle (float32)]                    = direction update
//   [0x02, boosting (uint8)]                   = boost toggle
//   [0x03, ...nameBytes]                       = join with name
//
// Server -> Client:
//   [0x01, ...state]                           = full state update
//   [0x02, playerId (uint16)]                  = welcome (your id)
//   [0x03, playerId (uint16)]                  = death notification
//   [0x04, killerId(uint16), killedId(uint16)] = kill feed
//   [0x05, ...leaderboard]                     = leaderboard

class GameServer {
  constructor(httpServer) {
    this.wss = new WebSocket.Server({ server: httpServer });
    this.snakes = new Map();
    this.food = [];
    this.orbs = []; // from dead snakes
    this.nextId = 1;
    this.clients = new Map(); // ws -> playerId

    this.spawnInitialFood();

    this.wss.on('connection', (ws) => this.onConnection(ws));

    // Main game loop
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  spawnInitialFood() {
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.food.push(this.createFood());
    }
  }

  createFood() {
    return {
      x: (Math.random() - 0.5) * MAP_SIZE,
      y: (Math.random() - 0.5) * MAP_SIZE,
      color: Math.floor(Math.random() * 8),
      radius: FOOD_RADIUS + Math.random() * 4,
    };
  }

  onConnection(ws) {
    ws.binaryType = 'arraybuffer';
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      if (!(data instanceof ArrayBuffer) && !Buffer.isBuffer(data)) return;
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length < 1) return;

      const type = buf[0];

      if (type === 0x03) {
        // Join
        const name = buf.slice(1).toString('utf8').substring(0, 16) || 'Player';
        this.spawnSnake(ws, name);
        return;
      }

      const playerId = this.clients.get(ws);
      if (playerId === undefined) return;
      const snake = this.snakes.get(playerId);
      if (!snake) return;

      if (type === 0x01 && buf.length >= 5) {
        // Direction update
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

  spawnSnake(ws, name) {
    if (this.clients.has(ws)) return; // already in game

    const id = this.nextId++;
    const angle = Math.random() * Math.PI * 2;
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const y = (Math.random() - 0.5) * MAP_SIZE * 0.6;

    // Build initial segments
    const segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      segments.push({
        x: x - Math.cos(angle) * i * SEGMENT_SPACING,
        y: y - Math.sin(angle) * i * SEGMENT_SPACING,
      });
    }

    const snake = {
      id,
      name,
      segments,
      angle,
      targetAngle: angle,
      boosting: false,
      score: 0,
      color: Math.floor(Math.random() * 8),
      alive: true,
      boostAccum: 0,
    };

    this.snakes.set(id, snake);
    this.clients.set(ws, id);

    // Send welcome packet
    const welcome = Buffer.alloc(3);
    welcome[0] = 0x02;
    welcome.writeUInt16LE(id, 1);
    ws.send(welcome);
  }

  killSnake(playerId, killerId) {
    const snake = this.snakes.get(playerId);
    if (!snake || !snake.alive) return;
    snake.alive = false;

    // Spawn orbs from segments
    for (let i = 0; i < snake.segments.length; i += 2) {
      const seg = snake.segments[i];
      this.orbs.push({
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        color: snake.color,
        radius: FOOD_RADIUS + 3,
        value: ORB_VALUE,
      });
    }

    // Broadcast kill
    if (killerId !== null) {
      const killFeed = Buffer.alloc(5);
      killFeed[0] = 0x04;
      killFeed.writeUInt16LE(killerId, 1);
      killFeed.writeUInt16LE(playerId, 3);
      this.broadcast(killFeed);
    }

    // Send death to the dead player
    for (const [ws, pid] of this.clients) {
      if (pid === playerId) {
        const deathBuf = Buffer.alloc(3);
        deathBuf[0] = 0x03;
        deathBuf.writeUInt16LE(playerId, 1);
        if (ws.readyState === WebSocket.OPEN) ws.send(deathBuf);
        this.clients.delete(ws);
        break;
      }
    }

    this.snakes.delete(playerId);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTick) / 1000, 0.05); // cap at 50ms
    this.lastTick = now;

    // Update all snakes
    for (const [id, snake] of this.snakes) {
      if (!snake.alive) continue;
      this.updateSnake(snake, dt);
    }

    // Check collisions
    this.checkCollisions();

    // Replenish food
    while (this.food.length < FOOD_COUNT) {
      this.food.push(this.createFood());
    }

    // Clean up old orbs (decay after 30s equivalent — just cap count)
    if (this.orbs.length > 2000) {
      this.orbs.splice(0, this.orbs.length - 2000);
    }

    // Send state to all clients
    this.broadcastState();

    // Send leaderboard every 30 ticks (~1s)
    if (this.nextId % TICK_RATE === 0 || this.snakes.size <= 10) {
      this.broadcastLeaderboard();
    }
  }

  updateSnake(snake, dt) {
    // Smooth turning
    let angleDiff = snake.targetAngle - snake.angle;
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const turnSpeed = 4.0; // radians per second
    if (Math.abs(angleDiff) < turnSpeed * dt) {
      snake.angle = snake.targetAngle;
    } else {
      snake.angle += Math.sign(angleDiff) * turnSpeed * dt;
    }

    // Move head
    const speed = snake.boosting ? BOOST_SPEED : SNAKE_SPEED;
    const head = snake.segments[0];
    const newHead = {
      x: head.x + Math.cos(snake.angle) * speed * dt,
      y: head.y + Math.sin(snake.angle) * speed * dt,
    };

    // World bounds — wrap or clamp
    const half = MAP_SIZE / 2;
    if (newHead.x < -half || newHead.x > half || newHead.y < -half || newHead.y > half) {
      // Kill snake at boundary
      this.killSnake(snake.id, null);
      return;
    }

    // Unshift new head, maintain spacing
    snake.segments.unshift(newHead);

    // Remove excess tail segments to maintain proper length
    const targetLength = INITIAL_LENGTH + snake.score;
    while (snake.segments.length > targetLength) {
      snake.segments.pop();
    }

    // Boost shrinks the snake
    if (snake.boosting && snake.segments.length > 5) {
      snake.boostAccum += BOOST_SHRINK_RATE * dt;
      if (snake.boostAccum >= 1) {
        const removed = Math.floor(snake.boostAccum);
        snake.boostAccum -= removed;
        for (let i = 0; i < removed && snake.segments.length > 5; i++) {
          const tail = snake.segments.pop();
          snake.score = Math.max(0, snake.score - 1);
          // Spawn a small orb behind
          this.food.push({
            x: tail.x,
            y: tail.y,
            color: snake.color,
            radius: FOOD_RADIUS,
          });
        }
      }
    }

    // Eat food
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      const dx = newHead.x - f.x;
      const dy = newHead.y - f.y;
      if (dx * dx + dy * dy < (HEAD_RADIUS + f.radius) * (HEAD_RADIUS + f.radius)) {
        this.food.splice(i, 1);
        snake.score += FOOD_VALUE;
      }
    }

    // Eat orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const dx = newHead.x - o.x;
      const dy = newHead.y - o.y;
      if (dx * dx + dy * dy < (HEAD_RADIUS + o.radius) * (HEAD_RADIUS + o.radius)) {
        this.orbs.splice(i, 1);
        snake.score += o.value;
      }
    }
  }

  checkCollisions() {
    const snakeArr = Array.from(this.snakes.values()).filter(s => s.alive);

    for (let i = 0; i < snakeArr.length; i++) {
      const a = snakeArr[i];
      if (!a.alive) continue;
      const ahead = a.segments[0];

      for (let j = 0; j < snakeArr.length; j++) {
        if (i === j) continue;
        const b = snakeArr[j];
        if (!b.alive) continue;

        // Check if a's head collides with any of b's body segments (skip head)
        for (let k = 1; k < b.segments.length; k++) {
          const seg = b.segments[k];
          const dx = ahead.x - seg.x;
          const dy = ahead.y - seg.y;
          const dist = HEAD_RADIUS + BODY_RADIUS;
          if (dx * dx + dy * dy < dist * dist) {
            this.killSnake(a.id, b.id);
            // Award killer
            b.score += Math.floor(a.segments.length / 2);
            break;
          }
        }
      }
    }
  }

  broadcastState() {
    // Build per-client viewport-filtered state
    for (const [ws, playerId] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;

      const mySnake = this.snakes.get(playerId);
      if (!mySnake || !mySnake.alive) continue;

      const cx = mySnake.segments[0].x;
      const cy = mySnake.segments[0].y;
      const viewRange = 1200; // pixels from center to include

      // Collect visible snakes
      const visibleSnakes = [];
      for (const [id, snake] of this.snakes) {
        if (!snake.alive) continue;
        // Check if any segment is in view
        let inView = false;
        for (let i = 0; i < snake.segments.length; i += 3) {
          const s = snake.segments[i];
          if (Math.abs(s.x - cx) < viewRange && Math.abs(s.y - cy) < viewRange) {
            inView = true;
            break;
          }
        }
        if (inView) visibleSnakes.push(snake);
      }

      // Collect visible food
      const visibleFood = [];
      for (const f of this.food) {
        if (Math.abs(f.x - cx) < viewRange && Math.abs(f.y - cy) < viewRange) {
          visibleFood.push(f);
        }
      }

      // Collect visible orbs
      const visibleOrbs = [];
      for (const o of this.orbs) {
        if (Math.abs(o.x - cx) < viewRange && Math.abs(o.y - cy) < viewRange) {
          visibleOrbs.push(o);
        }
      }

      // Binary format:
      // [0x01][snakeCount(u16)]
      // For each snake: [id(u16)][color(u8)][boosting(u8)][score(u16)][nameLen(u8)][name][segCount(u16)][segments as i16 pairs]
      // [foodCount(u16)][food as i16,i16,u8,u8]
      // [orbCount(u16)][orbs as i16,i16,u8]

      // Estimate buffer size
      let totalSegs = 0;
      let totalNameBytes = 0;
      for (const s of visibleSnakes) {
        totalSegs += s.segments.length;
        totalNameBytes += Buffer.byteLength(s.name, 'utf8');
      }

      const bufSize = 1 + 2 +
        visibleSnakes.length * (2 + 1 + 1 + 2 + 1 + 2) + totalNameBytes + totalSegs * 4 +
        2 + visibleFood.length * 6 +
        2 + visibleOrbs.length * 5;

      const buf = Buffer.alloc(bufSize);
      let offset = 0;

      buf[offset++] = 0x01;
      buf.writeUInt16LE(visibleSnakes.length, offset); offset += 2;

      for (const snake of visibleSnakes) {
        buf.writeUInt16LE(snake.id, offset); offset += 2;
        buf[offset++] = snake.color;
        buf[offset++] = snake.boosting ? 1 : 0;
        buf.writeUInt16LE(Math.min(snake.score, 65535), offset); offset += 2;

        const nameBytes = Buffer.from(snake.name, 'utf8');
        buf[offset++] = nameBytes.length;
        nameBytes.copy(buf, offset); offset += nameBytes.length;

        buf.writeUInt16LE(snake.segments.length, offset); offset += 2;
        for (const seg of snake.segments) {
          buf.writeInt16LE(Math.round(seg.x), offset); offset += 2;
          buf.writeInt16LE(Math.round(seg.y), offset); offset += 2;
        }
      }

      buf.writeUInt16LE(visibleFood.length, offset); offset += 2;
      for (const f of visibleFood) {
        buf.writeInt16LE(Math.round(f.x), offset); offset += 2;
        buf.writeInt16LE(Math.round(f.y), offset); offset += 2;
        buf[offset++] = f.color;
        buf[offset++] = Math.round(f.radius);
      }

      buf.writeUInt16LE(visibleOrbs.length, offset); offset += 2;
      for (const o of visibleOrbs) {
        buf.writeInt16LE(Math.round(o.x), offset); offset += 2;
        buf.writeInt16LE(Math.round(o.y), offset); offset += 2;
        buf[offset++] = o.color;
      }

      ws.send(buf.slice(0, offset));
    }
  }

  broadcastLeaderboard() {
    const sorted = Array.from(this.snakes.values())
      .filter(s => s.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // [0x05][count(u8)][id(u16),score(u16),nameLen(u8),name]...
    let size = 2;
    for (const s of sorted) size += 5 + Buffer.byteLength(s.name, 'utf8');
    const buf = Buffer.alloc(size);
    let offset = 0;
    buf[offset++] = 0x05;
    buf[offset++] = sorted.length;
    for (const s of sorted) {
      buf.writeUInt16LE(s.id, offset); offset += 2;
      buf.writeUInt16LE(Math.min(s.score, 65535), offset); offset += 2;
      const nameBytes = Buffer.from(s.name, 'utf8');
      buf[offset++] = nameBytes.length;
      nameBytes.copy(buf, offset); offset += nameBytes.length;
    }
    this.broadcast(buf.slice(0, offset));
  }

  broadcast(data) {
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

module.exports = { GameServer };
