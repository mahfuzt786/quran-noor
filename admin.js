/* Admin page (#/admin): give emails full access without payment, and see the payments received.
   Only accounts in the server's admin_emails list can load or change anything; the page itself is harmless. */
(function () {
  'use strict';
  const N = () => window.Noor;
  const api = (action, method = 'GET', body) => fetch(`api/sync.php?a=${action}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Noor': '1' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).then(async r => ({ status: r.status, j: await r.json().catch(() => ({})) }));

  const day = (s) => { if (!s) return '—'; const d = new Date(s * 1000); return N().num(d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()); };
  const money = (amount, cur) => (cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur + ' ') + N().num((amount / 100).toFixed(amount % 100 ? 2 : 0));

  function view(app) {
    const { h, t, footer, openModal, closeModal, toast } = N();
    const body = h('div', { class: 'ad-body' }, h('div', { class: 'skeleton' }));
    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(67) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('ad_sub')), h('h1', {}, '⚙ ' + t('ad_title'))))),
      h('div', { class: 'wrap' }, h('section', { class: 'sec' }, body), footer()));

    async function load(after) {
      const r = await api('admin').catch(() => ({ status: 0, j: {} }));
      if (r.status === 401) return body.replaceChildren(h('div', { class: 'endcard' }, h('p', {}, t('ad_signin')), h('a', { class: 'btn gold', href: '#/progress' }, t('sy_title'))));
      if (r.status === 403) return body.replaceChildren(h('div', { class: 'endcard' }, h('p', {}, t('ad_denied'))));
      if (r.status !== 200) return body.replaceChildren(h('div', { class: 'err' }, t('sy_err')));
      draw(r.j); after && after();
    }

    function draw(d) {
      const email = h('input', { class: 'bm-note', type: 'email', placeholder: t('ad_email_ph'), autocomplete: 'off', 'aria-label': t('ad_email_ph') });
      const note = h('input', { class: 'bm-note', placeholder: t('ad_note_ph'), maxlength: '120', 'aria-label': t('ad_note_ph') });
      const msg = h('p', { class: 'muted small' });
      const add = h('button', { class: 'btn gold', onclick: async () => {
        const e = email.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { msg.textContent = t('ad_bad_email'); email.focus(); return; }
        add.disabled = true;
        const r = await api('admin_add', 'POST', { email: e, note: note.value.trim() }).catch(() => ({ status: 0 }));
        add.disabled = false;
        if (r.status === 200) { toast(t('ad_added', e)); draw(r.j); } else msg.textContent = t('sy_err');
      } }, t('ad_add'));
      email.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') add.click(); });
      note.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') add.click(); });

      const remove = (g) => openModal(h('h2', {}, t('ad_remove_t')), h('p', {}, t('ad_remove_d', g.email)),
        h('div', { class: 'row' },
          h('button', { class: 'btn danger', onclick: async () => {
            const r = await api('admin_remove', 'POST', { email: g.email }).catch(() => ({ status: 0 }));
            closeModal();
            if (r.status === 200) { toast(t('ad_removed', g.email)); draw(r.j); } else toast(t('sy_err'));
          } }, t('ad_remove')),
          h('button', { class: 'btn', onclick: closeModal }, t('rc_cancel'))));

      const grants = d.grants || [], pays = d.payments || [];
      const paid = pays.filter(p => p.status === 'captured');
      body.replaceChildren(
        h('div', { class: 'stats ad-stats' },
          [[grants.length, t('ad_s_free')], [paid.length, t('ad_s_paid')], [d.counts?.users ?? 0, t('ad_s_users')]]
            .map(([b, s]) => h('div', { class: 'stat' }, h('b', {}, N().num(b)), h('span', {}, s)))),

        h('h2', { class: 'subh' }, t('ad_free_t')),
        h('p', { class: 'muted small' }, t('ad_free_d')),
        h('div', { class: 'ad-add' }, email, note, add), msg,
        grants.length
          ? h('div', { class: 'pg-tablewrap' }, h('table', { class: 'pg-rows' },
              h('thead', {}, h('tr', {}, [t('ad_c_email'), t('ad_c_note'), t('ad_c_added'), t('ad_c_seen'), ''].map(x => h('th', {}, x)))),
              h('tbody', {}, grants.map(g => h('tr', {},
                h('td', {}, h('b', {}, g.email)), h('td', {}, g.note || '—'), h('td', {}, day(g.created)),
                h('td', {}, g.seen ? '✓ ' + day(g.seen) : t('ad_not_yet')),
                h('td', {}, h('button', { class: 'btn sm', onclick: () => remove(g) }, t('ad_remove'))))))))
          : h('p', { class: 'muted' }, t('ad_free_none')),

        h('h2', { class: 'subh' }, t('ad_pay_t')),
        pays.length
          ? h('div', { class: 'pg-tablewrap' }, h('table', { class: 'pg-rows' },
              h('thead', {}, h('tr', {}, [t('ad_c_date'), t('ad_c_email'), t('ad_c_amount'), t('ad_c_status'), t('ad_c_account'), t('ad_c_id')].map(x => h('th', {}, x)))),
              h('tbody', {}, pays.map(p => h('tr', {},
                h('td', {}, day(p.created)), h('td', {}, p.email || '—'), h('td', {}, money(+p.amount, p.currency)),
                h('td', {}, p.status === 'captured' ? '✓ ' + t('ad_paid') : t('ad_refunded')),
                h('td', {}, p.account || t('ad_unlinked')), h('td', {}, h('code', {}, p.id)))))))
          : h('p', { class: 'muted' }, t('ad_pay_none')));
    }
    load();
  }

  window.Admin = { view };
})();
