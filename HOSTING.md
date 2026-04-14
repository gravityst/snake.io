# Host your own server (Cloudflare Tunnel)

Free, no credit card required. Works from any computer — even school Chromebooks (if you can install things).

## Why host locally?

- **Your ping**: 0-5ms (server is literally your computer)
- **Friends' ping**: depends on distance to your location
- **Cost**: $0
- **Caveat**: only works when your computer is on

## One-time setup (5 minutes)

### 1. Install Node.js

Download and install: https://nodejs.org/en/download (pick the LTS version)

Verify in a terminal:
```bash
node --version
```

### 2. Install cloudflared

**Mac (Homebrew)**:
```bash
brew install cloudflared
```

**Windows**:
Download `cloudflared-windows-amd64.exe` from https://github.com/cloudflare/cloudflared/releases/latest
Rename it to `cloudflared.exe` and put it somewhere in your PATH (or just run it from the folder).

**Linux**:
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
```

### 3. Clone the game

```bash
git clone https://github.com/gravityst/snake.io.git
cd snake.io
npm install
```

## Running the server (every time you want to host)

Open two terminal windows in the `snake.io` folder:

**Terminal 1 — start the game server:**
```bash
npm start
```
You'll see: `Snake.io server running on port 3000`

**Terminal 2 — start the public tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

After ~5 seconds, cloudflared prints a URL like:
```
https://random-words-xyz-123.trycloudflare.com
```

**Copy that URL.**

## Connect to your own server

1. Open https://gravityst.github.io/snake.io/
2. Start a game (any mode)
3. Click the gear icon (bottom-left in-game)
4. Paste your tunnel URL in "Custom Server" field
5. Click **Save**
6. Go back to menu → click MULTIPLAYER → you're now on your own server

## Share with friends

Send them the tunnel URL. They do the same:
1. Open the game URL
2. Settings → paste your tunnel URL → Save
3. They connect to your server

Everyone on your server has ping based on distance to YOU, not Oregon.

## When you're done

Press `Ctrl+C` in both terminals to stop. The tunnel URL becomes invalid — you'll get a new one next time.

## Tips

- **School networks may block cloudflared** — test at home first
- **Firewall prompts**: allow Node.js when asked
- **The tunnel URL changes every time you restart cloudflared** — this is normal for the free tier
- **To get a permanent URL**: requires a Cloudflare account with a domain (still free, but more setup)

## Troubleshooting

**"cloudflared: command not found"**  
It's not in your PATH. Either add it, or run it from the folder where you downloaded it.

**"Error: listen EADDRINUSE :::3000"**  
Something else is using port 3000. Kill the old server first:
```bash
lsof -i :3000  # shows what's using it
```

**"Can't connect from the client"**  
Make sure the URL in settings starts with `https://` and has no trailing slash.

**Friends can connect but you can't**  
Your own computer might be trying to connect through the public URL and getting blocked. Try in an incognito window.
