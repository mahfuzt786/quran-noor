/* Memorisation (hifz): learn a surah by heart, verse by verse, in four steps —
   0 read & listen · 1 every other word hidden · 2 first letters only · 3 everything hidden.
   A perfect recitation without peeking moves a verse up a step; after step 3 it is memorised (4) and goes into
   smart review. After each new verse the "join" check recites from verse 1 up to it.
   Stored under noor.hifz = { surahId: { lv: { verseNo: 0..4 }, chain: n, t } } (synced across devices). */
(function () {
  'use strict';
  const N = () => window.Noor;
  const MEMORISED = 4;
  const SUGGEST = [1, 112, 113, 114, 108, 103, 110, 111, 109, 107, 106, 105, 104, 102, 101, 100, 99, 97, 95, 94, 93];
  const isMark = (ch) => /[ً-ٰٟۖ-ۭ]/.test(ch);

  const all = () => N().store.get('hifz', {});
  const of = (id) => all()[id] || { lv: {}, chain: 0, t: 0 };
  function setLevel(id, v, lv) {
    const a = all(), s = a[id] || { lv: {}, chain: 0, t: 0 };
    s.lv[v] = Math.max(0, Math.min(MEMORISED, lv)); s.t = Date.now(); a[id] = s; N().store.set('hifz', a);
  }
  function setChain(id, n) { const a = all(), s = a[id] || { lv: {}, chain: 0, t: 0 }; s.chain = Math.max(s.chain || 0, n); s.t = Date.now(); a[id] = s; N().store.set('hifz', a); }
  const memorisedCount = (id, n) => { const lv = of(id).lv; let c = 0; for (let v = 1; v <= n; v++) if ((lv[v] || 0) >= MEMORISED) c++; return c; };

  /* ---------- audio: one verse from the full-surah recitation ---------- */
  let player = null, playToken = 0;
  function playVerse(raw, v, times = 1) {
    const seg = raw.a[1][v - 1]; if (!seg) return;
    if (!player) player = new Audio();
    N().pause();
    const token = ++playToken; let left = times;
    const url = raw.a[0], from = seg[0] / 1000, to = seg[1] / 1000;
    const onTime = () => {
      if (token !== playToken) { player.removeEventListener('timeupdate', onTime); return; }
      if (player.currentTime >= to) {
        player.pause();
        if (--left > 0) setTimeout(() => { if (token === playToken) { player.currentTime = from; player.play().catch(() => { }); } }, 900);
        else player.removeEventListener('timeupdate', onTime);
      }
    };
    player.addEventListener('timeupdate', onTime);
    const go = () => { player.currentTime = from; player.play().catch(() => N().toast(N().t(navigator.onLine ? 'audio_err' : 'off_noaudio'))); };
    if (player.src !== url) { player.src = url; player.addEventListener('loadedmetadata', go, { once: true }); } else go();
  }
  const stopAudio = () => { playToken++; try { player && player.pause(); } catch { /* ignore */ } };

  /* ---------- listening ---------- */
  function listen(expected, box, onDone) {
    const { h, t } = N();
    window.Recite.ensureReady(() => {
      stopAudio();
      const live = h('span', { class: 'rc-live-sm', dir: 'rtl', lang: 'ar' });
      let ctl;
      box.replaceChildren(h('div', { class: 'lp-listen' }, h('span', { class: 'rc-dot', 'aria-hidden': 'true' }), h('b', {}, t('rc_listen')), live,
        h('button', { class: 'btn sm', onclick: () => ctl && ctl.stop() }, t('rc_done'))));
      ctl = window.Recite.listen({
        continuous: true, quietMs: 2600, limitMs: 15000 + expected.length * 1800,
        onInterim: (tx) => { live.textContent = tx; },
        onDone: ({ text, error }) => {
          if (!text) { box.replaceChildren(h('p', { class: 'lp-bad' }, t(error === 'not-allowed' || error === 'service-not-allowed' ? 'rc_denied' : error === 'network' ? 'rc_net' : 'rc_none'))); return; }
          onDone(window.ReciteCore.compare(expected, text));
        }
      });
    });
  }

  /* ---------- how a word looks at each step ---------- */
  function hint(word) {           // first letter with its vowel marks
    const ch = [...word]; let out = '';
    for (let i = 0; i < ch.length; i++) { if (i > 0 && !isMark(ch[i])) break; out += ch[i]; }
    return out + 'ـ';
  }
  const hiddenAt = (lv, k) => lv === 1 ? k % 2 === 1 : lv >= 2;

  /* ---------- surah picker ---------- */
  function picker(app) {
    const { h, t, num, chapters, sname, footer } = N();
    const CH = chapters(), mine = all();
    const card = (id) => {
      const c = CH[id - 1], m = memorisedCount(id, c.n);
      return h('a', { class: 'hz-pick' + (m === c.n ? ' done' : m ? ' part' : ''), href: '#/hifz/' + id },
        h('span', { class: 'badge' }, num(id)),
        h('span', { class: 'mid' }, h('b', {}, sname(c)), h('span', { class: 'meta' }, t('hz_count', [m, c.n]))),
        h('span', { class: 'arn', lang: 'ar' }, c.ar),
        h('i', { class: 'hz-bar' }, h('i', { style: `width:${m / c.n * 100}%` })));
    };
    const started = Object.keys(mine).map(Number).filter(id => CH[id - 1]).sort((a, b) => (mine[b].t || 0) - (mine[a].t || 0));
    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(97) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('hz_sub')), h('h1', {}, '🧠 ' + t('hz_title'))))),
      h('div', { class: 'wrap' },
        started.length ? h('section', { class: 'sec' }, h('div', { class: 'sec-title' }, h('h2', {}, t('hz_in_progress'))), h('div', { class: 'grid hz-grid' }, started.map(card))) : null,
        h('section', { class: 'sec' }, h('div', { class: 'sec-title' }, h('h2', {}, t('hz_pick_t')), h('span', {}, t('hz_pick_d'))),
          h('div', { class: 'grid hz-grid' }, SUGGEST.filter(id => !started.includes(id)).map(card)),
          h('p', { class: 'muted small' }, t('hz_any'))),
        h('section', { class: 'sec' }, h('p', { class: 'muted small' }, t('hz_how'))),
        footer()));
  }

  /* ---------- the memorising page for one surah ---------- */
  async function view(app, id, startV) {
    const { h, t, num, chapters, sname, footer, store, lang, sayWord, burst, toast } = N();
    if (!id) return picker(app);
    const meta = chapters()[id - 1]; if (!meta) { location.hash = '#/hifz'; return; }
    app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'skeleton' })));
    let raw, verses;
    try { ({ raw, verses } = await N().surah(id)); } catch { app.replaceChildren(h('div', { class: 'wrap' }, h('div', { class: 'err' }, t('load_err')))); return; }
    const AS = lang() === 'as';
    const n = verses.length;
    const firstOpen = () => { const lv = of(id).lv; for (let v = 1; v <= n; v++) if ((lv[v] || 0) < MEMORISED) return v; return n; };
    let v = startV && startV <= n ? startV : firstOpen();
    let peeked = false;

    const stage = h('div', { class: 'hz-stage' });
    const dots = h('div', { class: 'hz-dots' });
    const overall = h('div', { class: 'hz-overall' });

    function drawTop() {
      const lv = of(id).lv, m = memorisedCount(id, n);
      overall.replaceChildren(h('span', {}, t('hz_count', [m, n])), h('i', { class: 'hz-bar' }, h('i', { style: `width:${m / n * 100}%` })));
      dots.replaceChildren(...verses.map((_, i) => {
        const l = lv[i + 1] || 0;
        return h('button', { class: 'hz-dot l' + l + (i + 1 === v ? ' on' : ''), title: t('hz_verse_n', i + 1), 'aria-label': t('hz_verse_n', i + 1), onclick: () => { v = i + 1; draw(); } }, num(i + 1));
      }));
    }

    function draw() {
      stopAudio(); window.Recite.stop(); peeked = false;
      history.replaceState(history.state, '', '#/hifz/' + id + '/' + v);
      drawTop();
      const vv = verses[v - 1], words = vv.w.filter(w => !w.end);
      const lv = Math.min(of(id).lv[v] || 0, MEMORISED);
      const step = Math.min(lv, 3);
      const wordEls = words.map((w, k) => {
        const hide = hiddenAt(step, k);
        const el = h('button', { class: 'w hz-w' + (hide ? ' hz-hidden' : '') },
          h('span', { class: 'ar' }, w.t),
          h('span', { class: 'hz-cover', 'aria-hidden': 'true' }, step === 2 ? hint(w.t) : ''),
          step === 0 ? h('span', { class: 'pa', lang: AS ? 'as' : 'en' }, AS ? window.AsPron.word(w.t) : (w.tr || '')) : null);
        el.style.setProperty('--len', Math.max(2, [...w.t].filter(c => !isMark(c)).length));
        el.onclick = () => {
          if (el.classList.contains('hz-hidden')) { peeked = true; el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1600); }
          else sayWord(w);
        };
        return el;
      });
      const out = h('div', { class: 'hz-out', 'aria-live': 'polite' });
      const meaning = h('p', { class: 'hz-mn', lang: AS ? 'as' : 'en' }, AS ? vv.as : vv.en);
      const memorised = lv >= MEMORISED;

      const advance = () => {
        if (lv < MEMORISED) setLevel(id, v, lv + 1);
        const justMemorised = lv + 1 >= MEMORISED && lv < MEMORISED;
        if (justMemorised) window.Review?.add('m:' + vv.key, 1);
        // the first verse has nothing to join yet, so go straight on; later verses stay for the join check
        if (justMemorised && v === 1 && n > 1) v = 2;
        draw();
      };
      function judged(r) {
        r.words.forEach((res, k) => { wordEls[k].classList.remove('hz-hidden'); wordEls[k].classList.add('rc-' + res.status); });
        N().log('rc', r.score * 100); N().touchDay();
        const perfect = r.score === 1;
        if (perfect && !peeked) {
          const becomes = lv + 1;
          out.replaceChildren(h('div', { class: 'hz-ok' }, h('b', {}, becomes >= MEMORISED ? '🎉 ' + t('hz_done_v') : '✓ ' + t('hz_up')),
            h('div', { class: 'row left' }, h('button', { class: 'btn gold', onclick: advance }, becomes >= MEMORISED ? t('hz_continue') : t('hz_next_step')))));
          burst(out);
        } else {
          out.replaceChildren(h('div', { class: 'hz-bad' }, h('p', {}, perfect ? t('hz_peeked') : t('hz_again')),
            h('div', { class: 'row left' }, h('button', { class: 'btn sm gold', onclick: () => draw() }, t('rc_again')),
              h('button', { class: 'btn sm', onclick: () => playVerse(raw, v) }, '🔊 ' + t('hz_listen')),
              lv > 0 ? h('button', { class: 'btn sm', onclick: () => { setLevel(id, v, lv - 1); draw(); } }, t('hz_step_back')) : null)));
        }
      }
      // without speech recognition the user checks themselves
      const selfCheck = () => {
        wordEls.forEach(el => el.classList.remove('hz-hidden'));
        out.replaceChildren(h('div', { class: 'hz-self' }, h('p', {}, t('hz_self')),
          h('div', { class: 'row left' }, h('button', { class: 'btn sm gold', onclick: advance }, t('hz_self_yes')), h('button', { class: 'btn sm', onclick: () => draw() }, t('hz_self_no')))));
      };

      const stepChips = h('div', { class: 'hz-steps' }, [0, 1, 2, 3].map(s => h('button', {
        class: 'chip' + (s === step && !memorised ? ' on' : '') + (s < step || memorised ? ' past' : ''),
        onclick: () => { setLevel(id, v, s); draw(); }
      }, num(s + 1) + '. ' + t('hz_l' + s))));

      let chain = null;
      if (memorised && v >= 2) {
        const chainBox = h('div', { class: 'hz-out' });
        const exp = verses.slice(0, v).flatMap(x => x.w.filter(w => !w.end).map(w => w.t));
        chain = h('div', { class: 'hz-chain' },
          h('p', {}, (of(id).chain || 0) >= v ? '✓ ' + t('hz_chain_ok', v) : t('hz_chain_t', v)),
          window.Recite.supported() ? h('button', { class: 'btn sm', onclick: () => listen(exp, chainBox, (r) => {
            if (r.score === 1) { setChain(id, v); chainBox.replaceChildren(h('p', { class: 'hz-ok' }, '✓ ' + t('hz_chain_ok', v))); burst(chainBox); }
            else {
              // which verses had mistakes
              let k = 0; const badV = [];
              verses.slice(0, v).forEach((x, i) => { const c = x.w.filter(w => !w.end).length; if (r.words.slice(k, k + c).some(w => w.status !== 'ok')) badV.push(i + 1); k += c; });
              chainBox.replaceChildren(h('p', { class: 'hz-bad' }, t('hz_chain_bad', badV.map(x => num(x)).join(', '))));
            }
            N().log('rc', r.score * 100); N().touchDay();
          }) }, h('span', { html: window.Recite.icons.mic }), t('hz_chain_btn', v)) : null,
          chainBox);
      }

      stage.replaceChildren(
        h('div', { class: 'hz-head' }, h('b', {}, t('hz_verse_n', v) + ' · ' + num(vv.key)), stepChips),
        h('p', { class: 'muted small' }, memorised ? t('hz_l4_d') : t('hz_l' + step + '_d') + (step > 0 ? ' ' + t('hz_peek_tip') : '')),
        h('div', { class: 'words hz-words', dir: 'rtl', lang: 'ar' }, wordEls),
        meaning,
        h('div', { class: 'row left hz-tools' },
          h('button', { class: 'btn', onclick: () => playVerse(raw, v) }, h('span', { html: window.Recite.icons.speaker }), t('hz_listen')),
          h('button', { class: 'btn', onclick: () => playVerse(raw, v, 3) }, '🔁 ' + t('hz_listen3')),
          window.Recite.supported()
            ? h('button', { class: 'btn gold', onclick: () => listen(words.map(w => w.t), out, judged) }, h('span', { html: window.Recite.icons.mic }), t('rc_btn'))
            : (step > 0 && !memorised ? h('button', { class: 'btn gold', onclick: selfCheck }, t('hz_reveal')) : h('button', { class: 'btn gold', onclick: advance }, t('hz_next_step')))),
        out,
        chain,
        h('div', { class: 'row left hz-nav' },
          v > 1 ? h('button', { class: 'btn sm', onclick: () => { v--; draw(); } }, '← ' + t('hz_prev_v')) : null,
          v < n ? h('button', { class: 'btn sm' + (memorised ? ' gold' : ''), onclick: () => { v++; draw(); } }, t('hz_next_v')) : null,
          memorisedCount(id, n) === n ? h('span', { class: 'hz-all' }, '🌟 ' + t('hz_surah_done')) : null));
      if (step === 0 && !memorised && words.length) stage.querySelector('.hz-tools .btn').focus?.();
    }

    app.replaceChildren(
      h('section', { class: 'shead hz-shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(id) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, '🧠 ' + t('hz_title') + ' · ' + t('verses', n)), h('h1', {}, sname(meta)),
          h('div', { class: 'row left shead-act' }, h('a', { class: 'btn glass', href: '#/s/' + id }, '📖 ' + t('hz_open_surah')), h('a', { class: 'btn glass', href: '#/hifz' }, t('hz_other')))),
        h('div', { class: 'arname', lang: 'ar' }, meta.ar))),
      h('div', { class: 'wrap' }, h('section', { class: 'sec hz-sec' }, overall, dots, stage, h('p', { class: 'muted small hz-howto' }, t('hz_how'))), footer()));
    draw();
  }

  /** Progress page section, or null. */
  function section() {
    const { h, t, num, chapters, sname } = N();
    const CH = chapters(), mine = all();
    const ids = Object.keys(mine).map(Number).filter(id => CH[id - 1]);
    if (!ids.length) return null;
    const total = ids.reduce((a, id) => a + memorisedCount(id, CH[id - 1].n), 0);
    return h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, '🧠 ' + t('hz_progress_t')), h('a', { class: 'link', href: '#/hifz' }, t('hz_title') + ' →')),
      h('p', { class: 'muted small' }, t('hz_total', total)),
      h('div', { class: 'row left' }, ids.sort((a, b) => (mine[b].t || 0) - (mine[a].t || 0)).map(id => {
        const c = CH[id - 1], m = memorisedCount(id, c.n);
        return h('a', { class: 'chip' + (m === c.n ? ' st-hi' : m ? ' st-mid' : ''), href: '#/hifz/' + id }, `${sname(c)} · ${num(m)}/${num(c.n)}`);
      })));
  }

  window.Hifz = { view, section, of, setLevel };
})();
