// ============================================================
// LocalGame — offline single-player game engine with AI bots
// Used for "PLAY VS AI" mode. No server connection needed.
// ============================================================

class LocalGame {
  constructor(playerName, skinIdx, mode = 'classic') {
    this.MAP_SIZE = 14000;
    this.FOOD_COUNT = 2600;
    this.SNAKE_SPEED = 280;
    this.BOOST_SPEED = 500;
    this.SEGMENT_SPACING = 24;
    this.DOT_RADIUS = 9;
    this.INITIAL_LENGTH = 10;
    this.HEAD_RADIUS = 14;
    this.BOOST_SHRINK_RATE = 2.5;
    this.BOT_COUNT = 25;
    this.MEGA_ORB_COUNT = 12;
    this.mode = mode;
    // Battle Royale phased safe zone (Fortnite-style).
    // Each phase: HOLD at current radius for `hold` seconds, then SHRINK to
    // `radius` over `shrinkTime` seconds, then HOLD the next phase, etc.
    // Tunable: change the array and the match feel changes.
    this.ROYALE_PHASES = [
      { hold: 60, shrinkTime: 30, radius: 1800 },
      { hold: 45, shrinkTime: 25, radius: 1000 },
      { hold: 35, shrinkTime: 20, radius:  500 },
      { hold: 25, shrinkTime: 15, radius:  220 },
      { hold: 20, shrinkTime: 12, radius:   80 },
    ];
    this.safeRadius     = mode === 'royale' ? 2800 : this.MAP_SIZE / 2 - 250;
    this.safePrevRadius = this.safeRadius;
    this.safeTargetRadius = this.safeRadius;
    this.shrinkPulse = 0;
    this.royalePhaseIdx   = 0;
    this.royalePhaseState = 'hold';   // 'hold' | 'shrink' | 'done'
    this.royalePhaseTimer = 0;
    this.royaleEvents     = [];
    // Fixed center at origin — drifting made the boundary appear to "swim"
    // across the world as the camera followed the player.
    this.safeCenterX = 0;
    this.safeCenterY = 0;

    this.snakes = [];
    this.food = [];
    this.megaOrbs = [];
    this.nextId = 1;
    this.playerId = null;
    this.deathCallback = null;

    // Spawn player
    const player = this._createSnake(playerName, false, skinIdx);
    this.playerId = player.id;

    // Spawn bots
    const BOT_NAMES = [
      'Viper','Shadow','Blaze','Neon','Ghost','Toxic','Pixel','Glitch',
      'Storm','Bolt','Ember','Frost','Nova','Pulse','Drift','Surge',
      'Zenith','Razor','Flux','Echo','Orbit','Prism','Hex','Chrome',
    ];
    for (let i = 0; i < this.BOT_COUNT; i++) {
      this._createSnake(BOT_NAMES[i % BOT_NAMES.length], true,
        Math.floor(Math.random() * 43), this._randomSkill());
    }

    // Spawn food + mega orbs
    for (let i = 0; i < this.FOOD_COUNT; i++) this.food.push(this._createFood());
    for (let i = 0; i < this.MEGA_ORB_COUNT; i++) this.megaOrbs.push(this._createMegaOrb());
  }

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
    const r = Math.random();
    if (r < 0.20) return 2;  // 20% hard
    if (r < 0.60) return 1;  // 40% medium
    return 0;                 // 40% easy
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
    const pos = this._zoned(1.5);
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
    // Mega orbs
    const half = this.MAP_SIZE/2-50;
    for (const m of this.megaOrbs) {
      m.x+=m.vx*dt; m.y+=m.vy*dt; m.spin+=dt*1.5;
      if (m.x<-half){m.x=-half;m.vx=Math.abs(m.vx);} if (m.x>half){m.x=half;m.vx=-Math.abs(m.vx);}
      if (m.y<-half){m.y=-half;m.vy=Math.abs(m.vy);} if (m.y>half){m.y=half;m.vy=-Math.abs(m.vy);}
    }

    // Bot AI
    for (const s of this.snakes) { if (s.isBot && s.alive) this._botAI(s, dt); }

    // Update all
    for (const s of this.snakes) { if (s.alive) this._updateSnake(s, dt); }

    // Collisions
    this._checkCollisions();

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

    // Respawn dead bots
    for (const s of this.snakes) { if (s.isBot && !s.alive) this._respawnBot(s); }

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
      events,
      winner: winner && !winner.isBot ? winner.name : null,
      isDead: !this.snakes.find(s => !s.isBot && s.alive),
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
    const h = this.MAP_SIZE/2;
    if (head.x<-h||head.x>h||head.y<-h||head.y>h) { this._kill(snake, null); return; }
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
    for (let i=this.food.length-1;i>=0;i--) {
      const f=this.food[i];
      const dx=f.x-head.x; if(dx>eatR||dx<-eatR) continue;
      const dy=f.y-head.y; if(dy>eatR||dy<-eatR) continue;
      const sr=headR+f.radius;
      if(dx*dx+dy*dy<sr*sr){this.food.splice(i,1);snake.score+=f.value||1;}
    }
    for (let i=this.megaOrbs.length-1;i>=0;i--) {
      const m=this.megaOrbs[i]; const dx=head.x-m.x,dy=head.y-m.y;
      if(dx*dx+dy*dy<(headR+m.radius)**2){this.megaOrbs.splice(i,1);snake.score+=m.value;}
    }
  }

  _checkCollisions() {
    for (let i=0;i<this.snakes.length;i++) {
      const a=this.snakes[i]; if(!a.alive) continue;
      const ah=a.segments[0], aR=this.HEAD_RADIUS*this._thickness(a)*0.75;
      for (let j=0;j<this.snakes.length;j++) {
        if(i===j) continue;
        const b=this.snakes[j]; if(!b.alive) continue;
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
    if (snake.id === this.playerId && this.deathCallback) {
      this.deathCallback(snake.score);
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
    if (snake.skill === 2) this._hardAI(snake, dt);
    else if (snake.skill === 1) this._mediumAI(snake, dt);
    else this._easyAI(snake, dt);
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
    const wall = this.MAP_SIZE / 2 - 250;
    if (Math.abs(h.x) > wall || Math.abs(h.y) > wall) {
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
    const wall = this.MAP_SIZE / 2 - 250;
    if (Math.abs(h.x) > wall || Math.abs(h.y) > wall) {
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
    const wall = this.MAP_SIZE / 2 - 250;
    if (Math.abs(h.x) > wall || Math.abs(h.y) > wall) {
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
}
