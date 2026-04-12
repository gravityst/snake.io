const express = require('express');
const http = require('http');
const path = require('path');
const { RoomManager } = require('./game');

const app = express();
const server = http.createServer(app);

// Serve client files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Room list API
const roomManager = new RoomManager(server);

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Snake.io server running on http://localhost:${PORT}`);
  console.log(`  Rooms: ${roomManager.rooms.size}`);
});
