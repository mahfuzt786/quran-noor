/* Smart review: verses, letter sounds and letter shapes the user found hard come back on a spaced schedule —
   soon after a mistake, then further apart each time they are right. Stored under noor.srs as
   { id: { due: 'YYYY-MM-DD', iv: days, ease, reps, lapses, last, lastGrade, added } }.
   ids: 'v:<surah>:<verse>' (recite a verse), 'p:<letter>' (say a letter's name), 'w:<letter index>' (write a letter). */
(function () {
  'use strict';
  const N = () => window.Noor;
  const MAX_IV = 180, LEARNED = 21;
  const localDay = (ms) => { const x = new Date(ms); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const today = () => localDay(Date.now());
  const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return localDay(new Date(y, m - 1, dd + n, 12).getTime()); };
  const daysBetween = (a, b) => { const p = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); }; return Math.round((p(b) - p(a)) / 864e5); };

  const all = () => N().store.get('srs', {});
  const save = (m) => N().store.set('srs', m);
  const fresh = () => ({ due: today(), iv: 0, ease: 2.3, reps: 0, lapses: 0, added: today() });

  /** Put an item up for review today, if it is not scheduled already. */
  function add(id, inDays = 0) { const m = all(); if (!m[id]) { m[id] = fresh(); if (inDays) m[id].due = addDays(today(), inDays); save(m); } }
  function drop(id) { const m = all(); delete m[id]; save(m); }

  /**
   * Record a practice result. grade: 'again' (wrong), 'hard' (partly right), 'good' (right).
   * Something answered right that is not on the schedule stays off it; mistakes put it on.
   */
  function result(id, grade) {
    const m = all(); let it = m[id];
    if (!it) { if (grade === 'good') return null; it = m[id] = fresh(); }
    const d = today();
    // several correct tries on one day count once, so drilling does not jump the interval ahead
    if (it.last === d && grade === 'good' && it.lastGrade === 'good') return it;
    if (grade === 'again') { it.lapses++; it.ease = Math.max(1.3, it.ease - .2); it.iv = 1; }
    else if (grade === 'hard') { it.ease = Math.max(1.3, it.ease - .15); it.iv = Math.max(1, Math.round(it.iv * 1.2)); }
    else if (it.last === d && it.lastGrade === 'again') it.iv = 1;   // wrong earlier today: right now still means tomorrow
    else { it.iv = it.iv < 1 ? 1 : it.iv < 3 ? 3 : Math.round(it.iv * it.ease); it.ease = Math.min(2.8, it.ease + .05); }
    it.iv = Math.min(it.iv, MAX_IV); it.reps++; it.last = d; it.lastGrade = grade; it.due = addDays(d, it.iv);
    save(m);
    return it;
  }

  // 'm:' is a memorised verse: reviewed with the words hidden
  const kindOf = (id) => id[0] === 'v' || id[0] === 'm' ? 'v' : id[0] === 'p' ? 'p' : 'w';
  const order = { v: 0, p: 1, w: 2 };
  function dueList() {
    const m = all(), d = today();
    return Object.keys(m).filter(k => m[k].due <= d).sort((a, b) => m[a].due.localeCompare(m[b].due) || order[kindOf(a)] - order[kindOf(b)]);
  }
  function stats() {
    const m = all(), d = today(), ids = Object.keys(m);
    const inDays = (n) => ids.filter(k => m[k].due > d && daysBetween(d, m[k].due) <= n).length;
    return { total: ids.length, due: ids.filter(k => m[k].due <= d).length, tomorrow: inDays(1), week: inDays(7),
      learned: ids.filter(k => m[k].iv >= LEARNED).length, byKind: ['v', 'p', 'w'].map(x => ids.filter(k => kindOf(k) === x && m[k].due <= d).length) };
  }

  /** First run: put things the user already struggled with on the schedule. */
  function seed() {
    const { store } = N();
    if (store.get('srsInit', 0)) return;
    const m = all();
    const put = (id) => { if (!m[id]) m[id] = fresh(); };
    const rc = store.get('rc', {});
    Object.keys(rc).forEach(k => { if (rc[k] < 100) put('v:' + k); });
    store.get('bm', []).forEach(b => put('v:' + b.k));
    const pron = store.get('pron', {});
    Object.keys(pron).forEach(c => { if (!pron[c].last) put('p:' + c); });
    const wr = store.get('write', {}), bestPerLetter = {};
    Object.keys(wr).forEach(k => { const mm = /^l(\d+)\.\d$/.exec(k); if (mm) bestPerLetter[mm[1]] = Math.max(bestPerLetter[mm[1]] || 0, wr[k]); });
    Object.keys(bestPerLetter).forEach(i => { if (bestPerLetter[i] < 65) put('w:' + i); });
    save(m); store.set('srsInit', 1);
  }

  /* ---------- shared bits ---------- */
  const L = (en, as) => N().lang() === 'as' ? as : en;
  function whenText(it) {
    const { t } = N();
    const n = daysBetween(today(), it.due);
    return n <= 0 ? t('rv_due_now') : n === 1 ? t('rv_due_tomorrow') : t('rv_due_in', n);
  }

  /** Home page card, or null when nothing is scheduled. */
  function homeCard() {
    seed();
    const s = stats(); if (!s.total) return null;
    const { h, t, num } = N();
    return h('a', { class: 'rv-home' + (s.due ? '' : ' clear'), href: '#/review' },
      h('span', { class: 'rv-ic', 'aria-hidden': 'true' }, '🔁'),
      h('span', { class: 'rv-txt' }, h('b', {}, s.due ? t('rv_home_due', s.due) : t('rv_home_clear')),
        h('span', { class: 'muted' }, s.due ? t('rv_home_d') : t('rv_next', [s.tomorrow, s.week]))),
      h('span', { class: 'btn sm ' + (s.due ? 'gold' : '') }, s.due ? t('rv_start') : t('rv_open')));
  }

  /** Progress page section. */
  function section() {
    seed();
    const s = stats(); if (!s.total) return null;
    const { h, t, num } = N();
    const tile = (v, l) => h('div', { class: 'stat' }, h('b', {}, num(v)), h('span', {}, l));
    return h('section', { class: 'sec pg-sec rv-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, '🔁 ' + t('rv_title')), h('a', { class: 'link', href: '#/review' }, s.due ? t('rv_start') + ' →' : t('rv_open') + ' →')),
      h('p', { class: 'muted small' }, t('rv_how')),
      h('div', { class: 'stats pg-stats rv-stats' }, tile(s.due, t('rv_s_due')), tile(s.tomorrow, t('rv_s_tomorrow')), tile(s.week, t('rv_s_week')), tile(s.learned, t('rv_s_learned')), tile(s.total, t('rv_s_total'))));
  }

  /* ---------- the review page ---------- */
  let player = null;
  function playSegment(url, from, to) {
    if (!player) player = new Audio();
    N().pause();
    if (player.src !== url) player.src = url;
    const stopAt = to / 1000;
    const onTime = () => { if (player.currentTime >= stopAt) { player.pause(); player.removeEventListener('timeupdate', onTime); } };
    player.addEventListener('timeupdate', onTime);
    const go = () => { player.currentTime = from / 1000; player.play().catch(() => N().toast(N().t(navigator.onLine ? 'audio_err' : 'off_noaudio'))); };
    player.readyState >= 1 ? go() : player.addEventListener('loadedmetadata', go, { once: true });
  }
  const stopAudio = () => { try { player && player.pause(); } catch { /* ignore */ } };

  function selfGrade(onGrade) {
    const { h, t } = N();
    return h('div', { class: 'rv-self' }, h('span', { class: 'muted small' }, t('rv_self')),
      h('div', { class: 'row left' },
        h('button', { class: 'btn sm rv-g-again', onclick: () => onGrade('again') }, t('rv_g_again')),
        h('button', { class: 'btn sm rv-g-hard', onclick: () => onGrade('hard') }, t('rv_g_hard')),
        h('button', { class: 'btn sm rv-g-good', onclick: () => onGrade('good') }, t('rv_g_good'))));
  }

  async function verseCard(id, finish) {
    const { h, t, num, sayWord, store, chapters, sname, lang } = N();
    const [, s, v] = id.split(':').map(Number);
    const { raw, verses } = await N().surah(s);
    const vv = verses[v - 1]; if (!vv) throw new Error('missing');
    const words = vv.w.filter(w => !w.end);
    const AS = lang() === 'as';
    const memory = id[0] === 'm';
    const wordEls = words.map(w => {
      const el = h('button', { class: 'w' + (memory ? ' hz-w hz-hidden' : '') }, h('span', { class: 'ar' }, w.t), h('span', { class: 'hz-cover', 'aria-hidden': 'true' }), memory ? null : h('span', { class: 'pa', lang: AS ? 'as' : 'en' }, AS ? window.AsPron.word(w.t) : (w.tr || '')));
      if (memory) el.style.setProperty('--len', Math.max(2, [...w.t].filter(c => !/[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(c)).length));
      el.onclick = () => { if (el.classList.contains('hz-hidden')) { el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1600); } else sayWord(w); };
      return el;
    });
    const meaning = h('p', { class: 'rv-mn', lang: AS ? 'as' : 'en', hidden: true }, AS ? vv.as : vv.en);
    const out = h('div', { class: 'rv-out', 'aria-live': 'polite' });
    const seg = raw.a[1][v - 1];
    const best = store.get('rc', {})[vv.key];
    const graded = (g) => { window.Review.result(id, g); finish(g); };

    function check() {
      window.Recite.ensureReady(() => {
        wordEls.forEach(el => { el.classList.remove('rc-ok', 'rc-close', 'rc-wrong', 'rc-missed'); el.querySelector('.rc-pct')?.remove(); });
        if (memory) wordEls.forEach(el => el.classList.add('hz-hidden'));
        const live = h('span', { class: 'rc-live-sm', dir: 'rtl', lang: 'ar' });
        let ctl;
        out.replaceChildren(h('div', { class: 'lp-listen' }, h('span', { class: 'rc-dot', 'aria-hidden': 'true' }), h('b', {}, t('rc_listen')), live,
          h('button', { class: 'btn sm', onclick: () => ctl && ctl.stop() }, t('rc_done'))));
        ctl = window.Recite.listen({
          continuous: true, quietMs: 2600, limitMs: 15000 + words.length * 1800,
          onInterim: (tx) => { live.textContent = tx; },
          onDone: ({ text, error }) => {
            if (!text) { out.replaceChildren(h('p', { class: 'lp-bad' }, t(error === 'not-allowed' || error === 'service-not-allowed' ? 'rc_denied' : error === 'network' ? 'rc_net' : 'rc_none')), selfGrade(graded)); return; }
            const r = window.ReciteCore.compare(words.map(w => w.t), text);
            const pct = (x) => num(Math.round(x * 100)) + '%';
            r.words.forEach((res, k) => { wordEls[k].classList.remove('hz-hidden'); wordEls[k].classList.add('rc-' + res.status); wordEls[k].append(h('span', { class: 'rc-pct' }, pct(res.s))); });
            const bestAll = store.get('rc', {}); bestAll[vv.key] = Math.max(bestAll[vv.key] || 0, Math.round(r.score * 100)); store.set('rc', bestAll);
            N().log('rc', r.score * 100); N().touchDay();
            const g = r.score === 1 ? 'good' : r.score >= .7 ? 'hard' : 'again';
            const it = window.Review.result(id, g);
            meaning.hidden = false;
            out.replaceChildren(
              h('div', { class: 'rv-verdict g-' + g }, h('b', {}, pct(r.match)), h('span', {}, h('strong', {}, t('rv_v_' + g)), h('br'), t('rc_score', [r.correct, r.total]), it ? h('br') : null, it ? h('small', { class: 'muted' }, t('rv_next_on', whenText(it))) : null)),
              h('div', { class: 'row left' },
                h('button', { class: 'btn sm', onclick: check }, h('span', { html: window.Recite.icons.mic }), t('rc_again')),
                h('button', { class: 'btn sm gold', onclick: () => finish(g) }, t('rv_next_item'))));
            if (g === 'good') N().burst(out);
          }
        });
      });
    }

    return h('article', { class: 'rv-card' },
      h('div', { class: 'rv-head' },
        h('span', { class: 'chip rv-kind' }, memory ? '🧠 ' + t('rv_k_m') : '📖 ' + t('rv_k_v')),
        h('a', { class: 'rv-ref', href: `#/s/${s}/${v}` }, h('b', {}, sname(chapters()[s - 1])), ' ', h('span', { class: 'muted' }, num(vv.key))),
        best != null ? h('span', { class: 'muted small' }, t('bm_best', num(best) + '%')) : null),
      h('p', { class: 'muted small' }, t(memory ? 'rv_m_task' : 'rv_v_task')),
      h('div', { class: 'words rv-words', dir: 'rtl', lang: 'ar' }, wordEls),
      meaning,
      h('div', { class: 'row left' },
        window.Recite.supported() ? h('button', { class: 'btn gold', onclick: check }, h('span', { html: window.Recite.icons.mic }), t('rc_btn')) : null,
        seg ? h('button', { class: 'btn', onclick: () => playSegment(raw.a[0], seg[0], seg[1]) }, h('span', { html: window.Recite.icons.speaker }), t('rc_listen_v')) : null,
        h('button', { class: 'btn', onclick: () => { meaning.hidden = !meaning.hidden; } }, t('rv_meaning'))),
      out,
      window.Recite.supported() ? null : selfGrade((g) => { wordEls.forEach(el => el.classList.remove('hz-hidden')); graded(g); }));
  }

  function letterCard(id, finish) {
    const { h, t, num, sayWord, store, burst } = N();
    const LET = window.Learn.LET, D = window.LESSON_DATA;
    const kind = kindOf(id), AS = N().lang() === 'as';
    const idx = kind === 'p' ? LET.findIndex(X => X[0] === id.slice(2)) : +id.slice(2);
    const X = LET[idx]; if (!X) throw new Error('missing');
    const ex = D && D.ex[X[0]];
    const next = h('div', { class: 'row left rv-after', hidden: true }, h('button', { class: 'btn sm gold', onclick: () => finish(lastGrade) }, t('rv_next_item')));
    let lastGrade = 'good';
    const after = (g) => { lastGrade = g; const it = window.Review.all()[id]; next.hidden = false; next.querySelector('.rv-when')?.remove(); if (it) next.prepend(h('span', { class: 'muted small rv-when' }, t('rv_next_on', whenText(it)))); };
    const head = h('div', { class: 'rv-head' }, h('span', { class: 'chip rv-kind' }, kind === 'p' ? '🎤 ' + t('rv_k_p') : '✍ ' + t('rv_k_w')),
      h('b', { class: 'rv-letter', lang: 'ar' }, X[0]), h('span', {}, window.Learn.nameOf(X) + ' · ' + (AS ? X[2] : X[3])));
    if (kind === 'p') {
      const box = window.LetterCheck.box({ h, L, num, X, LET, sayWord, ex, AS, onResult: (ok) => { if (ok == null) return; after(ok ? 'good' : 'again'); } });
      return h('article', { class: 'rv-card' }, head, h('p', { class: 'muted small' }, t('rv_p_task')),
        h('div', { class: 'row left' },
          h('button', { class: 'btn sm gold', onclick: () => window.Learn.sayLetter(idx, 'name') }, '🔊 ' + window.Learn.nameOf(X)),
          ex ? h('button', { class: 'btn sm', onclick: () => sayWord(ex) }, '🔊 ' + t('rv_hear_ex'), ' ', h('span', { class: 'ar', lang: 'ar' }, ex.t)) : null),
        window.Recite.supported() ? box : selfGrade((g) => { window.Review.result(id, g); finish(g); }), next);
    }
    const pad = h('div', { class: 'rv-write' });
    window.NoorWrite.tab(pad, { h, L, num, LET, forms: window.Learn.forms, D, sayWord, store, burst, AS, fixedLetter: idx, onChecked: after });
    return h('article', { class: 'rv-card' }, head, h('p', { class: 'muted small' }, t('rv_w_task')), pad, next);
  }

  function view(app) {
    seed();
    const { h, t, num, footer } = N();
    const queue = dueList(), total = queue.length;
    let done = 0; const tally = { again: 0, hard: 0, good: 0 }, retried = new Set();
    const stage = h('div', { class: 'rv-stage' });
    const prog = h('div', { class: 'rv-prog' }, h('i'));
    const count = h('span', { class: 'muted' });
    const paintProg = () => { prog.firstChild.style.width = (total ? done / total * 100 : 100) + '%'; count.textContent = t('rv_count', [Math.min(done + 1, total), total]); };

    async function nextItem() {
      stopAudio(); window.Recite.stop();
      if (!queue.length) return finished();
      const id = queue.shift();
      paintProg();
      const finish = (g) => {
        tally[g]++;
        // a mistake comes back once more at the end of today's session
        if (g === 'again' && !retried.has(id)) { retried.add(id); queue.push(id); } else done++;
        nextItem();
      };
      let card;
      try { card = kindOf(id) === 'v' ? await verseCard(id, finish) : letterCard(id, finish); }
      catch {
        if (kindOf(id) === 'v' && navigator.onLine === false) card = h('article', { class: 'rv-card' }, h('p', {}, t('rv_offline_item')), h('div', { class: 'row left' }, h('button', { class: 'btn sm', onclick: () => { queue.push(id); nextItem(); } }, t('rv_skip'))));
        else { drop(id); done++; return nextItem(); }   // the item no longer exists
      }
      const skip = h('div', { class: 'row left rv-tools' },
        h('button', { class: 'btn sm', onclick: () => { queue.push(id); nextItem(); } }, t('rv_skip')),
        h('button', { class: 'btn sm', onclick: () => { drop(id); done++; N().toast(t('rv_removed')); nextItem(); } }, t('rv_remove')));
      stage.replaceChildren(card, skip);
      stage.classList.remove('fadein'); void stage.offsetWidth; stage.classList.add('fadein');
    }

    function finished() {
      const s = stats();
      prog.firstChild.style.width = '100%'; count.textContent = '';
      stage.replaceChildren(h('div', { class: 'endcard rv-done' },
        h('h3', {}, total ? t('rv_done_t') : t('rv_none_t')),
        total ? h('p', {}, t('rv_done_d', [tally.good, tally.hard, tally.again])) : h('p', {}, t('rv_none_d')),
        h('p', { class: 'muted' }, t('rv_next', [s.tomorrow, s.week])),
        h('div', { class: 'row' }, h('a', { class: 'btn gold', href: '#/' }, t('rv_home')), h('a', { class: 'btn', href: '#/progress' }, t('nav_progress')))));
      if (total && tally.good) N().burst(stage);
    }

    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(103) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('rv_sub')), h('h1', {}, t('rv_title'))))),
      h('div', { class: 'wrap' }, h('section', { class: 'sec rv-sec' }, h('div', { class: 'rv-top' }, count, prog), stage, h('p', { class: 'muted small rv-how' }, t('rv_how'))), footer()));
    nextItem();
  }

  window.Review = { add, drop, result, all, dueList, stats, seed, homeCard, section, view };
})();
