// ============================================================
// LocalGame — offline single-player game engine with AI bots
// Used for "PLAY VS AI" mode. No server connection needed.
// Supports: classic, royale, domination (Zone Domination), ctf (Capture the Orb).
// The team modes mirror the server's rules so "Play vs AI" plays the same,
// fully offline. They expose getDominationState()/getCtfState() etc. in the
// same shapes the multiplayer client already renders.
// ============================================================

// ---- Team-mode tuning (mirrors server/game.js) ----
const LG_DOM = {
  MAP_W: 18000, MAP_H: 11000, ROUND_MS: 6*60*1000, END_HOLD_MS: 12000, OVERTIME_MS: 45000,
  ADJ_DIST: 4200, CAP_R: 920, VIP_R: 1080, HOME_R: 1180, RES_R: 960,
  CAPTURE_RATE: 24, NEUTRALIZE_RATE: 30, DEFENDER_GRACE_MS: 3000, DECAY_RATE: 10,
  MAX_LEVEL: 5, LEVEL_HOLD_SEC: 15, BASE_PTS: 2.0, VIP_PTS: 7.0, HOME_PTS: 1.4, RES_PTS: 1.6,
  RES_RATE: 4.0, RES_CONV_RATE: 3.0, RES_CONV_VAL: 0.5, COLLECTOR_YIELD: 0.5,
  CONN_MULT: 0.16, HOTSPOT_MULT: 3.0, HOTSPOT_PERIOD_MS: 40000, HOTSPOT_DUR_MS: 26000, HOTSPOT_COUNT: 2,
  EVENT_PERIOD_MS: 58000, EVENT_DUR_MS: 24000, FOODSTORM_BURST: 650,
  CORE_DISABLE_SEC: 3.0, CORE_REPAIR_SEC: 6, BOTS: 13,
};
const LG_CTF = {
  MAP_W: 13000, MAP_H: 8000, ROUND_MS: 6*60*1000, END_HOLD_MS: 12000, CAPTURES_TO_WIN: 3,
  BASE_X_FRAC: 0.62, BASE_R: 1100, ORB_R: 40, PICKUP_R: 95, SCORE_R: 360, RETURN_SEC: 8, BOTS: 11,
};
const ZN_NORMAL = 0, ZN_VIP = 1, ZN_HOME = 2, ZN_RESOURCE = 3;
const RW = [1.0, 1.0, 1.0, 1.35]; // role capture weight (Commander heavier)
const TEAM_NAMES_RB = ['Red','Blue','Green','Gold'];
const TEAM_COLORS_RB = ['#ff3b3b','#3b82f6','#3fb950','#f5c518'];
const DOM_EVENTS = ['foodstorm','doublepoints','relocation'];

class LocalGame {
  constructor(playerName, skinIdx, mode = 'classic', config = {}) {
    this.MAP_SIZE = 14000;
    this.FOOD_COUNT = 2600;
    this.SNAKE_SPEED = 280;
    this.BOOST_SPEED = 500;
    this.SEGMENT_SPACING = 24;
    this.DOT_RADIUS = 9;
    this.INITIAL_LENGTH = 10;
    this.HEAD_RADIUS = 14;
    this.BOOST_SHRINK_RATE = 2.5;
    this.mode = mode;
    this.config = config;

    // Playfield bounds — square by default; team modes use rectangles.
    this.mapHalfW = this.MAP_SIZE / 2;
    this.mapHalfH = this.MAP_SIZE / 2;

    // ----------- Mode-specific config -----------
    if (mode === 'domination') {
      this.mapHalfW = LG_DOM.MAP_W / 2; this.mapHalfH = LG_DOM.MAP_H / 2;
      this.BOT_COUNT = LG_DOM.BOTS; this.MEGA_ORB_COUNT = 8; this.NO_RESPAWN = false;
      this.safeRadius = this.MAP_SIZE; this.matchState = 'active'; this.matchCountdown = 0; this.victoryFlag = false;
    } else if (mode === 'ctf') {
      this.mapHalfW = LG_CTF.MAP_W / 2; this.mapHalfH = LG_CTF.MAP_H / 2;
      this.BOT_COUNT = LG_CTF.BOTS; this.MEGA_ORB_COUNT = 0; this.NO_RESPAWN = false;
      this.safeRadius = this.MAP_SIZE; this.matchState = 'active'; this.matchCountdown = 0; this.victoryFlag = false;
    } else if (mode === 'royale') {
      this.BOT_COUNT = 19;            // player + 19 bots = 20 total
      this.MEGA_ORB_COUNT = config.megaOrbs ?? 8;
      this.NO_RESPAWN = true;         // BR: dead is dead
      // BR starts at near-max radius, shrinks across 5 phases.
      // Optional config: startRadius, phaseSpeed (1=normal, <1 faster).
      const startR = config.startRadius ?? Math.floor(this.MAP_SIZE / 2 - 500);
      const sp = Math.max(0.5, Math.min(2, config.phaseSpeed ?? 1));
      this.ROYALE_PHASES = [
        { hold: 30 * sp, shrinkTime: 30 * sp, radius: Math.max(120, Math.floor(startR * 0.55)) },
        { hold: 22 * sp, shrinkTime: 25 * sp, radius: Math.max(100, Math.floor(startR * 0.32)) },
        { hold: 16 * sp, shrinkTime: 20 * sp, radius: Math.max( 80, Math.floor(startR * 0.16)) },
        { hold: 12 * sp, shrinkTime: 16 * sp, radius: Math.max( 60, Math.floor(startR * 0.07)) },
        { hold:  8 * sp, shrinkTime: 12 * sp, radius:  Math.max( 40, Math.floor(startR * 0.02)) },
      ];
      this.safeRadius = startR;
      // Pre-match waiting room: 5 seconds for single-player.
      this.matchState = 'countdown';
      this.matchCountdown = 5.0;
      // Victory state when player wins
      this.victoryFlag = false;
      this.victoryAt = 0;
    } else {
      this.BOT_COUNT = 25;
      this.MEGA_ORB_COUNT = 12;
      this.NO_RESPAWN = false;
      this.safeRadius = this.MAP_SIZE / 2 - 250;
      this.matchState = 'active';
      this.matchCountdown = 0;
      this.victoryFlag = false;
    }
    this.safePrevRadius = this.safeRadius;
    this.safeTargetRadius = this.safeRadius;
    this.shrinkPulse = 0;
    this.royalePhaseIdx   = 0;
    this.royalePhaseState = 'hold';
    this.royalePhaseTimer = 0;
    this.royaleEvents     = [];
    this.safeCenterX = 0;
    this.safeCenterY = 0;

    this.snakes = [];
    this.food = [];
    this.megaOrbs = [];
    this.nextId = 1;
    this.playerId = null;
    this.deathCallback = null;

    // Optional bot-difficulty override from config: 'easy' | 'mixed' | 'hard'
    this._botDifficulty = config.botDifficulty || 'mixed';

    // Team modes: stand up teams + board before spawning anyone.
    if (mode === 'domination') this._domInit(config);
    else if (mode === 'ctf') this._ctfInit(config);

    const BOT_NAMES = [
      'Viper','Shadow','Blaze','Neon','Ghost','Toxic','Pixel','Glitch',
      'Storm','Bolt','Ember','Frost','Nova','Pulse','Drift','Surge',
      'Zenith','Razor','Flux','Echo','Orbit','Prism','Hex','Chrome',
    ];
    // Spawn player
    const player = this._createSnake(playerName, false, skinIdx);
    this.playerId = player.id;
    if (mode === 'domination') {
      player.teamId = this._validTeam(config.team);
      player.role = (config.role >= 0 && config.role <= 3) ? config.role : 0;
      this.teams[player.teamId].memberIds.add(player.id);
      this._domPlaceAtHome(player);
    } else if (mode === 'ctf') {
      player.teamId = this._validTeam(config.team);
      this.teams[player.teamId].memberIds.add(player.id);
      this._ctfPlaceAtBase(player);
    }

    // Spawn bots
    for (let i = 0; i < this.BOT_COUNT; i++) {
      const bot = this._createSnake(BOT_NAMES[i % BOT_NAMES.length], true,
        Math.floor(Math.random() * 43), this._randomSkill());
      if (mode === 'domination') this._domBotJoin(bot);
      else if (mode === 'ctf') this._ctfBotJoin(bot);
    }

    // Spawn food + mega orbs
    for (let i = 0; i < this.FOOD_COUNT; i++) this.food.push(this._createFood());
    for (let i = 0; i < this.MEGA_ORB_COUNT; i++) this.megaOrbs.push(this._createMegaOrb());
  }

  _validTeam(t) { return (this.teams && this.teams[t]) ? t : 0; }

  onPlayerDeath(cb) { this.deathCallback = cb; }

  setPlayerInput(angle, boosting) {
    const me = this.snakes.find(s => s.id === this.playerId);
    if (me && me.alive) { me.targetAngle = angle; me.boosting = boosting; }
  }

  // --- Helpers ---
  _zoned(power = 1.5) {
    const r = Math.pow(Math.random(), power) * (this.MAP_SIZE / 2 - 100);
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  // Uniform spread across the whole rectangle (team modes — no center bias).
  _uniformPos(margin = 120) {
    return { x: (Math.random()*2-1)*(this.mapHalfW-margin), y: (Math.random()*2-1)*(this.mapHalfH-margin) };
  }

  // Pick a clear spawn point: inside the safe zone (or map) AND away from
  // any existing snake's head/body. Retries up to `attempts` times before
  // falling back to whatever _zoned returned.
  _safeSpawn(power = 1.5, attempts = 30) {
    const inRoyale = this.mode === 'royale';
    const cx = inRoyale ? this.safeCenterX : 0;
    const cy = inRoyale ? this.safeCenterY : 0;
    const maxR = inRoyale
      ? Math.max(150, this.safeRadius - 250)
      : this.MAP_SIZE / 2 - 200;
    const minClearance = 220;
    for (let k = 0; k < attempts; k++) {
      const r = Math.pow(Math.random(), power) * maxR;
      const a = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      let clear = true;
      for (const s of this.snakes) {
        if (!s.alive || s.segments.length === 0) continue;
        const checkLen = Math.min(s.segments.length, 40);
        for (let j = 0; j < checkLen; j++) {
          const dx = s.segments[j].x - x, dy = s.segments[j].y - y;
          if (dx*dx + dy*dy < minClearance*minClearance) { clear = false; break; }
        }
        if (!clear) break;
      }
      if (clear) return { x, y };
    }
    // Fallback — at least clip to safe zone in royale mode
    const r = Math.pow(Math.random(), power) * maxR;
    const a = Math.random() * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  _thickness(snake) { return 1 + Math.sqrt(snake.score) / 45 + snake.score / 8000; }

  _randomSkill() {
    if (this._botDifficulty === 'easy') {
      const r = Math.random();
      if (r < 0.05) return 1;
      return 0;
    }
    if (this._botDifficulty === 'hard') {
      const r = Math.random();
      if (r < 0.55) return 2;
      if (r < 0.95) return 1;
      return 0;
    }
    // mixed (default)
    const r = Math.random();
    if (r < 0.20) return 2;
    if (r < 0.60) return 1;
    return 0;
  }

  _createSnake(name, isBot, skinIdx, skill) {
    const id = this.nextId++;
    const angle = Math.random() * Math.PI * 2;
    const pos = this._safeSpawn(isBot ? 1.2 : 2.5);
    const segments = [];
    for (let i = 0; i < this.INITIAL_LENGTH; i++) {
      segments.push({ x: pos.x - Math.cos(angle)*i*this.SEGMENT_SPACING, y: pos.y - Math.sin(angle)*i*this.SEGMENT_SPACING });
    }
    const snake = {
      id, name, segments, angle, targetAngle: angle,
      boosting: false, score: 0, skin: skinIdx,
      color: Math.floor(Math.random()*8), alive: true,
      isBot, skill: skill ?? 0,
      boostAccum: 0, botTimer: 0, botWanderAngle: angle,
      teamId: -1, role: -1, ctfRole: null, evasion: 1, // team-mode fields
    };
    this.snakes.push(snake);
    return snake;
  }

  _createFood() {
    const r = Math.random();
    let radius, value, tier;
    if (r<0.35)      { radius=3+Math.random()*2; value=1; tier=0; }
    else if (r<0.58) { radius=5+Math.random()*2; value=2; tier=1; }
    else if (r<0.75) { radius=7+Math.random()*2; value=3; tier=2; }
    else if (r<0.87) { radius=9+Math.random()*2; value=5; tier=3; }
    else if (r<0.94) { radius=11+Math.random()*2; value=8; tier=4; }
    else if (r<0.975){ radius=13+Math.random()*2; value=12; tier=5; }
    else if (r<0.99) { radius=15+Math.random()*2; value=18; tier=6; }
    else if (r<0.997){ radius=18+Math.random()*2; value=26; tier=7; }
    else             { radius=21+Math.random()*3; value=35; tier=8; }
    const pos = (this.mode === 'domination' || this.mode === 'ctf') ? this._uniformPos() : this._zoned(1.5);
    return { x: pos.x, y: pos.y, color: Math.floor(Math.random()*8), radius, value, tier };
  }

  _createMegaOrb() {
    const a = Math.random()*Math.PI*2;
    const speed = 25 + Math.random()*25;
    const pos = this._zoned(1.3);
    return { x: pos.x, y: pos.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed,
      radius: 22+Math.random()*8, value: 50+Math.floor(Math.random()*31),
      color: Math.floor(Math.random()*8), spin: Math.random()*Math.PI*2 };
  }

  // --- Tick ---
  tick(dt) {
    // Pre-match countdown — freeze the world so players can read the timer
    if (this.mode === 'royale' && this.matchState === 'countdown') {
      this.matchCountdown -= dt;
      if (this.matchCountdown <= 0) {
        this.matchCountdown = 0;
        this.matchState = 'active';
        this.royalePhaseTimer = 0;  // restart phase clock on go
      }
      return;
    }
    // Victory state — also freeze
    if (this.mode === 'royale' && this.matchState === 'victory') {
      return;
    }

    // Mega orbs
    const hbW = this.mapHalfW-50, hbH = this.mapHalfH-50;
    for (const m of this.megaOrbs) {
      m.x+=m.vx*dt; m.y+=m.vy*dt; m.spin+=dt*1.5;
      if (m.x<-hbW){m.x=-hbW;m.vx=Math.abs(m.vx);} if (m.x>hbW){m.x=hbW;m.vx=-Math.abs(m.vx);}
      if (m.y<-hbH){m.y=-hbH;m.vy=Math.abs(m.vy);} if (m.y>hbH){m.y=hbH;m.vy=-Math.abs(m.vy);}
    }

    // Bot AI
    for (const s of this.snakes) { if (s.isBot && s.alive) this._botAI(s, dt); }

    // Update all
    for (const s of this.snakes) { if (s.alive) this._updateSnake(s, dt); }

    // Collisions
    this._checkCollisions();

    // Team-mode logic (Zone Domination / Capture the Orb)
    if (this.mode === 'domination') this._domTick(dt);
    else if (this.mode === 'ctf') this._ctfTick(dt);

    // Battle Royale: phased shrink (no drift — center stays at origin)
    if (this.mode === 'royale') {
      // ---- Phased shrink (hold N seconds → shrink M seconds → repeat) ----
      this.royalePhaseTimer += dt;
      const phase = this.ROYALE_PHASES[this.royalePhaseIdx];
      if (phase) {
        if (this.royalePhaseState === 'hold') {
          if (this.royalePhaseTimer >= phase.hold) {
            this.royalePhaseState = 'shrink';
            this.royalePhaseTimer = 0;
            this.safePrevRadius = this.safeRadius;
            this.safeTargetRadius = phase.radius;
            this.royaleEvents.push({ type: 'shrinkStart', radius: phase.radius, at: Date.now() });
          }
        } else if (this.royalePhaseState === 'shrink') {
          // Smooth ease-in-out lerp between prevRadius → targetRadius
          const t = Math.min(1, this.royalePhaseTimer / phase.shrinkTime);
          const eased = t * t * (3 - 2 * t); // smoothstep
          this.safeRadius = this.safePrevRadius + (this.safeTargetRadius - this.safePrevRadius) * eased;
          if (t >= 1) {
            this.safeRadius = this.safeTargetRadius;
            this.royalePhaseIdx++;
            this.royalePhaseState = this.ROYALE_PHASES[this.royalePhaseIdx] ? 'hold' : 'done';
            this.royalePhaseTimer = 0;
            this.royaleEvents.push({ type: 'shrinkEnd', radius: this.safeRadius, at: Date.now() });
          }
        }
      }
      this.shrinkPulse = 0; // no bobbing
    }

    // Respawn dead snakes. Classic: bots only. Team modes: everyone (incl. the
    // player) respawns at their base — it's a drop-in objective game, not
    // elimination — so the match keeps going.
    if (!this.NO_RESPAWN) {
      for (const s of this.snakes) {
        if (s.alive) continue;
        if (this.mode === 'domination' || this.mode === 'ctf') this._respawnAtBase(s);
        else if (s.isBot) this._respawnBot(s);
      }
    }

    // BR victory detection: trigger when only the player remains alive
    if (this.mode === 'royale' && this.matchState === 'active') {
      const aliveSnakes = this.snakes.filter(s => s.alive);
      if (aliveSnakes.length === 1 && aliveSnakes[0].id === this.playerId) {
        this.matchState = 'victory';
        this.victoryFlag = true;
        this.victoryAt = Date.now();
      }
    }

    // Replenish
    while (this.food.length < this.FOOD_COUNT) this.food.push(this._createFood());
    while (this.megaOrbs.length < this.MEGA_ORB_COUNT) this.megaOrbs.push(this._createMegaOrb());
  }

  // Snapshot of the Battle Royale phase machine for the HUD.
  // Returns null when not in royale mode.
  getRoyaleStatus() {
    if (this.mode !== 'royale') return null;
    const phase = this.ROYALE_PHASES[this.royalePhaseIdx];
    const winner = this.snakes.find(s => !s.isBot && s.alive)
      ? null
      : (this.snakes.filter(s => s.alive)[0] || null);
    let timeRemaining = 0;
    if (phase && this.royalePhaseState === 'hold') {
      timeRemaining = Math.max(0, phase.hold - this.royalePhaseTimer);
    } else if (phase && this.royalePhaseState === 'shrink') {
      timeRemaining = Math.max(0, phase.shrinkTime - this.royalePhaseTimer);
    }
    // Drain events for the client to display as banner notifications
    const events = this.royaleEvents;
    this.royaleEvents = [];
    const playerSnake = this.snakes.find(s => s.id === this.playerId);
    return {
      state: this.royalePhaseState,
      phaseIdx: this.royalePhaseIdx,
      totalPhases: this.ROYALE_PHASES.length,
      timeRemaining,
      currentRadius: this.safeRadius,
      targetRadius: this.safeTargetRadius,
      centerX: this.safeCenterX,
      centerY: this.safeCenterY,
      alive: this.snakes.filter(s => s.alive).length,
      total: this.snakes.length,
      events,
      winner: winner && !winner.isBot ? winner.name : null,
      isDead: !(playerSnake && playerSnake.alive),
      matchState: this.matchState,       // 'countdown' | 'active' | 'victory'
      matchCountdown: this.matchCountdown,
      victoryFlag: this.victoryFlag,
      playerScore: playerSnake ? playerSnake.score : 0,
    };
  }

  _updateSnake(snake, dt) {
    let ad = snake.targetAngle - snake.angle;
    while (ad > Math.PI) ad -= Math.PI*2;
    while (ad < -Math.PI) ad += Math.PI*2;
    if (Math.abs(ad) < 9*dt) snake.angle = snake.targetAngle;
    else snake.angle += Math.sign(ad) * 9 * dt;
    if (snake.boosting && snake.score <= 0) snake.boosting = false;
    const speed = snake.boosting ? this.BOOST_SPEED : this.SNAKE_SPEED;
    const head = snake.segments[0];
    head.x += Math.cos(snake.angle)*speed*dt;
    head.y += Math.sin(snake.angle)*speed*dt;
    const hw = this.mapHalfW, hh = this.mapHalfH;
    if (head.x<-hw||head.x>hw||head.y<-hh||head.y>hh) { this._kill(snake, null); return; }
    if (this.mode === 'royale') {
      const dx = head.x - this.safeCenterX;
      const dy = head.y - this.safeCenterY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > this.safeRadius) { this._kill(snake, null); return; }
    }
    while (snake.segments.length >= 2) {
      const dx=head.x-snake.segments[1].x, dy=head.y-snake.segments[1].y;
      if (dx*dx+dy*dy < this.SEGMENT_SPACING**2) break;
      const dist=Math.sqrt(dx*dx+dy*dy), t=this.SEGMENT_SPACING/dist;
      snake.segments.splice(1,0,{x:snake.segments[1].x+dx*t, y:snake.segments[1].y+dy*t});
    }
    const tl = this.INITIAL_LENGTH + Math.floor(2.5*Math.sqrt(snake.score)+snake.score/60);
    while (snake.segments.length > tl) snake.segments.pop();
    if (snake.boosting && snake.score > 0) {
      snake.boostAccum += this.BOOST_SHRINK_RATE*dt;
      if (snake.boostAccum >= 1) {
        const rm = Math.floor(snake.boostAccum); snake.boostAccum -= rm;
        snake.score = Math.max(0, snake.score - rm);
        if (snake.segments.length > 0) {
          const tail = snake.segments[snake.segments.length-1];
          this.food.push({x:tail.x+(Math.random()-0.5)*14,y:tail.y+(Math.random()-0.5)*14,
            color:snake.color,radius:5+Math.random()*2,value:1,tier:0});
        }
      }
    }
    const headR = this.HEAD_RADIUS * this._thickness(snake);
    const eatR = headR + 30;
    let gained = 0;
    for (let i=this.food.length-1;i>=0;i--) {
      const f=this.food[i];
      const dx=f.x-head.x; if(dx>eatR||dx<-eatR) continue;
      const dy=f.y-head.y; if(dy>eatR||dy<-eatR) continue;
      const sr=headR+f.radius;
      if(dx*dx+dy*dy<sr*sr){this.food.splice(i,1);const v=f.value||1;snake.score+=v;gained+=v;}
    }
    for (let i=this.megaOrbs.length-1;i>=0;i--) {
      const m=this.megaOrbs[i]; const dx=head.x-m.x,dy=head.y-m.y;
      if(dx*dx+dy*dy<(headR+m.radius)**2){this.megaOrbs.splice(i,1);snake.score+=m.value;gained+=m.value;}
    }
    // Zone Domination Collector banks part of what it eats into the team economy.
    if (gained>0 && this.mode==='domination' && snake.role===2 && snake.teamId>=0 && this.teams[snake.teamId]) {
      this.teams[snake.teamId].resources += gained * LG_DOM.COLLECTOR_YIELD;
    }
  }

  _checkCollisions() {
    const teamMode = this.mode === 'domination' || this.mode === 'ctf';
    for (let i=0;i<this.snakes.length;i++) {
      const a=this.snakes[i]; if(!a.alive) continue;
      // Protected home/base — a snake inside its own can't be killed.
      if (this.mode === 'domination' && this._domInOwnHome(a)) continue;
      if (this.mode === 'ctf' && this._ctfInOwnBase(a)) continue;
      const ah=a.segments[0], aR=this.HEAD_RADIUS*this._thickness(a)*0.75;
      for (let j=0;j<this.snakes.length;j++) {
        if(i===j) continue;
        const b=this.snakes[j]; if(!b.alive) continue;
        if (teamMode && a.teamId>=0 && a.teamId===b.teamId) continue; // friendly fire off
        const bR=this.DOT_RADIUS*this._thickness(b)*0.75;
        const dist=aR+bR, distSq=dist*dist;
        for (let k=1;k<b.segments.length;k++) {
          const s=b.segments[k], dx=ah.x-s.x, dy=ah.y-s.y;
          if(dx*dx+dy*dy<distSq){this._kill(a,b);b.score+=Math.floor(a.segments.length/2+a.score/4);break;}
        }
        if(!a.alive) break;
      }
    }
  }

  _kill(snake, killer) {
    if(!snake.alive) return;
    snake.alive = false;
    // CTF: a carrier drops the orb where it fell.
    if (this.mode === 'ctf') this._ctfDropOrbsHeldBy(snake);
    // Drop a chunk every 4 segments (was every 2). Cuts corpse-orb count
    // in half so death piles don't snowball into screen-filling blobs when
    // multiple bots die near each other.
    const stride = 4;
    const dropCount = Math.max(1, Math.floor(snake.segments.length / stride));
    const totalValue = Math.max(snake.score, snake.segments.length * 2);
    const perDrop = Math.max(4, Math.floor(totalValue / dropCount));
    for (let i = 0; i < snake.segments.length; i += stride) {
      const s = snake.segments[i];
      const r = 12 + Math.min(snake.score / 25, 14) + Math.random() * 4;
      const v = perDrop + Math.floor(Math.random() * 3);
      const t = r > 18 ? 6 : r > 14 ? 4 : 3;
      this.food.push({
        x: s.x + (Math.random() - 0.5) * 36,
        y: s.y + (Math.random() - 0.5) * 36,
        color: snake.color, radius: r, value: v, tier: t,
      });
    }
    // Team modes auto-respawn the player at base (no death screen) — handled in
    // the tick respawn pass. Other modes notify the death callback.
    if (snake.id === this.playerId && this.deathCallback &&
        this.mode !== 'domination' && this.mode !== 'ctf') {
      const aliveAfter = this.snakes.filter(s => s.alive).length;
      // BR rank: if N others still alive when you die, you placed (N+1)th.
      const rank = this.mode === 'royale' ? aliveAfter + 1 : null;
      this.deathCallback(snake.score, rank);
    }
  }

  _respawnBot(snake) {
    const angle = Math.random()*Math.PI*2;
    const pos = this._safeSpawn(1.2);
    snake.segments = [];
    for (let i=0;i<this.INITIAL_LENGTH;i++) {
      snake.segments.push({x:pos.x-Math.cos(angle)*i*this.SEGMENT_SPACING,y:pos.y-Math.sin(angle)*i*this.SEGMENT_SPACING});
    }
    snake.angle=angle; snake.targetAngle=angle; snake.score=0; snake.alive=true;
    snake.boosting=false; snake.boostAccum=0;
    snake.skin=Math.floor(Math.random()*43); snake.skill=this._randomSkill();
  }

  // Royal Gauntlet: head back to origin if the safe zone is closing in.
  // Margin scales with snake length so longer bots U-turn earlier.
  _fleeShrinkZone(s) {
    if (this.mode !== 'royale') return false;
    // Reference the moving zone center
    const cx = this.safeCenterX, cy = this.safeCenterY;
    const h0 = s.segments[0];
    const ddx = h0.x - cx, ddy = h0.y - cy;
    const dd = Math.sqrt(ddx*ddx + ddy*ddy);
    if (dd > this.safeRadius - 220) {
      s.targetAngle = Math.atan2(cy - h0.y, cx - h0.x);
      s.boosting = dd > this.safeRadius - 60 && s.score > 8;
      return true;
    }
    return false;
  }

  // ============================================================
  // Bot AI — three tiers, each smarter than the last.
  //
  // Shared helpers: forward-lookahead body avoidance (so bots don't
  // walk into walls of body), closest-food / best-value-food search.
  // ============================================================
  _botAI(snake, dt) {
    // EMERGENCY check every frame — bots react to imminent collisions even
    // between their throttled strategic ticks. Stops the "random crashing"
    // where a bot's planned heading was clear 100ms ago but isn't now.
    if (this._emergencyAvoid(snake, dt)) return;
    if (snake.skill === 2) this._hardAI(snake, dt);
    else if (snake.skill === 1) this._mediumAI(snake, dt);
    else this._easyAI(snake, dt);
  }

  // Predict where the head will be in the next ~0.25s and check whether
  // anything is going to be there. If yes, swerve to the clearest direction
  // RIGHT NOW (don't wait for next strategic tick).
  _emergencyAvoid(s, dt) {
    const h = s.segments[0];
    const speed = s.boosting ? this.BOOST_SPEED : this.SNAKE_SPEED;
    // 0.18s of travel — far enough to react, short enough to be "right ahead"
    const lookAhead = speed * 0.18;
    // Predicted head position
    const px = h.x + Math.cos(s.angle) * lookAhead;
    const py = h.y + Math.sin(s.angle) * lookAhead;
    const dangerR = this.HEAD_RADIUS * this._thickness(s) + 22;
    const dangerR2 = dangerR * dangerR;

    let blocked = false;
    let closestT = Infinity;
    let closestSegX = 0, closestSegY = 0;

    // Check against every snake's body and other heads
    for (const o of this.snakes) {
      if (!o.alive) continue;
      const isSelf = o.id === s.id;
      const startK = isSelf ? 10 : 0;
      const checkLen = Math.min(o.segments.length, 60);
      for (let k = startK; k < checkLen; k++) {
        const seg = o.segments[k];
        const dx = seg.x - px, dy = seg.y - py;
        const d2 = dx*dx + dy*dy;
        if (d2 < dangerR2 && d2 < closestT) {
          blocked = true;
          closestT = d2;
          closestSegX = seg.x;
          closestSegY = seg.y;
        }
      }
      // Head-on detection: another snake's head closing on mine
      if (!isSelf) {
        const oh = o.segments[0];
        const dx = oh.x - h.x, dy = oh.y - h.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 220) {
          // Are we moving toward each other?
          const myDir = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
          const theirDir = { x: Math.cos(o.angle), y: Math.sin(o.angle) };
          const toThem = { x: dx / d, y: dy / d };
          const myDot = myDir.x * toThem.x + myDir.y * toThem.y;
          const theirDot = theirDir.x * (-toThem.x) + theirDir.y * (-toThem.y);
          if (myDot > 0.6 && theirDot > 0.6) {
            // Yield — swerve away from the head-on
            blocked = true;
            closestT = d * d;
            closestSegX = oh.x;
            closestSegY = oh.y;
          }
        }
      }
    }

    // Also bail if running into the world border within lookAhead
    const wallW = this.mapHalfW - 80, wallH = this.mapHalfH - 80;
    if (Math.abs(px) > wallW || Math.abs(py) > wallH) {
      blocked = true;
      closestSegX = Math.sign(px) * wallW;
      closestSegY = Math.sign(py) * wallH;
    }
    // BR zone edge
    if (this.mode === 'royale' && this.matchState === 'active') {
      const cx = this.safeCenterX, cy = this.safeCenterY;
      const ddx = px - cx, ddy = py - cy;
      if (ddx*ddx + ddy*ddy > (this.safeRadius - 40) ** 2) {
        blocked = true;
        // Pull toward center
        closestSegX = px + (px - cx);
        closestSegY = py + (py - cy);
      }
    }

    if (!blocked) return false;

    // Find the clearest of 7 candidate angles (forward, ±30°, ±70°, ±115°)
    const OFFSETS = [-2.0, -1.2, -0.55, 0, 0.55, 1.2, 2.0];
    let bestScore = -Infinity, bestAngle = s.angle;
    for (const dA of OFFSETS) {
      const testA = s.angle + dA;
      const tpx = h.x + Math.cos(testA) * lookAhead;
      const tpy = h.y + Math.sin(testA) * lookAhead;
      let minD2 = Infinity;
      for (const o of this.snakes) {
        if (!o.alive) continue;
        const isSelf = o.id === s.id;
        const startK = isSelf ? 10 : 0;
        const checkLen = Math.min(o.segments.length, 60);
        for (let k = startK; k < checkLen; k++) {
          const seg = o.segments[k];
          const dx = seg.x - tpx, dy = seg.y - tpy;
          const d2 = dx*dx + dy*dy;
          if (d2 < minD2) minD2 = d2;
        }
      }
      // Penalize wall / outside-zone candidates
      if (Math.abs(tpx) > wallW || Math.abs(tpy) > wallH) minD2 = Math.min(minD2, 100);
      if (this.mode === 'royale' && this.matchState === 'active') {
        const ddx = tpx - this.safeCenterX, ddy = tpy - this.safeCenterY;
        if (ddx*ddx + ddy*ddy > (this.safeRadius - 40) ** 2) minD2 = Math.min(minD2, 100);
      }
      const turnPenalty = Math.abs(dA) * 1500;
      const score = minD2 - turnPenalty;
      if (score > bestScore) { bestScore = score; bestAngle = testA; }
    }
    s.targetAngle = bestAngle;
    s.boosting = false;
    return true;
  }

  // Multi-angle lookahead: scan 7 candidate headings (forward + ±25°, ±55°,
  // ±90°) and find the one with the most clearance. If the forward heading
  // is blocked within `dangerR`, steer toward the clearest open angle.
  // Avoids the old failure mode of "turn perpendicular straight into more
  // bodies" when surrounded.
  _steerAroundBodies(s, dangerR, lookAhead) {
    const h = s.segments[0];
    const OFFSETS = [0, -0.44, 0.44, -0.96, 0.96, -1.57, 1.57];
    let forwardD2 = Infinity, bestD2 = -1, bestAngle = s.angle;
    for (const dA of OFFSETS) {
      const testAngle = s.angle + dA;
      const px = h.x + Math.cos(testAngle) * lookAhead;
      const py = h.y + Math.sin(testAngle) * lookAhead;
      let minD2 = Infinity;
      for (const o of this.snakes) {
        if (!o.alive) continue;
        const isSelf = o.id === s.id;
        const startK = isSelf ? 8 : 1;
        const checkLen = Math.min(o.segments.length, 50);
        for (let k = startK; k < checkLen; k++) {
          const seg = o.segments[k];
          const dx = seg.x - px, dy = seg.y - py;
          const d2 = dx*dx + dy*dy;
          if (d2 < minD2) minD2 = d2;
        }
      }
      if (dA === 0) forwardD2 = minD2;
      // Lightly favor smaller turns by adding a comfort bonus to near-forward angles
      const turnPenalty = Math.abs(dA) * 4000;
      const score = minD2 - turnPenalty;
      if (score > bestD2) { bestD2 = score; bestAngle = testAngle; }
    }
    if (forwardD2 < dangerR * dangerR) {
      s.targetAngle = bestAngle;
      return true;
    }
    return false;
  }

  // Cheap density check used to break off chases when too many snakes have
  // already converged on the same area (the snowball that produces the
  // gigantic corpse blobs).
  _crowdedAt(x, y, radius, threshold = 3) {
    let count = 0;
    for (const o of this.snakes) {
      if (!o.alive || o.segments.length === 0) continue;
      const dx = o.segments[0].x - x, dy = o.segments[0].y - y;
      if (dx*dx + dy*dy < radius*radius) {
        if (++count >= threshold) return true;
      }
    }
    return false;
  }

  _closestFood(s, maxR) {
    const h = s.segments[0];
    let best = null, bd2 = maxR * maxR;
    for (const f of this.food) {
      const dx = f.x - h.x, dy = f.y - h.y;
      if (dx > maxR || dx < -maxR || dy > maxR || dy < -maxR) continue;
      const d2 = dx*dx + dy*dy;
      if (d2 < bd2) { bd2 = d2; best = f; }
    }
    return best;
  }

  // Value-weighted food search: ratio = value / (distance + 40).
  // Prefers fat tier-5+ corpses over scattered tier-0 dots even at distance.
  _bestFoodByValue(s, maxR) {
    const h = s.segments[0];
    let best = null, bestRatio = 0;
    for (const f of this.food) {
      const dx = f.x - h.x, dy = f.y - h.y;
      if (dx > maxR || dx < -maxR || dy > maxR || dy < -maxR) continue;
      const d = Math.sqrt(dx*dx + dy*dy) + 40;
      const ratio = (f.value || 1) / d;
      if (ratio > bestRatio) { bestRatio = ratio; best = f; }
    }
    return best;
  }

  // EASY — wanders gently but actively seeks nearby food and avoids
  // body collisions in its path. Slow reaction (~0.18s ticks). No boost.
  _easyAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.15 + Math.random() * 0.12;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._fleeShrinkZone(s)) return;
    // Lookahead body avoidance — generous danger zone since they react slow
    if (this._steerAroundBodies(s, 95, 170)) {
      s.boosting = false;
      return;
    }
    // Nearest food up to 700 units
    if (this.mode === 'domination' && this._domSteerToObjective(s)) return;
    if (this.mode === 'ctf' && this._ctfBotObjective(s)) return;
    const f = this._closestFood(s, 700);
    if (f) {
      s.targetAngle = Math.atan2(f.y - h.y, f.x - h.x);
    } else {
      s.botWanderAngle += (Math.random() - 0.5) * 0.6;
      s.targetAngle = s.botWanderAngle;
    }
    s.boosting = false;
  }

  // MEDIUM — value-weighted food search, head-on collision avoidance,
  // grabs mega orbs in range, will boost away from threats. Reacts in ~0.1s.
  _mediumAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.09 + Math.random() * 0.06;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._fleeShrinkZone(s)) return;
    // Body lookahead — tighter sense, sees further ahead
    if (this._steerAroundBodies(s, 110, 220)) {
      s.boosting = false;
      return;
    }
    // Flee bigger snake heads within 280 units
    for (const o of this.snakes) {
      if (o.id === s.id || !o.alive) continue;
      const dx = o.segments[0].x - h.x, dy = o.segments[0].y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 280*280 && o.score >= s.score * 0.85) {
        s.targetAngle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.4;
        s.boosting = d2 < 160*160 && s.score > 12;
        return;
      }
    }
    // Mega orbs within 1300 units — skip if 3+ snakes already swarming there
    let bm = null, bmd2 = 1300*1300;
    for (const m of this.megaOrbs) {
      const dx = m.x - h.x, dy = m.y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bmd2 && !this._crowdedAt(m.x, m.y, 350, 3)) { bmd2 = d2; bm = m; }
    }
    if (bm) {
      const bmd = Math.sqrt(bmd2);
      const t = bmd / this.SNAKE_SPEED;
      s.targetAngle = Math.atan2(bm.y + bm.vy*t - h.y, bm.x + bm.vx*t - h.x);
      s.boosting = bmd > 350 && bmd < 1100 && s.score > 20;
      return;
    }
    // Value-weighted food — skip if there's a dogpile at the target spot
    if (this.mode === 'domination' && this._domSteerToObjective(s)) return;
    if (this.mode === 'ctf' && this._ctfBotObjective(s)) return;
    const f = this._bestFoodByValue(s, 900);
    if (f && !this._crowdedAt(f.x, f.y, 250, 3)) {
      s.targetAngle = Math.atan2(f.y - h.y, f.x - h.x);
    } else {
      s.botWanderAngle += (Math.random() - 0.5) * 0.5;
      s.targetAngle = s.botWanderAngle;
    }
    s.boosting = false;
  }

  // HARD — predicts player position, hunts when bigger, flees when smaller,
  // grabs mega orbs and death piles aggressively, cuts off smaller bots.
  // Reacts every frame (~0.05s) for the smoothest decisions.
  _hardAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.05;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._fleeShrinkZone(s)) return;
    // Heaviest body lookahead — far-sighted
    if (this._steerAroundBodies(s, 125, 260)) {
      s.boosting = false;
      return;
    }
    // Engage the human player specifically — only if NOT in a crowded area
    const player = this.snakes.find(o => o.id === this.playerId && o.alive);
    if (player && player.segments.length > 0) {
      const ph = player.segments[0];
      const dx = ph.x - h.x, dy = ph.y - h.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      const crowdedNearPlayer = this._crowdedAt(ph.x, ph.y, 350, 3);
      // Hunt: tighter range (320), needs clear lane, real size advantage
      if (d < 320 && s.score >= player.score * 1.25 && !crowdedNearPlayer) {
        const lead = 0.4 + d / 450;
        const px = ph.x + Math.cos(player.angle) * this.SNAKE_SPEED * lead;
        const py = ph.y + Math.sin(player.angle) * this.SNAKE_SPEED * lead;
        s.targetAngle = Math.atan2(py - h.y, px - h.x);
        s.boosting = d > 150 && d < 280 && s.score > 30;
        return;
      }
      // Flee: get well clear before continuing
      if (d < 320 && s.score < player.score * 0.7) {
        s.targetAngle = Math.atan2(-dy, -dx) + (Math.random() < 0.5 ? -0.5 : 0.5);
        s.boosting = d < 200 && s.score > 12;
        return;
      }
    }
    // Mega orbs — skip if dogpile is already on them
    let bm = null, bmd2 = 1800*1800;
    for (const m of this.megaOrbs) {
      const dx = m.x - h.x, dy = m.y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bmd2 && !this._crowdedAt(m.x, m.y, 350, 3)) { bmd2 = d2; bm = m; }
    }
    if (bm) {
      const bmd = Math.sqrt(bmd2);
      const t = bmd / this.SNAKE_SPEED;
      s.targetAngle = Math.atan2(bm.y + bm.vy*t - h.y, bm.x + bm.vx*t - h.x);
      s.boosting = bmd > 300 && bmd < 1400 && s.score > 18;
      return;
    }
    // Hunt smaller bots — only chase if the kill zone is clear
    let bp = null, bpd2 = 600*600;
    for (const o of this.snakes) {
      if (o.id === s.id || o.id === this.playerId || !o.alive) continue;
      if (o.score >= s.score * 0.55) continue;
      const dx = o.segments[0].x - h.x, dy = o.segments[0].y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bpd2 && !this._crowdedAt(o.segments[0].x, o.segments[0].y, 280, 2)) {
        bpd2 = d2; bp = o;
      }
    }
    if (bp) {
      const bpd = Math.sqrt(bpd2);
      const lead = 0.5 + bpd / 320;
      const px = bp.segments[0].x + Math.cos(bp.angle) * this.SNAKE_SPEED * lead;
      const py = bp.segments[0].y + Math.sin(bp.angle) * this.SNAKE_SPEED * lead;
      s.targetAngle = Math.atan2(py - h.y, px - h.x);
      s.boosting = bpd > 180 && bpd < 450 && s.score > 30;
      return;
    }
    // Death-pile / high-value food — but skip if the area is a dogpile already
    if (this.mode === 'domination' && this._domSteerToObjective(s)) return;
    if (this.mode === 'ctf' && this._ctfBotObjective(s)) return;
    const bf = this._bestFoodByValue(s, 1300);
    if (bf && !this._crowdedAt(bf.x, bf.y, 280, 3)) {
      s.targetAngle = Math.atan2(bf.y - h.y, bf.x - h.x);
      s.boosting = (bf.value || 1) >= 10 && s.score > 40 && Math.random() < 0.15;
      return;
    }
    s.botWanderAngle += (Math.random() - 0.5) * 0.3;
    s.targetAngle = s.botWanderAngle;
    s.boosting = false;
  }

  // Respawn a team-mode snake (player or bot) at its base, keeping team/role.
  _respawnAtBase(snake) {
    snake.score = 0; snake.boosting = false; snake.boostAccum = 0; snake.alive = true;
    if (this.mode === 'ctf') this._ctfPlaceAtBase(snake);
    else this._domPlaceAtHome(snake);
  }

  // ============================================================
  // Zone Domination (offline — mirrors server/game.js)
  // ============================================================
  _domInit(config) {
    this.gameClock = 0;
    const numTeams = Math.max(2, Math.min(config.numTeams || 2, 4));
    this.teams = [];
    for (let i = 0; i < numTeams; i++) this.teams.push({ id:i, name:TEAM_NAMES_RB[i], color:TEAM_COLORS_RB[i], memberIds:new Set(), domScore:0, resources:0, ctfScore:0 });
    this.domState = 'active'; this.domRoundEnd = LG_DOM.ROUND_MS; this.domEndTime = 0; this.domWinnerTeam = -1;
    this.domEvent = null; this.domOvertime = false; this.domStormUntil = 0;
    this.domNextEventAt = LG_DOM.EVENT_PERIOD_MS; this.domNextHotspotAt = LG_DOM.HOTSPOT_PERIOD_MS;
    this.domLayoutVersion = 1; this.domEventQueue = [];
    this.zones = []; this._domBuildZones();
  }
  _domBuildZones() {
    const cols = [-0.78,-0.39,0,0.39,0.78], rows = [-0.62,0,0.62];
    const hw = this.mapHalfW, hh = this.mapHalfH, numTeams = this.teams.length;
    const homeSpec = [[0,1,0]]; if (numTeams>=2) homeSpec.push([4,1,1]); if (numTeams>=3) homeSpec.push([2,0,2]); if (numTeams>=4) homeSpec.push([2,2,3]);
    const homeAt = (c,r) => homeSpec.find(h => h[0]===c && h[1]===r);
    const zones = []; let id = 0;
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < cols.length; c++) {
      const x = Math.round(cols[c]*hw), y = Math.round(rows[r]*hh);
      const home = homeAt(c,r), isCenter = (c===2 && r===1);
      let type = ZN_NORMAL, radius = LG_DOM.CAP_R, homeTeam = -1, hasCore = false;
      if (home) { type = ZN_HOME; homeTeam = home[2]; radius = LG_DOM.HOME_R; }
      else if (isCenter) { type = ZN_VIP; radius = LG_DOM.VIP_R; hasCore = true; }
      else if ((c===1&&r===0)||(c===3&&r===2)) { type = ZN_RESOURCE; radius = LG_DOM.RES_R; hasCore = true; }
      zones.push({ id:id++, x, y, type, radius, homeTeam, hasCore, owner:homeTeam, capturingTeam:-1,
        progress:homeTeam>=0?100:0, level:homeTeam>=0?1:0, holdTime:0, coreOffline:false, coreSab:0, hotspotUntil:0, defendGraceUntil:0, adj:[] });
    }
    this.zones = zones; this._domComputeAdjacency();
  }
  _domComputeAdjacency() {
    for (const z of this.zones) z.adj = [];
    for (let i = 0; i < this.zones.length; i++) for (let j = i+1; j < this.zones.length; j++) {
      const a = this.zones[i], b = this.zones[j], dx = a.x-b.x, dy = a.y-b.y;
      if (dx*dx+dy*dy <= LG_DOM.ADJ_DIST*LG_DOM.ADJ_DIST) { a.adj.push(b.id); b.adj.push(a.id); }
    }
  }
  _domConnectionGroups() {
    const parent = new Map(); for (const z of this.zones) parent.set(z.id, z.id);
    const find = (x) => { while (parent.get(x)!==x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const z of this.zones) { if (z.owner<0) continue; for (const nId of z.adj) { const n = this.zones[nId]; if (n && n.owner===z.owner) { const ra = find(z.id), rb = find(nId); if (ra!==rb) parent.set(ra, rb); } } }
    const size = new Map(); for (const z of this.zones) { if (z.owner<0) continue; const r = find(z.id); size.set(r, (size.get(r)||0)+1); }
    const out = new Map(); for (const z of this.zones) { if (z.owner<0) continue; out.set(z.id, size.get(find(z.id))||1); }
    return out;
  }
  _domPlaceAtHome(snake) {
    const home = this.zones.find(z => z.type===ZN_HOME && z.homeTeam===snake.teamId);
    let cx, cy;
    if (home) { const a = Math.random()*Math.PI*2, r = Math.random()*home.radius*0.55; cx = home.x+Math.cos(a)*r; cy = home.y+Math.sin(a)*r; }
    else { const p = this._uniformPos(500); cx = p.x; cy = p.y; }
    const angle = Math.atan2(-cy, -cx);
    snake.angle = snake.targetAngle = angle; snake.segments = [];
    for (let i = 0; i < this.INITIAL_LENGTH; i++) snake.segments.push({ x: cx-Math.cos(angle)*i*this.SEGMENT_SPACING, y: cy-Math.sin(angle)*i*this.SEGMENT_SPACING });
  }
  _domInOwnHome(snake) {
    if (!snake || snake.teamId<0 || snake.segments.length===0) return false;
    const home = this.zones.find(z => z.type===ZN_HOME && z.homeTeam===snake.teamId); if (!home) return false;
    const h = snake.segments[0], dx = h.x-home.x, dy = h.y-home.y; return dx*dx+dy*dy < home.radius*home.radius;
  }
  _domBotJoin(snake) {
    let mt = 0, ms = Infinity; for (const t of this.teams) if (t.memberIds.size<ms) { ms = t.memberIds.size; mt = t.id; }
    snake.teamId = mt; this.teams[mt].memberIds.add(snake.id);
    snake.role = Math.floor(Math.random()*4); snake.evasion = Math.random()<0.5 ? 1 : 0.6;
    this._domPlaceAtHome(snake);
  }
  _domSteerToObjective(s) {
    if (s.teamId<0 || !this.zones || s.segments.length===0) return false;
    const h = s.segments[0]; let best = null, bestScore = -Infinity;
    for (const z of this.zones) {
      if (z.type===ZN_HOME && z.homeTeam!==s.teamId) continue;
      const dx = z.x-h.x, dy = z.y-h.y, d = Math.sqrt(dx*dx+dy*dy)+1;
      const val = z.type===ZN_VIP?3:z.type===ZN_RESOURCE?2:z.type===ZN_HOME?0.4:1;
      let want; if (z.owner<0) want = 1.5*val; else if (z.owner!==s.teamId) want = 1.15*val; else if (z.coreOffline) want = 1.7*val; else want = 0.18*val;
      const jitter = 0.8+0.4*(((s.id*2654435761)>>>8)%1000)/1000;
      const score = want*jitter*3200/d; if (score>bestScore) { bestScore = score; best = z; }
    }
    if (!best) return false;
    const bdx = best.x-h.x, bdy = best.y-h.y, bd = Math.sqrt(bdx*bdx+bdy*bdy);
    if (bd < best.radius*0.85) { const ang = this.gameClock*0.004 + s.id; const px = best.x+Math.cos(ang)*best.radius*0.45, py = best.y+Math.sin(ang)*best.radius*0.45; s.targetAngle = Math.atan2(py-h.y, px-h.x); }
    else s.targetAngle = Math.atan2(bdy, bdx);
    s.boosting = false; return true;
  }
  _domRotateHotspots(now) {
    for (const z of this.zones) z.hotspotUntil = 0;
    const pool = this.zones.filter(z => z.type!==ZN_HOME), until = now+LG_DOM.HOTSPOT_DUR_MS;
    for (let i = 0; i < LG_DOM.HOTSPOT_COUNT && pool.length; i++) { const idx = Math.floor(Math.random()*pool.length); pool.splice(idx,1)[0].hotspotUntil = until; }
  }
  _domStartEvent(type, now) {
    this.domEvent = { type, until: now+LG_DOM.EVENT_DUR_MS };
    if (type==='foodstorm') { this.domStormUntil = now+LG_DOM.EVENT_DUR_MS; for (let i = 0; i < LG_DOM.FOODSTORM_BURST; i++) this.food.push(this._createFood()); }
    else if (type==='relocation') this._domRelocateZones();
    this.domEventQueue.push(type);
  }
  _domRelocateZones() {
    const placed = this.zones.filter(z => z.type===ZN_HOME || z.type===ZN_VIP); const GAP = 320;
    for (const z of this.zones) {
      if (z.type===ZN_HOME || z.type===ZN_VIP) continue;
      let bx = z.x, by = z.y, bestSep = -Infinity;
      for (let a = 0; a < 60; a++) {
        const p = this._uniformPos(z.radius+200); let minSep = Infinity;
        for (const o of placed) { const dx = p.x-o.x, dy = p.y-o.y, sep = Math.sqrt(dx*dx+dy*dy)-o.radius-z.radius; if (sep<minSep) minSep = sep; }
        if (minSep>bestSep) { bestSep = minSep; bx = p.x; by = p.y; } if (minSep>=GAP) break;
      }
      z.x = Math.round(bx); z.y = Math.round(by);
      z.owner = -1; z.progress = 0; z.level = 0; z.holdTime = 0; z.capturingTeam = -1; z.coreOffline = false; z.coreSab = 0; z.hotspotUntil = 0; z.defendGraceUntil = 0;
      placed.push(z);
    }
    this._domComputeAdjacency(); this.domLayoutVersion++;
  }
  _domResetRound(now) {
    for (const t of this.teams) { t.domScore = 0; t.resources = 0; }
    this.domState = 'active'; this.domRoundEnd = now+LG_DOM.ROUND_MS; this.domEndTime = 0; this.domWinnerTeam = -1;
    this.domEvent = null; this.domOvertime = false; this.domStormUntil = 0;
    this.domNextEventAt = now+LG_DOM.EVENT_PERIOD_MS; this.domNextHotspotAt = now+LG_DOM.HOTSPOT_PERIOD_MS;
    this._domBuildZones(); this.domLayoutVersion++;
  }
  _domTick(dt) {
    this.gameClock += dt*1000; const now = this.gameClock;
    if (this.domState==='ended') { if (now-this.domEndTime>LG_DOM.END_HOLD_MS) this._domResetRound(now); return; }
    if (!this.domOvertime && now >= this.domRoundEnd-LG_DOM.OVERTIME_MS) { this.domOvertime = true; this.domEvent = { type:'overtime', until:this.domRoundEnd }; this.domEventQueue.push('overtime'); }
    if (now >= this.domRoundEnd) { let best = -Infinity, bt = -1; for (const t of this.teams) if (t.domScore>best) { best = t.domScore; bt = t.id; } this.domWinnerTeam = bt; this.domState = 'ended'; this.domEndTime = now; this.domEvent = null; return; }
    if (now >= this.domNextHotspotAt) { this._domRotateHotspots(now); this.domNextHotspotAt = now+LG_DOM.HOTSPOT_PERIOD_MS; }
    if (this.domEvent && this.domEvent.type!=='overtime' && now>=this.domEvent.until) this.domEvent = null;
    if (!this.domOvertime && !this.domEvent && now>=this.domNextEventAt) { this._domStartEvent(DOM_EVENTS[Math.floor(Math.random()*DOM_EVENTS.length)], now); this.domNextEventAt = now+LG_DOM.EVENT_PERIOD_MS; }

    const pointMult = this.domOvertime?3:(this.domEvent&&this.domEvent.type==='doublepoints'?2:1);
    const captureMult = this.domOvertime?1.5:1;
    const groupSize = this._domConnectionGroups();

    for (const z of this.zones) {
      const weight = new Map(); const defenders = new Set(); let ownerPresent = false, enemyPresent = false;
      const r2 = z.radius*z.radius;
      for (const s of this.snakes) {
        if (!s.alive || s.teamId<0 || s.segments.length===0) continue;
        const hh = s.segments[0], dx = hh.x-z.x, dy = hh.y-z.y; if (dx*dx+dy*dy>r2) continue;
        weight.set(s.teamId, (weight.get(s.teamId)||0)+(RW[s.role]??1.0));
        if (s.role===1) defenders.add(s.teamId);
        if (z.owner>=0) { if (s.teamId===z.owner) ownerPresent = true; else enemyPresent = true; }
      }
      if (z.hasCore && z.owner>=0) {
        if (enemyPresent && !ownerPresent) { z.coreSab = Math.min(1, z.coreSab+dt/LG_DOM.CORE_DISABLE_SEC); if (z.coreSab>=1) z.coreOffline = true; }
        else if (ownerPresent && !enemyPresent && z.coreSab>0) { z.coreSab = Math.max(0, z.coreSab-dt/LG_DOM.CORE_REPAIR_SEC); if (z.coreSab<=0) z.coreOffline = false; }
      }
      if (z.owner>=0 && ownerPresent && defenders.has(z.owner)) z.defendGraceUntil = now+LG_DOM.DEFENDER_GRACE_MS;
      const locked = z.owner>=0 && (ownerPresent || now < (z.defendGraceUntil||0));
      if (z.type===ZN_HOME) { z.owner = z.homeTeam; z.progress = 100; z.level = Math.max(1, z.level); }
      else if (locked) { z.progress = 100; z.capturingTeam = -1; z.holdTime += dt; const tgt = Math.min(LG_DOM.MAX_LEVEL, 1+Math.floor(z.holdTime/LG_DOM.LEVEL_HOLD_SEC)); if (tgt>z.level) z.level = tgt; }
      else {
        let topTeam = -1, topW = 0, second = 0, present = 0;
        for (const [tid,w] of weight) { present++; if (w>topW) { second = topW; topW = w; topTeam = tid; } else if (w>second) second = w; }
        const contested = present>1 && (topW-second)<0.5;
        if (topTeam<0) {
          if (z.owner<0) { z.progress = Math.max(0, z.progress-LG_DOM.DECAY_RATE*dt); if (z.progress<=0) z.capturingTeam = -1; }
          else { z.holdTime += dt; const tgt = Math.min(LG_DOM.MAX_LEVEL, 1+Math.floor(z.holdTime/LG_DOM.LEVEL_HOLD_SEC)); if (tgt>z.level) z.level = tgt; }
        } else if (contested) { if (z.owner<0) z.progress = Math.max(0, z.progress-LG_DOM.DECAY_RATE*0.5*dt); }
        else if (z.owner<0) { z.capturingTeam = topTeam; z.progress += LG_DOM.CAPTURE_RATE*topW*captureMult*dt; if (z.progress>=100) { z.owner = topTeam; z.progress = 100; z.level = 1; z.holdTime = 0; z.coreOffline = false; z.coreSab = 0; z.defendGraceUntil = 0; } }
        else if (!z.hasCore || z.coreOffline) { z.progress -= LG_DOM.NEUTRALIZE_RATE*topW*captureMult*dt; z.capturingTeam = topTeam; if (z.progress<=0) { z.owner = -1; z.progress = 0; z.level = 0; z.holdTime = 0; z.coreOffline = false; z.coreSab = 0; z.defendGraceUntil = 0; } }
        else { z.capturingTeam = topTeam; }
      }
      if (z.owner>=0 && !z.coreOffline) {
        const team = this.teams[z.owner];
        if (team) {
          const connMult = 1+LG_DOM.CONN_MULT*((groupSize.get(z.id)||1)-1);
          const hot = now<z.hotspotUntil?LG_DOM.HOTSPOT_MULT:1;
          const lvl = z.type===ZN_HOME?1:Math.max(1, z.level);
          const base = z.type===ZN_VIP?LG_DOM.VIP_PTS:z.type===ZN_HOME?LG_DOM.HOME_PTS:z.type===ZN_RESOURCE?LG_DOM.RES_PTS:LG_DOM.BASE_PTS;
          team.domScore += base*lvl*connMult*hot*pointMult*dt;
          if (z.type===ZN_RESOURCE) team.resources += LG_DOM.RES_RATE*lvl*dt;
        }
      }
    }
    for (const t of this.teams) if (t.resources>0) { const conv = Math.min(t.resources, LG_DOM.RES_CONV_RATE*dt); t.resources -= conv; t.domScore += conv*LG_DOM.RES_CONV_VAL*pointMult; }
  }
  getDominationLayout() {
    return { v:this.domLayoutVersion, mapW:this.mapHalfW*2, mapH:this.mapHalfH*2, roundMs:LG_DOM.ROUND_MS,
      teams:this.teams.map(t => ({ id:t.id, name:t.name, color:t.color })),
      zones:this.zones.map(z => ({ id:z.id, x:z.x, y:z.y, r:z.radius, type:z.type, home:z.homeTeam, core:z.hasCore?1:0, adj:z.adj })) };
  }
  getDominationState() {
    const now = this.gameClock, grp = this._domConnectionGroups();
    return { state:this.domState, timeLeft:Math.max(0, this.domRoundEnd-now),
      endLeft:this.domState==='ended'?Math.max(0, this.domEndTime+LG_DOM.END_HOLD_MS-now):0,
      overtime:this.domOvertime, winner:this.domWinnerTeam,
      event:this.domEvent?{ type:this.domEvent.type, left:Math.max(0, this.domEvent.until-now) }:null,
      teams:this.teams.map(t => ({ id:t.id, score:Math.round(t.domScore), res:Math.round(t.resources) })),
      zones:this.zones.map(z => ({ id:z.id, o:z.owner, p:Math.round(z.progress), l:z.level, cap:z.capturingTeam,
        core:z.hasCore?(z.coreOffline?2:(z.coreSab>0.05?1:0)):0, hot:now<z.hotspotUntil?1:0, grp:grp.get(z.id)||(z.owner>=0?1:0) })) };
  }
  drainDomEvents() { const e = this.domEventQueue || []; this.domEventQueue = []; return e; }

  // ============================================================
  // Capture the Orb (offline — mirrors server/game.js)
  // ============================================================
  _ctfInit(config) {
    this.gameClock = 0; this.ctfEvents = [];
    this.teams = [];
    for (let i = 0; i < 2; i++) this.teams.push({ id:i, name:TEAM_NAMES_RB[i], color:TEAM_COLORS_RB[i], memberIds:new Set(), domScore:0, resources:0, ctfScore:0 });
    this.ctfState = 'active'; this.ctfRoundEnd = LG_CTF.ROUND_MS; this.ctfEndTime = 0; this.ctfWinnerTeam = -1;
    const bx = Math.round(LG_CTF.BASE_X_FRAC*this.mapHalfW);
    this.ctfBases = [{ team:0, x:-bx, y:0, radius:LG_CTF.BASE_R }, { team:1, x:bx, y:0, radius:LG_CTF.BASE_R }];
    this.ctfOrbs = this.ctfBases.map(b => ({ team:b.team, state:'base', x:b.x, y:b.y, baseX:b.x, baseY:b.y, holder:null, droppedAt:0 }));
  }
  _ctfBase(team) { return this.ctfBases[team] || this.ctfBases[0]; }
  _ctfEnemyTeam(team) { return team===0 ? 1 : 0; }
  _ctfPlaceAtBase(snake) {
    const base = this._ctfBase(snake.teamId);
    const a = Math.random()*Math.PI*2, r = Math.random()*base.radius*0.55;
    const cx = base.x+Math.cos(a)*r, cy = base.y+Math.sin(a)*r, angle = Math.atan2(-cy, -cx);
    snake.angle = snake.targetAngle = angle; snake.segments = [];
    for (let i = 0; i < this.INITIAL_LENGTH; i++) snake.segments.push({ x: cx-Math.cos(angle)*i*this.SEGMENT_SPACING, y: cy-Math.sin(angle)*i*this.SEGMENT_SPACING });
  }
  _ctfInOwnBase(snake) {
    if (!snake || snake.teamId<0 || snake.segments.length===0) return false;
    const base = this._ctfBase(snake.teamId), h = snake.segments[0], dx = h.x-base.x, dy = h.y-base.y;
    return dx*dx+dy*dy < base.radius*base.radius;
  }
  _ctfBotJoin(snake) {
    let mt = 0, ms = Infinity; for (const t of this.teams) if (t.memberIds.size<ms) { ms = t.memberIds.size; mt = t.id; }
    snake.teamId = mt; this.teams[mt].memberIds.add(snake.id);
    snake.ctfRole = Math.random()<0.5 ? 'attack' : 'defend'; snake.evasion = Math.random()<0.5 ? 1 : 0.6;
    this._ctfPlaceAtBase(snake);
  }
  _ctfHeadTouching(orb) {
    let best = null, bd2 = LG_CTF.PICKUP_R*LG_CTF.PICKUP_R;
    for (const s of this.snakes) { if (!s.alive || s.teamId<0 || s.segments.length===0) continue; const h = s.segments[0], dx = h.x-orb.x, dy = h.y-orb.y, d2 = dx*dx+dy*dy; if (d2<bd2) { bd2 = d2; best = s; } }
    return best;
  }
  _ctfReturnOrb(orb, reason, by) {
    orb.state = 'base'; orb.holder = null; orb.x = orb.baseX; orb.y = orb.baseY; orb.droppedAt = 0;
    if (reason==='recover' || reason==='timeout') this.ctfEvents.push({ type:'return', team:orb.team, by: by?by.name:'' });
  }
  _ctfDropOrbsHeldBy(snake) {
    for (const orb of this.ctfOrbs) if (orb.holder===snake.id) { orb.state = 'dropped'; orb.holder = null; orb.droppedAt = this.gameClock; if (snake.segments.length) { orb.x = snake.segments[0].x; orb.y = snake.segments[0].y; } this.ctfEvents.push({ type:'drop', team:orb.team, by:snake.name }); }
  }
  _ctfScore(carrier) {
    const team = this.teams[carrier.teamId]; if (team) team.ctfScore = (team.ctfScore||0)+1;
    this.ctfEvents.push({ type:'capture', team:carrier.teamId, by:carrier.name });
    for (const orb of this.ctfOrbs) this._ctfReturnOrb(orb, 'reset');
    if (team && (team.ctfScore||0) >= LG_CTF.CAPTURES_TO_WIN) this._ctfEndRound(carrier.teamId);
  }
  _ctfEndRound(winnerTeam) {
    if (winnerTeam===undefined) { let bt = -1, best = -Infinity; for (const t of this.teams) if ((t.ctfScore||0)>best) { best = t.ctfScore||0; bt = t.id; } let mc = 0; for (const t of this.teams) if ((t.ctfScore||0)===best) mc++; winnerTeam = mc>1?-1:bt; }
    this.ctfWinnerTeam = winnerTeam; this.ctfState = 'ended'; this.ctfEndTime = this.gameClock;
  }
  _ctfResetRound() {
    for (const t of this.teams) t.ctfScore = 0;
    this.ctfState = 'active'; this.ctfRoundEnd = this.gameClock+LG_CTF.ROUND_MS; this.ctfEndTime = 0; this.ctfWinnerTeam = -1;
    for (const orb of this.ctfOrbs) this._ctfReturnOrb(orb, 'reset');
  }
  _ctfTick(dt) {
    this.gameClock += dt*1000; const now = this.gameClock;
    if (this.ctfState==='ended') { if (now-this.ctfEndTime>LG_CTF.END_HOLD_MS) this._ctfResetRound(); return; }
    if (now >= this.ctfRoundEnd) { this._ctfEndRound(); return; }
    for (const orb of this.ctfOrbs) {
      if (orb.state==='carried') {
        const carrier = this.snakes.find(s => s.id===orb.holder);
        if (!carrier || !carrier.alive || carrier.teamId===orb.team || carrier.segments.length===0) { orb.state = 'dropped'; orb.holder = null; orb.droppedAt = now; continue; }
        const hh = carrier.segments[0]; orb.x = hh.x; orb.y = hh.y;
        const myBase = this._ctfBase(carrier.teamId), ownOrb = this.ctfOrbs[carrier.teamId], dx = hh.x-myBase.x, dy = hh.y-myBase.y;
        if (dx*dx+dy*dy <= LG_CTF.SCORE_R*LG_CTF.SCORE_R && ownOrb.state==='base') { this._ctfScore(carrier); return; }
      } else if (orb.state==='dropped') {
        if (now-orb.droppedAt > LG_CTF.RETURN_SEC*1000) { this._ctfReturnOrb(orb, 'timeout'); continue; }
        const p = this._ctfHeadTouching(orb);
        if (p) { if (p.teamId===orb.team) this._ctfReturnOrb(orb, 'recover', p); else { orb.state = 'carried'; orb.holder = p.id; this.ctfEvents.push({ type:'steal', team:orb.team, by:p.name }); } }
      } else {
        const p = this._ctfHeadTouching(orb);
        if (p && p.teamId!==orb.team) { orb.state = 'carried'; orb.holder = p.id; this.ctfEvents.push({ type:'steal', team:orb.team, by:p.name }); }
      }
    }
  }
  _ctfBotObjective(s) {
    if (s.teamId<0 || s.segments.length===0) return false;
    const h = s.segments[0], myOrb = this.ctfOrbs[s.teamId], enemyOrb = this.ctfOrbs[this._ctfEnemyTeam(s.teamId)], myBase = this._ctfBase(s.teamId);
    let tx, ty;
    if (enemyOrb.holder===s.id) { tx = myBase.x; ty = myBase.y; }
    else if (myOrb.state!=='base') { tx = myOrb.x; ty = myOrb.y; }
    else if (s.ctfRole==='defend') { tx = myOrb.x; ty = myOrb.y; }
    else { tx = enemyOrb.x; ty = enemyOrb.y; }
    s.targetAngle = Math.atan2(ty-h.y, tx-h.x); s.boosting = false; return true;
  }
  getCtfLayout() {
    return { mapW:this.mapHalfW*2, mapH:this.mapHalfH*2, roundMs:LG_CTF.ROUND_MS, capturesToWin:LG_CTF.CAPTURES_TO_WIN,
      teams:this.teams.map(t => ({ id:t.id, name:t.name, color:t.color })),
      bases:this.ctfBases.map(b => ({ team:b.team, x:b.x, y:b.y, r:b.radius })) };
  }
  getCtfState() {
    const now = this.gameClock;
    return { state:this.ctfState, timeLeft:Math.max(0, this.ctfRoundEnd-now),
      endLeft:this.ctfState==='ended'?Math.max(0, this.ctfEndTime+LG_CTF.END_HOLD_MS-now):0,
      winner:this.ctfWinnerTeam, capturesToWin:LG_CTF.CAPTURES_TO_WIN,
      teams:this.teams.map(t => ({ id:t.id, score:t.ctfScore||0 })),
      orbs:this.ctfOrbs.map(o => ({ team:o.team, state:o.state, x:Math.round(o.x), y:Math.round(o.y), holder:o.holder||0,
        returnIn:o.state==='dropped'?Math.max(0, LG_CTF.RETURN_SEC*1000-(now-o.droppedAt)):0 })) };
  }
  drainCtfEvents() { const e = this.ctfEvents || []; this.ctfEvents = []; return e; }
}

if (typeof module !== 'undefined' && module.exports) module.exports = LocalGame;
