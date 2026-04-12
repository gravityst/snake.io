const WebSocket = require('ws');

// =====================================================
// Room-based multiplayer server with Solo + Team modes
// =====================================================

const MAP_SIZE = 9000;
const FOOD_COUNT = 1000;
const SNAKE_SPEED = 200;
const BOOST_SPEED = 380;
const SEGMENT_SPACING = 24;
const DOT_RADIUS = 9;
const INITIAL_LENGTH = 10;
const HEAD_RADIUS = 14;
const BOOST_SHRINK_RATE = 2.5;
const MAX_BOTS = 15;
const MEGA_ORB_COUNT = 12;
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const BROADCAST_RATE = 30;
const BROADCAST_MS = 1000 / BROADCAST_RATE;
const MAX_ADVANCED_BOTS = 2;
const MAX_PLAYERS_PER_ROOM = 30;

const SKILL_BEGINNER = 0;
const SKILL_AMATEUR = 1;
const SKILL_ADVANCED = 2;
const SKINS_COUNT = 43;
const BOT_NAMES = [
  'Viper','Shadow','Blaze','Neon','Ghost','Toxic','Pixel','Glitch',
  'Storm','Bolt','Ember','Frost','Nova','Pulse','Drift','Surge',
  'Zenith','Razor','Flux','Echo','Orbit','Prism','Hex','Chrome',
];

const TEAM_COLORS = ['#0ff','#f44','#0f0','#ff0','#f0f','#f80','#08f','#8f0'];
const TEAM_NAMES_DEFAULT = ['Cyan','Red','Green','Gold','Pink','Orange','Blue','Lime'];

// =====================================================
// Room
// =====================================================
class Room {
  constructor(id, name, opts = {}) {
    this.id = id;
    this.name = name;
    this.mode = opts.mode || 'solo';       // 'solo' | 'team'
    this.teamSize = opts.teamSize || 2;    // players per team (team mode)
    this.maxTeams = opts.maxTeams || Math.floor(MAX_PLAYERS_PER_ROOM / (this.teamSize || 2));
    this.isCustom = opts.isCustom || false;
    this.creatorName = opts.creatorName || '';

    // Team state (team mode only)
    // teams: Map<teamId, { name, color, memberIds: Set<snakeId> }>
    this.teams = new Map();
    if (this.mode === 'team') {
      const numTeams = Math.min(this.maxTeams, 8);
      for (let i = 0; i < numTeams; i++) {
        this.teams.set(i, {
          name: TEAM_NAMES_DEFAULT[i] || `Team ${i+1}`,
          color: TEAM_COLORS[i] || '#fff',
          memberIds: new Set(),
        });
      }
    }

    this.snakes = new Map();
    this.food = [];
    this.megaOrbs = [];
    this.bots = [];
    this.nextSnakeId = 1;
    this.clients = new Map(); // ws → snakeId

    this.spawnFood();
    this.spawnMegaOrbs();
    this.spawnBots(MAX_BOTS);

    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
    this.broadcastInterval = setInterval(() => {
      this.broadcastState();
      this.broadcastLeaderboard();
    }, BROADCAST_MS);
  }

  destroy() {
    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);
    for (const [ws] of this.clients) ws.close();
  }

  get realPlayerCount() { return this.clients.size; }
  get targetBotCount() { return Math.max(0, MAX_BOTS - this.realPlayerCount); }

  // --- Helpers ---
  _zoned(power = 1.5) {
    const r = Math.pow(Math.random(), power) * (MAP_SIZE/2 - 100);
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a)*r, y: Math.sin(a)*r };
  }
  _thickness(s) { return 1 + Math.min(s.score/500, 0.8); }
  _randomSkill() {
    const adv = this.bots.filter(id => { const s=this.snakes.get(id); return s&&s.alive&&s.skill===SKILL_ADVANCED; }).length;
    const r = Math.random();
    if (r<0.05&&adv<MAX_ADVANCED_BOTS) return SKILL_ADVANCED;
    if (r<0.30) return SKILL_AMATEUR;
    return SKILL_BEGINNER;
  }

  // --- Food / Orbs ---
  spawnFood() { while (this.food.length<FOOD_COUNT) this.food.push(this._createFood()); }
  _createFood() {
    const r=Math.random(); let radius,value,tier;
    if(r<0.35){radius=3+Math.random()*2;value=1;tier=0;}
    else if(r<0.58){radius=5+Math.random()*2;value=2;tier=1;}
    else if(r<0.75){radius=7+Math.random()*2;value=3;tier=2;}
    else if(r<0.87){radius=9+Math.random()*2;value=5;tier=3;}
    else if(r<0.94){radius=11+Math.random()*2;value=8;tier=4;}
    else if(r<0.975){radius=13+Math.random()*2;value=12;tier=5;}
    else if(r<0.99){radius=15+Math.random()*2;value=18;tier=6;}
    else if(r<0.997){radius=18+Math.random()*2;value=26;tier=7;}
    else{radius=21+Math.random()*3;value=35;tier=8;}
    const pos=this._zoned(1.5);
    return {x:pos.x,y:pos.y,color:Math.floor(Math.random()*8),radius,value,tier};
  }
  spawnMegaOrbs() { while(this.megaOrbs.length<MEGA_ORB_COUNT) this.megaOrbs.push(this._createMegaOrb()); }
  _createMegaOrb() {
    const a=Math.random()*Math.PI*2,speed=25+Math.random()*25,pos=this._zoned(1.3);
    return {x:pos.x,y:pos.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
      radius:22+Math.random()*8,value:50+Math.floor(Math.random()*31),
      color:Math.floor(Math.random()*8),spin:Math.random()*Math.PI*2};
  }

  // --- Bots ---
  spawnBots(count) {
    for (let i=0;i<count;i++) {
      const snake=this._createSnake(BOT_NAMES[i%BOT_NAMES.length],true,
        Math.floor(Math.random()*SKINS_COUNT),this._randomSkill());
      // Assign bot to a random team in team mode
      if (this.mode==='team') {
        const teamId = i % this.teams.size;
        snake.teamId = teamId;
        this.teams.get(teamId).memberIds.add(snake.id);
      }
      this.bots.push(snake.id);
    }
  }

  _createSnake(name,isBot,skinIdx,skill) {
    const id=this.nextSnakeId++;
    const angle=Math.random()*Math.PI*2;
    const pos=isBot?this._zoned(1.2):this._zoned(2.5);
    const segments=[];
    for(let i=0;i<INITIAL_LENGTH;i++) segments.push({x:pos.x-Math.cos(angle)*i*SEGMENT_SPACING,y:pos.y-Math.sin(angle)*i*SEGMENT_SPACING});
    const snake={
      id,name,segments,angle,targetAngle:angle,
      boosting:false,score:0,skin:skinIdx,
      color:Math.floor(Math.random()*8),alive:true,isBot,
      skill:skill??SKILL_BEGINNER,
      boostAccum:0,botTimer:0,botWanderAngle:angle,
      teamId:-1, // -1 = no team (solo mode)
    };
    this.snakes.set(id,snake);
    return snake;
  }

  // --- Player join/leave ---
  // Protocol: join message is [0x03][skinIdx][teamId (if team mode)][name...]
  playerJoin(ws, name, skinIdx, teamId) {
    if (this.clients.has(ws)) return;
    if (this.realPlayerCount >= MAX_PLAYERS_PER_ROOM) return;

    const snake = this._createSnake(name, false, skinIdx, SKILL_BEGINNER);

    // Team assignment
    if (this.mode === 'team' && this.teams.has(teamId)) {
      const team = this.teams.get(teamId);
      if (team.memberIds.size < this.teamSize + 10) { // allow some overflow for bots
        snake.teamId = teamId;
        team.memberIds.add(snake.id);
      }
    }

    this.clients.set(ws, snake.id);

    // Welcome: [0x02][yourId u16]
    const welcome = Buffer.alloc(3);
    welcome[0]=0x02; welcome.writeUInt16LE(snake.id,1);
    ws.send(welcome);

    // Send team info: [0x06][teamCount u8][per team: id u8, colorLen u8, color, nameLen u8, name]
    if (this.mode === 'team') {
      this._sendTeamInfo(ws);
    }

    this.adjustBots();
    console.log(`[${this.name}] "${name}" joined team=${teamId} (${this.realPlayerCount} players)`);
  }

  _sendTeamInfo(ws) {
    let size = 2;
    for (const [,t] of this.teams) size += 1 + 1 + t.color.length + 1 + Buffer.byteLength(t.name,'utf8');
    const buf = Buffer.alloc(size);
    let off = 0;
    buf[off++] = 0x06;
    buf[off++] = this.teams.size;
    for (const [id,t] of this.teams) {
      buf[off++] = id;
      const colBytes = Buffer.from(t.color,'utf8');
      buf[off++] = colBytes.length; colBytes.copy(buf,off); off += colBytes.length;
      const nameBytes = Buffer.from(t.name,'utf8');
      buf[off++] = nameBytes.length; nameBytes.copy(buf,off); off += nameBytes.length;
    }
    ws.send(buf.slice(0,off));
  }

  playerLeave(ws) {
    const playerId = this.clients.get(ws);
    if (playerId===undefined) return;
    const snake = this.snakes.get(playerId);
    if (snake && snake.teamId >= 0) {
      const team = this.teams.get(snake.teamId);
      if (team) team.memberIds.delete(playerId);
    }
    this.killSnake(playerId, null, true);
    this.clients.delete(ws);
    this.adjustBots();
  }

  adjustBots() {
    const target = this.targetBotCount;
    while (this.bots.length > target) {
      const botId = this.bots.pop();
      const bot = this.snakes.get(botId);
      if (bot) {
        if (bot.teamId >= 0) { const t=this.teams.get(bot.teamId); if(t) t.memberIds.delete(botId); }
        bot.alive = false;
        this.snakes.delete(botId);
      }
    }
    while (this.bots.length < target) {
      const snake = this._createSnake(BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],
        true,Math.floor(Math.random()*SKINS_COUNT),this._randomSkill());
      if (this.mode==='team') {
        // Put bot on smallest team
        let minTeam=0, minSize=Infinity;
        for (const [id,t] of this.teams) { if(t.memberIds.size<minSize){minSize=t.memberIds.size;minTeam=id;} }
        snake.teamId = minTeam;
        this.teams.get(minTeam).memberIds.add(snake.id);
      }
      this.bots.push(snake.id);
    }
  }

  handleMessage(ws, data) {
    const buf = Buffer.isBuffer(data)?data:Buffer.from(data);
    if(buf.length<1) return;
    const type=buf[0];
    if (type===0x03) {
      const skinIdx = buf.length>1 ? buf[1] : 0;
      let teamId = -1;
      let nameStart = 2;
      if (this.mode==='team' && buf.length>2) {
        teamId = buf[2];
        nameStart = 3;
      }
      const name = buf.slice(nameStart).toString('utf8').substring(0,16) || 'Player';
      this.playerJoin(ws, name, skinIdx, teamId);
      return;
    }
    const playerId=this.clients.get(ws);
    if(playerId===undefined) return;
    const snake=this.snakes.get(playerId);
    if(!snake||!snake.alive) return;
    if(type===0x01&&buf.length>=5) snake.targetAngle=buf.readFloatLE(1);
    else if(type===0x02&&buf.length>=2) snake.boosting=buf[1]===1;
  }

  // --- Kill ---
  killSnake(id, killerId, noRespawn=false) {
    const snake=this.snakes.get(id);
    if(!snake||!snake.alive) return;
    snake.alive=false;
    // Drop food — bigger drops scaled by victim's score for rewarding kills
    const dropValue = Math.max(3, Math.floor(snake.score / Math.max(1, snake.segments.length / 2)));
    for(let i=0;i<snake.segments.length;i+=2){
      const s=snake.segments[i];
      const r = 10 + Math.min(snake.score / 30, 12) + Math.random() * 4;
      const v = dropValue + Math.floor(Math.random() * 3);
      const t = r > 16 ? 5 : r > 12 ? 3 : 2;
      this.food.push({x:s.x+(Math.random()-0.5)*30,y:s.y+(Math.random()-0.5)*30,
        color:snake.color,radius:r,value:v,tier:t});
    }
    if(killerId!==null){
      const buf=Buffer.alloc(5);buf[0]=0x04;buf.writeUInt16LE(killerId,1);buf.writeUInt16LE(id,3);
      this.broadcast(buf);
    }
    // Notify dead player
    for(const [ws,pid] of this.clients){
      if(pid===id){
        const d=Buffer.alloc(3);d[0]=0x03;d.writeUInt16LE(id,1);
        if(ws.readyState===WebSocket.OPEN) ws.send(d);
        this.clients.delete(ws);
        break;
      }
    }
    // Remove from team
    if(snake.teamId>=0){ const t=this.teams.get(snake.teamId); if(t) t.memberIds.delete(id); }
    if(snake.isBot&&!noRespawn) setTimeout(()=>this.respawnBot(id),2000);
    this.snakes.delete(id);
  }

  respawnBot(oldId) {
    const idx=this.bots.indexOf(oldId);
    if(idx<0) return;
    if(this.bots.length>this.targetBotCount){this.bots.splice(idx,1);return;}
    const snake=this._createSnake(BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],
      true,Math.floor(Math.random()*SKINS_COUNT),this._randomSkill());
    if(this.mode==='team'){
      let minTeam=0,minSize=Infinity;
      for(const [id,t] of this.teams){if(t.memberIds.size<minSize){minSize=t.memberIds.size;minTeam=id;}}
      snake.teamId=minTeam; this.teams.get(minTeam).memberIds.add(snake.id);
    }
    this.bots[idx]=snake.id;
  }

  // --- Main tick ---
  tick() {
    const now=Date.now();
    const dt=Math.min((now-this.lastTick)/1000,0.05);
    this.lastTick=now;
    this.updateMegaOrbs(dt);
    for(const [,s] of this.snakes){if(s.isBot&&s.alive) this._botAI(s,dt);}
    for(const [,s] of this.snakes){if(s.alive) this._updateSnake(s,dt);}
    this._checkCollisions();
    this.spawnFood(); this.spawnMegaOrbs();
  }

  _updateSnake(snake,dt) {
    let ad=snake.targetAngle-snake.angle;
    while(ad>Math.PI)ad-=Math.PI*2;while(ad<-Math.PI)ad+=Math.PI*2;
    if(Math.abs(ad)<9*dt)snake.angle=snake.targetAngle;else snake.angle+=Math.sign(ad)*9*dt;
    if(snake.boosting&&snake.score<=0)snake.boosting=false;
    const speed=snake.boosting?BOOST_SPEED:SNAKE_SPEED;
    const head=snake.segments[0];
    head.x+=Math.cos(snake.angle)*speed*dt;head.y+=Math.sin(snake.angle)*speed*dt;
    const half=MAP_SIZE/2;
    if(head.x<-half||head.x>half||head.y<-half||head.y>half){this.killSnake(snake.id,null);return;}
    while(snake.segments.length>=2){
      const dx=head.x-snake.segments[1].x,dy=head.y-snake.segments[1].y;
      if(dx*dx+dy*dy<SEGMENT_SPACING**2)break;
      const dist=Math.sqrt(dx*dx+dy*dy),t=SEGMENT_SPACING/dist;
      snake.segments.splice(1,0,{x:snake.segments[1].x+dx*t,y:snake.segments[1].y+dy*t});
    }
    const tl=INITIAL_LENGTH+Math.floor(snake.score/12);
    while(snake.segments.length>tl)snake.segments.pop();
    if(snake.boosting&&snake.score>0){
      snake.boostAccum+=BOOST_SHRINK_RATE*dt;
      if(snake.boostAccum>=1){const rm=Math.floor(snake.boostAccum);snake.boostAccum-=rm;snake.score=Math.max(0,snake.score-rm);
        if(snake.segments.length>0){const tail=snake.segments[snake.segments.length-1];
          this.food.push({x:tail.x+(Math.random()-0.5)*14,y:tail.y+(Math.random()-0.5)*14,color:snake.color,radius:5+Math.random()*2,value:1,tier:0});}
      }
    }
    const headR=HEAD_RADIUS*this._thickness(snake),eatR=headR+30;
    for(let i=this.food.length-1;i>=0;i--){
      const f=this.food[i],dx=f.x-head.x;if(dx>eatR||dx<-eatR)continue;
      const dy=f.y-head.y;if(dy>eatR||dy<-eatR)continue;
      if(dx*dx+dy*dy<(headR+f.radius)**2){this.food.splice(i,1);snake.score+=f.value||1;}
    }
    for(let i=this.megaOrbs.length-1;i>=0;i--){
      const m=this.megaOrbs[i],dx=head.x-m.x,dy=head.y-m.y;
      if(dx*dx+dy*dy<(headR+m.radius)**2){this.megaOrbs.splice(i,1);snake.score+=m.value;}
    }
  }

  updateMegaOrbs(dt) {
    const half=MAP_SIZE/2-50;
    for(const m of this.megaOrbs){
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.spin+=dt*1.5;
      if(m.x<-half){m.x=-half;m.vx=Math.abs(m.vx);}if(m.x>half){m.x=half;m.vx=-Math.abs(m.vx);}
      if(m.y<-half){m.y=-half;m.vy=Math.abs(m.vy);}if(m.y>half){m.y=half;m.vy=-Math.abs(m.vy);}
    }
  }

  _checkCollisions() {
    const arr=Array.from(this.snakes.values()).filter(s=>s.alive);
    for(let i=0;i<arr.length;i++){
      const a=arr[i];if(!a.alive)continue;
      const ahead=a.segments[0],aHeadR=HEAD_RADIUS*this._thickness(a);
      for(let j=0;j<arr.length;j++){
        if(i===j)continue;
        const b=arr[j];if(!b.alive)continue;
        // TEAM MODE: teammates can't collide
        if(this.mode==='team'&&a.teamId>=0&&a.teamId===b.teamId) continue;
        const bDotR=DOT_RADIUS*this._thickness(b);
        const dist=aHeadR+bDotR,distSq=dist*dist;
        for(let k=1;k<b.segments.length;k++){
          const seg=b.segments[k],dx=ahead.x-seg.x,dy=ahead.y-seg.y;
          if(dx*dx+dy*dy<distSq){
            this.killSnake(a.id,b.id);
            b.score+=Math.floor(a.segments.length/2+a.score/4);
            break;
          }
        }
        if(!a.alive)break;
      }
    }
  }

  // --- Bot AI (unchanged) ---
  _botAI(s,dt){if(s.skill===SKILL_ADVANCED)this._advAI(s,dt);else if(s.skill===SKILL_AMATEUR)this._amtAI(s,dt);else this._begAI(s,dt);}

  _begAI(s,dt){
    s.botTimer-=dt;if(s.botTimer>0)return;s.botTimer=0.7+Math.random()*0.8;
    const h=s.segments[0],wall=MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=false;return;}
    if(Math.random()<0.25){s.botWanderAngle+=(Math.random()-0.5)*2.5;s.targetAngle=s.botWanderAngle;s.boosting=false;return;}
    let cl=null,cSq=250*250;
    for(const f of this.food){const dx=f.x-h.x;if(dx>250||dx<-250)continue;const dy=f.y-h.y;if(dy>250||dy<-250)continue;const d2=dx*dx+dy*dy;if(d2<cSq){cSq=d2;cl=f;}}
    if(cl)s.targetAngle=Math.atan2(cl.y-h.y,cl.x-h.x);else{s.botWanderAngle+=(Math.random()-0.5)*2;s.targetAngle=s.botWanderAngle;}
    s.boosting=false;
  }
  _amtAI(s,dt){
    s.botTimer-=dt;if(s.botTimer>0)return;s.botTimer=0.3+Math.random()*0.4;
    const h=s.segments[0],wall=MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=true;return;}
    let cl=null,cSq=450*450;
    for(const f of this.food){const dx=f.x-h.x;if(dx>450||dx<-450)continue;const dy=f.y-h.y;if(dy>450||dy<-450)continue;const d2=dx*dx+dy*dy;if(d2<cSq){cSq=d2;cl=f;}}
    for(const[,o]of this.snakes){if(o.id===s.id||!o.alive)continue;const dx=o.segments[0].x-h.x,dy=o.segments[0].y-h.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<180){s.targetAngle=Math.atan2(-dy,-dx)+(Math.random()-0.5)*0.5;s.boosting=d<90;return;}}
    if(cl){s.targetAngle=Math.atan2(cl.y-h.y,cl.x-h.x);s.boosting=false;}
    else{s.botWanderAngle+=(Math.random()-0.5)*1.2;s.targetAngle=s.botWanderAngle;s.boosting=false;}
  }
  _advAI(s,dt){
    s.botTimer-=dt;if(s.botTimer>0)return;s.botTimer=0.1;
    const h=s.segments[0],wall=MAP_SIZE/2-250;
    if(Math.abs(h.x)>wall||Math.abs(h.y)>wall){s.targetAngle=Math.atan2(-h.y,-h.x);s.boosting=false;return;}
    for(const[,o]of this.snakes){if(o.id===s.id||!o.alive)continue;const dx=o.segments[0].x-h.x,dy=o.segments[0].y-h.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<220&&o.score>=s.score*0.85){s.targetAngle=Math.atan2(-dy,-dx)+(Math.random()<0.5?-0.3:0.3);s.boosting=d<130&&s.score>30;return;}}
    let bm=null,bmd=1500;for(const m of this.megaOrbs){const d=Math.sqrt((m.x-h.x)**2+(m.y-h.y)**2);if(d<bmd){bmd=d;bm=m;}}
    if(bm){const t=bmd/SNAKE_SPEED;s.targetAngle=Math.atan2(bm.y+bm.vy*t-h.y,bm.x+bm.vx*t-h.x);s.boosting=bmd>500&&s.score>20;return;}
    let bp=null,bpd=700;for(const[,o]of this.snakes){if(o.id===s.id||!o.alive||o.score>=s.score*0.7)continue;const d=Math.sqrt((o.segments[0].x-h.x)**2+(o.segments[0].y-h.y)**2);if(d<bpd){bpd=d;bp=o;}}
    if(bp){const la=0.8+bpd/400;s.targetAngle=Math.atan2(bp.segments[0].y+Math.sin(bp.angle)*SNAKE_SPEED*la-h.y,bp.segments[0].x+Math.cos(bp.angle)*SNAKE_SPEED*la-h.x);s.boosting=bpd>250&&s.score>40;return;}
    let bf=null,br=0;for(const f of this.food){const dx=f.x-h.x;if(dx>800||dx<-800)continue;const dy=f.y-h.y;if(dy>800||dy<-800)continue;const ratio=(f.value||1)/(Math.sqrt(dx*dx+dy*dy)+50);if(ratio>br){br=ratio;bf=f;}}
    if(bf){s.targetAngle=Math.atan2(bf.y-h.y,bf.x-h.x);s.boosting=false;return;}
    s.botWanderAngle+=(Math.random()-0.5)*0.5;s.targetAngle=s.botWanderAngle;s.boosting=false;
  }

  // --- Broadcasting ---
  broadcastState() {
    for(const [ws,playerId] of this.clients){
      if(ws.readyState!==WebSocket.OPEN)continue;
      const mySnake=this.snakes.get(playerId);
      if(!mySnake||!mySnake.alive)continue;
      const cx=mySnake.segments[0].x,cy=mySnake.segments[0].y,viewRange=1800;
      const visSnakes=[],visFood=[],visMega=[];
      for(const [,snake] of this.snakes){
        if(!snake.alive)continue;
        for(let i=0;i<snake.segments.length;i+=3){
          if(Math.abs(snake.segments[i].x-cx)<viewRange&&Math.abs(snake.segments[i].y-cy)<viewRange){visSnakes.push(snake);break;}
        }
      }
      for(const f of this.food){if(Math.abs(f.x-cx)<viewRange&&Math.abs(f.y-cy)<viewRange)visFood.push(f);}
      for(const m of this.megaOrbs){if(Math.abs(m.x-cx)<viewRange&&Math.abs(m.y-cy)<viewRange)visMega.push(m);}

      // [0x01][snakeCount u16]
      // per snake: [id u16][skin u8][boosting u8][isBot u8][teamId i8][score u16][nameLen u8][name][segCount u16][segs]
      let totalSegs=0,totalNameBytes=0;
      for(const s of visSnakes){totalSegs+=s.segments.length;totalNameBytes+=Buffer.byteLength(s.name,'utf8');}
      const bufSize=1+2+visSnakes.length*(2+1+1+1+1+2+1+2)+totalNameBytes+totalSegs*4+2+visFood.length*7+2+visMega.length*7;
      const buf=Buffer.alloc(bufSize);
      let off=0;
      buf[off++]=0x01;buf.writeUInt16LE(visSnakes.length,off);off+=2;
      for(const snake of visSnakes){
        buf.writeUInt16LE(snake.id,off);off+=2;
        buf[off++]=snake.skin;buf[off++]=snake.boosting?1:0;buf[off++]=snake.isBot?1:0;
        buf.writeInt8(snake.teamId,off);off+=1;
        buf.writeUInt16LE(Math.min(snake.score,65535),off);off+=2;
        const nb=Buffer.from(snake.name,'utf8');buf[off++]=nb.length;nb.copy(buf,off);off+=nb.length;
        buf.writeUInt16LE(snake.segments.length,off);off+=2;
        for(const seg of snake.segments){buf.writeInt16LE(Math.round(seg.x),off);off+=2;buf.writeInt16LE(Math.round(seg.y),off);off+=2;}
      }
      buf.writeUInt16LE(visFood.length,off);off+=2;
      for(const f of visFood){buf.writeInt16LE(Math.round(f.x),off);off+=2;buf.writeInt16LE(Math.round(f.y),off);off+=2;buf[off++]=f.color;buf[off++]=Math.round(f.radius);buf[off++]=f.tier;}
      buf.writeUInt16LE(visMega.length,off);off+=2;
      for(const m of visMega){buf.writeInt16LE(Math.round(m.x),off);off+=2;buf.writeInt16LE(Math.round(m.y),off);off+=2;buf[off++]=m.color;buf[off++]=Math.round(m.radius);buf[off++]=Math.min(m.value,255);}
      ws.send(buf.slice(0,off));
    }
  }

  broadcastLeaderboard() {
    let entries;
    if (this.mode === 'team') {
      // Team leaderboard: combined score per team
      entries = [];
      for (const [teamId, team] of this.teams) {
        let totalScore = 0;
        for (const sid of team.memberIds) {
          const s = this.snakes.get(sid);
          if (s && s.alive) totalScore += s.score;
        }
        entries.push({ id: 60000 + teamId, score: totalScore, name: team.name, isBot: false, teamId });
      }
      entries.sort((a,b) => b.score - a.score);
    } else {
      entries = Array.from(this.snakes.values())
        .filter(s=>s.alive).sort((a,b)=>b.score-a.score).slice(0,10)
        .map(s => ({ id: s.id, score: s.score, name: s.name, isBot: s.isBot, teamId: s.teamId }));
    }

    let size=2;
    for(const e of entries) size+=7+Buffer.byteLength(e.name,'utf8');
    const buf=Buffer.alloc(size);
    let off=0;
    buf[off++]=0x05;buf[off++]=entries.length;
    for(const e of entries){
      buf.writeUInt16LE(e.id,off);off+=2;
      buf.writeUInt16LE(Math.min(e.score,65535),off);off+=2;
      buf[off++]=e.isBot?1:0;
      buf.writeInt8(e.teamId,off);off+=1;
      const nb=Buffer.from(e.name,'utf8');buf[off++]=nb.length;nb.copy(buf,off);off+=nb.length;
    }
    this.broadcast(buf.slice(0,off));
  }

  broadcast(data){for(const[ws]of this.clients){if(ws.readyState===WebSocket.OPEN)ws.send(data);}}
}

// =====================================================
// RoomManager
// =====================================================
class RoomManager {
  constructor(httpServer) {
    this.rooms = new Map();
    this.wsToRoom = new Map();
    this.nextCustomId = 100;

    // Pre-created rooms
    this.createRoom('room-0', 'Free For All', { mode: 'solo' });
    this.createRoom('room-1', 'Neon Arena', { mode: 'solo' });
    this.createRoom('room-2', 'Team Battle', { mode: 'team', teamSize: 2, maxTeams: 8 });

    this.wss = new WebSocket.Server({ server: httpServer });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));

    setInterval(() => {
      for(const [ws] of this.wsToRoom){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}
    }, 10000);
  }

  createRoom(id, name, opts = {}) {
    const room = new Room(id, name, opts);
    this.rooms.set(id, room);
    return room;
  }

  createCustomRoom(name, mode, teamSize, creatorName) {
    const id = `custom-${this.nextCustomId++}`;
    const opts = { mode, teamSize: teamSize || 2, maxTeams: Math.floor(30/(teamSize||2)), isCustom: true, creatorName };
    return this.createRoom(id, name, opts);
  }

  onConnection(ws, req) {
    ws.binaryType='arraybuffer'; ws.isAlive=true;
    ws.on('pong',()=>{ws.isAlive=true;});
    const url=new URL(req.url,'http://localhost');
    const roomId=url.searchParams.get('room')||'room-0';
    const room=this.rooms.get(roomId);
    if(!room){ws.close(4001,'Room not found');return;}
    this.wsToRoom.set(ws,room);
    ws.on('message',(data)=>room.handleMessage(ws,data));
    ws.on('close',()=>{room.playerLeave(ws);this.wsToRoom.delete(ws);});
  }

  getRoomList() {
    const list=[];
    for(const [id,room] of this.rooms){
      list.push({
        id, name: room.name, mode: room.mode,
        teamSize: room.teamSize,
        players: room.realPlayerCount,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        isCustom: room.isCustom,
        creatorName: room.creatorName,
        teams: room.mode==='team' ? Array.from(room.teams.entries()).map(([tid,t])=>({
          id:tid, name:t.name, color:t.color,
          members: t.memberIds.size,
        })) : null,
      });
    }
    return list;
  }
}

module.exports = { RoomManager };
