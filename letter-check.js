/* Speaking checks for the Learn chapter.
   1. Say a letter's name: the recogniser's text is matched against the Arabic names of all 28 letters, so a
      wrong sound is reported as the letter it sounded like (for example ث said as "sa" is heard as س).
   2. Read the example word: checked with ReciteCore like a one-word verse. */
(function () {
  'use strict';
  // Arabic letter names (first one is spoken by the "hear it" button) and spellings a recogniser may return
  const NAMES = {
    'ا': ['أَلِف', 'الف', 'اليف'], 'ب': ['بَاء', 'با', 'باء', 'بي'], 'ت': ['تَاء', 'تا', 'تاء', 'تي'], 'ث': ['ثَاء', 'ثا', 'ثاء'],
    'ج': ['جِيم', 'جيم', 'جم'], 'ح': ['حَاء', 'حا', 'حاء'], 'خ': ['خَاء', 'خا', 'خاء'], 'د': ['دَال', 'دال'], 'ذ': ['ذَال', 'ذال'],
    'ر': ['رَاء', 'را', 'راء'], 'ز': ['زَاي', 'زاي', 'زين', 'زا'], 'س': ['سِين', 'سين'], 'ش': ['شِين', 'شين'], 'ص': ['صَاد', 'صاد', 'صا'],
    'ض': ['ضَاد', 'ضاد', 'ضا'], 'ط': ['طَاء', 'طا', 'طاء'], 'ظ': ['ظَاء', 'ظا', 'ظاء'], 'ع': ['عَيْن', 'عين'], 'غ': ['غَيْن', 'غين'],
    'ف': ['فَاء', 'فا', 'فاء'], 'ق': ['قَاف', 'قاف'], 'ك': ['كَاف', 'كاف'], 'ل': ['لَام', 'لام'], 'م': ['مِيم', 'ميم'], 'ن': ['نُون', 'نون'],
    'ه': ['هَاء', 'ها', 'هاء', 'هه'], 'و': ['وَاو', 'واو', 'وا'], 'ي': ['يَاء', 'يا', 'ياء']
  };
  const RC = () => window.ReciteCore;
  const clean = (s) => RC().norm(s).replace(/\s+/g, '');

  // every letter can also come back as its plain sound with a long a (سا, دا, زا …)
  Object.keys(NAMES).forEach(ch => { if (ch !== 'ا' && !NAMES[ch].includes(ch + 'ا')) NAMES[ch].push(ch + 'ا'); });

  /**
   * Which letter does the heard text sound like? Scores every letter name by spelling similarity, plus a bonus
   * when the heard text starts with that letter — the first sound is what tells ث / س or ذ / ز apart.
   * The target wins ties, and nothing is reported unless the match is reasonably close.
   */
  function identify(alts, target) {
    let best = null, targetBest = null;
    for (const alt of alts) {
      const n = clean(alt); if (!n) continue;
      const first = n[0] === 'ا' && n.length > 1 ? 'ا' : n[0];
      for (const [letter, vars] of Object.entries(NAMES)) {
        let s = n === letter ? 1 : Math.max(...vars.map(v => RC().sim(n, clean(v))));
        s += first === letter ? .3 : 0;
        const c = { letter, s, heard: alt };
        if (!best || s > best.s) best = c;
        if (letter === target && (!targetBest || s > targetBest.s)) targetBest = c;
      }
    }
    if (!best || best.s < .9) return { letter: null, s: best ? best.s : 0, heard: best ? best.heard : (alts[0] || '') };
    if (targetBest && targetBest.s >= best.s - .05) return targetBest;
    return best;
  }

  /**
   * Speaking-check box for one letter. ctx: { h, L, num, X (letter row), LET, sayWord, ex (example word) }.
   * Returns the element; results appear inside it.
   */
  function box(ctx) {
    const { h, L, X, LET, ex } = ctx;
    const res = h('div', { class: 'lpres', 'aria-live': 'polite' });
    const wrap = h('div', { class: 'lpron' },
      h('h4', {}, '🎤 ' + L('Pronunciation check', 'উচ্চাৰণ পৰীক্ষা')),
      h('p', { class: 'muted small' }, L('Say the name of the letter, or read the example word aloud.', 'আখৰটোৰ নাম কওক, বা উদাহৰণ শব্দটো উচ্চস্বৰে পঢ়ক।')),
      h('div', { class: 'row left' },
        h('button', { class: 'btn sm gold', onclick: () => checkName(ctx, res) }, h('span', { html: window.Recite.icons.mic }), L('Say its name', 'নামটো কওক')),
        ex ? h('button', { class: 'btn sm', onclick: () => checkWord(ctx, res) }, h('span', { html: window.Recite.icons.mic }), L('Read the word ', 'শব্দটো পঢ়ক '), h('span', { class: 'ar', lang: 'ar' }, ex.t)) : null),
      res);
    return wrap;
  }

  function listening(ctx, res, onStop) {
    const { h, L } = ctx;
    const live = h('span', { class: 'rc-live-sm', dir: 'rtl', lang: 'ar' });
    res.replaceChildren(h('div', { class: 'lp-listen' }, h('span', { class: 'rc-dot', 'aria-hidden': 'true' }), h('b', {}, L('Listening… speak now', 'শুনি আছে… এতিয়া কওক')), live,
      h('button', { class: 'btn sm', onclick: onStop }, L('Done', 'শেষ'))));
    return live;
  }
  function failMsg(ctx, error) {
    const t = window.Noor.t;
    return error === 'not-allowed' || error === 'service-not-allowed' ? t('rc_denied') : error === 'audio-capture' ? t('rc_nomic') : error === 'network' ? t('rc_net') : t('rc_none');
  }
  const nameOf = (LET, ch) => LET.find(r => r[0] === ch);

  function checkName(ctx, res, onResult) {
    const { h, L } = ctx;
    window.Recite.ensureReady(() => {
      let ctl; const live = listening(ctx, res, () => ctl && ctl.stop());
      ctl = window.Recite.listen({
        quietMs: 1200, limitMs: 6000,
        onInterim: (tx) => { live.textContent = tx; },
        onDone: ({ text, alts, error }) => {
          if (!text && !alts.length) { res.replaceChildren(h('p', { class: 'lp-bad' }, failMsg(ctx, error))); onResult && onResult(null); return; }
          const id = identify(alts.length ? alts : [text], ctx.X[0]);
          const ok = id.letter === ctx.X[0];
          // per-letter result for the progress page: ever said correctly, and the latest attempt
          const pron = window.Noor.store.get('pron', {}), p = pron[ctx.X[0]] || { ok: 0, n: 0 };
          p.n++; if (ok) p.ok = 1; p.last = ok ? 1 : 0; if (!ok && id.letter) p.as = id.letter;
          pron[ctx.X[0]] = p; window.Noor.store.set('pron', pron);
          window.Noor.log('lp', ok ? 100 : 0); window.Noor.touchDay();
          showName(ctx, res, id, ok);
          onResult && onResult(ok, id);
        }
      });
    });
  }

  function showName(ctx, res, id, ok) {
    const { h, L, X, LET } = ctx;
    const target = X, other = id.letter && !ok ? nameOf(LET, id.letter) : null;
    const hear = h('button', { class: 'btn sm', onclick: () => { if (!window.Recite.speak(NAMES[target[0]][0]) && ctx.ex) ctx.sayWord(ctx.ex); } }, '🔊 ' + L('Hear the correct name', 'শুদ্ধ নামটো শুনক'));
    const again = h('button', { class: 'btn sm gold', onclick: () => checkName(ctx, res) }, h('span', { html: window.Recite.icons.mic }), L('Try again', 'আকৌ কওক'));
    const heard = id.heard ? h('span', { class: 'muted small' }, L('Heard: ', 'শুনা গ’ল: '), h('span', { class: 'ar', lang: 'ar', dir: 'rtl' }, id.heard)) : null;
    if (ok) {
      res.replaceChildren(h('div', { class: 'lp-ok' }, h('b', {}, '✓ ' + L('Correct!', 'শুদ্ধ!')), ' ', L('You said the name of ', 'আপুনি শুদ্ধকৈ কৈছে: '), h('span', { class: 'ar', lang: 'ar' }, target[0]), ' (' + target[1] + ')'), heard ? h('p', {}, heard) : null, h('div', { class: 'row left' }, hear));
    } else if (other) {
      res.replaceChildren(
        h('div', { class: 'lp-bad' }, h('b', {}, '✗ '), L('It sounded like ', 'আপোনাৰ উচ্চাৰণ এইটোৰ দৰে শুনা গ’ল: '), h('span', { class: 'ar', lang: 'ar' }, other[0]), ' (' + other[1] + ')',
          L(' — the letter shown is ', ' — দেখুওৱা আখৰটো হ’ল '), h('span', { class: 'ar', lang: 'ar' }, target[0]), ' (' + target[1] + ')।'),
        h('p', { class: 'lp-tip' }, h('b', {}, L('How to say it: ', 'কেনেকৈ ক’ব: ')), ctx.AS ? target[6] : target[4]),
        heard ? h('p', {}, heard) : null,
        h('div', { class: 'row left' }, hear, again));
    } else {
      res.replaceChildren(h('div', { class: 'lp-bad' }, L('Could not make out a letter name. ', 'কোনো আখৰৰ নাম বুজিব পৰা নগ’ল। '), heard), h('div', { class: 'row left' }, hear, again));
    }
  }

  function checkWord(ctx, res) {
    const { h, L, ex, sayWord } = ctx;
    window.Recite.ensureReady(() => {
      let ctl; const live = listening(ctx, res, () => ctl && ctl.stop());
      ctl = window.Recite.listen({
        quietMs: 1400, limitMs: 7000,
        onInterim: (tx) => { live.textContent = tx; },
        onDone: ({ text, alts, error }) => {
          if (!text && !alts.length) { res.replaceChildren(h('p', { class: 'lp-bad' }, failMsg(ctx, error))); return; }
          // best of the recogniser's guesses
          let best = null;
          for (const a of (alts.length ? alts : [text])) { const r = RC().compare([ex.t], a); const w = r.words[0]; if (!best || w.s > best.s || (w.status === 'ok' && best.status !== 'ok')) best = { ...w, heard: w.heard || a }; }
          const hear = h('button', { class: 'btn sm', onclick: () => sayWord(ex) }, '🔊 ' + L('Hear the word', 'শব্দটো শুনক'));
          const again = h('button', { class: 'btn sm gold', onclick: () => checkWord(ctx, res) }, h('span', { html: window.Recite.icons.mic }), L('Try again', 'আকৌ পঢ়ক'));
          const heard = h('span', { class: 'muted small' }, L('Heard: ', 'শুনা গ’ল: '), h('span', { class: 'ar', lang: 'ar', dir: 'rtl' }, best.heard || text));
          const word = [h('span', { class: 'ar', lang: 'ar' }, ex.t), ' (' + window.AsPron.word(ex.t) + ')'];
          window.Noor.log('lw', best.status === 'ok' ? 100 : best.status === 'close' ? 60 : 0); window.Noor.touchDay();
          if (best.status === 'ok') res.replaceChildren(h('div', { class: 'lp-ok' }, h('b', {}, '✓ ' + L('Correct!', 'শুদ্ধ!')), ' ', ...word), h('p', {}, heard), h('div', { class: 'row left' }, hear));
          else res.replaceChildren(h('div', { class: best.status === 'close' ? 'lp-close' : 'lp-bad' }, h('b', {}, best.status === 'close' ? L('Nearly — ', 'প্ৰায় শুদ্ধ — ') : '✗ '), L('the word is ', 'শুদ্ধ শব্দটো হ’ল '), ...word),
            h('p', {}, heard), h('div', { class: 'row left' }, hear, again));
        }
      });
    });
  }

  /** Ten-letter speaking drill in a dialog. ctx: { h, L, num, LET, D, sayWord, store, burst, openModal, closeModal, shuffle, AS } */
  function drill(ctx) {
    const { h, L, num, LET, D, store, burst, openModal, closeModal, shuffle } = ctx;
    window.Recite.ensureReady(() => {
      const qs = shuffle(LET).slice(0, 10); let i = 0, score = 0; const missed = [];
      const next = () => {
        if (i >= qs.length) {
          store.set('pronQuiz', Math.max(store.get('pronQuiz', 0), score));
          const sheet = openModal(h('h2', {}, score >= 8 ? L('MashaAllah — well done!', 'মাশ্বাআল্লাহ — বৰ ভাল!') : L('Good effort', 'ভাল চেষ্টা')), h('div', { class: 'big' }, num(score + '/10')),
            missed.length ? h('p', { class: 'muted center' }, L('Practise these letters again: ', 'এই আখৰকেইটা আকৌ অনুশীলন কৰক: '), h('span', { class: 'ar', lang: 'ar' }, missed.join('  '))) : null,
            h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: () => drill(ctx) }, L('Again', 'আকৌ')), h('button', { class: 'btn', onclick: closeModal }, L('Close', 'বন্ধ কৰক'))));
          if (score >= 8) burst(sheet);
          return;
        }
        const X = qs[i], res = h('div', { class: 'lpres', 'aria-live': 'polite' });
        const nextBtn = h('button', { class: 'btn gold', hidden: true, onclick: () => { i++; next(); } }, i === qs.length - 1 ? L('See result', 'ফলাফল চাওক') : L('Next letter →', 'পৰৱৰ্তী আখৰ →'));
        let counted = false;
        const sub = { ...ctx, X, ex: D.ex[X[0]] };
        const mic = h('button', { class: 'btn gold', onclick: () => checkName(sub, res, (ok, id) => {
          if (ok === null) return;
          if (!counted) { counted = true; if (ok) score++; else missed.push(X[0]); }
          nextBtn.hidden = false;
        }) }, h('span', { html: window.Recite.icons.mic }), L('Say its name', 'নামটো কওক'));
        openModal(h('h2', {}, L('Say the name of this letter', 'এই আখৰটোৰ নাম কওক')), h('div', { class: 'muted' }, L(`Letter ${i + 1} of 10`, `আখৰ ${num(i + 1)} / ${num(10)}`)),
          h('div', { class: 'qprog' }, h('i', { style: `width:${i * 10}%` })), h('div', { class: 'qword', lang: 'ar' }, X[0]),
          h('div', { class: 'row' }, mic), res, h('div', { class: 'row' }, nextBtn),
          h('p', { class: 'muted small center' }, L('The first try counts towards the score; you can try again as often as you like.', 'প্ৰথম চেষ্টাটোহে নম্বৰত গণনা হয়; যিমান বাৰ ইচ্ছা আকৌ চেষ্টা কৰিব পাৰে।')));
      };
      next();
    });
  }

  window.LetterCheck = { box, drill, identify, NAMES };
})();
