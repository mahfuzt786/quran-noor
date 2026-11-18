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

  /* ---- the user's own voice: recorded alongside the check, kept on this device only (IndexedDB) ---- */
  const canRecord = () => !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const recOn = () => canRecord() && N().store.get('recVoice', true) && !N().store.get('recConflict', false);

  function startVoice() {
    const v = { chunks: [], mr: null, done: false, discarded: false };
    v.ready = new Promise(res => { v.res = res; });
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(stream => {
      if (v.done) { stream.getTracks().forEach(x => x.stop()); return v.res(null); }
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(x => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x));
      let mr;
      try { mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch { stream.getTracks().forEach(x => x.stop()); return v.res(null); }
      v.mr = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size) v.chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(x => x.stop());
        const blob = v.chunks.length && !v.discarded ? new Blob(v.chunks, { type: mr.mimeType || type || 'audio/webm' }) : null;
        v.res(blob && blob.size > 800 ? blob : null);
      };
      mr.start(250);
    }).catch(() => v.res(null));
    v.stop = (discard) => {
      if (v.done) return; v.done = true; v.discarded = !!discard;
      if (v.mr && v.mr.state !== 'inactive') { try { v.mr.stop(); } catch { v.res(null); } }
    };
    return v;
  }

  const Voice = (() => {
    const MAX = 40;   // keep the latest recording of at most this many verses
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('noor-voice', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('rec');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const x = db.transaction('rec', mode), req = fn(x.objectStore('rec'));
      x.oncomplete = () => res(req && req.result); x.onerror = () => rej(x.error);
    }));
    return {
      get: (k) => tx('readonly', st => st.get(k)).catch(() => null),
      del: (k) => tx('readwrite', st => st.delete(k)).catch(() => null),
      async put(k, rec) {
        try {
          await tx('readwrite', st => st.put(rec, k));
          const [keys, vals] = await Promise.all([tx('readonly', st => st.getAllKeys()), tx('readonly', st => st.getAll())]);
          if (keys.length > MAX) {
            const old = keys.map((key, n) => [key, vals[n].t || 0]).sort((a, b) => a[1] - b[1]).slice(0, keys.length - MAX);
            await tx('readwrite', st => { old.forEach(([key]) => st.delete(key)); return null; });
          }
        } catch { /* storage unavailable or full: the recording still plays this time */ }
      }
    };
  })();

  /** A small player for one of the user's recordings. opts: { title, sub, onDelete, reciter: () => void } */
  function voicePlayer(blob, key, opts = {}) {
    const { h, t, pause, toast } = N();
    const url = URL.createObjectURL(blob);
    const audio = h('audio', { controls: true, preload: 'metadata', src: url, onplay: () => pause() });
    // Chrome's recordings carry no length, so the bar shows 0:00 until the end is found: seek far once to learn it
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration !== Infinity) return;
      audio.addEventListener('durationchange', function fix() { if (audio.duration !== Infinity) { audio.removeEventListener('durationchange', fix); audio.currentTime = 0; } });
      audio.currentTime = 1e7;
    }, { once: true });
    const box = h('div', { class: 'rc-voice' },
      h('div', { class: 'rc-voice-h' }, h('span', { class: 'rc-voice-ic', html: icons.mic }), h('b', {}, opts.title || t('rc_myvoice')), opts.sub ? h('span', { class: 'muted small' }, opts.sub) : null),
      audio,
      h('div', { class: 'row left' },
        opts.reciter ? h('button', { class: 'btn sm', onclick: () => { audio.pause(); opts.reciter(); } }, h('span', { html: icons.speaker }), t('rc_hear_reciter')) : null,
        h('button', { class: 'btn sm', onclick: () => { audio.pause(); URL.revokeObjectURL(url); Voice.del(key); box.remove(); toast(t('rc_rec_deleted')); opts.onDelete && opts.onDelete(); } }, t('rc_rec_del'))),
      h('p', { class: 'muted small' }, t('rc_rec_note')));
    return box;
  }

  function stop(cancel) {
    if (!run) return;
    const r = run;
    clearInterval(r.timer);
    r.cancelled = !!cancel;
    if (cancel) r.voice?.stop(true);
    try { cancel ? r.rec.abort() : r.rec.stop(); } catch { /* already stopped */ }
    if (cancel) { r.panel?.remove(); run = null; }
  }

  function clearMarks(card) {
    card.querySelectorAll('.w').forEach(w => w.classList.remove('rc-ok', 'rc-close', 'rc-wrong', 'rc-missed'));
    card.querySelectorAll('.rc-pct').forEach(x => x.remove());
  }

  function errorBox(card, msgKey, extra) {
    const { h, t } = N();
    const p = h('div', { class: 'rc rc-err', role: 'alert' }, h('p', {}, t(msgKey)),
      h('div', { class: 'row left' }, extra || null, h('button', { class: 'btn sm', onclick: () => p.remove() }, t('close'))));
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
      live, h('p', { class: 'muted small' }, t('rc_hint')),
      canRecord() ? h('label', { class: 'rc-rectog' },
        h('input', { type: 'checkbox', checked: recOn() || null, onchange: (e) => {
          const { store } = N(); store.set('recVoice', e.target.checked); if (e.target.checked) store.set('recConflict', false);
          if (!e.target.checked && run) { run.voice?.stop(true); run.voice = null; }
        } }), t('rc_rec_toggle')) : null);
    card.querySelector('.words').after(panel);

    const SR = getSR(), rec = new SR();
    rec.lang = 'ar-SA'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    run = { rec, i, panel, finalText: '', interim: '', last: Date.now(), heardAny: false, started: Date.now(), error: null, voice: null };
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
      const hadVoice = !!me.voice;
      me.voice?.stop(!heard);
      const again = (label, fn) => h('button', { class: 'btn sm gold', onclick: fn }, h('span', { html: icons.mic }), label);
      if (me.error && me.error !== 'no-speech' && me.error !== 'aborted' && !heard) {
        // some phones give the microphone to one user at a time, so recording blocks recognition
        if (me.error === 'audio-capture' && hadVoice) { N().store.set('recConflict', true); return errorBox(card, 'rc_rec_conflict', again(t('rc_again'), () => start(i))); }
        return errorBox(card, me.error === 'not-allowed' || me.error === 'service-not-allowed' ? 'rc_denied'
          : me.error === 'audio-capture' ? 'rc_nomic' : me.error === 'network' ? 'rc_net' : 'rc_none');
      }
      if (!heard) return errorBox(card, 'rc_none', hadVoice ? again(t('rc_try_norec'), () => { N().store.set('recVoice', false); start(i); }) : null);
      showResult(i, words, heard, hadVoice ? me.voice.ready : null);
    };
    // stop by itself after a pause in speech, or after a generous time limit
    const limit = 15000 + words.length * 1800;
    me.timer = setInterval(() => {
      const quiet = Date.now() - me.last;
      if ((me.heardAny && quiet > 2600) || Date.now() - me.started > limit) stop(false);
    }, 300);
    try { rec.start(); } catch { panel.remove(); run = null; return errorBox(card, 'rc_none'); }
    if (recOn()) me.voice = startVoice();
  }

  function showResult(i, words, heard, voiceP) {
    const { h, t, num, sayWord, store, burst, playOne } = N();
    const card = N().verseEl(i), cur = N().cur();
    const r = window.ReciteCore.compare(words.map(w => w.t), heard);
    const els = [...card.querySelectorAll('.w')];
    const pct = (x) => num(Math.round(x * 100)) + '%';
    r.words.forEach((res, k) => {
      if (!els[k]) return;
      els[k].classList.add('rc-' + res.status);
      els[k].append(h('span', { class: 'rc-pct', title: t('rc_word_match', pct(res.s)) }, pct(res.s)));
    });

    // remember the best score for this verse
    const best = store.get('rc', {}), vk = cur.verses[i].key;
    best[vk] = Math.max(best[vk] || 0, Math.round(r.score * 100)); store.set('rc', best);
    card.querySelector('.vmic')?.classList.toggle('passed', best[vk] === 100);

    const label = { close: t('rc_close'), wrong: t('rc_wrong'), missed: t('rc_missed') };
    const mistakes = r.words.map((res, k) => ({ res, w: words[k] })).filter(x => x.res.status !== 'ok');
    const head = r.correct === r.total ? t('rc_perfect') : r.score >= .7 ? t('rc_good') : t('rc_try');
    const hasNext = i + 1 < cur.verses.length;
    let voiceBox = null;
    if (voiceP) {
      voiceBox = h('div', { class: 'rc-voice' }, h('div', { class: 'rc-voice-h' }, h('span', { class: 'rc-voice-ic', html: icons.mic }), h('b', {}, t('rc_myvoice'))), h('p', { class: 'muted small' }, t('rc_rec_wait')));
      voiceP.then(blob => {
        if (!blob) { voiceBox.replaceChildren(h('p', { class: 'muted small' }, t('rc_rec_none'))); return; }
        Voice.put(vk, { blob, t: Date.now(), match: Math.round(r.match * 100), score: Math.round(r.score * 100) });
        const pl = voicePlayer(blob, vk, { sub: t('rc_myvoice_d'), reciter: () => playOne(i) });
        voiceBox.replaceWith(pl); voiceBox = pl;
      });
    }
    const panel = h('div', { class: 'rc rc-result' + (r.correct === r.total ? ' perfect' : '') },
      h('div', { class: 'rc-score' },
        h('div', { class: 'rc-pctbox ' + (r.match >= .95 ? 'hi' : r.match >= .7 ? 'mid' : 'lo'), style: `--p:${Math.round(r.match * 100)}`, title: t('rc_match_d') }, h('b', {}, pct(r.match)), h('small', {}, t('rc_match'))),
        h('span', {}, h('strong', {}, head), h('br'), t('rc_score', [r.correct, r.total]), h('br'), h('small', { class: 'muted' }, t('rc_match_d')))),
      h('div', { class: 'rc-legend' }, ['ok', 'close', 'wrong', 'missed'].map(s => h('span', { class: 'lg lg-' + s }, t('rc_' + s)))),
      mistakes.length ? h('ul', { class: 'rc-list' }, mistakes.map(({ res, w }) => h('li', { class: 'rc-item st-' + res.status },
        h('span', { class: 'rc-st' }, label[res.status], h('small', {}, t('rc_word_match', pct(res.s)))),
        h('span', { class: 'rc-correct' }, h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, w.t), h('span', { class: 'pa', lang: 'as' }, window.AsPron.word(w.t))),
        res.heard ? h('span', { class: 'rc-heard' }, t('rc_you_said', ''), h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, res.heard)) : null,
        h('button', { class: 'btn sm', onclick: () => sayWord(w) }, h('span', { html: icons.speaker }), t('rc_hear'))))) : null,
      r.extra.length ? h('p', { class: 'muted small' }, t('rc_extra') + ' ', h('span', { class: 'ar', dir: 'rtl', lang: 'ar' }, r.extra.join(' '))) : null,
      voiceBox,
      h('details', { class: 'rc-heardall' }, h('summary', {}, t('rc_heard_all')), h('p', { class: 'ar', dir: 'rtl', lang: 'ar' }, heard)),
      h('div', { class: 'row left' },
        h('button', { class: 'btn sm gold', onclick: () => start(i) }, h('span', { html: icons.mic }), t('rc_again')),
        h('button', { class: 'btn sm', onclick: () => playOne(i) }, h('span', { html: icons.speaker }), t('rc_listen_v')),
        hasNext ? h('button', { class: 'btn sm', onclick: () => { panel.remove(); start(i + 1); } }, t('rc_next')) : h('span', { class: 'muted small' }, t('rc_last')),
        h('button', { class: 'btn sm', onclick: () => { panel.remove(); clearMarks(card); } }, t('close'))),
      h('p', { class: 'muted small rc-note' }, t('rc_note')));
    card.querySelector('.words').after(panel);
    if (r.correct === r.total) burst(panel);
    N().touchDay(); N().log('rc', r.score * 100);
  }

  window.Recite = { voice: Voice, voicePlayer, start, stop: () => { stop(true); if (short) { try { short.rec.abort(); } catch { /* ignore */ } short = null; } }, supported: () => !!getSR(), icons, ensureReady, listen, speak };
  // voices load asynchronously in some browsers
  try { window.speechSynthesis && window.speechSynthesis.getVoices(); } catch { /* ignore */ }
})();
