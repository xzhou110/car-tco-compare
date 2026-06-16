/*
 * Local listing proxy (FREE direct-scrape prototype). Run with portable node.
 *   node proxy/server.js [port]
 * Endpoint (CORS-open):
 *   GET /api/search?zip=60601&radius=25[&make=TOYOTA&model=RAV4]
 *     -> { source, fetchedAt, count, listings:[Listing] }
 * Scrape/normalize logic is shared with snapshot.js in ./scrape.js.
 * Violates the site's ToS; personal/experimental use only, low volume.
 */
const http = require('http');
const { searchAutotrader } = require('./scrape');

const PORT = parseInt(process.argv[2] || '8124', 10);

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/search') {
    const zip = u.searchParams.get('zip') || '60601';
    const radius = u.searchParams.get('radius') || '25';
    const make = u.searchParams.get('make') || '';
    const model = u.searchParams.get('model') || '';
    const r = await searchAutotrader(zip, radius, make, model);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ source: 'autotrader', fetchedAt: new Date().toISOString(), note: 'Full first-page results (free scrape).', count: (r.listings || []).length, ...r }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}).listen(PORT, () => console.log('listing proxy on http://localhost:' + PORT));
