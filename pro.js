/* Full access: Recite & check, Memorisation and Smart review of verses are free for Al-Fatiha and the 10
   shortest surahs, and the first 4 chapters of Learn to read are free. A one-time payment (₹49 / $2.99 on
   Razorpay Payment Pages) unlocks all of that plus offline downloads, backup files and sync across devices.
   Reading, listening and meanings stay free. The payment is tied to the Google account (api/pay.php + sync.php). */
(function () {
  'use strict';
  const N = () => window.Noor;
  const FREE = new Set([1, 97, 103, 105, 106, 108, 110, 111, 112, 113, 114]);
  const PAGES = { INR: 'https://pages.razorpay.com/noor-full-access-inr', USD: 'https://pages.razorpay.com/noor-full-access-usd' };
  const PRICE = { INR: '₹49', USD: '$2.99' };

  const has = () => !!(N().store.get('syncUser', null) && N().store.get('syncPro', false));
  // nothing is locked until payments are set up on the server (Razorpay webhook secret in place)
  const ready = () => N().store.get('payReady', false);
  const allowed = (surahId) => !ready() || FREE.has(+surahId) || has();
  const unlocked = () => !ready() || has();
  const LEARN_FREE = 4;   // Learn to read chapters 1-4 are free, 5-8 need full access
  fetch('api/sync.php?a=paywall', { cache: 'no-store', credentials: 'same-origin' })
    .then(r => r.ok ? r.json() : null).then(j => { if (j && typeof j.ready === 'boolean' && j.ready !== N().store.get('payReady', false)) { N().store.set('payReady', j.ready); changed(); } }).catch(() => { });
  const defaultCurrency = () => {
    try { if (/^Asia\/(Kolkata|Calcutta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) return 'INR'; } catch { /* ignore */ }
    return /-IN$/i.test(navigator.language || '') ? 'INR' : (N().lang() === 'as' ? 'INR' : 'USD');
  };

  const api = (action, method = 'GET', body) => fetch(`api/sync.php?a=${action}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Noor': '1' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async r => ({ status: r.status, j: await r.json().catch(() => ({})) }));

  function setUser(u) {
    if (!u) return;
    const was = has();
    N().store.set('syncUser', u); N().store.set('syncPro', !!u.pro);
    if (!was && u.pro) {
      N().toast(N().t('pr_unlocked')); setTimeout(() => window.Sync?.sync(true), 500);
      if (/^#\/learn/.test(location.hash)) setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 0);   // unlock chapters 5-8 now
    }
    changed();
  }
  const changed = () => { listeners.forEach(f => { try { f(); } catch { /* gone */ } }); bar(); };
  const listeners = new Set();

  /** The unlock box (used in the prompt and on the Progress page). */
  function offerBox(opts = {}) {
    const { h, t, store } = N();
    const box = h('div', { class: 'pr-box' });
    let cur = store.get('prCurrency', defaultCurrency());
    const draw = () => {
      if (!box.isConnected && box.dataset.drawn) { listeners.delete(draw); return; }
      box.dataset.drawn = '1';
      if (has()) { box.replaceChildren(h('p', { class: 'pr-have' }, '✓ ' + t('pr_have'))); return; }
      const user = store.get('syncUser', null);
      const seg = h('div', { class: 'seg pr-cur' }, ['INR', 'USD'].map(c => h('button', { 'aria-pressed': String(cur === c), onclick: () => { cur = c; store.set('prCurrency', c); draw(); } }, t(c === 'INR' ? 'pr_inr' : 'pr_usd'))));
      const claimIn = h('input', { class: 'bm-note pr-claim-in', placeholder: t('pr_claim_ph'), autocomplete: 'off', spellcheck: 'false' });
      const claimMsg = h('p', { class: 'muted small' });
      const claim = h('button', { class: 'btn sm', onclick: async () => {
        const id = claimIn.value.trim();
        if (!/^pay_[A-Za-z0-9]{8,30}$/.test(id)) { claimMsg.textContent = t('pr_claim_bad'); return; }
        claim.disabled = true;
        const r = await api('claim', 'POST', { payment_id: id }).catch(() => ({ status: 0, j: {} }));
        claim.disabled = false;
        if (r.status === 200) { setUser(r.j.user); draw(); return; }
        claimMsg.textContent = t(r.j.error === 'unknown' ? 'pr_claim_unknown' : r.j.error === 'taken' ? 'pr_claim_taken' : r.j.error === 'refunded' ? 'pr_refunded' : r.j.error === 'payment_id' ? 'pr_claim_bad' : 'sy_err');
      } }, t('pr_claim_btn'));
      box.replaceChildren(...[
        h('p', {}, t('pr_includes')),
        h('p', { class: 'muted small' }, t('pr_free_list')),
        seg,
        user
          ? h('div', { class: 'pr-pay' },
              h('a', { class: 'btn gold', href: PAGES[cur] + '?email=' + encodeURIComponent(user.email || ''), rel: 'noopener', onclick: () => store.set('prPending', Date.now()) }, t('pr_pay', PRICE[cur])),
              h('p', { class: 'muted small' }, t('pr_email_note', user.email || '')))
          : h('div', { class: 'pr-pay' }, h('p', {}, t('pr_signin_first')), h('div', { class: 'pr-gbtn' }), opts.inModal ? null : null),
        h('p', { class: 'muted small' }, t('pr_once'), ' · ', h('a', { href: 'terms.html' }, t('pr_terms'))),
        user ? h('details', { class: 'pr-claim' }, h('summary', {}, t('pr_claim_t')), h('div', { class: 'row left' }, claimIn, claim), claimMsg) : null].filter(Boolean));
      if (!user) { const g = box.querySelector('.pr-gbtn'); window.Sync?.renderButton ? window.Sync.renderButton(g) : g.replaceChildren(h('a', { class: 'btn', href: '#/progress' }, t('sy_title'))); }
    };
    listeners.add(draw); draw();
    return box;
  }

  /** Shown when a locked tool is opened. kind says what was tried: tools (default), learn, offline, backup, sync. */
  function offer(kind) {
    const { h, t, openModal } = N();
    const k = ['learn', 'offline', 'backup', 'sync'].includes(kind) ? kind : 'tools';
    openModal(h('h2', {}, '🔓 ' + t('pr_locked_t')), h('p', {}, t('pr_need_' + k)), offerBox({ inModal: true }));
  }
  /** true if the tool may be used for this surah; otherwise shows the offer and returns false. */
  function gate(surahId) { if (allowed(surahId)) return true; offer(); return false; }
  /** true if full access is there (or payments are not switched on); otherwise shows the offer for `kind`. */
  function need(kind) { if (unlocked()) return true; offer(kind); return false; }

  /* ---------- the account bar under the header, on every page ---------- */
  const G_LOGO = '<svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  function signInModal() {
    const { h, t, openModal } = N();
    const g = h('div', { class: 'pr-gbtn' }, h('span', { class: 'muted small' }, '…'));
    openModal(h('h2', {}, t('ac_signin_t')), h('p', {}, t('ac_signin_d')), g,
      h('p', { class: 'muted small' }, t('sy_privacy'), ' ', h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, t('sy_privacy_link'))));
    window.Sync?.renderButton ? window.Sync.renderButton(g) : g.replaceChildren(h('a', { class: 'btn', href: '#/progress' }, t('sy_title')));
  }
  function bar() {
    const el = document.getElementById('acct'), Nn = window.Noor;
    if (!el || !Nn || !Nn.h) return;
    const { h, t, store } = Nn;
    const user = store.get('syncUser', null), pro = has(), paywall = ready();
    const first = user ? String(user.name || user.email || '').split(/[\s@]/)[0] : '';
    const who = user
      ? h('a', { class: 'acct-who', href: '#/progress', title: user.email || '' },
          user.picture ? h('img', { src: user.picture, alt: '', width: '26', height: '26', referrerpolicy: 'no-referrer' }) : h('span', { class: 'acct-av' }, (first || '?')[0].toUpperCase()),
          h('span', { class: 'acct-name' }, first))
      : h('button', { class: 'acct-signin', onclick: signInModal }, h('span', { class: 'acct-g', html: G_LOGO }), t('ac_signin'));
    let st, act = null;
    if (pro) st = h('span', { class: 'acct-st ok' }, '✓ ' + t('ac_full'));
    else if (paywall) {
      st = h('span', { class: 'acct-st' }, h('b', {}, t('ac_free')), h('span', { class: 'acct-more' }, ' · ' + t('ac_free_d')));
      act = h('button', { class: 'btn sm gold acct-unlock', onclick: () => offer() }, '🔓 ' + t('ac_unlock', PRICE[store.get('prCurrency', defaultCurrency())]));
    } else st = h('span', { class: 'acct-st' }, user ? t('ac_synced_d') : t('ac_out_d'));
    if (pro || !paywall) {
      const s = window.Sync?.state ? window.Sync.state() : null;
      if (user && s) act = h('a', { class: 'acct-sync' + (s.err ? ' err' : ''), href: '#/progress', title: t('sy_title') }, s.busy ? '⟳ ' + t('sy_busy') : s.err ? '⚠ ' + t('sy_title') : '☁ ' + t('ac_synced'));
    }
    el.replaceChildren(h('div', { class: 'acct-in' }, who, st, h('span', { class: 'sp' }), act));
    el.hidden = false;
    el.classList.toggle('pro', pro);
  }
  window.addEventListener('hashchange', () => setTimeout(bar, 0));
  if (document.readyState === 'complete') setTimeout(bar, 0); else window.addEventListener('load', () => setTimeout(bar, 0));

  /** Progress page section. */
  function section() {
    const { h, t } = N();
    return h('section', { class: 'sec pg-sec pr-sec', id: 'full-access' },
      h('div', { class: 'sec-title' }, h('h2', {}, (has() ? '✓ ' : '🔓 ') + t('pr_title')), h('span', {}, t('pr_sub'))),
      h('div', { class: 'sy-card' }, offerBox()));
  }

  /** A locked card for smart review. */
  function lockedCard(onSkip) {
    const { h, t } = N();
    return h('article', { class: 'rv-card' }, h('p', {}, '🔒 ' + t('pr_locked_d')),
      h('div', { class: 'row left' }, h('button', { class: 'btn sm gold', onclick: offer }, t('pr_title') + ' →'), h('button', { class: 'btn sm', onclick: onSkip }, t('pr_skip'))));
  }

  /* back from the Razorpay page (?paid=1, plus razorpay_payment_id=… that Razorpay adds): open Progress,
     then wait for the webhook to confirm — claiming by the payment ID as well, in case the emails differ */
  async function returnFromPayment() {
    const u = new URL(location.href);
    if (!u.searchParams.has('paid') && !u.searchParams.has('razorpay_payment_id')) return;
    const pid = u.searchParams.get('razorpay_payment_id') || '';
    [...u.searchParams.keys()].filter(k => k === 'paid' || k.startsWith('razorpay_')).forEach(k => u.searchParams.delete(k));
    history.replaceState(history.state, '', u.pathname + u.search + (u.hash && u.hash !== '#/' ? u.hash : '#/progress'));
    if (location.hash === '#/progress') window.dispatchEvent(new HashChangeEvent('hashchange'));
    if (!N().store.get('syncUser', null)) return;
    N().toast(N().t('pr_waiting'));
    for (let i = 0; i < 30; i++) {
      const r = await api('me').catch(() => null);
      if (r && r.status === 200) { setUser(r.j.user); if (r.j.user.pro) return; }
      if (/^pay_[A-Za-z0-9]{8,30}$/.test(pid)) {
        const c = await api('claim', 'POST', { payment_id: pid }).catch(() => null);
        if (c && c.status === 200) { setUser(c.j.user); if (c.j.user.pro) return; }
      }
      await new Promise(res => setTimeout(res, 3000));
    }
    N().toast(N().t('pr_wait_long'));
  }
  if (document.readyState === 'complete') returnFromPayment(); else window.addEventListener('load', returnFromPayment);

  window.Pro = { FREE, LEARN_FREE, has, allowed, unlocked, ready, gate, need, offer, section, lockedCard, setUser, offerBox, bar, onChange: (f) => listeners.add(f) };
})();
