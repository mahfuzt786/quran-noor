/* Full access: Recite & check, Memorisation and Smart review of verses are free for Al-Fatiha and the 10
   shortest surahs; a one-time payment (₹49 / $2.99 on Razorpay Payment Pages) unlocks them for all 114.
   Everything else stays free. The payment is tied to the Google account (api/pay.php + sync.php). */
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
  fetch('api/sync.php?a=paywall', { cache: 'no-store', credentials: 'same-origin' })
    .then(r => r.ok ? r.json() : null).then(j => { if (j && typeof j.ready === 'boolean') N().store.set('payReady', j.ready); }).catch(() => { });
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
    if (!was && u.pro) N().toast(N().t('pr_unlocked'));
    listeners.forEach(f => { try { f(); } catch { /* gone */ } });
  }
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
      box.replaceChildren(
        h('p', {}, t('pr_includes')),
        h('p', { class: 'muted small' }, t('pr_free_list')),
        seg,
        user
          ? h('div', { class: 'pr-pay' },
              h('a', { class: 'btn gold', href: PAGES[cur] + '?email=' + encodeURIComponent(user.email || ''), rel: 'noopener', onclick: () => store.set('prPending', Date.now()) }, t('pr_pay', PRICE[cur])),
              h('p', { class: 'muted small' }, t('pr_email_note', user.email || '')))
          : h('div', { class: 'pr-pay' }, h('p', {}, t('pr_signin_first')), h('div', { class: 'pr-gbtn' }), opts.inModal ? null : null),
        h('p', { class: 'muted small' }, t('pr_once'), ' · ', h('a', { href: 'terms.html' }, t('pr_terms'))),
        user ? h('details', { class: 'pr-claim' }, h('summary', {}, t('pr_claim_t')), h('div', { class: 'row left' }, claimIn, claim), claimMsg) : null);
      if (!user) { const g = box.querySelector('.pr-gbtn'); window.Sync?.renderButton ? window.Sync.renderButton(g) : g.replaceChildren(h('a', { class: 'btn', href: '#/progress' }, t('sy_title'))); }
    };
    listeners.add(draw); draw();
    return box;
  }

  /** Shown when a locked tool is opened. */
  function offer() {
    const { h, t, openModal } = N();
    openModal(h('h2', {}, '🔓 ' + t('pr_locked_t')), h('p', {}, t('pr_locked_d')), offerBox({ inModal: true }));
  }
  /** true if the tool may be used for this surah; otherwise shows the offer and returns false. */
  function gate(surahId) { if (allowed(surahId)) return true; offer(); return false; }

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

  /* back from the Razorpay page (?paid=1): wait for the webhook to confirm */
  async function returnFromPayment() {
    const u = new URL(location.href);
    if (!u.searchParams.has('paid')) return;
    u.searchParams.delete('paid'); history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    if (!N().store.get('syncUser', null)) return;
    N().toast(N().t('pr_waiting'));
    for (let i = 0; i < 30; i++) {
      const r = await api('me').catch(() => null);
      if (r && r.status === 200) { setUser(r.j.user); if (r.j.user.pro) return; }
      await new Promise(res => setTimeout(res, 3000));
    }
    N().toast(N().t('pr_wait_long'));
  }
  if (document.readyState === 'complete') returnFromPayment(); else window.addEventListener('load', returnFromPayment);

  window.Pro = { FREE, has, allowed, ready, gate, offer, section, lockedCard, setUser, offerBox };
})();
