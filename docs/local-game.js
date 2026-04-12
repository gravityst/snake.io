// ============================================================
// LocalGame — offline single-player game engine with AI bots
// Used for "PLAY VS AI" mode. No server connection needed.
// ============================================================

class LocalGame {
  constructor(playerName, skinIdx) {
    this.MAP_SIZE = 14000;
    this.FOOD_COUNT = 1800;
    this.SNAKE_SPEED = 200;
    this.BOOST_SPEED = 380;
    this.SEGMENT_SPACING = 24;
    this.DOT_RADIUS = 9;
    this.INITIAL_LENGTH = 10;
    this.HEAD_RADIUS = 14;
    this.BOOST_SHRINK_RATE = 2.5;
    this.BOT_COUNT = 25;
    this.MEGA_ORB_COUNT = 12;

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

  _thickness(snake) { return 1 + Math.min(snake.score / 80, 2.5); }

  _randomSkill() {
    const r = Math.random();
    if (r < 0.05) return 2;
    if (r < 0.30) return 1;
    return 0;
  }

  _createSnake(name, isBot, skinIdx, skill) {
    const id = this.nextId++;
    const angle = Math.random() * Math.PI * 2;
    const pos = isBot ? this._zoned(1.2) : this._zoned(2.5);
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

    // Respawn dead bots
    for (const s of this.snakes) { if (s.isBot && !s.alive) this._respawnBot(s); }

    // Replenish
    while (this.food.length < this.FOOD_COUNT) this.food.push(this._createFood());
    while (this.megaOrbs.length < this.MEGA_ORB_COUNT) this.megaOrbs.push(this._createMegaOrb());
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
    while (snake.segments.length >= 2) {
      const dx=head.x-snake.segments[1].x, dy=head.y-snake.segments[1].y;
      if (dx*dx+dy*dy < this.SEGMENT_SPACING**2) break;
      const dist=Math.sqrt(dx*dx+dy*dy), t=this.SEGMENT_SPACING/dist;
      snake.segments.splice(1,0,{x:snake.segments[1].x+dx*t, y:snake.segments[1].y+dy*t});
    }
    const tl = this.INITIAL_LENGTH + Math.floor(8*Math.log(1+snake.score/10));
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
      const ah=a.segments[0], aR=this.HEAD_RADIUS*this._thickness(a);
      for (let j=0;j<this.snakes.length;j++) {
        if(i===j) continue;
        const b=this.snakes[j]; if(!b.alive) continue;
        const bR=this.DOT_RADIUS*this._thickness(b);
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
    const dv = Math.max(3, Math.floor(snake.score / Math.max(1, snake.segments.length / 2)));
    for (let i=0;i<snake.segments.length;i+=2) {
      const s=snake.segments[i];
      const r = 10 + Math.min(snake.score/30, 12) + Math.random()*4;
      const v = dv + Math.floor(Math.random()*3);
      const t = r>16 ? 5 : r>12 ? 3 : 2;
      this.food.push({x:s.x+(Math.random()-0.5)*30,y:s.y+(Math.random()-0.5)*30,
        color:snake.color,radius:r,value:v,tier:t});
    }
    if (snake.id === this.playerId && this.deathCallback) {
      this.deathCallback(snake.score);
    }
  }

  _respawnBot(snake) {
    const angle = Math.random()*Math.PI*2;
    const pos = this._zoned(1.2);
    snake.segments = [];
    for (let i=0;i<this.INITIAL_LENGTH;i++) {
      snake.segments.push({x:pos.x-Math.cos(angle)*i*this.SEGMENT_SPACING,y:pos.y-Math.sin(angle)*i*this.SEGMENT_SPACING});
    }
    snake.angle=angle; snake.targetAngle=angle; snake.score=0; snake.alive=true;
    snake.boosting=false; snake.boostAccum=0;
    snake.skin=Math.floor(Math.random()*43); snake.skill=this._randomSkill();
  }

  // --- Bot AI ---
  _botAI(snake, dt) {
    if (snake.skill===2) this._advAI(snake,dt);
    else if (snake.skill===1) this._amtAI(snake,dt);
    else this._begAI(snake,dt);
  }

  _begAI(s,dt) {
    s.botTimer-=dt; if(s.botTimer>0) return; s.botTimer=0.7+Math.random()*0.8;
    const h=s.segments[0], wall=this.MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=false;return;}
    if(Math.random()<0.25){s.botWanderAngle+=(Math.random()-0.5)*2.5;s.targetAngle=s.botWanderAngle;s.boosting=false;return;}
    let cl=null,cSq=250*250;
    for(const f of this.food){const dx=f.x-h.x;if(dx>250||dx<-250)continue;const dy=f.y-h.y;if(dy>250||dy<-250)continue;const d2=dx*dx+dy*dy;if(d2<cSq){cSq=d2;cl=f;}}
    if(cl)s.targetAngle=Math.atan2(cl.y-h.y,cl.x-h.x);
    else{s.botWanderAngle+=(Math.random()-0.5)*2;s.targetAngle=s.botWanderAngle;}
    s.boosting=false;
  }

  _amtAI(s,dt) {
    s.botTimer-=dt; if(s.botTimer>0) return; s.botTimer=0.3+Math.random()*0.4;
    const h=s.segments[0], wall=this.MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=true;return;}
    let cl=null,cSq=450*450;
    for(const f of this.food){const dx=f.x-h.x;if(dx>450||dx<-450)continue;const dy=f.y-h.y;if(dy>450||dy<-450)continue;const d2=dx*dx+dy*dy;if(d2<cSq){cSq=d2;cl=f;}}
    for(const o of this.snakes){
      if(o.id===s.id||!o.alive)continue;
      const dx=o.segments[0].x-h.x,dy=o.segments[0].y-h.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<180){s.targetAngle=Math.atan2(-dy,-dx)+(Math.random()-0.5)*0.5;s.boosting=d<90;return;}
    }
    if(cl){s.targetAngle=Math.atan2(cl.y-h.y,cl.x-h.x);s.boosting=false;}
    else{s.botWanderAngle+=(Math.random()-0.5)*1.2;s.targetAngle=s.botWanderAngle;s.boosting=false;}
  }

  _advAI(s,dt) {
    s.botTimer-=dt; if(s.botTimer>0) return; s.botTimer=0.1;
    const h=s.segments[0], wall=this.MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=false;return;}
    for(const o of this.snakes){
      if(o.id===s.id||!o.alive)continue;
      const dx=o.segments[0].x-h.x,dy=o.segments[0].y-h.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<220&&o.score>=s.score*0.85){s.targetAngle=Math.atan2(-dy,-dx)+(Math.random()<0.5?-0.3:0.3);s.boosting=d<130&&s.score>30;return;}
    }
    let bm=null,bmd=1500;
    for(const m of this.megaOrbs){const d=Math.sqrt((m.x-h.x)**2+(m.y-h.y)**2);if(d<bmd){bmd=d;bm=m;}}
    if(bm){const t=bmd/this.SNAKE_SPEED;s.targetAngle=Math.atan2(bm.y+bm.vy*t-h.y,bm.x+bm.vx*t-h.x);s.boosting=bmd>500&&s.score>20;return;}
    let bp=null,bpd=700;
    for(const o of this.snakes){if(o.id===s.id||!o.alive||o.score>=s.score*0.7)continue;const d=Math.sqrt((o.segments[0].x-h.x)**2+(o.segments[0].y-h.y)**2);if(d<bpd){bpd=d;bp=o;}}
    if(bp){const la=0.8+bpd/400;s.targetAngle=Math.atan2(bp.segments[0].y+Math.sin(bp.angle)*this.SNAKE_SPEED*la-h.y,bp.segments[0].x+Math.cos(bp.angle)*this.SNAKE_SPEED*la-h.x);s.boosting=bpd>250&&s.score>40;return;}
    let bf=null,br=0;
    for(const f of this.food){const dx=f.x-h.x;if(dx>800||dx<-800)continue;const dy=f.y-h.y;if(dy>800||dy<-800)continue;const ratio=(f.value||1)/(Math.sqrt(dx*dx+dy*dy)+50);if(ratio>br){br=ratio;bf=f;}}
    if(bf){s.targetAngle=Math.atan2(bf.y-h.y,bf.x-h.x);s.boosting=false;return;}
    s.botWanderAngle+=(Math.random()-0.5)*0.5;s.targetAngle=s.botWanderAngle;s.boosting=false;
  }
}
