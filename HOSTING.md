# Host your own server with a PERMANENT URL

Free, no account, no credit card, permanent URL you can save.

## Why host locally?

- **Your ping**: 0-5ms (server is your computer)
- **Friends' ping**: based on distance to you
- **Cost**: $0
- **Permanent URL** — save it once, never change it again

## One-time setup (5 minutes)

### 1. Install Node.js

Download and install: https://nodejs.org/en/download (pick LTS)

Verify:
```bash
node --version
```

### 2. Clone the game

```bash
git clone https://github.com/gravityst/snake.io.git
cd snake.io
npm install
```

That's it. `npm install` also installs `localtunnel` which creates the public URL.

## Pick your permanent subdomain

Pick a name (letters and numbers only, no spaces). Your URL will be:

```
https://snakeio-<yourname>.loca.lt
```

Example: if you pick `curtis`, your URL is `https://snakeio-curtis.loca.lt`

**Save this URL somewhere** — you'll use it forever.

## Run the server (every time you want to play)

```bash
SUBDOMAIN=curtis npm run host
```

Replace `curtis` with whatever subdomain you chose.

You'll see two outputs:
```
Snake.io server running on port 3000
your url is: https://snakeio-curtis.loca.lt
```

**First-time URL visit**: Localtunnel shows a "tunnel password" screen the first time you or a friend visits the URL. Click "Click to Continue". Just a one-time anti-abuse check.

## Connect to your server

1. Open https://gravityst.github.io/snake.io/
2. Start a game (any mode)
3. Click the gear icon ⚙️ (top-left in-game)
4. Paste your URL in "Custom Server": `https://snakeio-curtis.loca.lt`
5. Click **Save**
6. Back to menu → MULTIPLAYER → you're on your own server

Once saved, it's stored in your browser. You don't need to re-enter it — just click MULTIPLAYER and it'll connect to your server.

## Share with friends

Send them your URL. They:
1. Open https://gravityst.github.io/snake.io/
2. Settings → paste your URL → Save
3. Click through the one-time localtunnel password page
4. Play on your server

## Windows?

Same commands, but set the env var differently:

**CMD**:
```cmd
set SUBDOMAIN=curtis && npm run host
```

**PowerShell**:
```powershell
$env:SUBDOMAIN="curtis"; npm run host
```

## When you're done

Press `Ctrl+C` to stop. Next time you want to play, run the same command — URL stays the same.

## Troubleshooting

**"Port 3000 in use"**  
Something else is using it. Kill it:
```bash
lsof -i :3000  # mac/linux
netstat -ano | findstr 3000  # windows
```

**"Subdomain taken"**  
Pick a more unique subdomain. Try `snakeio-yourname-123`.

**Friends can't connect**  
They need to click through the localtunnel "password" page once (says "Tunnel Password" — just click continue).

**School blocks it**  
Some school networks block these tunnels. Try at home first. If school blocks, you'd need a different approach (Fly.io with a card, paid Render, etc).

**URL stops working mid-game**  
Localtunnel's free tier sometimes drops. Just rerun `SUBDOMAIN=... npm run host` — same URL still works.

## Advanced: Cloudflare Tunnel (if you want to avoid the one-time password page)

If you own a domain, you can set up a Cloudflare Named Tunnel with zero password prompts:
1. Add your domain to Cloudflare (free)
2. Install `cloudflared`
3. `cloudflared tunnel login`
4. `cloudflared tunnel create snakeio`
5. Route a subdomain to it
6. `cloudflared tunnel run snakeio`

This is only worth it if you're hosting a lot. Otherwise, localtunnel is simpler.
