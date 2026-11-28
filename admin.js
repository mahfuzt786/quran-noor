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
  const when = (s) => {
    if (!s) return '—';
    const m = Math.floor((Date.now() / 1000 - s) / 60);
    if (m < 2) return window.Noor.t('ad_now');
    if (m < 60) return window.Noor.t('ad_mins', window.Noor.num(m));
    if (m < 1440) return window.Noor.t('ad_hours', window.Noor.num(Math.floor(m / 60)));
    return day(s);
  };
  const money = (amount, cur) => (cur === 'INR' ? '₹' : cur === 'USD' ? '$' : cur + ' ') + N().num((amount / 100).toFixed(amount % 100 ? 2 : 0));

  const PER_PAGE = 15;
  /* CSV download. Plain digits and ISO dates so spreadsheets read it; a BOM so Excel keeps the Assamese/Unicode;
     cells that start like a formula get a leading ' so a spreadsheet will not run them. */
  const iso = (s) => s ? new Date(s * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '';
  function downloadCsv(name, cols, rows) {
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.map(c => cell(c[0])).join(','), ...rows.map(r => cols.map(c => cell(c[1](r))).join(','))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `noor-${name}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* A table with a search box and an Export CSV button above it and page buttons below, 15 rows per page.
     text(row) is what the search looks in; row(r) builds one <tr>; csv = {name, cols: [[heading, value(row)]]}.
     Export takes every row that matches the search, not just the page on screen. */
  function paged(rows, heads, text, row, placeholder, csv) {
    const { h, t } = N();
    let q = '', page = 0, hits = rows;
    const input = h('input', { class: 'bm-note noor-adm-search', type: 'search', placeholder, 'aria-label': placeholder });
    const exp = h('button', { class: 'btn sm', title: t('ad_csv_d'), onclick: () => downloadCsv(csv.name, csv.cols, hits) }, '⬇ ' + t('ad_csv'));
    const tbody = h('tbody'), info = h('span', { class: 'muted small' });
    const prev = h('button', { class: 'btn sm', 'aria-label': t('ad_prev') }, '‹ ' + t('ad_prev'));
    const next = h('button', { class: 'btn sm', 'aria-label': t('ad_next') }, t('ad_next') + ' ›');
    const nums = h('span', { class: 'noor-adm-nums' });
    const empty = h('p', { class: 'muted', hidden: true }, t('ad_no_match'));
    const wrap = h('div', { class: 'pg-tablewrap' }, h('table', { class: 'pg-rows' }, h('thead', {}, h('tr', {}, heads.map(x => h('th', {}, x)))), tbody));
    const pager = h('div', { class: 'noor-adm-pager' }, info, h('span', { class: 'noor-adm-pbtns' }, prev, nums, next));
    function draw() {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      hits = words.length ? rows.filter(r => { const s = text(r).toLowerCase(); return words.every(w => s.includes(w)); }) : rows;
      const pages = Math.max(1, Math.ceil(hits.length / PER_PAGE));
      page = Math.min(page, pages - 1);
      const from = page * PER_PAGE, shown = hits.slice(from, from + PER_PAGE);
      tbody.replaceChildren(...shown.map(row));
      wrap.hidden = !shown.length; empty.hidden = !!shown.length;
      info.textContent = hits.length ? t('ad_showing', N().num(from + 1), N().num(from + shown.length), N().num(hits.length)) : '';
      prev.disabled = page === 0; next.disabled = page >= pages - 1;
      // page numbers: first, last, and the two either side of the current one
      const want = [...new Set([0, pages - 1, page - 1, page, page + 1])].filter(i => i >= 0 && i < pages).sort((a, b) => a - b);
      const parts = [];
      want.forEach((i, k) => {
        if (k && i - want[k - 1] > 1) parts.push(h('span', { class: 'muted' }, '…'));
        parts.push(h('button', { class: 'btn sm' + (i === page ? ' gold' : ''), 'aria-current': i === page ? 'page' : null, onclick: () => { page = i; draw(); } }, N().num(i + 1)));
      });
      nums.replaceChildren(...parts);
      pager.hidden = pages < 2 && !words.length;
      exp.disabled = !hits.length;
    }
    prev.onclick = () => { page--; draw(); };
    next.onclick = () => { page++; draw(); };
    input.addEventListener('input', () => { q = input.value; page = 0; draw(); });
    draw();
    return h('div', { class: 'noor-adm-paged' }, h('div', { class: 'noor-adm-tools' }, input, exp), wrap, empty, pager);
  }

  function view(app) {
    const { h, t, footer, openModal, closeModal, toast } = N();
    const body = h('div', { class: 'noor-adm-body' }, h('div', { class: 'skeleton' }));
    let tab = 'users';
    try { tab = localStorage.getItem('noor.adminTab') || 'users'; } catch (e) { /* private mode */ }
    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(67) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('ad_sub')), h('h1', {}, '⚙ ' + t('ad_title'))))),
      h('div', { class: 'wrap' }, h('section', { class: 'sec' }, body), footer()));

    async function load(after) {
      const r = await api('admin').catch(() => ({ status: 0, j: {} }));
      if (r.status === 401) return body.replaceChildren(h('div', { class: 'endcard' }, h('p', {}, t('ad_signin')), h('a', { class: 'btn gold', href: '#/home/sync' }, t('sy_title'))));
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

      const grants = d.grants || [], pays = d.payments || [], users = d.users || [];
      const paid = pays.filter(p => p.status === 'captured');
      const access = (u) => +u.paid ? '✓ ' + t('ad_paid') : +u.granted ? '✓ ' + t('ad_free') : t('ad_free_part');
      const status = (p) => p.status === 'captured' ? '✓ ' + t('ad_paid') : t('ad_refunded');
      body.replaceChildren(
        h('div', { class: 'stats noor-adm-stats' },
          [[grants.length, t('ad_s_free')], [paid.length, t('ad_s_paid')], [d.counts?.users ?? 0, t('ad_s_users')]]
            .map(([b, s]) => h('div', { class: 'stat' }, h('b', {}, N().num(b)), h('span', {}, s)))),

        h('h2', { class: 'subh' }, t('ad_free_t')),
        h('p', { class: 'muted small' }, t('ad_free_d')),
        h('div', { class: 'noor-adm-add' }, email, note, add), msg,
        grants.length
          ? h('div', { class: 'pg-tablewrap' }, h('table', { class: 'pg-rows' },
              h('thead', {}, h('tr', {}, [t('ad_c_email'), t('ad_c_note'), t('ad_c_added'), t('ad_c_seen'), ''].map(x => h('th', {}, x)))),
              h('tbody', {}, grants.map(g => h('tr', {},
                h('td', {}, h('b', {}, g.email)), h('td', {}, g.note || '—'), h('td', {}, day(g.created)),
                h('td', {}, g.seen ? '✓ ' + day(g.seen) : t('ad_not_yet')),
                h('td', {}, h('button', { class: 'btn sm', onclick: () => remove(g) }, t('ad_remove'))))))))
          : h('p', { class: 'muted' }, t('ad_free_none')),

        tabs([
          ['users', t('ad_users_t'), users.length, () => [
        h('p', { class: 'muted small' }, t('ad_users_d')),
        users.length
          ? paged(users, [t('ad_c_email'), t('ad_c_name'), t('ad_c_first'), t('ad_c_last'), t('ad_c_access'), t('ad_c_synced')],
              u => [u.email, u.name, access(u)].join(' '),
              u => h('tr', {},
                h('td', {}, h('b', {}, u.email || '—')), h('td', {}, u.name || '—'),
                h('td', {}, day(u.created)), h('td', {}, when(u.seen)),
                h('td', {}, access(u)),
                h('td', {}, u.synced ? day(u.synced) : '—')),
              t('ad_search_users'),
              { name: 'accounts', cols: [['email', u => u.email], ['name', u => u.name], ['first_sign_in', u => iso(u.created)], ['last_active', u => iso(u.seen)],
                ['access', u => +u.paid ? 'paid' : +u.granted ? 'free (granted)' : 'free part only'], ['progress_saved', u => iso(u.synced)]] })
          : h('p', { class: 'muted' }, t('ad_users_none'))]],

          ['payments', t('ad_pay_t'), pays.length, () => [
        pays.length
          ? paged(pays, [t('ad_c_date'), t('ad_c_email'), t('ad_c_amount'), t('ad_c_status'), t('ad_c_account'), t('ad_c_id')],
              p => [p.email, p.account, p.id, p.currency, money(+p.amount, p.currency), status(p), day(p.created)].join(' '),
              p => h('tr', {},
                h('td', {}, day(p.created)), h('td', {}, p.email || '—'), h('td', {}, money(+p.amount, p.currency)),
                h('td', {}, status(p)),
                h('td', {}, p.account || t('ad_unlinked')), h('td', {}, h('code', {}, p.id))),
              t('ad_search_pays'),
              { name: 'payments', cols: [['date', p => iso(p.created)], ['email', p => p.email], ['amount', p => (p.amount / 100).toFixed(2)], ['currency', p => p.currency],
                ['status', p => p.status === 'captured' ? 'paid' : 'refunded'], ['unlocks_account', p => p.account || ''], ['payment_id', p => p.id]] })
          : h('p', { class: 'muted' }, t('ad_pay_none'))]]]));
    }

    /* Tabs: [key, label, count, build()]. The chosen tab stays chosen when the page redraws after an add or remove. */
    function tabs(list) {
      const panel = h('div', { class: 'noor-adm-panel', role: 'tabpanel' });
      const btns = list.map(([key, label, count]) => h('button', {
        class: 'noor-adm-tab', role: 'tab', id: 'adm-tab-' + key, onclick: () => pick(key),
        onkeydown: (ev) => {
          if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
          const i = list.findIndex(x => x[0] === key), j = (i + (ev.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length;
          pick(list[j][0]); btns[j].focus();
        }
      }, label, h('span', { class: 'noor-adm-count' }, N().num(count))));
      function pick(key) {
        if (!list.some(x => x[0] === key)) key = list[0][0];
        tab = key; try { localStorage.setItem('noor.adminTab', key); } catch (e) { /* private mode */ }
        list.forEach(([k], i) => { btns[i].setAttribute('aria-selected', k === key); btns[i].tabIndex = k === key ? 0 : -1; });
        panel.setAttribute('aria-labelledby', 'adm-tab-' + key);
        panel.replaceChildren(...list.find(x => x[0] === key)[3]());
      }
      pick(tab);
      return h('div', { class: 'noor-adm-tabs' }, h('div', { class: 'noor-adm-tablist', role: 'tablist' }, btns), panel);
    }
    load();
  }

  window.Admin = { view };
})();
