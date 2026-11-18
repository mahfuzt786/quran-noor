/* Compares what the speech recogniser heard with the words of a verse.
   It works on letters without vowel marks, because speech recognisers return plain Arabic text.
   So it can tell a missing, wrong or extra word — but not a wrong vowel mark or tajweed rule. */
(function (root) {
  'use strict';
  const MARKS = /[ً-ٰٟۖ-ۭ࣓-ࣿـ]/g;
  // the disjoined letters that open some surahs, as their spoken names
  const NAMES = { 'ا': 'الف', 'ل': 'لام', 'م': 'ميم', 'ص': 'صاد', 'ر': 'را', 'ك': 'كاف', 'ه': 'ها', 'ي': 'يا', 'ع': 'عين', 'ط': 'طا', 'س': 'سين', 'ح': 'حا', 'ق': 'قاف', 'ن': 'نون' };
  const MUQ = new Set(['الم', 'المص', 'الر', 'المر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن']);

  // plain letters only: unify the alif and hamza shapes, ta marbuta, alif maqsura
  function norm(s) {
    return String(s || '').replace(MARKS, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/[^ء-ي]/g, '');
  }
  // Uthmani spelling often drops or adds a long alif (ٱلرَّحْمَـٰنِ / الرحمن, ٱلصَّلَوٰةَ / الصلاة), so ignore alifs
  const key = (s) => norm(s).replace(/ا/g, '');
  // looser key: also ignore ي/ى and the hamza seats, which Uthmani and standard spelling write differently
  // (شَيْـًٔا / شَيْئًا, أَتَىٰكَ / أَتَاكَ, جَزَٰٓؤُا۟ / جَزَاءُ)
  const loose = (s) => String(s || '').replace(MARKS, '').replace(/[ٱأإآاىيیئؤء]/g, '').replace(/ة/g, 'ه').replace(/[^ء-ي]/g, '');
  const K = (s) => [key(s), loose(s)];
  const cat = (a, b) => [a[0] + b[0], a[1] + b[1]];

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j), cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  // similarity of two keyed words: the strict key decides; the loose key can only lift an exact loose match to "ok"
  function simK(a, b) { const s = sim(a[0], b[0]); return s >= .75 ? s : Math.max(s, a[1] && a[1] === b[1] ? .8 : 0); }
  function sim(a, b) {
    if (!a && !b) return 1;
    let s = 1 - lev(a, b) / Math.max(a.length, b.length);
    // a recogniser often attaches or drops "و" (and) / "ف" (so) at the start of a word
    if (s < 1) for (const p of ['و', 'ف']) {
      if (a.startsWith(p) && a.slice(1) === b) s = Math.max(s, .9);
      if (b.startsWith(p) && b.slice(1) === a) s = Math.max(s, .9);
    }
    return s;
  }

  /** Expected tokens for a verse: [{wi, k}] — a disjoined-letters word becomes one token per letter name. */
  // asNames: true → the disjoined letters are spoken as names (الف لام ميم); false → written as one word (الم)
  function expected(words, asNames) {
    const out = [];
    words.forEach((w, wi) => {
      const n = norm(w);
      if (asNames && MUQ.has(n)) [...n].forEach(ch => out.push({ wi, k: K(NAMES[ch] || ch) }));
      else out.push({ wi, k: K(w) });
    });
    return out;
  }

  /**
   * compare(verseWords, heardText) →
   *   { words: [{status: 'ok'|'close'|'wrong'|'missed', heard: '...'}], extra: ['...'], correct, total, score }
   * Alignment is a small edit-distance over words that also allows one word to match two (the recogniser
   * may split or join words differently from the Mushaf).
   */
  function align(E, H, Hraw) {
    const n = E.length, m = H.length, INF = 1e9;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
    const bk = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
    dp[0][0] = 0;
    // a merge must be nearly exact to beat a plain miss or extra word
    const MISS = 1, EXTRA = .9, MERGE = .4;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const d = dp[i][j]; if (d >= INF) continue;
      const relax = (ii, jj, c, op) => { if (d + c < dp[ii][jj]) { dp[ii][jj] = d + c; bk[ii][jj] = [i, j, op]; } };
      if (i < n) relax(i + 1, j, MISS, 'miss');
      if (j < m) relax(i, j + 1, EXTRA, 'extra');
      if (i < n && j < m) relax(i + 1, j + 1, 1 - simK(E[i].k, H[j]), 'match');
      if (i + 1 < n && j < m) relax(i + 2, j + 1, MERGE + (1 - simK(cat(E[i].k, E[i + 1].k), H[j])) * 2, 'e2');
      if (i < n && j + 1 < m) relax(i + 1, j + 2, MERGE + (1 - simK(E[i].k, cat(H[j], H[j + 1]))) * 2, 'h2');
    }
    const tok = new Array(n).fill(null), extra = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      const [pi, pj, op] = bk[i][j];
      if (op === 'miss') tok[pi] = { s: 0, heard: '' };
      else if (op === 'extra') extra.unshift(Hraw[pj]);
      else if (op === 'match') tok[pi] = { s: simK(E[pi].k, H[pj]), heard: Hraw[pj] };
      else if (op === 'e2') { const s = simK(cat(E[pi].k, E[pi + 1].k), H[pj]); tok[pi] = tok[pi + 1] = { s, heard: Hraw[pj] }; }
      else if (op === 'h2') tok[pi] = { s: simK(E[pi].k, cat(H[pj], H[pj + 1])), heard: Hraw[pj] + ' ' + Hraw[pj + 1] };
      i = pi; j = pj;
    }
    return { cost: dp[n][m], tok, extra };
  }

  function compare(verseWords, heardText) {
    const Hraw = String(heardText || '').trim().split(/\s+/).filter(x => norm(x));
    const H = Hraw.map(K);
    // try the disjoined letters both as spoken names and as one written word, keep the better reading
    let E = expected(verseWords, true), best = align(E, H, Hraw);
    const E2 = expected(verseWords, false);
    if (verseWords.some(w => MUQ.has(norm(w)))) { const alt = align(E2, H, Hraw); if (alt.cost < best.cost) { E = E2; best = alt; } }
    const { tok, extra } = best;
    // one result per Mushaf word: the weakest of its tokens
    const words = verseWords.map(() => ({ status: 'ok', s: 1, heard: '' }));
    E.forEach((e, k) => {
      const tk = tok[k], w = words[e.wi];
      // in short words one wrong letter is a different word, so "nearly" needs a closer match there
      const closeBar = e.k[0].length <= 3 ? .67 : .5;
      const status = !tk || (!tk.heard && tk.s === 0) ? 'missed' : tk.s >= .75 ? 'ok' : tk.s >= closeBar ? 'close' : 'wrong';
      const rank = { ok: 0, close: 1, wrong: 2, missed: 3 };
      if (rank[status] > rank[w.status]) { w.status = status; w.s = tk ? tk.s : 0; }
      if (tk && tk.heard && !w.heard.split(' ').includes(tk.heard)) w.heard = (w.heard ? w.heard + ' ' : '') + tk.heard;
    });
    const correct = words.filter(w => w.status === 'ok').length;
    return { words, extra, correct, total: words.length, score: words.length ? correct / words.length : 0 };
  }

  const api = { compare, norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReciteCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
