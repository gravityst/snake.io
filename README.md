# Snake.io

A slither.io-inspired multiplayer snake game with neon visuals, real-time WebSocket networking, and AI bots.

## Play Now

**https://snake-io-fzk5.onrender.com**

> First load may take ~30s if the server is waking up (free tier).

## Features

- **Real-time multiplayer** — WebSocket binary protocol, 30Hz server tick, 20Hz state broadcast
- **Authoritative server** — All physics, collisions, and AI run server-side
- **43 skins** — Solid, striped, and multicolor patterns (Rainbow, Cyberpunk, Galaxy, etc.)
- **9 food tiers** — Tiny dots to rare glowing orbs worth 35 points
- **12 moving mega orbs** — Drift across the map, worth 50-80 points each
- **Royal Gauntlet mode** — A shrinking safe zone adds pressure to every run
- **Progression unlocks** — Rare skins become available by beating high scores
- **3 AI skill tiers** — Beginner, Amateur, and Advanced bots with predictive hunting
- **Dynamic thickness** — Snakes get visibly fatter as they grow, not just longer
- **Camera zoom** — Zooms out as you grow so you can see more of the map
- **Neon visuals** — Glowing heads, pulsing food, particle effects, screen shake
- **HUD** — Live leaderboard, minimap, score display, player count
- **Touch controls** — Mobile-friendly with two-finger boost

## Controls

| Input | Action |
|---|---|
| Mouse / Touch | Steer your snake |
| Click / Space / Two-finger touch | Boost (costs score) |

## Run Locally

```bash
git clone https://github.com/gravityst/snake.io.git
cd snake.io
npm install
npm start
```

Open **http://localhost:3000** in your browser.

## Architecture

```
snake.io/
├── server/
│   ├── index.js        # Express + WebSocket server
│   └── game.js         # Authoritative game loop, physics, AI, collisions
├── public/
│   ├── index.html      # UI: start screen, skin picker, death screen, HUD
│   └── game.js         # Canvas renderer, WebSocket client, input handling
├── package.json
└── render.yaml         # Render.com deployment config
```

- **Server** (Node.js) runs a 30Hz game loop with authoritative state. Broadcasts viewport-filtered binary data to each client at 20Hz.
- **Client** (browser) is a thin renderer — sends mouse direction + boost input, receives and draws the world state. All skins, zoom, particles, and UI are client-side.
- **Protocol** is binary WebSocket (not JSON) for minimal bandwidth.
