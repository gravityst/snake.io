// ============================================================
// Snake.io — Dual-mode client (local AI + multiplayer)
// ============================================================

(() => {
  'use strict';

  // --- DOM ---
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const skinScreen = document.getElementById('skinScreen');
  const roomScreen = document.getElementById('roomScreen');
  const deathScreen = document.getElementById('deathScreen');
  const hud = document.getElementById('hud');
  const nameInput = document.getElementById('nameInput');
  const playAIBtn = document.getElementById('playAIBtn');
  const multiplayerBtn = document.getElementById('multiplayerBtn');
  const skinsBtn = document.getElementById('skinsBtn');
  const skinBackBtn = document.getElementById('skinBackBtn');
  const skinGrid = document.getElementById('skinGrid');
  const roomList = document.getElementById('roomList');
  const roomBackBtn = document.getElementById('roomBackBtn');
  const respawnBtn = document.getElementById('respawnBtn');
  const leaderboardEntries = document.getElementById('leaderboardEntries');
  const myScoreEl = document.getElementById('myScore');
  const finalScoreEl = document.getElementById('finalScore');
  const playerCountEl = document.getElementById('playerCount');
  const minimapCanvas = document.getElementById('minimap');
  const minimapCtx = minimapCanvas.getContext('2d');
  const teamScreen = document.getElementById('teamScreen');
  const teamGrid = document.getElementById('teamGrid');
  const teamBackBtn = document.getElementById('teamBackBtn');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const createRoomScreen = document.getElementById('createRoomScreen');
  const createRoomBackBtn = document.getElementById('createRoomBackBtn');
  const createRoomSubmit = document.getElementById('createRoomSubmit');
  const roomNameInput = document.getElementById('roomNameInput');
  const roomModeSelect = document.getElementById('roomModeSelect');
  const roomTeamSizeSelect = document.getElementById('roomTeamSizeSelect');

  // --- Config ---
  const MAP_SIZE = 14000;
  const DOT_RADIUS = 9;
  const HEAD_RADIUS = 14;
  const BASE_ZOOM = 0.72;
  // Multiplayer server URL
  const DEFAULT_SERVER_URL = 'https://snake-io-fzk5.onrender.com';
  // Custom server (Cloudflare Tunnel, localtunnel, self-hosted, etc)
  // Stored in localStorage; auto-used when online, falls back to default.
  // Can be set via URL param: ?server=snakeio-curtis or ?server=https://full.url
  let CUSTOM_SERVER_URL = localStorage.getItem('customServerUrl') || '';
  (() => {
    const urlParam = new URLSearchParams(location.search).get('server');
    if (urlParam) {
      let serverUrl = urlParam.trim();
      // Shorthand: just the subdomain → expand to full localtunnel URL
      if (!serverUrl.startsWith('http')) {
        serverUrl = 'https://snakeio-' + serverUrl + '.loca.lt';
      }
      CUSTOM_SERVER_URL = serverUrl;
      localStorage.setItem('customServerUrl', serverUrl);
      console.log('[snake.io] Server set from URL param:', serverUrl);
    }
  })();
  let SERVER_URL = DEFAULT_SERVER_URL; // active server — updated by auto-detect
  let usingCustom = false;
  const COLORS = ['#0ff', '#f0f', '#0f0', '#ff0', '#f80', '#08f', '#f44', '#8f0'];

  // --- Skins ---
  const SKINS = [
    // Purple/pink/feminine slots replaced in place (Magenta, Violet,
    // Bubblegum, Twilight, Galaxy, Candy, Cosmic, Strawberry, Cyberpunk,
    // Plasma, Pastel) — kept array length stable for saved selections.
    { name: 'Charger', colors: ['#0a0a18','#0ff','#08f','#0a0a18'] }, { name: 'Cobalt', colors: ['#1a4a8a','#3a7adf'] },
    { name: 'Lime', colors: ['#0f0'] }, { name: 'Gold', colors: ['#ff0'] },
    { name: 'Coral', colors: ['#f44'] }, { name: 'Sky', colors: ['#08f'] },
    { name: 'Combat Green', colors: ['#2d4a2d','#4a6a3a'] }, { name: 'Mint', colors: ['#5fc'] },
    { name: 'Pearl', colors: ['#fff'] }, { name: 'Charcoal', colors: ['#666'] },
    { name: 'Crimson', colors: ['#c12'] }, { name: 'Teal', colors: ['#0a8'] },
    { name: 'Amber', colors: ['#fa3'] },
    { name: 'Bumblebee', colors: ['#ff0','#222'] }, { name: 'Zebra', colors: ['#fff','#111'] },
    { name: 'Coralreef', colors: ['#f44','#fff'], unlockScore: 750 }, { name: 'Wasp', colors: ['#f80','#000'] },
    { name: 'Mintchip', colors: ['#5fc','#222'] }, { name: 'Knight', colors: ['#2a2a2a','#888'] },
    { name: 'Midnight', colors: ['#0a0a1a','#1a3a5a'] },
    { name: 'Sunset', colors: ['#f80','#f44','#ff0'] }, { name: 'Ocean', colors: ['#0ff','#08f','#04d'] },
    { name: 'Toxic', colors: ['#0f0','#ff0','#0f0'] }, { name: 'Fire', colors: ['#f44','#f80','#ff0'] },
    { name: 'Stormcloud', colors: ['#1a1a2a','#444','#6688aa','#1a1a2a'], unlockScore: 1800 },
    { name: 'Bullet', colors: ['#444','#aaa','#444','#aaa'] },
    { name: 'Ice', colors: ['#aef','#0ff','#fff'] },
    { name: 'Lava', colors: ['#f44','#f80','#ff0','#f44'], unlockScore: 1200 },
    { name: 'Forest', colors: ['#0a4','#0f0','#4f8'] },
    { name: 'Aurora', colors: ['#0fa','#0af','#1a5a8a','#0fa'], unlockScore: 2600 },
    { name: 'Eclipse', colors: ['#0a0a0a','#a00','#0a0a0a','#a00'] },
    { name: 'Peacock', colors: ['#0ff','#0a8','#08f','#0a8'] },
    { name: 'Hunter', colors: ['#2d3a1d','#4a5a2a','#1a2a1a'] },
    { name: 'Watermelon', colors: ['#f44','#0f0','#fff'] },
    { name: 'Matrix', colors: ['#0f0','#0a4','#0f0','#fff'] },
    { name: 'Mecha', colors: ['#1a1a1a','#888','#a00','#1a1a1a','#888'], unlockScore: 1000 },
    { name: 'Dragon', colors: ['#f44','#ff0','#0a4','#08f'], unlockScore: 3200 },
    { name: 'Voltage', colors: ['#0a0a18','#08f','#0ff','#fff','#0a0a18'], unlockScore: 2200 },
    { name: 'Pumpkin', colors: ['#f80','#222','#f80','#222'] },
    { name: 'Neon Party', colors: ['#0ff','#ff0','#0f0','#fa0'], unlockScore: 1400 },
    { name: 'Rainbow', colors: ['#f44','#f80','#ff0','#0f0','#08f','#0ff'], unlockScore: 4000 },
    { name: 'Ranger', colors: ['#2d4a2d','#4a6a3a','#1d2a1d','#5a7a4a'] },
    { name: 'Spectrum', colors: ['#f00','#f80','#ff0','#0f0','#0ff','#08f','#a0f','#f0f'] },
    // ---- Cool / tactical / "beast mode" set ----
    { name: 'Carbon Fiber', colors: ['#1a1a1a','#2d2d2d','#0d0d0d','#2d2d2d'] },
    { name: 'Tiger', colors: ['#f80','#1a1a1a','#fa3','#1a1a1a'] },
    { name: 'Forest Camo', colors: ['#2d4a2d','#4a6a3a','#6a7a3a','#3a4a2a'] },
    { name: 'Desert Camo', colors: ['#c9a875','#8a7050','#5a4030','#a08560'] },
    { name: 'Urban Camo', colors: ['#444','#777','#aaa','#222'] },
    { name: 'Shadow', colors: ['#0a0a0a','#1a1a1a','#252525','#1a1a1a'] },
    { name: 'Inferno', colors: ['#220000','#a00','#f40','#fa0'], unlockScore: 800 },
    { name: 'Tron', colors: ['#000','#0ff','#000','#088'] },
    { name: 'Chrome', colors: ['#888','#ccc','#fff','#aaa','#666'] },
    { name: 'Steel', colors: ['#3a3a3a','#7a7a7a','#bbb','#5a5a5a'] },
    { name: 'Toxic Sludge', colors: ['#1a1a1a','#0a4','#0f0','#1a1a1a'], unlockScore: 600 },
    { name: 'Stealth', colors: ['#0a0a18','#1a1a28','#252535','#0a0a18'] },
    { name: 'Onyx', colors: ['#000','#1a1a1a','#333','#1a1a1a'] },
    { name: 'Lightning', colors: ['#0a1a2a','#0af','#fff','#08f','#0a1a2a'], unlockScore: 1500 },
    { name: 'Phoenix', colors: ['#400','#a00','#f60','#fc0','#f60','#a00'], unlockScore: 2000 },
    { name: 'Octane', colors: ['#1a1a1a','#f80','#a40','#f80','#1a1a1a'] },
    { name: 'Beast', colors: ['#0a0a0a','#a00','#0a0a0a','#a00'], unlockScore: 1100 },
    { name: 'Spartan', colors: ['#a00','#cc8800','#a00','#0a0a0a'] },
    { name: 'Predator', colors: ['#1a3a1a','#0a0a0a','#a00','#0a0a0a'], unlockScore: 2500 },
    { name: 'Frostbite', colors: ['#1a3a5a','#5a8aaa','#aff','#5a8aaa','#1a3a5a'] },
    { name: 'Sniper', colors: ['#2a3a2a','#4a5a3a','#7a8a5a','#2a3a2a'] },
    { name: 'Crimson Steel', colors: ['#1a1a1a','#a00','#666','#a00','#1a1a1a'], unlockScore: 1800 },
    { name: 'Hacker', colors: ['#000','#0f0','#040','#0f0','#000'] },
    { name: 'Asphalt', colors: ['#1a1a1a','#333','#555','#1a1a1a'] },
    { name: 'Bronze', colors: ['#8a5520','#cc8855','#f8b870','#8a5520'] },
  ];

  const LOCAL_MODES = [
    { id: 'classic', label: 'Classic Arena' },
    { id: 'royale', label: 'Battle Royale' }
  ];
  let selectedLocalMode = localStorage.getItem('selectedLocalMode') || 'classic';
  let bestScore = parseInt(localStorage.getItem('snakeBestScore') || '0', 10) || 0;

  let selectedSkin = 0;
  let selectedAccessory = 0;

  // --- Accessories ---
  const ACCESSORIES = [
    { name: 'None' },
    { name: 'Crown' },
    { name: 'Top Hat' },
    { name: 'Sunglasses' },
    { name: 'Halo' },
    { name: 'Party Hat' },
    { name: 'Ninja Band' },
    { name: 'Flower' },
    { name: 'Antenna' },
    { name: 'Bow Tie' },
    { name: 'Wizard Hat' },
    { name: 'Cat Ears' },
    { name: 'Viking Horns' },
    { name: 'Fire' },
    { name: 'Ice Crown' },
    { name: 'Bandana' },
    { name: 'Stars' },
    { name: 'Monocle' },
    { name: 'Pirate Hat' },
    { name: 'Angel Wings' },
    { name: 'Headphones' },
    { name: 'Chef Hat' },
    { name: 'Goggles' },
    { name: 'Mushroom' },
  ];

  // ---- Emoji-based accessories ---------------------------------------
  // OS-rendered emoji look genuinely 3D at any size; far better than the
  // canvas-painted shapes ever could at headR ~14-28px. Mapped per accId.
  // Each entry: [emoji, kind] where kind is:
  //   'crown'  — sits above head from camera POV
  //   'face'   — drawn ON the head (sunglasses, monocle, goggles)
  //   'around' — small extras drawn around the head (stars, fire)
  // null = no good isolated emoji; fall back to canvas paint (legacy renderer).
  // Avoid emoji that include a face (😇🥳🧙🐱🐂🧐👼👨‍🍳 etc.) because the
  // face draws right onto the snake's head and looks like the snake is
  // wearing a tiny costume of a person.
  const ACC_EMOJI = [
    null,
    ['👑',  'crown'],   // 1 Crown
    ['🎩',  'crown'],   // 2 Top Hat
    ['🕶️', 'face'],    // 3 Sunglasses
    null,                // 4 Halo → painted (emoji 😇 has face)
    ['🎉',  'crown'],   // 5 Party Hat → party popper (was 🥳 face)
    null,                // 6 Ninja Band → painted
    ['🌸',  'crown'],   // 7 Flower
    ['📡',  'crown'],   // 8 Antenna (satellite dish)
    ['🎀',  'crown'],   // 9 Bow Tie
    null,                // 10 Wizard Hat → painted (was 🧙 full wizard)
    null,                // 11 Cat Ears → painted
    null,                // 12 Viking Horns → painted
    ['🔥',  'crown'],   // 13 Fire
    ['❄️',  'crown'],   // 14 Ice Crown
    null,                // 15 Bandana → painted
    ['⭐',  'crown'],   // 16 Stars
    null,                // 17 Monocle → painted
    null,                // 18 Pirate Hat → painted skull-and-crossbones
    null,                // 19 Angel Wings → painted
    ['🎧',  'face'],    // 20 Headphones
    null,                // 21 Chef Hat → painted
    ['🥽',  'face'],    // 22 Goggles
    ['🍄',  'crown'],   // 23 Mushroom
  ];

  function drawAccessory(ctx, accId, hx, hy, headR, angle) {
    if (accId <= 0 || accId >= ACC_EMOJI.length) return;
    const entry = ACC_EMOJI[accId];
    if (!entry) {
      return _legacyDrawAccessory(ctx, accId, hx, hy, headR, angle);
    }
    const [emoji, kind] = entry;
    ctx.save();
    ctx.translate(hx, hy);
    if (kind === 'crown') {
      // Hat / crown: rotate so the glyph's "up" matches the snake's
      // perpendicular-to-facing direction, sit it above the head.
      ctx.rotate(angle - Math.PI / 2);
      const size = headR * 2.4;
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(4, headR * 0.35);
      ctx.shadowOffsetY = Math.max(1, headR * 0.08);
      ctx.fillText(emoji, 0, -headR * 1.30);
    } else {
      // Face items (sunglasses, headphones, goggles): glyph's x-axis must
      // span the snake's perpendicular-to-facing axis (where the eyes are),
      // AND the glyph must face the right way around — angle - PI/2 is the
      // correct quadrant; angle + PI/2 leaves them upside-down.
      ctx.rotate(angle - Math.PI / 2);
      const size = headR * 2.4;
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.max(4, headR * 0.35);
      ctx.shadowOffsetY = Math.max(1, headR * 0.08);
      // After rotate(angle - PI/2), local +Y becomes world forward — so a
      // positive Y offset puts the item over the eyes (forward of head).
      ctx.fillText(emoji, 0, headR * 0.20);
    }
    ctx.restore();
  }

  // Kept around in case anything else calls them (no-ops if unused)
  function _radialGrad(ctx, x, y, ri, ro, cInner, cOuter) {
    const g = ctx.createRadialGradient(x, y, ri, x, y, ro);
    g.addColorStop(0, cInner); g.addColorStop(1, cOuter); return g;
  }
  function _linearGrad(ctx, x1, y1, x2, y2, c1, c2) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
  }
  function _shineDot(ctx, x, y, rad, color = 'rgba(255,255,255,0.85)') {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill();
  }

  // Legacy canvas-painted drawer — left in for reference; unreachable.
  function _legacyDrawAccessory(ctx, accId, hx, hy, headR, angle) {
    if (accId <= 0 || accId >= ACCESSORIES.length) return;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const topX = hx - sin * headR * 0.9, topY = hy + cos * headR * 0.9; // top of head (perpendicular to direction)
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle - Math.PI/2); // rotate so "up" is away from movement direction
    // Scale painted accessories up — they were rendering as small cluttered
    // blobs because the emoji renderer uses ~2.4×headR while paint used 1×.
    const r = headR * 1.5;

    if (accId === 1) { // Crown — 3D gold with jewels
      // Soft drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, -r*0.45, r*0.65, r*0.12, 0, 0, Math.PI*2); ctx.fill();
      // Body — vertical gold gradient (highlight top, dark base)
      const gold = _linearGrad(ctx, 0, -r*1.3, 0, -r*0.5, '#fff5b3', '#a87a00');
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(-r*0.6, -r*0.5);
      ctx.lineTo(-r*0.6, -r*1.05);
      ctx.lineTo(-r*0.3, -r*0.85);
      ctx.lineTo(0, -r*1.30);
      ctx.lineTo(r*0.3, -r*0.85);
      ctx.lineTo(r*0.6, -r*1.05);
      ctx.lineTo(r*0.6, -r*0.5);
      ctx.closePath(); ctx.fill();
      // Top highlight stroke (catches light)
      ctx.strokeStyle = 'rgba(255,255,200,0.85)';
      ctx.lineWidth = r*0.06;
      ctx.beginPath();
      ctx.moveTo(-r*0.55, -r*1.0); ctx.lineTo(-r*0.32, -r*0.83);
      ctx.moveTo(-r*0.05, -r*1.25); ctx.lineTo(0.05, -r*1.25);
      ctx.moveTo(r*0.55, -r*1.0); ctx.lineTo(r*0.32, -r*0.83);
      ctx.stroke();
      // Inner band shadow
      ctx.fillStyle = 'rgba(120,80,0,0.35)';
      ctx.fillRect(-r*0.58, -r*0.62, r*1.16, r*0.10);
      // Outer crisp rim
      ctx.strokeStyle = '#7a5400';
      ctx.lineWidth = r*0.04;
      ctx.beginPath();
      ctx.moveTo(-r*0.6, -r*0.5);
      ctx.lineTo(-r*0.6, -r*1.05);
      ctx.lineTo(-r*0.3, -r*0.85);
      ctx.lineTo(0, -r*1.30);
      ctx.lineTo(r*0.3, -r*0.85);
      ctx.lineTo(r*0.6, -r*1.05);
      ctx.lineTo(r*0.6, -r*0.5);
      ctx.closePath();
      ctx.stroke();
      // Jewels — red ruby, blue sapphire, green emerald with shine
      const jewels = [
        { x: -r*0.3, y: -r*0.72, c1: '#ffaaaa', c2: '#cc0033' },
        { x:  0,     y: -r*0.72, c1: '#aaddff', c2: '#0044aa' },
        { x:  r*0.3, y: -r*0.72, c1: '#aaffaa', c2: '#117733' },
      ];
      for (const j of jewels) {
        ctx.fillStyle = _radialGrad(ctx, j.x - r*0.03, j.y - r*0.03, r*0.01, r*0.10, j.c1, j.c2);
        ctx.beginPath(); ctx.arc(j.x, j.y, r*0.09, 0, Math.PI*2); ctx.fill();
        _shineDot(ctx, j.x - r*0.04, j.y - r*0.04, r*0.025);
      }
    } else if (accId === 2) { // Top Hat — glossy black with white shine band
      // Drop shadow
      ctx.fillStyle='rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, -r*0.55, r*0.75, r*0.10, 0, 0, Math.PI*2); ctx.fill();
      // Brim
      const brim = _linearGrad(ctx, 0, -r*0.8, 0, -r*0.5, '#2a2a2a', '#0a0a0a');
      ctx.fillStyle = brim;
      ctx.beginPath();
      ctx.ellipse(0, -r*0.6, r*0.78, r*0.16, 0, 0, Math.PI*2); ctx.fill();
      // Crown — vertical gradient
      const body = _linearGrad(ctx, 0, -r*1.7, 0, -r*0.7, '#3a3a3a', '#0d0d0d');
      ctx.fillStyle = body;
      ctx.fillRect(-r*0.5, -r*1.65, r*1.0, r*0.95);
      // Top highlight (subtle white reflection on left)
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-r*0.42, -r*1.6, r*0.10, r*0.85);
      // Brim top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(-r*0.5, -r*0.74, r*1.0, r*0.04);
      // Cyan ribbon with inner shadow
      const ribbon = _linearGrad(ctx, 0, -r*0.95, 0, -r*0.75, '#5eead4', '#1ea890');
      ctx.fillStyle = ribbon;
      ctx.fillRect(-r*0.5, -r*0.92, r*1.0, r*0.16);
      ctx.fillStyle='rgba(0,0,0,0.15)';
      ctx.fillRect(-r*0.5, -r*0.78, r*1.0, r*0.02);
    } else if (accId === 3) { // Sunglasses — glossy black lenses with chrome rims
      const lx=-r*0.35, rx=r*0.35, ey=r*0.15;
      // Lens base — dark with a radial highlight (suggests reflective glass)
      const lensL = _radialGrad(ctx, lx - r*0.08, ey - r*0.08, r*0.01, r*0.3, 'rgba(80,80,80,0.95)', 'rgba(5,5,5,0.95)');
      const lensR = _radialGrad(ctx, rx - r*0.08, ey - r*0.08, r*0.01, r*0.3, 'rgba(80,80,80,0.95)', 'rgba(5,5,5,0.95)');
      ctx.fillStyle = lensL; ctx.beginPath(); ctx.arc(lx, ey, r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = lensR; ctx.beginPath(); ctx.arc(rx, ey, r*0.28, 0, Math.PI*2); ctx.fill();
      // Chrome rims
      ctx.strokeStyle = _radialGrad(ctx, 0, ey, 0, r*0.4, '#fff', '#666');
      ctx.lineWidth = r*0.08;
      ctx.beginPath(); ctx.arc(lx, ey, r*0.28, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ey, r*0.28, 0, Math.PI*2); ctx.stroke();
      // Bridge
      ctx.lineWidth = r*0.1;
      ctx.beginPath(); ctx.moveTo(lx+r*0.25, ey); ctx.lineTo(rx-r*0.25, ey); ctx.stroke();
      // Shine highlights on lenses
      _shineDot(ctx, lx - r*0.10, ey - r*0.12, r*0.06);
      _shineDot(ctx, rx - r*0.10, ey - r*0.12, r*0.06);
      _shineDot(ctx, lx + r*0.08, ey + r*0.06, r*0.03, 'rgba(255,255,255,0.55)');
      _shineDot(ctx, rx + r*0.08, ey + r*0.06, r*0.03, 'rgba(255,255,255,0.55)');
    } else if (accId === 4) { // Halo — luminous golden ring
      // Outer glow
      const glow = _radialGrad(ctx, 0, -r*1.3, r*0.4, r*0.85, 'rgba(255,220,80,0.45)', 'rgba(255,220,80,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(0, -r*1.3, r*0.85, r*0.5, 0, 0, Math.PI*2); ctx.fill();
      // Outer ring (gold)
      ctx.strokeStyle = '#fc0';
      ctx.lineWidth = r*0.10;
      ctx.beginPath(); ctx.ellipse(0, -r*1.3, r*0.55, r*0.15, 0, 0, Math.PI*2); ctx.stroke();
      // Inner ring (bright shine)
      ctx.strokeStyle = 'rgba(255,255,220,0.95)';
      ctx.lineWidth = r*0.04;
      ctx.beginPath(); ctx.ellipse(0, -r*1.3, r*0.55, r*0.15, 0, 0, Math.PI*2); ctx.stroke();
    } else if (accId === 5) { // Party Hat — striped cone with pom and streamers
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, -r*1.85);
      ctx.lineTo(-r*0.55, -r*0.45);
      ctx.lineTo(r*0.55, -r*0.45);
      ctx.closePath();
      ctx.clip();
      // Stripes
      const stripes = ['#5eead4','#a78bfa','#fbbf24','#fb7185','#5eead4','#a78bfa'];
      for (let i = 0; i < stripes.length; i++) {
        ctx.fillStyle = stripes[i];
        const y = -r*1.85 + (i / stripes.length) * (r*1.4);
        ctx.fillRect(-r, y, r*2, (r*1.4)/stripes.length + 1);
      }
      // Subtle vertical shadow on left for 3D cone
      const cone = _linearGrad(ctx, -r*0.55, 0, r*0.55, 0, 'rgba(0,0,0,0.30)', 'rgba(255,255,255,0.25)');
      ctx.fillStyle = cone;
      ctx.fillRect(-r, -r*1.85, r*2, r*1.4);
      ctx.restore();
      // Crisp outline
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = r*0.04;
      ctx.beginPath();
      ctx.moveTo(0, -r*1.85);
      ctx.lineTo(-r*0.55, -r*0.45);
      ctx.lineTo(r*0.55, -r*0.45);
      ctx.closePath();
      ctx.stroke();
      // Pom-pom (3D ball)
      const pom = _radialGrad(ctx, -r*0.02, -r*1.88, r*0.01, r*0.18, '#fff', '#fbbf24');
      ctx.fillStyle = pom;
      ctx.beginPath(); ctx.arc(0, -r*1.85, r*0.16, 0, Math.PI*2); ctx.fill();
      _shineDot(ctx, -r*0.05, -r*1.90, r*0.05);
    } else if (accId === 6) { // Ninja Band — cloth with sigil and tails
      // Tails behind
      ctx.fillStyle = '#7f1414';
      ctx.beginPath(); ctx.moveTo(r*0.7, 0); ctx.lineTo(r*1.35, -r*0.35); ctx.lineTo(r*1.15, r*0.08); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.7, 0); ctx.lineTo(r*1.45, r*0.12); ctx.lineTo(r*1.05, r*0.32); ctx.closePath(); ctx.fill();
      // Band gradient (cloth)
      const cloth = _linearGrad(ctx, 0, -r*0.18, 0, r*0.18, '#2a2a2a', '#0e0e0e');
      ctx.fillStyle = cloth;
      ctx.fillRect(-r*0.85, -r*0.18, r*1.7, r*0.35);
      // Stitches / weave hint
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      for (let i = -r*0.8; i < r*0.8; i += r*0.18) {
        ctx.beginPath(); ctx.moveTo(i, -r*0.16); ctx.lineTo(i, r*0.16); ctx.stroke();
      }
      // Red sigil dot
      const sig = _radialGrad(ctx, -r*0.02, -r*0.02, r*0.005, r*0.10, '#ffaaaa', '#a30000');
      ctx.fillStyle = sig;
      ctx.beginPath(); ctx.arc(0, 0, r*0.09, 0, Math.PI*2); ctx.fill();
      _shineDot(ctx, -r*0.03, -r*0.03, r*0.025);
    } else if (accId === 7) { // Flower — 3D petals with center
      const petalColors = [['#ffe4e6','#fb7185'],['#fef3c7','#fbbf24'],['#dbeafe','#3b82f6'],['#fce7f3','#ec4899'],['#dcfce7','#22c55e']];
      for (let i = 0; i < 5; i++) {
        const a = i*Math.PI*2/5 - Math.PI/2;
        const px = Math.cos(a)*r*0.40;
        const py = -r*1.0 + Math.sin(a)*r*0.40;
        const [c1, c2] = petalColors[i];
        const g = _radialGrad(ctx, px - r*0.05, py - r*0.05, r*0.005, r*0.22, c1, c2);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, r*0.20, 0, Math.PI*2); ctx.fill();
      }
      // Center — bright golden bead
      const cen = _radialGrad(ctx, -r*0.02, -r*1.02, r*0.005, r*0.16, '#fff7a8', '#b45309');
      ctx.fillStyle = cen;
      ctx.beginPath(); ctx.arc(0, -r*1.0, r*0.15, 0, Math.PI*2); ctx.fill();
      _shineDot(ctx, -r*0.04, -r*1.04, r*0.04);
    } else if (accId === 8) { // Antenna — metallic rod with neon orb
      // Rod (chrome)
      ctx.strokeStyle = _linearGrad(ctx, -r*0.05, 0, r*0.05, 0, '#fff', '#777');
      ctx.lineWidth = r*0.10;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r*0.5); ctx.quadraticCurveTo(r*0.18, -r*1.45, 0, -r*1.85); ctx.stroke();
      ctx.lineCap = 'butt';
      // Orb — bright cyan with shine
      const orb = _radialGrad(ctx, -r*0.05, -r*1.90, r*0.02, r*0.22, '#ccffff', '#0a8aa8');
      ctx.fillStyle = orb;
      ctx.beginPath(); ctx.arc(0, -r*1.85, r*0.20, 0, Math.PI*2); ctx.fill();
      _shineDot(ctx, -r*0.07, -r*1.92, r*0.06);
      // Outer glow
      const glow = _radialGrad(ctx, 0, -r*1.85, r*0.18, r*0.42, 'rgba(94,234,212,0.5)', 'rgba(94,234,212,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, -r*1.85, r*0.4, 0, Math.PI*2); ctx.fill();
    } else if (accId === 9) { // Bow Tie — shiny ribbon with knot
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, r*0.95, r*0.55, r*0.08, 0, 0, Math.PI*2); ctx.fill();
      const ribbon = _linearGrad(ctx, 0, r*0.35, 0, r*0.9, '#ff8d9b', '#b91c1c');
      ctx.fillStyle = ribbon;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(-r*0.06, r*0.6);
      ctx.quadraticCurveTo(-r*0.55, r*0.18, -r*0.62, r*0.4);
      ctx.lineTo(-r*0.62, r*0.85);
      ctx.quadraticCurveTo(-r*0.55, r*1.05, -r*0.06, r*0.65);
      ctx.closePath(); ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(r*0.06, r*0.6);
      ctx.quadraticCurveTo(r*0.55, r*0.18, r*0.62, r*0.4);
      ctx.lineTo(r*0.62, r*0.85);
      ctx.quadraticCurveTo(r*0.55, r*1.05, r*0.06, r*0.65);
      ctx.closePath(); ctx.fill();
      // Highlight stripe on wings
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = r*0.04;
      ctx.beginPath(); ctx.moveTo(-r*0.5, r*0.5); ctx.lineTo(-r*0.15, r*0.62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r*0.5, r*0.5); ctx.lineTo(r*0.15, r*0.62); ctx.stroke();
      // Knot
      const knot = _radialGrad(ctx, -r*0.02, r*0.6, r*0.01, r*0.17, '#fff', '#7f1d1d');
      ctx.fillStyle = knot;
      ctx.beginPath(); ctx.arc(0, r*0.62, r*0.14, 0, Math.PI*2); ctx.fill();
      _shineDot(ctx, -r*0.04, r*0.57, r*0.04);
    } else if (accId === 10) { // Wizard Hat — purple cone with star and band
      // Cone body
      const cone = _linearGrad(ctx, -r*0.3, 0, r*0.6, 0, '#3b1d8a', '#1e0d4a');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(0, -r*2.2);
      ctx.lineTo(-r*0.7, -r*0.45);
      ctx.lineTo(r*0.7, -r*0.45);
      ctx.closePath(); ctx.fill();
      // Top highlight ridge
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.lineWidth = r*0.05;
      ctx.beginPath();
      ctx.moveTo(0, -r*2.2);
      ctx.lineTo(-r*0.30, -r*0.65);
      ctx.stroke();
      // Outline
      ctx.strokeStyle = '#150729';
      ctx.lineWidth = r*0.04;
      ctx.beginPath();
      ctx.moveTo(0, -r*2.2);
      ctx.lineTo(-r*0.7, -r*0.45);
      ctx.lineTo(r*0.7, -r*0.45);
      ctx.closePath(); ctx.stroke();
      // Brim band
      const band = _linearGrad(ctx, 0, -r*0.55, 0, -r*0.35, '#ffd166', '#b8860b');
      ctx.fillStyle = band;
      ctx.fillRect(-r*0.78, -r*0.55, r*1.56, r*0.16);
      ctx.strokeStyle = 'rgba(255,255,200,0.5)'; ctx.lineWidth = r*0.02;
      ctx.beginPath(); ctx.moveTo(-r*0.78, -r*0.52); ctx.lineTo(r*0.78, -r*0.52); ctx.stroke();
      // Star on top
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI/2;
        const ir = r*0.06, or = r*0.14;
        ctx.lineTo(0 + Math.cos(a)*or, -r*2.15 + Math.sin(a)*or);
        const a2 = a + Math.PI/5;
        ctx.lineTo(0 + Math.cos(a2)*ir, -r*2.15 + Math.sin(a2)*ir);
      }
      ctx.closePath(); ctx.fill();
      _shineDot(ctx, -r*0.04, -r*2.18, r*0.04, 'rgba(255,255,255,0.8)');
    } else if (accId === 11) { // Cat Ears — fluffy ears with pink inner shading
      // Outer ears
      const outer = _linearGrad(ctx, 0, -r*1.3, 0, -r*0.3, '#fbcfa0', '#a86a3a');
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.moveTo(-r*0.6, -r*0.30); ctx.lineTo(-r*0.45, -r*1.30); ctx.lineTo(-r*0.10, -r*0.50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.6, -r*0.30); ctx.lineTo(r*0.45, -r*1.30); ctx.lineTo(r*0.10, -r*0.50); ctx.closePath(); ctx.fill();
      // Inner pink
      const inner = _linearGrad(ctx, 0, -r*1.0, 0, -r*0.4, '#ffb6c1', '#c2185b');
      ctx.fillStyle = inner;
      ctx.beginPath(); ctx.moveTo(-r*0.50, -r*0.40); ctx.lineTo(-r*0.45, -r*1.00); ctx.lineTo(-r*0.20, -r*0.50); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r*0.50, -r*0.40); ctx.lineTo(r*0.45, -r*1.00); ctx.lineTo(r*0.20, -r*0.50); ctx.closePath(); ctx.fill();
      // Tiny shine on the tip
      _shineDot(ctx, -r*0.42, -r*1.18, r*0.05);
      _shineDot(ctx,  r*0.42, -r*1.18, r*0.05);
    } else if (accId === 12) { // Viking Horns — bone with banded shading
      const horn = _linearGrad(ctx, 0, -r*1.5, 0, -r*0.2, '#fff2d6', '#7a5d2a');
      ctx.fillStyle = horn;
      ctx.beginPath();
      ctx.moveTo(-r*0.5, -r*0.3); ctx.quadraticCurveTo(-r*1.25, -r*1.55, -r*0.78, -r*0.18); ctx.lineTo(-r*0.40, -r*0.5); ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r*0.5, -r*0.3); ctx.quadraticCurveTo(r*1.25, -r*1.55, r*0.78, -r*0.18); ctx.lineTo(r*0.40, -r*0.5); ctx.closePath();
      ctx.fill();
      // Bands
      ctx.strokeStyle = 'rgba(80,55,20,0.45)';
      ctx.lineWidth = r*0.04;
      for (let i = 0; i < 3; i++) {
        const t = 0.25 + i * 0.22;
        ctx.beginPath();
        ctx.moveTo(-r*(0.5 + t*0.4), -r*(0.3 + t*0.8));
        ctx.lineTo(-r*(0.5 + t*0.35), -r*(0.35 + t*0.6));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r*(0.5 + t*0.4), -r*(0.3 + t*0.8));
        ctx.lineTo(r*(0.5 + t*0.35), -r*(0.35 + t*0.6));
        ctx.stroke();
      }
    } else if (accId === 13) { // Fire — layered orange flame
      const layers = [
        { c: 'rgba(255,80,0,0.55)',  s: 1.0 },
        { c: 'rgba(255,160,0,0.75)', s: 0.75 },
        { c: 'rgba(255,220,40,0.85)',s: 0.5 },
        { c: 'rgba(255,255,210,0.9)', s: 0.28 },
      ];
      for (const L of layers) {
        ctx.fillStyle = L.c;
        ctx.beginPath();
        ctx.moveTo(-r*0.5*L.s, -r*0.3);
        ctx.bezierCurveTo(-r*0.8*L.s, -r*0.8, -r*0.4*L.s, -r*1.2, 0, -r*1.6*L.s - r*0.4);
        ctx.bezierCurveTo( r*0.4*L.s, -r*1.2,  r*0.8*L.s, -r*0.8, r*0.5*L.s, -r*0.3);
        ctx.quadraticCurveTo(0, -r*0.45, -r*0.5*L.s, -r*0.3);
        ctx.fill();
      }
    } else if (accId === 14) { // Ice Crown — glassy bluish spikes with shine
      const ice = _linearGrad(ctx, 0, -r*1.2, 0, -r*0.4, '#e0f7ff', '#1e90ff');
      ctx.fillStyle = ice;
      ctx.beginPath();
      ctx.moveTo(-r*0.55,-r*0.5);ctx.lineTo(-r*0.40,-r*1.10);ctx.lineTo(-r*0.15,-r*0.70);
      ctx.lineTo(0,-r*1.25);ctx.lineTo(r*0.15,-r*0.70);ctx.lineTo(r*0.40,-r*1.10);
      ctx.lineTo(r*0.55,-r*0.5);ctx.closePath();ctx.fill();
      // Bright top edges
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = r*0.04;
      ctx.beginPath();
      ctx.moveTo(-r*0.55,-r*0.5); ctx.lineTo(-r*0.40,-r*1.10);
      ctx.moveTo(-r*0.40,-r*1.10); ctx.lineTo(-r*0.15,-r*0.70);
      ctx.moveTo(-r*0.15,-r*0.70); ctx.lineTo(0,-r*1.25);
      ctx.moveTo(0,-r*1.25); ctx.lineTo(r*0.15,-r*0.70);
      ctx.moveTo(r*0.15,-r*0.70); ctx.lineTo(r*0.40,-r*1.10);
      ctx.moveTo(r*0.40,-r*1.10); ctx.lineTo(r*0.55,-r*0.5);
      ctx.stroke();
      // Glossy white shine on top spike
      _shineDot(ctx, -r*0.05, -r*1.10, r*0.04);
    } else if (accId === 15) { // Bandana — cloth fold with center knot
      const bandc = _linearGrad(ctx, 0, -r*0.22, 0, r*0.10, '#ef4444', '#7f1d1d');
      ctx.fillStyle = bandc;
      ctx.fillRect(-r*0.85, -r*0.20, r*1.7, r*0.30);
      // Polka dots
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = -r*0.7; i <= r*0.7; i += r*0.30) {
        ctx.beginPath(); ctx.arc(i, -r*0.05, r*0.05, 0, Math.PI*2); ctx.fill();
      }
      // Knot bump on right side
      const knot = _radialGrad(ctx, r*0.93, -r*0.05, r*0.005, r*0.16, '#fca5a5', '#7f1d1d');
      ctx.fillStyle = knot;
      ctx.beginPath(); ctx.arc(r*0.95, -r*0.04, r*0.15, 0, Math.PI*2); ctx.fill();
    } else if (accId === 16) { // Stars — three glowing golden stars
      const starPos = [[-r*0.5,-r*1.20], [r*0.4,-r*1.42], [r*0.1,-r*1.02]];
      for (const [sx, sy] of starPos) {
        // Glow
        const glow = _radialGrad(ctx, sx, sy, r*0.04, r*0.30, 'rgba(255,230,80,0.45)', 'rgba(255,230,80,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy, r*0.28, 0, Math.PI*2); ctx.fill();
        // Star path
        const grad = _radialGrad(ctx, sx-r*0.04, sy-r*0.04, r*0.005, r*0.18, '#fff7c0', '#d97706');
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = i*Math.PI*2/5 - Math.PI/2;
          const ir = r*0.06, or = r*0.16;
          ctx.lineTo(sx + Math.cos(a)*or, sy + Math.sin(a)*or);
          const a2 = a + Math.PI/5;
          ctx.lineTo(sx + Math.cos(a2)*ir, sy + Math.sin(a2)*ir);
        }
        ctx.closePath(); ctx.fill();
      }
    } else if (accId === 17) { // Monocle — chrome ring with gleam + chain
      // Ring
      ctx.strokeStyle = _linearGrad(ctx, r*0.05, 0, r*0.55, 0, '#fff7d6', '#7a5400');
      ctx.lineWidth = r*0.10;
      ctx.beginPath(); ctx.arc(r*0.30, r*0.15, r*0.26, 0, Math.PI*2); ctx.stroke();
      // Lens (subtle blue tint)
      ctx.fillStyle = 'rgba(180,220,255,0.20)';
      ctx.beginPath(); ctx.arc(r*0.30, r*0.15, r*0.22, 0, Math.PI*2); ctx.fill();
      // Inner rim shadow
      ctx.strokeStyle = 'rgba(80,55,0,0.6)';
      ctx.lineWidth = r*0.03;
      ctx.beginPath(); ctx.arc(r*0.30, r*0.15, r*0.22, 0, Math.PI*2); ctx.stroke();
      // Chain
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = r*0.04;
      ctx.setLineDash([r*0.05, r*0.05]);
      ctx.beginPath(); ctx.moveTo(r*0.30, r*0.41); ctx.quadraticCurveTo(r*0.45, r*0.7, r*0.18, r*0.95); ctx.stroke();
      ctx.setLineDash([]);
      // Gleam on lens
      _shineDot(ctx, r*0.16, r*0.04, r*0.05);
    } else if (accId === 18) { // Pirate Hat — gradient brim with bone skull
      // Brim gradient
      const brim = _linearGrad(ctx, 0, -r*1.6, 0, -r*0.4, '#3a3a3a', '#0a0a0a');
      ctx.fillStyle = brim;
      ctx.beginPath();
      ctx.moveTo(-r*0.85, -r*0.4);
      ctx.quadraticCurveTo(0, -r*1.65, r*0.85, -r*0.4);
      ctx.closePath();
      ctx.fill();
      // Gold trim
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = r*0.05;
      ctx.beginPath();
      ctx.moveTo(-r*0.85, -r*0.4);
      ctx.quadraticCurveTo(0, -r*1.65, r*0.85, -r*0.4);
      ctx.stroke();
      // Highlight curve
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = r*0.05;
      ctx.beginPath();
      ctx.moveTo(-r*0.65, -r*0.7); ctx.quadraticCurveTo(0, -r*1.45, r*0.65, -r*0.7);
      ctx.stroke();
      // Skull
      const skull = _radialGrad(ctx, -r*0.02, -r*0.85, r*0.01, r*0.20, '#fff', '#cbd5e1');
      ctx.fillStyle = skull;
      ctx.beginPath(); ctx.arc(0, -r*0.85, r*0.16, 0, Math.PI*2); ctx.fill();
      // Eye sockets
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(-r*0.06, -r*0.88, r*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.06, -r*0.88, r*0.04, 0, Math.PI*2); ctx.fill();
      // Crossbones
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = r*0.05; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r*0.18, -r*0.65); ctx.lineTo(r*0.18, -r*0.65);
      ctx.moveTo(-r*0.16, -r*0.70); ctx.lineTo(r*0.16, -r*0.60);
      ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (accId === 19) { // Angel Wings — feathered with glow
      // Glow halo behind
      const glow = _radialGrad(ctx, 0, -r*0.2, r*0.4, r*1.2, 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, -r*0.2, r*1.1, 0, Math.PI*2); ctx.fill();
      // Wing gradient
      const wing = _linearGrad(ctx, 0, -r*0.8, 0, 0, '#ffffff', '#c8d4f0');
      ctx.fillStyle = wing;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(-r*0.35, 0);
      ctx.quadraticCurveTo(-r*1.55, -r*0.40, -r*0.85, -r*0.85);
      ctx.quadraticCurveTo(-r*0.35, -r*0.45, -r*0.35, 0);
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(r*0.35, 0);
      ctx.quadraticCurveTo(r*1.55, -r*0.40, r*0.85, -r*0.85);
      ctx.quadraticCurveTo(r*0.35, -r*0.45, r*0.35, 0);
      ctx.fill();
      // Feather strokes
      ctx.strokeStyle = 'rgba(80,90,150,0.35)';
      ctx.lineWidth = r*0.025;
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        ctx.beginPath();
        ctx.moveTo(-r*(0.4 + t*0.95), -r*(0.05 + t*0.55));
        ctx.lineTo(-r*(0.35 + t*0.55), -r*(0.20 + t*0.45));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r*(0.4 + t*0.95), -r*(0.05 + t*0.55));
        ctx.lineTo(r*(0.35 + t*0.55), -r*(0.20 + t*0.45));
        ctx.stroke();
      }
    } else if (accId === 20) { // Headphones — chrome band + leather cushions
      // Band (chrome)
      ctx.strokeStyle = _linearGrad(ctx, 0, -r*0.75, 0, -r*0.1, '#fff', '#666');
      ctx.lineWidth = r*0.14;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, -r*0.05, r*0.72, Math.PI + 0.30, Math.PI*2 - 0.30); ctx.stroke();
      ctx.lineCap = 'butt';
      // Inner band shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.20)';
      ctx.lineWidth = r*0.04;
      ctx.beginPath(); ctx.arc(0, -r*0.05, r*0.72, Math.PI + 0.30, Math.PI*2 - 0.30); ctx.stroke();
      // Cushions
      const cush = _radialGrad(ctx, 0, 0, r*0.02, r*0.22, '#3a3a3a', '#0a0a0a');
      ctx.fillStyle = cush;
      ctx.beginPath(); ctx.arc(-r*0.66, r*0.18, r*0.22, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.66, r*0.18, r*0.22, 0, Math.PI*2); ctx.fill();
      // Speaker inner (teal glow)
      const sp = _radialGrad(ctx, 0, 0, r*0.01, r*0.13, '#a7f3d0', '#0f766e');
      ctx.fillStyle = sp;
      ctx.beginPath(); ctx.arc(-r*0.66, r*0.18, r*0.12, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.66, r*0.18, r*0.12, 0, Math.PI*2); ctx.fill();
      // Shine on cushions
      _shineDot(ctx, -r*0.72, r*0.10, r*0.04);
      _shineDot(ctx,  r*0.60, r*0.10, r*0.04);
    } else if (accId === 21) { // Chef Hat — pleated top with band
      // Pleated dome (three soft cloud lobes)
      const cloud = _radialGrad(ctx, 0, -r*1.1, r*0.05, r*0.6, '#ffffff', '#d8d8e0');
      ctx.fillStyle = cloud;
      ctx.beginPath(); ctx.arc(-r*0.30, -r*1.05, r*0.32, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( r*0.30, -r*1.05, r*0.32, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(    0,  -r*1.30, r*0.36, 0, Math.PI*2); ctx.fill();
      ctx.fillRect(-r*0.55, -r*1.05, r*1.1, r*0.55);
      // Band
      ctx.fillStyle = '#f4f4f8';
      ctx.fillRect(-r*0.60, -r*0.50, r*1.2, r*0.14);
      // Shadow under band
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-r*0.60, -r*0.36, r*1.2, r*0.03);
      // Subtle outline
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = r*0.03;
      ctx.beginPath(); ctx.moveTo(-r*0.55, -r*0.50); ctx.lineTo(r*0.55, -r*0.50); ctx.stroke();
    } else if (accId === 22) { // Goggles — glossy lenses with rubber strap
      const lx = -r*0.33, rx = r*0.33, ey = r*0.10;
      // Strap
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = r*0.08;
      ctx.beginPath(); ctx.arc(0, -r*0.05, r*0.72, Math.PI + 0.55, Math.PI*2 - 0.55); ctx.stroke();
      // Lens — glossy aqua
      const lens = _radialGrad(ctx, lx-r*0.08, ey-r*0.08, r*0.005, r*0.30, 'rgba(150,255,255,0.95)', 'rgba(0,80,120,0.85)');
      ctx.fillStyle = lens;
      ctx.beginPath(); ctx.arc(lx, ey, r*0.26, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = lens;
      ctx.beginPath(); ctx.arc(rx, ey, r*0.26, 0, Math.PI*2); ctx.fill();
      // Rims
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = r*0.07;
      ctx.beginPath(); ctx.arc(lx, ey, r*0.26, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rx, ey, r*0.26, 0, Math.PI*2); ctx.stroke();
      // Nose bridge
      ctx.lineWidth = r*0.05;
      ctx.beginPath(); ctx.moveTo(-r*0.10, ey); ctx.lineTo(r*0.10, ey); ctx.stroke();
      // Shines
      _shineDot(ctx, lx - r*0.10, ey - r*0.12, r*0.06);
      _shineDot(ctx, rx - r*0.10, ey - r*0.12, r*0.06);
    } else if (accId === 23) { // Mushroom — red cap with white dots, gills under
      // Cap (dome)
      const cap = _linearGrad(ctx, 0, -r*1.30, 0, -r*0.5, '#ff7676', '#9b1c1c');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.arc(0, -r*0.85, r*0.55, Math.PI, 0);
      ctx.lineTo(r*0.25, -r*0.45);
      ctx.lineTo(-r*0.25, -r*0.45);
      ctx.closePath();
      ctx.fill();
      // Cap highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(-r*0.20, -r*1.05, r*0.18, r*0.10, 0.3, 0, Math.PI*2); ctx.fill();
      // White dots
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const dots = [[-r*0.20,-r*1.00,r*0.08],[r*0.18,-r*0.85,r*0.07],[-r*0.04,-r*0.78,r*0.05]];
      for (const [dx, dy, dr] of dots) {
        ctx.beginPath(); ctx.arc(dx, dy, dr, 0, Math.PI*2); ctx.fill();
      }
      // Stem with gills under
      const stem = _linearGrad(ctx, 0, -r*0.5, 0, -r*0.15, '#fef3c7', '#d6a45f');
      ctx.fillStyle = stem;
      ctx.fillRect(-r*0.18, -r*0.50, r*0.36, r*0.30);
      // Gills (thin lines under)
      ctx.strokeStyle = 'rgba(120,80,40,0.45)';
      ctx.lineWidth = r*0.02;
      for (let i = -r*0.18; i <= r*0.18; i += r*0.06) {
        ctx.beginPath(); ctx.moveTo(i, -r*0.45); ctx.lineTo(i, -r*0.36); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- Skin picker ---
  function buildSkinGrid() {
    skinGrid.innerHTML = '';
    SKINS.forEach((skin, idx) => {
      const unlockScore = skin.unlockScore || 0;
      const locked = unlockScore && unlockScore > bestScore;
      const card = document.createElement('div');
      card.className = 'skin-card' + (idx === selectedSkin ? ' selected' : '') + (locked ? ' locked' : '');
      const dotsDiv = document.createElement('div');
      dotsDiv.className = 'skin-dots';
      const pc = Math.min(skin.colors.length >= 2 ? 5 : 3, 6);
      for (let i = 0; i < pc; i++) {
        const dot = document.createElement('div');
        dot.className = 'skin-dot';
        const c = skin.colors[i % skin.colors.length];
        dot.style.background = c; dot.style.boxShadow = `0 0 6px ${c}`;
        const sz = i === 0 ? 16 : 14 - i;
        dot.style.width = sz+'px'; dot.style.height = sz+'px';
        dotsDiv.appendChild(dot);
      }
      const nameDiv = document.createElement('div');
      nameDiv.className = 'skin-name';
      nameDiv.textContent = locked ? `UNLOCK @ ${unlockScore}` : skin.name;
      card.appendChild(dotsDiv); card.appendChild(nameDiv);
      card.addEventListener('click', () => {
        if (locked) {
          const remaining = unlockScore - bestScore;
          window.alert(`Reach ${unlockScore}+ best score to unlock ${skin.name}. ${remaining} more points to go.`);
          return;
        }
        selectedSkin = idx;
        document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      skinGrid.appendChild(card);
    });
  }
  buildSkinGrid();

  // --- Accessory picker ---
  function buildAccessoryGrid() {
    const grid = document.getElementById('accessoryGrid');
    grid.innerHTML = '';
    ACCESSORIES.forEach((acc, idx) => {
      const card = document.createElement('div');
      card.className = 'acc-card' + (idx === selectedAccessory ? ' selected' : '');
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      // Mini canvas — accessory only, no head, centered and bigger
      const c = document.createElement('canvas');
      c.width = 80; c.height = 60;
      c.style.display = 'block';
      c.style.margin = '0 auto';
      const cx = c.getContext('2d');
      if (idx === 0) {
        cx.fillStyle='rgba(255,255,255,0.3)';cx.font='22px sans-serif';cx.textAlign='center';cx.fillText('✕',40,38);
      } else {
        try { drawAccessory(cx, idx, 40, 35, 18, Math.PI/2); }
        catch(e) { cx.fillStyle='#f44';cx.font='10px sans-serif';cx.textAlign='center';cx.fillText('ERR',40,35); }
      }
      card.appendChild(c);
      const nameDiv = document.createElement('div');
      nameDiv.className = 'acc-name'; nameDiv.textContent = acc.name;
      card.appendChild(nameDiv);
      card.addEventListener('click', () => {
        selectedAccessory = idx;
        document.querySelectorAll('.acc-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      grid.appendChild(card);
    });
  }
  buildAccessoryGrid();

  // --- Tab switching (exposed globally for inline onclick) ---
  window.switchTab = function(tabId, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  };

  // --- Custom skin creator ---
  let customColors = ['#00ffff'];
  const colorPicker = document.getElementById('colorPicker');
  const addColorBtn = document.getElementById('addColorBtn');
  const clearColorsBtn = document.getElementById('clearColorsBtn');
  const applyCustomSkin = document.getElementById('applyCustomSkin');
  const customColorsDiv = document.getElementById('customColors');

  function renderCustomColors() {
    customColorsDiv.innerHTML = '';
    customColors.forEach((c, i) => {
      const chip = document.createElement('div');
      chip.style.cssText = `width:32px;height:32px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,0.2);cursor:pointer;box-shadow:0 0 8px ${c};`;
      chip.title = 'Click to remove';
      chip.addEventListener('click', () => { customColors.splice(i, 1); if (customColors.length === 0) customColors.push('#00ffff'); renderCustomColors(); });
      customColorsDiv.appendChild(chip);
    });
  }
  renderCustomColors();

  addColorBtn.addEventListener('click', () => {
    if (customColors.length < 8) { customColors.push(colorPicker.value); renderCustomColors(); }
  });
  clearColorsBtn.addEventListener('click', () => { customColors = ['#00ffff']; renderCustomColors(); });
  applyCustomSkin.addEventListener('click', () => {
    // Add custom skin to SKINS array and select it
    const name = 'Custom';
    const existing = SKINS.findIndex(s => s.name === 'Custom');
    if (existing >= 0) { SKINS[existing].colors = [...customColors]; selectedSkin = existing; }
    else { SKINS.push({ name, colors: [...customColors] }); selectedSkin = SKINS.length - 1; }
    buildSkinGrid();
    // Switch to skins tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="skinsTab"]').classList.add('active');
    document.getElementById('skinsTab').classList.add('active');
  });

  // --- Animated skin preview ---
  const skinPreview = document.getElementById('skinPreview');
  const spCtx = skinPreview.getContext('2d');
  let previewAnim = 0;

  function updateSkinPreview() {
    if (skinScreen.style.display === 'none' || !skinScreen.style.display) return;
    previewAnim += 0.03;
    const w = skinPreview.width, h = skinPreview.height;
    spCtx.clearRect(0, 0, w, h);
    spCtx.fillStyle = 'rgba(0,10,20,0.3)';
    spCtx.fillRect(0, 0, w, h);

    const skin = SKINS[selectedSkin] || SKINS[0];
    const segCount = 22;
    const spacing = 16;
    const hr = 14;
    const dotR = 10;

    // Generate a wiggling snake path
    const segs = [];
    for (let i = 0; i < segCount; i++) {
      const wave = Math.sin(previewAnim * 3 + i * 0.45) * 14;
      segs.push({
        x: w * 0.78 - i * spacing,
        y: h / 2 + wave,
      });
    }

    // Smooth body — matches the in-game renderer (continuous tube via per-
    // segment quadratic Beziers through midpoints).
    spCtx.lineCap = 'round';
    spCtx.lineJoin = 'round';
    spCtx.globalAlpha = 0.98;
    for (let i = segs.length - 1; i >= 1; i--) {
      const a = segs[i], b = segs[i-1];
      const tailT = i / segs.length;
      const lw = dotR * 2 * (1 - tailT * 0.22);
      spCtx.lineWidth = lw;
      spCtx.strokeStyle = skin.colors[i % skin.colors.length];
      const aNext = segs[i + 1];
      const sx = aNext ? (a.x + aNext.x) * 0.5 : a.x;
      const sy = aNext ? (a.y + aNext.y) * 0.5 : a.y;
      const ex = (a.x + b.x) * 0.5;
      const ey = (a.y + b.y) * 0.5;
      spCtx.beginPath();
      spCtx.moveTo(sx, sy);
      spCtx.quadraticCurveTo(a.x, a.y, ex, ey);
      spCtx.stroke();
    }
    spCtx.globalAlpha = 1;

    // Head
    const head = segs[0];
    const angle = Math.atan2(head.y - segs[1].y, head.x - segs[1].x);
    spCtx.fillStyle = skin.colors[0];
    spCtx.beginPath(); spCtx.arc(head.x, head.y, hr, 0, Math.PI * 2); spCtx.fill();

    // Eyes
    const eyeOff = hr * 0.5, eyeR = hr * 0.28, perp = angle + Math.PI / 2;
    for (const side of [-1, 1]) {
      const ex = head.x + Math.cos(angle) * hr * 0.3 + Math.cos(perp) * eyeOff * side;
      const ey = head.y + Math.sin(angle) * hr * 0.3 + Math.sin(perp) * eyeOff * side;
      spCtx.fillStyle = '#fff'; spCtx.beginPath(); spCtx.arc(ex, ey, eyeR, 0, Math.PI * 2); spCtx.fill();
      spCtx.fillStyle = '#111'; spCtx.beginPath();
      spCtx.arc(ex + Math.cos(angle) * eyeR * 0.3, ey + Math.sin(angle) * eyeR * 0.3, eyeR * 0.55, 0, Math.PI * 2);
      spCtx.fill();
    }

    // Accessory
    drawAccessory(spCtx, selectedAccessory, head.x, head.y, hr, angle);

    requestAnimationFrame(updateSkinPreview);
  }

  skinsBtn.addEventListener('click', () => {
    startScreen.style.display='none';
    skinScreen.style.display='flex';
    // Force correct layout regardless of cached HTML structure
    const inner = skinScreen.querySelector('.skin-inner') || skinScreen;
    const preview = document.getElementById('skinPreview');
    if (preview) {
      preview.style.display = 'block';
      preview.style.margin = '0 auto 12px';
      preview.style.maxWidth = '400px';
      preview.style.width = '100%';
    }
    inner.style.maxWidth = '580px';
    inner.style.margin = '20px auto';
    inner.style.display = 'flex';
    inner.style.flexDirection = 'column';
    inner.style.alignItems = 'center';
    inner.style.padding = '0 16px 40px';
    updateSkinPreview();
  });
  skinBackBtn.addEventListener('click', () => { skinScreen.style.display='none'; startScreen.style.display='flex'; });

  // --- Helpers ---
  function hexFull(c) { if (c.length===4) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c; }
  function getSegColor(snake, i) { const skin = SKINS[snake.skin]||SKINS[0]; return skin.colors[i%skin.colors.length]; }
  // Logarithmic — never caps, but slows down. 0→1.0, 100→1.48, 500→1.85, 2000→2.20, 10000→2.60
  function getThickness(snake) { return 1 + Math.sqrt(snake.score) / 45 + snake.score / 8000; }

  function updateProgressPanel() {
    const bestEl = document.getElementById('bestScoreDisplay');
    const nextEl = document.getElementById('nextUnlockDisplay');
    if (bestEl) bestEl.textContent = bestScore;
    const locked = SKINS
      .filter(s => s.unlockScore && s.unlockScore > bestScore)
      .sort((a, b) => a.unlockScore - b.unlockScore);
    if (nextEl) {
      if (locked.length > 0) {
        nextEl.textContent = `${locked[0].name} skin @ ${locked[0].unlockScore}`;
      } else {
        nextEl.textContent = 'All skins unlocked';
      }
    }
  }

  function saveBestScore(score) {
    if (score <= bestScore) return;
    bestScore = score;
    localStorage.setItem('snakeBestScore', String(bestScore));
    updateProgressPanel();
    buildSkinGrid();
  }

  function applyModeSelection() {
    const cm = document.getElementById('classicModeBtn');
    const rm = document.getElementById('royaleModeBtn');
    if (cm) cm.classList.toggle('active', selectedLocalMode === 'classic');
    if (rm) rm.classList.toggle('active', selectedLocalMode === 'royale');
    localStorage.setItem('selectedLocalMode', selectedLocalMode);
  }
  // --- Game state (must be declared before frame loop touches them) ---
  let snakes = [], food = [], megaOrbs = [], particles = [];
  let prevSnakes = []; // previous frame snakes for interpolation
  let interpT = 1; // interpolation factor 0→1 between state updates
  // Continuously-smoothed display positions (per-snake, per-segment)
  const displaySegs = new Map(); // snakeId → array of {x, y}
  // Client-side prediction state (player's own snake)
  const predict = { x: 0, y: 0, angle: 0, valid: false };
  let prevFood = []; // previous food array for spawn detection
  let screenFlash = null; // {color, alpha, timer} for mega orb eat flash
  let myId = null, ws = null, localGame = null;
  let gameMode = null; // 'local' | 'multiplayer'
  let currentRoomId = null;
  let running = false;
  let camera = { x: 0, y: 0 };
  let mouseX = 0, mouseY = 0, boosting = false;
  let screenShake = 0, lastFrame = 0, animTime = 0;
  let zoom = BASE_ZOOM, lastScore = 0, sendTimer = 0;
  let roomPollInterval = null;

  // --- Score popups ---
  let scorePopups = [];
  let prevScore = 0;

  // --- Kill feed ---
  let killFeed = [];
  // Battle Royale state mirrored from server (null when not in BR room)
  let mpRoyale = null;
  // Royale "sealed" notice on home/room screens
  let royaleSealedTimer = 0;
  // Local royale phase tracker — refreshed each frame from LocalGame.getRoyaleStatus()
  let localRoyaleStatus = null;
  // Ephemeral banner notifications (e.g. "ZONE IS NOW CLOSING")
  let royaleBanners = []; // { text, sub, color, life, total }

  // ---- Zone Domination (multiplayer) ----
  // domLayout: static-ish board {v,mapW,mapH,roundMs,teams:[{id,name,color}],zones:[{id,x,y,r,type,home,core,adj}]}
  // mpDom: frequent state {state,timeLeft,endLeft,overtime,winner,event,teams:[{id,score,res}],zones:[{id,o,p,l,cap,core,hot,grp}]}
  let domLayout = null, mpDom = null;
  let domZoneById = new Map();   // id → layout zone
  let domTeamById = new Map();   // id → {id,name,color}
  let domStateById = new Map();  // id → live zone state
  let domBanner = null;          // { text, sub, color, life, total }
  let intendedDom = false;       // joined a domination room — guards the old-server fallback
  let domHandshakeTimer = null;
  let selectedRole = parseInt(localStorage.getItem('domRole') || '0', 10) || 0;
  const ROLE_NAMES = ['Scout', 'Defender', 'Collector', 'Commander'];
  const ZONE_NORMAL = 0, ZONE_VIP = 1, ZONE_HOME = 2, ZONE_RESOURCE = 3;

  // --- Parallax starfield ---
  // Tints: white, soft teal, cool blue (no purple/pink).
  const STAR_TINTS = ['#ffffff', '#ffffff', '#ffffff', '#7dd3fc', '#5eead4', '#cffafe'];
  const stars = [];
  for (let i = 0; i < 280; i++) {
    stars.push({
      x: (Math.random() - 0.5) * MAP_SIZE * 1.5,
      y: (Math.random() - 0.5) * MAP_SIZE * 1.5,
      size: 0.4 + Math.random() * 1.8,
      brightness: 0.22 + Math.random() * 0.55,
      twinkleSpeed: 0.6 + Math.random() * 1.4,
      twinklePhase: Math.random() * Math.PI * 2,
      tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
    });
  }
  // Nebula cloud blobs — deep-blue / teal palette only, low alpha so they
  // sit subtly behind the play area instead of competing with it.
  const NEBULA_COLORS = ['#0c4a6e', '#164e63', '#022c43', '#0f172a', '#155e75', '#0e7490'];
  const nebulae = [];
  for (let i = 0; i < 7; i++) {
    nebulae.push({
      x: (Math.random() - 0.5) * MAP_SIZE * 1.4,
      y: (Math.random() - 0.5) * MAP_SIZE * 1.4,
      radius: 700 + Math.random() * 900,
      color: NEBULA_COLORS[i % NEBULA_COLORS.length],
      alpha: 0.10 + Math.random() * 0.10,
    });
  }
  // Cosmic dust — faint drifting particles that replace the grid as the
  // "you are moving through space" visual cue. Each particle moves with
  // its own slow drift vector so the field never sits still.
  const dust = [];
  for (let i = 0; i < 180; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 14;
    dust.push({
      x: (Math.random() - 0.5) * MAP_SIZE * 1.2,
      y: (Math.random() - 0.5) * MAP_SIZE * 1.2,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: 0.6 + Math.random() * 1.2,
      alpha: 0.12 + Math.random() * 0.18,
      tint: Math.random() < 0.4 ? '#5eead4' : '#ffffff',
    });
  }

  // Food orb sprite cache — pre-rendered glossy orbs keyed by (color, tier, size)
  // so we don't re-run createRadialGradient × N every frame.
  const foodSpriteCache = new Map();
  function getFoodSprite(colorIdx, tier, sizeKey) {
    const key = colorIdx + '_' + tier + '_' + sizeKey;
    let entry = foodSpriteCache.get(key);
    if (entry) return entry;
    const r = sizeKey;
    const pad = Math.ceil(r * 1.6);
    const size = (r + pad) * 2;
    const off = document.createElement('canvas');
    off.width = off.height = size;
    const fc = off.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const color = COLORS[colorIdx] || COLORS[0];
    const colorFull = hexFull(color);

    // Slither.io-style: bright glow halo around a flat saturated core.
    // No drop shadow, no rim ring, no harsh gradients — just light.
    const haloR = r + pad;
    const haloA = tier >= 6 ? 0.55 : tier >= 4 ? 0.42 : tier >= 2 ? 0.30 : 0.22;
    const halo = fc.createRadialGradient(cx, cy, r * 0.75, cx, cy, haloR);
    halo.addColorStop(0, colorFull + Math.floor(haloA * 255).toString(16).padStart(2, '0'));
    halo.addColorStop(1, colorFull + '00');
    fc.fillStyle = halo;
    fc.beginPath(); fc.arc(cx, cy, haloR, 0, Math.PI * 2); fc.fill();

    // Flat colored core — clean and saturated, no inner gradient
    fc.fillStyle = colorFull;
    fc.beginPath(); fc.arc(cx, cy, r, 0, Math.PI * 2); fc.fill();

    // Tiny soft highlight — just enough to read as a sphere, not a flat disc
    const hl = fc.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0,
                                        cx - r * 0.25, cy - r * 0.25, r * 0.55);
    hl.addColorStop(0, 'rgba(255,255,255,0.45)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    fc.fillStyle = hl;
    fc.beginPath();
    fc.arc(cx - r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
    fc.fill();

    entry = { canvas: off, half: size / 2 };
    foodSpriteCache.set(key, entry);
    return entry;
  }
  function lighten(hex, amt) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const nr = Math.min(255, Math.round(r + (255-r)*amt));
    const ng = Math.min(255, Math.round(g + (255-g)*amt));
    const nb = Math.min(255, Math.round(b + (255-b)*amt));
    return '#' + nr.toString(16).padStart(2,'0') + ng.toString(16).padStart(2,'0') + nb.toString(16).padStart(2,'0');
  }
  function darken(hex, amt) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return '#' + Math.round(r*(1-amt)).toString(16).padStart(2,'0')
               + Math.round(g*(1-amt)).toString(16).padStart(2,'0')
               + Math.round(b*(1-amt)).toString(16).padStart(2,'0');
  }

  // --- Score counter animation ---
  let displayScore = 0;

  // --- Boost speed lines ---
  const speedLines = [];
  for (let i = 0; i < 8; i++) {
    speedLines.push({ angle: (Math.PI * 2 / 8) * i, len: 60 + Math.random() * 120 });
  }
  let speedLineRotation = 0;

  // --- Freeze frame on kill ---
  let freezeTimer = 0;

  // --- Death zoom / spectate ---
  let spectateTimer = 0;
  let spectateTarget = null;
  let lastKillerPos = null;

  // --- Ping display (heavily smoothed) ---
  let lastPingSent = 0;
  let ping = 0;
  let smoothPing = 0;
  let pingTimer = 0; // send ping every 2 seconds, not every frame
  let lastStateTime = 0; // track state arrival timing

  // --- Kill counter ---
  let myKills = 0;
  const snakeNameCache = new Map(); // id → name, persists after death

  // --- Settings (persisted in localStorage) ---
  // Default OFF — cosmic dust + nebulae read better than the grid in BR
  let showGrid = localStorage.getItem('setting_showGrid') === 'true';
  let showParticles = localStorage.getItem('setting_showParticles') !== 'false';
  let showShake = localStorage.getItem('setting_showShake') !== 'false';

  // --- Death stats tracking ---
  let lifeStartTime = 0;
  let foodEaten = 0;
  let peakScore = 0;

  // --- Emote system ---
  const EMOTES = ['GG', 'Nice!', 'Watch out', 'LOL', 'RIP', '\u{1F44B}'];
  let emoteDisplays = []; // [{snakeId, text, timer}]
  let emoteWheelOpen = false;

  // --- Online count polling ---
  let onlineCountInterval = null;

  // --- Top snake tracking ---
  let topSnakeId = null;

  // --- Mobile virtual joystick ---
  const isTouchDevice = ('ontouchstart' in window);
  let joystickActive = false;
  let joystickTouchId = null;
  let joystickAngle = 0;
  const joystickCenter = { x: 100, y: 0 }; // y set on resize
  const joystickRadius = 60;
  let joystickDelta = { x: 0, y: 0 };

  // --- Resize ---
  function resize() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    joystickCenter.y = canvas.height - 100;
  }
  window.addEventListener('resize', resize); resize();

  // --- Input ---
  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  // Wire the in-game Leave button
  {
    const leaveBtn = document.getElementById('leaveBtn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        // Confirm if mid-active-BR (you can't rejoin)
        const inBR = (localGame && localGame.mode === 'royale') ||
                     (mpRoyale && (mpRoyale.state === 'active' || mpRoyale.state === 'countdown'));
        if (inBR && !confirm('Leave the Battle Royale? You cannot rejoin this match.')) return;
        dismissVictoryToHome();
      });
      leaveBtn.addEventListener('mouseenter', () => {
        leaveBtn.style.background = 'rgba(251, 113, 133, 0.16)';
        leaveBtn.style.color = '#fb7185';
        leaveBtn.style.borderColor = 'rgba(251, 113, 133, 0.7)';
      });
      leaveBtn.addEventListener('mouseleave', () => {
        leaveBtn.style.background = 'rgba(10, 12, 28, 0.82)';
        leaveBtn.style.color = '#f1f5f9';
        leaveBtn.style.borderColor = 'rgba(251, 113, 133, 0.4)';
      });
    }
  }

  // Dismissal: tap during Victory Royale / match-over returns to home menu.
  function dismissVictoryToHome() {
    running = false;
    localGame = null;
    localRoyaleStatus = null;
    mpRoyale = null;
    spectatingBR = false;
    intendedBR = false;
    if (brHandshakeTimer) { clearTimeout(brHandshakeTimer); brHandshakeTimer = null; }
    clearVictoryConfetti();
    try { if (ws && ws.readyState <= 1) ws.close(); } catch {}
    hideAllScreens();
    document.body.style.cursor = 'default';
    startScreen.style.display = 'flex';
    const menuBg = document.getElementById('menuBg');
    if (menuBg) menuBg.style.display = 'block';
  }
  canvas.addEventListener('mousedown', () => {
    const inVictory = localRoyaleStatus && localRoyaleStatus.matchState === 'victory';
    const mpEnded = mpRoyale && mpRoyale.state === 'ended';
    if (inVictory || mpEnded) { dismissVictoryToHome(); return; }
    setBoosting(true);
  });
  canvas.addEventListener('mouseup', () => setBoosting(false));
  window.addEventListener('keydown', (e) => { if (e.code==='Space') { e.preventDefault(); setBoosting(true); } });
  window.addEventListener('keyup', (e) => { if (e.code==='Space') setBoosting(false); });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isTouchDevice && joystickActive) {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === joystickTouchId) {
          joystickDelta.x = t.clientX - joystickCenter.x;
          joystickDelta.y = t.clientY - joystickCenter.y;
          const dist = Math.sqrt(joystickDelta.x * joystickDelta.x + joystickDelta.y * joystickDelta.y);
          if (dist > 5) joystickAngle = Math.atan2(joystickDelta.y, joystickDelta.x);
          if (dist > joystickRadius) { joystickDelta.x *= joystickRadius/dist; joystickDelta.y *= joystickRadius/dist; }
          continue;
        }
      }
    } else {
      mouseX=e.touches[0].clientX; mouseY=e.touches[0].clientY;
    }
  }, {passive:false});
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // BR end / victory: tap returns to home
    const inVictory = localRoyaleStatus && localRoyaleStatus.matchState === 'victory';
    const mpEnded = mpRoyale && mpRoyale.state === 'ended';
    if (inVictory || mpEnded) { dismissVictoryToHome(); return; }
    if (isTouchDevice) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const dx = t.clientX - joystickCenter.x, dy = t.clientY - joystickCenter.y;
        if (Math.sqrt(dx*dx+dy*dy) < joystickRadius * 2 && !joystickActive) {
          joystickActive = true;
          joystickTouchId = t.identifier;
          joystickDelta.x = dx; joystickDelta.y = dy;
          continue;
        }
      }
    }
    mouseX=e.touches[0].clientX; mouseY=e.touches[0].clientY;
    if(e.touches.length>=2) setBoosting(true);
  }, {passive:false});
  canvas.addEventListener('touchend', (e) => {
    if(e.touches.length<2) setBoosting(false);
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        joystickActive = false; joystickTouchId = null; joystickDelta.x = 0; joystickDelta.y = 0;
      }
    }
  });

  function setBoosting(val) {
    boosting = val;
    if (gameMode==='multiplayer' && ws && ws.readyState===WebSocket.OPEN) {
      const buf = new Uint8Array(2); buf[0]=0x02; buf[1]=val?1:0; ws.send(buf);
    }
  }

  // =====================================================
  // Mode selection
  // =====================================================
  const classicModeBtn = document.getElementById('classicModeBtn');
  const royaleModeBtn = document.getElementById('royaleModeBtn');
  if (classicModeBtn && royaleModeBtn) {
    classicModeBtn.addEventListener('click', () => { selectedLocalMode = 'classic'; applyModeSelection(); });
    royaleModeBtn.addEventListener('click', () => { selectedLocalMode = 'royale'; applyModeSelection(); });
  }
  applyModeSelection();
  updateProgressPanel();

  playAIBtn.addEventListener('click', startLocalGame);
  nameInput.addEventListener('keydown', (e) => { if (e.key==='Enter') startLocalGame(); });
  respawnBtn.addEventListener('click', () => {
    if (gameMode==='local') startLocalGame();
    else if (gameMode==='multiplayer') startMultiplayerGame(currentRoomId, selectedTeamId >= 0 ? selectedTeamId : undefined);
  });

  // Spectate: dismiss death screen, keep watching the match. Camera will
  // follow the leader (highest-score alive snake).
  let spectatingBR = false;
  const spectateBtn = document.getElementById('spectateBtn');
  if (spectateBtn) {
    spectateBtn.addEventListener('click', () => {
      spectatingBR = true;
      deathScreen.style.display = 'none';
      hud.style.display = 'block';
      document.body.style.cursor = 'crosshair';
      running = true;
    });
  }

  // Main menu from death screen
  const mainMenuBtn = document.getElementById('mainMenuBtn');
  mainMenuBtn.addEventListener('click', () => {
    disconnect();
    gameMode = null; running = false; myId = null; localGame = null;
    snakes = []; food = []; megaOrbs = []; particles = [];
    prevSnakes = []; interpT = 1; prevFood = []; screenFlash = null;
    zoom = BASE_ZOOM; lastScore = 0; displayScore = 0; prevScore = 0;
    myKills = 0; scorePopups = []; killFeed = [];
    freezeTimer = 0; spectateTimer = 0; spectateTarget = null; lastKillerPos = null;
    mpDom = null; domLayout = null; domBanner = null; intendedDom = false;
    domStateById = new Map(); domZoneById = new Map(); domTeamById = new Map();
    hideAllScreens(); startScreen.style.display = 'flex';
  });

  multiplayerBtn.addEventListener('click', () => {
    hideAllScreens(); roomScreen.style.display='flex';
    fetchRooms();
    roomPollInterval = setInterval(fetchRooms, 3000);
  });
  roomBackBtn.addEventListener('click', () => {
    hideAllScreens(); startScreen.style.display='flex';
    if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval=null; }
  });
  teamBackBtn.addEventListener('click', () => { hideAllScreens(); roomScreen.style.display='flex'; fetchRooms(); roomPollInterval=setInterval(fetchRooms,3000); });

  // Create room flow
  createRoomBtn.addEventListener('click', () => { hideAllScreens(); createRoomScreen.style.display='flex'; });
  createRoomBackBtn.addEventListener('click', () => { hideAllScreens(); roomScreen.style.display='flex'; fetchRooms(); roomPollInterval=setInterval(fetchRooms,3000); });
  roomModeSelect.addEventListener('change', () => {
    const m = roomModeSelect.value;
    roomTeamSizeSelect.style.display = m==='team' ? 'block' : 'none';
    const teamWrap = document.getElementById('teamSizeField');
    if (teamWrap) teamWrap.style.display = m==='team' ? 'block' : 'none';
    const brPanel = document.getElementById('brSettingsPanel');
    if (brPanel) brPanel.style.display = m==='royale' ? 'block' : 'none';
    const domWrap = document.getElementById('domTeamsField');
    if (domWrap) domWrap.style.display = m==='domination' ? 'block' : 'none';
  });
  function gatherBRConfig() {
    const sizeMap = { max: 0, large: 5000, medium: 3500, tight: 2000 };
    const speedMap = { slow: 1.4, normal: 1.0, fast: 0.7 };
    const orbMap = { few: 4, normal: 8, many: 16 };
    const startKey = (document.getElementById('brStartSize') || {}).value || 'max';
    const speedKey = (document.getElementById('brPhaseSpeed') || {}).value || 'normal';
    const diffKey = (document.getElementById('brBotDifficulty') || {}).value || 'mixed';
    const orbKey = (document.getElementById('brMegaOrbs') || {}).value || 'normal';
    return {
      startRadius: sizeMap[startKey] || 0,  // 0 means "use default max"
      phaseSpeed: speedMap[speedKey] || 1,
      botDifficulty: diffKey,
      megaOrbs: orbMap[orbKey] || 8,
    };
  }
  createRoomSubmit.addEventListener('click', async () => {
    const rName = roomNameInput.value.trim() || 'Custom Room';
    const mode = roomModeSelect.value;
    const teamSize = parseInt(roomTeamSizeSelect.value) || 2;
    const royaleConfig = mode === 'royale' ? gatherBRConfig() : null;
    const numTeams = mode === 'domination'
      ? (parseInt((document.getElementById('roomDomTeams')||{}).value) || 2) : 2;
    try {
      const res = await fetch(SERVER_URL + '/api/rooms', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          name: rName, mode, teamSize, numTeams,
          creatorName: nameInput.value.trim(),
          royaleConfig,
        }),
      });
      const data = await res.json();
      if (data.id) {
        hideAllScreens();
        if (mode === 'team') showTeamSelector(data.id, null, 'team');
        else if (mode === 'domination') showTeamSelector(data.id, null, 'domination');
        else startMultiplayerGame(data.id);
      }
    } catch(e) { console.error('Create room failed:', e); }
  });

  // --- PLAY VS AI ---
  function startLocalGame() {
    gameMode = 'local';
    spectatingBR = false;
    myKills = 0; displayScore = 0; prevScore = 0; scorePopups = []; killFeed = [];
    lifeStartTime = performance.now(); foodEaten = 0; peakScore = 0; emoteDisplays = [];
    freezeTimer = 0; spectateTimer = 0; spectateTarget = null; lastKillerPos = null;
    const name = nameInput.value.trim() || 'Player';
    localGame = new LocalGame(name, selectedSkin, selectedLocalMode);
    myId = localGame.playerId;
    localGame.onPlayerDeath((score, rank) => {
      saveBestScore(score);
      lastScore = score;
      if (score > peakScore) peakScore = score;
      finalScoreEl.textContent = score;
      populateDeathStats();
      const titleEl = document.getElementById('deathTitle');
      const badgeEl = document.getElementById('brRankBadge');
      const spectateEl = document.getElementById('spectateBtn');
      if (rank != null) {
        const total = localGame ? localGame.snakes.length : 20;
        if (titleEl) titleEl.textContent = 'ELIMINATED';
        if (badgeEl) {
          badgeEl.style.display = 'block';
          badgeEl.textContent = `#${rank} of ${total}`;
        }
        if (spectateEl) spectateEl.style.display = '';
      } else {
        if (titleEl) titleEl.textContent = 'YOU DIED';
        if (badgeEl) badgeEl.style.display = 'none';
        if (spectateEl) spectateEl.style.display = 'none';
      }
      deathScreen.style.display = 'flex';
      document.body.style.cursor = 'default';
      screenShake = 15;
      // Don't fully stop running in BR — keep simulating so Spectate works.
      running = !!(localGame && localGame.mode === 'royale');
    });
    // Set initial camera
    const me = localGame.snakes.find(s => s.id === myId);
    if (me) { camera.x = me.segments[0].x; camera.y = me.segments[0].y; }
    hideAllScreens(); hud.style.display='block'; document.body.style.cursor='crosshair'; running=true;
  }

  // --- MULTIPLAYER ---
  // Filter + search state for the room browser
  let roomFilter = 'all';        // 'all' | 'solo' | 'royale' | 'team'
  let roomSearchTerm = '';
  let lastRoomData = [];

  function renderRoomList() {
    const rooms = lastRoomData;
    roomList.innerHTML = '';
    // Apply filter + search
    const term = roomSearchTerm.trim().toLowerCase();
    const filtered = rooms.filter(r => {
      if (roomFilter !== 'all' && r.mode !== roomFilter) return false;
      if (!term) return true;
      return r.name.toLowerCase().includes(term) ||
             (r.code && r.code.toLowerCase().includes(term));
    });
    // Empty state
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'room-empty';
      empty.innerHTML = term
        ? `<div class="room-empty-icon">🔍</div>No rooms match "${escapeHtml(term)}"`
        : `<div class="room-empty-icon">🎮</div>No ${roomFilter === 'all' ? '' : roomFilter + ' '}matches running yet.<br>Be the first — hit <strong>Create Room</strong>.`;
      roomList.appendChild(empty);
    } else {
      for (const room of filtered) roomList.appendChild(buildRoomCard(room));
    }
    // Summary line
    const summary = document.getElementById('roomSummary');
    if (summary) {
      const live = rooms.filter(r => r.players > 0).length;
      summary.innerHTML = `<strong>${rooms.length}</strong> rooms · <strong>${live}</strong> live`;
    }
  }

  function buildRoomCard(room) {
    const card = document.createElement('div');
    const modeCls = `mode-${room.mode}`;
    const isFull = room.players >= room.maxPlayers;
    card.className = `room-card ${modeCls}${isFull ? ' full' : ''}`;

    // Mode icon: M-letter or symbol
    const icons = {
      solo:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>`,
      team:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M3 18c0-3 3-5 6-5s6 2 6 5"/><path d="M14 14c2 0 4 1.5 4 4"/></svg>`,
      royale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l3-12 4 7 2-4 2 4 4-7 3 12z"/></svg>`,
      domination: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><circle cx="12" cy="12" r="2"/></svg>`,
    };

    // Status badge for royale lobby/countdown
    let statusBadge = '';
    if (room.mode === 'royale') {
      if (room.royaleState === 'countdown' && room.royaleCountdownMs > 0) {
        const secs = Math.ceil(room.royaleCountdownMs / 1000);
        statusBadge = `<span class="mode-badge live">STARTS IN ${secs}s</span>`;
      } else if (room.royaleState === 'lobby') {
        statusBadge = `<span class="mode-badge royale">WAITING</span>`;
      }
    }
    const customBadge = room.isCustom ? `<span class="mode-badge custom">CUSTOM</span>` : '';
    const modeName = room.mode === 'royale' ? 'Battle Royale'
                   : room.mode === 'team'   ? `Team ${room.teamSize}v${room.teamSize}`
                   : room.mode === 'domination' ? 'Zone Domination'
                   : 'Free for All';
    const creatorLine = room.isCustom && room.creatorName
      ? `<span>by ${escapeHtml(room.creatorName)}</span><span class="sep">·</span>`
      : '';
    const codePill = (room.isCustom && room.code)
      ? `<button class="copy-code-pill" data-code="${room.code}" title="Copy room code">${room.code}</button>`
      : '';

    const fillPct = Math.round((room.players / room.maxPlayers) * 100);

    card.innerHTML = `
      <div class="room-mode-icon ${modeCls}">${icons[room.mode] || icons.solo}</div>
      <div class="room-info">
        <div class="room-title-row">
          <span class="room-name">${escapeHtml(room.name)}</span>
          ${statusBadge}
          ${customBadge}
          ${codePill}
        </div>
        <div class="room-meta">
          <span>${modeName}</span>
          <span class="sep">·</span>
          ${creatorLine}
          <span>${room.players === 0 ? 'Empty lobby' : (room.players === 1 ? '1 snake' : `${room.players} snakes`)}</span>
        </div>
      </div>
      <div class="room-fill">
        <div class="room-fill-count">${room.players}<span class="max">/${room.maxPlayers}</span></div>
        <div class="room-fill-bar"><div class="room-fill-bar-inner" style="width:${fillPct}%;"></div></div>
      </div>
    `;

    const codeBtn = card.querySelector('.copy-code-pill');
    if (codeBtn) {
      codeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeBtn.dataset.code).then(() => {
          const orig = codeBtn.textContent;
          codeBtn.textContent = 'COPIED';
          setTimeout(() => { codeBtn.textContent = orig; }, 1400);
        });
      });
    }
    if (!isFull) {
      card.addEventListener('click', () => {
        const joinRoom = () => {
          if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval = null; }
          if (room.mode === 'team' || room.mode === 'domination') showTeamSelector(room.id, room.teams, room.mode);
          else startMultiplayerGame(room.id);
        };
        if (room.mode === 'royale') showBRJoinConfirm(room, joinRoom);
        else joinRoom();
      });
    }
    return card;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  async function fetchRooms() {
    try {
      const res = await fetch(SERVER_URL + '/api/rooms');
      const rooms = await res.json();
      lastRoomData = rooms;
      renderRoomList();
    } catch (e) {
      roomList.innerHTML = `
        <div class="room-empty">
          <div class="room-empty-icon">⚠</div>
          Could not reach the server.<br>
          <span style="font-size:11px;opacity:0.7;">Check your connection or pick a different server in settings.</span>
        </div>`;
    }
  }

  // Wire filter tabs + search input (once)
  {
    const tabContainer = document.getElementById('roomFilterTabs');
    if (tabContainer) {
      tabContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-tab');
        if (!btn) return;
        roomFilter = btn.dataset.filter;
        for (const t of tabContainer.querySelectorAll('.filter-tab')) {
          t.classList.toggle('active', t === btn);
        }
        renderRoomList();
      });
    }
    const searchInput = document.getElementById('roomSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        roomSearchTerm = searchInput.value;
        renderRoomList();
      });
    }
    const clearBtn = document.getElementById('roomSearchClear');
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        roomSearchTerm = '';
        renderRoomList();
        searchInput.focus();
      });
    }
  }

  let pendingRoomId = null;
  let selectedTeamId = -1;

  let pendingMode = 'team';
  function showTeamSelector(roomId, teams, mode) {
    pendingRoomId = roomId;
    pendingMode = mode || 'team';
    hideAllScreens();
    teamScreen.style.display = 'flex';
    // Retitle the screen for domination (role + team)
    const titleEl = teamScreen.querySelector('.screen-title');
    const subEl = teamScreen.querySelector('.screen-title-sub');
    if (titleEl) titleEl.textContent = pendingMode === 'domination' ? 'Choose Role & Team' : 'Pick Your Team';
    if (subEl) subEl.textContent = pendingMode === 'domination'
      ? 'Roles give territorial edges — never speed or growth' : 'Choose a color to fight alongside';
    teamGrid.innerHTML = '';
    // If we have team data, show it. Otherwise fetch fresh.
    if (teams) renderTeams(teams);
    else fetch(SERVER_URL+'/api/rooms').then(r=>r.json()).then(rooms=>{
      const room = rooms.find(r=>r.id===roomId);
      if (room && room.teams) renderTeams(room.teams);
    });
  }

  // Zone Domination roles — territorial modifiers only (no stat boosts).
  const DOM_ROLE_INFO = [
    ['Scout',     '👁', 'Wider battlefield vision'],
    ['Defender',  '🛡', 'Slows enemies taking your zones'],
    ['Collector', '⬡', 'Eating funds the team economy'],
    ['Commander', '★', 'Captures faster — rally the team'],
  ];
  function renderTeams(teams) {
    teamGrid.innerHTML = '';
    // Domination: a full-width role picker above the team cards
    if (pendingMode === 'domination') {
      const row = document.createElement('div');
      row.style.cssText = 'grid-column:1/-1; display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:4px;';
      DOM_ROLE_INFO.forEach((ri, i) => {
        const b = document.createElement('button');
        const active = i === selectedRole;
        b.style.cssText = `flex:1 1 120px; max-width:200px; cursor:pointer; text-align:center;
          padding:12px 10px; border-radius:12px; transition:all .15s ease;
          background:${active ? 'rgba(94,234,212,0.14)' : 'rgba(255,255,255,0.04)'};
          border:1px solid ${active ? 'rgba(94,234,212,0.7)' : 'rgba(255,255,255,0.1)'};
          color:#eef5ff; font-family:'Inter',sans-serif;`;
        b.innerHTML = `<div style="font-size:20px;line-height:1">${ri[1]}</div>
          <div style="font-weight:800;font-size:13px;margin-top:5px">${ri[0]}</div>
          <div style="font-size:10px;color:#9fb3c8;margin-top:3px;line-height:1.3">${ri[2]}</div>`;
        b.addEventListener('click', () => { selectedRole = i; localStorage.setItem('domRole', String(i)); renderTeams(teams); });
        row.appendChild(b);
      });
      teamGrid.appendChild(row);
      const hint = document.createElement('div');
      hint.style.cssText = 'grid-column:1/-1; text-align:center; color:#9fb3c8; font-size:12px; margin:6px 0 4px;';
      hint.textContent = 'Then pick a team to deploy →';
      teamGrid.appendChild(hint);
    }
    for (const team of teams) {
      const card = document.createElement('div');
      card.className = 'team-card';
      const label = pendingMode === 'domination'
        ? `${team.members} on team` : `${team.members} ${team.members === 1 ? 'bot' : 'bots'}`;
      card.innerHTML = `<div class="team-color" style="background:${team.color};box-shadow:0 0 10px ${team.color}"></div>
        <div class="team-name">${team.name}</div>
        <div class="team-count">${label}</div>`;
      card.addEventListener('click', () => {
        selectedTeamId = team.id;
        startMultiplayerGame(pendingRoomId, team.id);
      });
      teamGrid.appendChild(card);
    }
  }

  // Confirmation overlay before joining a Battle Royale room — players need
  // to know there's no respawn before they commit.
  function showBRJoinConfirm(room, onConfirm) {
    const existing = document.getElementById('brJoinConfirm');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'brJoinConfirm';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(2, 6, 23, 0.78); backdrop-filter: blur(8px);
      animation: fadeIn 0.2s ease;
    `;
    const stateText = room.royaleState === 'countdown'
      ? `Starts in ${Math.max(1, Math.ceil((room.royaleCountdownMs || 0) / 1000))}s`
      : 'Waiting for players';
    overlay.innerHTML = `
      <div style="
        max-width: 440px; width: 90%;
        background: linear-gradient(180deg, rgba(20,24,48,0.96), rgba(10,12,28,0.96));
        border: 1px solid rgba(251,113,133,0.4);
        border-radius: 20px;
        padding: 28px 26px 22px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
        font-family: 'Inter', sans-serif;
        color: #f1f5f9;
        text-align: center;
      ">
        <div style="font-size: 11px; letter-spacing: 2px; color: #fb7185; font-weight: 800; margin-bottom: 8px;">
          BATTLE ROYALE
        </div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 800; margin-bottom: 16px;">
          ${room.name}
        </div>
        <div style="
          background: rgba(251,113,133,0.10);
          border: 1px solid rgba(251,113,133,0.30);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 18px;
          text-align: left;
          font-size: 13px;
          line-height: 1.55;
        ">
          <div style="color:#fb7185;font-weight:800;letter-spacing:0.5px;margin-bottom:6px;">⚠ NO RESPAWN</div>
          <div style="color:#cbd5e1;">
            20 snakes drop in. The zone closes in phases. Last one alive wins
            the <strong style="color:#fbbf24;">Victory Royale</strong>. If you die,
            the match continues without you.
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;font-size:12px;color:#94a3b8;margin-bottom:18px;">
          <span>${room.players}/${room.maxPlayers} joined</span>
          <span>·</span>
          <span>${stateText}</span>
        </div>
        <div style="display:flex;gap:10px;">
          <button id="brJoinCancel" class="btn btn-ghost btn-sm" style="flex:1;">Cancel</button>
          <button id="brJoinGo" class="btn btn-primary btn-sm" style="flex:2;background:linear-gradient(135deg,#fb7185,#f43f5e);">DROP IN</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#brJoinCancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#brJoinGo').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }

  // Remember whether the user *intended* to join a BR room so the client
  // can warn them when the server returns no BR state (server out of date).
  let intendedBR = false;
  let brHandshakeTimer = null;
  function startMultiplayerGame(roomId, teamId) {
    gameMode = 'multiplayer';
    spectatingBR = false;
    // Track whether the room we're joining is BR (room data was last cached)
    const cached = (lastRoomData || []).find(r => r.id === roomId);
    intendedBR = !!(cached && cached.mode === 'royale');
    intendedDom = !!(cached && cached.mode === 'domination');
    if (brHandshakeTimer) { clearTimeout(brHandshakeTimer); brHandshakeTimer = null; }
    if (domHandshakeTimer) { clearTimeout(domHandshakeTimer); domHandshakeTimer = null; }
    if (intendedDom) {
      domHandshakeTimer = setTimeout(() => {
        if (intendedDom && !domLayout) {
          alert('Zone Domination isn\'t available on this server yet — it\'s running an\n' +
                'older build. Try again in a couple of minutes (the server redeploys\n' +
                'automatically).');
        }
        domHandshakeTimer = null;
      }, 4000);
    }
    if (intendedBR) {
      // Give the server up to 4s to send any 0x08 royale-state packet.
      // If none arrives, the server is running an older build that doesn't
      // know about Battle Royale — surface it instead of dropping the
      // user into a normal-looking game.
      brHandshakeTimer = setTimeout(() => {
        if (intendedBR && !mpRoyale) {
          alert(
            'Battle Royale isn\'t available on this server yet — the server\n' +
            'is running an older build. The match has fallen back to a normal\n' +
            'multiplayer game. Try again in a couple of minutes (the server\n' +
            'redeploys automatically) or switch to single-player BR for now.'
          );
        }
        brHandshakeTimer = null;
      }, 4000);
    }
    myKills = 0; displayScore = 0; prevScore = 0; scorePopups = []; killFeed = [];
    lifeStartTime = performance.now(); foodEaten = 0; peakScore = 0; emoteDisplays = [];
    freezeTimer = 0; spectateTimer = 0; spectateTarget = null; lastKillerPos = null;
    ping = 0; smoothPing = 0; lastPingSent = 0; lastStateTime = 0;
    displaySegs.clear();
    predict.valid = false;
    currentRoomId = roomId;
    selectedTeamId = teamId ?? -1;
    mpRoyale = null;  // reset BR state until first server packet arrives
    mpDom = null; domLayout = null; domBanner = null;       // reset domination state
    domStateById = new Map(); domZoneById = new Map(); domTeamById = new Map();
    const name = nameInput.value.trim() || 'Player';
    connect(name, roomId, selectedTeamId);
    hideAllScreens(); hud.style.display='block'; document.body.style.cursor='crosshair'; running=true;
  }

  function hideAllScreens() {
    startScreen.style.display='none'; skinScreen.style.display='none';
    roomScreen.style.display='none'; deathScreen.style.display='none';
    teamScreen.style.display='none'; createRoomScreen.style.display='none';
    hud.style.display='none';
    const sp = document.getElementById('settingsPanel');
    if (sp) sp.style.display = 'none';
    const menuBg = document.getElementById('menuBg');
    if (menuBg) menuBg.style.display = 'none';
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    closeEmoteWheel();
  }

  // --- Settings panel ---
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
    });
  }
  document.querySelectorAll('.setting-toggle').forEach(toggle => {
    const key = toggle.dataset.setting;
    const val = key === 'showGrid' ? showGrid : key === 'showParticles' ? showParticles : showShake;
    toggle.classList.toggle('on', val);
    toggle.addEventListener('click', () => {
      const isOn = !toggle.classList.contains('on');
      toggle.classList.toggle('on', isOn);
      localStorage.setItem('setting_' + key, isOn);
      if (key === 'showGrid') showGrid = isOn;
      else if (key === 'showParticles') showParticles = isOn;
      else if (key === 'showShake') showShake = isOn;
    });
  });

  // Custom server URL
  const customInput = document.getElementById('customServerInput');
  const shareSection = document.getElementById('shareSection');
  const shareLinkInput = document.getElementById('shareLinkInput');

  function updateShareSection() {
    if (!shareSection || !shareLinkInput) return;
    if (CUSTOM_SERVER_URL) {
      shareSection.style.display = 'block';
      // Build shareable link. Prefer shorthand for snakeio-*.loca.lt URLs.
      const m = CUSTOM_SERVER_URL.match(/^https?:\/\/snakeio-([a-z0-9-]+)\.loca\.lt\/?$/i);
      const base = location.origin + location.pathname;
      shareLinkInput.value = m ? `${base}?server=${m[1]}` : `${base}?server=${encodeURIComponent(CUSTOM_SERVER_URL)}`;
    } else {
      shareSection.style.display = 'none';
    }
  }

  if (customInput) {
    customInput.value = CUSTOM_SERVER_URL;
    updateShareSection();
    document.getElementById('customServerSave').addEventListener('click', () => {
      const url = customInput.value.trim().replace(/\/+$/, '');
      if (url) {
        localStorage.setItem('customServerUrl', url);
        CUSTOM_SERVER_URL = url;
        usingCustom = false;
        updateShareSection();
        showToast('Saved — checking server...', '#0ff');
        pollServerStatus();
      }
    });
    document.getElementById('customServerClear').addEventListener('click', () => {
      localStorage.removeItem('customServerUrl');
      customInput.value = '';
      CUSTOM_SERVER_URL = '';
      usingCustom = false;
      updateShareSection();
      showToast('Custom server removed — using default', '#f80');
      pollServerStatus();
    });
  }

  // Share link copy button
  const copyShareBtn = document.getElementById('copyShareLink');
  if (copyShareBtn) {
    copyShareBtn.addEventListener('click', () => {
      if (!shareLinkInput || !shareLinkInput.value) return;
      navigator.clipboard.writeText(shareLinkInput.value).then(() => {
        copyShareBtn.textContent = 'Copied!';
        setTimeout(() => { copyShareBtn.textContent = 'Copy'; }, 1500);
      });
    });
  }

  // Host guide toggle
  const toggleGuideBtn = document.getElementById('toggleHostGuide');
  const hostGuide = document.getElementById('hostGuide');
  if (toggleGuideBtn) {
    toggleGuideBtn.addEventListener('click', () => {
      const show = hostGuide.style.display === 'none';
      hostGuide.style.display = show ? 'block' : 'none';
      toggleGuideBtn.textContent = show ? 'Hide guide ↑' : 'How to host your own server →';
    });
  }

  // Populate status badges in settings (called on each poll)
  function updateServerBadges(defaultRtt, customRtt) {
    const defBadge = document.getElementById('defaultStatus');
    const cusBadge = document.getElementById('customStatus');
    const actBadge = document.getElementById('activeServerBadge');
    if (defBadge) {
      if (defaultRtt !== null) { defBadge.className = 'server-badge' + (SERVER_URL === DEFAULT_SERVER_URL ? ' active' : ' inactive'); defBadge.textContent = defaultRtt + 'ms'; }
      else { defBadge.className = 'server-badge inactive'; defBadge.textContent = 'OFFLINE'; }
    }
    if (cusBadge) {
      if (!CUSTOM_SERVER_URL) { cusBadge.className = 'server-badge inactive'; cusBadge.textContent = 'NOT SET'; }
      else if (customRtt !== null) { cusBadge.className = 'server-badge' + (SERVER_URL === CUSTOM_SERVER_URL ? ' active' : ' inactive'); cusBadge.textContent = customRtt + 'ms'; }
      else { cusBadge.className = 'server-badge inactive'; cusBadge.textContent = 'OFFLINE'; }
    }
    if (actBadge) {
      actBadge.className = 'server-badge active';
      actBadge.textContent = usingCustom ? 'CUSTOM' : 'DEFAULT';
    }
  }
  window.__updateServerBadges = updateServerBadges;

  // --- Emote wheel ---
  const chatWheel = document.getElementById('chatWheel');
  const emoteRing = document.getElementById('emoteRing');
  function buildEmoteWheel() {
    if (!emoteRing) return;
    emoteRing.innerHTML = '';
    const radius = 90;
    EMOTES.forEach((emote, i) => {
      const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
      const btn = document.createElement('button');
      btn.className = 'emote-btn';
      btn.textContent = emote;
      btn.style.left = (Math.cos(angle) * radius - 30) + 'px';
      btn.style.top = (Math.sin(angle) * radius - 30) + 'px';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sendEmote(i);
        closeEmoteWheel();
      });
      emoteRing.appendChild(btn);
    });
  }
  buildEmoteWheel();

  function openEmoteWheel() {
    if (!chatWheel || !running || myId === null) return;
    emoteWheelOpen = true;
    chatWheel.style.display = 'block';
  }
  function closeEmoteWheel() {
    if (!chatWheel) return;
    emoteWheelOpen = false;
    chatWheel.style.display = 'none';
  }
  if (chatWheel) {
    chatWheel.addEventListener('click', closeEmoteWheel);
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && running && myId !== null) {
      e.preventDefault();
      if (emoteWheelOpen) closeEmoteWheel();
      else openEmoteWheel();
    }
  });

  function sendEmote(emoteId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const buf = new Uint8Array(2);
      buf[0] = 0x07; buf[1] = emoteId;
      ws.send(buf);
    }
    if (myId !== null) {
      emoteDisplays.push({ snakeId: myId, text: EMOTES[emoteId] || '?', timer: 2 });
    }
  }

  // --- Server status indicator + online count ---
  const statusEl = document.getElementById('serverStatus');
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const statusPing = document.getElementById('statusPing');

  const ICONS = {
    checking: '<path d="M 8 1.5 A 6.5 6.5 0 0 1 14.5 8" />',
    online: '<circle cx="8" cy="8" r="3.5" fill="currentColor"/><circle cx="8" cy="8" r="6.5" opacity="0.35"/>',
    waking: '<path d="M8 3v4l2.5 2.5M8 1.5a6.5 6.5 0 1 0 6.5 6.5" />',
    laggy: '<path d="M2 10l3-3 3 3 3-3 3 3M2 6l3-3 3 3 3-3 3 3"/>',
    offline: '<circle cx="8" cy="8" r="6.5"/><path d="M4 4l8 8M12 4l-8 8" />',
  };

  function setStatus(state, text, extra) {
    if (!statusEl) return;
    statusEl.className = 'status-' + state;
    statusIcon.innerHTML = ICONS[state];
    statusText.textContent = text;
    statusPing.textContent = extra || '';
  }

  let wakingTimeout = null;
  // Check if a specific URL responds. Returns rtt (ms) or null if down.
  function checkServer(url, timeoutMs = 3000) {
    if (!url) return Promise.resolve(null);
    return new Promise(resolve => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); resolve(null); }, timeoutMs);
      const t0 = performance.now();
      fetch(url + '/api/rooms', { signal: ctrl.signal })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(() => { clearTimeout(timer); resolve(Math.round(performance.now() - t0)); })
        .catch(() => { clearTimeout(timer); resolve(null); });
    });
  }

  // Transient toast notification
  function showToast(text, color = '#0ff', duration = 4000) {
    let toast = document.getElementById('serverToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'serverToast';
      toast.style.cssText = 'position:fixed;top:56px;right:12px;z-index:200;padding:10px 16px;border-radius:10px;background:rgba(0,10,20,0.9);backdrop-filter:blur(8px);font-size:13px;font-weight:bold;letter-spacing:0.5px;transition:opacity 0.3s,transform 0.3s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.style.color = color;
    toast.style.borderLeft = '3px solid ' + color;
    toast.textContent = text;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
    }, duration);
  }

  async function pollServerStatus() {
    const onlineEl = document.getElementById('onlineCount');
    if (wakingTimeout) clearTimeout(wakingTimeout);
    wakingTimeout = setTimeout(() => setStatus('waking', 'Server waking', '~30s'), 1500);

    // Race: check custom and default in parallel
    const [customRtt, defaultRtt] = await Promise.all([
      checkServer(CUSTOM_SERVER_URL, 2500),
      checkServer(DEFAULT_SERVER_URL, 4000),
    ]);

    clearTimeout(wakingTimeout);
    // Update the detailed badges in the settings panel
    if (window.__updateServerBadges) window.__updateServerBadges(defaultRtt, customRtt);

    // Prefer custom if online. If only default is online, use that. If both down, offline.
    const customOnline = customRtt !== null;
    const defaultOnline = defaultRtt !== null;
    let targetUrl, rtt, label;

    if (customOnline) {
      targetUrl = CUSTOM_SERVER_URL; rtt = customRtt;
      label = 'Custom server';
      // Auto-switch notification when coming back online
      if (!usingCustom) {
        usingCustom = true;
        if (CUSTOM_SERVER_URL) showToast('Faster server detected — connected to ' + CUSTOM_SERVER_URL.replace(/^https?:\/\//, ''), '#0f6');
      }
    } else if (defaultOnline) {
      targetUrl = DEFAULT_SERVER_URL; rtt = defaultRtt;
      label = CUSTOM_SERVER_URL ? 'Fallback server' : 'Server online';
      if (usingCustom) {
        usingCustom = false;
        if (CUSTOM_SERVER_URL) showToast('Custom server offline — using fallback', '#f80');
      }
    } else {
      // Both down
      if (onlineEl) onlineEl.textContent = '-- online';
      setStatus('offline', 'Server offline');
      return;
    }

    // Apply the active URL. Reconnect if currently in multiplayer and URL changed.
    const changed = SERVER_URL !== targetUrl;
    SERVER_URL = targetUrl;
    if (changed && running && gameMode === 'multiplayer' && currentRoomId) {
      // Reconnect to the new server seamlessly
      const name = nameInput.value.trim() || 'Player';
      connect(name, currentRoomId, selectedTeamId >= 0 ? selectedTeamId : undefined);
    }

    // Fetch rooms for online count from the active server
    try {
      const r = await fetch(SERVER_URL + '/api/rooms');
      const rooms = await r.json();
      let total = 0;
      for (const room of rooms) total += room.players || 0;
      if (onlineEl) onlineEl.textContent = total + ' online';
    } catch (e) {}

    if (rtt > 150) setStatus('laggy', label, rtt + 'ms');
    else setStatus('online', label, rtt + 'ms');
    ping = rtt; smoothPing = rtt;
  }
  pollServerStatus();
  setInterval(pollServerStatus, 5000);

  // =====================================================
  // WebSocket (multiplayer mode only)
  // =====================================================
  let connId = 0; // incremented on disconnect to invalidate old sockets

  function disconnect() {
    connId++;
    if (ws) {
      try { ws.close(); } catch(e) {}
      ws = null;
    }
  }

  function connect(name, roomId, teamId) {
    disconnect();
    const myConnId = ++connId; // unique ID for this connection
    const wsUrl = SERVER_URL.replace('https://','wss://').replace('http://','ws://');
    ws = new WebSocket(`${wsUrl}?room=${encodeURIComponent(roomId)}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      if (connId !== myConnId) return; // stale connection
      const nameBytes = new TextEncoder().encode(name.substring(0,16));
      const hasTeam = teamId !== undefined && teamId >= 0;
      const hasRole = intendedDom && hasTeam; // domination join carries a role byte
      const buf = new Uint8Array(3 + (hasTeam?1:0) + (hasRole?1:0) + nameBytes.length);
      buf[0]=0x03; buf[1]=selectedSkin; buf[2]=selectedAccessory;
      let off = 3;
      if (hasTeam) buf[off++] = teamId;
      if (hasRole) buf[off++] = selectedRole;
      buf.set(nameBytes, off);
      ws.send(buf);
    };
    ws.onmessage = (event) => {
      if (connId !== myConnId) return; // stale connection
      // Zone Domination meta-state arrives as JSON text frames (binary state stays binary).
      if (typeof event.data === 'string') { handleDomMessage(event.data); return; }
      const buf = new DataView(event.data);
      if (buf.byteLength<1) return;
      const type = buf.getUint8(0);
      if (type===0x02) myId = buf.getUint16(2,true); // [0x02][version u8][id u16]
      else if (type===0x01) parseState(buf);
      else if (type===0x03) { if(buf.getUint16(1,true)===myId) onDeath(); }
      else if (type===0x04) {
        const killerId=buf.getUint16(1,true);
        const killedId=buf.getUint16(3,true);
        const killed=snakes.find(s=>s.id===killedId);
        const killer=snakes.find(s=>s.id===killerId);
        if(killed&&killed.segments.length>0) spawnDeathParticles(killed.segments[0].x,killed.segments[0].y,killed.skin);
        if(killedId===myId) {
          screenShake=15;
          // Ring shockwave on player death
          if (killed && killed.segments.length > 0) {
            const hd = killed.segments[0];
            const ringColor = (SKINS[killed.skin]||SKINS[0]).colors[0];
            particles.push({ type:'ring', x:hd.x, y:hd.y, vx:0, vy:0, radius:10, expandSpeed:300, life:1, decay:1.2, size:0, color:ringColor });
            particles.push({ type:'ring', x:hd.x, y:hd.y, vx:0, vy:0, radius:5, expandSpeed:200, life:1, decay:1.5, size:0, color:'#fff' });
          }
        }
        // Kill feed
        const killerName = killer ? killer.name : (snakeNameCache.get(killerId) || '???');
        const killedName = killed ? killed.name : (snakeNameCache.get(killedId) || '???');
        killFeed.push({ text: killerName + ' killed ' + killedName, timer: 4 });
        // Store killer position for death cam
        if (killer && killer.segments.length > 0) {
          lastKillerPos = { x: killer.segments[0].x, y: killer.segments[0].y };
        }
        // Freeze frame + kill counter for player kills
        if (killerId === myId) {
          freezeTimer = 0.06;
          myKills++;
        }
      }
      else if (type===0x05) parseLeaderboard(buf);
      else if (type===0x07) {
        if (buf.byteLength >= 4) {
          const eSnakeId = buf.getUint16(1, true);
          const eId = buf.getUint8(3);
          if (eSnakeId !== myId && eId < EMOTES.length) {
            emoteDisplays.push({ snakeId: eSnakeId, text: EMOTES[eId], timer: 2 });
          }
        }
      }
      // ---- Battle Royale messages ----
      // 0x08 = periodic royale state, 0x09 = sealed, 0x0A = match start, 0x0B = winner
      else if (type===0x08) {
        // [0x08][state u8][countdownMs u16][endMs u16][zoneR u16][zoneTarget u16]
        //       [damage u8][aliveCount u8][winnerId u16][nameLen u8][name]
        if (buf.byteLength < 16) return;
        let o = 1;
        const stateByte = buf.getUint8(o); o++;
        const states = ['lobby','countdown','active','ended'];
        const countdownMs = buf.getUint16(o, true); o += 2;
        const endMs = buf.getUint16(o, true); o += 2;
        const zoneR = buf.getUint16(o, true); o += 2;
        const zoneTarget = buf.getUint16(o, true); o += 2;
        const damage = buf.getUint8(o); o++;
        const aliveCount = buf.getUint8(o); o++;
        const winnerId = buf.getUint16(o, true); o += 2;
        const nameLen = buf.getUint8(o); o++;
        let winName = '';
        if (nameLen > 0 && o + nameLen <= buf.byteLength) {
          winName = new TextDecoder().decode(new Uint8Array(buf.buffer, o, nameLen));
        }
        mpRoyale = {
          state: states[stateByte] || 'lobby',
          countdownMs, endMs,
          zoneR, zoneTarget, damage,
          aliveCount, winnerId, winName,
        };
      }
      else if (type===0x09) {
        // Match sealed — joins refused. Show a friendly message and bail back to room list.
        showRoyaleSealedNotice();
      }
      else if (type===0x0A) {
        // Match started — flash, mute lobby chatter
        screenShake = Math.max(screenShake, 14);
        if (mpRoyale) mpRoyale.state = 'active';
      }
      else if (type===0x0B) {
        // Winner declared — record so render shows the win screen
        if (!mpRoyale) mpRoyale = {};
        mpRoyale.state = 'ended';
        if (buf.byteLength >= 4) {
          mpRoyale.winnerId = buf.getUint16(1, true);
          const nlen = buf.getUint8(3);
          if (nlen > 0 && 4 + nlen <= buf.byteLength) {
            mpRoyale.winName = new TextDecoder().decode(new Uint8Array(buf.buffer, 4, nlen));
          }
        }
      }
    };
    ws.onclose = () => {
      // Only auto-reconnect if this is still the active connection
      if (connId === myConnId && running) {
        setTimeout(() => { if (connId === myConnId) connect(name,roomId,teamId); }, 2000);
      }
    };
  }

  // Zone Domination JSON frames: 'domLayout' (board), 'domState' (live), 'domEvent' (banner).
  function handleDomMessage(str) {
    let m; try { m = JSON.parse(str); } catch { return; }
    if (m.t === 'domLayout') {
      domLayout = m;
      domZoneById = new Map(m.zones.map(z => [z.id, z]));
      domTeamById = new Map(m.teams.map(t => [t.id, t]));
      if (!mpDom) mpDom = { state:'active', timeLeft:m.roundMs, endLeft:0, overtime:false, winner:-1, event:null, teams:[], zones:[] };
      if (domHandshakeTimer) { clearTimeout(domHandshakeTimer); domHandshakeTimer = null; }
    } else if (m.t === 'domState') {
      mpDom = m;
      domStateById = new Map(m.zones.map(z => [z.id, z]));
      if (domHandshakeTimer) { clearTimeout(domHandshakeTimer); domHandshakeTimer = null; }
    } else if (m.t === 'domEvent') {
      pushDomEventBanner(m.type);
    }
  }
  function pushDomEventBanner(type) {
    const info = {
      foodstorm:    { text:'FOOD STORM',      sub:'Food floods the entire map',      color:'#5eff9a' },
      doublepoints: { text:'DOUBLE POINTS',   sub:'All zone output ×2',              color:'#ffd84d' },
      relocation:   { text:'ZONE RELOCATION', sub:'Contested zones have moved!',     color:'#a78bfa' },
      overtime:     { text:'OVERTIME',        sub:'Triple points — final push!',     color:'#fb7185' },
    }[type] || { text:String(type).toUpperCase(), sub:'', color:'#0ff' };
    domBanner = { ...info, life: 3.6, total: 3.6 };
    screenShake = Math.max(screenShake, 8);
  }

  function parseState(buf) {
    let off = 1;
    const snakeCount = buf.getUint16(off,true); off+=2;
    const newSnakes = [];
    for (let i=0;i<snakeCount;i++) {
      const id=buf.getUint16(off,true); off+=2;
      const skin=buf.getUint8(off); off+=1;
      const isBoosting=buf.getUint8(off)===1; off+=1;
      const isBot=buf.getUint8(off)===1; off+=1;
      const teamId=buf.getInt8(off); off+=1;
      const invincible=buf.getUint8(off)===1; off+=1;
      const accessory=buf.getUint8(off); off+=1;
      const score=buf.getUint16(off,true); off+=2;
      const nameLen=buf.getUint8(off); off+=1;
      const name=new TextDecoder().decode(new Uint8Array(buf.buffer,off,nameLen)); off+=nameLen;
      const segCount=buf.getUint16(off,true); off+=2;
      const segments=[];
      for (let j=0;j<segCount;j++) { segments.push({x:buf.getInt16(off,true),y:buf.getInt16(off+2,true)}); off+=4; }
      newSnakes.push({id,skin,boosting:isBoosting,isBot,teamId,invincible,accessory,score,name,segments,alive:true});
    }
    const foodCount=buf.getUint16(off,true); off+=2;
    const newFood=[];
    for (let i=0;i<foodCount;i++) {
      newFood.push({x:buf.getInt16(off,true),y:buf.getInt16(off+2,true),color:buf.getUint8(off+4),radius:buf.getUint8(off+5),tier:buf.getUint8(off+6)});
      off+=7;
    }
    const megaCount=buf.getUint16(off,true); off+=2;
    const newMega=[];
    for (let i=0;i<megaCount;i++) {
      newMega.push({x:buf.getInt16(off,true),y:buf.getInt16(off+2,true),color:buf.getUint8(off+4),radius:buf.getUint8(off+5),value:buf.getUint8(off+6)});
      off+=7;
    }
    // --- Interpolation: store previous snakes, reset interpT ---
    prevSnakes = snakes;
    interpT = 0;
    // --- Screen flash on mega orb eat (score jump >= 40) ---
    const me0 = snakes.find(s => s.id === myId);
    const me1 = newSnakes.find(s => s.id === myId);
    if (me0 && me1 && me1.score - me0.score >= 40) {
      // Find nearest mega orb color
      let flashColor = '#fff';
      if (me1.segments.length > 0) {
        let minD = Infinity;
        for (const m of megaOrbs) {
          const dx = m.x - me1.segments[0].x, dy = m.y - me1.segments[0].y;
          const d = dx * dx + dy * dy;
          if (d < minD) { minD = d; flashColor = COLORS[m.color] || '#fff'; }
        }
      }
      screenFlash = { color: flashColor, alpha: 0.3, timer: 0.3 };
    }
    // --- Food spawn-in animation: tag new food with spawnTime ---
    const prevFoodSet = new Set(prevFood.map(f => f.x + ',' + f.y));
    for (const f of newFood) {
      if (!prevFoodSet.has(f.x + ',' + f.y)) {
        f.spawnTime = animTime;
      }
    }
    prevFood = newFood;
    snakes=newSnakes; food=newFood; megaOrbs=newMega;
    // Cache snake names for kill feed (names persist after death)
    for (const s of newSnakes) snakeNameCache.set(s.id, s.name);
    // Ping is tracked separately from the server status HTTP poll (see serverPingRtt)
    lastStateTime = performance.now();
    const me=snakes.find(s=>s.id===myId);
    if (spectatingBR && (!me || !me.alive)) {
      // Multiplayer spectator: follow the highest-score alive snake
      const target = snakes.filter(s => s.alive).sort((a,b) => b.score - a.score)[0];
      if (target && target.segments.length > 0) {
        camera.x += (target.segments[0].x - camera.x) * 0.12;
        camera.y += (target.segments[0].y - camera.y) * 0.12;
      }
    } else if (me && me.segments.length > 0) {
      // Fix 5: camera follows predicted head (not stale server position)
      const camTgtX = (gameMode === 'multiplayer' && predict.valid) ? predict.x : me.segments[0].x;
      const camTgtY = (gameMode === 'multiplayer' && predict.valid) ? predict.y : me.segments[0].y;
      camera.x+=(camTgtX-camera.x)*0.3;
      camera.y+=(camTgtY-camera.y)*0.3;
      // Score popup on increase
      if (me.score > prevScore && prevScore > 0) {
        const diff = me.score - prevScore;
        const head = me.segments[0];
        const skin = SKINS[me.skin] || SKINS[0];
        scorePopups.push({ x: head.x, y: head.y - 30, text: '+' + diff, color: skin.colors[0], life: 1.0 });
        foodEaten++;
      }
      if (me.score > peakScore) peakScore = me.score;
      prevScore = me.score;
      myScoreEl.textContent=`Score: ${me.score}`;
      lastScore=me.score;
    }
  }

  function parseLeaderboard(buf) {
    let off=1; const count=buf.getUint8(off); off+=1;
    leaderboardEntries.innerHTML='';
    for (let i=0;i<count;i++) {
      const id=buf.getUint16(off,true); off+=2;
      const score=buf.getUint16(off,true); off+=2;
      const isBot=buf.getUint8(off)===1; off+=1;
      const kills=buf.getUint8(off); off+=1;
      const teamId=buf.getInt8(off); off+=1;
      const nameLen=buf.getUint8(off); off+=1;
      const name=new TextDecoder().decode(new Uint8Array(buf.buffer,off,nameLen)); off+=nameLen;
      const div=document.createElement('div');
      const isMe = id===myId || (teamId>=0 && teamId===selectedTeamId);
      div.className='entry'+(isMe?' me':'');
      const aiBadge = (isBot&&gameMode==='multiplayer') ? '<span class="ai-badge">AI</span>' : '';
      div.innerHTML=`<span>${name}${aiBadge}</span><span>${score}</span>`;
      leaderboardEntries.appendChild(div);
    }
    playerCountEl.textContent=`Players: ${snakes.length}`;
  }

  function populateDeathStats() {
    const elapsed = Math.floor((performance.now() - lifeStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins + ':' + (secs < 10 ? '0' : '') + secs;
    const el = (id) => document.getElementById(id);
    if (el('statTime')) el('statTime').textContent = timeStr;
    if (el('statFood')) el('statFood').textContent = foodEaten;
    if (el('statKills')) el('statKills').textContent = myKills;
    if (el('statPeak')) el('statPeak').textContent = peakScore;
  }

  function onDeath() {
    finalScoreEl.textContent=lastScore;
    if (lastScore > peakScore) peakScore = lastScore;
    populateDeathStats();
    screenShake=15;
    const titleEl = document.getElementById('deathTitle');
    const badgeEl = document.getElementById('brRankBadge');
    const respawnEl = document.getElementById('respawnBtn');
    const spectateEl = document.getElementById('spectateBtn');
    const inMpBR = mpRoyale && (mpRoyale.state === 'active' || mpRoyale.state === 'ended');
    if (inMpBR) {
      if (titleEl) titleEl.textContent = 'ELIMINATED';
      if (badgeEl) {
        const alive = mpRoyale.aliveCount || 0;
        badgeEl.style.display = 'block';
        badgeEl.textContent = `#${alive + 1} of 20`;
      }
      if (respawnEl) respawnEl.style.display = 'none';
      if (spectateEl) spectateEl.style.display = '';
    } else {
      if (titleEl) titleEl.textContent = 'YOU DIED';
      if (badgeEl) badgeEl.style.display = 'none';
      if (respawnEl) respawnEl.style.display = '';
      if (spectateEl) spectateEl.style.display = 'none';
    }
    // Multiplayer BR: keep the connection so the player can spectate. Other
    // modes: disconnect immediately to avoid phantom reconnects.
    if (!inMpBR) {
      myId = null;
      disconnect();
    }
    if (lastKillerPos) {
      spectateTarget = { x: lastKillerPos.x, y: lastKillerPos.y };
      spectateTimer = 0.8;
    } else {
      deathScreen.style.display='flex';
      document.body.style.cursor='default';
      running = inMpBR; // keep running so spectator camera can pan
    }
  }

  function sendDirection() {
    if (!ws||ws.readyState!==WebSocket.OPEN||myId===null) return;
    const angle = (isTouchDevice && joystickActive)
      ? joystickAngle
      : Math.atan2(mouseY-canvas.height/2,mouseX-canvas.width/2);
    const buf=new ArrayBuffer(5); const v=new DataView(buf);
    v.setUint8(0,0x01); v.setFloat32(1,angle,true); ws.send(buf);
  }

  // --- Particles ---
  function spawnDeathParticles(x,y,skinIdx) {
    if (!showParticles) return;
    const color=(SKINS[skinIdx]||SKINS[0]).colors[0];
    for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*200;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.5+Math.random(),size:3+Math.random()*6,color});}
  }
  function spawnEatParticles(x,y,skinIdx) {
    if (!showParticles) return;
    const color=(SKINS[skinIdx]||SKINS[0]).colors[0];
    for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*80;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:1.5+Math.random()*1.5,size:2+Math.random()*3,color});}
  }
  function updateParticles(dt) {
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      if (p.type === 'ring') {
        // Ring shockwave: expand radius, fade out
        p.radius += p.expandSpeed * dt;
        p.life -= p.decay * dt;
      } else {
        p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.96;p.vy*=0.96;p.life-=p.decay*dt;
      }
      if(p.life<=0)particles.splice(i,1);
    }
  }

  // =====================================================
  // Rendering
  // =====================================================
  function drawGrid(cx,cy) {
    const gs=60,halfW=canvas.width/(2*zoom),halfH=canvas.height/(2*zoom);
    const midX=canvas.width/2,midY=canvas.height/2;
    const startX=Math.floor((cx-halfW)/gs)*gs,startY=Math.floor((cy-halfH)/gs)*gs;
    ctx.strokeStyle='rgba(0,255,255,0.04)'; ctx.lineWidth=1/zoom; ctx.beginPath();
    for(let x=startX;x<=cx+halfW+gs;x+=gs){const sx=x-cx+midX;ctx.moveTo(sx,midY-halfH);ctx.lineTo(sx,midY+halfH);}
    for(let y=startY;y<=cy+halfH+gs;y+=gs){const sy=y-cy+midY;ctx.moveTo(midX-halfW,sy);ctx.lineTo(midX+halfW,sy);}
    ctx.stroke();
  }

  // Large flat-top hex mesh, world-anchored. Pulse-breathes subtly via animTime
  // and brightens slightly within ~1500 world units of the camera, so the
  // pattern feels alive without distracting from the play area.
  const HEX_R = 220;
  const HEX_DX = HEX_R * 1.5;
  const HEX_DY = HEX_R * Math.sqrt(3);
  function drawHexGrid(cx, cy) {
    const W = canvas.width, H = canvas.height;
    const midX = W / 2, midY = H / 2;
    const halfW = W / (2 * zoom) + HEX_R * 2;
    const halfH = H / (2 * zoom) + HEX_R * 2;
    const startCol = Math.floor((cx - halfW) / HEX_DX) - 1;
    const endCol   = Math.ceil ((cx + halfW) / HEX_DX) + 1;
    const startRow = Math.floor((cy - halfH) / HEX_DY) - 1;
    const endRow   = Math.ceil ((cy + halfH) / HEX_DY) + 1;
    const breathe = 0.85 + 0.15 * Math.sin(animTime * 0.6);
    // Outline pass — single Path2D, single stroke
    ctx.strokeStyle = `rgba(94, 234, 212, ${0.075 * breathe})`;
    ctx.lineWidth = 1.2 / zoom;
    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      const colOffsetY = (col & 1) ? HEX_DY / 2 : 0;
      for (let row = startRow; row <= endRow; row++) {
        const wx = col * HEX_DX;
        const wy = row * HEX_DY + colOffsetY;
        const x = wx - cx + midX;
        const y = wy - cy + midY;
        // Vertices for flat-top hexagon at angles 0, 60, 120, ...
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const vx = x + HEX_R * Math.cos(angle);
          const vy = y + HEX_R * Math.sin(angle);
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
    // Glow ring: hexes within ~1400 world-units of the camera get a brighter
    // overlay outline — feels like a "field of influence" around the player.
    const auraR = 1400;
    ctx.strokeStyle = `rgba(94, 234, 212, ${0.20 * breathe})`;
    ctx.lineWidth = 1.6 / zoom;
    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      const colOffsetY = (col & 1) ? HEX_DY / 2 : 0;
      for (let row = startRow; row <= endRow; row++) {
        const wx = col * HEX_DX;
        const wy = row * HEX_DY + colOffsetY;
        const ddx = wx - cx, ddy = wy - cy;
        if (ddx*ddx + ddy*ddy > auraR*auraR) continue;
        const x = wx - cx + midX;
        const y = wy - cy + midY;
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const vx = x + HEX_R * Math.cos(angle);
          const vy = y + HEX_R * Math.sin(angle);
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
    // Vertex nodes — small glowing dots at each hex CENTER for tech-mesh feel
    ctx.fillStyle = `rgba(125, 211, 252, ${0.45 * breathe})`;
    const nodeR = 1.6 / zoom;
    for (let col = startCol; col <= endCol; col++) {
      const colOffsetY = (col & 1) ? HEX_DY / 2 : 0;
      for (let row = startRow; row <= endRow; row++) {
        const wx = col * HEX_DX;
        const wy = row * HEX_DY + colOffsetY;
        const x = wx - cx + midX;
        const y = wy - cy + midY;
        ctx.beginPath();
        ctx.arc(x, y, nodeR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBorder(cx,cy) {
    // Zone Domination plays on a wide rectangle; everything else on the square.
    const w = (domLayout && mpDom) ? domLayout.mapW : MAP_SIZE;
    const h = (domLayout && mpDom) ? domLayout.mapH : MAP_SIZE;
    const sx=-w/2-cx+canvas.width/2,sy=-h/2-cy+canvas.height/2;
    ctx.strokeStyle='rgba(255,60,60,0.5)'; ctx.lineWidth=4; ctx.strokeRect(sx,sy,w,h);
  }

  // ===== Battle Royale HUD: countdown / damage vignette / winner screen =====
  function pushRoyaleBanner(text, sub, color) {
    royaleBanners.push({ text, sub, color, life: 3.2, total: 3.2 });
    if (royaleBanners.length > 4) royaleBanners.shift();
  }

  // Custom-painted golden crown — 3D gold body with three jewels (ruby,
  // sapphire, emerald), shine, base band with rivets. Renders centered at
  // (cx, cy) scaled to fit a given outer radius `r`. Used in Victory Royale
  // celebration and on the winner's head.
  function drawGoldCrown(ctx, cx, cy, r, opts = {}) {
    const tilt = opts.tilt || 0;
    const glow = opts.glow !== false;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    // Outer glow halo
    if (glow) {
      const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.8);
      halo.addColorStop(0, 'rgba(251,191,36,0.45)');
      halo.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shadow under base
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.55, r * 0.85, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    // ---- Crown silhouette path (5 spikes, base band) ----
    // Coordinates roughly: width ±0.95r, height -1.1r..+0.55r
    const crownPath = new Path2D();
    crownPath.moveTo(-0.95 * r,  0.55 * r);
    crownPath.lineTo(-0.95 * r, -0.30 * r);
    crownPath.lineTo(-0.72 * r, -0.95 * r);  // left spike tip
    crownPath.lineTo(-0.42 * r, -0.45 * r);  // left dip
    crownPath.lineTo(-0.14 * r, -1.10 * r);  // left-center spike tip
    crownPath.lineTo( 0    ,    -0.55 * r);  // center dip
    crownPath.lineTo( 0.14 * r, -1.10 * r);  // right-center spike tip
    crownPath.lineTo( 0.42 * r, -0.45 * r);
    crownPath.lineTo( 0.72 * r, -0.95 * r);
    crownPath.lineTo( 0.95 * r, -0.30 * r);
    crownPath.lineTo( 0.95 * r,  0.55 * r);
    crownPath.closePath();
    // Fill — vertical gold gradient
    const goldGrad = ctx.createLinearGradient(0, -r * 1.1, 0, r * 0.55);
    goldGrad.addColorStop(0,    '#fff8c4');
    goldGrad.addColorStop(0.30, '#fde047');
    goldGrad.addColorStop(0.55, '#f59e0b');
    goldGrad.addColorStop(0.85, '#b45309');
    goldGrad.addColorStop(1,    '#78350f');
    ctx.fillStyle = goldGrad;
    ctx.fill(crownPath);
    // Inner highlight along the top edges of the spikes
    ctx.strokeStyle = 'rgba(255,255,200,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.92 * r, -0.32 * r); ctx.lineTo(-0.72 * r, -0.86 * r);
    ctx.moveTo(-0.18 * r, -1.0 * r);  ctx.lineTo(-0.06 * r, -1.0 * r);
    ctx.moveTo( 0.92 * r, -0.32 * r); ctx.lineTo( 0.72 * r, -0.86 * r);
    ctx.moveTo( 0.06 * r, -1.0 * r);  ctx.lineTo( 0.18 * r, -1.0 * r);
    ctx.stroke();
    // Base band — darker rim
    ctx.fillStyle = 'rgba(120, 70, 0, 0.45)';
    ctx.fillRect(-0.95 * r, 0.12 * r, 1.9 * r, 0.20 * r);
    // Rivets on base band (3 small dots)
    ctx.fillStyle = '#fde047';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * 0.50 * r, 0.22 * r, r * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    // ---- Three jewels: ruby (left), sapphire (center), emerald (right) ----
    const jewels = [
      { x: -0.42 * r, y: -0.10 * r, light: '#ffaeae', mid: '#ef4444', dark: '#7f1d1d' },
      { x:  0,        y: -0.18 * r, light: '#9bdcff', mid: '#3b82f6', dark: '#1e3a8a' },
      { x:  0.42 * r, y: -0.10 * r, light: '#a1f3a1', mid: '#22c55e', dark: '#14532d' },
    ];
    for (const j of jewels) {
      const jr = r * 0.18;
      // Jewel body
      const jgrad = ctx.createRadialGradient(j.x - jr * 0.3, j.y - jr * 0.3, jr * 0.1, j.x, j.y, jr);
      jgrad.addColorStop(0, j.light);
      jgrad.addColorStop(0.55, j.mid);
      jgrad.addColorStop(1, j.dark);
      ctx.fillStyle = jgrad;
      ctx.beginPath();
      ctx.arc(j.x, j.y, jr, 0, Math.PI * 2);
      ctx.fill();
      // Jewel rim
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(0.5, r * 0.018);
      ctx.beginPath();
      ctx.arc(j.x, j.y, jr, 0, Math.PI * 2);
      ctx.stroke();
      // Specular spot
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(j.x - jr * 0.35, j.y - jr * 0.35, jr * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    // Crisp outer outline for silhouette pop
    ctx.strokeStyle = '#5e3a05';
    ctx.lineWidth = Math.max(0.8, r * 0.035);
    ctx.stroke(crownPath);
    // Top tip stars (small twinkles on each spike tip)
    ctx.fillStyle = 'rgba(255,255,220,0.95)';
    for (const tip of [[-0.72, -0.95], [-0.14, -1.10], [0, -0.55], [0.14, -1.10], [0.72, -0.95]]) {
      ctx.beginPath();
      ctx.arc(tip[0] * r, tip[1] * r - r * 0.02, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Victory Royale celebration — confetti rain + painted golden crown + glowing text.
  let victoryConfetti = [];
  function spawnVictoryConfetti() {
    if (victoryConfetti.length > 0) return;
    const palette = ['#fbbf24', '#5eead4', '#fb7185', '#7dd3fc', '#a3e635', '#f0abfc'];
    for (let i = 0; i < 160; i++) {
      victoryConfetti.push({
        x: Math.random() * canvas.width,
        y: -30 - Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 220,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        size: 7 + Math.random() * 10,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }
  }
  function clearVictoryConfetti() { victoryConfetti = []; }
  function drawVictoryRoyale(dt, score) {
    const W = canvas.width, H = canvas.height;
    spawnVictoryConfetti();
    // Dim backdrop with a warm gold tint
    ctx.save();
    const bg = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, Math.max(W, H));
    bg.addColorStop(0, 'rgba(50,30,5,0.55)');
    bg.addColorStop(1, 'rgba(2,4,16,0.92)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Confetti
    for (const c of victoryConfetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 240 * dt;
      c.rot += c.vrot * dt;
      if (c.y > H + 40) { c.y = -40; c.vy = 120 + Math.random() * 220; }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size/2, -c.size/4, c.size, c.size/2);
      ctx.restore();
    }
    // Painted golden crown floating at top, bobbing gently
    const crownY = H/2 - 150 + Math.sin(animTime * 1.6) * 8;
    const crownTilt = Math.sin(animTime * 0.9) * 0.08;
    drawGoldCrown(ctx, W/2, crownY, 80, { tilt: crownTilt, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Title — pulsing gold
    const titlePulse = 1 + 0.04 * Math.sin(animTime * 4);
    ctx.font = `800 ${Math.round(72 * titlePulse)}px 'Space Grotesk', 'Inter', sans-serif`;
    ctx.shadowColor = 'rgba(251,191,36,0.85)';
    ctx.shadowBlur = 50;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('VICTORY ROYALE', W/2, H/2 - 16);
    ctx.shadowBlur = 0;
    // Subtitle
    ctx.font = "600 18px 'Inter', sans-serif";
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText('Last snake standing', W/2, H/2 + 36);
    // Score
    ctx.font = "800 32px 'Space Grotesk', sans-serif";
    ctx.fillStyle = '#5eead4';
    ctx.fillText('SCORE ' + (score || 0), W/2, H/2 + 88);
    // Hint
    ctx.font = "500 12px 'Inter', sans-serif";
    ctx.fillStyle = 'rgba(148,163,184,0.85)';
    ctx.fillText('Tap anywhere to return home', W/2, H/2 + 130);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  function drawLocalRoyaleHUD(dt) {
    const st = localRoyaleStatus;
    if (!st) return;
    const W = canvas.width, H = canvas.height;

    // Drain events → banners
    if (st.events && st.events.length) {
      for (const ev of st.events) {
        if (ev.type === 'shrinkStart') {
          pushRoyaleBanner('ZONE IS NOW CLOSING', `Next safe radius: ${Math.round(ev.radius)}`, '#fb7185');
        } else if (ev.type === 'shrinkEnd') {
          pushRoyaleBanner('ZONE LOCKED', `Hold radius: ${Math.round(ev.radius)}`, '#5eead4');
        }
      }
    }

    // Pre-match countdown overlay — big 3..2..1..GO!
    if (st.matchState === 'countdown') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(0, 0, W, H);
      const c = Math.ceil(st.matchCountdown);
      const isGo = c <= 0;
      const txt = isGo ? 'GO!' : String(c);
      const pulse = isGo ? 1 : 1 + 0.2 * (1 - (st.matchCountdown % 1));
      ctx.font = `800 ${Math.round(180 * pulse)}px 'Space Grotesk', 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = isGo ? 'rgba(94,234,212,0.9)' : 'rgba(251,113,133,0.85)';
      ctx.shadowBlur = 60;
      ctx.fillStyle = isGo ? '#5eead4' : '#fb7185';
      ctx.fillText(txt, W/2, H/2);
      ctx.shadowBlur = 0;
      ctx.font = "700 14px 'Inter', sans-serif";
      ctx.fillStyle = 'rgba(241,245,249,0.85)';
      ctx.fillText('BATTLE ROYALE', W/2, H/2 - 130);
      ctx.font = "500 12px 'Inter', sans-serif";
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.fillText('20 snakes. No respawn. Last one alive wins.', W/2, H/2 + 130);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
      return; // skip the rest of the HUD during countdown
    }

    // Victory Royale celebration
    if (st.matchState === 'victory' || st.victoryFlag) {
      drawVictoryRoyale(dt, st.playerScore);
      return;
    }

    // Phase status panel — circular time-progress ring on the left, panel-card
    // styling that matches the rest of the app (rounded, subtle gradient bg,
    // teal/red accent based on state).
    ctx.save();
    const isShrink = st.state === 'shrink';
    const isDone = st.state === 'done';
    const accent = isShrink ? '#fb7185' : '#5eead4';
    const stateLabel = isDone
      ? 'FINAL ZONE'
      : isShrink
        ? 'ZONE CLOSING'
        : `PHASE ${st.phaseIdx + 1}/${st.totalPhases}`;
    const timeLabel = isDone ? '∞' : `${Math.ceil(st.timeRemaining)}`;
    const aliveTxt = `${st.alive} ALIVE`;

    // Pre-measure for centering
    ctx.font = "700 11px 'Inter', sans-serif";
    const stateW = ctx.measureText(stateLabel).width;
    const aliveW = ctx.measureText(aliveTxt).width;
    const ringD = 36;
    const pad = 14;
    const gap = 10;
    const pillW = Math.max(260, ringD + gap + stateW + 14 + aliveW + pad * 2);
    const pillH = 56;
    const px = W/2 - pillW/2;
    const py = 14;

    // Panel-card background: matches app's frosted-card aesthetic.
    const bgGrad = ctx.createLinearGradient(0, py, 0, py + pillH);
    bgGrad.addColorStop(0, 'rgba(20, 24, 48, 0.92)');
    bgGrad.addColorStop(1, 'rgba(10, 12, 28, 0.92)');
    ctx.fillStyle = bgGrad;
    roundRect(ctx, px, py, pillW, pillH, pillH / 2); // fully rounded ends
    ctx.fill();
    // Subtle border
    ctx.strokeStyle = `${accent}aa`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner highlight (top edge)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    roundRect(ctx, px + 1.5, py + 1.5, pillW - 3, pillH - 3, (pillH - 3) / 2);
    ctx.stroke();

    // Circular time-progress ring (left side of panel)
    const ringCX = px + pad + ringD / 2;
    const ringCY = py + pillH / 2;
    const ringR = ringD / 2;
    // Track
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // Progress arc
    const phaseTotal = isShrink
      ? (localGame.ROYALE_PHASES[st.phaseIdx] && localGame.ROYALE_PHASES[st.phaseIdx].shrinkTime) || 1
      : (localGame.ROYALE_PHASES[st.phaseIdx] && localGame.ROYALE_PHASES[st.phaseIdx].hold) || 1;
    const progress = isDone ? 1 : Math.max(0, Math.min(1, st.timeRemaining / phaseTotal));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Time number inside the ring
    ctx.font = "800 14px 'Space Grotesk', 'Inter', sans-serif";
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeLabel, ringCX, ringCY + 1);

    // Right side: state label on top, alive count below
    const textX = ringCX + ringD / 2 + gap;
    ctx.textAlign = 'left';
    ctx.font = "800 12px 'Space Grotesk', 'Inter', sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(stateLabel, textX, ringCY - 8);
    ctx.font = "600 10px 'Inter', sans-serif";
    ctx.fillStyle = 'rgba(148,163,184,0.95)';
    ctx.fillText(aliveTxt, textX, ringCY + 9);

    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // Banner notifications stack on the LEFT (right side is blocked by the
    // DOM leaderboard, which sits above the canvas in z-order).
    let by = 100;
    for (const b of royaleBanners) {
      b.life -= dt;
      if (b.life <= 0) continue;
      const alpha = Math.min(1, b.life / 0.6);
      const slideIn = Math.min(1, (b.total - b.life) / 0.25);
      const offX = (1 - slideIn) * -60;
      ctx.save();
      ctx.globalAlpha = alpha;
      const bw = 280, bh = 56;
      const bx = 18 + offX;
      ctx.fillStyle = 'rgba(10,12,28,0.92)';
      ctx.strokeStyle = b.color || '#5eead4';
      roundRect(ctx, bx, by, bw, bh, 12);
      ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      // Left accent stripe
      ctx.fillStyle = b.color || '#5eead4';
      ctx.fillRect(bx, by, 4, bh);
      ctx.font = "800 13px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'left';
      ctx.fillStyle = b.color || '#5eead4';
      ctx.fillText(b.text, bx + 16, by + 22);
      ctx.font = "500 11px 'Inter', sans-serif";
      ctx.fillStyle = 'rgba(241,245,249,0.85)';
      ctx.fillText(b.sub, bx + 16, by + 40);
      ctx.restore();
      by += bh + 8;
    }
    royaleBanners = royaleBanners.filter(b => b.life > 0);

    // Damage vignette while outside the zone (player dead → skip)
    if (!st.isDead && st.state !== 'done') {
      const me = snakes.find(s => s.id === myId);
      if (me && me.alive && me.segments.length > 0) {
        const h = me.segments[0];
        const dx = h.x - (st.centerX || 0), dy = h.y - (st.centerY || 0);
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > st.currentRadius) {
          const pulse = 0.35 + Math.sin(animTime * 4) * 0.15;
          const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.2, W/2, H/2, Math.max(W,H)*0.7);
          grad.addColorStop(0, 'rgba(251,113,133,0)');
          grad.addColorStop(1, `rgba(251,113,133,${pulse})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }

    // Winner notice when the player wins (last alive, not dead)
    if (st.state === 'done' && !st.isDead && st.alive === 1) {
      ctx.save();
      ctx.fillStyle = 'rgba(6,8,26,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = "800 56px 'Space Grotesk', sans-serif";
      ctx.fillStyle = '#5eead4';
      ctx.shadowColor = 'rgba(94,234,212,0.6)';
      ctx.shadowBlur = 30;
      ctx.fillText('VICTORY ROYALE', W/2, H/2 - 10);
      ctx.shadowBlur = 0;
      ctx.font = "600 16px 'Inter', sans-serif";
      ctx.fillStyle = '#f1f5f9';
      ctx.fillText('Last snake standing', W/2, H/2 + 22);
      ctx.restore();
    }
  }

  function drawRoyaleHUD(dt, cx, cy) {
    // Local single-player Battle Royale HUD
    if (localGame && localGame.mode === 'royale') {
      drawLocalRoyaleHUD(dt);
      return;
    }
    if (!mpRoyale) return;
    const W = canvas.width, H = canvas.height;
    // --- Lobby / countdown — full-screen waiting room ---
    if (mpRoyale.state === 'countdown' || mpRoyale.state === 'lobby') {
      const secs = Math.ceil((mpRoyale.countdownMs || 0) / 1000);
      ctx.save();
      // Dim backdrop
      ctx.fillStyle = 'rgba(2,6,23,0.62)';
      ctx.fillRect(0, 0, W, H);
      // Title
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "800 12px 'Inter', sans-serif";
      ctx.fillStyle = 'rgba(251,113,133,0.9)';
      ctx.fillText('BATTLE ROYALE', W/2, H/2 - 180);
      // Big countdown number or "WAITING"
      if (mpRoyale.state === 'countdown') {
        const isLow = secs <= 5;
        const pulse = 1 + 0.08 * Math.sin(animTime * 5);
        ctx.font = `800 ${Math.round(160 * pulse)}px 'Space Grotesk', 'Inter', sans-serif`;
        ctx.shadowColor = isLow ? 'rgba(251,113,133,0.9)' : 'rgba(94,234,212,0.85)';
        ctx.shadowBlur = 50;
        ctx.fillStyle = isLow ? '#fb7185' : '#5eead4';
        ctx.fillText(secs + 's', W/2, H/2 - 30);
        ctx.shadowBlur = 0;
        ctx.font = "700 14px 'Inter', sans-serif";
        ctx.fillStyle = '#f1f5f9';
        ctx.fillText('UNTIL DROP', W/2, H/2 + 70);
      } else {
        ctx.font = "800 56px 'Space Grotesk', sans-serif";
        ctx.fillStyle = '#5eead4';
        ctx.fillText('WAITING FOR DROP', W/2, H/2 - 30);
        ctx.font = "600 14px 'Inter', sans-serif";
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Lobby is open — more players can still join', W/2, H/2 + 30);
      }
      // Footer info
      ctx.font = "600 12px 'Inter', sans-serif";
      ctx.fillStyle = 'rgba(148,163,184,0.85)';
      ctx.fillText('20 SNAKES · NO RESPAWN · LAST ALIVE WINS', W/2, H/2 + 130);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    // --- Damage vignette while outside the zone (active phase only) ---
    if (mpRoyale.state === 'active') {
      const me = snakes.find(s => s.id === myId);
      if (me && me.alive && me.segments.length > 0) {
        const h = me.segments[0];
        const dx = h.x - 0, dy = h.y - 0;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > (mpRoyale.zoneR || 0)) {
          const pulse = 0.35 + Math.sin(animTime * 4) * 0.15;
          const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.2, W/2, H/2, Math.max(W,H)*0.7);
          grad.addColorStop(0, 'rgba(251,113,133,0)');
          grad.addColorStop(1, `rgba(251,113,133,${pulse})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
          // Warning text
          ctx.save();
          ctx.font = "800 16px 'Space Grotesk', sans-serif";
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fb7185';
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 8;
          ctx.fillText('⚠  GET BACK TO THE ZONE  ⚠', W/2, 96);
          ctx.font = "600 12px 'Inter', sans-serif";
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(`Losing ${mpRoyale.damage}/s`, W/2, 116);
          ctx.restore();
        }
      }
      // Live "X remaining" pill, top-center
      ctx.save();
      ctx.font = "700 12px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      const txt = `${mpRoyale.aliveCount || 0} ALIVE`;
      const tw = ctx.measureText(txt).width + 28;
      ctx.fillStyle = 'rgba(10,12,28,0.8)';
      ctx.strokeStyle = 'rgba(94,234,212,0.6)';
      roundRect(ctx, W/2 - tw/2, 16, tw, 28, 14);
      ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#5eead4';
      ctx.fillText(txt, W/2, 34);
      ctx.restore();
    }
    // --- Winner screen ---
    if (mpRoyale.state === 'ended') {
      const won = mpRoyale.winnerId === myId;
      if (won) {
        const me = snakes.find(s => s.id === myId);
        drawVictoryRoyale(dt, me ? me.score : 0);
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(6,8,26,0.78)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = "800 56px 'Space Grotesk', sans-serif";
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('MATCH OVER', W/2, H/2 - 30);
        ctx.font = "600 18px 'Inter', sans-serif";
        ctx.fillStyle = '#f1f5f9';
        const sub = mpRoyale.winName ? `${mpRoyale.winName} wins the Royale` : 'No survivors';
        ctx.fillText(sub, W/2, H/2 + 20);
        ctx.font = "500 13px 'Inter', sans-serif";
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Tap anywhere to return home', W/2, H/2 + 60);
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---- Zone Domination HUD (screen space) ----
  function drawTeamPill(x, y, w, h, team, alignRight, leadScore) {
    const isLeader = team.score >= leadScore && leadScore > 0;
    ctx.fillStyle = 'rgba(8,12,28,0.82)';
    ctx.strokeStyle = isLeader ? team.color : hexA(team.color, 0.45);
    roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.lineWidth = isLeader ? 2 : 1.2; ctx.stroke();
    // progress fill proportional to score share
    const frac = Math.max(0.04, Math.min(1, team.score / leadScore));
    ctx.save();
    roundRect(ctx, x, y, w, h, 10); ctx.clip();
    const fw = w * frac;
    ctx.fillStyle = hexA(team.color, 0.18);
    ctx.fillRect(alignRight ? x + w - fw : x, y, fw, h);
    ctx.restore();
    // color swatch
    const sw = 8;
    ctx.fillStyle = team.color; ctx.shadowColor = team.color; ctx.shadowBlur = 8;
    roundRect(ctx, alignRight ? x + w - sw - 4 : x + 4, y + 6, sw, h - 12, 3); ctx.fill(); ctx.shadowBlur = 0;
    // text
    const tx = alignRight ? x + w - 18 : x + 18;
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillStyle = '#eef5ff';
    ctx.font = "800 13px 'Inter',sans-serif";
    ctx.fillText((isLeader ? '👑 ' : '') + team.name, tx, y + 13);
    ctx.font = "800 19px 'Space Grotesk','Inter',sans-serif";
    ctx.fillStyle = team.color;
    ctx.fillText(String(team.score), tx, y + 30);
    ctx.font = "600 10px 'Inter',sans-serif";
    ctx.fillStyle = 'rgba(200,215,230,0.7)';
    const meta = `${team.zones} zones · ⬡ ${team.res}`;
    ctx.fillText(meta, alignRight ? tx - 64 : tx + 64, y + 30);
  }
  function drawDominationHUD(dt) {
    if (!mpDom || !domLayout) return;
    const W = canvas.width, H = canvas.height;
    if (domBanner) { domBanner.life -= dt; if (domBanner.life <= 0) domBanner = null; }

    // Merge live scores with team identity; tally zones held
    const zoneCount = new Map();
    for (const zs of domStateById.values()) if (zs.o >= 0) zoneCount.set(zs.o, (zoneCount.get(zs.o)||0) + 1);
    const teams = (mpDom.teams || []).map(t => {
      const info = domTeamById.get(t.id) || {};
      return { id: t.id, score: t.score||0, res: t.res||0, zones: zoneCount.get(t.id)||0,
               name: info.name || ('Team ' + t.id), color: info.color || domTeamColor(t.id) };
    }).sort((a,b) => a.id - b.id);
    const leadScore = Math.max(1, ...teams.map(t => t.score));

    ctx.save();
    ctx.textBaseline = 'middle';

    // Round timer (center)
    const secs = Math.max(0, Math.ceil((mpDom.timeLeft||0)/1000));
    const timeStr = `${Math.floor(secs/60)}:${(secs%60)<10?'0':''}${secs%60}`;
    const ot = mpDom.overtime;
    const tpw = 86, tph = 40, tpx = W/2 - tpw/2, tpy = 12;
    ctx.fillStyle = 'rgba(8,12,28,0.85)';
    ctx.strokeStyle = ot ? '#fb7185' : 'rgba(120,200,255,0.5)';
    roundRect(ctx, tpx, tpy, tpw, tph, 10); ctx.fill(); ctx.lineWidth = ot ? 2 : 1.4; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = ot ? '#fb7185' : '#9fb3c8';
    ctx.font = "700 8px 'Inter',sans-serif";
    ctx.fillText(ot ? 'OVERTIME' : 'TIME', W/2, tpy + 11);
    ctx.fillStyle = ot ? '#fb7185' : '#e8f4ff';
    ctx.font = "800 19px 'Space Grotesk','Inter',sans-serif";
    ctx.fillText(timeStr, W/2, tpy + 27);

    // Team pills — flank the timer for 2 teams; row beneath for more
    const pillW = 188, pillH = 44;
    if (teams.length === 2) {
      drawTeamPill(tpx - 12 - pillW, 10, pillW, pillH, teams[0], false, leadScore);
      drawTeamPill(tpx + tpw + 12,   10, pillW, pillH, teams[1], true,  leadScore);
    } else {
      let rx = W/2 - (teams.length * (pillW + 8))/2;
      for (const t of teams) { drawTeamPill(rx, tpy + tph + 8, pillW, pillH, t, false, leadScore); rx += pillW + 8; }
    }

    // Active event chip (under timer)
    if (mpDom.event && mpDom.event.type) {
      const ev = {
        foodstorm:   ['⛆ FOOD STORM', '#5eff9a'], doublepoints: ['✦ DOUBLE POINTS', '#ffd84d'],
        relocation:  ['⇄ RELOCATION', '#a78bfa'], overtime:     ['⚡ OVERTIME', '#fb7185'],
      }[mpDom.event.type] || [mpDom.event.type.toUpperCase(), '#0ff'];
      const left = Math.ceil((mpDom.event.left||0)/1000);
      const txt = `${ev[0]}  ${left}s`;
      ctx.font = "800 12px 'Inter',sans-serif";
      const cw = ctx.measureText(txt).width + 26;
      const cy0 = tpy + tph + 8;
      ctx.fillStyle = 'rgba(8,12,28,0.85)'; ctx.strokeStyle = hexA(ev[1], 0.7);
      roundRect(ctx, W/2 - cw/2, cy0, cw, 24, 12); ctx.fill(); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = ev[1]; ctx.textAlign = 'center';
      ctx.fillText(txt, W/2, cy0 + 13);
    }

    // Player role + team economy panel (bottom-left)
    if (selectedTeamId >= 0) {
      const myTeam = teams.find(t => t.id === selectedTeamId);
      const role = ROLE_NAMES[selectedRole] || 'Scout';
      const panelW = 168, panelH = 52, px = 14, py = H - panelH - 16;
      ctx.fillStyle = 'rgba(8,12,28,0.78)';
      ctx.strokeStyle = myTeam ? hexA(myTeam.color, 0.5) : 'rgba(255,255,255,0.15)';
      roundRect(ctx, px, py, panelW, panelH, 12); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
      if (myTeam) { ctx.fillStyle = myTeam.color; ctx.shadowColor = myTeam.color; ctx.shadowBlur = 8; roundRect(ctx, px + 8, py + 10, 6, panelH - 20, 3); ctx.fill(); ctx.shadowBlur = 0; }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9fb3c8'; ctx.font = "700 9px 'Inter',sans-serif";
      ctx.fillText('YOUR ROLE', px + 22, py + 13);
      ctx.fillStyle = '#eef5ff'; ctx.font = "800 16px 'Space Grotesk','Inter',sans-serif";
      ctx.fillText(role, px + 22, py + 30);
      ctx.fillStyle = 'rgba(180,200,220,0.75)'; ctx.font = "600 10px 'Inter',sans-serif";
      ctx.fillText(myTeam ? `${myTeam.name} · ⬡ ${myTeam.res}` : '', px + 22, py + 44);
    }

    ctx.restore();

    // Big event banner (center flash)
    if (domBanner) {
      const t = domBanner.life / domBanner.total;
      const a = t > 0.8 ? (1 - t) / 0.2 : t < 0.25 ? t / 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "800 46px 'Space Grotesk','Inter',sans-serif";
      ctx.fillStyle = domBanner.color; ctx.shadowColor = domBanner.color; ctx.shadowBlur = 30;
      ctx.fillText(domBanner.text, W/2, H*0.26);
      ctx.shadowBlur = 0; ctx.font = "600 15px 'Inter',sans-serif"; ctx.fillStyle = '#e8f0ff';
      ctx.fillText(domBanner.sub, W/2, H*0.26 + 36);
      ctx.restore();
    }

    // Round-over / winner overlay
    if (mpDom.state === 'ended') {
      const win = mpDom.winner >= 0 ? (domTeamById.get(mpDom.winner) || {}) : null;
      const wc = win ? (win.color || domTeamColor(mpDom.winner)) : '#94a3b8';
      ctx.save();
      ctx.fillStyle = 'rgba(6,8,26,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = "800 13px 'Inter',sans-serif"; ctx.fillStyle = 'rgba(200,215,230,0.85)';
      ctx.fillText('ROUND OVER', W/2, H/2 - 96);
      ctx.font = "800 54px 'Space Grotesk','Inter',sans-serif";
      ctx.fillStyle = wc; ctx.shadowColor = wc; ctx.shadowBlur = 34;
      ctx.fillText(win ? `${win.name} DOMINATES` : 'STALEMATE', W/2, H/2 - 36);
      ctx.shadowBlur = 0;
      // final scores
      ctx.font = "700 17px 'Inter',sans-serif";
      let ry = H/2 + 24;
      for (const t of teams.slice().sort((a,b)=>b.score-a.score)) {
        ctx.fillStyle = t.color; ctx.textAlign = 'right'; ctx.fillText(t.name, W/2 - 14, ry);
        ctx.fillStyle = '#eef5ff'; ctx.textAlign = 'left'; ctx.fillText(String(t.score), W/2 + 14, ry);
        ry += 28;
      }
      const nextS = Math.ceil((mpDom.endLeft||0)/1000);
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(180,200,220,0.75)'; ctx.font = "500 13px 'Inter',sans-serif";
      ctx.fillText(`Next round in ${nextS}s`, W/2, ry + 14);
      ctx.restore();
    }
  }

  function showRoyaleSealedNotice() {
    royaleSealedTimer = 4.0;
    try {
      if (ws && ws.readyState <= 1) ws.close();
    } catch {}
    // Bounce back to room list
    setTimeout(() => {
      const rs = document.getElementById('roomScreen');
      const ss = document.getElementById('startScreen');
      if (rs) rs.style.display = 'flex';
      if (ss) ss.style.display = 'none';
    }, 100);
  }

  function drawRoyaleRing(cx, cy) {
    // Source the radius + center from either local royale mode OR the server royale state
    let r = null;
    let pulse = 1;
    let zoneCX = 0, zoneCY = 0;
    if (localGame && localGame.mode === 'royale') {
      r = localGame.safeRadius;
      zoneCX = localGame.safeCenterX || 0;
      zoneCY = localGame.safeCenterY || 0;
      // No bobbing — keep it dead steady
    } else if (mpRoyale && (mpRoyale.state === 'active' || mpRoyale.state === 'ended')) {
      r = mpRoyale.zoneR;
      pulse = 1;
    } else {
      return;
    }
    // World→canvas: shift by the zone center as well as the camera offset
    const ox = canvas.width / 2 - cx + zoneCX;
    const oy = canvas.height / 2 - cy + zoneCY;
    // Danger fill — everything outside the safe zone is deadly.
    // Use even-odd fill so we paint a ring from the canvas edge to the safe radius.
    const halfW = canvas.width / (2 * zoom);
    const halfH = canvas.height / (2 * zoom);
    const left = cx - halfW - 200, top = cy - halfH - 200;
    const right = cx + halfW + 200, bottom = cy + halfH + 200;
    ctx.fillStyle = 'rgba(180, 30, 30, 0.18)';
    ctx.beginPath();
    ctx.rect(left - cx + canvas.width/2, top - cy + canvas.height/2,
             right - left, bottom - top);
    ctx.arc(ox, oy, r * pulse, 0, Math.PI * 2, true); // hole: counter-clockwise
    ctx.fill('evenodd');
    // Safe-zone boundary
    const closing = localGame && localGame.mode === 'royale' && localGame.royalePhaseState === 'shrink';
    ctx.strokeStyle = closing ? 'rgba(255, 90, 90, 0.95)' : 'rgba(255, 180, 80, 0.85)';
    ctx.lineWidth = 4 / zoom;
    ctx.setLineDash([14 / zoom, 14 / zoom]);
    ctx.lineDashOffset = -animTime * 24;
    ctx.beginPath();
    ctx.arc(ox, oy, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Target-zone preview — faint inner ring showing where the safe zone is
    // headed next (only meaningful for local royale during 'hold' phase).
    if (localGame && localGame.mode === 'royale' && localGame.safeTargetRadius < r - 5) {
      ctx.strokeStyle = 'rgba(94, 234, 212, 0.55)';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 10 / zoom]);
      ctx.lineDashOffset = animTime * 18;
      ctx.beginPath();
      ctx.arc(ox, oy, localGame.safeTargetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- Zone Domination world rendering (shapes only; text lives in the HUD) ----
  function hexA(hex, a) {
    let h = String(hex || '#888').replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16) || 0;
    return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
  }
  function domTeamColor(teamId) {
    if (teamId == null || teamId < 0) return '#9fb3c8';
    const t = domTeamById.get(teamId);
    return (t && t.color) || COLORS[teamId] || '#fff';
  }
  function domLiveZone(z) {
    return domStateById.get(z.id) || { o: z.home, p: z.home>=0?100:0, l: z.home>=0?1:0, cap:-1, core:0, hot:0, grp:1 };
  }
  function drawZoneStar(sx, sy, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI/2 + i*Math.PI/5;
      const rad = i % 2 === 0 ? r : r*0.46;
      const px = sx + Math.cos(ang)*rad, py = sy + Math.sin(ang)*rad;
      i === 0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle = hexA(color, 0.9); ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 2/zoom; ctx.strokeStyle = '#fff8e1'; ctx.stroke();
  }
  function drawZoneShield(sx, sy, r, color) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.lineTo(sx + r*0.82, sy - r*0.5);
    ctx.lineTo(sx + r*0.82, sy + r*0.28);
    ctx.quadraticCurveTo(sx + r*0.4, sy + r*0.95, sx, sy + r*1.05);
    ctx.quadraticCurveTo(sx - r*0.4, sy + r*0.95, sx - r*0.82, sy + r*0.28);
    ctx.lineTo(sx - r*0.82, sy - r*0.5);
    ctx.closePath();
    ctx.fillStyle = hexA(color, 0.85); ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5/zoom; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  function drawZoneGem(sx, sy, r, color) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - r);
    ctx.lineTo(sx + r*0.72, sy);
    ctx.lineTo(sx, sy + r);
    ctx.lineTo(sx - r*0.72, sy);
    ctx.closePath();
    ctx.fillStyle = hexA(color, 0.9); ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 2/zoom; ctx.strokeStyle = '#eafff5'; ctx.stroke();
  }
  function drawLevelPips(sx, sy, level, color) {
    const n = 5, gap = 13/zoom, pr = 4/zoom;
    const startX = sx - (n-1)*gap/2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(startX + i*gap, sy, pr, 0, Math.PI*2);
      ctx.fillStyle = i < level ? color : 'rgba(255,255,255,0.18)';
      ctx.fill();
    }
  }
  function drawDominationZones(cx, cy) {
    if (!domLayout || !mpDom) return;
    const midX = canvas.width/2, midY = canvas.height/2;
    const toX = wx => wx - cx + midX, toY = wy => wy - cy + midY;
    const marginW = canvas.width/(2*zoom) + 1400, marginH = canvas.height/(2*zoom) + 1400;

    // Territory connections between adjacent friendly zones (drawn beneath zones)
    ctx.lineCap = 'round';
    for (const z of domLayout.zones) {
      const zs = domLiveZone(z); if (zs.o < 0) continue;
      for (const nId of z.adj) {
        if (nId <= z.id) continue;
        const n = domZoneById.get(nId); if (!n) continue;
        const ns = domLiveZone(n); if (ns.o !== zs.o) continue;
        const col = domTeamColor(zs.o);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 7/zoom;
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(toX(z.x), toY(z.y)); ctx.lineTo(toX(n.x), toY(n.y)); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;

    for (const z of domLayout.zones) {
      const sx = toX(z.x), sy = toY(z.y);
      if (sx < midX-marginW || sx > midX+marginW || sy < midY-marginH || sy > midY+marginH) continue;
      const zs = domLiveZone(z);
      const owner = zs.o, r = z.r;
      const ownColor = domTeamColor(owner);

      // Hotspot aura
      if (zs.hot) {
        const pulse = 0.45 + 0.3*Math.sin(animTime*5);
        ctx.strokeStyle = `rgba(255,216,77,${pulse})`; ctx.lineWidth = 6/zoom;
        ctx.shadowColor = '#ffd84d'; ctx.shadowBlur = 26;
        ctx.beginPath(); ctx.arc(sx, sy, r + 26, 0, Math.PI*2); ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Territory fill
      if (owner >= 0) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, hexA(ownColor, 0.34)); g.addColorStop(1, hexA(ownColor, 0.05));
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(150,170,190,0.10)';
      }
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();

      // Boundary ring
      ctx.strokeStyle = owner>=0 ? ownColor : 'rgba(180,200,220,0.55)';
      ctx.lineWidth = (owner>=0 ? 3 : 2)/zoom;
      ctx.setLineDash(owner>=0 ? [] : [10/zoom, 8/zoom]);
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      // Capture / neutralize progress arc
      if (zs.p > 0 && zs.p < 100 && zs.cap >= 0) {
        const capColor = domTeamColor(zs.cap);
        ctx.strokeStyle = capColor; ctx.lineWidth = 7/zoom;
        ctx.shadowColor = capColor; ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(sx, sy, r - 5/zoom, -Math.PI/2, -Math.PI/2 + Math.PI*2*(zs.p/100));
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Type icon
      const iconR = Math.min(r*0.42, 64);
      if (z.type === ZONE_VIP) drawZoneStar(sx, sy, iconR, owner>=0 ? ownColor : '#ffd84d');
      else if (z.type === ZONE_HOME) drawZoneShield(sx, sy, iconR, ownColor);
      else if (z.type === ZONE_RESOURCE) drawZoneGem(sx, sy, iconR*0.85, owner>=0 ? ownColor : '#5eff9a');

      // Core status dot (center)
      if (z.core) {
        const cr = 12;
        ctx.beginPath(); ctx.arc(sx, sy, cr, 0, Math.PI*2);
        if (zs.core === 2)      { ctx.fillStyle='rgba(40,10,10,0.85)'; ctx.fill(); ctx.strokeStyle='#fb7185'; }
        else if (zs.core === 1) { const p=0.5+0.5*Math.sin(animTime*9); ctx.fillStyle=`rgba(255,120,80,${0.3+0.45*p})`; ctx.fill(); ctx.strokeStyle='#ffb070'; }
        else                    { ctx.fillStyle='rgba(94,234,212,0.22)'; ctx.fill(); ctx.strokeStyle='#5eead4'; }
        ctx.lineWidth = 2.5/zoom; ctx.stroke();
        if (zs.core === 2) { // broken core: a red slash
          ctx.strokeStyle='#fb7185'; ctx.lineWidth=2.5/zoom;
          ctx.beginPath(); ctx.moveTo(sx-cr*0.7, sy-cr*0.7); ctx.lineTo(sx+cr*0.7, sy+cr*0.7); ctx.stroke();
        }
      }

      // Level pips (owned, non-home)
      if (owner>=0 && z.type !== ZONE_HOME && zs.l > 0) drawLevelPips(sx, sy + r - 16, zs.l, ownColor);
    }
    ctx.lineCap = 'butt';
  }

  function drawFood(cx,cy) {
    const halfW=canvas.width/(2*zoom)+40,halfH=canvas.height/(2*zoom)+40;
    const midX=canvas.width/2,midY=canvas.height/2;
    ctx.shadowBlur=0;
    for(const f of food){
      const sx=f.x-cx+midX,sy=f.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      const tier=f.tier||0;
      const pulse=0.95+0.05*Math.sin(animTime*3+f.x*0.01);
      let spawnScale = 1;
      if (f.spawnTime !== undefined && animTime - f.spawnTime < 0.3) {
        const t = animTime - f.spawnTime;
        spawnScale = Math.min(1, (t / 0.3) * 1.2 - 0.2 * Math.sin(t / 0.3 * Math.PI));
        spawnScale = Math.max(0, spawnScale);
      }
      // Quantize the base radius so we share sprite cache entries across orbs.
      const baseR = Math.max(2, Math.round(f.radius));
      const sprite = getFoodSprite(f.color, tier, baseR);
      const scale = pulse * spawnScale;
      const drawSize = sprite.half * 2 * scale;
      ctx.drawImage(sprite.canvas, sx - drawSize/2, sy - drawSize/2, drawSize, drawSize);
    }
    ctx.globalAlpha=1;
  }

  function drawMegaOrbs(cx,cy) {
    const halfW=canvas.width/(2*zoom)+120,halfH=canvas.height/(2*zoom)+120;
    const midX=canvas.width/2,midY=canvas.height/2;
    for(const m of megaOrbs){
      const sx=m.x-cx+midX,sy=m.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      const pulse=0.92+0.08*Math.sin(animTime*4),r=m.radius*pulse;
      const color=COLORS[m.color]||COLORS[0];
      const halo=ctx.createRadialGradient(sx,sy,r*0.5,sx,sy,r*3.5);
      halo.addColorStop(0,hexFull(color)+'aa');halo.addColorStop(0.4,hexFull(color)+'33');halo.addColorStop(1,'transparent');
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(sx,sy,r*3.5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=color;ctx.globalAlpha=0.7;ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.lineDashOffset=-animTime*15;
      ctx.beginPath();ctx.arc(sx,sy,r*1.5,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      ctx.shadowColor=color;ctx.shadowBlur=25;ctx.fillStyle=color;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#fff';ctx.globalAlpha=0.75;ctx.beginPath();ctx.arc(sx-r*0.25,sy-r*0.25,r*0.45,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      ctx.font='bold 14px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(`+${m.value}`,sx,sy+r+18);
    }
  }

  function drawSnake(snake,cx,cy) {
    const rawSegs=snake.segments; if(rawSegs.length<2) return;

    // --- Fix 4: time-based interpolation between server snapshots ---
    // For each segment, lerp between previous server position and current
    // server position using interpT (0→1 over 33ms server broadcast interval)
    const isMe = snake.id === myId;
    const prev = prevSnakes.find(s => s.id === snake.id);
    const t = Math.min(interpT, 1);
    // Build interpolated target positions from prev→current server state
    const target = [];
    for (let i = 0; i < rawSegs.length; i++) {
      if (prev && prev.segments[i]) {
        target.push({
          x: prev.segments[i].x + (rawSegs[i].x - prev.segments[i].x) * t,
          y: prev.segments[i].y + (rawSegs[i].y - prev.segments[i].y) * t,
        });
      } else {
        target.push({ x: rawSegs[i].x, y: rawSegs[i].y });
      }
    }
    // Continuous display-side lerp on top, for extra smoothness and
    // to absorb any remaining jitter between interpolation cycles.
    let disp = displaySegs.get(snake.id);
    if (!disp || disp.length !== rawSegs.length) {
      disp = target.map(s => ({ x: s.x, y: s.y }));
      displaySegs.set(snake.id, disp);
    }
    // Fix 3: local player body catches up FAST (0.9+) — stays near head
    // Other snakes: 0.6 — hides jitter but keeps close to real-time
    const smooth = gameMode === 'local' ? 1.0 : (isMe ? 0.9 : 0.6);
    const segs = [];
    for (let i = 0; i < rawSegs.length; i++) {
      disp[i].x += (target[i].x - disp[i].x) * smooth;
      disp[i].y += (target[i].y - disp[i].y) * smooth;
      segs.push(disp[i]);
    }

    const headColor=getSegColor(snake,0);
    const thickness=getThickness(snake);
    const dotR=DOT_RADIUS*thickness, headR=HEAD_RADIUS*thickness;
    const halfW=canvas.width/(2*zoom)+80,halfH=canvas.height/(2*zoom)+80;
    const midX=canvas.width/2,midY=canvas.height/2;
    const score = snake.score;
    ctx.shadowBlur=0;

    // Build screen-space segment positions
    const ss = new Array(segs.length);
    for (let i = 0; i < segs.length; i++) {
      ss[i] = { x: segs[i].x - cx + midX, y: segs[i].y - cy + midY };
    }
    // Solid body — thick stroked polyline gives a continuous slither.io tube
    // (replaces the old "string of pearls" per-segment circle render).
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Optional white rim outline for evolved snakes — drawn first, wider
    if (score >= 500) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = dotR * 2.25;
      ctx.beginPath();
      ctx.moveTo(ss[ss.length-1].x, ss[ss.length-1].y);
      for (let i = ss.length - 2; i >= 0; i--) ctx.lineTo(ss[i].x, ss[i].y);
      ctx.stroke();
    }
    // Per-segment smooth curves: single quadratic Bezier between consecutive
    // midpoints with the actual segment as control point. Adjacent segments
    // share midpoint endpoints so the whole body reads as one smooth curve,
    // with only one curveTo per segment (vs two before — half the draw cost).
    ctx.globalAlpha = 0.98;
    for (let i = ss.length - 1; i >= 1; i--) {
      const a = ss[i], b = ss[i-1];
      if (Math.max(a.x, b.x) < midX - halfW || Math.min(a.x, b.x) > midX + halfW ||
          Math.max(a.y, b.y) < midY - halfH || Math.min(a.y, b.y) > midY + halfH) continue;
      const tailT = i / ss.length;
      let w = dotR * 2 * (1 - tailT * 0.22);
      if (score >= 2000) w *= 1 + 0.04 * Math.sin(animTime * 4 + i * 0.3);
      ctx.lineWidth = w;
      ctx.strokeStyle = getSegColor(snake, i);
      const aNext = ss[i + 1];
      const sx = aNext ? (a.x + aNext.x) * 0.5 : a.x;
      const sy = aNext ? (a.y + aNext.y) * 0.5 : a.y;
      const ex = (a.x + b.x) * 0.5;
      const ey = (a.y + b.y) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(a.x, a.y, ex, ey);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const head=segs[0],hx=head.x-cx+canvas.width/2,hy=head.y-cy+canvas.height/2;
    const angle=Math.atan2(head.y-segs[1].y,head.x-segs[1].x);
    // Evolution: score>=200 faint outer glow ring around head
    if (score >= 200) {
      ctx.fillStyle = headColor;
      ctx.globalAlpha = 0.12;
      ctx.beginPath(); ctx.arc(hx, hy, headR * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if(snake.id===myId){ctx.shadowColor=headColor;ctx.shadowBlur=snake.boosting?30:15;}
    ctx.fillStyle=headColor;ctx.beginPath();ctx.arc(hx,hy,headR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // Evolution: score>=5000 lens flare on head (two crossed lines)
    if (score >= 5000) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      const flareR = headR * 1.4;
      ctx.beginPath();
      ctx.moveTo(hx - flareR, hy); ctx.lineTo(hx + flareR, hy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx, hy - flareR); ctx.lineTo(hx, hy + flareR);
      ctx.stroke();
    }
    // Evolution: score>=1000 tiny orbiting particle around head
    if (score >= 1000) {
      const orbitA = animTime * 2; // 2 rad/s
      const orbitR = headR * 1.8;
      const ox = hx + Math.cos(orbitA) * orbitR;
      const oy = hy + Math.sin(orbitA) * orbitR;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const eyeOff=headR*0.5,eyeR=headR*0.28,perp=angle+Math.PI/2;
    // Eye tracking: player's snake looks toward mouse cursor
    const pupilAngle = (snake.id===myId) ? Math.atan2(mouseY-hy,mouseX-hx) : angle;
    for(const side of[-1,1]){
      const ex=hx+Math.cos(angle)*headR*0.3+Math.cos(perp)*eyeOff*side;
      const ey=hy+Math.sin(angle)*headR*0.3+Math.sin(perp)*eyeOff*side;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,eyeR,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+Math.cos(pupilAngle)*eyeR*0.3,ey+Math.sin(pupilAngle)*eyeR*0.3,eyeR*0.55,0,Math.PI*2);ctx.fill();
    }
    // Crown on #1 snake
    if(snake.id===topSnakeId) drawCrown(hx, hy, headR);
    // Painted Victory Royale crown on the winner during celebration
    const isLocalWin = localGame && localGame.matchState === 'victory' && snake.id === myId;
    const isMpWin = mpRoyale && mpRoyale.state === 'ended' && mpRoyale.winnerId === snake.id;
    if (isLocalWin || isMpWin) {
      const bob = Math.sin(animTime * 1.6) * (headR * 0.12);
      const tilt = Math.sin(animTime * 0.9) * 0.08;
      drawGoldCrown(ctx, hx, hy - headR * 2.3 + bob, headR * 1.8, { tilt, glow: true });
    }
    // Accessory
    if(snake.accessory > 0) drawAccessory(ctx, snake.accessory, hx, hy, headR, angle);
    // Boost trail: use CURRENT interpolated tail position
    if(snake.boosting&&segs.length>2&&Math.random()<0.4){const tail=segs[segs.length-1];spawnEatParticles(tail.x,tail.y,snake.skin);}
    // Name + AI badge
    ctx.font='bold 13px "Segoe UI",sans-serif';ctx.textAlign='center';
    ctx.fillStyle='rgba(255,255,255,0.8)';
    const nameStr = snake.name;
    ctx.fillText(nameStr,hx,hy-headR-18);
    // AI badge on canvas (multiplayer only)
    if(snake.isBot&&gameMode==='multiplayer'){
      const tw=ctx.measureText(nameStr).width;
      ctx.font='bold 9px "Segoe UI",sans-serif';
      ctx.fillStyle='rgba(0,255,255,0.15)';
      const bx=hx+tw/2+14,by=hy-headR-25;
      ctx.fillRect(bx-12,by-6,24,13);
      ctx.strokeStyle='rgba(0,255,255,0.4)';ctx.lineWidth=1;ctx.strokeRect(bx-12,by-6,24,13);
      ctx.fillStyle='#0ff';ctx.textAlign='center';ctx.fillText('AI',bx,by+4);
    }
    if(snake.score>0){ctx.font='11px "Segoe UI",sans-serif';ctx.fillStyle='rgba(255,255,255,0.4)';ctx.textAlign='center';ctx.fillText(snake.score,hx,hy-headR-5);}
    // Emote display above snake
    for (const em of emoteDisplays) {
      if (em.snakeId === snake.id) {
        const alpha = Math.min(em.timer, 1);
        const floatY = hy - headR - 40 - (2 - em.timer) * 15;
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 15px "Segoe UI",sans-serif';
        ctx.textAlign = 'center';
        // Background pill
        const tw = ctx.measureText(em.text).width;
        ctx.fillStyle = 'rgba(0,20,40,0.7)';
        ctx.beginPath();
        ctx.arc(hx - tw/2 - 8, floatY - 5, 12, Math.PI*0.5, Math.PI*1.5);
        ctx.arc(hx + tw/2 + 8, floatY - 5, 12, Math.PI*1.5, Math.PI*0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(em.text, hx, floatY);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawParticles(cx,cy) {
    const halfW=canvas.width/(2*zoom)+40,halfH=canvas.height/(2*zoom)+40;
    const midX=canvas.width/2,midY=canvas.height/2;
    for(const p of particles){
      const sx=p.x-cx+midX,sy=p.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      ctx.globalAlpha=p.life;
      if (p.type === 'ring') {
        // Ring shockwave: expanding circle stroke
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * p.life;
        ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,p.size*p.life,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }

  // --- Parallax starfield ---
  function drawStars(cx, cy) {
    const W = canvas.width, H = canvas.height;
    const midX = W / 2, midY = H / 2;
    // Nebula clouds — subtle deep-blue/teal washes (no additive — additive
    // made them feel "vibrant"; normal blend keeps them moody).
    for (const n of nebulae) {
      const nx = n.x * 0.15 - cx * 0.15 + midX;
      const ny = n.y * 0.15 - cy * 0.15 + midY;
      const nr = n.radius;
      if (nx + nr < 0 || nx - nr > W || ny + nr < 0 || ny - nr > H) continue;
      ctx.globalAlpha = n.alpha;
      const grad = ctx.createRadialGradient(nx, ny, nr * 0.05, nx, ny, nr);
      grad.addColorStop(0, n.color);
      grad.addColorStop(1, n.color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cosmic dust — drifts independently, parallax 0.55 so it feels closer
    // than the nebulae. Each frame advance position; wrap around map bounds.
    const dt = Math.min(animTime - (drawStars._t || animTime), 0.05);
    drawStars._t = animTime;
    const halfMap = MAP_SIZE * 0.6;
    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x >  halfMap) d.x -= halfMap * 2;
      if (d.x < -halfMap) d.x += halfMap * 2;
      if (d.y >  halfMap) d.y -= halfMap * 2;
      if (d.y < -halfMap) d.y += halfMap * 2;
      const sx = d.x * 0.55 - cx * 0.55 + midX;
      const sy = d.y * 0.55 - cy * 0.55 + midY;
      if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.tint;
      ctx.beginPath();
      ctx.arc(sx, sy, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stars — gentle twinkle per-star
    for (const star of stars) {
      const sx = star.x * 0.3 - cx * 0.3 + midX;
      const sy = star.y * 0.3 - cy * 0.3 + midY;
      if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      const tw = 0.55 + 0.45 * Math.sin(animTime * star.twinkleSpeed + star.twinklePhase);
      ctx.globalAlpha = star.brightness * tw * 0.85;
      ctx.fillStyle = star.tint;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --- Score popups (called inside zoom transform) ---
  function drawScorePopups(cx, cy, dt) {
    const midX = canvas.width / 2, midY = canvas.height / 2;
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const p = scorePopups[i];
      p.life -= dt * 1.5;
      p.y -= 40 * dt;
      if (p.life <= 0) { scorePopups.splice(i, 1); continue; }
      const sx = p.x - cx + midX, sy = p.y - cy + midY;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px "Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  // --- Kill feed (screen coords, called outside zoom transform) ---
  function drawKillFeed(dt) {
    for (let i = killFeed.length - 1; i >= 0; i--) {
      killFeed[i].timer -= dt;
      if (killFeed[i].timer <= 0) killFeed.splice(i, 1);
    }
    const feedX = canvas.width / 2;
    let feedY = 50;
    ctx.font = 'bold 13px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < killFeed.length && i < 5; i++) {
      const entry = killFeed[killFeed.length - 1 - i];
      if (!entry) continue;
      const alpha = Math.min(entry.timer, 1);
      const slideIn = Math.min(1, (4 - entry.timer) * 4); // slides in over 0.25s
      const tw = ctx.measureText(entry.text).width;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#000';
      ctx.fillRect(feedX - tw / 2 - 12, feedY - 12, tw + 24, 22);
      ctx.globalAlpha = alpha * slideIn;
      ctx.fillStyle = '#fff';
      ctx.fillText(entry.text, feedX, feedY + 3);
      feedY += 28;
    }
    ctx.globalAlpha = 1;
  }

  // --- Crown on #1 ---
  function drawCrown(hx, hy, headR) {
    const crownW = headR * 1.2, crownH = headR * 0.8;
    const cy = hy - headR - crownH - 22;
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx - crownW, cy + crownH);
    ctx.lineTo(hx - crownW, cy + crownH * 0.3);
    ctx.lineTo(hx - crownW * 0.5, cy + crownH * 0.6);
    ctx.lineTo(hx, cy);
    ctx.lineTo(hx + crownW * 0.5, cy + crownH * 0.6);
    ctx.lineTo(hx + crownW, cy + crownH * 0.3);
    ctx.lineTo(hx + crownW, cy + crownH);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- Boost speed lines (screen coords, called outside zoom transform) ---
  function drawSpeedLines(dt) {
    if (!boosting || !running) return;
    speedLineRotation += dt * 0.3;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (const line of speedLines) {
      const a = line.angle + speedLineRotation;
      const innerR = Math.min(canvas.width, canvas.height) * 0.35;
      const outerR = innerR + line.len;
      ctx.globalAlpha = 0.12 + Math.random() * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
      ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // --- Mobile virtual joystick ---
  function drawJoystick() {
    if (!isTouchDevice || !running) return;
    const cx = joystickCenter.x, cy = joystickCenter.y;
    // Outer ring
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, joystickRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Inner knob
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + joystickDelta.x, cy + joystickDelta.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawMinimap(cx,cy) {
    const w=minimapCanvas.width,h=minimapCanvas.height;
    minimapCtx.clearRect(0,0,w,h);
    minimapCtx.fillStyle='rgba(0,10,20,0.6)';minimapCtx.fillRect(0,0,w,h);
    minimapCtx.strokeStyle='rgba(0,255,255,0.3)';minimapCtx.lineWidth=1;minimapCtx.strokeRect(0,0,w,h);
    // Domination uses a wide rectangle — fit it (uniform scale) into the minimap.
    const mmMapW = (domLayout && mpDom) ? domLayout.mapW : MAP_SIZE;
    const mmMapH = (domLayout && mpDom) ? domLayout.mapH : MAP_SIZE;
    const scale=Math.min(w/mmMapW, h/mmMapH),ox=w/2,oy=h/2;
    // Battle Royale safe zone — red danger fill + safe-zone ring + target preview
    if (localGame && localGame.mode === 'royale') {
      const zcx = (localGame.safeCenterX || 0) * scale + ox;
      const zcy = (localGame.safeCenterY || 0) * scale + oy;
      const zr = localGame.safeRadius * scale;
      const zrTarget = localGame.safeTargetRadius * scale;
      // Danger fill outside the safe zone (within minimap bounds)
      minimapCtx.fillStyle = 'rgba(220, 40, 40, 0.18)';
      minimapCtx.beginPath();
      minimapCtx.rect(0, 0, w, h);
      minimapCtx.arc(zcx, zcy, zr, 0, Math.PI * 2, true);
      minimapCtx.fill('evenodd');
      // Safe boundary
      const closing = localGame.royalePhaseState === 'shrink';
      minimapCtx.strokeStyle = closing ? 'rgba(255,110,110,0.95)' : 'rgba(255,180,80,0.85)';
      minimapCtx.lineWidth = 1.5;
      minimapCtx.setLineDash([3, 3]);
      minimapCtx.beginPath();
      minimapCtx.arc(zcx, zcy, zr, 0, Math.PI * 2);
      minimapCtx.stroke();
      // Target zone preview during hold
      if (zrTarget < zr - 2) {
        minimapCtx.strokeStyle = 'rgba(94,234,212,0.7)';
        minimapCtx.lineWidth = 1;
        minimapCtx.setLineDash([2, 3]);
        minimapCtx.beginPath();
        minimapCtx.arc(zcx, zcy, zrTarget, 0, Math.PI * 2);
        minimapCtx.stroke();
      }
      minimapCtx.setLineDash([]);
    }
    // Zone Domination — territory control overlay
    if (domLayout && mpDom) {
      minimapCtx.strokeStyle = 'rgba(120,160,200,0.25)'; minimapCtx.lineWidth = 1;
      minimapCtx.strokeRect(ox - mmMapW*scale/2, oy - mmMapH*scale/2, mmMapW*scale, mmMapH*scale);
      for (const z of domLayout.zones) {
        const zs = domLiveZone(z); if (zs.o < 0) continue;
        for (const nId of z.adj) {
          if (nId <= z.id) continue;
          const n = domZoneById.get(nId); if (!n) continue;
          const ns = domLiveZone(n); if (ns.o !== zs.o) continue;
          minimapCtx.strokeStyle = hexA(domTeamColor(zs.o), 0.6); minimapCtx.lineWidth = 1.5;
          minimapCtx.beginPath(); minimapCtx.moveTo(z.x*scale+ox, z.y*scale+oy); minimapCtx.lineTo(n.x*scale+ox, n.y*scale+oy); minimapCtx.stroke();
        }
      }
      for (const z of domLayout.zones) {
        const zs = domLiveZone(z);
        const rr = (z.type === ZONE_HOME || z.type === ZONE_VIP) ? 5 : 3.5;
        if (zs.hot) { minimapCtx.shadowColor = '#ffd84d'; minimapCtx.shadowBlur = 6; }
        minimapCtx.fillStyle = zs.o >= 0 ? domTeamColor(zs.o) : 'rgba(165,185,205,0.55)';
        minimapCtx.beginPath(); minimapCtx.arc(z.x*scale+ox, z.y*scale+oy, rr, 0, Math.PI*2); minimapCtx.fill();
        minimapCtx.shadowBlur = 0;
        if (z.type === ZONE_VIP) { minimapCtx.strokeStyle = '#ffd84d'; minimapCtx.lineWidth = 1.5; minimapCtx.stroke(); }
      }
    }
    const megaPulse=0.7+0.3*Math.sin(animTime*4);
    for(const m of megaOrbs){minimapCtx.fillStyle=COLORS[m.color];minimapCtx.globalAlpha=megaPulse;minimapCtx.beginPath();minimapCtx.arc(m.x*scale+ox,m.y*scale+oy,3,0,Math.PI*2);minimapCtx.fill();}
    minimapCtx.globalAlpha=1;
    for(const snake of snakes){
      if(!snake.alive||snake.segments.length===0) continue;
      const head=snake.segments[0];
      // Domination: color heads by team so friend/foe reads at a glance.
      minimapCtx.fillStyle = snake.id===myId ? '#fff'
        : (domLayout && mpDom && snake.teamId>=0) ? domTeamColor(snake.teamId)
        : getSegColor(snake,0);
      minimapCtx.globalAlpha=snake.id===myId?1:0.6;
      minimapCtx.beginPath();minimapCtx.arc(head.x*scale+ox,head.y*scale+oy,snake.id===myId?3:2,0,Math.PI*2);minimapCtx.fill();
    }
    minimapCtx.globalAlpha=1;
    const vw=canvas.width*scale,vh=canvas.height*scale;
    minimapCtx.strokeStyle='rgba(255,255,255,0.3)';
    minimapCtx.strokeRect(cx*scale+ox-vw/2,cy*scale+oy-vh/2,vw,vh);
  }

  // =====================================================
  // Main frame loop
  // =====================================================
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now-lastFrame)/1000, 0.05);
    lastFrame = now; animTime += dt;

    // Advance interpolation factor toward 1
    interpT += dt / 0.033; // server broadcasts at 30Hz (33ms)

    // Update screen flash
    if (screenFlash) {
      screenFlash.timer -= dt;
      if (screenFlash.timer <= 0) screenFlash = null;
    }

    // Freeze frame on kill — skip game updates but still render
    let gameDt = dt;
    if (freezeTimer > 0) { freezeTimer -= dt; gameDt = 0; }

    // Spectate timer countdown
    if (spectateTimer > 0) {
      spectateTimer -= dt;
      if (spectateTarget) {
        camera.x += (spectateTarget.x - camera.x) * 0.03;
        camera.y += (spectateTarget.y - camera.y) * 0.03;
      }
      if (spectateTimer <= 0) {
        spectateTimer = 0; spectateTarget = null;
        deathScreen.style.display='flex';
        document.body.style.cursor='default';
        running=false;
        disconnect();
      }
    }

    // Score counter animation
    displayScore += (lastScore - displayScore) * 0.15;

    // Determine #1 snake
    topSnakeId = null;
    let topScore = -1;
    for (const s of snakes) { if (s.alive && s.score > topScore) { topScore = s.score; topSnakeId = s.id; } }

    if (running) {
      if (gameMode==='local' && localGame) {
        // Local mode: tick game, read state, feed input
        const angle = (isTouchDevice && joystickActive)
          ? joystickAngle
          : Math.atan2(mouseY-canvas.height/2, mouseX-canvas.width/2);
        localGame.setPlayerInput(angle, boosting);
        localGame.tick(gameDt);
        prevSnakes = snakes;
        snakes = localGame.snakes.filter(s => s.alive);
        // Tag new food with spawnTime for spawn-in animation
        const localNewFood = localGame.food;
        const localPrevFoodSet = new Set(prevFood.map(f => f.x + ',' + f.y));
        for (const f of localNewFood) {
          if (!localPrevFoodSet.has(f.x + ',' + f.y) && f.spawnTime === undefined) {
            f.spawnTime = animTime;
          }
        }
        prevFood = localNewFood;
        food = localNewFood;
        megaOrbs = localGame.megaOrbs;
        const me = localGame.snakes.find(s => s.id === myId);
        // Spectator camera: follow the leader (highest-score alive snake)
        if (spectatingBR && (!me || !me.alive)) {
          const target = localGame.snakes
            .filter(s => s.alive)
            .sort((a, b) => b.score - a.score)[0];
          if (target && target.segments.length > 0) {
            camera.x += (target.segments[0].x - camera.x) * 0.10;
            camera.y += (target.segments[0].y - camera.y) * 0.10;
          }
        } else if (me && me.alive) {
          camera.x += (me.segments[0].x - camera.x) * 0.12;
          camera.y += (me.segments[0].y - camera.y) * 0.12;
          // Score popup on increase (local)
          if (me.score > prevScore && prevScore > 0) {
            const diff = me.score - prevScore;
            const head = me.segments[0];
            const skin = SKINS[me.skin] || SKINS[0];
            scorePopups.push({ x: head.x, y: head.y - 30, text: '+' + diff, color: skin.colors[0], life: 1.0 });
            foodEaten++;
            // Screen flash on mega orb eat (score jump >= 40)
            if (diff >= 40 && head) {
              let flashColor = '#fff';
              let minD = Infinity;
              for (const m of megaOrbs) {
                const dx = m.x - head.x, dy = m.y - head.y;
                const d = dx * dx + dy * dy;
                if (d < minD) { minD = d; flashColor = COLORS[m.color] || '#fff'; }
              }
              screenFlash = { color: flashColor, alpha: 0.3, timer: 0.3 };
            }
          }
          if (me.score > peakScore) peakScore = me.score;
          prevScore = me.score;
          myScoreEl.textContent = `Score: ${Math.round(displayScore)} | Kills: ${myKills}`;
          lastScore = me.score;
        }
        // Update leaderboard
        const sorted = localGame.snakes.filter(s=>s.alive).sort((a,b)=>b.score-a.score).slice(0,10);
        leaderboardEntries.innerHTML='';
        for(const s of sorted){
          const div=document.createElement('div');
          div.className='entry'+(s.id===myId?' me':'');
          div.innerHTML=`<span>${s.name}</span><span>${s.score}</span>`;
          leaderboardEntries.appendChild(div);
        }
        playerCountEl.textContent=`Players: ${localGame.snakes.filter(s=>s.alive).length}`;
      } else if (gameMode==='multiplayer') {
        // Fix 1: send mouse direction every frame (no throttle)
        sendDirection();
        // Fix 2+5: Client-side prediction with aggressive error correction
        const mePred = snakes.find(s => s.id === myId);
        if (mePred && mePred.segments.length > 0) {
          const head = mePred.segments[0];
          if (!predict.valid) {
            predict.x = head.x; predict.y = head.y; predict.angle = mePred.angle || 0; predict.valid = true;
          }
          // Error-correct toward server more aggressively (0.35 base)
          // Very large errors (>200px) snap harder to catch desync/teleport
          const errDx = head.x - predict.x, errDy = head.y - predict.y;
          const errDist = Math.sqrt(errDx*errDx + errDy*errDy);
          const errFactor = errDist > 200 ? 0.6 : 0.35;
          predict.x += errDx * errFactor;
          predict.y += errDy * errFactor;
          // Predict: advance in player's current input direction
          const targetAngle = Math.atan2(mouseY - canvas.height/2, mouseX - canvas.width/2);
          let ad = targetAngle - predict.angle;
          while (ad > Math.PI) ad -= Math.PI*2; while (ad < -Math.PI) ad += Math.PI*2;
          const turnRate = 9;
          if (Math.abs(ad) < turnRate * gameDt) predict.angle = targetAngle;
          else predict.angle += Math.sign(ad) * turnRate * gameDt;
          const speed = boosting ? 500 : 280;
          predict.x += Math.cos(predict.angle) * speed * gameDt;
          predict.y += Math.sin(predict.angle) * speed * gameDt;
          // Apply predicted head position to the live snake
          head.x = predict.x; head.y = predict.y;
        }
      }
    }

    updateParticles(dt);
    // Update emote timers
    for (let i = emoteDisplays.length - 1; i >= 0; i--) {
      emoteDisplays[i].timer -= dt;
      if (emoteDisplays[i].timer <= 0) emoteDisplays.splice(i, 1);
    }

    let shakeX=0,shakeY=0;
    if(screenShake>0){if(showShake){shakeX=(Math.random()-0.5)*screenShake;shakeY=(Math.random()-0.5)*screenShake;}screenShake*=0.9;if(screenShake<0.5)screenShake=0;}
    const cx=camera.x+shakeX, cy=camera.y+shakeY;
    // Logarithmic zoom — gradual, never jarring. 0→0.72, 500→0.60, 2000→0.52, 10000→0.44
    const targetZoom=Math.max(0.38, BASE_ZOOM - 0.08 * Math.log10(1 + lastScore / 50));
    zoom+=(targetZoom-zoom)*0.05;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,canvas.width,canvas.height);
    const grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.width*0.2,canvas.width/2,canvas.height/2,canvas.width*0.7);
    grad.addColorStop(0,'rgba(13,27,42,0)');grad.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(zoom,zoom);ctx.translate(-canvas.width/2,-canvas.height/2);
    drawStars(cx,cy); drawHexGrid(cx,cy); if(showGrid) drawGrid(cx,cy); drawBorder(cx,cy); drawRoyaleRing(cx,cy); drawDominationZones(cx,cy); drawFood(cx,cy); drawMegaOrbs(cx,cy);
    const me=snakes.find(s=>s.id===myId);
    for(const snake of snakes){if(snake.alive&&snake.id!==myId)drawSnake(snake,cx,cy);}
    if(me&&me.alive) drawSnake(me,cx,cy);
    drawParticles(cx,cy);
    drawScorePopups(cx, cy, dt);
    ctx.restore();

    // Screen flash effect (mega orb eat)
    if (screenFlash) {
      ctx.globalAlpha = screenFlash.alpha * (screenFlash.timer / 0.3);
      ctx.fillStyle = screenFlash.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }

    if(running){
      ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.5;const cr=12;
      ctx.beginPath();ctx.arc(mouseX,mouseY,cr,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouseX-cr-4,mouseY);ctx.lineTo(mouseX-cr+4,mouseY);
      ctx.moveTo(mouseX+cr-4,mouseY);ctx.lineTo(mouseX+cr+4,mouseY);
      ctx.moveTo(mouseX,mouseY-cr-4);ctx.lineTo(mouseX,mouseY-cr+4);
      ctx.moveTo(mouseX,mouseY+cr-4);ctx.lineTo(mouseX,mouseY+cr+4);
      ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.8)';ctx.beginPath();ctx.arc(mouseX,mouseY,2,0,Math.PI*2);ctx.fill();
      drawJoystick();
    }
    // Screen-space overlays (outside zoom transform)
    drawKillFeed(dt);
    drawSpeedLines(dt);
    // Pull fresh phase status from the local game so the HUD reflects current state
    if (localGame && localGame.mode === 'royale' && typeof localGame.getRoyaleStatus === 'function') {
      localRoyaleStatus = localGame.getRoyaleStatus();
    } else {
      localRoyaleStatus = null;
    }
    drawRoyaleHUD(dt, cx, cy);
    drawDominationHUD(dt);
    // SPECTATING pill while watching after elimination
    if (spectatingBR) {
      ctx.save();
      const txt = 'SPECTATING';
      ctx.font = "800 11px 'Inter', sans-serif";
      const w = ctx.measureText(txt).width + 28;
      const px = canvas.width/2 - w/2, py = canvas.height - 56;
      ctx.fillStyle = 'rgba(10,12,28,0.85)';
      ctx.strokeStyle = 'rgba(167,139,250,0.6)';
      roundRect(ctx, px, py, w, 24, 12);
      ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#c4b5fd';
      ctx.textAlign = 'center';
      ctx.fillText(txt, canvas.width/2, py + 16);
      ctx.restore();
    }
    // Spectate text
    if (spectateTimer > 0) {
      ctx.font = 'bold 20px "Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('Spectating...', canvas.width / 2, canvas.height - 60);
    }
    // Ping display (multiplayer, updates every 0.5s for stability)
    if (gameMode === 'multiplayer' && running) {
      pingTimer += dt;
      if (pingTimer >= 0.5) {
        pingTimer = 0;
        const pingEl = document.getElementById('ping');
        if (pingEl) {
          const p = Math.round(ping);
          const color = p < 30 ? '#0f0' : p < 60 ? '#ff0' : '#f44';
          pingEl.textContent = p + 'ms';
          pingEl.style.color = color;
        }
      }
    }
    // Update HUD score with animated counter + kills
    if (running && gameMode === 'multiplayer') {
      myScoreEl.textContent = `Score: ${Math.round(displayScore)} | Kills: ${myKills}`;
    }
    drawMinimap(cx,cy);
  }

  requestAnimationFrame(frame);

  // =====================================================
  // Menu background — animated snakes behind the start screen
  // =====================================================
  const menuBg = document.getElementById('menuBg');
  const mbCtx = menuBg.getContext('2d');
  const bgSnakes = [];

  function initMenuBg() {
    menuBg.width = window.innerWidth;
    menuBg.height = window.innerHeight;
    bgSnakes.length = 0;
    for (let i = 0; i < 8; i++) {
      const segs = [];
      const x = Math.random() * menuBg.width;
      const y = Math.random() * menuBg.height;
      const a = Math.random() * Math.PI * 2;
      for (let j = 0; j < 15; j++) {
        segs.push({ x: x - Math.cos(a) * j * 14, y: y - Math.sin(a) * j * 14 });
      }
      bgSnakes.push({
        segs, angle: a, speed: 40 + Math.random() * 30,
        turnRate: 0.5 + Math.random() * 1.5, turnTimer: 0,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        skin: Math.floor(Math.random() * SKINS.length),
      });
    }
  }
  initMenuBg();
  window.addEventListener('resize', () => { menuBg.width = window.innerWidth; menuBg.height = window.innerHeight; });

  let menuAnimTime = 0;
  function animateMenuBg(now) {
    requestAnimationFrame(animateMenuBg);
    const dt = 0.016;
    menuAnimTime += dt;

    // Show bg when not actively in gameplay (hud visible = in game)
    const inGame = hud.style.display === 'block';
    menuBg.style.display = inGame ? 'none' : 'block';
    if (inGame) return;

    mbCtx.clearRect(0, 0, menuBg.width, menuBg.height);
    mbCtx.fillStyle = '#0a0a1a';
    mbCtx.fillRect(0, 0, menuBg.width, menuBg.height);

    // Draw subtle grid
    mbCtx.strokeStyle = 'rgba(0,255,255,0.025)';
    mbCtx.lineWidth = 1;
    mbCtx.beginPath();
    for (let x = 0; x < menuBg.width; x += 50) { mbCtx.moveTo(x, 0); mbCtx.lineTo(x, menuBg.height); }
    for (let y = 0; y < menuBg.height; y += 50) { mbCtx.moveTo(0, y); mbCtx.lineTo(menuBg.width, y); }
    mbCtx.stroke();

    // Animate background snakes
    for (const bs of bgSnakes) {
      bs.turnTimer -= dt;
      if (bs.turnTimer <= 0) {
        bs.turnTimer = 1 + Math.random() * 2;
        bs.targetAngle = bs.angle + (Math.random() - 0.5) * 2;
      }
      let ad = (bs.targetAngle || bs.angle) - bs.angle;
      while (ad > Math.PI) ad -= Math.PI * 2;
      while (ad < -Math.PI) ad += Math.PI * 2;
      bs.angle += Math.sign(ad) * Math.min(Math.abs(ad), bs.turnRate * dt);

      const head = bs.segs[0];
      head.x += Math.cos(bs.angle) * bs.speed * dt;
      head.y += Math.sin(bs.angle) * bs.speed * dt;
      // Wrap around screen
      if (head.x < -50) head.x = menuBg.width + 50;
      if (head.x > menuBg.width + 50) head.x = -50;
      if (head.y < -50) head.y = menuBg.height + 50;
      if (head.y > menuBg.height + 50) head.y = -50;

      // Trail body
      for (let i = 1; i < bs.segs.length; i++) {
        const prev = bs.segs[i - 1], cur = bs.segs[i];
        const dx = prev.x - cur.x, dy = prev.y - cur.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 14) { const t = 14 / d; cur.x = prev.x - dx * t; cur.y = prev.y - dy * t; }
      }

      // Draw body
      const skin = SKINS[bs.skin] || SKINS[0];
      for (let i = bs.segs.length - 1; i >= 1; i--) {
        const s = bs.segs[i];
        const tailT = i / bs.segs.length;
        const r = 5 * (1 - tailT * 0.3);
        mbCtx.fillStyle = skin.colors[i % skin.colors.length];
        mbCtx.globalAlpha = 0.25;
        mbCtx.beginPath(); mbCtx.arc(s.x, s.y, r, 0, Math.PI * 2); mbCtx.fill();
      }
      // Head
      mbCtx.fillStyle = skin.colors[0];
      mbCtx.globalAlpha = 0.35;
      mbCtx.beginPath(); mbCtx.arc(head.x, head.y, 7, 0, Math.PI * 2); mbCtx.fill();
      mbCtx.globalAlpha = 1;
    }
  }
  requestAnimationFrame(animateMenuBg);
})();
