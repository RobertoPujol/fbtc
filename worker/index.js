// FBTC Market Data Proxy — Cloudflare Worker
// Keeps Alpaca API keys server-side and caches responses in KV

const ALPACA_BASE = 'https://data.alpaca.markets/v2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const headers = { ...CORS, 'Content-Type': 'application/json' };

    try {
      if (url.pathname === '/bars') return await handleBars(url, env, headers);
      if (url.pathname === '/snapshot') return await handleSnapshot(env, headers);
      if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true }), { headers });
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  },
};

async function alpacaFetch(path, env) {
  const res = await fetch(`${ALPACA_BASE}${path}`, {
    headers: {
      'APCA-API-KEY-ID': env.ALPACA_KEY,
      'APCA-API-SECRET-KEY': env.ALPACA_SECRET,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Alpaca ${res.status}: ${body}`);
  }
  return res.json();
}

async function cachedFetch(cacheKey, ttl, env, fetcher) {
  if (env.FBTC_CACHE) {
    const cached = await env.FBTC_CACHE.get(cacheKey);
    if (cached) return cached;
  }
  const data = await fetcher();
  const json = JSON.stringify(data);
  if (env.FBTC_CACHE) {
    await env.FBTC_CACHE.put(cacheKey, json, { expirationTtl: ttl });
  }
  return json;
}

async function handleBars(url, env, headers) {
  const timeframe = url.searchParams.get('timeframe') || '1Day';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '300'), 1000);

  // Alpaca returns only today's bar if no start date is given.
  // Go back far enough to cover the requested limit for any timeframe.
  const start = new Date();
  if (timeframe === '1Day') {
    start.setFullYear(start.getFullYear() - 3); // 3 years covers ~750 trading days
  } else if (timeframe === '4Hour' || timeframe === '1Hour') {
    start.setDate(start.getDate() - 90); // 90 calendar days of intraday bars
  } else {
    start.setDate(start.getDate() - 30);
  }
  const startStr = start.toISOString().split('T')[0];

  const cacheKey = `FBTC_bars_v3_${timeframe}_${limit}`;
  const ttl = timeframe === '1Day' ? 300 : 60;

  const body = await cachedFetch(cacheKey, ttl, env, async () => {
    // Fetch descending so Alpaca returns the most recent bars first,
    // then reverse so callers always get oldest-first (required by chart libs).
    const data = await alpacaFetch(
      `/stocks/FBTC/bars?timeframe=${timeframe}&limit=${limit}&start=${startStr}&adjustment=split&feed=iex&sort=desc`,
      env
    );
    if (Array.isArray(data.bars)) data.bars.reverse();
    return data;
  });

  return new Response(body, { headers });
}

async function handleSnapshot(env, headers) {
  const body = await cachedFetch('FBTC_snapshot', 30, env, async () => {
    return alpacaFetch('/stocks/snapshots?symbols=FBTC&feed=iex', env);
  });
  return new Response(body, { headers });
}
