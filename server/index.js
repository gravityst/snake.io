const express = require('express');
const http = require('http');
const path = require('path');
const { RoomManager } = require('./game');

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const roomManager = new RoomManager(server);

// Room list
app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

// Create custom room
app.post('/api/rooms', (req, res) => {
  const { name, mode, teamSize, creatorName } = req.body;
  if (!name || name.length > 24) return res.status(400).json({ error: 'Invalid name' });
  if (roomManager.rooms.size > 50) return res.status(400).json({ error: 'Too many rooms' });
  const room = roomManager.createCustomRoom(
    name, mode || 'solo', teamSize || 2, creatorName || ''
  );
  res.json({ id: room.id, name: room.name });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake.io server running on http://localhost:${PORT}`);
  console.log(`  Rooms: ${roomManager.rooms.size}`);
});
