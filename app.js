/* Noor — recite fluently, understand deeply.
   Quran text, translations, word meanings and audio timings are bundled in data/ (packaged once from
   the Quran.com API), so nothing sacred is typed by hand here except the Basmala heading.
   Recitation audio streams from Quran.com's audio servers. */
(function () {
  'use strict';
  const DATA = 'data/', DATA_V = '1';          // bump DATA_V whenever the files in data/ are regenerated
  const WBW_AUDIO = 'https://audio.qurancdn.com/';
  // Recitation: Mishari Rashid al-Afasy · Assamese: Shaykh Rafeequl Islam Habibur-Rahman · English: Saheeh International
  const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
  const STARTER = [1, 112, 113, 114, 108, 103, 110, 111, 109, 107, 106, 105];
  const SPEEDS = [0.5, 0.6, 0.75, 0.85, 1, 1.15, 1.25, 1.5, 1.75, 2];
  const REPEATS = [1, 2, 3, 5, 0]; // 0 = loop forever
  const CACHE = 'noor-data-' + DATA_V;

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;            // only used with this site's own static SVG
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => c != null && c !== false && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('noor.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('noor.' + k, JSON.stringify(v)); } catch { /* storage unavailable: fine */ } }
  };
  // Older versions cached Quran text in localStorage and could fill it up; free that space.
  try { Object.keys(localStorage).filter(k => k.startsWith('noor.c.')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }

  // Keep the bundled surah files in Cache Storage so they also open offline once visited (falls back to plain fetch).
  // Caches from older data versions are removed.
  try { caches.keys().then(ks => ks.filter(k => k.startsWith('noor-data-') && k !== CACHE).forEach(k => caches.delete(k))).catch(() => { }); } catch { /* no Cache Storage */ }
  const mem = {};
  async function getJSON(url, key, shape) {
    if (mem[key]) return mem[key];
    let res, cache = null;
    try { cache = await caches.open(CACHE); res = await cache.match(url); } catch { cache = null; }
    let data;
    for (let attempt = 0; ; attempt++) {
      try {
        if (!res) {
          res = await fetch(url);
          if (!res.ok) throw new Error('Request failed (' + res.status + ')');
          data = await res.clone().json();            // parse before caching, so a cut-off download is never stored
          if (cache) cache.put(url, res).catch(() => { });
        } else data = await res.json();
        break;
      } catch (e) {
        res = null;
        if (attempt >= 1) throw e;                    // one automatic retry for flaky mobile connections
        await new Promise(r => setTimeout(r, 800));
      }
    }
    if (shape) data = shape(data);
    return (mem[key] = data);
  }
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmtRate = (r) => (Number.isInteger(r) ? r : r.toFixed(2).replace(/0$/, '')) + '×';
  const fmtTime = (ms) => { const s = ms / 1000; return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
  const localDay = (d) => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2800); }

  /* ---------- state ---------- */
  const saved = store.get('settings', {});
  const S = {
    chapters: null, cur: null, token: 0,
    set: Object.assign({
      wbw: 'en', showEn: false, showMn: true, showTr: false, showPa: true, size: 34,
      theme: matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'night'
    }, saved),
    prog: store.get('prog', {}), known: store.get('known', {}), last: store.get('last', null),
    streak: store.get('streak', { day: '', n: 0 }),
    lang: store.get('lang', null) || (saved.sumLang === 'en' && store.get('learnLang', 'as') === 'en' ? 'en' : 'as')
  };
  const saveSet = () => store.set('settings', S.set);
  const progOf = (id) => (S.prog[id] = S.prog[id] || {});
  const saveProg = () => store.set('prog', S.prog);
  function touchDay() {
    const today = localDay(Date.now());
    if (S.streak.day === today) return;
    const y = localDay(Date.now() - 864e5);
    S.streak = { day: today, n: S.streak.day === y ? S.streak.n + 1 : 1 };
    store.set('streak', S.streak);
  }

  /* ---------- language ---------- */
  const I = window.NOOR_I18N;
  function t(key, arg) {
    const e = I[key]; if (!e) return key;
    const v = e[S.lang === 'as' ? 1 : 0];
    const out = typeof v === 'function' ? v(arg) : v;
    return S.lang === 'as' ? num(out) : out;
  }
  const AS_DIGITS = '০১২৩৪৫৬৭৮৯';
  // Assamese numerals in Assamese mode (০১২৩…), Western digits in English mode
  function num(x) { const str = String(x); return S.lang === 'as' ? str.replace(/[0-9]/g, d => AS_DIGITS[d]) : str; }
  const sname = (c) => (S.lang === 'as' && c.asName) || c.name;
  const smean = (c) => (S.lang === 'as' && c.asMean) || c.mean;
  const AS = () => S.lang === 'as';

  function applyTheme() {
    const root = document.documentElement;
    root.dataset.theme = S.set.theme;
    root.lang = AS() ? 'as' : 'en';
    root.style.setProperty('--ar-size', S.set.size + 'px');
    $('meta[name="theme-color"]')?.setAttribute('content', S.set.theme === 'night' ? '#0b1028' : '#f6f0e2');
    $('#themeBtn').setAttribute('aria-label', t('theme')); $('#themeBtn').title = t('theme');
    $('#themeBtn').dataset.mode = S.set.theme;
    $('#navLearn .nl').textContent = t('nav_learn'); $('#navSurahs .nl').textContent = t('nav_surahs');
    $$('#langSwitch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
    $('#langSwitch').setAttribute('aria-label', t('lang_label'));
    $('#timerStop').textContent = t('stop'); $('.skip').textContent = t('skip');
    $('#pPrev').setAttribute('aria-label', t('pl_prev')); $('#pPrev').title = t('pl_prev');
    $('#pNext').setAttribute('aria-label', t('pl_next')); $('#pNext').title = t('pl_next');
    $('#pPlay').setAttribute('aria-label', t('pl_play'));
    $('#spDown').setAttribute('aria-label', t('slower')); $('#spUp').setAttribute('aria-label', t('faster'));
    $('.speed').title = t('pl_speed');
    $('#pRepeat').title = t('repeat_tip'); $('#pEcho').title = t('echo_tip'); $('#pSolo').title = t('solo_tip');
    playerUI();
  }

  /* ---------- data ---------- */
  // data/chapters.json: [[id, name, arabic, meaning, verses, makkah(1/0), bismillah(1/0)], ...]
  const loadChapters = () => getJSON(`${DATA}chapters.json?v=${DATA_V}`, 'chapters', d => d.map(c => ({
    id: c[0], name: c[1], ar: c[2], mean: c[3], n: c[4], place: c[5] ? 'makkah' : 'madinah', bism: !!c[6],
    asName: (window.SURAH_NAMES_AS || [])[c[0] - 1]?.[0], asMean: (window.SURAH_NAMES_AS || [])[c[0] - 1]?.[1]
  })));
  // data/s/<id>.json: { v: [[n, assamese, english, [[uthmani, translit, meaning_en, meaning_bn], ...], endMark], ...],
  //                     a: [audioUrl, [[fromMs, toMs, [[wordPos, startMs, endMs], ...]], ...]] }
  const loadSurah = (id) => getJSON(`${DATA}s/${id}.json?v=${DATA_V}`, 's.' + id);
  const pad3 = (n) => String(n).padStart(3, '0');
  const shapeVerses = (id, raw, lang) => raw.v.map(([n, as, en, words, end]) => ({
    n, key: id + ':' + n, as, en,
    w: words.map(([t, tr, me, mb], k) => ({ p: k + 1, t, tr, m: lang === 'bn' ? (mb || me) : me, a: `wbw/${pad3(id)}_${pad3(n)}_${pad3(k + 1)}.mp3` }))
      .concat(end ? [{ end: true, t: end }] : [])
  }));

  /* ---------- player ---------- */
  const P = { a: new Audio(), vi: -1, playing: false, rate: 1, repeat: 1, left: 1, echo: false, solo: false, int: null, wait: null, waitEnd: 0, waitLen: 0, lastW: null };
  P.a.preload = 'none';
  const wordAudio = new Audio();

  const verseEl = (i) => $('#v-' + i);
  function clearWords(el) { if (el) $$('.w', el).forEach(w => w.classList.remove('on', 'done')); }
  function hiVerse(i, scroll = true) {
    $$('.verse.active').forEach(e => { e.classList.remove('active', 'turn'); clearWords(e); });
    $('.bism')?.classList.remove('on');
    P.lastW = null;
    const el = verseEl(i); if (!el) return;
    el.classList.add('active');
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const c = S.cur;
    $('#pTitle').textContent = t('pl_title', [sname(c.meta), i + 1, c.meta.n]);
    S.last = { id: c.meta.id, v: i }; store.set('last', S.last);
    if ('mediaSession' in navigator) try { navigator.mediaSession.metadata = new MediaMetadata({ title: `${c.meta.name} ${c.meta.id}:${i + 1}`, artist: 'Mishari Rashid al-Afasy', album: 'Noor' }); } catch { /* ignore */ }
  }
  function hiWord(i, pos) {
    if (P.lastW === i + ':' + pos) return;
    P.lastW = i + ':' + pos;
    const el = verseEl(i); if (!el) return;
    $$('.w', el).forEach(w => { const p = +w.dataset.p; w.classList.toggle('on', p === pos); w.classList.toggle('done', p < pos); });
  }
  function clearWait() { if (P.wait) { clearTimeout(P.wait); P.wait = null; } $('.pbar').classList.remove('turn'); $$('.verse.turn').forEach(e => e.classList.remove('turn')); }
  function playerUI() {
    const b = $('#pPlay'); b.classList.toggle('playing', P.playing); b.dataset.state = P.playing ? 'pause' : 'play';
    $('#spVal').textContent = num(fmtRate(P.rate));
    $('#pRepeat').textContent = t('repeat', P.repeat ? P.repeat + '×' : '∞'); $('#pRepeat').classList.toggle('on', P.repeat !== 1);
    $('#pEcho').textContent = t('echo'); $('#pSolo').textContent = t('solo');
    $('#pEcho').classList.toggle('on', P.echo); $('#pSolo').classList.toggle('on', P.solo);
    $('#pEcho').setAttribute('aria-pressed', String(P.echo)); $('#pSolo').setAttribute('aria-pressed', String(P.solo));
    if (!P.wait) $('#pSub').textContent = P.playing ? t(P.solo ? 'pl_solo' : 'pl_listen') : t('pl_idle');
    P.a.playbackRate = P.a.defaultPlaybackRate = P.rate; P.a.muted = P.solo;
    $$('.preset').forEach(p => p.classList.remove('on'));
  }
  function play(vi) {
    const c = S.cur;
    if (!c || !c.ts) return toast(t('a_loading'));
    clearWait(); wordAudio.pause();
    if (!P.a.src || P.a.dataset.id !== String(c.meta.id)) { P.a.src = c.audioUrl; P.a.dataset.id = c.meta.id; }
    if (vi != null || P.vi < 0) {
      P.vi = Math.max(0, Math.min(vi ?? 0, c.ts.length - 1)); P.left = P.repeat;
      P.a.currentTime = P.vi === 0 ? 0 : c.ts[P.vi].from / 1000;
      hiVerse(P.vi);
    }
    P.playing = true; playerUI();
    P.a.play().catch(() => { P.playing = false; playerUI(); toast(t('a_fail')); });
    clearInterval(P.int); P.int = setInterval(tick, 50);
    touchDay();
  }
  function pause() { clearWait(); P.a.pause(); P.playing = false; clearInterval(P.int); playerUI(); }
  function stopAll() { pause(); P.vi = -1; P.a.removeAttribute('src'); P.a.dataset.id = ''; }
  function tick() {
    const c = S.cur; if (!c || !P.playing) return;
    if (P.wait) { $('#pfill').style.width = Math.max(0, (P.waitEnd - Date.now()) / P.waitLen * 100) + '%'; return; }
    const v = c.ts[P.vi]; if (!v) return;
    const ms = P.a.currentTime * 1000;
    $('#pfill').style.width = Math.min(100, (ms - c.ts[0].from) / (c.ts[c.ts.length - 1].to - c.ts[0].from) * 100) + '%';
    if (ms >= v.to - 30) return verseEnd();
    if (P.vi === 0 && ms < v.from - 80) { $('.bism')?.classList.add('on'); return; }
    $('.bism')?.classList.remove('on');
    const s = v.seg.find(x => ms >= x[1] && ms < x[2]);
    if (s) hiWord(P.vi, s[0]);
  }
  function verseEnd() {
    const c = S.cur, v = c.ts[P.vi];
    const go = () => {
      clearWait();
      if (!P.playing) return;
      if (P.repeat === 0 || P.left > 1) {
        if (P.repeat) P.left--;
        P.a.currentTime = v.from / 1000; hiVerse(P.vi, false);
      } else if (P.vi + 1 < c.ts.length) {
        P.vi++; P.left = P.repeat;
        if (P.a.paused) P.a.currentTime = c.ts[P.vi].from / 1000;
        hiVerse(P.vi);
      } else return finish();
      if (P.a.paused) P.a.play().catch(() => pause());
      playerUI();
    };
    if (P.echo) {
      P.a.pause();
      P.waitLen = (v.to - v.from) / P.rate * 1.2 + 600; P.waitEnd = Date.now() + P.waitLen;
      $('.pbar').classList.add('turn'); verseEl(P.vi)?.classList.add('turn');
      $('#pSub').textContent = t('pl_turn');
      P.wait = setTimeout(go, P.waitLen);
    } else go();
  }
  function finish() {
    pause(); P.vi = -1;
    const p = progOf(S.cur.meta.id); p.listened = (p.listened || 0) + 1; saveProg();
    $('#pfill').style.width = '100%';
    toast(t('done_toast'));
  }
  P.a.addEventListener('ended', () => { if (P.playing && !P.wait) verseEnd(); });

  function bindPlayer() {
    $('#pPlay').onclick = () => (P.playing ? pause() : play());
    $('#pPrev').onclick = () => play(Math.max(0, (P.vi < 0 ? 0 : P.vi) - 1));
    $('#pNext').onclick = () => play((P.vi < 0 ? -1 : P.vi) + 1);
    const step = (d) => { const i = SPEEDS.indexOf(P.rate); P.rate = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + d))]; playerUI(); };
    $('#spDown').onclick = () => step(-1); $('#spUp').onclick = () => step(1);
    $('#pRepeat').onclick = () => { P.repeat = REPEATS[(REPEATS.indexOf(P.repeat) + 1) % REPEATS.length]; P.left = P.repeat; playerUI(); };
    $('#pEcho').onclick = () => { P.echo = !P.echo; if (!P.echo && P.wait) { clearWait(); pause(); } playerUI(); toast(t(P.echo ? 'echo_on' : 'echo_off')); };
    $('#pSolo').onclick = () => { P.solo = !P.solo; playerUI(); toast(t(P.solo ? 'solo_on' : 'solo_off')); };
    document.addEventListener('keydown', (e) => {
      if (!S.cur || !$('#modal').hidden || e.target.closest?.('input, textarea, select, button, a, [contenteditable]')) return;
      if (e.code === 'Space') { e.preventDefault(); P.playing ? pause() : play(); }
    });
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => $('#pPrev').click());
        navigator.mediaSession.setActionHandler('nexttrack', () => $('#pNext').click());
      } catch { /* not supported */ }
    }
  }

  /* ---------- word tip ---------- */
  function showTip(btn, w) {
    const tip = $('#tip');
    tip.replaceChildren(
      h('div', { class: 'ar', dir: 'rtl', lang: 'ar' }, w.t), h('div', { class: 'pa', lang: 'as' }, AsPron.word(w.t)), h('div', { class: 'tr', lang: 'en' }, w.tr), h('div', { class: 'mn' }, w.m),
      h('button', { class: 'btn sm gold', onclick: () => sayWord(w) }, '🔊 ' + t('hear_again')),
      h('small', {}, S.known[w.t] ? t('tip_known', S.known[w.t]) : t('tip_new'))
    );
    tip.hidden = false;
    const r = btn.getBoundingClientRect(), tw = tip.offsetWidth;
    const left = Math.max(8, Math.min(document.documentElement.clientWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    tip.style.left = left + window.scrollX + 'px';
    tip.style.top = r.bottom + window.scrollY + 8 + 'px';
    sayWord(w);
  }
  function sayWord(w) { if (!w.a) return; if (P.playing) pause(); wordAudio.src = WBW_AUDIO + w.a; wordAudio.play().catch(() => { }); }
  document.addEventListener('click', (e) => { if (!e.target.closest('.w') && !e.target.closest('#tip')) $('#tip').hidden = true; });

  /* ---------- modal ---------- */
  let lastFocus = null;
  function openModal(...kids) {
    const m = $('#modal');
    if (m.hidden) lastFocus = document.activeElement;
    m.replaceChildren(h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('button', { class: 'icon-btn x', 'aria-label': t('close'), onclick: closeModal }, '✕'), ...kids));
    m.hidden = false;
    const sheet = $('.sheet', m);
    (sheet.querySelector('.opt, .btn.gold') || sheet.querySelector('.x')).focus({ preventScroll: true });
    return sheet;
  }
  function closeModal() { const m = $('#modal'); if (m.hidden) return; m.hidden = true; m.replaceChildren(); lastFocus?.focus?.({ preventScroll: true }); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); $('#tip').hidden = true; } });
  function burst(sheet) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const b = h('div', { class: 'burst' });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
      const s = h('i'); s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      s.style.animationDelay = Math.random() * 0.25 + 's'; if (i % 3 === 0) s.style.background = 'var(--teal)';
      b.append(s);
    }
    sheet.append(b); setTimeout(() => b.remove(), 1800);
  }

  /* ---------- meaning quiz ---------- */
  function startQuiz() {
    const c = S.cur; if (!c || !c.verses.length) return;
    pause();
    const seen = new Set(), pool = [];
    c.verses.forEach(v => v.w.forEach(w => { if (!w.end && w.m && !seen.has(w.t)) { seen.add(w.t); pool.push(w); } }));
    const meanings = [...new Set(pool.map(w => w.m))];
    if (meanings.length < 4) return toast(t('q_few'));
    const qs = shuffle(pool).sort((a, b) => (S.known[a.t] || 0) - (S.known[b.t] || 0)).slice(0, Math.min(10, pool.length));
    let i = 0, score = 0;
    const next = () => {
      if (i >= qs.length) return done();
      const q = qs[i];
      const opts = shuffle([q.m, ...shuffle(meanings.filter(m => m !== q.m)).slice(0, 3)]);
      const nextBtn = h('button', { class: 'btn gold', hidden: true, onclick: () => { i++; next(); } }, i === qs.length - 1 ? t('q_result') : t('q_next'));
      const tr = h('div', { class: 'qtr' }, '');
      const box = h('div', { class: 'opts' }, opts.map(o => h('button', {
        class: 'opt', 'data-v': o, onclick: (e) => {
          $$('.opt', box).forEach(b => { b.disabled = true; if (b.dataset.v === q.m) b.classList.add('right'); });
          tr.textContent = AsPron.word(q.t) + ' · ' + q.tr;
          if (o === q.m) { score++; S.known[q.t] = (S.known[q.t] || 0) + 1; store.set('known', S.known); setTimeout(() => { i++; next(); }, 850); }
          else { e.currentTarget.classList.add('wrong'); nextBtn.hidden = false; nextBtn.focus(); }
        }
      }, o)));
      openModal(
        h('h2', {}, t('q_title')), h('div', { class: 'muted' }, t('q_of', [i + 1, qs.length, sname(c.meta)])),
        h('div', { class: 'qprog' }, h('i', { style: `width:${i / qs.length * 100}%` })),
        h('div', { class: 'qword', dir: 'rtl', lang: 'ar' }, q.t), tr, box,
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => sayWord(q) }, '🔊 ' + t('hear')), nextBtn)
      );
      sayWord(q);
    };
    const done = () => {
      const p = progOf(c.meta.id); p.quiz = Math.max(p.quiz || 0, Math.round(score / qs.length * 100)); saveProg(); touchDay();
      const sheet = openModal(
        h('h2', {}, t(score === qs.length ? 'q_perfect' : score >= qs.length * 0.7 ? 'q_good' : 'q_try')),
        h('div', { class: 'big' }, num(`${score}/${qs.length}`)),
        h('p', { class: 'muted center' }, t('q_known', Object.keys(S.known).length)),
        h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: startQuiz }, t('q_again')), h('button', { class: 'btn', onclick: closeModal }, t('q_back')))
      );
      if (score >= qs.length * 0.7) burst(sheet);
    };
    next();
  }

  /* ---------- timed recitation ---------- */
  const T = { t0: 0, int: null };
  function startTimer() {
    const c = S.cur; if (!c || !c.verses.length) return;
    pause();
    openModal(
      h('h2', {}, t('tm_title')),
      h('p', { class: 'muted' }, t('tm_desc', sname(c.meta))),
      h('div', { class: 'row' }, h('button', {
        class: 'btn gold', onclick: () => {
          closeModal(); window.scrollTo({ top: $('#verses').getBoundingClientRect().top + scrollY - 130, behavior: 'smooth' });
          T.t0 = performance.now(); $('#timerPill').hidden = false;
          T.int = setInterval(() => ($('#timerText').textContent = num(fmtTime(performance.now() - T.t0))), 100);
        }
      }, t('tm_start')))
    );
  }
  function stopTimer(record = true) {
    if (!T.int) return;
    clearInterval(T.int); T.int = null; $('#timerPill').hidden = true;
    if (!record) return;
    const c = S.cur, ms = performance.now() - T.t0;
    const words = c.verses.reduce((n, v) => n + v.w.filter(w => !w.end).length, 0);
    const wpm = Math.round(words / ms * 60000);
    const recWpm = c.ts ? Math.round(words / (c.ts[c.ts.length - 1].to - c.ts[0].from) * 60000) : 0;
    if (ms < 1500 || wpm > 400) return toast(t('tm_quick'));
    const p = progOf(c.meta.id); p.wpm = (p.wpm || []).concat({ d: Date.now(), wpm }).slice(-30); saveProg(); touchDay();
    const hist = p.wpm.map(x => x.wpm), first = hist[0], best = Math.max(...hist), max = Math.max(best, recWpm, wpm) || 1;
    const bar = (cls, label, val) => h('div', { class: 'bar ' + cls }, h('span', {}, label), h('div', {}, h('i', { 'data-w': val / max * 100 })), h('b', {}, num(val) + ' ' + t('wpm')));
    const msg = wpm >= recWpm && recWpm ? t('tm_at') : hist.length > 1 && wpm > first ? t('tm_faster', Math.round((wpm / first - 1) * 100)) : t('tm_startpt');
    const sheet = openModal(
      h('h2', {}, t('tm_pace')), h('div', { class: 'big' }, num(wpm)), h('div', { class: 'muted center' }, t('tm_wpm', [words, fmtTime(ms)])),
      h('div', { class: 'bars' }, bar('you', t('tm_this'), wpm), hist.length > 1 ? bar('', t('tm_first'), first) : null, recWpm ? bar('', t('tm_rec'), recWpm) : null),
      hist.length > 1 ? h('div', { html: spark(hist) }) : null,
      h('p', { class: 'muted' }, msg),
      h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: startTimer }, t('retry')), h('button', { class: 'btn', onclick: closeModal }, t('close')))
    );
    setTimeout(() => $$('.bar i', sheet).forEach(i => (i.style.width = i.dataset.w + '%')), 60);
    if (hist.length > 1 && wpm >= best) burst(sheet);
  }
  function spark(vals) {
    const w = 500, hh = 70, mx = Math.max(...vals), mn = Math.min(...vals), r = mx - mn || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 20) + 10, hh - 10 - ((v - mn) / r) * (hh - 20)]);
    return `<svg class="spark" viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" role="img" aria-label="${t('pace_chart')}"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--gold)"/>`).join('')}</svg>`;
  }
  $('#timerStop').onclick = () => stopTimer(true);

  /* ---------- views ---------- */
  const icon = {
    ear: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M8 24v-2a16 16 0 0 1 32 0v2"/><rect x="5" y="24" width="9" height="14" rx="4"/><rect x="34" y="24" width="9" height="14" rx="4"/></svg>',
    echo: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10 18v12M18 12v24M26 20v8M34 15v18M42 21v6"/></svg>',
    fast: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M8 34a16 16 0 1 1 32 0"/><path d="M24 34l9-13"/><circle cx="24" cy="34" r="2.5" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 14c-5-5-14-5-17 0v22c3-5 12-5 17 0 5-5 14-5 17 0V14c-3-5-12-5-17 0z"/><path d="M24 14v22"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
  };
  const placeName = (p) => t(p === 'makkah' ? 'makkah' : 'madinah');
  const isDone = (id) => { const p = S.prog[id]; return !!(p && (p.quiz >= 70 || p.listened)); };
  const footer = () => h('footer', { class: 'foot' },
    h('div', { class: 'foot-orn', 'aria-hidden': 'true' }, '۞'),
    h('p', {}, t('foot')), h('p', { class: 'muted small' }, t('foot_credit')));

  function viewHome() {
    document.title = t('title');
    const app = $('#app'); $('#player').hidden = true;
    const ch = S.chapters, last = S.last && ch.find(c => c.id === S.last.id);
    const practiced = Object.values(S.prog).filter(p => p.listened || p.quiz || (p.wpm || []).length).length;
    const best = Math.max(0, ...Object.values(S.prog).flatMap(p => (p.wpm || []).map(x => x.wpm)));
    const known = Object.keys(S.known).length;
    const hasProgress = practiced || known || S.streak.n;

    let filter = 'all', query = '';
    const card = (c) => h('a', { class: 'sura' + (isDone(c.id) ? ' done' : ''), href: '#/s/' + c.id, 'data-q': [c.name, c.mean, c.id, num(c.id), c.ar, c.asName, c.asMean].join(' ').toLowerCase(), 'data-place': c.place, 'data-n': c.n },
      h('span', { class: 'badge' }, num(c.id)),
      h('span', { class: 'mid' }, h('b', {}, sname(c)), h('span', { class: 'mean' }, smean(c)), h('span', { class: 'meta' }, t('verses', c.n) + ' · ' + placeName(c.place))),
      h('span', { class: 'arn', lang: 'ar' }, c.ar));
    const grid = h('div', { class: 'grid' }, ch.map(card));
    const empty = h('p', { class: 'muted center', hidden: true }, t('no_match'));
    const applyFilter = () => {
      let shown = 0;
      $$('.sura', grid).forEach(a => {
        const ok = a.dataset.q.includes(query) && (filter === 'all' || (filter === 'short' ? +a.dataset.n <= 20 : a.dataset.place === filter));
        a.hidden = !ok; if (ok) shown++;
      });
      empty.hidden = shown > 0;
    };
    const fchip = (key, label) => h('button', { class: 'chip' + (filter === key ? ' on' : ''), 'aria-pressed': String(filter === key), onclick: (e) => { filter = key; $$('.filters .chip').forEach(b => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-pressed', String(b === e.currentTarget)); }); applyFilter(); } }, label);

    app.replaceChildren(
      h('section', { class: 'hero' }, h('div', { class: 'hero-art', html: Scenes.hero() }), h('div', { class: 'hero-in' },
        h('div', { class: 'salam' }, t('salam')),
        h('h1', {}, t('hero_h1')),
        h('p', {}, t('hero_p')),
        h('div', { class: 'cta' },
          h('a', { class: 'btn gold lg', href: '#/s/' + (last ? last.id : 1) }, last ? t('cta_continue', sname(last)) : t('cta_start')),
          h('a', { class: 'btn glass', href: '#/learn' }, t('cta_learn')),
          h('button', { class: 'btn glass', onclick: () => $('#all').scrollIntoView({ behavior: 'smooth' }) }, t('cta_all'))))),
      h('div', { class: 'wrap' },
        hasProgress ? h('div', { class: 'stats' },
          [[S.streak.n || 0, t('st_streak')], [known, t('st_words')], [practiced, t('st_surahs')], [best || '—', t('st_pace')]]
            .map(([b, s], i) => h('div', { class: 'stat', style: `animation-delay:${i * 80}ms` }, h('b', {}, num(b)), h('span', {}, s)))) : null,
        h('section', { class: 'sec' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('how_title')), h('span', {}, t('how_sub'))),
          h('div', { class: 'method' }, [['ear', 'how1'], ['echo', 'how2'], ['fast', 'how3'], ['heart', 'how4']]
            .map(([ic, k], i) => h('div', { class: 'step' }, h('i', {}, i + 1), h('div', { class: 'step-ic', html: icon[ic] }), h('h3', {}, t(k + '_t')), h('p', {}, t(k + '_d')))))),
        h('a', { class: 'banner', href: '#/learn' },
          h('div', { class: 'bl', dir: 'rtl', lang: 'ar', 'aria-hidden': 'true' }, ['ا', 'ب', 'ت', 'ث', 'ج'].map((c, i) => h('span', { style: `animation-delay:${i * 0.25}s` }, c))),
          h('div', { class: 'bl-txt' }, h('h3', {}, t('banner_t')), h('p', {}, t('banner_d'))),
          h('span', { class: 'btn gold sm' }, t('open'))),
        h('section', { class: 'sec' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('starter_t')), h('span', {}, t('starter_sub'))),
          h('ol', { class: 'path' }, STARTER.map((id, i) => {
            const c = ch[id - 1];
            return h('li', {}, h('a', { class: 'node' + (isDone(id) ? ' done' : ''), href: '#/s/' + id },
              h('span', { class: 'n' }, t('step') + ' ' + num(i + 1)), h('span', { class: 'a', lang: 'ar' }, c.ar), h('span', { class: 'e' }, sname(c)), h('span', { class: 'm' }, t('verses', c.n))));
          }))),
        h('section', { class: 'sec', id: 'all' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('all_t')),
            h('label', { class: 'search' }, h('span', { html: icon.search, 'aria-hidden': 'true' }),
              h('input', { type: 'search', placeholder: t('search'), 'aria-label': t('search'), oninput: (e) => { query = e.target.value.trim().toLowerCase(); applyFilter(); } }))),
          h('div', { class: 'filters' }, fchip('all', t('f_all')), fchip('makkah', t('f_makkah')), fchip('madinah', t('f_madinah')), fchip('short', t('f_short'))),
          grid, empty),
        footer())
    );
  }

  function renderVerse(v, i) {
    return h('article', { class: 'verse', id: 'v-' + i, style: `animation-delay:${Math.min(i, 8) * 50}ms` },
      h('div', { class: 'vhead' },
        h('span', { class: 'vnum' }, num(v.n)), h('span', { class: 'vkey' }, num(v.key)),
        h('button', { class: 'vplay', title: t('play_from', v.n), 'aria-label': t('play_from', v.n), onclick: () => play(i) },
          h('span', { html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' }))),
      h('div', { class: 'words', dir: 'rtl', lang: 'ar' }, v.w.map(w => w.end
        ? h('span', { class: 'end', 'aria-label': t('end_of', v.n) }, w.t)
        : h('button', { class: 'w', 'data-p': w.p, onclick: (e) => showTip(e.currentTarget, w) },
          h('span', { class: 'ar' }, w.t), h('span', { class: 'pa', lang: 'as' }, AsPron.word(w.t)), h('span', { class: 'tr', lang: 'en' }, w.tr), h('span', { class: 'mn', lang: S.set.wbw }, w.m)))),
      h('p', { class: 'pr', lang: 'as' }, h('span', { class: 'lbl' }, t('lbl_pr')), AsPron.verse(v.w.filter(w => !w.end).map(w => w.t))),
      h('p', { class: 'as', lang: 'as' }, h('span', { class: 'lbl' }, t('lbl_as')), v.as),
      h('p', { class: 'en', lang: 'en' }, h('span', { class: 'lbl' }, t('lbl_en')), v.en));
  }

  async function viewSurah(id) {
    const meta = S.chapters[id - 1]; if (!meta) { location.hash = '#/'; return; }
    document.title = `${sname(meta)} (${meta.ar}) · ${S.lang === 'as' ? 'নূৰ' : 'Noor'}`;
    const token = ++S.token;
    stopAll(); stopTimer(false);
    S.cur = { meta, verses: [], ts: null, audioUrl: null };
    const app = $('#app');
    const sum = window.SURAH_SUMMARY[id], sumAs = (window.SURAH_SUMMARY_AS || {})[id];
    const useAs = AS() && sumAs && sumAs.length === sum.length;
    const resume = S.last && S.last.id === id && S.last.v > 0 ? S.last.v : 0;

    const storyEl = sum ? h('section', { class: 'story' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('sum_t')), sum.length > 2 ? h('span', {}, t('sum_parts', sum.length - 1)) : null),
      h('p', { class: 'lead', lang: useAs ? 'as' : 'en' }, useAs ? num(sumAs[0]) : sum[0]),
      h('div', { class: 'scards' }, sum.slice(1).map(([ic, enTitle, enText], i) => {
        const title = useAs ? sumAs[i + 1][0] : enTitle, text = useAs ? sumAs[i + 1][1] : enText;
        const m = text.match(/\((\d+)[^()]*\)[.।]?$/);
        return h('article', { class: 'scard', style: `animation-delay:${i * 90}ms` },
          h('div', { class: 'sart', html: Scenes.icon(ic) }),
          h('div', { class: 'sbody', lang: useAs ? 'as' : 'en' }, h('h3', {}, title), h('p', {}, useAs ? num(text) : text),
            m && +m[1] <= meta.n ? h('button', { class: 'link', onclick: () => { const el = verseEl(+m[1] - 1); el ? el.scrollIntoView({ block: 'start', behavior: 'smooth' }) : toast(t('v_loading')); } }, t('jump', m[1])) : null));
      }))) : null;

    const verses = h('div', { id: 'verses' }, h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }));
    const cls = () => { verses.className = (S.set.showMn ? '' : 'hide-mn ') + (S.set.showTr ? '' : 'hide-tr ') + (S.set.showPa ? '' : 'hide-pa ') + (S.set.showEn ? 'show-en' : ''); };
    cls();
    const tog = (key, label) => { const b = h('button', { class: 'tog' + (S.set[key] ? ' on' : ''), 'aria-pressed': String(!!S.set[key]), onclick: () => { S.set[key] = !S.set[key]; b.classList.toggle('on', S.set[key]); b.setAttribute('aria-pressed', String(S.set[key])); saveSet(); cls(); } }, label); return b; };
    const size = (d) => { S.set.size = Math.max(24, Math.min(56, S.set.size + d)); saveSet(); applyTheme(); };
    const preset = (n, k, cfg) => h('button', {
      class: 'preset', onclick: (e) => { Object.assign(P, cfg); P.left = P.repeat; play(P.vi < 0 ? resume : P.vi); e.currentTarget.classList.add('on'); }
    }, h('span', { class: 'pn' }, num(n)), h('span', { class: 'pt' }, h('b', {}, t(k + '_t')), h('span', {}, t(k + '_d'))));

    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: Scenes.forSurah(id) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' },
          h('div', { class: 'sub' }, `${t('surah_n', id)} · ${placeName(meta.place)} · ${t('verses', meta.n)}`),
          h('h1', {}, sname(meta)), h('div', { class: 'sub mean' }, smean(meta)),
          h('div', { class: 'row left shead-act' },
            h('button', { class: 'btn gold', onclick: () => play(resume) }, h('span', { html: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>' }), resume ? t('continue_v', resume + 1) : t('listen')),
            resume ? h('button', { class: 'btn glass', onclick: () => { const el = verseEl(resume); el ? el.scrollIntoView({ block: 'center', behavior: 'smooth' }) : toast(t('v_loading')); } }, '↓ ' + (resume + 1)) : null)),
        h('div', { class: 'arname', lang: 'ar' }, meta.ar))),
      h('div', { class: 'wrap' },
        storyEl,
        h('section', { class: 'coach' }, h('div', { class: 'sec-title' }, h('h2', {}, t('coach_t'))), h('p', { class: 'muted' }, t('coach_d')),
          h('div', { class: 'presets' },
            preset('1', 'p1', { rate: 0.75, echo: false, solo: false, repeat: 1 }),
            preset('2', 'p2', { rate: 1, echo: true, solo: false, repeat: 1 }),
            preset('3', 'p3', { rate: 1, echo: false, solo: false, repeat: 1 }),
            preset('4', 'p4', { rate: 1, echo: false, solo: true, repeat: 1 }),
            preset('5', 'p5', { rate: 1.25, echo: false, solo: true, repeat: 1 }))),
        h('div', { class: 'tools' },
          h('div', { class: 'tgroup' }, h('span', { class: 'tlabel' }, t('show')), tog('showPa', t('t_pa')), tog('showMn', t('t_mn')), tog('showTr', t('t_tr')), tog('showEn', t('t_en'))),
          h('div', { class: 'tgroup' },
            h('span', { class: 'tlabel', title: t('wbw_note') }, t('wbw_lang')),
            h('div', { class: 'seg' }, ['en', 'bn'].map(l => h('button', { 'aria-pressed': String(S.set.wbw === l), onclick: () => { if (S.set.wbw !== l) { S.set.wbw = l; saveSet(); viewSurah(id); } } }, l === 'en' ? (S.lang === 'as' ? 'ইংৰাজী' : 'English') : 'বাংলা'))),
            h('span', { class: 'tlabel' }, t('size')),
            h('div', { class: 'seg' }, h('button', { 'aria-label': t('smaller'), onclick: () => size(-3) }, S.lang === 'as' ? 'অ−' : 'A−'), h('button', { 'aria-label': t('larger'), onclick: () => size(3) }, S.lang === 'as' ? 'অ+' : 'A+'))),
          h('div', { class: 'tgroup tg-end' },
            h('button', { class: 'btn sm', onclick: startTimer }, '⏱ ' + t('time_me')), h('button', { class: 'btn sm gold', onclick: startQuiz }, '✦ ' + t('quiz')))),
        meta.bism ? h('div', { class: 'bism', dir: 'rtl', lang: 'ar' }, BISMILLAH, h('small', { dir: 'ltr', lang: 'as' }, t('bism_as'))) : null,
        verses,
        h('div', { class: 'endcard' }, h('h3', {}, t('end_t')), h('p', {}, t('end_d')),
          h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: startQuiz }, '✦ ' + t('end_quiz')), h('button', { class: 'btn', onclick: startTimer }, '⏱ ' + t('end_time'))),
          h('nav', { class: 'row pager' },
            id > 1 ? h('a', { class: 'chip', href: '#/s/' + (id - 1) }, '← ' + sname(S.chapters[id - 2])) : null,
            id < 114 ? h('a', { class: 'chip', href: '#/s/' + (id + 1) }, sname(S.chapters[id]) + ' →') : null)),
        footer())
    );
    $('#player').hidden = false; $('#pfill').style.width = '0'; $('#pTitle').textContent = sname(meta); playerUI();
    window.scrollTo(0, 0);

    try {
      const raw = await loadSurah(id);
      if (token !== S.token) return;
      S.cur.audioUrl = raw.a[0];
      S.cur.ts = raw.a[1].map(([from, to, seg]) => ({ from, to, seg }));
      const all = shapeVerses(id, raw, S.set.wbw);
      verses.replaceChildren();
      // render long surahs in chunks so the page stays responsive
      for (let i = 0; i < all.length; i += 30) {
        if (token !== S.token) return;
        const frag = document.createDocumentFragment();
        all.slice(i, i + 30).forEach(v => { S.cur.verses.push(v); frag.append(renderVerse(v, S.cur.verses.length - 1)); });
        verses.append(frag);
        if (i + 30 < all.length) await new Promise(r => setTimeout(r, 0));
      }
      if (token === S.token && resume) verseEl(resume)?.classList.add('active');
    } catch (e) {
      if (token === S.token) verses.replaceChildren(h('div', { class: 'err' }, t('load_err') + ' ', h('button', { class: 'btn sm', onclick: () => viewSurah(id) }, t('retry'))));
    }
  }

  /* ---------- router ---------- */
  function navActive() {
    const hsh = location.hash;
    $('#navLearn').classList.toggle('on', hsh.startsWith('#/learn'));
    $('#navSurahs').classList.toggle('on', !hsh.startsWith('#/learn'));
  }
  async function route() {
    closeModal(); $('#tip').hidden = true; navActive();
    const m = location.hash.match(/^#\/s\/(\d+)/);
    try {
      if (!S.chapters) S.chapters = await loadChapters();
    } catch {
      $('#app').replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'err' }, t('load_err') + ' ', h('button', { class: 'btn sm', onclick: route }, t('retry')))));
      return;
    }
    if (m) return viewSurah(Math.min(114, Math.max(1, +m[1])));
    stopAll(); stopTimer(false); S.cur = null; S.token++;
    if (location.hash.startsWith('#/learn')) { document.title = t('nav_learn') + ' · Noor'; $('#player').hidden = true; window.Learn.view($('#app')); window.scrollTo(0, 0); return; }
    viewHome();
    window.scrollTo(0, 0);
  }

  $('#themeBtn').onclick = () => { S.set.theme = S.set.theme === 'night' ? 'light' : 'night'; saveSet(); applyTheme(); };
  $$('#langSwitch button').forEach(b => b.onclick = () => {
    if (S.lang === b.dataset.lang) return;
    S.lang = b.dataset.lang; store.set('lang', S.lang); applyTheme();
    const keep = scrollY;
    route().then(() => window.scrollTo(0, keep));
  });
  window.Noor = { h, $, $$, sayWord, shuffle, openModal, closeModal, burst, store, touchDay, t, lang: () => S.lang, footer };
  applyTheme(); bindPlayer();
  window.addEventListener('hashchange', route);
  route();
})();
