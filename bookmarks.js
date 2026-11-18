/* Bookmarks: verses the user saved to revisit. Each bookmark keeps a copy of the verse text, so the Saved page
   shows it without loading the surah. Stored in this browser under noor.bm (newest first). */
(function () {
  'use strict';
  const N = () => window.Noor;
  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4.4-6 4.4z"/></svg>';
  const list = () => N().store.get('bm', []);
  const save = (l) => { N().store.set('bm', l); badge(); };
  const has = (k) => list().some(b => b.k === k);

  function snapshot(v) {
    const [s, n] = v.key.split(':').map(Number);
    return { k: v.key, s, v: n, ar: v.w.filter(w => !w.end).map(w => w.t).join(' '), as: v.as, en: v.en, t: Date.now(), note: '' };
  }

  function paint(b, on, key) {
    const { t, num } = N();
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    const l = t(on ? 'bm_remove' : 'bm_add'); b.title = l; b.setAttribute('aria-label', l + ' ' + num(key));
  }

  /** The bookmark toggle shown on each verse. */
  function button(v) {
    const b = N().h('button', { class: 'vbm', onclick: () => {
      const l = list(), k = l.findIndex(x => x.k === v.key);
      if (k >= 0) { l.splice(k, 1); save(l); paint(b, false, v.key); N().toast(N().t('bm_removed')); }
      else { l.unshift(snapshot(v)); save(l); paint(b, true, v.key); N().toast(N().t('bm_added')); }
    } }, N().h('span', { html: ICON }));
    paint(b, has(v.key), v.key);
    return b;
  }

  /** The count next to "Saved" in the header. */
  function badge() {
    const el = document.querySelector('#navSaved .nb'); if (!el) return;
    const n = list().length; el.textContent = n ? N().num(n) : ''; el.hidden = !n;
  }

  const scoreClass = (x) => x == null ? '' : x >= 90 ? 'st-hi' : x >= 60 ? 'st-mid' : 'st-lo';

  function view(app) {
    const { h, t, num, store, footer, chapters, sname, lang } = N();
    const CH = chapters(), rc = store.get('rc', {}), AS = lang() === 'as';
    let sort = store.get('bmSort', 'new');
    const listEl = h('div', { class: 'bm-list' });
    const countEl = h('span', { class: 'muted' });
    const empty = h('div', { class: 'endcard pg-empty' }, h('h3', {}, t('bm_empty_t')), h('p', {}, t('bm_empty')),
      h('div', { class: 'row' }, h('a', { class: 'btn gold', href: '#/s/1' }, t('pg_go_surah'))));

    const sorted = () => {
      const l = list();
      if (sort === 'quran') return l.sort((a, b) => a.s - b.s || a.v - b.v);
      if (sort === 'weak') return l.sort((a, b) => (rc[a.k] ?? -1) - (rc[b.k] ?? -1) || a.s - b.s || a.v - b.v);
      return l;
    };

    function remove(b, el) {
      const l = list(), at = l.findIndex(x => x.k === b.k); if (at < 0) return;
      const [gone] = l.splice(at, 1); save(l);
      const row = h('div', { class: 'bm-gone', role: 'status' }, h('span', {}, t('bm_removed') + ' — ', h('b', {}, sname(CH[b.s - 1]) + ' ' + num(b.k))),
        h('button', { class: 'btn sm', onclick: () => { const l2 = list(); if (!l2.some(x => x.k === gone.k)) { l2.splice(Math.min(at, l2.length), 0, gone); save(l2); } render(); } }, t('bm_undo')));
      el.replaceWith(row);
      countEl.textContent = t('bm_count', l.length);
      if (!l.length) empty.hidden = false;
    }

    function card(b) {
      const meta = CH[b.s - 1], best = rc[b.k];
      const recSlot = h('div', { class: 'bm-rec' });
      window.Recite?.voice.get(b.k).then(rec => {
        if (rec && rec.blob) recSlot.append(window.Recite.voicePlayer(rec.blob, b.k, { title: t('bm_myrec'), sub: rec.match != null ? t('rc_word_match', num(rec.match) + '%') : null }));
      });
      const el = h('article', { class: 'bm-card' },
        h('div', { class: 'bm-head' },
          h('a', { class: 'bm-ref', href: `#/s/${b.s}/${b.v}` }, h('b', {}, sname(meta)), h('span', { class: 'muted' }, num(b.k))),
          h('span', { class: 'chip bm-score ' + scoreClass(best) }, best == null ? t('bm_unchecked') : t('bm_best', num(best) + '%')),
          h('button', { class: 'vbm on', title: t('bm_remove'), 'aria-label': t('bm_remove') + ' ' + num(b.k), onclick: () => remove(b, el) }, h('span', { html: ICON }))),
        h('p', { class: 'bm-ar', dir: 'rtl', lang: 'ar' }, b.ar),
        window.AsPron ? h('p', { class: 'bm-pr', lang: 'as' }, window.AsPron.verse(b.ar.split(' '))) : null,
        h('p', { class: 'bm-mn', lang: AS ? 'as' : 'en' }, AS ? b.as : b.en),
        h('input', { class: 'bm-note', type: 'text', value: b.note || '', maxlength: '200', placeholder: t('bm_note_ph'), 'aria-label': t('bm_note_l'),
          onchange: (e) => { const l = list(), x = l.find(y => y.k === b.k); if (x) { x.note = e.target.value.trim(); save(l); } } }),
        recSlot,
        h('div', { class: 'row left' }, h('a', { class: 'btn sm gold', href: `#/s/${b.s}/${b.v}` }, t('bm_open'))));
      return el;
    }

    function render() {
      const l = sorted();
      listEl.replaceChildren(...l.map(card));
      countEl.textContent = t('bm_count', l.length);
      empty.hidden = l.length > 0; tools.hidden = !l.length;
    }

    const sortBtn = (key) => h('button', { 'aria-pressed': String(sort === key), onclick: (e) => {
      sort = key; store.set('bmSort', key);
      e.currentTarget.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === e.currentTarget)));
      render();
    } }, t('bm_sort_' + key));
    const tools = h('div', { class: 'bm-tools' }, countEl, h('span', { class: 'sp' }),
      h('span', { class: 'tlabel' }, t('bm_sort')), h('div', { class: 'seg' }, sortBtn('new'), sortBtn('quran'), sortBtn('weak')));

    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(1) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('bm_sub')), h('h1', {}, t('bm_title'))))),
      h('div', { class: 'wrap' }, h('section', { class: 'sec bm-sec' }, tools, listEl, empty), footer()));
    render();
  }

  /** A short list for the Progress page, or null when nothing is saved. */
  function progressSection() {
    const l = list(); if (!l.length) return null;
    const { h, t, num, store, chapters, sname } = N();
    const CH = chapters(), rc = store.get('rc', {});
    return h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('bm_progress')), h('a', { class: 'link', href: '#/saved' }, t('bm_all'))),
      h('p', { class: 'muted small' }, t('bm_progress_d')),
      h('div', { class: 'row left' }, l.slice(0, 12).map(b => h('a', { class: 'chip ' + scoreClass(rc[b.k]), href: `#/s/${b.s}/${b.v}` },
        `${sname(CH[b.s - 1])} ${num(b.k)}` + (rc[b.k] != null ? ' · ' + num(rc[b.k]) + '%' : '')))));
  }

  window.Bookmarks = { button, view, badge, has, list, progressSection };
})();
