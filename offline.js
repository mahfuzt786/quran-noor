/* Offline & app: registers the service worker, offers to install Noor as an app, shows when the device is
   offline, announces updates, and downloads surah recitations (and word sounds) for use without internet. */
(function () {
  'use strict';
  const N = () => window.Noor;
  const AUDIO = 'noor-audio-1', DATA = 'noor-data-1', DATA_V = '1';
  const WBW = 'https://audio.qurancdn.com/';
  const WORD_BYTES = 28000;     // typical size of one word sound, for estimates
  const pad3 = (n) => String(n).padStart(3, '0');
  const mb = (b) => b >= 1073741824 ? N().num((b / 1073741824).toFixed(b < 10737418240 ? 1 : 0)) + ' GB'
    : N().num((b / 1048576).toFixed(b < 10485760 ? 1 : 0)) + ' MB';
  const reg = () => N().store.get('offline', {});
  const setReg = (r) => N().store.set('offline', r);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* ---------- service worker & updates ---------- */
  let waiting = null, reloading = false;
  const UPD_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>';
  /** A small round icon in the corner; tapping it opens a card with the update button. */
  function showUpdate(w) {
    waiting = w;
    const { h, t } = N();
    document.querySelector('.upd')?.remove();
    const pop = h('div', { class: 'upd-pop', id: 'updPop', role: 'dialog', 'aria-label': t('off_update'), hidden: true },
      h('div', { class: 'upd-pop-h' }, h('span', { class: 'upd-pop-ic', html: UPD_ICON }), h('b', {}, t('off_update'))),
      h('p', { class: 'muted small' }, t('off_update_d')),
      h('div', { class: 'row left' },
        h('button', { class: 'btn sm gold', onclick: () => { reloading = true; waiting.postMessage('skip'); } }, t('off_update_btn')),
        h('button', { class: 'btn sm', onclick: () => toggle(false) }, t('off_later'))));
    const fab = h('button', { class: 'upd-fab', title: t('off_update_icon'), 'aria-label': t('off_update_icon'), 'aria-expanded': 'false', 'aria-controls': 'updPop',
      onclick: (e) => { e.stopPropagation(); toggle(pop.hidden); } }, h('span', { html: UPD_ICON }), h('i', { class: 'upd-dot', 'aria-hidden': 'true' }));
    const box = h('div', { class: 'upd' }, pop, fab);
    function toggle(open) {
      pop.hidden = !open; fab.setAttribute('aria-expanded', String(open)); box.classList.toggle('open', open);
      if (open) pop.querySelector('.btn.gold').focus();
    }
    // tap elsewhere or press Escape to fold it back into the icon
    document.addEventListener('click', (e) => { if (!pop.hidden && !box.contains(e.target)) toggle(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { toggle(false); fab.focus(); } });
    document.body.append(box);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(r => {
        if (r.waiting && navigator.serviceWorker.controller) showUpdate(r.waiting);
        r.addEventListener('updatefound', () => {
          const w = r.installing; if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state !== 'installed') return;
            if (navigator.serviceWorker.controller) showUpdate(w);
            else if (!N().store.get('swReady', false)) { N().store.set('swReady', true); N().toast(N().t('off_ready')); }
          });
        });
      }).catch(() => { /* offline support unavailable: the site still works online */ });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
    });
  }

  /* ---------- online / offline banner ---------- */
  function netBar() {
    let bar = document.getElementById('netbar');
    if (!bar) { bar = N().h('div', { id: 'netbar', role: 'status', hidden: true }); document.querySelector('header')?.after(bar); }
    const off = !navigator.onLine;
    document.documentElement.classList.toggle('is-offline', off);
    bar.textContent = off ? '📴 ' + N().t('off_now') : '';
    bar.hidden = !off;
  }
  window.addEventListener('offline', () => netBar());
  window.addEventListener('online', () => { netBar(); N().toast(N().t('off_back')); });
  window.addEventListener('load', () => { if (window.Noor) netBar(); });

  /* ---------- install ---------- */
  let deferred = null;
  const installListeners = new Set();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; installListeners.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; N().store.set('installed', true); N().toast(N().t('inst_done')); installListeners.forEach(f => f()); });
  const canInstall = () => !standalone() && (!!deferred || isIOS());

  function install() {
    if (deferred) { const d = deferred; deferred = null; d.prompt(); d.userChoice.finally(() => installListeners.forEach(f => f())); return; }
    const { h, t, openModal, closeModal } = N();
    openModal(h('h2', {}, t('inst_t')), h('p', {}, t(isIOS() ? 'inst_ios' : 'inst_manual')),
      h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: closeModal }, t('close'))));
  }

  /** Install card; on the home page it can be dismissed. Re-renders itself when installability changes. */
  function installCard(home) {
    const { h, t, store } = N();
    const box = h('div', { class: 'inst-slot' });
    const draw = () => {
      if (home && (store.get('installHide', 0) > Date.now() || !canInstall())) return box.replaceChildren();
      if (standalone()) return box.replaceChildren(h('p', { class: 'inst-ok' }, t('inst_already')));
      if (!canInstall()) return box.replaceChildren(h('p', { class: 'muted small' }, t('inst_manual')));
      box.replaceChildren(h('div', { class: 'inst-card' + (home ? ' home' : '') },
        h('img', { src: 'icons/icon-192.png', alt: '', width: '52', height: '52' }),
        h('div', { class: 'inst-txt' }, h('b', {}, t('inst_t')), h('span', { class: 'muted' }, t('inst_d'))),
        h('div', { class: 'row left' }, h('button', { class: 'btn sm gold', onclick: install }, t('inst_btn')),
          home ? h('button', { class: 'btn sm', onclick: () => { store.set('installHide', Date.now() + 30 * 864e5); draw(); } }, t('inst_later')) : null)));
    };
    installListeners.add(draw); draw();
    return box;
  }

  /* ---------- downloads ---------- */
  const surahJSON = async (id) => {
    const url = `data/s/${id}.json?v=${DATA_V}`;
    const c = await caches.open(DATA);
    let res = await c.match(url);
    if (!res) { res = await fetch(url); if (!res.ok) throw new Error('data'); await c.put(url, res.clone()); }
    return res.json();
  };
  const wordUrls = (id, raw) => raw.v.flatMap(([n, , , words]) => words.map((_, k) => `${WBW}wbw/${pad3(id)}_${pad3(n)}_${pad3(k + 1)}.mp3`));
  const wordCount = (raw) => raw.v.reduce((a, v) => a + v[3].length, 0);

  async function isKept(id) {
    const r = reg()[id]; if (!r) return false;
    try { const hit = await (await caches.open(AUDIO)).match(r.url); if (hit) return true; } catch { /* no Cache Storage */ }
    const all = reg(); delete all[id]; setReg(all);      // the browser cleared it
    return false;
  }

  let job = null;   // one download at a time: { id, ctrl, onProgress }
  async function download(id, withWords, onProgress) {
    if (job) throw new Error('busy');
    const ctrl = new AbortController(); job = { id, ctrl };
    try {
      navigator.storage?.persist?.().catch(() => { });
      const raw = await surahJSON(id), url = raw.a[0], c = await caches.open(AUDIO);
      const words = withWords ? wordUrls(id, raw) : [];
      const res = await fetch(url, { mode: 'cors', signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error('net');
      const total = +res.headers.get('Content-Length') || 0;
      const est = total + words.length * WORD_BYTES;
      let got = 0;
      const [count, keep] = res.body.tee();
      const put = c.put(url, new Response(keep, { headers: { 'Content-Type': 'audio/mpeg' } }));
      put.catch(() => { });     // a stopped download rejects here too; it is handled below
      const rd = count.getReader();
      for (;;) { const { done, value } = await rd.read(); if (done) break; got += value.length; onProgress && onProgress(got / (est || 1)); }
      await put;
      let wordBytes = 0, n = 0;
      const queue = words.slice();
      const worker = async () => {
        while (queue.length) {
          const u = queue.shift();
          if (ctrl.signal.aborted) throw new DOMException('stopped', 'AbortError');
          if (await c.match(u)) { n++; continue; }
          const r = await fetch(u, { mode: 'cors', signal: ctrl.signal }).catch(e => { if (ctrl.signal.aborted) throw e; return null; });
          if (r && r.ok) { const b = await r.blob(); wordBytes += b.size; await c.put(u, new Response(b, { headers: { 'Content-Type': 'audio/mpeg' } })); }
          n++; onProgress && onProgress((got + n * WORD_BYTES) / (est || 1));
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, words.length) }, worker));
      const all = reg(); all[id] = { url, b: got + wordBytes, w: words.length, t: Date.now() }; setReg(all);
      return all[id];
    } catch (e) {
      await remove(id, true).catch(() => { });
      throw e;
    } finally { job = null; }
  }

  async function remove(id, quiet) {
    const c = await caches.open(AUDIO);
    let url = reg()[id]?.url, raw = null;
    try { raw = await surahJSON(id); url = url || raw.a[0]; } catch { /* text gone too */ }
    if (url) await c.delete(url);
    if (raw) await Promise.all(wordUrls(id, raw).map(u => c.delete(u)));
    const all = reg(); delete all[id]; setReg(all);
    if (!quiet) N().toast(N().t('off_removed'));
  }

  /** "Keep offline" button for the surah page header. */
  function surahButton(id, name) {
    const { h, t } = N();
    const btn = h('button', { class: 'btn glass off-btn', onclick: () => open() }, '⬇ ' + t('off_dl'));
    const paint = (kept) => { btn.classList.toggle('kept', kept); btn.textContent = kept ? '✓ ' + t('off_have') : '⬇ ' + t('off_dl'); };
    isKept(id).then(paint);

    async function open() {
      const { openModal, closeModal, toast } = N();
      const kept = await isKept(id);
      if (!kept && window.Pro && !window.Pro.need('offline')) return;
      if (kept) {
        const r = reg()[id];
        return openModal(h('h2', {}, t('off_have')), h('p', {}, name + ' · ' + mb(r.b) + (r.w ? ' · ' + t('off_words_n', r.w) : '')),
          h('div', { class: 'row' },
            h('button', { class: 'btn danger', onclick: async () => { closeModal(); await remove(id); paint(false); } }, t('off_delete')),
            h('button', { class: 'btn', onclick: closeModal }, t('close'))));
      }
      let raw;
      try { raw = await surahJSON(id); } catch { return toast(t('off_fail')); }
      const sizeEl = h('span', { class: 'muted' }, '…');
      let audioBytes = 0;
      fetch(raw.a[0], { method: 'HEAD', mode: 'cors' }).then(r => { audioBytes = +r.headers.get('Content-Length') || 0; sizeEl.textContent = audioBytes ? t('off_size', mb(audioBytes)) : ''; upd(); }).catch(() => { sizeEl.textContent = ''; });
      const nw = wordCount(raw);
      const wordsBox = h('input', { type: 'checkbox', checked: nw <= 1500 || null, onchange: () => upd() });
      const totalEl = h('p', { class: 'off-total' });
      const upd = () => { const b = audioBytes + (wordsBox.checked ? nw * WORD_BYTES : 0); totalEl.textContent = b ? t('off_total', mb(b)) + (b > 40 * 1048576 ? ' — ' + t('off_wifi') : '') : ''; };
      const bar = h('div', { class: 'off-prog', hidden: true }, h('i'));
      const go = h('button', { class: 'btn gold', onclick: async () => {
        go.disabled = true; wordsBox.disabled = true; bar.hidden = false; stopBtn.hidden = false;
        try {
          await download(id, wordsBox.checked, (p) => { bar.firstChild.style.width = Math.min(100, p * 100).toFixed(1) + '%'; });
          closeModal(); paint(true); toast(t('off_done', name));
        } catch (e) {
          if (e && e.name === 'AbortError') { closeModal(); return; }
          go.disabled = false; wordsBox.disabled = false; bar.hidden = true; stopBtn.hidden = true; toast(t('off_fail'));
        }
      } }, '⬇ ' + t('off_start'));
      const stopBtn = h('button', { class: 'btn', hidden: true, onclick: () => job?.ctrl.abort() }, t('off_cancel'));
      openModal(h('h2', {}, t('off_dl_t', name)), h('p', { class: 'muted' }, t('off_dl_d')),
        h('ul', { class: 'off-opts' },
          h('li', {}, h('label', { class: 'rc-rectog' }, h('input', { type: 'checkbox', checked: true, disabled: true }), t('off_audio'), ' ', sizeEl)),
          h('li', {}, h('label', { class: 'rc-rectog' }, wordsBox, t('off_words'), ' ', h('span', { class: 'muted' }, t('off_size', mb(nw * WORD_BYTES)))))),
        totalEl, bar,
        h('div', { class: 'row' }, go, stopBtn, h('button', { class: 'btn', onclick: () => { job?.ctrl.abort(); closeModal(); } }, t('rc_cancel'))));
      upd();
    }
    return btn;
  }

  /* ---------- Progress page section ---------- */
  async function textsKept() {
    try { const c = await caches.open(DATA); const keys = await c.keys(); return new Set(keys.map(k => (k.url.match(/data\/s\/(\d+)\.json/) || [])[1]).filter(Boolean)).size; } catch { return 0; }
  }

  function section() {
    const { h, t, num, chapters, sname, toast } = N();
    if (!('caches' in window)) return null;
    const CH = chapters();
    const textLine = h('p', { class: 'muted' }, '…');
    const textBtn = h('button', { class: 'btn' }, '⬇ ' + t('off_texts_btn'));
    const textBar = h('div', { class: 'off-prog', hidden: true }, h('i'));
    const refreshTexts = async () => {
      const n = await textsKept();
      textLine.textContent = n >= 114 ? '✓ ' + t('off_texts_done') : t('off_texts', [n, 114]);
      textBtn.hidden = n >= 114;
    };
    textBtn.onclick = async () => {
      if (window.Pro && !window.Pro.need('offline')) return;
      textBtn.disabled = true; textBar.hidden = false;
      const ids = Array.from({ length: 114 }, (_, i) => i + 1); let done = 0, failed = 0;
      const worker = async () => { while (ids.length) { const id = ids.shift(); try { await surahJSON(id); } catch { failed++; } done++; textBar.firstChild.style.width = (done / 114 * 100) + '%'; } };
      await Promise.all(Array.from({ length: 4 }, worker));
      textBtn.disabled = false; textBar.hidden = true;
      if (failed) toast(t('off_fail')); else toast(t('off_texts_done'));
      refreshTexts();
    };

    const list = h('div', { class: 'off-list' });
    const storage = h('p', { class: 'muted small' });
    const refreshList = async () => {
      const r = reg(), ids = Object.keys(r).map(Number).sort((a, b) => a - b);
      const kept = [];
      for (const id of ids) if (await isKept(id)) kept.push(id);
      list.replaceChildren(...(kept.length ? kept.map(id => h('div', { class: 'off-item' },
        h('a', { href: '#/s/' + id }, h('b', {}, sname(CH[id - 1])), ' ', h('span', { class: 'muted' }, num(id))),
        h('span', { class: 'muted small' }, mb(r[id].b) + (r[id].w ? ' · ' + t('off_words_n', r[id].w) : '')),
        h('button', { class: 'btn sm', onclick: async () => { await remove(id); refreshList(); } }, t('off_delete')))) : [h('p', { class: 'muted' }, t('off_list_none'))]));
      try { const e = await navigator.storage.estimate(); if (e && e.quota) storage.textContent = t('off_storage', [mb(e.usage || 0), mb(e.quota)]); } catch { /* not available */ }
    };
    refreshTexts(); refreshList();

    return h('section', { class: 'sec pg-sec off-sec', id: 'offline' },
      h('div', { class: 'sec-title' }, h('h2', {}, '📥 ' + t('off_title')), h('span', {}, t('off_sub'))),
      installCard(false),
      h('div', { class: 'bk-card' },
        h('div', { class: 'bk-col' }, h('h3', {}, t('off_texts_t')), textLine, textBar, h('div', { class: 'row left' }, textBtn)),
        h('div', { class: 'bk-col' }, h('h3', {}, t('off_list_t')), list, storage)));
  }

  window.Offline = { surahButton, section, installCard, isKept, download, remove, canInstall };
})();
