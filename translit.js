/* Arabic (Uthmani, fully vowelled) -> Assamese-script pronunciation guide.
   Rule based: it reads the letters and vowel marks of the Arabic text itself.
   It is a reading aid, not a replacement for the Arabic or for a teacher. */
(function (root) {
  'use strict';
  const FATHA = 'َ', DAMMA = 'ُ', KASRA = 'ِ', SUKUN = 'ْ', SUKUN2 = 'ۡ', SHADDA = 'ّ',
    DAGGER = 'ٰ', HAMZA_A = 'ٔ', HAMZA_B = 'ٕ', MADDAH = 'ٓ', WASLA = 'ٱ', TATWEEL = 'ـ';
  const TANWIN = { 'ً': 'an', 'ࣰ': 'an', 'ٌ': 'un', 'ࣱ': 'un', 'ٍ': 'in', 'ࣲ': 'in' };
  const isMark = (ch) => { const c = ch.charCodeAt(0); return (c >= 0x064B && c <= 0x065F) || c === 0x0670 || (c >= 0x06D6 && c <= 0x06ED) || (c >= 0x08D3 && c <= 0x08FF); };

  // Spellings follow common Assamese Islamic usage (ছ for س/ص/ث, ৰ for ر, ৱ for و, ক্ব for ق ...)
  const CONS = {
    'ب': 'ব', 'ت': 'ত', 'ث': 'ছ', 'ج': 'জ', 'ح': 'হ', 'خ': 'খ', 'د': 'দ', 'ذ': 'য', 'ر': 'ৰ', 'ز': 'য', 'س': 'ছ', 'ش': 'শ্ব',
    'ص': 'ছ', 'ض': 'দ্ব', 'ط': 'ত্ব', 'ظ': 'য', 'ع': 'A', 'غ': 'গ', 'ف': 'ফ', 'ق': 'ক্ব', 'ك': 'ক', 'ک': 'ক', 'ل': 'ল', 'م': 'ম',
    'ن': 'ন', 'ه': 'হ', 'ة': 'ত'
  };
  const DEP = { '': '', a: 'া', aa: 'া', i: 'ি', ii: 'ী', u: 'ু', uu: 'ূ', ay: 'াই', aw: 'াও', an: 'ান', in: 'িন', un: 'ুন' };
  const IND = { a: 'আ', aa: 'আ', i: 'ই', ii: 'ঈ', u: 'উ', uu: 'ঊ', ay: 'আই', aw: 'আও', an: 'আন', in: 'ইন', un: 'উন' };
  const NAMES = { 'ا': 'আলিফ', 'ل': 'লাম', 'م': 'মীম', 'ص': 'ছাদ', 'ر': 'ৰা', 'ك': 'কাফ', 'ه': 'হা', 'ي': 'ইয়া', 'ع': 'আঈন', 'ط': 'ত্বা', 'س': 'ছীন', 'ح': 'হা', 'ق': 'ক্বাফ', 'ن': 'নূন' };

  function units(word) {
    const u = [];
    for (const ch of word) {
      if (isMark(ch)) { if (u.length) u[u.length - 1].m.push(ch); }
      else if (/\s|‌|‍/.test(ch)) continue;
      else u.push({ b: ch, m: [] });
    }
    return u;
  }
  function vowelOf(u) {
    const m = u.m; let v = '';
    for (const x of m) { if (x === FATHA) v = 'a'; else if (x === KASRA) v = 'i'; else if (x === DAMMA) v = 'u'; else if (TANWIN[x]) v = TANWIN[x]; }
    if (v === 'a' && m.includes(DAGGER)) v = 'aa';
    if (v === 'u' && m.includes('ۥ')) v = 'uu';
    if (v === 'i' && (m.includes('ۦ') || m.includes('ۧ'))) v = 'ii';
    return v;
  }
  // The disjoined letters that open some surahs (Alif-Lam-Mim ...)
  function muqattaat(word) {
    const us = units(word);
    if (!us.length || us.length > 5) return null;
    // ignore Quranic pause signs (U+06D6–U+06DC) that can be attached to the last letter, e.g. الٓر ۚ
    const isPause = (x) => x >= 'ۖ' && x <= 'ۜ';
    for (const u of us) { if (!NAMES[u.b] || u.m.some(x => x !== MADDAH && !isPause(x))) return null; }
    return us.map(u => NAMES[u.b]).join('-');
  }

  function tokens(word) {
    const us = units(word), T = []; let wasla = false;
    const prev = () => T[T.length - 1];
    for (let i = 0; i < us.length; i++) {
      const u = us[i], b = u.b, m = u.m;
      const gem = m.includes(SHADDA), v = vowelOf(u), sukun = m.includes(SUKUN) || m.includes(SUKUN2);
      const silent = m.includes('۟') || m.includes('۠'), dagger = m.includes(DAGGER);
      const hamzaMark = m.includes(HAMZA_A) || m.includes(HAMZA_B);
      const p = prev();
      if (b === WASLA) { if (i === 0) wasla = true; continue; }
      if ('ءأإؤئ'.includes(b) || (hamzaMark && 'اوىيی'.includes(b)) || (hamzaMark && b === TATWEEL)) { T.push({ c: 'H', v }); continue; }
      // آ starts a word as hamza + ā; inside a word it is only a long ā (the text may be NFC-composed)
      if (b === 'آ') { if (p && (p.v === 'a' || p.v === 'aa')) p.v = 'aa'; else T.push({ c: 'H', v: 'aa' }); continue; }
      if (b === 'ا') {
        if (silent) continue;
        if (v) { T.push({ c: 'H', v }); continue; }
        if (p && p.v === 'a') p.v = 'aa';
        continue;
      }
      if (b === TATWEEL) { if (dagger && p && p.v === 'a') p.v = 'aa'; continue; }
      if (b === 'و') {
        if (silent) continue;
        if (v || gem) { T.push({ c: 'ৱ', v, gem }); continue; }
        if (dagger) { if (p && p.v === 'a') p.v = 'aa'; continue; }
        if (p && p.v === 'u') { p.v = 'uu'; continue; }
        if (p && p.v === 'a') { p.v = 'aw'; continue; }
        if (p && p.v === 'uu') continue;
        T.push({ c: 'ৱ', v: '' }); continue;
      }
      if (b === 'ي' || b === 'ى' || b === 'ی') {
        if (silent) continue;
        if (v || gem) { T.push({ c: 'Y', v, gem }); continue; }
        if (dagger) { if (p && p.v === 'a') p.v = 'aa'; continue; }
        if (p && p.v === 'i') { p.v = 'ii'; continue; }
        if (p && p.v === 'a') { p.v = sukun || b !== 'ى' ? 'ay' : 'aa'; continue; }
        if (p && (p.v === 'ii' || p.v === 'an' || p.v === 'aa')) continue;
        T.push({ c: 'Y', v: '' }); continue;
      }
      const c = CONS[b];
      if (!c) continue;
      // a bare consonant merged into the doubled letter that follows it (al- before sun letters, idgham)
      if (!v && !sukun && !gem && us[i + 1] && us[i + 1].m.includes(SHADDA)) continue;
      T.push({ c, v, gem, tm: b === 'ة' });
    }
    return { T, wasla, us };
  }
  // the vowel a connecting alif takes when a reciter starts on it
  function waslaVowel(us) {
    const a = us[1], b = us[2];
    if (a && a.b === 'ل' && (a.m.includes(SHADDA) || !vowelOf(a))) return 'a';
    if (a && b && ['سم', 'بن', 'ثن', 'مر'].includes(a.b + b.b)) return 'i';
    return b && vowelOf(b) === 'u' ? 'u' : 'i';
  }
  function render(T) {
    let o = '';
    T.forEach((t, i) => {
      const v = t.v || '';
      // a hamza carrying a vowel inside a word gets ’ so it is not read as a diphthong (ছামা’ই, not ছামাই)
      if (t.c === 'H') o += v ? ((i >= 2 || (i === 1 && (T[0].c === 'H' || T[0].c === 'A' || T[0].v === 'aa' || !'ৱফলবক'.includes(T[0].c)))) ? '’' : '') + IND[v] : '’';
      else if (t.c === 'A') o += v ? (i > 0 ? '‘' : '') + IND[v] : '‘';
      else if (t.c === 'Y') {
        if (t.gem) o += 'য়্য' + DEP[v];
        else if (i === 0 && v[0] === 'u') o += 'ইউ' + (v === 'un' ? 'ন' : '');
        else if (i === 0 && v[0] === 'a') o += 'ইয়' + DEP[v];
        else o += 'য়' + DEP[v];
      } else o += (t.gem ? t.c[0] + '্' + t.c : t.c) + DEP[v];
    });
    return o;
  }

  /** One word read on its own. */
  function word(text) {
    const mq = muqattaat(text); if (mq) return mq;
    const { T, wasla, us } = tokens(text);
    if (!T.length) return '';
    if (wasla) T.unshift({ c: 'H', v: waslaVowel(us) });
    else if (T[0].gem) T[0].gem = false;
    return render(T);
  }

  /** A whole verse read continuously, stopping at its end. */
  function verse(words) {
    const W = words.map(w => { const mq = muqattaat(w); return mq ? { mq } : tokens(w); }).filter(w => w.mq || w.T.length);
    W.forEach((w, i) => {
      if (w.mq) return;
      const T = w.T, pw = W[i - 1];
      if (w.wasla) {
        if (!pw || pw.mq) { T.unshift({ c: 'H', v: waslaVowel(w.us) }); return; }
        const pl = pw.T[pw.T.length - 1];
        if (pl.v === 'ii') pl.v = 'i'; else if (pl.v === 'uu') pl.v = 'u'; else if (pl.v === 'aa') pl.v = 'a';
        const t0 = T[0];
        if (t0.gem) { if (t0.c === 'ল') w.join = true; else { pw.T.push({ c: t0.c[0], v: '' }); t0.gem = false; } }
        else if (!t0.v && T.length > 1) { pw.T.push({ c: t0.c, v: '' }); T.shift(); }
      } else if (T[0].gem) T[0].gem = false;
    });
    // stopping at the end of the verse: drop the last short vowel
    const last = W[W.length - 1];
    if (last && !last.mq) {
      const t = last.T[last.T.length - 1];
      if (t.tm) { t.c = 'হ'; t.v = ''; }
      else if (t.v === 'an') t.v = 'aa';
      else if (['a', 'i', 'u', 'in', 'un'].includes(t.v)) t.v = '';
    }
    return W.map((w, i) => (i && !w.join ? ' ' : '') + (w.mq || render(w.T))).join('');
  }

  const api = { word, verse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AsPron = api;
})(typeof window !== 'undefined' ? window : globalThis);
