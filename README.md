# Snake.io

A slither.io-inspired multiplayer snake game with neon visuals, smooth networking, and real-time gameplay.

## Features

- **Multiplayer** — Real-time WebSocket networking with binary protocol for low latency
- **Authoritative server** — Server-side game logic prevents cheating
- **Neon visuals** — Glowing snakes, pulsing food, particle effects, and screen shake
- **Smooth controls** — Mouse/touch steering with boost (click or spacebar)
- **HUD** — Live leaderboard, minimap, score display, and player count
- **Death mechanics** — Dead snakes drop collectible orbs for other players

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16 or later

### Install & Run

```bash
cd snake.io-work
npm install
npm start
```

Open your browser to **http://localhost:3000** and play.

### Controls

| Input | Action |
|---|---|
| Mouse / Touch | Steer your snake |
| Click / Space / Two-finger touch | Boost (costs length) |

## Architecture

```
snake.io-work/
├── server/
│   ├── index.js        # Express + WebSocket server setup
│   └── game.js         # Authoritative game loop, physics, collisions
├── public/
│   ├── index.html      # UI: start screen, death screen, HUD
│   └── game.js         # Canvas renderer, networking, input, particles
└── package.json
```

- **Server** runs a 30Hz game loop, handles collision detection, food spawning, and broadcasts viewport-filtered binary state to each client
- **Client** renders with Canvas 2D, interpolates state, and sends mouse direction + boost input
