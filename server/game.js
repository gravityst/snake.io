const WebSocket = require('ws');

// =====================================================
// Room-based multiplayer server with Solo + Team modes
// =====================================================

const MAP_SIZE = 14000;
const FOOD_COUNT = 2100;
const MAX_FOOD = 2600;
const SNAKE_SPEED = 280;
const BOOST_SPEED = 500;
const SEGMENT_SPACING = 24;
const DOT_RADIUS = 9;
const INITIAL_LENGTH = 10;
const HEAD_RADIUS = 14;
const BOOST_SHRINK_RATE = 2.5;
const MAX_BOTS = 12;
const MEGA_ORB_COUNT = 10;
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

// =====================================================
// BATTLE ROYALE configuration
// =====================================================
// Match lifecycle:
//   'lobby'     — open for joins, AI fills empty slots, no zone, no timer
//   'countdown' — first player joined; 30s join window before match starts
//   'active'    — joins LOCKED, room hidden from list, zone shrinks, no respawn
//   'ended'     — winner declared, room resets to lobby after a short delay
const ROYALE_JOIN_WINDOW_MS = 30000;
const ROYALE_MAX_PLAYERS = 20;

// Each phase: hold the zone where it is for `hold` seconds, then shrink to
// `radius` over `shrinkTime` seconds. While outside, lose `damage` score/sec.
// Easy to tune.
const ROYALE_PHASES = [
  { hold: 25, shrinkTime: 30, radius: 5000, damage: 4  },
  { hold: 18, shrinkTime: 28, radius: 3000, damage: 7  },
  { hold: 14, shrinkTime: 22, radius: 1500, damage: 11 },
  { hold: 10, shrinkTime: 16, radius:  650, damage: 16 },
  { hold:  8, shrinkTime: 12, radius:  200, damage: 24 },
];
const ROYALE_INITIAL_RADIUS = 7000;
const ROYALE_END_HOLD_MS = 12000; // hold ended state before resetting

const BOT_NAMES = [
  'Viper','Shadow','Blaze','Neon','Ghost','Toxic','Pixel','Glitch',
  'Storm','Bolt','Ember','Frost','Nova','Pulse','Drift','Surge',
  'Zenith','Razor','Flux','Echo','Orbit','Prism','Hex','Chrome',
];

const TEAM_COLORS = ['#0ff','#f44','#0f0','#ff0','#f0f','#f80','#08f','#8f0'];
const TEAM_NAMES_DEFAULT = ['Cyan','Red','Green','Gold','Pink','Orange','Blue','Lime'];
// Zone Domination uses a high-contrast Red vs Blue palette (Green/Gold for 3-4
// teams) — 6-digit hex so the client's shading helpers work cleanly.
const DOM_TEAM_NAMES = ['Red','Blue','Green','Gold'];
const DOM_TEAM_COLORS = ['#ff3b3b','#3b82f6','#3fb950','#f5c518'];

// =====================================================
// ZONE DOMINATION configuration
// =====================================================
// A territorial team mode played on a large rectangular map. Teams capture and
// hold a grid of zones; held zones generate points over time, level up, and
// chain together for connection multipliers. A central VIP zone is worth the
// most. Each team has a protected home base (spawn + HQ). Rotating hotspots and
// periodic events (Food Storm / Double Points / Zone Relocation / Overtime)
// keep the board moving. Roles (Scout/Defender/Collector/Commander) give
// *territorial* edges only — never snake speed or growth boosts.
const DOM_MAP_W = 18000;             // rectangular map width  (halfW = 9000)
const DOM_MAP_H = 11000;             // rectangular map height (halfH = 5500) — ~same area as the 14k square
const DOM_ROUND_MS = 6 * 60 * 1000;  // 6-minute rounds, drop-in joins stay open throughout
const DOM_END_HOLD_MS = 12000;       // celebrate the winner before resetting
const DOM_OVERTIME_MS = 45000;       // final stretch: forced Overtime event
const DOM_TEAMS_DEFAULT = 2;
const DOM_MAX_BOTS = 14;             // fill the board so territory battles feel alive

const DOM_ADJ_DIST = 4200;           // two zones are "adjacent" (connectable) within this distance
const DOM_CAPTURE_RADIUS = 920;      // standard zone footprint
const DOM_VIP_RADIUS = 1080;
const DOM_HOME_RADIUS = 1180;
const DOM_RESOURCE_RADIUS = 960;

const DOM_CAPTURE_RATE = 24;         // capture progress/sec at capture-weight 1 (neutral → owned)
const DOM_NEUTRALIZE_RATE = 30;      // progress/sec lost while an enemy stands on an UNDEFENDED owned zone
const DOM_DEFENDER_GRACE_MS = 3000;  // a Defender keeps the zone locked for this long after stepping out
const DOM_DECAY_RATE = 10;           // contested/abandoned capture bleeds back toward 0 at this rate

const DOM_MAX_LEVEL = 5;
const DOM_LEVEL_HOLD_SEC = 15;       // seconds of uninterrupted hold per level-up
const DOM_BASE_POINTS = 2.0;         // points/sec per level — normal zone
const DOM_VIP_POINTS = 7.0;          // points/sec per level — VIP zone
const DOM_HOME_POINTS = 1.4;         // points/sec — home base (fixed, does not level)
const DOM_RESOURCE_POINTS = 1.6;     // points/sec per level — resource zone (also yields resources)
const DOM_RESOURCE_RATE = 4.0;       // resources/sec per level from a resource zone
const DOM_RES_CONVERT_RATE = 3.0;    // resources auto-converted to score per sec
const DOM_RES_CONVERT_VALUE = 0.5;   // score gained per resource converted
const DOM_COLLECTOR_YIELD = 0.5;     // fraction of eaten food value a Collector also banks as team resources

const DOM_CONN_MULT = 0.16;          // +16% point output per *extra* zone in a connected friendly group
const DOM_HOTSPOT_MULT = 3.0;        // point multiplier on an active hotspot zone
const DOM_HOTSPOT_PERIOD_MS = 40000; // a fresh hotspot set is chosen this often
const DOM_HOTSPOT_DURATION_MS = 26000;
const DOM_HOTSPOT_COUNT = 2;         // zones spotlighted per rotation

const DOM_EVENT_PERIOD_MS = 58000;   // global event cadence
const DOM_EVENT_DURATION_MS = 24000;
const DOM_FOODSTORM_BURST = 650;     // extra food dropped (uniformly) when a Food Storm hits

// Core sabotage is a hit-and-run denial: disabling is a touch faster than the
// ~3.3s it takes to neutralize a zone outright, so a raider can dart in, knock
// the core offline (zeroing its output) and leave before they'd ever flip it.
// Owners repair more slowly, so an unattended core stays vulnerable.
const DOM_CORE_DISABLE_SEC = 3.0;    // enemy presence needed to knock a core offline (stops that zone's output)
const DOM_CORE_REPAIR_SEC = 6;       // owner presence needed to bring a core back online

// Zone types
const ZONE_NORMAL = 0, ZONE_VIP = 1, ZONE_HOME = 2, ZONE_RESOURCE = 3;
// Team roles (territorial modifiers only — no speed/growth boosts)
const ROLE_SCOUT = 0, ROLE_DEFENDER = 1, ROLE_COLLECTOR = 2, ROLE_COMMANDER = 3;
const ROLE_NAMES = ['Scout', 'Defender', 'Collector', 'Commander'];
// Capture weight each role contributes while standing on a zone
const ROLE_CAPTURE_WEIGHT = [1.0, 1.0, 1.0, 1.35]; // Commander rallies (heavier); others base
const DOM_EVENT_TYPES = ['foodstorm', 'doublepoints', 'relocation'];

// =====================================================
// CAPTURE THE ORB configuration
// =====================================================
// Two teams, each with an orb on a pedestal at its protected base. Steal the
// enemy orb and carry it to your base — but only while your own orb is home.
// Reuses the Red/Blue team palette, rectangular map, and protected bases.
const CTF_MAP_W = 13000, CTF_MAP_H = 8000;     // compact rectangle → punchy runs
const CTF_ROUND_MS = 6 * 60 * 1000;
const CTF_END_HOLD_MS = 12000;
const CTF_CAPTURES_TO_WIN = 3;
const CTF_BASE_X_FRAC = 0.62;                  // base centre x = ±frac * halfW
const CTF_BASE_RADIUS = 1100;                  // protected sanctuary + spawn
const CTF_ORB_RADIUS = 40;                     // visual / collision size of an orb
const CTF_PICKUP_R = 95;                       // head-to-orb pickup distance
const CTF_SCORE_R = 360;                       // deliver radius around your own base centre
const CTF_RETURN_SEC = 8;                       // a dropped orb returns home after this idle
const CTF_MAX_BOTS = 12;                        // fill both teams
const CTF_TEAMS = 2;

// =====================================================
// Room
// =====================================================
class Room {
  constructor(id, name, opts = {}) {
    this.id = id;
    this.name = name;
    this.mode = opts.mode || 'solo';       // 'solo' | 'team' | 'royale'
    this.teamSize = opts.teamSize || 2;    // players per team (team mode)
    this.maxTeams = opts.maxTeams || Math.floor(MAX_PLAYERS_PER_ROOM / (this.teamSize || 2));
    this.isCustom = opts.isCustom || false;
    this.creatorName = opts.creatorName || '';

    // Playfield bounds. Square by default; Zone Domination & CTF use rectangles.
    this.mapHalfW = MAP_SIZE / 2;
    this.mapHalfH = MAP_SIZE / 2;
    if (this.mode === 'domination') {
      this.mapHalfW = DOM_MAP_W / 2;
      this.mapHalfH = DOM_MAP_H / 2;
    } else if (this.mode === 'ctf') {
      this.mapHalfW = CTF_MAP_W / 2;
      this.mapHalfH = CTF_MAP_H / 2;
    }

    // ---- Battle Royale state ----
    if (this.mode === 'royale') {
      // Per-room config from the creator's BR settings (or defaults).
      const cfg = opts.royaleConfig || {};
      const startR = cfg.startRadius && cfg.startRadius > 200
        ? Math.min(cfg.startRadius, ROYALE_INITIAL_RADIUS)
        : ROYALE_INITIAL_RADIUS;
      const sp = Math.max(0.5, Math.min(2, cfg.phaseSpeed || 1));
      // Build phase array — scales hold/shrink times by sp and radii by startR.
      if (startR === ROYALE_INITIAL_RADIUS && sp === 1) {
        this.royalePhases = ROYALE_PHASES;
      } else {
        this.royalePhases = [
          { hold: 25 * sp, shrinkTime: 30 * sp, radius: Math.max(120, Math.floor(startR * 0.55)), damage: 4  },
          { hold: 18 * sp, shrinkTime: 28 * sp, radius: Math.max(100, Math.floor(startR * 0.32)), damage: 7  },
          { hold: 14 * sp, shrinkTime: 22 * sp, radius: Math.max( 80, Math.floor(startR * 0.16)), damage: 11 },
          { hold: 10 * sp, shrinkTime: 16 * sp, radius: Math.max( 60, Math.floor(startR * 0.07)), damage: 16 },
          { hold:  8 * sp, shrinkTime: 12 * sp, radius: Math.max( 40, Math.floor(startR * 0.025)), damage: 24 },
        ];
      }
      this.royaleInitialRadius = startR;
      this.royaleBotDifficulty = cfg.botDifficulty || 'mixed';
      this.royaleState = 'lobby';
      this.royaleJoinDeadline = 0;
      this.royaleMatchStart = 0;
      this.royaleEndTime = 0;
      this.royalePhaseIndex = -1;
      this.royalePhaseStart = 0;
      this.zone = {
        cx: 0, cy: 0,
        radius: startR,
        prevRadius: startR,
        targetRadius: startR,
        damage: 0,
      };
      this.royaleWinnerId = null;
      this.royaleWinnerName = '';
    }


    // Team state (team / domination / ctf modes)
    // teams: Map<teamId, { name, color, memberIds: Set<snakeId>, domScore, resources, ctfScore }>
    this.teams = new Map();
    const numTeams = this.mode === 'domination'
      ? Math.max(2, Math.min(opts.numTeams || DOM_TEAMS_DEFAULT, 4))
      : this.mode === 'ctf' ? CTF_TEAMS
      : (this.mode === 'team' ? Math.min(this.maxTeams, 8) : 0);
    // Domination & CTF share the high-contrast Red/Blue palette.
    const redBlue = this.mode === 'domination' || this.mode === 'ctf';
    for (let i = 0; i < numTeams; i++) {
      this.teams.set(i, {
        name: (redBlue ? DOM_TEAM_NAMES[i] : TEAM_NAMES_DEFAULT[i]) || `Team ${i+1}`,
        color: (redBlue ? DOM_TEAM_COLORS[i] : TEAM_COLORS[i]) || '#fff',
        memberIds: new Set(),
        domScore: 0,    // Zone Domination cumulative team score
        resources: 0,   // Zone Domination team economy
        ctfScore: 0,    // Capture the Orb captures
      });
    }

    // ---- Zone Domination state ----
    if (this.mode === 'domination') {
      this.domState = 'active';        // 'active' | 'ended' (joins always open)
      this.domRoundStart = Date.now();
      this.domRoundEnd = this.domRoundStart + DOM_ROUND_MS;
      this.domEndTime = 0;
      this.domWinnerTeam = -1;
      this.domEvent = null;            // { type, until } currently-running global event
      this.domNextEventAt = this.domRoundStart + DOM_EVENT_PERIOD_MS;
      this.domNextHotspotAt = this.domRoundStart + DOM_HOTSPOT_PERIOD_MS;
      this.domOvertime = false;
      this.domStormUntil = 0;
      this.domLayoutVersion = 1;       // bumped on relocation so clients re-read layout
      this.zones = [];
      this._domBuildZones();
    }

    // ---- Capture the Orb state ----
    if (this.mode === 'ctf') {
      this.ctfState = 'active';        // 'active' | 'ended'
      this.ctfRoundStart = Date.now();
      this.ctfRoundEnd = this.ctfRoundStart + CTF_ROUND_MS;
      this.ctfEndTime = 0;
      this.ctfWinnerTeam = -1;
      const bx = Math.round(CTF_BASE_X_FRAC * this.mapHalfW);
      // Base 0 (Red) on the left, base 1 (Blue) on the right.
      this.ctfBases = [
        { team: 0, x: -bx, y: 0, radius: CTF_BASE_RADIUS },
        { team: 1, x:  bx, y: 0, radius: CTF_BASE_RADIUS },
      ];
      // One orb per team, starting on its pedestal.
      this.ctfOrbs = this.ctfBases.map(b => ({
        team: b.team, state: 'base', x: b.x, y: b.y,
        baseX: b.x, baseY: b.y, holder: null, droppedAt: 0,
      }));
    }

    this.snakes = new Map();
    this.food = [];
    this.megaOrbs = [];
    this.bots = [];
    this.nextSnakeId = 1;
    this.clients = new Map(); // ws → snakeId
    this.disconnected = new Map(); // name → snakeId

    this.spawnFood();
    this.spawnMegaOrbs();
    // BR rooms ALWAYS need exactly 20 snakes (player+bot mix). Other modes
    // use the smaller MAX_BOTS so the room doesn't feel empty.
    this.spawnBots(this.mode === 'royale' ? ROYALE_MAX_PLAYERS : MAX_BOTS);

    this.lastTick = Date.now();
    this.tickCount = 0;
    this.tickInterval = null;
    this.broadcastInterval = null;
    this.running = false;
    // Only start ticking when players join (saves CPU for empty rooms)
  }

  _startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTick = Date.now();
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
    this.broadcastInterval = setInterval(() => {
      this.broadcastState();
      this.broadcastLeaderboard();
      // Royale state at lower freq (every ~6 frames ≈ 5 Hz)
      if (this.mode === 'royale' && this.tickCount % 6 === 0) this.broadcastRoyaleState();
      // Zone Domination meta-state at ~5 Hz (JSON text frame)
      if (this.mode === 'domination' && this.tickCount % 6 === 0) this.broadcastDominationState();
      if (this.mode === 'ctf' && this.tickCount % 6 === 0) this.broadcastCtfState();
    }, BROADCAST_MS);
  }

  _stopLoop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);
    this.tickInterval = null;
    this.broadcastInterval = null;
  }

  destroy() {
    clearInterval(this.tickInterval);
    clearInterval(this.broadcastInterval);
    for (const [ws] of this.clients) ws.close();
  }

  get realPlayerCount() { return this.clients.size; }
  get targetBotCount() {
    // In Battle Royale, freeze bot count when match starts. Lobby fills to ROYALE_MAX_PLAYERS.
    if (this.mode === 'royale') {
      if (this.royaleState === 'active' || this.royaleState === 'ended') return 0;
      return Math.max(0, ROYALE_MAX_PLAYERS - this.realPlayerCount);
    }
    if (this.mode === 'domination') return Math.max(0, DOM_MAX_BOTS - this.realPlayerCount);
    if (this.mode === 'ctf') return Math.max(0, CTF_MAX_BOTS - this.realPlayerCount);
    return Math.max(0, MAX_BOTS - this.realPlayerCount);
  }

  // Royale: are joins still being accepted?
  _isRoyaleOpen() {
    if (this.mode !== 'royale') return true;
    return this.royaleState === 'lobby' || this.royaleState === 'countdown';
  }

  // Royale: should bots be respawned on death?
  _allowBotRespawn() {
    if (this.mode !== 'royale') return true;
    return this.royaleState === 'lobby' || this.royaleState === 'countdown';
  }


  // --- Helpers ---
  _zoned(power = 1.5) {
    const r = Math.pow(Math.random(), power) * (MAP_SIZE/2 - 100);
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a)*r, y: Math.sin(a)*r };
  }
  // Uniform spread across the whole rectangular field — no center bias, so no
  // part of the map carries a resource advantage (Zone Domination requirement).
  _uniformPos(margin = 120) {
    return {
      x: (Math.random() * 2 - 1) * (this.mapHalfW - margin),
      y: (Math.random() * 2 - 1) * (this.mapHalfH - margin),
    };
  }
  _thickness(s) { return 1 + Math.sqrt(s.score) / 45 + s.score / 8000; }
  _buildFoodGrid() {
    this.foodGrid = new Map();
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      const key = Math.floor(f.x / 500) + ',' + Math.floor(f.y / 500);
      let bucket = this.foodGrid.get(key);
      if (!bucket) { bucket = []; this.foodGrid.set(key, bucket); }
      bucket.push(i);
    }
  }
  _randomSkill() {
    const diff = this.royaleBotDifficulty || 'mixed';
    const r = Math.random();
    // BR rooms with a chosen difficulty override the global mix.
    if (this.mode === 'royale' && diff === 'easy') {
      if (r < 0.05) return SKILL_AMATEUR;
      return SKILL_BEGINNER;
    }
    if (this.mode === 'royale' && diff === 'hard') {
      if (r < 0.55) return SKILL_ADVANCED;
      if (r < 0.95) return SKILL_AMATEUR;
      return SKILL_BEGINNER;
    }
    // Default (and BR "mixed") — slightly tougher mix in BR rooms.
    if (this.mode === 'royale') {
      if (r < 0.25) return SKILL_ADVANCED;
      if (r < 0.65) return SKILL_AMATEUR;
      return SKILL_BEGINNER;
    }
    // Classic rooms keep the original gentle mix.
    const adv = this.bots.filter(id => { const s=this.snakes.get(id); return s&&s.alive&&s.skill===SKILL_ADVANCED; }).length;
    if (r < 0.05 && adv < MAX_ADVANCED_BOTS) return SKILL_ADVANCED;
    if (r < 0.30) return SKILL_AMATEUR;
    return SKILL_BEGINNER;
  }

  // --- Food / Orbs ---
  // During a Food Storm the working target & trim cap rise so the burst of
  // evenly-spread food actually persists instead of being trimmed away.
  _foodStorming() { return this.mode === 'domination' && this.domStormUntil && Date.now() < this.domStormUntil; }
  _foodTarget() { return this._foodStorming() ? FOOD_COUNT + DOM_FOODSTORM_BURST : FOOD_COUNT; }
  _foodCap() { return this._foodStorming() ? MAX_FOOD + DOM_FOODSTORM_BURST : MAX_FOOD; }
  spawnFood() { const t = this._foodTarget(); while (this.food.length<t) this.food.push(this._createFood()); }
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
    const pos=(this.mode==='domination'||this.mode==='ctf')?this._uniformPos():this._zoned(1.5);
    return {x:pos.x,y:pos.y,color:Math.floor(Math.random()*8),radius,value,tier};
  }
  // CTF has its own team orbs — skip drifting mega orbs so the two don't get confused.
  spawnMegaOrbs() { if(this.mode==='ctf')return; while(this.megaOrbs.length<MEGA_ORB_COUNT) this.megaOrbs.push(this._createMegaOrb()); }
  _createMegaOrb() {
    const a=Math.random()*Math.PI*2,speed=25+Math.random()*25,pos=this.mode==='domination'?this._uniformPos(200):this._zoned(1.3);
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
      } else if (this.mode==='domination') {
        this._domBotJoin(snake);
      } else if (this.mode==='ctf') {
        this._ctfBotJoin(snake);
      }
      this.bots.push(snake.id);
    }
  }

  _createSnake(name,isBot,skinIdx,skill,accessory) {
    const id=this.nextSnakeId++;
    const angle=Math.random()*Math.PI*2;
    const pos=isBot?this._zoned(1.2):this._zoned(2.5);
    const segments=[];
    for(let i=0;i<INITIAL_LENGTH;i++) segments.push({x:pos.x-Math.cos(angle)*i*SEGMENT_SPACING,y:pos.y-Math.sin(angle)*i*SEGMENT_SPACING});
    const snake={
      id,name,segments,angle,targetAngle:angle,
      boosting:false,score:0,skin:skinIdx,accessory:accessory||0,
      color:Math.floor(Math.random()*8),alive:true,isBot,
      skill:skill??SKILL_BEGINNER,
      boostAccum:0,botTimer:0,botWanderAngle:angle,
      teamId:-1, // -1 = no team (solo mode)
      role:-1,   // -1 = no role; Zone Domination assigns Scout/Defender/Collector/Commander
      evasion:1, // 1 = full collision-dodging; lower = reacts later (easier to KO)
      invincible:2, // 2 seconds of spawn invincibility
      kills:0,
    };
    this.snakes.set(id,snake);
    return snake;
  }

  // --- Player join/leave ---
  // Protocol: join message is [0x03][skinIdx][accessory][teamId (team/domination)][role (domination)][name...]
  playerJoin(ws, name, skinIdx, teamId, accessory, role = -1) {
    if (this.clients.has(ws)) return;
    if (this.realPlayerCount >= MAX_PLAYERS_PER_ROOM) return;
    // Battle Royale: refuse joins once the match has sealed
    if (this.mode === 'royale' && !this._isRoyaleOpen()) {
      // Send a "match already in progress" close so the client can fall back
      try {
        const d = Buffer.alloc(2);
        d[0] = 0x09; // royale-sealed notification
        d[1] = 1;
        ws.send(d);
        setTimeout(() => { try { ws.close(4002, 'match-sealed'); } catch {} }, 50);
      } catch {}
      return;
    }
    // Remember rejoin info on the ws so we can recreate the snake on round reset
    ws._joinInfo = { name, skinIdx, teamId, accessory, role };


    let snake;
    // Check for a disconnected snake with the same name to reconnect
    const dcId = this.disconnected.get(name);
    if (dcId !== undefined) {
      const dcSnake = this.snakes.get(dcId);
      if (dcSnake && dcSnake.alive) {
        snake = dcSnake;
        delete snake.disconnectTime;
        this.disconnected.delete(name);
      }
    }

    if (!snake) {
      snake = this._createSnake(name, false, skinIdx, SKILL_BEGINNER, accessory || 0);

      // Team assignment
      if (this.mode === 'team' && this.teams.has(teamId)) {
        const team = this.teams.get(teamId);
        if (team.memberIds.size < this.teamSize + 10) { // allow some overflow for bots
          snake.teamId = teamId;
          team.memberIds.add(snake.id);
        }
      } else if (this.mode === 'domination') {
        // Honor the chosen team; fall back to the smallest if invalid.
        let tid = teamId;
        if (!this.teams.has(tid)) {
          let minTeam = 0, minSize = Infinity;
          for (const [id, t] of this.teams) if (t.memberIds.size < minSize) { minSize = t.memberIds.size; minTeam = id; }
          tid = minTeam;
        }
        snake.teamId = tid;
        this.teams.get(tid).memberIds.add(snake.id);
        snake.role = (role >= 0 && role <= 3) ? role : ROLE_SCOUT;
        this._domPlaceAtHome(snake);
      } else if (this.mode === 'ctf') {
        // Honor the chosen team; fall back to the smallest if invalid.
        let tid = teamId;
        if (!this.teams.has(tid)) {
          let minTeam = 0, minSize = Infinity;
          for (const [id, t] of this.teams) if (t.memberIds.size < minSize) { minSize = t.memberIds.size; minTeam = id; }
          tid = minTeam;
        }
        snake.teamId = tid;
        this.teams.get(tid).memberIds.add(snake.id);
        this._ctfPlaceAtBase(snake);
      }
    }

    this.clients.set(ws, snake.id);
    this._startLoop(); // wake up room when player joins

    // Battle Royale: arm the join window the moment the first human joins
    if (this.mode === 'royale' && this.royaleState === 'lobby') {
      this.royaleState = 'countdown';
      this.royaleJoinDeadline = Date.now() + ROYALE_JOIN_WINDOW_MS;
    }

    // Welcome: [0x02][version u8][yourId u16]
    const welcome = Buffer.alloc(4);
    welcome[0]=0x02; welcome[1]=1; welcome.writeUInt16LE(snake.id,2);
    ws.send(welcome);

    // Send team info: [0x06][teamCount u8][per team: id u8, colorLen u8, color, nameLen u8, name]
    if (this.mode === 'team' || this.mode === 'domination' || this.mode === 'ctf') {
      this._sendTeamInfo(ws);
    }
    // Zone Domination: hand the client the board layout + a current snapshot.
    if (this.mode === 'domination') {
      this._sendDominationLayout(ws);
      this.broadcastDominationState();
    }
    // Capture the Orb: send the static layout (bases) + current orb/score state.
    if (this.mode === 'ctf') {
      this._sendCtfLayout(ws);
      this.broadcastCtfState();
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
    if (snake && snake.alive && !snake.isBot) {
      // Mark as disconnected for potential reconnect instead of killing
      snake.disconnectTime = Date.now();
      this.disconnected.set(snake.name, playerId);
    } else if (snake) {
      if (snake.teamId >= 0) {
        const team = this.teams.get(snake.teamId);
        if (team) team.memberIds.delete(playerId);
      }
      this.killSnake(playerId, null, true);
    }
    this.clients.delete(ws);
    this.adjustBots();
    if (this.clients.size === 0) this._stopLoop(); // sleep empty rooms
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
      } else if (this.mode==='domination') {
        this._domBotJoin(snake);
      } else if (this.mode==='ctf') {
        this._ctfBotJoin(snake);
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
      const accessory = buf.length>2 ? buf[2] : 0;
      let teamId = -1;
      let role = -1;
      let nameStart = 3;
      if ((this.mode==='team' || this.mode==='domination' || this.mode==='ctf') && buf.length>3) {
        teamId = buf[3];
        nameStart = 4;
      }
      if (this.mode==='domination' && buf.length>4) {
        role = buf[4];
        nameStart = 5;
      }
      const name = buf.slice(nameStart).toString('utf8').substring(0,16) || 'Player';
      this.playerJoin(ws, name, skinIdx, teamId, accessory, role);
      return;
    }
    const playerId=this.clients.get(ws);
    if(playerId===undefined) return;
    const snake=this.snakes.get(playerId);
    if(!snake||!snake.alive) return;
    if(type===0x01&&buf.length>=5) snake.targetAngle=buf.readFloatLE(1);
    else if(type===0x02&&buf.length>=2) snake.boosting=buf[1]===1;
    else if(type===0x07&&buf.length>=2){
      // Chat emote relay: client sends [0x07][emoteId u8]
      // Broadcast [0x07][snakeId u16][emoteId u8] to all clients
      const emoteId=buf[1];
      const out=Buffer.alloc(4);
      out[0]=0x07;out.writeUInt16LE(playerId,1);out[3]=emoteId;
      this.broadcast(out);
    }
  }

  // --- Kill ---
  killSnake(id, killerId, noRespawn=false) {
    const snake=this.snakes.get(id);
    if(!snake||!snake.alive) return;
    snake.alive=false;
    // CTF: a carrier that dies drops the orb where it fell.
    if(this.mode==='ctf') this._ctfDropOrbsHeldBy(id, snake);
    // Drop food from body — every 3rd segment, capped to max 10 drops
    const dropStep = Math.max(3, Math.floor(snake.segments.length / 15));
    const dropLimit = Math.min(10, Math.floor(snake.segments.length / dropStep));
    const dropValue = Math.max(2, Math.floor(snake.score / 20));
    for(let i=0,count=0;i<snake.segments.length && this.food.length<MAX_FOOD && count<dropLimit;i+=dropStep,count++){
      const s=snake.segments[i];
      const r = 8 + Math.min(snake.score / 50, 8) + Math.random() * 3;
      const v = dropValue + Math.floor(Math.random() * 3);
      const t = r > 14 ? 4 : r > 10 ? 3 : 2;
      this.food.push({x:s.x+(Math.random()-0.5)*30,y:s.y+(Math.random()-0.5)*30,
        color:snake.color,radius:r,value:v,tier:t});
    }
    if(killerId!==null){
      const killer=this.snakes.get(killerId);
      if(killer) killer.kills++;
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
    if(snake.isBot&&!noRespawn&&this._allowBotRespawn()) setTimeout(()=>this.respawnBot(id),2000);
    else if(snake.isBot) {
      // Remove from bots roster — no respawn during BR active phase
      const idx = this.bots.indexOf(id);
      if (idx >= 0) this.bots.splice(idx, 1);
    }
    this.snakes.delete(id);
  }

  respawnBot(oldId) {
    if (!this._allowBotRespawn()) {
      const idx=this.bots.indexOf(oldId);
      if (idx>=0) this.bots.splice(idx,1);
      return;
    }
    const idx=this.bots.indexOf(oldId);
    if(idx<0) return;
    if(this.bots.length>this.targetBotCount){this.bots.splice(idx,1);return;}
    const snake=this._createSnake(BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],
      true,Math.floor(Math.random()*SKINS_COUNT),this._randomSkill());
    if(this.mode==='team'){
      let minTeam=0,minSize=Infinity;
      for(const [id,t] of this.teams){if(t.memberIds.size<minSize){minSize=t.memberIds.size;minTeam=id;}}
      snake.teamId=minTeam; this.teams.get(minTeam).memberIds.add(snake.id);
    } else if(this.mode==='domination'){
      this._domBotJoin(snake);
    } else if(this.mode==='ctf'){
      this._ctfBotJoin(snake);
    }
    this.bots[idx]=snake.id;
  }

  // =====================================================
  // ZONE DOMINATION
  // =====================================================
  _domBuildZones() {
    const cols = [-0.78, -0.39, 0, 0.39, 0.78];   // fractions of halfW
    const rows = [-0.62, 0, 0.62];                 // fractions of halfH
    const hw = this.mapHalfW, hh = this.mapHalfH;
    const numTeams = this.teams.size;
    // Home placements: left-center & right-center for the first two teams;
    // top-center & bottom-center fill in for 3- and 4-team boards.
    const homeSpec = [[0,1,0]];
    if (numTeams >= 2) homeSpec.push([4,1,1]);
    if (numTeams >= 3) homeSpec.push([2,0,2]);
    if (numTeams >= 4) homeSpec.push([2,2,3]);
    const homeAt = (c,r) => homeSpec.find(h => h[0]===c && h[1]===r);

    const zones = [];
    let id = 0;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        const x = Math.round(cols[c] * hw);
        const y = Math.round(rows[r] * hh);
        const home = homeAt(c, r);
        const isCenter = (c === 2 && r === 1);
        let type = ZONE_NORMAL, radius = DOM_CAPTURE_RADIUS, homeTeam = -1, hasCore = false;
        if (home) {
          type = ZONE_HOME; homeTeam = home[2]; radius = DOM_HOME_RADIUS;
        } else if (isCenter) {
          type = ZONE_VIP; radius = DOM_VIP_RADIUS; hasCore = true;
        } else if ((c === 1 && r === 0) || (c === 3 && r === 2)) {
          type = ZONE_RESOURCE; radius = DOM_RESOURCE_RADIUS; hasCore = true;
        }
        zones.push({
          id: id++, x, y, type, radius, homeTeam, hasCore,
          owner: homeTeam,                       // homes start owned; rest neutral
          capturingTeam: -1,
          progress: homeTeam >= 0 ? 100 : 0,
          level: homeTeam >= 0 ? 1 : 0,
          holdTime: 0,
          coreOffline: false,
          coreSab: 0,                            // 0..1 enemy sabotage progress
          hotspotUntil: 0,
          defendGraceUntil: 0,                   // Defender sticky-lock expiry
          adj: [],
        });
      }
    }
    this.zones = zones;
    this._domComputeAdjacency();
  }

  // Adjacency is derived from positions (robust to Zone Relocation): two zones
  // connect when their centers fall within DOM_ADJ_DIST.
  _domComputeAdjacency() {
    for (const z of this.zones) z.adj = [];
    for (let i = 0; i < this.zones.length; i++) {
      for (let j = i + 1; j < this.zones.length; j++) {
        const a = this.zones[i], b = this.zones[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        if (dx*dx + dy*dy <= DOM_ADJ_DIST*DOM_ADJ_DIST) { a.adj.push(b.id); b.adj.push(a.id); }
      }
    }
  }

  // Spawn / respawn a domination snake at (or just inside) its team's home base.
  _domPlaceAtHome(snake) {
    const home = this.zones.find(z => z.type === ZONE_HOME && z.homeTeam === snake.teamId);
    let cx, cy;
    if (home) {
      const a = Math.random()*Math.PI*2, r = Math.random()*home.radius*0.55;
      cx = home.x + Math.cos(a)*r; cy = home.y + Math.sin(a)*r;
    } else { const p = this._uniformPos(500); cx = p.x; cy = p.y; }
    const angle = Math.atan2(-cy, -cx); // face toward the middle of the map
    snake.angle = snake.targetAngle = angle;
    snake.segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++)
      snake.segments.push({ x: cx - Math.cos(angle)*i*SEGMENT_SPACING, y: cy - Math.sin(angle)*i*SEGMENT_SPACING });
  }

  // Assign a domination bot to the smallest team, give it a random role, and
  // drop it at that team's home base.
  _domBotJoin(snake) {
    let minTeam = 0, minSize = Infinity;
    for (const [id, t] of this.teams) if (t.memberIds.size < minSize) { minSize = t.memberIds.size; minTeam = id; }
    snake.teamId = minTeam;
    this.teams.get(minTeam).memberIds.add(snake.id);
    snake.role = Math.floor(Math.random()*4);
    // Half the squad keeps sharp reflexes; the other half reacts later, so a
    // well-timed cut-off actually lands. Keeps fights winnable without making
    // bots suicidal.
    snake.evasion = Math.random() < 0.5 ? 1 : 0.6;
    this._domPlaceAtHome(snake);
  }

  // Is this snake standing inside its own (protected) home base?
  _domInOwnHome(snake) {
    if (!snake || snake.teamId < 0 || snake.segments.length === 0) return false;
    const home = this.zones.find(z => z.type === ZONE_HOME && z.homeTeam === snake.teamId);
    if (!home) return false;
    const h = snake.segments[0], dx = h.x - home.x, dy = h.y - home.y;
    return dx*dx + dy*dy < home.radius*home.radius;
  }

  // Union-find over same-owner adjacency → Map<zoneId, size of its connected group>.
  _domConnectionGroups() {
    const parent = new Map();
    for (const z of this.zones) parent.set(z.id, z.id);
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    for (const z of this.zones) {
      if (z.owner < 0) continue;
      for (const nId of z.adj) {
        const n = this.zones[nId];
        if (n && n.owner === z.owner) { const ra = find(z.id), rb = find(nId); if (ra !== rb) parent.set(ra, rb); }
      }
    }
    const size = new Map();
    for (const z of this.zones) { if (z.owner < 0) continue; const r = find(z.id); size.set(r, (size.get(r)||0) + 1); }
    const out = new Map();
    for (const z of this.zones) { if (z.owner < 0) continue; out.set(z.id, size.get(find(z.id)) || 1); }
    return out;
  }

  _domRotateHotspots(now) {
    for (const z of this.zones) z.hotspotUntil = 0;
    const pool = this.zones.filter(z => z.type !== ZONE_HOME);
    const until = now + DOM_HOTSPOT_DURATION_MS;
    for (let i = 0; i < DOM_HOTSPOT_COUNT && pool.length; i++) {
      const idx = Math.floor(Math.random()*pool.length);
      pool.splice(idx, 1)[0].hotspotUntil = until;
    }
    this.broadcastDominationState();
  }

  _domStartEvent(type, now) {
    this.domEvent = { type, until: now + DOM_EVENT_DURATION_MS };
    if (type === 'foodstorm') {
      this.domStormUntil = now + DOM_EVENT_DURATION_MS;
      const cap = MAX_FOOD + DOM_FOODSTORM_BURST;
      for (let i = 0; i < DOM_FOODSTORM_BURST && this.food.length < cap; i++) this.food.push(this._createFood());
    } else if (type === 'relocation') {
      this._domRelocateZones();
    }
    this.broadcastDominationEvent(type);
  }

  _domRelocateZones() {
    // Shuffle the contestable board: move every non-home, non-VIP zone to a
    // fresh spot and reset it to neutral. Homes & the VIP hold position. New
    // positions are spaced so no two zones ever overlap (rejection sampling).
    const placed = this.zones.filter(z => z.type === ZONE_HOME || z.type === ZONE_VIP);
    const GAP = 320; // clear space between zone edges
    for (const z of this.zones) {
      if (z.type === ZONE_HOME || z.type === ZONE_VIP) continue;
      let bestX = z.x, bestY = z.y, bestSep = -Infinity;
      for (let attempt = 0; attempt < 60; attempt++) {
        const p = this._uniformPos(z.radius + 200);
        let minSep = Infinity;
        for (const o of placed) {
          const dx = p.x - o.x, dy = p.y - o.y;
          const sep = Math.sqrt(dx*dx + dy*dy) - o.radius - z.radius; // edge-to-edge gap
          if (sep < minSep) minSep = sep;
        }
        if (minSep > bestSep) { bestSep = minSep; bestX = p.x; bestY = p.y; }
        if (minSep >= GAP) break; // good enough — clear of every other zone
      }
      z.x = Math.round(bestX); z.y = Math.round(bestY);
      z.owner = -1; z.progress = 0; z.level = 0; z.holdTime = 0; z.capturingTeam = -1;
      z.coreOffline = false; z.coreSab = 0; z.hotspotUntil = 0; z.defendGraceUntil = 0;
      placed.push(z);
    }
    this._domComputeAdjacency();
    this.domLayoutVersion++;
    this.broadcastDominationLayout();
  }

  _domResetRound(now) {
    for (const [, t] of this.teams) { t.domScore = 0; t.resources = 0; }
    this.domState = 'active';
    this.domRoundStart = now; this.domRoundEnd = now + DOM_ROUND_MS;
    this.domEndTime = 0; this.domWinnerTeam = -1;
    this.domEvent = null; this.domOvertime = false; this.domStormUntil = 0;
    this.domNextEventAt = now + DOM_EVENT_PERIOD_MS;
    this.domNextHotspotAt = now + DOM_HOTSPOT_PERIOD_MS;
    this._domBuildZones();
    this.domLayoutVersion++;
    this.broadcastDominationLayout();
    this.broadcastDominationState();
    console.log(`[${this.name}] Zone Domination round reset`);
  }

  _domTick(now, dt) {
    if (this.mode !== 'domination') return;

    // ---- Round lifecycle ----
    if (this.domState === 'ended') {
      if (now - this.domEndTime > DOM_END_HOLD_MS) this._domResetRound(now);
      return;
    }
    if (!this.domOvertime && now >= this.domRoundEnd - DOM_OVERTIME_MS) {
      this.domOvertime = true;
      this.domEvent = { type: 'overtime', until: this.domRoundEnd };
      this.broadcastDominationEvent('overtime');
    }
    if (now >= this.domRoundEnd) {
      let best = -Infinity, bestTeam = -1;
      for (const [tid, t] of this.teams) if (t.domScore > best) { best = t.domScore; bestTeam = tid; }
      this.domWinnerTeam = bestTeam;
      this.domState = 'ended';
      this.domEndTime = now;
      this.domEvent = null;
      this.broadcastDominationState();
      return;
    }

    // ---- Hotspot rotation & global events ----
    if (now >= this.domNextHotspotAt) { this._domRotateHotspots(now); this.domNextHotspotAt = now + DOM_HOTSPOT_PERIOD_MS; }
    if (this.domEvent && this.domEvent.type !== 'overtime' && now >= this.domEvent.until) this.domEvent = null;
    if (!this.domOvertime && !this.domEvent && now >= this.domNextEventAt) {
      this._domStartEvent(DOM_EVENT_TYPES[Math.floor(Math.random()*DOM_EVENT_TYPES.length)], now);
      this.domNextEventAt = now + DOM_EVENT_PERIOD_MS;
    }

    const pointMult = this.domOvertime ? 3 : (this.domEvent && this.domEvent.type === 'doublepoints' ? 2 : 1);
    const captureMult = this.domOvertime ? 1.5 : 1;
    const groupSize = this._domConnectionGroups();

    for (const z of this.zones) {
      // --- Tally team capture weights from alive heads inside the zone ---
      const weight = new Map();
      const defenders = new Set();
      let ownerPresent = false, enemyPresent = false;
      const r2 = z.radius*z.radius;
      for (const [, s] of this.snakes) {
        if (!s.alive || s.teamId < 0 || s.segments.length === 0) continue;
        const h = s.segments[0], dx = h.x - z.x, dy = h.y - z.y;
        if (dx*dx + dy*dy > r2) continue;
        weight.set(s.teamId, (weight.get(s.teamId)||0) + (ROLE_CAPTURE_WEIGHT[s.role] ?? 1.0));
        if (s.role === ROLE_DEFENDER) defenders.add(s.teamId);
        if (z.owner >= 0) { if (s.teamId === z.owner) ownerPresent = true; else enemyPresent = true; }
      }

      // --- Cores: enemies disable, owners repair ---
      if (z.hasCore && z.owner >= 0) {
        if (enemyPresent && !ownerPresent) {
          z.coreSab = Math.min(1, z.coreSab + dt / DOM_CORE_DISABLE_SEC);
          if (z.coreSab >= 1) z.coreOffline = true;
        } else if (ownerPresent && !enemyPresent && z.coreSab > 0) {
          z.coreSab = Math.max(0, z.coreSab - dt / DOM_CORE_REPAIR_SEC);
          if (z.coreSab <= 0) z.coreOffline = false;
        }
      }

      // A Defender of the owner keeps the zone locked for a grace window even
      // after stepping out, rewarding stationing one to hold ground.
      if (z.owner >= 0 && ownerPresent && defenders.has(z.owner)) z.defendGraceUntil = now + DOM_DEFENDER_GRACE_MS;
      // While ANY owning-team player is in the zone (or a Defender's grace is
      // active), it is LOCKED — enemies cannot neutralize or capture it at all.
      const locked = z.owner >= 0 && (ownerPresent || now < (z.defendGraceUntil || 0));

      if (z.type === ZONE_HOME) {
        z.owner = z.homeTeam; z.progress = 100; z.level = Math.max(1, z.level);
      } else if (locked) {
        z.progress = 100; z.capturingTeam = -1; z.holdTime += dt;
        const tgt = Math.min(DOM_MAX_LEVEL, 1 + Math.floor(z.holdTime / DOM_LEVEL_HOLD_SEC));
        if (tgt > z.level) z.level = tgt;
      } else {
        // Owner not present (or neutral). Resolve among present teams.
        let topTeam = -1, topW = 0, second = 0, present = 0;
        for (const [tid, w] of weight) { present++; if (w > topW) { second = topW; topW = w; topTeam = tid; } else if (w > second) second = w; }
        const contested = present > 1 && (topW - second) < 0.5;

        if (topTeam < 0) {
          if (z.owner < 0) { z.progress = Math.max(0, z.progress - DOM_DECAY_RATE*dt); if (z.progress <= 0) z.capturingTeam = -1; }
          else {
            // Owned & unattended — keeps holding and levels up passively over time.
            z.holdTime += dt;
            const tgt = Math.min(DOM_MAX_LEVEL, 1 + Math.floor(z.holdTime / DOM_LEVEL_HOLD_SEC));
            if (tgt > z.level) z.level = tgt;
          }
        } else if (contested) {
          if (z.owner < 0) z.progress = Math.max(0, z.progress - DOM_DECAY_RATE*0.5*dt);
        } else if (z.owner < 0) {
          // Neutral → capture toward topTeam. More friendly players = more topW = faster.
          z.capturingTeam = topTeam;
          z.progress += DOM_CAPTURE_RATE * topW * captureMult * dt;
          if (z.progress >= 100) { z.owner = topTeam; z.progress = 100; z.level = 1; z.holdTime = 0; z.coreOffline = false; z.coreSab = 0; z.defendGraceUntil = 0; }
        } else if (!z.hasCore || z.coreOffline) {
          // Enemy-owned, owner absent, core down/none → neutralize toward 0 first,
          // then it flips neutral and the same team can recapture it.
          z.progress -= DOM_NEUTRALIZE_RATE * topW * captureMult * dt;
          z.capturingTeam = topTeam;
          if (z.progress <= 0) { z.owner = -1; z.progress = 0; z.level = 0; z.holdTime = 0; z.coreOffline = false; z.coreSab = 0; z.defendGraceUntil = 0; }
        } else {
          // Fortified: an intact core shields the zone — sabotage it first (core block).
          z.capturingTeam = topTeam;
        }
      }

      // --- Point + resource generation ---
      if (z.owner >= 0 && !z.coreOffline) {
        const team = this.teams.get(z.owner);
        if (team) {
          const connMult = 1 + DOM_CONN_MULT * ((groupSize.get(z.id) || 1) - 1);
          const hot = now < z.hotspotUntil ? DOM_HOTSPOT_MULT : 1;
          const lvl = z.type === ZONE_HOME ? 1 : Math.max(1, z.level);
          const base = z.type === ZONE_VIP ? DOM_VIP_POINTS
                     : z.type === ZONE_HOME ? DOM_HOME_POINTS
                     : z.type === ZONE_RESOURCE ? DOM_RESOURCE_POINTS : DOM_BASE_POINTS;
          team.domScore += base * lvl * connMult * hot * pointMult * dt;
          if (z.type === ZONE_RESOURCE) team.resources += DOM_RESOURCE_RATE * lvl * dt;
        }
      }
    }

    // ---- Team economy: resources trickle into score ----
    for (const [, t] of this.teams) {
      if (t.resources > 0) {
        const conv = Math.min(t.resources, DOM_RES_CONVERT_RATE * dt);
        t.resources -= conv;
        t.domScore += conv * DOM_RES_CONVERT_VALUE * pointMult;
      }
    }
  }

  // ---- Domination broadcasts (JSON text frames — rich, low-frequency state) ----
  _domLayoutPayload() {
    return {
      t: 'domLayout',
      v: this.domLayoutVersion,
      mapW: this.mapHalfW * 2, mapH: this.mapHalfH * 2,
      roundMs: DOM_ROUND_MS,
      teams: [...this.teams.entries()].map(([id, t]) => ({ id, name: t.name, color: t.color })),
      zones: this.zones.map(z => ({ id: z.id, x: z.x, y: z.y, r: z.radius, type: z.type, home: z.homeTeam, core: z.hasCore ? 1 : 0, adj: z.adj })),
    };
  }
  _sendDominationLayout(ws) {
    if (this.mode !== 'domination' || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(this._domLayoutPayload()));
  }
  broadcastDominationLayout() {
    if (this.mode !== 'domination') return;
    const s = JSON.stringify(this._domLayoutPayload());
    for (const [ws] of this.clients) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }
  broadcastDominationState() {
    if (this.mode !== 'domination') return;
    const now = Date.now();
    const grp = this._domConnectionGroups();
    const payload = {
      t: 'domState',
      state: this.domState,
      timeLeft: Math.max(0, this.domRoundEnd - now),
      endLeft: this.domState === 'ended' ? Math.max(0, this.domEndTime + DOM_END_HOLD_MS - now) : 0,
      overtime: this.domOvertime,
      winner: this.domWinnerTeam,
      event: this.domEvent ? { type: this.domEvent.type, left: Math.max(0, this.domEvent.until - now) } : null,
      teams: [...this.teams.entries()].map(([id, t]) => ({ id, score: Math.round(t.domScore), res: Math.round(t.resources) })),
      zones: this.zones.map(z => ({
        id: z.id, o: z.owner, p: Math.round(z.progress), l: z.level, cap: z.capturingTeam,
        core: z.hasCore ? (z.coreOffline ? 2 : (z.coreSab > 0.05 ? 1 : 0)) : 0,
        hot: now < z.hotspotUntil ? 1 : 0,
        grp: grp.get(z.id) || (z.owner >= 0 ? 1 : 0),
      })),
    };
    const s = JSON.stringify(payload);
    for (const [ws] of this.clients) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }
  broadcastDominationEvent(type) {
    if (this.mode !== 'domination') return;
    const s = JSON.stringify({ t: 'domEvent', type, dur: type === 'overtime' ? DOM_OVERTIME_MS : DOM_EVENT_DURATION_MS });
    for (const [ws] of this.clients) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }

  // =====================================================
  // CAPTURE THE ORB
  // =====================================================
  _ctfBase(team) { return this.ctfBases[team] || this.ctfBases[0]; }
  _ctfEnemyTeam(team) { return team === 0 ? 1 : 0; }

  _ctfPlaceAtBase(snake) {
    const base = this._ctfBase(snake.teamId);
    const a = Math.random()*Math.PI*2, r = Math.random()*base.radius*0.5;
    const cx = base.x + Math.cos(a)*r, cy = base.y + Math.sin(a)*r;
    const angle = Math.atan2(-cy, -cx); // face the middle of the map
    snake.angle = snake.targetAngle = angle;
    snake.segments = [];
    for (let i = 0; i < INITIAL_LENGTH; i++)
      snake.segments.push({ x: cx - Math.cos(angle)*i*SEGMENT_SPACING, y: cy - Math.sin(angle)*i*SEGMENT_SPACING });
  }

  _ctfInOwnBase(snake) {
    if (!snake || snake.teamId < 0 || snake.segments.length === 0) return false;
    const base = this._ctfBase(snake.teamId);
    const h = snake.segments[0], dx = h.x - base.x, dy = h.y - base.y;
    return dx*dx + dy*dy < base.radius*base.radius;
  }

  _ctfBotJoin(snake) {
    let minTeam = 0, minSize = Infinity;
    for (const [id, t] of this.teams) if (t.memberIds.size < minSize) { minSize = t.memberIds.size; minTeam = id; }
    snake.teamId = minTeam;
    this.teams.get(minTeam).memberIds.add(snake.id);
    snake.ctfRole = Math.random() < 0.5 ? 'attack' : 'defend';
    snake.evasion = Math.random() < 0.5 ? 1 : 0.6; // half easier to KO, as in domination
    this._ctfPlaceAtBase(snake);
  }

  // Nearest alive snake head within pickup range of an orb (or null).
  _ctfHeadTouching(orb) {
    let best = null, bd2 = CTF_PICKUP_R*CTF_PICKUP_R;
    for (const [, s] of this.snakes) {
      if (!s.alive || s.teamId < 0 || s.segments.length === 0) continue;
      const h = s.segments[0], dx = h.x - orb.x, dy = h.y - orb.y, d2 = dx*dx + dy*dy;
      if (d2 < bd2) { bd2 = d2; best = s; }
    }
    return best;
  }

  _ctfReturnOrb(orb, reason, bySnake) {
    orb.state = 'base'; orb.holder = null; orb.x = orb.baseX; orb.y = orb.baseY; orb.droppedAt = 0;
    if (reason === 'recover' || reason === 'timeout') this.broadcastCtfEvent('return', orb.team, bySnake ? bySnake.name : '');
  }

  // Drop any orb carried by snake `id` (called from killSnake before removal).
  _ctfDropOrbsHeldBy(id, snake) {
    if (this.mode !== 'ctf') return;
    for (const orb of this.ctfOrbs) {
      if (orb.holder === id) {
        orb.state = 'dropped'; orb.holder = null; orb.droppedAt = Date.now();
        if (snake && snake.segments.length) { orb.x = snake.segments[0].x; orb.y = snake.segments[0].y; }
        this.broadcastCtfEvent('drop', orb.team, snake ? snake.name : '');
      }
    }
  }

  _ctfScore(carrier) {
    const team = this.teams.get(carrier.teamId);
    if (team) team.ctfScore = (team.ctfScore || 0) + 1;
    carrier.kills++; // counts toward personal stats
    this.broadcastCtfEvent('capture', carrier.teamId, carrier.name);
    for (const orb of this.ctfOrbs) this._ctfReturnOrb(orb, 'reset');
    if (team && (team.ctfScore || 0) >= CTF_CAPTURES_TO_WIN) this._ctfEndRound(Date.now(), carrier.teamId);
    else this.broadcastCtfState();
  }

  _ctfEndRound(now, winnerTeam) {
    if (winnerTeam === undefined) {
      let bt = -1, best = -Infinity;
      for (const [tid, t] of this.teams) if ((t.ctfScore || 0) > best) { best = t.ctfScore || 0; bt = tid; }
      let maxCount = 0; for (const [, t] of this.teams) if ((t.ctfScore || 0) === best) maxCount++;
      winnerTeam = maxCount > 1 ? -1 : bt;
    }
    this.ctfWinnerTeam = winnerTeam;
    this.ctfState = 'ended'; this.ctfEndTime = now;
    this.broadcastCtfState();
  }

  _ctfResetRound(now) {
    for (const [, t] of this.teams) t.ctfScore = 0;
    this.ctfState = 'active'; this.ctfRoundStart = now; this.ctfRoundEnd = now + CTF_ROUND_MS;
    this.ctfEndTime = 0; this.ctfWinnerTeam = -1;
    for (const orb of this.ctfOrbs) this._ctfReturnOrb(orb, 'reset');
    this.broadcastCtfState();
    console.log(`[${this.name}] Capture the Orb round reset`);
  }

  _ctfTick(now, dt) {
    if (this.mode !== 'ctf') return;
    if (this.ctfState === 'ended') {
      if (now - this.ctfEndTime > CTF_END_HOLD_MS) this._ctfResetRound(now);
      return;
    }
    if (now >= this.ctfRoundEnd) { this._ctfEndRound(now); return; }

    for (const orb of this.ctfOrbs) {
      if (orb.state === 'carried') {
        const carrier = this.snakes.get(orb.holder);
        if (!carrier || !carrier.alive || carrier.teamId === orb.team || carrier.segments.length === 0) {
          orb.state = 'dropped'; orb.holder = null; orb.droppedAt = now;
          continue;
        }
        const hh = carrier.segments[0];
        orb.x = hh.x; orb.y = hh.y;
        // Deliver: reach your own base while your own orb is safely home.
        const myBase = this._ctfBase(carrier.teamId);
        const ownOrb = this.ctfOrbs[carrier.teamId];
        const dx = hh.x - myBase.x, dy = hh.y - myBase.y;
        if (dx*dx + dy*dy <= CTF_SCORE_R*CTF_SCORE_R && ownOrb.state === 'base') {
          this._ctfScore(carrier);
          return; // orbs reset this frame
        }
      } else if (orb.state === 'dropped') {
        if (now - orb.droppedAt > CTF_RETURN_SEC*1000) { this._ctfReturnOrb(orb, 'timeout'); continue; }
        const picker = this._ctfHeadTouching(orb);
        if (picker) {
          if (picker.teamId === orb.team) this._ctfReturnOrb(orb, 'recover', picker); // own team taps it home
          else { orb.state = 'carried'; orb.holder = picker.id; this.broadcastCtfEvent('steal', orb.team, picker.name); }
        }
      } else { // 'base'
        const picker = this._ctfHeadTouching(orb);
        if (picker && picker.teamId !== orb.team) { orb.state = 'carried'; orb.holder = picker.id; this.broadcastCtfEvent('steal', orb.team, picker.name); }
      }
    }
  }

  // CTF bot behavior: carry→deliver, recover a loose own-orb, else attack/defend.
  _ctfBotObjective(s) {
    if (this.mode !== 'ctf' || s.teamId < 0 || s.segments.length === 0) return false;
    const h = s.segments[0];
    const myOrb = this.ctfOrbs[s.teamId];
    const enemyOrb = this.ctfOrbs[this._ctfEnemyTeam(s.teamId)];
    const myBase = this._ctfBase(s.teamId);
    let tx, ty;
    if (enemyOrb.holder === s.id) { tx = myBase.x; ty = myBase.y; }      // carrying → run it home
    else if (myOrb.state !== 'base') { tx = myOrb.x; ty = myOrb.y; }      // our orb loose → all hands recover/chase
    else if (s.ctfRole === 'defend') { tx = myOrb.x; ty = myOrb.y; }      // guard our pedestal
    else { tx = enemyOrb.x; ty = enemyOrb.y; }                            // attack → go grab theirs
    s.targetAngle = Math.atan2(ty - h.y, tx - h.x);
    s.boosting = false;
    return true;
  }

  // ---- CTF broadcasts (JSON text frames) ----
  _ctfLayoutPayload() {
    return {
      t: 'ctfLayout', mapW: this.mapHalfW*2, mapH: this.mapHalfH*2,
      roundMs: CTF_ROUND_MS, capturesToWin: CTF_CAPTURES_TO_WIN,
      teams: [...this.teams.entries()].map(([id, t]) => ({ id, name: t.name, color: t.color })),
      bases: this.ctfBases.map(b => ({ team: b.team, x: b.x, y: b.y, r: b.radius })),
    };
  }
  _sendCtfLayout(ws) { if (this.mode === 'ctf' && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(this._ctfLayoutPayload())); }
  broadcastCtfState() {
    if (this.mode !== 'ctf') return;
    const now = Date.now();
    const payload = {
      t: 'ctfState', state: this.ctfState,
      timeLeft: Math.max(0, this.ctfRoundEnd - now),
      endLeft: this.ctfState === 'ended' ? Math.max(0, this.ctfEndTime + CTF_END_HOLD_MS - now) : 0,
      winner: this.ctfWinnerTeam, capturesToWin: CTF_CAPTURES_TO_WIN,
      teams: [...this.teams.entries()].map(([id, t]) => ({ id, score: t.ctfScore || 0 })),
      orbs: this.ctfOrbs.map(o => ({
        team: o.team, state: o.state, x: Math.round(o.x), y: Math.round(o.y), holder: o.holder || 0,
        returnIn: o.state === 'dropped' ? Math.max(0, CTF_RETURN_SEC*1000 - (now - o.droppedAt)) : 0,
      })),
    };
    const s = JSON.stringify(payload);
    for (const [ws] of this.clients) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }
  broadcastCtfEvent(type, team, byName) {
    if (this.mode !== 'ctf') return;
    const s = JSON.stringify({ t: 'ctfEvent', type, team, by: byName || '' });
    for (const [ws] of this.clients) if (ws.readyState === WebSocket.OPEN) ws.send(s);
  }

  // --- BATTLE ROYALE lifecycle ---
  _royaleTick(now, dt) {
    if (this.mode !== 'royale') return;

    if (this.royaleState === 'countdown') {
      if (now >= this.royaleJoinDeadline) {
        // Seal the room: lock joins, start match
        this.royaleState = 'active';
        this.royaleMatchStart = now;
        this.royalePhaseIndex = -1;
        this.royalePhaseStart = now;
        this.zone.cx = 0; this.zone.cy = 0;
        this.zone.radius = this.royaleInitialRadius;
        this.zone.prevRadius = this.royaleInitialRadius;
        this.zone.targetRadius = this.royaleInitialRadius;
        this.zone.damage = 0;
        // Broadcast "match start"
        const buf = Buffer.alloc(2); buf[0]=0x0A; buf[1]=1;
        this.broadcast(buf);
        console.log(`[${this.name}] BATTLE ROYALE match started with ${this.realPlayerCount} humans, ${this.bots.length} bots`);
      }
    }

    if (this.royaleState === 'active') {
      // Advance phases on a timer
      if (this.royalePhaseIndex < 0) {
        this.royalePhaseIndex = 0;
        this.royalePhaseStart = now;
        const p = this.royalePhases[0];
        this.zone.targetRadius = p.radius;
        this.zone.damage = p.damage;
      }
      const phase = this.royalePhases[this.royalePhaseIndex];
      if (phase) {
        const elapsed = (now - this.royalePhaseStart) / 1000;
        const totalPhaseTime = phase.hold + phase.shrinkTime;
        if (elapsed >= phase.hold && elapsed <= totalPhaseTime) {
          const shrinkT = (elapsed - phase.hold) / phase.shrinkTime;
          this.zone.radius = this.zone.prevRadius + (phase.radius - this.zone.prevRadius) * shrinkT;
        } else if (elapsed > totalPhaseTime) {
          this.zone.radius = phase.radius;
          this.zone.prevRadius = phase.radius;
          this.royalePhaseIndex++;
          this.royalePhaseStart = now;
          const next = this.royalePhases[this.royalePhaseIndex];
          if (next) {
            this.zone.targetRadius = next.radius;
            this.zone.damage = next.damage;
          }
        }
      }

      // Apply zone damage (drains score while outside)
      for (const [, s] of this.snakes) {
        if (!s.alive) continue;
        const h = s.segments[0];
        const dx = h.x - this.zone.cx, dy = h.y - this.zone.cy;
        if (dx*dx + dy*dy > this.zone.radius * this.zone.radius) {
          s.zoneDamageAccum = (s.zoneDamageAccum || 0) + this.zone.damage * dt;
          if (s.zoneDamageAccum >= 1) {
            const rm = Math.floor(s.zoneDamageAccum);
            s.zoneDamageAccum -= rm;
            s.score = Math.max(0, s.score - rm);
            if (s.score <= 0) {
              // Score reached zero in zone — die
              this.killSnake(s.id, null, true);
            }
          }
        } else {
          s.zoneDamageAccum = 0;
        }
      }

      // Win condition: 1 or 0 humans + bots alive — keep going if many bots; but
      // call it when only one snake remains alive
      const aliveSnakes = Array.from(this.snakes.values()).filter(s => s.alive);
      if (aliveSnakes.length <= 1) {
        this.royaleState = 'ended';
        this.royaleEndTime = now;
        if (aliveSnakes.length === 1) {
          this.royaleWinnerId = aliveSnakes[0].id;
          this.royaleWinnerName = aliveSnakes[0].name;
        } else {
          this.royaleWinnerId = null;
          this.royaleWinnerName = '';
        }
        // Broadcast winner: [0x0B][winnerId u16][nameLen u8][name]
        const nameBytes = Buffer.from(this.royaleWinnerName || 'No one', 'utf8');
        const buf = Buffer.alloc(4 + nameBytes.length);
        buf[0] = 0x0B;
        buf.writeUInt16LE(this.royaleWinnerId || 0, 1);
        buf[3] = nameBytes.length;
        nameBytes.copy(buf, 4);
        this.broadcast(buf);
      }
    }

    if (this.royaleState === 'ended') {
      if (now - this.royaleEndTime > ROYALE_END_HOLD_MS) {
        this._royaleResetRound();
      }
    }
  }

  _royaleResetRound() {
    // Reset everything for a fresh round
    for (const [, s] of this.snakes) s.alive = false;
    this.snakes.clear();
    this.bots = [];
    this.food = [];
    this.megaOrbs = [];
    this.spawnFood();
    this.spawnMegaOrbs();
    this.spawnBots(ROYALE_MAX_PLAYERS); // fill with bots initially
    // Re-seat connected clients with fresh snakes
    const stillConnected = Array.from(this.clients.keys());
    this.clients.clear();
    this.disconnected.clear();
    for (const ws of stillConnected) {
      if (ws.readyState !== 1) continue;
      const info = ws._joinInfo;
      if (!info) continue;
      // Re-trigger join flow
      this.playerJoin(ws, info.name, info.skinIdx, info.teamId, info.accessory);
    }
    this.royaleState = this.realPlayerCount > 0 ? 'countdown' : 'lobby';
    this.royaleJoinDeadline = this.royaleState === 'countdown'
      ? Date.now() + ROYALE_JOIN_WINDOW_MS : 0;
    this.royalePhaseIndex = -1;
    this.royaleWinnerId = null;
    this.royaleWinnerName = '';
    this.zone.cx = 0; this.zone.cy = 0;
    this.zone.radius = this.royaleInitialRadius;
    this.zone.prevRadius = this.royaleInitialRadius;
    this.zone.targetRadius = this.royaleInitialRadius;
    this.zone.damage = 0;
    console.log(`[${this.name}] BR round reset → ${this.royaleState}`);
  }

  // Broadcast royale state to all clients (periodic, ~5 Hz)
  broadcastRoyaleState() {
    if (this.mode !== 'royale') return;
    const now = Date.now();
    let countdownMs = 0;
    if (this.royaleState === 'countdown') {
      countdownMs = Math.max(0, this.royaleJoinDeadline - now);
    }
    let endMs = 0;
    if (this.royaleState === 'ended') {
      endMs = Math.max(0, this.royaleEndTime + ROYALE_END_HOLD_MS - now);
    }
    // [0x08][state u8][countdownMs u16][endMs u16][zoneRadius u16][zoneTarget u16]
    //       [damage u8][aliveCount u8][winnerId u16][nameLen u8][name]
    const stateMap = { lobby: 0, countdown: 1, active: 2, ended: 3 };
    const stateByte = stateMap[this.royaleState] ?? 0;
    const winName = this.royaleWinnerName || '';
    const nb = Buffer.from(winName, 'utf8');
    const buf = Buffer.alloc(16 + nb.length);
    let off = 0;
    buf[off++] = 0x08;
    buf[off++] = stateByte;
    buf.writeUInt16LE(Math.min(65535, Math.max(0, Math.floor(countdownMs))), off); off += 2;
    buf.writeUInt16LE(Math.min(65535, Math.max(0, Math.floor(endMs))), off); off += 2;
    buf.writeUInt16LE(Math.min(65535, Math.round(this.zone.radius)), off); off += 2;
    buf.writeUInt16LE(Math.min(65535, Math.round(this.zone.targetRadius)), off); off += 2;
    buf[off++] = Math.min(255, this.zone.damage);
    const aliveCount = Array.from(this.snakes.values()).filter(s => s.alive).length;
    buf[off++] = Math.min(255, aliveCount);
    buf.writeUInt16LE(this.royaleWinnerId || 0, off); off += 2;
    buf[off++] = nb.length;
    nb.copy(buf, off); off += nb.length;
    this.broadcast(buf.slice(0, off));
  }

  // --- Main tick ---
  tick() {
    const now=Date.now();
    const dt=Math.min((now-this.lastTick)/1000,0.05);
    this.lastTick=now;
    this.tickCount++;
    this._royaleTick(now, dt);
    this._domTick(now, dt);
    this._ctfTick(now, dt);
    // Clean up disconnected snakes after 10 seconds
    for (const [name, snakeId] of this.disconnected) {
      const s = this.snakes.get(snakeId);
      if (!s || !s.alive) { this.disconnected.delete(name); continue; }
      if (now - s.disconnectTime > 10000) {
        this.disconnected.delete(name);
        if (s.teamId >= 0) { const t = this.teams.get(s.teamId); if (t) t.memberIds.delete(snakeId); }
        this.killSnake(snakeId, null, true);
      }
    }
    this.updateMegaOrbs(dt);
    for(const [,s] of this.snakes){if(s.isBot&&s.alive) this._botAI(s,dt);}
    this._buildFoodGrid();
    for(const [,s] of this.snakes){if(s.alive) this._updateSnake(s,dt);}
    this._checkCollisions();
    this.spawnFood(); this.spawnMegaOrbs();
    // Trim excess food from kill drops (cap lifts during a Food Storm)
    const foodCap=this._foodCap();
    while(this.food.length>foodCap) this.food.shift();
  }

  _updateSnake(snake,dt) {
    if(snake.invincible>0) snake.invincible=Math.max(0,snake.invincible-dt);
    let ad=snake.targetAngle-snake.angle;
    while(ad>Math.PI)ad-=Math.PI*2;while(ad<-Math.PI)ad+=Math.PI*2;
    if(Math.abs(ad)<9*dt)snake.angle=snake.targetAngle;else snake.angle+=Math.sign(ad)*9*dt;
    if(snake.boosting&&snake.score<=0)snake.boosting=false;
    const speed=snake.boosting?BOOST_SPEED:SNAKE_SPEED;
    const head=snake.segments[0];
    head.x+=Math.cos(snake.angle)*speed*dt;head.y+=Math.sin(snake.angle)*speed*dt;
    const halfW=this.mapHalfW,halfH=this.mapHalfH;
    if(head.x<-halfW||head.x>halfW||head.y<-halfH||head.y>halfH){this.killSnake(snake.id,null);return;}
    while(snake.segments.length>=2){
      const dx=head.x-snake.segments[1].x,dy=head.y-snake.segments[1].y;
      if(dx*dx+dy*dy<SEGMENT_SPACING**2)break;
      const dist=Math.sqrt(dx*dx+dy*dy),t=SEGMENT_SPACING/dist;
      snake.segments.splice(1,0,{x:snake.segments[1].x+dx*t,y:snake.segments[1].y+dy*t});
    }
    const tl=INITIAL_LENGTH+Math.floor(2.5*Math.sqrt(snake.score)+snake.score/60);
    while(snake.segments.length>tl)snake.segments.pop();
    if(snake.boosting&&snake.score>0){
      snake.boostAccum+=BOOST_SHRINK_RATE*dt;
      if(snake.boostAccum>=1){const rm=Math.floor(snake.boostAccum);snake.boostAccum-=rm;snake.score=Math.max(0,snake.score-rm);
        if(snake.segments.length>0){const tail=snake.segments[snake.segments.length-1];
          this.food.push({x:tail.x+(Math.random()-0.5)*14,y:tail.y+(Math.random()-0.5)*14,color:snake.color,radius:5+Math.random()*2,value:1,tier:0});}
      }
    }
    const headR=HEAD_RADIUS*this._thickness(snake),eatR=headR+30;
    const gx=Math.floor(head.x/500),gy=Math.floor(head.y/500);
    const eaten=[];let gained=0;
    for(let dx=-1;dx<=1;dx++){for(let dy=-1;dy<=1;dy++){
      const bucket=this.foodGrid.get((gx+dx)+','+(gy+dy));
      if(!bucket)continue;
      for(const idx of bucket){
        const f=this.food[idx];if(!f)continue;
        const fx=f.x-head.x;if(fx>eatR||fx<-eatR)continue;
        const fy=f.y-head.y;if(fy>eatR||fy<-eatR)continue;
        if(fx*fx+fy*fy<(headR+f.radius)**2){eaten.push(idx);const v=f.value||1;snake.score+=v;gained+=v;}
      }
    }}
    if(eaten.length){eaten.sort((a,b)=>b-a);for(const idx of eaten)this.food.splice(idx,1);}
    for(let i=this.megaOrbs.length-1;i>=0;i--){
      const m=this.megaOrbs[i],dx=head.x-m.x,dy=head.y-m.y;
      if(dx*dx+dy*dy<(headR+m.radius)**2){this.megaOrbs.splice(i,1);snake.score+=m.value;gained+=m.value;}
    }
    // Zone Domination — a Collector banks part of what it eats into the team
    // economy. Pure economy; the snake's own score/growth is unchanged.
    if(gained>0&&this.mode==='domination'&&snake.role===ROLE_COLLECTOR&&snake.teamId>=0){
      const team=this.teams.get(snake.teamId);
      if(team) team.resources+=gained*DOM_COLLECTOR_YIELD;
    }
  }

  updateMegaOrbs(dt) {
    const halfW=this.mapHalfW-50,halfH=this.mapHalfH-50;
    for(const m of this.megaOrbs){
      m.x+=m.vx*dt;m.y+=m.vy*dt;m.spin+=dt*1.5;
      if(m.x<-halfW){m.x=-halfW;m.vx=Math.abs(m.vx);}if(m.x>halfW){m.x=halfW;m.vx=-Math.abs(m.vx);}
      if(m.y<-halfH){m.y=-halfH;m.vy=Math.abs(m.vy);}if(m.y>halfH){m.y=halfH;m.vy=-Math.abs(m.vy);}
    }
  }

  _checkCollisions() {
    const arr=Array.from(this.snakes.values()).filter(s=>s.alive);
    for(let i=0;i<arr.length;i++){
      const a=arr[i];if(!a.alive)continue;
      if(a.invincible>0) continue; // spawn invincibility
      // Protected home base — a snake inside its own home/base can't be killed.
      if(this.mode==='domination'&&this._domInOwnHome(a)) continue;
      if(this.mode==='ctf'&&this._ctfInOwnBase(a)) continue;
      const ahead=a.segments[0],aHeadR=HEAD_RADIUS*this._thickness(a)*0.75;
      for(let j=0;j<arr.length;j++){
        if(i===j)continue;
        const b=arr[j];if(!b.alive)continue;
        if(b.invincible>0) continue;
        if((this.mode==='team'||this.mode==='domination'||this.mode==='ctf')&&a.teamId>=0&&a.teamId===b.teamId) continue;
        const bDotR=DOT_RADIUS*this._thickness(b)*0.75;
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
    // Self-coil trap removed — ray-casting through discrete body dots
    // (spaced 24px apart) caused too many false positives, killing
    // players who were just passing near a long snake.
  }

  // --- Bot AI ---
  // Returns true if the bot is fleeing the safe-zone edge (BR only)
  _fleeZoneIfNeeded(s) {
    if (this.mode !== 'royale' || this.royaleState !== 'active') return false;
    const h = s.segments[0];
    const dx = h.x - this.zone.cx, dy = h.y - this.zone.cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    // Start fleeing when within 250px of zone edge or already outside
    if (d > this.zone.radius - 250) {
      s.targetAngle = Math.atan2(this.zone.cy - h.y, this.zone.cx - h.x);
      s.boosting = d > this.zone.radius - 50 && s.score > 8;
      return true;
    }
    return false;
  }
  _botAI(s, dt) {
    // EMERGENCY collision check every frame, before the throttled
    // strategic AI runs. Catches imminent crashes that the planned heading
    // didn't anticipate (other snakes moved since last decision).
    if (this._emergencyAvoid(s, dt)) return;
    const isBR = this.mode === 'royale' && this.royaleState === 'active';
    const effSkill = isBR ? Math.min(SKILL_ADVANCED, s.skill + 1) : s.skill;
    if (effSkill === SKILL_ADVANCED) this._hardAI(s, dt);
    else if (effSkill === SKILL_AMATEUR) this._mediumAI(s, dt);
    else this._easyAI(s, dt);
  }

  _emergencyAvoid(s, dt) {
    const h = s.segments[0];
    const speed = s.boosting ? BOOST_SPEED : SNAKE_SPEED;
    // evasion < 1 → shorter look-ahead & tighter danger radius, so the bot
    // reacts later and is easier to cut off (used for "easier-to-KO" bots).
    const ev = s.evasion ?? 1;
    const lookAhead = speed * 0.18 * ev;
    const px = h.x + Math.cos(s.angle) * lookAhead;
    const py = h.y + Math.sin(s.angle) * lookAhead;
    const dangerR = (HEAD_RADIUS * this._thickness(s) + 22) * ev;
    const dangerR2 = dangerR * dangerR;
    let blocked = false, closestT = Infinity;
    for (const [, o] of this.snakes) {
      if (!o.alive) continue;
      const isSelf = o.id === s.id;
      const startK = isSelf ? 10 : 0;
      const checkLen = Math.min(o.segments.length, 60);
      for (let k = startK; k < checkLen; k++) {
        const seg = o.segments[k];
        const dx = seg.x - px, dy = seg.y - py;
        const d2 = dx*dx + dy*dy;
        if (d2 < dangerR2 && d2 < closestT) {
          blocked = true; closestT = d2;
        }
      }
      // Head-on detection
      if (!isSelf) {
        const oh = o.segments[0];
        const dx = oh.x - h.x, dy = oh.y - h.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 220 * ev) {
          const myDir = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
          const theirDir = { x: Math.cos(o.angle), y: Math.sin(o.angle) };
          const toThem = { x: dx / d, y: dy / d };
          const myDot = myDir.x * toThem.x + myDir.y * toThem.y;
          const theirDot = theirDir.x * (-toThem.x) + theirDir.y * (-toThem.y);
          if (myDot > 0.6 && theirDot > 0.6) blocked = true;
        }
      }
    }
    const wallW = this.mapHalfW - 80, wallH = this.mapHalfH - 80;
    if (Math.abs(px) > wallW || Math.abs(py) > wallH) blocked = true;
    const inBR = this.mode === 'royale' && this.royaleState === 'active';
    if (inBR) {
      const ddx = px - this.zone.cx, ddy = py - this.zone.cy;
      if (ddx*ddx + ddy*ddy > (this.zone.radius - 40) ** 2) blocked = true;
    }
    if (!blocked) return false;
    // Pick the clearest candidate heading
    const OFFSETS = [-2.0, -1.2, -0.55, 0, 0.55, 1.2, 2.0];
    let bestScore = -Infinity, bestAngle = s.angle;
    for (const dA of OFFSETS) {
      const testA = s.angle + dA;
      const tpx = h.x + Math.cos(testA) * lookAhead;
      const tpy = h.y + Math.sin(testA) * lookAhead;
      let minD2 = Infinity;
      for (const [, o] of this.snakes) {
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
      if (Math.abs(tpx) > wallW || Math.abs(tpy) > wallH) minD2 = Math.min(minD2, 100);
      if (inBR) {
        const ddx = tpx - this.zone.cx, ddy = tpy - this.zone.cy;
        if (ddx*ddx + ddy*ddy > (this.zone.radius - 40) ** 2) minD2 = Math.min(minD2, 100);
      }
      const score = minD2 - Math.abs(dA) * 1500;
      if (score > bestScore) { bestScore = score; bestAngle = testA; }
    }
    s.targetAngle = bestAngle;
    s.boosting = false;
    return true;
  }

  // Multi-angle forward lookahead. Scans 7 candidate headings (forward, ±25°,
  // ±55°, ±90°) and picks the clearest direction; returns true if forward is
  // blocked so the caller bails out.
  _steerAroundBodies(s, dangerR, lookAhead) {
    const h = s.segments[0];
    const OFFSETS = [0, -0.44, 0.44, -0.96, 0.96, -1.57, 1.57];
    let forwardD2 = Infinity, bestScore = -Infinity, bestAngle = s.angle;
    for (const dA of OFFSETS) {
      const testAngle = s.angle + dA;
      const px = h.x + Math.cos(testAngle) * lookAhead;
      const py = h.y + Math.sin(testAngle) * lookAhead;
      let minD2 = Infinity;
      for (const [, o] of this.snakes) {
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
      const turnPenalty = Math.abs(dA) * 4000;
      const score = minD2 - turnPenalty;
      if (score > bestScore) { bestScore = score; bestAngle = testAngle; }
    }
    if (forwardD2 < dangerR * dangerR) {
      s.targetAngle = bestAngle;
      return true;
    }
    return false;
  }

  // Crowd density probe — breaks off chases that would dogpile a single spot.
  _crowdedAt(x, y, radius, threshold = 3) {
    let count = 0;
    for (const [, o] of this.snakes) {
      if (!o.alive || o.segments.length === 0) continue;
      const dx = o.segments[0].x - x, dy = o.segments[0].y - y;
      if (dx*dx + dy*dy < radius * radius) {
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
  _bestFoodByValue(s, maxR) {
    const h = s.segments[0];
    let best = null, bestRatio = 0;
    for (const f of this.food) {
      const dx = f.x - h.x, dy = f.y - h.y;
      if (dx > maxR || dx < -maxR || dy > maxR || dy < -maxR) continue;
      const d = Math.sqrt(dx*dx + dy*dy) + 40;
      const tier = f.tier || 0;
      const tierBoost = tier >= 4 ? 2.2 : tier >= 2 ? 1.6 : 1.0;
      const ratio = ((f.value || 1) * tierBoost) / d;
      if (ratio > bestRatio) { bestRatio = ratio; best = f; }
    }
    return best;
  }

  // Zone Domination bot objective: head toward the most valuable contestable
  // zone for the team (neutral > enemy > repair own dark core > light patrol).
  // Called as the non-threat behavior so bots actually fight over territory;
  // they eat the (uniform) food they cross on the way. Returns true if it set a heading.
  _domSteerToObjective(s) {
    if (this.mode !== 'domination' || s.teamId < 0 || !this.zones || s.segments.length === 0) return false;
    const h = s.segments[0];
    let best = null, bestScore = -Infinity;
    for (const z of this.zones) {
      if (z.type === ZONE_HOME && z.homeTeam !== s.teamId) continue; // enemy home is protected — ignore
      const dx = z.x - h.x, dy = z.y - h.y;
      const d = Math.sqrt(dx*dx + dy*dy) + 1;
      const val = z.type === ZONE_VIP ? 3 : z.type === ZONE_RESOURCE ? 2 : z.type === ZONE_HOME ? 0.4 : 1;
      let want;
      if (z.owner < 0) want = 1.5 * val;                                   // neutral — claim it
      else if (z.owner !== s.teamId) want = 1.15 * val;                    // enemy-held — contest it
      else if (z.coreOffline) want = 1.7 * val;                            // our zone is dark — go repair
      else want = 0.18 * val;                                             // ours & healthy — light patrol
      // per-bot jitter so the whole team doesn't dogpile one zone
      const jitter = 0.8 + 0.4 * (((s.id * 2654435761) >>> 8) % 1000) / 1000;
      const score = want * jitter * 3200 / d;
      if (score > bestScore) { bestScore = score; best = z; }
    }
    if (!best) return false;
    const bdx = best.x - h.x, bdy = best.y - h.y;
    const bd = Math.sqrt(bdx*bdx + bdy*bdy);
    if (bd < best.r * 0.85) {
      // Already on the zone — loiter: chase a point that slowly orbits the centre
      // so the bot keeps occupying it (and finishes the capture) instead of
      // flying straight through and out the far side.
      const ang = this.tickCount * 0.045 + s.id;
      const px = best.x + Math.cos(ang) * best.r * 0.45;
      const py = best.y + Math.sin(ang) * best.r * 0.45;
      s.targetAngle = Math.atan2(py - h.y, px - h.x);
    } else {
      s.targetAngle = Math.atan2(bdy, bdx);
    }
    s.boosting = false;
    return true;
  }

  // EASY tier — wanders gently, picks nearest food, lookahead avoids most bodies.
  _easyAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.15 + Math.random() * 0.12;
    if (this._fleeZoneIfNeeded(s)) return;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._steerAroundBodies(s, 95, 170)) {
      s.boosting = false;
      return;
    }
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

  // MEDIUM tier — value-weighted food, mega orbs, threat flee, crowd skip.
  _mediumAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.09 + Math.random() * 0.06;
    if (this._fleeZoneIfNeeded(s)) return;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._steerAroundBodies(s, 110, 220)) {
      s.boosting = false;
      return;
    }
    // Flee any bigger snake's head
    for (const [, o] of this.snakes) {
      if (o.id === s.id || !o.alive) continue;
      const dx = o.segments[0].x - h.x, dy = o.segments[0].y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < 280 * 280 && o.score >= s.score * 0.85) {
        s.targetAngle = Math.atan2(-dy, -dx) + (Math.random() - 0.5) * 0.4;
        s.boosting = d2 < 160 * 160 && s.score > 12;
        return;
      }
    }
    // Mega orbs (skip dogpiles)
    let bm = null, bmd2 = 1300 * 1300;
    for (const m of this.megaOrbs) {
      const dx = m.x - h.x, dy = m.y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bmd2 && !this._crowdedAt(m.x, m.y, 350, 3)) { bmd2 = d2; bm = m; }
    }
    if (bm) {
      const bmd = Math.sqrt(bmd2);
      const t = bmd / SNAKE_SPEED;
      s.targetAngle = Math.atan2(bm.y + bm.vy * t - h.y, bm.x + bm.vx * t - h.x);
      s.boosting = bmd > 350 && bmd < 1100 && s.score > 20;
      return;
    }
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

  // HARD tier — predicts heads, cuts off smaller snakes, hunts mega orbs and
  // fat death piles, flees bigger threats with boost. Reacts every ~50ms.
  _hardAI(s, dt) {
    s.botTimer -= dt;
    if (s.botTimer > 0) return;
    s.botTimer = 0.05;
    if (this._fleeZoneIfNeeded(s)) return;
    const h = s.segments[0];
    const wallW = this.mapHalfW - 250, wallH = this.mapHalfH - 250;
    if (Math.abs(h.x) > wallW || Math.abs(h.y) > wallH) {
      s.targetAngle = Math.atan2(-h.y, -h.x);
      s.boosting = false;
      return;
    }
    if (this._steerAroundBodies(s, 125, 260)) {
      s.boosting = false;
      return;
    }
    // Threat / opportunity scan vs every other snake
    let bestPrey = null, bestPreyD2 = 600 * 600;
    for (const [, o] of this.snakes) {
      if (o.id === s.id || !o.alive) continue;
      const dx = o.segments[0].x - h.x, dy = o.segments[0].y - h.y;
      const d2 = dx*dx + dy*dy;
      // Flee bigger threats
      if (d2 < 320 * 320 && o.score >= s.score * 1.05) {
        s.targetAngle = Math.atan2(-dy, -dx) + (Math.random() < 0.5 ? -0.45 : 0.45);
        s.boosting = d2 < 200 * 200 && s.score > 12;
        return;
      }
      // Track potential prey
      if (o.score < s.score * 0.6 && d2 < bestPreyD2 &&
          !this._crowdedAt(o.segments[0].x, o.segments[0].y, 280, 2)) {
        bestPreyD2 = d2; bestPrey = o;
      }
    }
    // Mega orbs
    let bm = null, bmd2 = 1800 * 1800;
    for (const m of this.megaOrbs) {
      const dx = m.x - h.x, dy = m.y - h.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bmd2 && !this._crowdedAt(m.x, m.y, 350, 3)) { bmd2 = d2; bm = m; }
    }
    if (bm) {
      const bmd = Math.sqrt(bmd2);
      const t = bmd / SNAKE_SPEED;
      s.targetAngle = Math.atan2(bm.y + bm.vy * t - h.y, bm.x + bm.vx * t - h.x);
      s.boosting = bmd > 300 && bmd < 1400 && s.score > 18;
      return;
    }
    if (bestPrey) {
      const bpd = Math.sqrt(bestPreyD2);
      const lead = 0.5 + bpd / 320;
      const px = bestPrey.segments[0].x + Math.cos(bestPrey.angle) * SNAKE_SPEED * lead;
      const py = bestPrey.segments[0].y + Math.sin(bestPrey.angle) * SNAKE_SPEED * lead;
      s.targetAngle = Math.atan2(py - h.y, px - h.x);
      s.boosting = bpd > 180 && bpd < 450 && s.score > 30;
      return;
    }
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

  // --- Broadcasting ---
  broadcastState() {
    for(const [ws,playerId] of this.clients){
      if(ws.readyState!==WebSocket.OPEN)continue;
      const mySnake=this.snakes.get(playerId);
      if(!mySnake||!mySnake.alive)continue;
      const cx=mySnake.segments[0].x,cy=mySnake.segments[0].y;
      // Larger view range (scales with zoom-out for big snakes)
      let viewRange=1800+Math.min(Math.sqrt(mySnake.score)*8,800);
      // Scout role sees further — pure intel, no movement/growth boost.
      if(this.mode==='domination'&&mySnake.role===ROLE_SCOUT) viewRange+=750;
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
      // per snake: [id u16][skin u8][boosting u8][isBot u8][teamId i8][invincible u8][score u16][nameLen u8][name][segCount u16][segs]
      let totalSegs=0,totalNameBytes=0;
      for(const s of visSnakes){totalSegs+=s.segments.length;totalNameBytes+=Buffer.byteLength(s.name,'utf8');}
      const bufSize=1+2+visSnakes.length*(2+1+1+1+1+1+1+2+1+2)+totalNameBytes+totalSegs*4+2+visFood.length*7+2+visMega.length*7;
      const buf=Buffer.alloc(bufSize);
      let off=0;
      buf[off++]=0x01;buf.writeUInt16LE(visSnakes.length,off);off+=2;
      for(const snake of visSnakes){
        buf.writeUInt16LE(snake.id,off);off+=2;
        buf[off++]=snake.skin;buf[off++]=snake.boosting?1:0;buf[off++]=snake.isBot?1:0;
        buf.writeInt8(snake.teamId,off);off+=1;
        buf[off++]=snake.invincible>0?1:0;
        buf[off++]=snake.accessory||0;
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
    if (this.mode === 'domination' || this.mode === 'ctf') {
      // Team-score leaderboard: zone-control points (domination) or captures (CTF)
      entries = [];
      for (const [teamId, team] of this.teams) {
        let kills = 0;
        for (const sid of team.memberIds) { const s = this.snakes.get(sid); if (s && s.alive) kills += s.kills; }
        const score = this.mode === 'ctf' ? (team.ctfScore || 0) : Math.round(team.domScore);
        entries.push({ id: 60000 + teamId, score, name: team.name, isBot: false, teamId, kills });
      }
      entries.sort((a,b) => b.score - a.score);
    } else if (this.mode === 'team') {
      // Team leaderboard: combined score per team
      entries = [];
      for (const [teamId, team] of this.teams) {
        let totalScore = 0;
        for (const sid of team.memberIds) {
          const s = this.snakes.get(sid);
          if (s && s.alive) totalScore += s.score;
        }
        let totalKills = 0;
        for (const sid of team.memberIds) {
          const s = this.snakes.get(sid);
          if (s && s.alive) totalKills += s.kills;
        }
        entries.push({ id: 60000 + teamId, score: totalScore, name: team.name, isBot: false, teamId, kills: totalKills });
      }
      entries.sort((a,b) => b.score - a.score);
    } else {
      entries = Array.from(this.snakes.values())
        .filter(s=>s.alive).sort((a,b)=>b.score-a.score).slice(0,10)
        .map(s => ({ id: s.id, score: s.score, name: s.name, isBot: s.isBot, teamId: s.teamId, kills: s.kills }));
    }

    let size=2;
    for(const e of entries) size+=8+Buffer.byteLength(e.name,'utf8'); // +1 for kills byte
    const buf=Buffer.alloc(size);
    let off=0;
    buf[off++]=0x05;buf[off++]=entries.length;
    for(const e of entries){
      buf.writeUInt16LE(e.id,off);off+=2;
      buf.writeUInt16LE(Math.min(e.score,65535),off);off+=2;
      buf[off++]=e.isBot?1:0;
      buf[off++]=Math.min(e.kills||0,255);
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

    // Pre-created rooms — multiplayer is classic + team for now.
    // Battle Royale is AI-only on the client side (see Play vs AI mode toggle).
    // We'll re-enable multiplayer BR once the lobby/spectator UX is polished.
    this.createRoom('room-0', 'Free For All', { mode: 'solo' });
    this.createRoom('room-1', 'Neon Arena', { mode: 'solo' });
    this.createRoom('room-2', 'Team Battle', { mode: 'team', teamSize: 2, maxTeams: 8 });
    this.createRoom('room-3', 'Battle Royale', { mode: 'royale' });
    this.createRoom('room-4', 'Zone Domination', { mode: 'domination', numTeams: 2 });
    this.createRoom('room-5', 'Capture the Orb', { mode: 'ctf' });

    // noServer mode: upgrade routing is handled in index.js so multiple
    // games (snake, click-battle) can share one Render service.
    this.wss = new WebSocket.Server({ noServer: true });
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

  createCustomRoom(name, mode, teamSize, creatorName, royaleConfig, numTeams) {
    if (!['solo', 'team', 'royale', 'domination', 'ctf'].includes(mode)) mode = 'solo';
    const id = `custom-${this.nextCustomId++}`;
    const opts = {
      mode,
      teamSize: teamSize || 2,
      maxTeams: Math.floor(30/(teamSize||2)),
      numTeams: Math.max(2, Math.min(numTeams || DOM_TEAMS_DEFAULT, 4)),
      isCustom: true,
      creatorName,
      royaleConfig: royaleConfig || null,
    };
    const room = this.createRoom(id, name, opts);
    // Generate random 6-char alphanumeric room code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    room.code = code;
    return room;
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
      // Battle Royale: hide rooms that have sealed (joins refused once active)
      if (room.mode === 'royale' && !room._isRoyaleOpen()) continue;
      list.push({
        id, name: room.name, mode: room.mode,
        teamSize: room.teamSize,
        players: room.realPlayerCount,
        maxPlayers: room.mode === 'royale' ? ROYALE_MAX_PLAYERS : MAX_PLAYERS_PER_ROOM,
        isCustom: room.isCustom,
        creatorName: room.creatorName,
        code: room.code || null,
        royaleState: room.mode === 'royale' ? room.royaleState : null,
        royaleCountdownMs: room.mode === 'royale' && room.royaleState === 'countdown'
          ? Math.max(0, room.royaleJoinDeadline - Date.now()) : null,
        teams: (room.mode==='team'||room.mode==='domination'||room.mode==='ctf') ? Array.from(room.teams.entries()).map(([tid,t])=>({
          id:tid, name:t.name, color:t.color,
          members: t.memberIds.size,
        })) : null,
        domTimeLeft: room.mode==='domination' ? Math.max(0, room.domRoundEnd - Date.now()) : null,
        ctfTimeLeft: room.mode==='ctf' ? Math.max(0, room.ctfRoundEnd - Date.now()) : null,
      });
    }
    return list;
  }
}

module.exports = { RoomManager };
