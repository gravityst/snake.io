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
  const MAP_SIZE = 9000;
  const DOT_RADIUS = 9;
  const HEAD_RADIUS = 14;
  const BASE_ZOOM = 0.72;
  const COLORS = ['#0ff', '#f0f', '#0f0', '#ff0', '#f80', '#08f', '#f44', '#8f0'];

  // --- Skins ---
  const SKINS = [
    { name: 'Cyan', colors: ['#0ff'] }, { name: 'Magenta', colors: ['#f0f'] },
    { name: 'Lime', colors: ['#0f0'] }, { name: 'Gold', colors: ['#ff0'] },
    { name: 'Coral', colors: ['#f44'] }, { name: 'Sky', colors: ['#08f'] },
    { name: 'Violet', colors: ['#a0f'] }, { name: 'Mint', colors: ['#5fc'] },
    { name: 'Pearl', colors: ['#fff'] }, { name: 'Charcoal', colors: ['#666'] },
    { name: 'Crimson', colors: ['#c12'] }, { name: 'Teal', colors: ['#0a8'] },
    { name: 'Amber', colors: ['#fa3'] },
    { name: 'Bumblebee', colors: ['#ff0','#222'] }, { name: 'Zebra', colors: ['#fff','#111'] },
    { name: 'Coralreef', colors: ['#f44','#fff'] }, { name: 'Wasp', colors: ['#f80','#000'] },
    { name: 'Mintchip', colors: ['#5fc','#222'] }, { name: 'Bubblegum', colors: ['#f6c','#fff'] },
    { name: 'Twilight', colors: ['#a0f','#08f'] },
    { name: 'Sunset', colors: ['#f80','#f44','#ff0'] }, { name: 'Ocean', colors: ['#0ff','#08f','#04d'] },
    { name: 'Toxic', colors: ['#0f0','#ff0','#0f0'] }, { name: 'Fire', colors: ['#f44','#f80','#ff0'] },
    { name: 'Galaxy', colors: ['#a0f','#08f','#f0f','#0ff'] },
    { name: 'Candy', colors: ['#f0f','#fff','#f0f','#fff'] },
    { name: 'Ice', colors: ['#aef','#0ff','#fff'] },
    { name: 'Lava', colors: ['#f44','#f80','#ff0','#f44'] },
    { name: 'Forest', colors: ['#0a4','#0f0','#4f8'] },
    { name: 'Aurora', colors: ['#0fa','#0af','#a0f','#0fa'] },
    { name: 'Cosmic', colors: ['#a0f','#f0f','#fff','#08f'] },
    { name: 'Peacock', colors: ['#0ff','#0a8','#08f','#a0f'] },
    { name: 'Strawberry', colors: ['#f44','#fff','#f0c'] },
    { name: 'Watermelon', colors: ['#f44','#0f0','#fff'] },
    { name: 'Matrix', colors: ['#0f0','#0a4','#0f0','#fff'] },
    { name: 'Cyberpunk', colors: ['#f0f','#0ff','#000','#f0f','#0ff'] },
    { name: 'Dragon', colors: ['#f44','#ff0','#0a4','#08f'] },
    { name: 'Plasma', colors: ['#f0f','#a0f','#08f','#0ff'] },
    { name: 'Pumpkin', colors: ['#f80','#222','#f80','#222'] },
    { name: 'Neon Party', colors: ['#f0f','#0ff','#ff0','#0f0'] },
    { name: 'Rainbow', colors: ['#f44','#f80','#ff0','#0f0','#08f','#a0f'] },
    { name: 'Pastel', colors: ['#fbb','#fdb','#ffb','#bfb','#bdf','#fbf'] },
    { name: 'Spectrum', colors: ['#f00','#f80','#ff0','#0f0','#0ff','#08f','#a0f','#f0f'] },
  ];

  let selectedSkin = 0;

  // --- Skin picker ---
  function buildSkinGrid() {
    skinGrid.innerHTML = '';
    SKINS.forEach((skin, idx) => {
      const card = document.createElement('div');
      card.className = 'skin-card' + (idx === selectedSkin ? ' selected' : '');
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
      nameDiv.className = 'skin-name'; nameDiv.textContent = skin.name;
      card.appendChild(dotsDiv); card.appendChild(nameDiv);
      card.addEventListener('click', () => {
        selectedSkin = idx;
        document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
      skinGrid.appendChild(card);
    });
  }
  buildSkinGrid();

  skinsBtn.addEventListener('click', () => { startScreen.style.display='none'; skinScreen.style.display='flex'; });
  skinBackBtn.addEventListener('click', () => { skinScreen.style.display='none'; startScreen.style.display='flex'; });

  // --- Helpers ---
  function hexFull(c) { if (c.length===4) return '#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c; }
  function getSegColor(snake, i) { const skin = SKINS[snake.skin]||SKINS[0]; return skin.colors[i%skin.colors.length]; }
  function getThickness(snake) { return 1 + Math.min(snake.score/500, 0.8); }

  // --- Game state ---
  let snakes = [], food = [], megaOrbs = [], particles = [];
  let myId = null, ws = null, localGame = null;
  let gameMode = null; // 'local' | 'multiplayer'
  let currentRoomId = null;
  let running = false;
  let camera = { x: 0, y: 0 };
  let mouseX = 0, mouseY = 0, boosting = false;
  let screenShake = 0, lastFrame = 0, animTime = 0;
  let zoom = BASE_ZOOM, lastScore = 0, sendTimer = 0;
  let roomPollInterval = null;

  // --- Resize ---
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();

  // --- Input ---
  canvas.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
  canvas.addEventListener('mousedown', () => setBoosting(true));
  canvas.addEventListener('mouseup', () => setBoosting(false));
  window.addEventListener('keydown', (e) => { if (e.code==='Space') { e.preventDefault(); setBoosting(true); } });
  window.addEventListener('keyup', (e) => { if (e.code==='Space') setBoosting(false); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); mouseX=e.touches[0].clientX; mouseY=e.touches[0].clientY; }, {passive:false});
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); mouseX=e.touches[0].clientX; mouseY=e.touches[0].clientY; if(e.touches.length>=2) setBoosting(true); }, {passive:false});
  canvas.addEventListener('touchend', (e) => { if(e.touches.length<2) setBoosting(false); });

  function setBoosting(val) {
    boosting = val;
    if (gameMode==='multiplayer' && ws && ws.readyState===WebSocket.OPEN) {
      const buf = new Uint8Array(2); buf[0]=0x02; buf[1]=val?1:0; ws.send(buf);
    }
  }

  // =====================================================
  // Mode selection
  // =====================================================
  playAIBtn.addEventListener('click', startLocalGame);
  nameInput.addEventListener('keydown', (e) => { if (e.key==='Enter') startLocalGame(); });
  respawnBtn.addEventListener('click', () => {
    if (gameMode==='local') startLocalGame();
    else if (gameMode==='multiplayer') startMultiplayerGame(currentRoomId);
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
    roomTeamSizeSelect.style.display = roomModeSelect.value==='team' ? 'block' : 'none';
  });
  createRoomSubmit.addEventListener('click', async () => {
    const rName = roomNameInput.value.trim() || 'Custom Room';
    const mode = roomModeSelect.value;
    const teamSize = parseInt(roomTeamSizeSelect.value) || 2;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name: rName, mode, teamSize, creatorName: nameInput.value.trim() }),
      });
      const data = await res.json();
      if (data.id) {
        hideAllScreens();
        if (mode==='team') showTeamSelector(data.id);
        else startMultiplayerGame(data.id);
      }
    } catch(e) { console.error('Create room failed:', e); }
  });

  // --- PLAY VS AI ---
  function startLocalGame() {
    gameMode = 'local';
    const name = nameInput.value.trim() || 'Player';
    localGame = new LocalGame(name, selectedSkin);
    myId = localGame.playerId;
    localGame.onPlayerDeath((score) => {
      lastScore = score;
      finalScoreEl.textContent = score;
      deathScreen.style.display = 'flex';
      document.body.style.cursor = 'default';
      screenShake = 15;
      running = false;
    });
    // Set initial camera
    const me = localGame.snakes.find(s => s.id === myId);
    if (me) { camera.x = me.segments[0].x; camera.y = me.segments[0].y; }
    hideAllScreens(); hud.style.display='block'; document.body.style.cursor='crosshair'; running=true;
  }

  // --- MULTIPLAYER ---
  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      const rooms = await res.json();
      roomList.innerHTML = '';
      for (const room of rooms) {
        const card = document.createElement('div');
        card.className = 'room-card' + (room.players >= room.maxPlayers ? ' full' : '');
        const modeBadge = room.mode==='team'
          ? `<span class="mode-badge team">TEAM ${room.teamSize}v${room.teamSize}</span>`
          : `<span class="mode-badge solo">SOLO</span>`;
        const customBadge = room.isCustom ? '<span class="mode-badge custom">CUSTOM</span>' : '';
        card.innerHTML = `<div class="room-left">${modeBadge}${customBadge}<span class="room-name">${room.name}</span></div><span class="room-players">${room.players}/${room.maxPlayers}</span>`;
        if (room.players < room.maxPlayers) {
          card.addEventListener('click', () => {
            if (roomPollInterval) { clearInterval(roomPollInterval); roomPollInterval=null; }
            if (room.mode==='team') showTeamSelector(room.id, room.teams);
            else startMultiplayerGame(room.id);
          });
        }
        roomList.appendChild(card);
      }
    } catch (e) {
      roomList.innerHTML = '<p style="color:#f44;text-align:center;">Could not connect to server</p>';
    }
  }

  let pendingRoomId = null;
  let selectedTeamId = -1;

  function showTeamSelector(roomId, teams) {
    pendingRoomId = roomId;
    hideAllScreens();
    teamScreen.style.display = 'flex';
    teamGrid.innerHTML = '';
    // If we have team data, show it. Otherwise fetch fresh.
    if (teams) renderTeams(teams);
    else fetch('/api/rooms').then(r=>r.json()).then(rooms=>{
      const room = rooms.find(r=>r.id===roomId);
      if (room && room.teams) renderTeams(room.teams);
    });
  }

  function renderTeams(teams) {
    teamGrid.innerHTML = '';
    for (const team of teams) {
      const card = document.createElement('div');
      card.className = 'team-card';
      card.innerHTML = `<div class="team-color" style="background:${team.color};box-shadow:0 0 10px ${team.color}"></div>
        <div class="team-name">${team.name}</div>
        <div class="team-count">${team.members} players</div>`;
      card.addEventListener('click', () => {
        selectedTeamId = team.id;
        startMultiplayerGame(pendingRoomId, team.id);
      });
      teamGrid.appendChild(card);
    }
  }

  function startMultiplayerGame(roomId, teamId) {
    gameMode = 'multiplayer';
    currentRoomId = roomId;
    selectedTeamId = teamId ?? -1;
    const name = nameInput.value.trim() || 'Player';
    connect(name, roomId, selectedTeamId);
    hideAllScreens(); hud.style.display='block'; document.body.style.cursor='crosshair'; running=true;
  }

  function hideAllScreens() {
    startScreen.style.display='none'; skinScreen.style.display='none';
    roomScreen.style.display='none'; deathScreen.style.display='none';
    teamScreen.style.display='none'; createRoomScreen.style.display='none';
  }

  // =====================================================
  // WebSocket (multiplayer mode only)
  // =====================================================
  function connect(name, roomId, teamId) {
    if (ws) ws.close();
    const proto = location.protocol==='https:'?'wss':'ws';
    ws = new WebSocket(`${proto}://${location.host}?room=${encodeURIComponent(roomId)}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      const nameBytes = new TextEncoder().encode(name.substring(0,16));
      // [0x03][skinIdx][teamId if team mode][name...]
      const hasTeam = teamId !== undefined && teamId >= 0;
      const buf = new Uint8Array((hasTeam ? 3 : 2) + nameBytes.length);
      buf[0]=0x03; buf[1]=selectedSkin;
      if (hasTeam) { buf[2]=teamId; buf.set(nameBytes,3); }
      else buf.set(nameBytes,2);
      ws.send(buf);
    };
    ws.onmessage = (event) => {
      const buf = new DataView(event.data);
      if (buf.byteLength<1) return;
      const type = buf.getUint8(0);
      if (type===0x02) myId = buf.getUint16(1,true);
      else if (type===0x01) parseState(buf);
      else if (type===0x03) { if(buf.getUint16(1,true)===myId) onDeath(); }
      else if (type===0x04) {
        const killedId=buf.getUint16(3,true);
        const killed=snakes.find(s=>s.id===killedId);
        if(killed&&killed.segments.length>0) spawnDeathParticles(killed.segments[0].x,killed.segments[0].y,killed.skin);
        if(killedId===myId) screenShake=15;
      }
      else if (type===0x05) parseLeaderboard(buf);
    };
    ws.onclose = () => { if(running) setTimeout(()=>connect(name,roomId),2000); };
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
      const score=buf.getUint16(off,true); off+=2;
      const nameLen=buf.getUint8(off); off+=1;
      const name=new TextDecoder().decode(new Uint8Array(buf.buffer,off,nameLen)); off+=nameLen;
      const segCount=buf.getUint16(off,true); off+=2;
      const segments=[];
      for (let j=0;j<segCount;j++) { segments.push({x:buf.getInt16(off,true),y:buf.getInt16(off+2,true)}); off+=4; }
      newSnakes.push({id,skin,boosting:isBoosting,isBot,teamId,score,name,segments,alive:true});
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
    snakes=newSnakes; food=newFood; megaOrbs=newMega;
    const me=snakes.find(s=>s.id===myId);
    if (me&&me.segments.length>0) {
      camera.x+=(me.segments[0].x-camera.x)*0.15;
      camera.y+=(me.segments[0].y-camera.y)*0.15;
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

  function onDeath() {
    finalScoreEl.textContent=lastScore;
    deathScreen.style.display='flex';
    document.body.style.cursor='default';
    screenShake=15; myId=null; running=false;
  }

  function sendDirection() {
    if (!ws||ws.readyState!==WebSocket.OPEN||myId===null) return;
    const angle=Math.atan2(mouseY-canvas.height/2,mouseX-canvas.width/2);
    const buf=new ArrayBuffer(5); const v=new DataView(buf);
    v.setUint8(0,0x01); v.setFloat32(1,angle,true); ws.send(buf);
  }

  // --- Particles ---
  function spawnDeathParticles(x,y,skinIdx) {
    const color=(SKINS[skinIdx]||SKINS[0]).colors[0];
    for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*200;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.5+Math.random(),size:3+Math.random()*6,color});}
  }
  function spawnEatParticles(x,y,skinIdx) {
    const color=(SKINS[skinIdx]||SKINS[0]).colors[0];
    for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*80;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:1.5+Math.random()*1.5,size:2+Math.random()*3,color});}
  }
  function updateParticles(dt) {
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.96;p.vy*=0.96;p.life-=p.decay*dt;if(p.life<=0)particles.splice(i,1);}
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

  function drawBorder(cx,cy) {
    const half=MAP_SIZE/2,sx=-half-cx+canvas.width/2,sy=-half-cy+canvas.height/2;
    ctx.strokeStyle='rgba(255,60,60,0.5)'; ctx.lineWidth=4; ctx.strokeRect(sx,sy,MAP_SIZE,MAP_SIZE);
  }

  function drawFood(cx,cy) {
    const halfW=canvas.width/(2*zoom)+40,halfH=canvas.height/(2*zoom)+40;
    const midX=canvas.width/2,midY=canvas.height/2;
    ctx.shadowBlur=0;
    for(const f of food){
      const sx=f.x-cx+midX,sy=f.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      const tier=f.tier||0,pulse=0.9+0.1*Math.sin(animTime*3+f.x*0.01),r=f.radius*pulse;
      const color=COLORS[f.color]||COLORS[0];
      if(tier>=4){ctx.fillStyle=color;ctx.globalAlpha=0.12;ctx.beginPath();ctx.arc(sx,sy,r*2,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle=color;ctx.globalAlpha=0.9;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
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
    const segs=snake.segments; if(segs.length<2) return;
    const headColor=getSegColor(snake,0);
    const thickness=getThickness(snake);
    const dotR=DOT_RADIUS*thickness, headR=HEAD_RADIUS*thickness;
    const halfW=canvas.width/(2*zoom)+80,halfH=canvas.height/(2*zoom)+80;
    const midX=canvas.width/2,midY=canvas.height/2;
    ctx.shadowBlur=0;
    for(let i=segs.length-1;i>=1;i--){
      const seg=segs[i],sx=seg.x-cx+midX,sy=seg.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      const tailT=i/segs.length,r=dotR*(1-tailT*0.35);
      ctx.fillStyle=getSegColor(snake,i);ctx.globalAlpha=0.95;ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    const head=segs[0],hx=head.x-cx+canvas.width/2,hy=head.y-cy+canvas.height/2;
    const angle=Math.atan2(head.y-segs[1].y,head.x-segs[1].x);
    if(snake.id===myId){ctx.shadowColor=headColor;ctx.shadowBlur=snake.boosting?30:15;}
    ctx.fillStyle=headColor;ctx.beginPath();ctx.arc(hx,hy,headR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    const eyeOff=headR*0.5,eyeR=headR*0.28,perp=angle+Math.PI/2;
    for(const side of[-1,1]){
      const ex=hx+Math.cos(angle)*headR*0.3+Math.cos(perp)*eyeOff*side;
      const ey=hy+Math.sin(angle)*headR*0.3+Math.sin(perp)*eyeOff*side;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,eyeR,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(ex+Math.cos(angle)*eyeR*0.3,ey+Math.sin(angle)*eyeR*0.3,eyeR*0.55,0,Math.PI*2);ctx.fill();
    }
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
  }

  function drawParticles(cx,cy) {
    const halfW=canvas.width/(2*zoom)+40,halfH=canvas.height/(2*zoom)+40;
    const midX=canvas.width/2,midY=canvas.height/2;
    for(const p of particles){
      const sx=p.x-cx+midX,sy=p.y-cy+midY;
      if(sx<midX-halfW||sx>midX+halfW||sy<midY-halfH||sy>midY+halfH) continue;
      ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,p.size*p.life,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }

  function drawMinimap(cx,cy) {
    const w=minimapCanvas.width,h=minimapCanvas.height;
    minimapCtx.clearRect(0,0,w,h);
    minimapCtx.fillStyle='rgba(0,10,20,0.6)';minimapCtx.fillRect(0,0,w,h);
    minimapCtx.strokeStyle='rgba(0,255,255,0.3)';minimapCtx.lineWidth=1;minimapCtx.strokeRect(0,0,w,h);
    const scale=w/MAP_SIZE,ox=w/2,oy=h/2;
    const megaPulse=0.7+0.3*Math.sin(animTime*4);
    for(const m of megaOrbs){minimapCtx.fillStyle=COLORS[m.color];minimapCtx.globalAlpha=megaPulse;minimapCtx.beginPath();minimapCtx.arc(m.x*scale+ox,m.y*scale+oy,3,0,Math.PI*2);minimapCtx.fill();}
    minimapCtx.globalAlpha=1;
    for(const snake of snakes){
      if(!snake.alive||snake.segments.length===0) continue;
      const head=snake.segments[0];
      minimapCtx.fillStyle=snake.id===myId?'#fff':getSegColor(snake,0);
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

    if (running) {
      if (gameMode==='local' && localGame) {
        // Local mode: tick game, read state, feed input
        const angle = Math.atan2(mouseY-canvas.height/2, mouseX-canvas.width/2);
        localGame.setPlayerInput(angle, boosting);
        localGame.tick(dt);
        snakes = localGame.snakes.filter(s => s.alive);
        food = localGame.food;
        megaOrbs = localGame.megaOrbs;
        const me = localGame.snakes.find(s => s.id === myId);
        if (me && me.alive) {
          camera.x += (me.segments[0].x - camera.x) * 0.12;
          camera.y += (me.segments[0].y - camera.y) * 0.12;
          myScoreEl.textContent = `Score: ${me.score}`;
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
        sendTimer += dt;
        if (sendTimer >= 0.033) { sendDirection(); sendTimer = 0; }
      }
    }

    updateParticles(dt);

    let shakeX=0,shakeY=0;
    if(screenShake>0){shakeX=(Math.random()-0.5)*screenShake;shakeY=(Math.random()-0.5)*screenShake;screenShake*=0.9;if(screenShake<0.5)screenShake=0;}
    const cx=camera.x+shakeX, cy=camera.y+shakeY;
    const targetZoom=Math.max(0.35,BASE_ZOOM-Math.min(lastScore/300,0.37));
    zoom+=(targetZoom-zoom)*0.05;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,canvas.width,canvas.height);
    const grad=ctx.createRadialGradient(canvas.width/2,canvas.height/2,canvas.width*0.2,canvas.width/2,canvas.height/2,canvas.width*0.7);
    grad.addColorStop(0,'rgba(13,27,42,0)');grad.addColorStop(1,'rgba(0,0,0,0.4)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);

    ctx.save();
    ctx.translate(canvas.width/2,canvas.height/2);ctx.scale(zoom,zoom);ctx.translate(-canvas.width/2,-canvas.height/2);
    drawGrid(cx,cy); drawBorder(cx,cy); drawFood(cx,cy); drawMegaOrbs(cx,cy);
    const me=snakes.find(s=>s.id===myId);
    for(const snake of snakes){if(snake.alive&&snake.id!==myId)drawSnake(snake,cx,cy);}
    if(me&&me.alive) drawSnake(me,cx,cy);
    drawParticles(cx,cy);
    ctx.restore();

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
    }
    drawMinimap(cx,cy);
  }

  requestAnimationFrame(frame);
})();
