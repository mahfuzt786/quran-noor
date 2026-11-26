/* Noor service worker: keeps the site working without internet.
   - The app shell (page, scripts, styles, icons) is stored at install, read from index.html so the list never goes stale.
   - Quran text (data/) and fonts are kept once fetched.
   - Word sounds are kept once played. Full-surah recitations are kept only when the user downloads them.
   Bump VERSION together with the ?v= numbers in index.html on every deploy. */
const VERSION = 'v42';
const SHELL = 'noor-shell-' + VERSION;
const DATA = 'noor-data-1';      // same name app.js uses for the surah files
const FONTS = 'noor-fonts-1';
const AUDIO = 'noor-audio-1';    // surah recitations the user chose to download
const WORDS = 'noor-words-1';    // word-by-word sounds
const KEEP = [SHELL, DATA, FONTS, AUDIO, WORDS];

async function cacheFonts(html) {
  const cssUrl = (html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/) || [])[1];
  if (!cssUrl) return;
  const c = await caches.open(FONTS);
  const res = await fetch(cssUrl.replace(/&amp;/g, '&'), { mode: 'cors' });
  if (!res.ok) return;
  const css = await res.clone().text();
  await c.put(cssUrl.replace(/&amp;/g, '&'), res);
  const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(files.map(u => c.match(u).then(hit => hit || fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r))).catch(() => { })));
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const res = await fetch('./index.html', { cache: 'no-cache' });
    const html = await res.clone().text();
    const assets = [...html.matchAll(/(?:src|href)="([^":#]+\.(?:js|css)\?v=\d+)"/g)].map(m => m[1]);
    const shell = await caches.open(SHELL);
    await shell.put('./index.html', res);
    await shell.addAll([...new Set(assets), './manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']);
    const data = await caches.open(DATA);
    if (!(await data.match('data/chapters.json?v=1'))) await data.add('data/chapters.json?v=1').catch(() => { });
    await cacheFonts(html).catch(() => { });       // nice to have: the page still works with system fonts
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('noor-') && !KEEP.includes(k) && !k.startsWith('noor-data-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the page asks a waiting new version to take over after the user agrees
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

/** Serves a cached response, honouring the byte ranges audio players ask for. */
async function ranged(req, res) {
  const range = req.headers.get('range');
  if (!range) return res;
  const blob = await res.blob(), size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = 0, end = size - 1;
  if (m) {
    if (m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], size - 1); }
    else if (m[2]) start = Math.max(0, size - +m[2]);
  }
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

async function cacheFirst(cacheName, req, opts = {}) {
  const c = await caches.open(cacheName);
  const hit = await c.match(opts.key || req, { ignoreVary: true });
  if (hit) return opts.range ? ranged(req, hit) : hit;
  const res = await fetch(opts.key || req, opts.cors ? { mode: 'cors' } : undefined);
  if (res.ok && res.status === 200) {
    await c.put(opts.key || req, res.clone()).catch(() => { });
    if (opts.range) return ranged(req, res);
  }
  return res;
}

let trimming = false;
async function trimWords() {          // keep played word sounds to a sensible number (about 60 MB)
  if (trimming) return; trimming = true;
  try { const c = await caches.open(WORDS), keys = await c.keys(); if (keys.length > 2000) await Promise.all(keys.slice(0, keys.length - 1600).map(k => c.delete(k))); }
  finally { trimming = false; }
}

async function page(req) {
  const shell = await caches.open(SHELL);
  try {
    // fresh page when online (so updates arrive), but do not leave a slow connection hanging
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
    if (res.ok) shell.put('./index.html', res.clone()).catch(() => { });
    return res;
  } catch {
    return (await shell.match('./index.html')) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) return e.respondWith(page(req));
  if (url.origin === location.origin) {
    if (url.pathname.includes('/data/')) return e.respondWith(cacheFirst(DATA, req));
    if (url.pathname.endsWith('/sw.js')) return;
    return e.respondWith(caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.status === 200 && url.search.includes('v=')) caches.open(SHELL).then(c => c.put(req, res.clone()));
      return res;
    })));
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return e.respondWith(cacheFirst(FONTS, req, { cors: true }));
  if (url.hostname === 'audio.qurancdn.com') {
    // word sounds of downloaded surahs live with the recitation; others are kept as they are played
    return e.respondWith(caches.open(AUDIO).then(c => c.match(url.href)).then(hit => hit ? ranged(req, hit)
      : cacheFirst(WORDS, req, { key: url.href, cors: true, range: true }).then(res => { trimWords(); return res; })));
  }
  if (url.hostname === 'download.quranicaudio.com') {
    // only surahs the user downloaded are served from storage; others stream as before
    return e.respondWith(caches.open(AUDIO).then(c => c.match(url.href)).then(hit => hit ? ranged(req, hit) : fetch(req)));
  }
});
