#!/usr/bin/env node
/* Builds the search-engine pages: one plain HTML page per surah (surah/<slug>/index.html), the surah index
   (surah/index.html) and sitemap.xml. The app itself uses #/ routes, which search engines do not index one
   by one; these pages give every surah its own address with its text, translations and summary, and send
   readers into the app to practise. Run after changing data/, summaries or names:  node tools/build-seo.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://smahfuzm.in/quran-noor/';
const TODAY = new Date().toISOString().slice(0, 10);

// the browser scripts set window.X; run them in a sandbox to read their data
function load(file, name) {
  const box = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), box);
  return box.window[name];
}
const SUM = load('summaries.js', 'SURAH_SUMMARY'), SUM_AS = load('summaries-as.js', 'SURAH_SUMMARY_AS');
const NAMES_AS = load('surah-names-as.js', 'SURAH_NAMES_AS');
const AsPron = require(path.join(ROOT, 'translit.js'));
const CH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/chapters.json'), 'utf8')).map(c => ({
  id: c[0], name: c[1], ar: c[2], mean: c[3], n: c[4], makkah: !!c[5], bism: !!c[6], asName: NAMES_AS[c[0] - 1][0], asMean: NAMES_AS[c[0] - 1][1]
}));
const FREE = new Set([1, 97, 103, 105, 106, 108, 110, 111, 112, 113, 114]);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AS_DIGITS = '০১২৩৪৫৬৭৮৯';
const asNum = (x) => String(x).replace(/[0-9]/g, d => AS_DIGITS[d]);
const slugOf = (c) => c.name.toLowerCase().replace(/['‘’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seen = new Set();
CH.forEach(c => { let s = slugOf(c); if (seen.has(s)) s += '-' + c.id; seen.add(s); c.slug = s; });
const pageUrl = (c) => `${SITE}surah/${c.slug}/`;
const BISM = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link href="https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Figtree:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600&display=swap" rel="stylesheet">';
const ICON = '<link rel="icon" href="' + SITE + 'icons/icon-192.png"><link rel="apple-touch-icon" href="' + SITE + 'icons/apple-touch-icon.png">';

function head({ title, desc, url, image, ld, extra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#0b1028">
<meta property="og:site_name" content="Noor">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="en_IN"><meta property="og:locale:alternate" content="as_IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${image}">
${ICON}
${FONTS}
<link rel="stylesheet" href="${SITE}surah/page.css?v=1">
${extra}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<header class="top"><a class="brand" href="${SITE}">✦ Noor <small lang="as">নূৰ</small></a>
<nav><a href="${SITE}surah/">All surahs</a><a href="${SITE}#/learn">Learn to read</a><a class="go" href="${SITE}">Open the app</a></nav></header>
`;
}

const FOOT = `<footer class="foot">
<p>Arabic text, Assamese translation (Shaykh Rafeequl Islam Habibur Rahman), English translation (Saheeh International) and word meanings from <a href="https://quran.com" rel="noopener">Quran.com</a>. Recitation: Mishary Rashid Alafasy. The surah summaries are short study notes written for this site, not a translation or tafsir. The Assamese pronunciation is generated automatically from the Arabic and is only a guide.</p>
<p><a href="${SITE}">Noor home</a> · <a href="${SITE}surah/">All surahs</a> · <a href="${SITE}privacy.html">Privacy policy</a> · <a href="${SITE}terms.html">Terms of use</a> · <a href="${SITE}refund.html">Refund policy</a> · <a href="mailto:mahfuzz786@gmail.com">Contact</a></p>
</footer>
</body>
</html>
`;

/* ---------- one page per surah ---------- */
function surahPage(c) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, `data/s/${c.id}.json`), 'utf8'));
  const place = c.makkah ? 'Makki (revealed in Makkah)' : 'Madani (revealed in Madinah)';
  const placeAs = c.makkah ? 'মক্কী' : 'মাদানী';
  const sum = SUM[c.id] || [], sumAs = SUM_AS[c.id] || [];
  const theme = sum[0] || '', themeAs = sumAs[0] || '';
  const title = `Surah ${c.name} (${c.ar}) — Assamese & English translation, pronunciation | Noor`;
  const desc = `Read Surah ${c.name} (${c.mean}), surah ${c.id} of the Quran, ${c.n} verses: Arabic text with Assamese pronunciation, Assamese and English translation. ছুৰা ${c.asName} অসমীয়া অনুবাদ আৰু উচ্চাৰণ।`;
  const url = pageUrl(c), prev = CH[c.id - 2], next = CH[c.id];
  const ld = [{
    '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url, inLanguage: ['en', 'as', 'ar'],
    isPartOf: { '@type': 'WebSite', name: 'Noor', url: SITE },
    about: { '@type': 'CreativeWork', name: `Surah ${c.name}`, alternateName: [c.ar, c.asName, c.mean], position: c.id, isPartOf: { '@type': 'Book', name: 'The Quran' } },
    image: `${SITE}og-image.png`, dateModified: TODAY
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Noor', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Surahs', item: `${SITE}surah/` },
      { '@type': 'ListItem', position: 3, name: `Surah ${c.name}`, item: url }]
  }];
  const parts = sum.slice(1).map((p, i) => {
    const a = sumAs[i + 1] || [];
    return `<li><b>${esc(p[1])}</b> ${esc(p[2])}${a[0] ? `<span lang="as"><b>${esc(a[0])}</b> ${esc(a[1])}</span>` : ''}</li>`;
  }).join('\n');
  const verses = raw.v.map(([n, as, en, words, end]) => {
    const ar = words.map(w => w[0]).join(' ');
    const tl = words.map(w => w[1]).join(' ');
    const pr = AsPron.verse(words.map(w => w[0]));
    return `<article class="v" id="v${n}">
<div class="vh"><a class="vn" href="#v${n}" aria-label="Verse ${n}">${c.id}:${n}</a><a class="vp" href="${SITE}#/s/${c.id}/${n}">Practise this verse →</a></div>
<p class="ar" lang="ar" dir="rtl">${esc(ar)} <span class="end">${esc(end || '')}</span></p>
<p class="pr" lang="as"><span class="l">উচ্চাৰণ</span>${esc(pr)}</p>
<p class="tl" lang="en"><span class="l">Transliteration</span>${esc(tl)}</p>
<p class="as" lang="as"><span class="l">অসমীয়া</span>${esc(as)}</p>
<p class="en" lang="en"><span class="l">English</span>${esc(en)}</p>
</article>`;
  }).join('\n');
  const practice = FREE.has(c.id)
    ? 'Listening, word-by-word meanings, Recite &amp; check, Memorisation and Smart review are all free for this surah.'
    : 'Reading, listening and word-by-word meanings are free. Recite &amp; check, Memorisation and Smart review for this surah are part of full access.';
  return head({ title, desc, url, image: `${SITE}og-image.png`, ld }) + `<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="${SITE}">Noor</a> › <a href="${SITE}surah/">Surahs</a> › <span>${esc(c.name)}</span></nav>
<section class="hero">
<p class="kick">Surah ${c.id} of 114 · ${c.n} verses · ${place}</p>
<h1>Surah ${esc(c.name)} <span lang="ar" dir="rtl">${esc(c.ar)}</span></h1>
<p class="mean">${esc(c.mean)} · <span lang="as">ছুৰা ${esc(c.asName)} — ${esc(c.asMean)} · ${asNum(c.n)}টা আয়াত · ${placeAs}</span></p>
${theme ? `<p class="lead">${esc(theme)}</p>` : ''}${themeAs ? `<p class="lead" lang="as">${esc(themeAs)}</p>` : ''}
<p class="cta"><a class="btn gold" href="${SITE}#/s/${c.id}">▶ Listen &amp; practise in Noor</a><a class="btn" href="${SITE}#/hifz/${c.id}">🧠 Memorise</a></p>
<p class="note">${practice}</p>
</section>
${parts ? `<section class="sum"><h2>What Surah ${esc(c.name)} is about <span lang="as">· ছুৰাটোৰ বিষয়বস্তু</span></h2><ul>${parts}</ul></section>` : ''}
<section class="verses"><h2>Surah ${esc(c.name)} with Assamese and English translation</h2>
${c.bism ? `<p class="bism" lang="ar" dir="rtl">${BISM}</p>` : ''}
${verses}
</section>
<section class="app">
<h2>Recite Surah ${esc(c.name)} with Noor</h2>
<p>Follow Mishary Alafasy word by word, tap any word for its meaning and sound, then recite on your own: Noor listens, marks each word and shows how closely you matched. <span lang="as">ক্বাৰীৰ সৈতে শব্দে শব্দে পঢ়ক, প্ৰতিটো শব্দৰ অৰ্থ শুনক, তাৰ পিছত নিজে তিলাৱত কৰক — Noor-এ শুনি প্ৰতিটো শব্দ পৰীক্ষা কৰে।</span></p>
<p class="cta"><a class="btn gold" href="${SITE}#/s/${c.id}">Open Surah ${esc(c.name)} in Noor</a></p>
</section>
<nav class="pager">${prev ? `<a href="${pageUrl(prev)}">← ${prev.id}. ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a href="${pageUrl(next)}">${next.id}. ${esc(next.name)} →</a>` : '<span></span>'}</nav>
</main>
` + FOOT;
}

/* ---------- the surah index ---------- */
function indexPage() {
  const url = `${SITE}surah/`;
  const title = 'All 114 surahs of the Quran with Assamese & English translation | Noor';
  const desc = 'Every surah of the Quran with Arabic text, Assamese pronunciation, Assamese translation and English translation. কোৰআনৰ ১১৪টা ছুৰা অসমীয়া অনুবাদ আৰু উচ্চাৰণৰ সৈতে।';
  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ['en', 'as', 'ar'],
    isPartOf: { '@type': 'WebSite', name: 'Noor', url: SITE },
    mainEntity: { '@type': 'ItemList', numberOfItems: 114, itemListElement: CH.map(c => ({ '@type': 'ListItem', position: c.id, name: `Surah ${c.name}`, url: pageUrl(c) })) }
  }];
  const rows = CH.map(c => `<li><a href="${pageUrl(c)}"><span class="no">${c.id}</span><span class="nm"><b>${esc(c.name)}</b><small>${esc(c.mean)} · ${c.n} verses</small><small lang="as">${esc(c.asName)} — ${esc(c.asMean)}</small></span><span class="arn" lang="ar" dir="rtl">${esc(c.ar)}</span></a></li>`).join('\n');
  return head({ title, desc, url, image: `${SITE}og-image.png`, ld }) + `<main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="${SITE}">Noor</a> › <span>Surahs</span></nav>
<section class="hero">
<h1>The 114 surahs of the Quran <span lang="as">· কোৰআনৰ ১১৪টা ছুৰা</span></h1>
<p class="lead">Each surah with its Arabic text, Assamese pronunciation, Assamese and English translation, and a short summary. Open any surah in the Noor app to listen word by word, recite and check your recitation, and memorise it.</p>
<p class="lead" lang="as">প্ৰতিটো ছুৰা আৰবী পাঠ, অসমীয়া উচ্চাৰণ, অসমীয়া আৰু ইংৰাজী অনুবাদ আৰু চমু সাৰাংশৰ সৈতে।</p>
<p class="cta"><a class="btn gold" href="${SITE}">Open the Noor app</a><a class="btn" href="${SITE}#/learn">New to Arabic? Learn to read</a></p>
</section>
<ol class="list">
${rows}
</ol>
</main>
` + FOOT;
}

/* ---------- write everything ---------- */
const out = (rel, text) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
// remove pages of slugs that no longer exist
const SURAH_DIR = path.join(ROOT, 'surah');
if (fs.existsSync(SURAH_DIR)) for (const d of fs.readdirSync(SURAH_DIR)) {
  const full = path.join(SURAH_DIR, d);
  if (fs.statSync(full).isDirectory() && !CH.some(c => c.slug === d)) fs.rmSync(full, { recursive: true });
}
CH.forEach(c => out(`surah/${c.slug}/index.html`, surahPage(c)));
out('surah/index.html', indexPage());

const urls = [
  [SITE, '1.0', 'weekly'], [`${SITE}surah/`, '0.9', 'monthly'],
  ...CH.map(c => [pageUrl(c), FREE.has(c.id) || c.id <= 2 ? '0.8' : '0.7', 'monthly']),
  [`${SITE}terms.html`, '0.3', 'yearly'], [`${SITE}privacy.html`, '0.3', 'yearly'], [`${SITE}refund.html`, '0.3', 'yearly']
];
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p, f]) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join('\n')}
</urlset>
`);
// slugs for the app, so it can link each surah to its page
out('data/slugs.json', JSON.stringify(CH.map(c => c.slug)));
console.log(`built ${CH.length} surah pages, the index and a sitemap with ${urls.length} addresses`);
