/* Recite and check: the user recites a verse, the browser's speech recogniser writes down what it heard,
   and ReciteCore compares it word by word with the verse. Results are shown on the verse itself. */
(function () {
  'use strict';
  const getSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  let run = null;   // the current attempt: { rec, i, panel, timer, ... }

  const N = () => window.Noor;
  const icons = {
    mic: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>'
  };

  function stop(cancel) {
    if (!run) return;
    const r = run;
    clearInterval(r.timer);
    r.cancelled = !!cancel;
    try { cancel ? r.rec.abort() : r.rec.stop(); } catch { /* already stopped */ }
    if (cancel) { r.panel?.remove(); run = null; }
  }

  function clearMarks(card) { card.querySelectorAll('.w').forEach(w => w.classList.remove('rc-ok', 'rc-close', 'rc-wrong', 'rc-missed')); }

  function errorBox(card, msgKey) {
    const { h, t } = N();
    const p = h('div', { class: 'rc rc-err', role: 'alert' }, h('p', {}, t(msgKey)),
      h('div', { class: 'row left' }, h('button', { class: 'btn sm', onclick: () => p.remove() }, t('close'))));
    card.querySelector('.rc')?.remove();
    card.querySelector('.words').after(p);
  }

  /** Runs `then` once speech recognition is available and the user has agreed to the microphone notice. */
  function ensureReady(then) {
    const { store, openModal, closeModal, h, t } = N();
    if (!getSR()) {
      openModal(h('h2', {}, t('rc_unsupported_t')), h('p', { class: 'muted' }, t('rc_unsupported')),
        h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: closeModal }, t('close'))));
      return;
    }
    if (!store.get('rcConsent', false)) {
      openModal(h('h2', {}, t('rc_consent_t')), h('p', {}, t('rc_consent')), h('p', { class: 'muted small' }, t('rc_note')),
        h('div', { class: 'row' },
          h('button', { class: 'btn gold', onclick: () => { store.set('rcConsent', true); closeModal(); then(); } }, t('rc_consent_ok')),
          h('button', { class: 'btn', onclick: closeModal }, t('rc_cancel'))));
      return;
    }
    then();
  }

  /** Start an attempt on verse index i of the current surah. */
  function start(i) {
    const cur = N().cur(); if (!cur || !cur.verses[i]) return;
    ensureReady(() => begin(i));
  }

  /**
   * Short listening session for single letters and words.
   * opts: { onInterim(text), onDone({ text, alts, error }), quietMs, limitMs }. Returns { stop(), abort() }.
   * alts holds the recogniser's other guesses, which helps with very short sounds.
   */
  let short = null;
  function listen(opts) {
    if (short) { try { short.rec.abort(); } catch { /* ignore */ } short = null; }
    stop(true); N().pause();
    const SR = getSR(), rec = new SR();
    rec.lang = 'ar-SA'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 5;
    const me = { rec, text: '', interim: '', alts: [], error: null, heard: false, last: Date.now(), t0: Date.now(), done: false };
    short = me;
    rec.onresult = (e) => {
      let interim = '';
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const res = e.results[k];
        if (res.isFinal) { me.text += ' ' + res[0].transcript; for (let a = 0; a < res.length; a++) me.alts.push(res[a].transcript); }
        else interim += ' ' + res[0].transcript;
      }
      me.interim = interim; me.heard = true; me.last = Date.now();
      opts.onInterim && opts.onInterim((me.text + ' ' + interim).trim());
    };
    rec.onerror = (e) => { me.error = e.error; };
    rec.onend = () => {
      clearInterval(me.timer); if (short === me) short = null;
      if (me.done) return; me.done = true;
      const text = (me.text + ' ' + me.interim).trim();
      if (me.interim.trim()) me.alts.push(me.interim.trim());
      opts.onDone({ text, alts: me.alts.length ? me.alts : (text ? [text] : []), error: me.error });
    };
    const quiet = opts.quietMs || 1500, limit = opts.limitMs || 7000;
    me.timer = setInterval(() => { if ((me.heard && Date.now() - me.last > quiet) || Date.now() - me.t0 > limit) { try { rec.stop(); } catch { /* ignore */ } } }, 250);
    try { rec.start(); } catch { me.done = true; clearInterval(me.timer); opts.onDone({ text: '', alts: [], error: 'start' }); }
    return { stop: () => { try { rec.stop(); } catch { /* ignore */ } }, abort: () => { me.done = true; clearInterval(me.timer); try { rec.abort(); } catch { /* ignore */ } } };
  }

  /** Speak Arabic text with the browser's voice, if it has an Arabic one. Returns false when it cannot. */
  function speak(text) {
    const ss = window.speechSynthesis; if (!ss || !window.SpeechSynthesisUtterance) return false;
    const voices = ss.getVoices(), v = voices.find(x => /^ar/i.test(x.lang));
    if (voices.length && !v) return false;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = .8; if (v) u.voice = v;
    ss.cancel(); ss.speak(u); return true;
  }

  function begin(i) {
    const { h, t, pause } = N();
    stop(true); pause();
    const cur = N().cur(), v = cur.verses[i], card = N().verseEl(i);
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    clearMarks(card); card.querySelector('.rc')?.remove();
    const words = v.w.filter(w => !w.end);

    const live = h('div', { class: 'rc-live', dir: 'rtl', lang: 'ar' }, h('span', { class: 'muted' }, t('rc_waiting')));
    const panel = h('div', { class: 'rc rc-listening', role: 'status' },
      h('div', { class: 'rc-head' }, h('span', { class: 'rc-dot', 'aria-hidden': 'true' }), h('b', {}, t('rc_listen')),
        h('span', { class: 'sp' }),
        h('button', { class: 'btn sm gold', onclick: () => stop(false) }, t('rc_done')),
        h('button', { class: 'btn sm', onclick: () => stop(true) }, t('rc_cancel'))),
      live, h('p', { class: 'muted small' }, t('rc_hint')));
    card.querySelector('.words').after(panel);

    const SR = getSR(), rec = new SR();
    rec.lang = 'ar-SA'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    run = { rec, i, panel, finalText: '', interim: '', last: Date.now(), heardAny: false, started: Date.now(), error: null };
    const me = run;
    rec.onresult = (e) => {
      let interim = '';
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const tx = e.results[k][0].transcript;
        if (e.results[k].isFinal) me.finalText += ' ' + tx; else interim += ' ' + tx;
      }
      me.interim = interim; me.last = Date.now(); me.heardAny = true;
      live.textContent = (me.finalText + ' ' + interim).trim() || t('rc_waiting');
    };
    rec.onerror = (e) => { me.error = e.error; };
    rec.onend = () => {
      clearInterval(me.timer);
      if (run === me) run = null;
      if (me.cancelled) return;
      panel.remove();
      const heard = (me.finalText + ' ' + me.interim).trim();
      if (me.error && me.error !== 'no-speech' && me.error !== 'aborted' && !heard) {
        return errorBox(card, me.error === 'not-allowed' || me.error === 'service-not-allowed' ? 'rc_denied'
          : me.error === 'audio-capture' ? 'rc_nomic' : me.error === 'network' ? 'rc_net' : 'rc_none');
      }
      if (!heard) return errorBox(card, 'rc_none');
      showResult(i, words, heard);
    };
    // stop by itself after a pause in speech, or after a generous time limit
    const limit = 15000 + words.length * 1800;
    me.timer = setInterval(() => {
      const quiet = Date.now() - me.last;
      if ((me.heardAny && quiet > 2600) || Date.now() - me.started > limit) stop(false);
    }, 300);
    try { rec.start(); } catch { panel.remove(); run = null; errorBox(card, 'rc_none'); }
  }

  function showResult(i, words, heard) {
    const { h, t, num, sayWord, store, burst, playOne } = N();
    const card = N().verseEl(i), cur = N().cur();
    const r = window.ReciteCore.compare(words.map(w => w.t), heard);
    const els = [...card.querySelectorAll('.w')];
    r.words.forEach((res, k) => els[k]?.classList.add('rc-' + res.status));

    // remember the best score for this verse
    const best = store.get('rc', {}), vk = cur.verses[i].key;
    best[vk] = Math.max(best[vk] || 0, Math.round(r.score * 100)); store.set('rc', best);
    card.querySelector('.vmic')?.classList.toggle('passed', best[vk] === 100);

    const label = { close: t('rc_close'), wrong: t('rc_wrong'), missed: t('rc_missed') };
    const mistakes = r.words.map((res, k) => ({ res, w: words[k] })).filter(x => x.res.status !== 'ok');
    const head = r.correct === r.total ? t('rc_perfect') : r.score >= .7 ? t('rc_good') : t('rc_try');
    const hasNext = i + 1 < cur.verses.length;
    const panel = h('div', { class: 'rc rc-result' + (r.correct === r.total ? ' perfect' : '') },
      h('div', { class: 'rc-score' }, h('b', {}, num(r.correct + '/' + r.total)), h('span', {}, h('strong', {}, head), h('br'), t('rc_score', [r.correct, r.total]))),
      h('div', { class: 'rc-legend' }, ['ok', 'close', 'wrong', 'missed'].map(s => h('span', { class: 'lg lg-' + s }, t('rc_' + s)))),
      mistakes.length ? h('ul', { class: 'rc-list' }, mistakes.map(({ res, w }) => h('li', { class: 'rc-item st-' + res.status },
        h('span', { class: 'rc-st' }, label[res.status]),
        h('span', { class: 'rc-correct' }, h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, w.t), h('span', { class: 'pa', lang: 'as' }, window.AsPron.word(w.t))),
        res.heard ? h('span', { class: 'rc-heard' }, t('rc_you_said', ''), h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, res.heard)) : null,
        h('button', { class: 'btn sm', onclick: () => sayWord(w) }, h('span', { html: icons.speaker }), t('rc_hear'))))) : null,
      r.extra.length ? h('p', { class: 'muted small' }, t('rc_extra') + ' ', h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, r.extra.join(' '))) : null,
      h('details', { class: 'rc-heardall' }, h('summary', {}, t('rc_heard_all')), h('p', { class: 'ar', dir: 'rtl', lang: 'ar' }, heard)),
      h('div', { class: 'row left' },
        h('button', { class: 'btn sm gold', onclick: () => start(i) }, h('span', { html: icons.mic }), t('rc_again')),
        h('button', { class: 'btn sm', onclick: () => playOne(i) }, h('span', { html: icons.speaker }), t('rc_listen_v')),
        hasNext ? h('button', { class: 'btn sm', onclick: () => { panel.remove(); start(i + 1); } }, t('rc_next')) : h('span', { class: 'muted small' }, t('rc_last')),
        h('button', { class: 'btn sm', onclick: () => { panel.remove(); clearMarks(card); } }, t('close'))),
      h('p', { class: 'muted small rc-note' }, t('rc_note')));
    card.querySelector('.words').after(panel);
    if (r.correct === r.total) burst(panel);
    N().touchDay();
  }

  window.Recite = { start, stop: () => { stop(true); if (short) { try { short.rec.abort(); } catch { /* ignore */ } short = null; } }, supported: () => !!getSR(), icons, ensureReady, listen, speak };
  // voices load asynchronously in some browsers
  try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch { /* ignore */ }
})();
