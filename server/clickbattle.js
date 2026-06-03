// Click Battle — minimal WebSocket relay co-hosted in the snake.io Render service.
// Reachable at /cb WebSocket path and /api/cb/rooms HTTP endpoint.
const WebSocket = require('ws');

const COLORS = ['#00a8ff', '#ff5577', '#ffd84d', '#5eff9a'];
const ROOM_TTL_MS = 10 * 60 * 1000;
const GAME_DURATION_MS = 12_500; // 2.5s countdown + 10s play
const FINISH_RESET_MS = 8_000;

function createManager() {
  const wss = new WebSocket.Server({ noServer: true });
  const rooms = new Map();
  let nextId = 1;

  const newCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 30; i++) {
      let c = ''; for (let j = 0; j < 4; j++) c += chars[Math.floor(Math.random() * chars.length)];
      if (!rooms.has(c)) return c;
    }
    return Date.now().toString(36).slice(-4).toUpperCase();
  };
  const send = (ws, type, data = {}) => { if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data })); };
  const broadcast = (room, type, data) => { for (const p of room.players.values()) send(p.ws, type, data); };
  const snap = room => ({
    code: room.code, name: room.name, hostId: room.hostId, state: room.state,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, slot: p.slot, score: p.score, y: p.y })),
  });

  wss.on('connection', ws => {
    const id = nextId++;
    let myRoom = null;

    ws.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.type === 'create' || m.type === 'join') {
        if (myRoom) return;
        const code = m.type === 'create' ? newCode() : String(m.code || '').toUpperCase().trim();
        let room = rooms.get(code);
        if (m.type === 'create') {
          const creator = String(m.name || 'Player').slice(0, 14) || 'Player';
          const roomName = (String(m.roomName || '').slice(0, 20) || `${creator}'s Room`);
          room = { code, name: roomName, players: new Map(), hostId: id, state: 'lobby', endTimer: null, resetTimer: null, lastActivity: Date.now() };
          rooms.set(code, room);
        }
        if (!room)                  return send(ws, 'error', { error: 'Room not found' });
        if (room.players.size >= 4) return send(ws, 'error', { error: 'Room full' });
        if (room.state !== 'lobby') return send(ws, 'error', { error: 'Game in progress — try again in a few seconds' });
        const usedSlots = new Set([...room.players.values()].map(p => p.slot));
        const slot = [0, 1, 2, 3].find(s => !usedSlots.has(s)) ?? 0;
        const player = { id, ws, name: String(m.name || 'Player').slice(0, 14) || 'Player', color: COLORS[slot], slot, score: 0, y: 0 };
        room.players.set(id, player);
        myRoom = room; room.lastActivity = Date.now();
        send(ws, 'joined', { selfId: id, room: snap(room) });
        broadcast(room, 'room', { room: snap(room) });
      } else if (m.type === 'start' && myRoom) {
        if (myRoom.hostId !== id || myRoom.state !== 'lobby') return;
        for (const p of myRoom.players.values()) { p.score = 0; p.y = 0; }
        myRoom.state = 'countdown';
        broadcast(myRoom, 'start', {});
        broadcast(myRoom, 'room', { room: snap(myRoom) });
        const room = myRoom;
        clearTimeout(room.endTimer);
        room.endTimer = setTimeout(() => {
          if (rooms.get(room.code) !== room) return;
          room.state = 'finished';
          broadcast(room, 'finished', { room: snap(room) });
          clearTimeout(room.resetTimer);
          room.resetTimer = setTimeout(() => {
            if (rooms.get(room.code) !== room) return;
            room.state = 'lobby';
            broadcast(room, 'room', { room: snap(room) });
          }, FINISH_RESET_MS);
        }, GAME_DURATION_MS);
      } else if (m.type === 'state' && myRoom) {
        const p = myRoom.players.get(id); if (!p) return;
        p.score = Math.max(0, Math.min(99999, m.score | 0));
        p.y = +m.y || 0;
        p.vy = +m.vy || 0;
        myRoom.lastActivity = Date.now();
      }
    });

    ws.on('close', () => {
      if (!myRoom) return;
      myRoom.players.delete(id);
      if (myRoom.players.size === 0) {
        clearTimeout(myRoom.endTimer); clearTimeout(myRoom.resetTimer);
        rooms.delete(myRoom.code);
      } else {
        if (myRoom.hostId === id) myRoom.hostId = [...myRoom.players.keys()][0];
        broadcast(myRoom, 'room', { room: snap(myRoom) });
      }
    });
  });

  // Relay tick @ 14Hz while a round is live
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.state === 'countdown' || room.state === 'playing') {
        room.state = 'playing';
        const players = [...room.players.values()].map(p => ({ id: p.id, score: p.score, y: p.y, vy: p.vy || 0 }));
        broadcast(room, 'tick', { players });
      }
    }
  }, 70);

  // Reap stale rooms
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (room.players.size === 0 || now - room.lastActivity > ROOM_TTL_MS) {
        clearTimeout(room.endTimer); clearTimeout(room.resetTimer);
        rooms.delete(code);
      }
    }
  }, 60_000);

  const getRoomList = () => [...rooms.values()].map(r => ({
    code: r.code,
    name: r.name,
    players: r.players.size,
    maxPlayers: 4,
    state: r.state,
    joinable: r.state === 'lobby' && r.players.size < 4,
  }));

  return { wss, getRoomList, rooms };
}

module.exports = { createManager };
