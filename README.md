# FBTC Dashboard

One-page trading dashboard for **Fidelity Wise Origin Bitcoin ETF (FBTC)** — live price, 7 technical indicators, composite buy/sell signal, browser alerts, auto-refresh every 3 minutes.

## What it shows

| Indicator | Parameters | Purpose |
|---|---|---|
| RSI | 14-period | Oversold <30 → buy zone; overbought >70 → sell zone |
| MACD | 12/26/9 | Crossovers + zero-line cross = trend shift |
| Bollinger Bands | 20-period, 2σ | Price at lower band = mean-reversion buy |
| EMA 9/21 | — | Short-term trend crossovers (Golden/Death cross) |
| EMA 50/200 | — | Medium/long-term regime (bull = above EMA 200) |
| OBV | — | Volume pressure: rising = accumulation |
| VWAP | Intraday | Institutional price anchor (4H/1H views) |

**Signal**: Composite score from all 7 indicators → STRONG BUY / BUY / NEUTRAL / SELL / STRONG SELL

---

## Architecture

```
Browser (Cloudflare Pages)
     ↕ fetch
Cloudflare Worker  ←→  Alpaca API
     ↕ cache
Cloudflare KV
```

Alpaca API keys **never** reach the browser — they live only as Worker secrets.

---

## Deployment (one-time setup, ~10 minutes)

### Prerequisites
- [Alpaca account](https://alpaca.markets) (free paper account gives full data access)
- Cloudflare account (free tier is enough)
- Node.js 18+ installed

### 1 — Get your Alpaca API keys

1. Log in to alpaca.markets → click **Paper Trading** (top-right menu)
2. Click **Your API Keys** → Generate New Key
3. Copy the **Key ID** and **Secret Key** — you'll need these shortly

### 2 — Deploy the Cloudflare Worker

```bash
cd fbtc/worker

# Install Wrangler CLI
npm install -g wrangler

# Log in to Cloudflare
wrangler login

# Create the KV cache namespace
wrangler kv:namespace create FBTC_CACHE
# → Copy the `id` printed and paste it into wrangler.toml
#   replacing: id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"

# Set your Alpaca keys as secrets (they never touch disk)
wrangler secret put ALPACA_KEY
# (paste your Key ID when prompted)

wrangler secret put ALPACA_SECRET
# (paste your Secret Key when prompted)

# Deploy
wrangler deploy
# → Note the URL printed, e.g.: https://fbtc-worker.YOUR_SUBDOMAIN.workers.dev
```

### 3 — Deploy the dashboard to Cloudflare Pages

**Option A — Drag & drop (easiest):**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → **Create a project**
2. Choose **Direct Upload**
3. Drag the `fbtc/public/` folder into the upload area
4. Click Deploy

**Option B — Connect GitHub:**
1. Push this repo to GitHub
2. Cloudflare Pages → New project → Connect to Git
3. Build command: *(leave blank)*  Output directory: `public`

### 4 — Open the dashboard

1. Navigate to your Pages URL (e.g. `https://fbtc-dashboard.pages.dev`)
2. On first load, a setup prompt asks for your **Worker URL**
3. Paste `https://fbtc-worker.YOUR_SUBDOMAIN.workers.dev`
4. Click **Save & Connect** — data loads immediately

The Worker URL is stored in your browser's localStorage, so you only enter it once.

---

## Usage

- **Timeframe buttons**: `1D` (default) / `4H` / `1H` — switches chart and all indicators
- **🔔 Alerts button**: Enables browser push notifications for signal changes, RSI zone entries, MACD crossovers, BB band touches
- **↻ button**: Force-refresh immediately (auto-refreshes every 3 minutes)
- **⚙ button**: Re-enter Worker URL if you redeploy the worker

## Signal interpretation

| Signal | Score | Meaning |
|---|---|---|
| STRONG BUY | ≥ +8 | Multiple indicators aligned bullish — high-confidence entry zone |
| BUY | +4 to +7 | Mostly bullish — watch for confirmation |
| NEUTRAL | -3 to +3 | Mixed signals — wait for clarity |
| SELL | -4 to -7 | Mostly bearish — consider exiting or waiting |
| STRONG SELL | ≤ -8 | Multiple indicators aligned bearish — avoid new positions |

**Important**: This is a technical analysis tool, not financial advice. Always use stops and size positions appropriately.
