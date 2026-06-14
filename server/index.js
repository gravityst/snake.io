const express = require('express');
const http = require('http');
const { RoomManager } = require('./game');
const { createManager: createClickBattle } = require('./clickbattle');

const app = express();
const server = http.createServer(app);
app.use(express.json());

// CORS — allow GitHub Pages and any origin to reach the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

const roomManager = new RoomManager(server);
const cb = createClickBattle();

// WebSocket upgrade routing — /cb path goes to Click Battle, everything else to snake.io
server.on('upgrade', (req, socket, head) => {
  const path = (req.url || '/').split('?')[0];
  const wss = (path === '/cb' || path.startsWith('/cb/')) ? cb.wss : roomManager.wss;
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

// Snake.io HTTP routes
app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

app.post('/api/rooms', (req, res) => {
  const { name, mode, teamSize, creatorName, royaleConfig, numTeams } = req.body;
  if (!name || name.length > 24) return res.status(400).json({ error: 'Invalid name' });
  if (roomManager.rooms.size > 50) return res.status(400).json({ error: 'Too many rooms' });
  const room = roomManager.createCustomRoom(
    name, mode || 'solo', teamSize || 2, creatorName || '', royaleConfig || null, numTeams || 2,
  );
  res.json({ id: room.id, name: room.name, code: room.code });
});

app.get('/api/rooms/code/:code', (req, res) => {
  for (const [id, room] of roomManager.rooms) {
    if (room.code === req.params.code.toUpperCase()) {
      return res.json({ id, name: room.name, mode: room.mode });
    }
  }
  res.status(404).json({ error: 'Room not found' });
});

// Click Battle HTTP routes
app.get('/api/cb/rooms', (req, res) => {
  res.json(cb.getRoomList());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake.io + Click Battle server running on port ${PORT}`);
  console.log(`  Snake rooms: ${roomManager.rooms.size}`);
});
