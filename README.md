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

### Play Online

**https://gravityst.github.io/snake.io/**

### Run Locally

Just open `index.html` in your browser — no server needed.

### Controls

| Input | Action |
|---|---|
| Mouse / Touch | Steer your snake |
| Click / Space / Two-finger touch | Boost (costs length) |

## Architecture

```
snake.io/
├── index.html    # UI: start screen, death screen, HUD
├── game.js       # Game engine, renderer, AI bots, input
└── README.md
```

Fully client-side — game logic, AI bots, Canvas rendering, and input all run in the browser.
