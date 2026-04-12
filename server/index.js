const express = require('express');
const http = require('http');
const path = require('path');
const { GameServer } = require('./game');

const app = express();
const server = http.createServer(app);

// Serve the client files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
const gameServer = new GameServer(server);

server.listen(PORT, () => {
  console.log(`Snake.io server running on http://localhost:${PORT}`);
  console.log(`  Map: ${gameServer.MAP_SIZE}x${gameServer.MAP_SIZE}`);
  console.log(`  Bots: ${gameServer.bots.length}`);
  console.log(`  Food: ${gameServer.food.length}`);
});
