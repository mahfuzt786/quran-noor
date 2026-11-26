/* Sync progress across devices: sign in with Google, then this browser's practice data is merged with the copy
   saved for that account on smahfuzm.in (api/sync.php). Merging is three-way — against the copy both sides last
   agreed on — so changes from either device are kept, and scores only ever go up.
   Screen settings, downloads, recordings and other per-device state stay on each device. */
(function () {
  'use strict';
  const N = () => window.Noor;
  const API = 'api/sync.php';
  const CLIENT_ID = '229303568022-f1ac5svku961mpbs7ovioliavfrfvn71.apps.googleusercontent.com';
  const GSI = 'https://accounts.google.com/gsi/client';

  /* ---------- what is synced, and how each piece merges ---------- */
  const MAX = (a, b) => Math.max(+a || 0, +b || 0);
  const RULES = {
    rc: 'maxmap', write: 'maxmap', listen: 'maxmap', known: 'maxmap',
    pronQuiz: 'max', letterQuiz: 'max', srsInit: 'max',
    log: 'log',
    pron: 'items', prog: 'items', srs: 'items', bm: 'list',
    streak: 'streak', last: 'whole', goal: 'whole', goalMet: 'whole'
  };
  const KEYS = Object.keys(RULES);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const raw = (k) => { try { const v = localStorage.getItem('noor.' + k); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
  const writeRaw = (k, v) => { try { v === undefined ? localStorage.removeItem('noor.' + k) : localStorage.setItem('noor.' + k, JSON.stringify(v)); } catch { /* storage full */ } };
  const snapshot = () => { const o = {}; KEYS.forEach(k => { const v = raw(k); if (v !== undefined) o[k] = v; }); return o; };

  // when both devices changed the same item, keep the more advanced one
  function both(k, l, r) {
    if (l === undefined) return r; if (r === undefined) return l;
    if (k === 'srs') return (l.last || '') > (r.last || '') ? l : (r.last || '') > (l.last || '') ? r : (l.reps >= r.reps ? l : r);
    if (k === 'pron') return { ...(l.n >= r.n ? l : r), ok: MAX(l.ok, r.ok), n: MAX(l.n, r.n) };
    if (k === 'prog') return deepMax(l, r);
    return l;
  }
  function deepMax(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (typeof a === 'boolean' || typeof b === 'boolean') return !!a || !!b;
    if (Array.isArray(a) && Array.isArray(b)) { const seen = new Set(), outA = []; [...a, ...b].forEach(x => { const s = JSON.stringify(x); if (!seen.has(s)) { seen.add(s); outA.push(x); } }); return outA.slice(-30); }
    if (a && b && typeof a === 'object' && typeof b === 'object') { const o = { ...a }; Object.keys(b).forEach(k => { o[k] = k in a ? deepMax(a[k], b[k]) : b[k]; }); return o; }
    return a === undefined ? b : a;
  }
  // per-item three-way merge for objects keyed by id
  function mergeItems(k, b = {}, l = {}, r = {}) {
    const out = {};
    new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]).forEach(id => {
      const bi = b[id], li = l[id], ri = r[id];
      let v;
      if (eq(li, ri)) v = li;
      else if (eq(li, bi)) v = ri;          // only the other device changed it (or deleted it)
      else if (eq(ri, bi)) v = li;          // only this device changed it
      else v = both(k, li, ri);
      if (v !== undefined) out[id] = v;
    });
    return out;
  }
  const byKey = (arr) => { const o = {}; (arr || []).forEach(x => { if (x && x.k) o[x.k] = x; }); return o; };
  function logMerge(l = [], r = []) {
    // the same entry can be on both sides; keep each distinct entry as many times as the side that has it most
    const count = (a) => { const m = new Map(); a.forEach(e => { const s = JSON.stringify(e); m.set(s, (m.get(s) || 0) + 1); }); return m; };
    const cl = count(l), cr = count(r), out = [];
    new Set([...cl.keys(), ...cr.keys()]).forEach(s => { const n = Math.max(cl.get(s) || 0, cr.get(s) || 0); for (let i = 0; i < n; i++) out.push(JSON.parse(s)); });
    return out.sort((a, b) => (a.d || '').localeCompare(b.d || '')).slice(-1500);
  }

  function mergeKey(k, b, l, r) {
    const rule = RULES[k];
    if (rule === 'maxmap') {
      if (l === undefined && r === undefined) return undefined;
      const o = { ...(r || {}) }; Object.keys(l || {}).forEach(x => { o[x] = MAX(l[x], o[x]); });
      if (k === 'listen') { const keep = Object.keys(o).sort().slice(-60), t = {}; keep.forEach(x => (t[x] = o[x])); return t; }
      return o;
    }
    if (rule === 'max') return l === undefined && r === undefined ? undefined : MAX(l, r);
    if (rule === 'log') return l === undefined && r === undefined ? undefined : logMerge(l, r);
    if (rule === 'streak') { if (!l) return r; if (!r) return l; return (l.day || '') > (r.day || '') ? l : (r.day || '') > (l.day || '') ? r : (l.n >= r.n ? l : r); }
    if (rule === 'items') { if (l === undefined && r === undefined) return undefined; return mergeItems(k, b || {}, l || {}, r || {}); }
    if (rule === 'list') {
      if (l === undefined && r === undefined) return undefined;
      const m = mergeItems(k, byKey(b), byKey(l), byKey(r));
      return Object.values(m).sort((x, y) => (y.t || 0) - (x.t || 0));
    }
    // whole value: take whichever side changed; if both did, this device wins
    if (eq(l, r)) return l; if (eq(l, b)) return r; if (eq(r, b)) return l;
    return l === undefined ? r : l;
  }
  function merge(base, local, remote) {
    const out = {};
    KEYS.forEach(k => { const v = mergeKey(k, base[k], local[k], remote[k]); if (v !== undefined) out[k] = v; });
    return out;
  }

  /* ---------- talking to the server ---------- */
  async function api(action, method = 'GET', body) {
    const res = await fetch(`${API}?a=${action}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Noor': '1' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let j = null; try { j = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, j: j || {} };
  }

  /* ---------- state ---------- */
  let user = N().store.get('syncUser', null);       // { email, name, picture } while signed in on this device
  let busy = false, again = false, timer = null, lastErr = '';
  const listeners = new Set();
  const notify = () => listeners.forEach(f => { try { f(); } catch { /* card gone */ } });
  const lastSync = () => N().store.get('syncAt', 0);

  async function sync(quiet) {
    if (!user) return;
    if (busy) { again = true; return; }
    busy = true; lastErr = ''; notify();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const got = await api('data');
        if (got.status === 401) return signedOut(true);
        if (got.status !== 200) throw new Error(got.j.error || 'http ' + got.status);
        const baseDoc = N().store.get('syncBase', null);
        const base = baseDoc && baseDoc.email === user.email ? baseDoc.keys : {};
        const remote = (got.j.data && got.j.data.keys) || {};
        const local = snapshot();
        const merged = merge(base, local, remote);
        let rev = got.j.rev;
        if (!eq(merged, remote)) {
          const put = await api('data', 'PUT', { data: { v: 1, keys: merged }, rev });
          if (put.status === 409) continue;            // another device saved in between: merge again
          if (put.status === 401) return signedOut(true);
          if (put.status !== 200) throw new Error(put.j.error || 'http ' + put.status);
          rev = put.j.rev;
        }
        applyLocal(local, merged);
        N().store.set('syncBase', { email: user.email, rev, keys: merged });
        N().store.set('syncAt', Date.now());
        return;
      }
      throw new Error('busy');
    } catch (e) {
      lastErr = navigator.onLine === false ? 'offline' : (e && e.message) || 'error';
      if (!quiet) N().toast(N().t(lastErr === 'offline' ? 'sy_err_offline' : lastErr === 'storage' ? 'sy_err_storage' : 'sy_err'));
    } finally {
      busy = false; notify();
      if (again) { again = false; schedule(3000); }
    }
  }

  // write merged values into this browser, then let the app re-read what it keeps in memory
  function applyLocal(local, merged) {
    const changed = KEYS.filter(k => !eq(local[k], merged[k]));
    if (!changed.length) return;
    changed.forEach(k => writeRaw(k, merged[k]));
    N().reloadState && N().reloadState();
    if (!/^#\/s\//.test(location.hash) && document.getElementById('modal')?.hidden !== false) window.dispatchEvent(new HashChangeEvent('hashchange'));
    N().toast(N().t('sy_merged'));
  }

  function schedule(ms = 15000) { if (!user) return; clearTimeout(timer); timer = setTimeout(() => sync(true), ms); }

  // any change to synced data schedules a sync shortly after
  const origSet = N().store.set;
  N().store.set = function (k, v) { origSet.call(this, k, v); if (RULES[k]) schedule(); };

  function signedOut(expired) {
    user = null; N().store.set('syncUser', null); N().store.set('syncBase', null);
    notify();
    if (expired) N().toast(N().t('sy_expired'));
  }

  /* ---------- Google sign-in ---------- */
  let gsiP = null;
  function loadGsi() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return gsiP || (gsiP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = GSI; s.async = true; s.onload = res; s.onerror = () => { gsiP = null; rej(new Error('gsi')); };
      document.head.append(s);
    }));
  }
  async function onCredential(resp) {
    const r = await api('login', 'POST', { credential: resp.credential }).catch(() => ({ status: 0, j: {} }));
    if (r.status !== 200) { N().toast(N().t(r.j.error === 'storage' ? 'sy_err_storage' : 'sy_err_login')); return; }
    user = r.j.user; N().store.set('syncUser', user); N().store.set('syncBase', null);
    notify(); N().toast(N().t('sy_signed_in', user.name || user.email));
    sync(false);
  }
  // On the live site Google returns to api/gsi.php by a full-page redirect: popups can be cut off by browser
  // settings, extensions and strict site headers. Elsewhere (local testing) the popup is used.
  const REDIRECT = location.origin === 'https://smahfuzm.in';
  async function renderButton(el) {
    try {
      await loadGsi();
      const opts = { client_id: CLIENT_ID, itp_support: true, context: 'signin' };
      if (REDIRECT) {
        const n = await api('nonce');
        if (n.status !== 200 || !n.j.nonce) throw new Error(n.j.error || 'nonce');
        Object.assign(opts, { ux_mode: 'redirect', login_uri: new URL('api/gsi.php', location.href).href, nonce: n.j.nonce });
      } else Object.assign(opts, { ux_mode: 'popup', callback: onCredential });
      google.accounts.id.initialize(opts);
      const night = document.documentElement.dataset.theme !== 'light';
      el.replaceChildren();
      google.accounts.id.renderButton(el, { type: 'standard', theme: night ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left', locale: N().lang() === 'as' ? 'as' : 'en' });
    } catch {
      el.replaceChildren(N().h('p', { class: 'muted small' }, N().t(navigator.onLine ? 'sy_err_gsi' : 'sy_err_offline')));
    }
  }

  async function signOut() {
    await api('logout', 'POST', {}).catch(() => { });
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* not loaded */ }
    signedOut(false); N().toast(N().t('sy_signed_out'));
  }
  async function deleteRemote() {
    const { h, t, openModal, closeModal } = N();
    openModal(h('h2', {}, t('sy_del_t')), h('p', {}, t('sy_del_d')),
      h('div', { class: 'row' },
        h('button', { class: 'btn danger', onclick: async () => {
          const r = await api('delete', 'POST', {}).catch(() => ({ status: 0 }));
          closeModal();
          if (r.status === 200) { signedOut(false); N().toast(t('sy_deleted')); } else N().toast(t('sy_err'));
        } }, t('sy_del_ok')),
        h('button', { class: 'btn', onclick: closeModal }, t('rc_cancel'))));
  }

  /* ---------- Progress page card ---------- */
  function ago(ms) {
    const { t } = N(); if (!ms) return t('sy_never');
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? t('sy_just_now') : m < 60 ? t('sy_min_ago', m) : m < 1440 ? t('sy_hr_ago', Math.round(m / 60)) : t('sy_day_ago', Math.round(m / 1440));
  }
  function section() {
    const { h, t } = N();
    const box = h('div', { class: 'sy-card' });
    const draw = () => {
      if (!box.isConnected && box.dataset.drawn) { listeners.delete(draw); return; }   // the page was left
      box.dataset.drawn = '1';
      if (!user) {
        const btn = h('div', { class: 'sy-gbtn' }, h('span', { class: 'muted small' }, '…'));
        box.replaceChildren(
          h('div', { class: 'sy-txt' }, h('h3', {}, t('sy_out_t')), h('p', { class: 'muted' }, t('sy_out_d'))),
          btn,
          h('p', { class: 'muted small' }, t('sy_privacy'), ' ', h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, t('sy_privacy_link'))));
        renderButton(btn);
        return;
      }
      const status = busy ? t('sy_busy') : lastErr ? t(lastErr === 'offline' ? 'sy_err_offline' : lastErr === 'storage' ? 'sy_err_storage' : 'sy_err') : t('sy_last', ago(lastSync()));
      box.replaceChildren(
        h('div', { class: 'sy-who' },
          user.picture ? h('img', { src: user.picture, alt: '', width: '44', height: '44', referrerpolicy: 'no-referrer' }) : h('span', { class: 'sy-av' }, (user.name || user.email || '?')[0]),
          h('div', {}, h('b', {}, user.name || user.email), h('span', { class: 'muted small' }, user.email))),
        h('p', { class: 'sy-status' + (lastErr ? ' err' : '') }, (busy ? '⟳ ' : lastErr ? '⚠ ' : '☁ ') + status),
        h('p', { class: 'muted small' }, t('sy_in_d')),
        h('div', { class: 'row left' },
          h('button', { class: 'btn sm gold', disabled: busy || null, onclick: () => sync(false) }, t('sy_now')),
          h('button', { class: 'btn sm', onclick: signOut }, t('sy_out')),
          h('button', { class: 'btn sm', onclick: deleteRemote }, t('sy_del'))));
    };
    listeners.add(draw); draw();
    return h('section', { class: 'sec pg-sec sy-sec', id: 'sync' },
      h('div', { class: 'sec-title' }, h('h2', {}, '☁ ' + t('sy_title')), h('span', {}, t('sy_sub'))), box);
  }

  /* ---------- when to sync ---------- */
  // back from Google's redirect sign-in: the server has started a session, so ask who it is
  async function returnFromGoogle() {
    const u = new URL(location.href), r = u.searchParams.get('signin');
    if (!r) return false;
    u.searchParams.delete('signin'); history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    if (r !== 'ok') { N().toast(N().t('sy_err_login')); return true; }
    const me = await api('me').catch(() => null);
    if (!me || me.status !== 200) { N().toast(N().t('sy_err_login')); return true; }
    user = me.j.user; N().store.set('syncUser', user); N().store.set('syncBase', null);
    notify(); N().toast(N().t('sy_signed_in', user.name || user.email));
    sync(false);
    return true;
  }

  async function start() {
    if (await returnFromGoogle()) return;
    if (!user) return;
    const me = await api('me').catch(() => null);
    if (!me) return;                                   // offline: try again when back online
    if (me.status === 401) return signedOut(true);
    if (me.status === 200) { user = me.j.user; N().store.set('syncUser', user); }
    sync(true);
  }
  window.addEventListener('online', () => schedule(2000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSync() > 5 * 60000) schedule(1000);
    if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); sync(true); }
  });
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);

  window.Sync = { section, sync, merge, signedIn: () => !!user, user: () => user, _test: { merge, mergeKey } };
})();
