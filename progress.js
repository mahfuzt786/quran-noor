/* Progress page: recitation, writing and letter-pronunciation results saved in this browser. */
(function () {
  'use strict';
  const DAYS = 14;
  const localDay = (ms) => { const x = new Date(ms); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

  function view(app) {
    const { h, t, num, store, openModal, closeModal, footer, chapters, sname } = window.Noor;
    const LET = window.Learn.LET, forms = window.Learn.forms;
    const rc = store.get('rc', {}), write = store.get('write', {}), pron = store.get('pron', {}), log = store.get('log', []);
    const prog = store.get('prog', {}), streak = store.get('streak', { n: 0 });
    const CH = chapters();
    const pct = (x) => num(Math.round(x)) + '%';

    // ---- numbers ----
    const rcKeys = Object.keys(rc), rcVals = rcKeys.map(k => rc[k]);
    const perfect = rcVals.filter(v => v === 100).length;
    const avg = rcVals.length ? rcVals.reduce((a, b) => a + b, 0) / rcVals.length : 0;
    const writtenWell = LET.filter((_, i) => [0, 1, 2, 3].some(f => (write['l' + i + '.' + f] || 0) >= 70)).length;
    const spoken = LET.filter(X => pron[X[0]]?.ok).length;
    const hasAny = rcKeys.length || Object.keys(write).length || Object.keys(pron).length || log.length;

    const tile = (value, label, sub) => h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label), sub ? h('small', { class: 'muted' }, sub) : null);
    const tiles = h('div', { class: 'stats pg-stats' },
      tile(num(streak.n || 0), t('pg_streak')),
      tile(num(rcKeys.length), t('pg_checked')),
      tile(num(perfect), t('pg_perfect')),
      tile(rcVals.length ? pct(avg) : '—', t('pg_avg')),
      tile(num(writtenWell) + '/' + num(28), t('pg_written')),
      tile(num(spoken) + '/' + num(28), t('pg_spoken')));

    // ---- activity chart: attempts per day, last 14 days ----
    const days = [];
    for (let k = DAYS - 1; k >= 0; k--) {
      const d = localDay(Date.now() - k * 864e5);
      const items = log.filter(e => e.d === d);
      days.push({ d, total: items.length, rc: items.filter(e => e.t === 'rc').length, wr: items.filter(e => e.t === 'wr').length, lp: items.filter(e => e.t === 'lp' || e.t === 'lw').length });
    }
    const activity = h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('pg_activity')), h('span', {}, t('pg_attempts', days.reduce((a, d) => a + d.total, 0)))),
      days.some(d => d.total) ? chart(days) : h('p', { class: 'muted' }, t('pg_no_activity')),
      h('details', { class: 'pg-table' }, h('summary', {}, t('pg_table')),
        h('table', {}, h('thead', {}, h('tr', {}, [t('pg_date'), t('pg_t_rc'), t('pg_t_wr'), t('pg_t_lp'), t('pg_total')].map(x => h('th', {}, x)))),
          h('tbody', {}, days.slice().reverse().map(d => h('tr', {}, h('td', {}, dateLabel(d.d, true)), h('td', {}, num(d.rc)), h('td', {}, num(d.wr)), h('td', {}, num(d.lp)), h('td', {}, num(d.total))))))));

    function dateLabel(d, long) {
      const [y, m, day] = d.split('-').map(Number);
      const dt = new Date(y, m - 1, day);
      if (!long) return num(day);
      if (window.Noor.lang() === 'as') {   // browsers rarely ship Assamese date formats, so spell it out
        const M = ['জানুৱাৰী', 'ফেব্ৰুৱাৰী', 'মাৰ্চ', 'এপ্ৰিল', 'মে’', 'জুন', 'জুলাই', 'আগষ্ট', 'ছেপ্টেম্বৰ', 'অক্টোবৰ', 'নৱেম্বৰ', 'ডিচেম্বৰ'];
        const D = ['দেওবাৰ', 'সোমবাৰ', 'মঙলবাৰ', 'বুধবাৰ', 'বৃহস্পতিবাৰ', 'শুকুৰবাৰ', 'শনিবাৰ'];
        return `${D[dt.getDay()]}, ${num(day)} ${M[m - 1]}`;
      }
      try { return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch { return d; }
    }

    function chart(days) {
      const W = 640, H = 200, padL = 28, padB = 24, padT = 10, plotW = W - padL - 8, plotH = H - padB - padT;
      const max = Math.max(...days.map(d => d.total)), top = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
      const band = plotW / days.length, bw = Math.min(24, band * .6);
      const y = (v) => padT + plotH - v / top * plotH;
      const NS = 'http://www.w3.org/2000/svg';
      const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pg-chart', role: 'img', 'aria-label': t('pg_activity') });
      [0, top / 2, top].forEach(v => {
        svg.append(el('line', { x1: padL, x2: W - 8, y1: y(v), y2: y(v), class: 'pg-grid' }));
        const tx = el('text', { x: padL - 6, y: y(v) + 4, class: 'pg-axis', 'text-anchor': 'end' }); tx.textContent = num(v); svg.append(tx);
      });
      const tip = h('div', { class: 'pg-tip', hidden: true });
      days.forEach((d, i) => {
        const cx = padL + band * i + band / 2;
        if (d.total) {
          const x0 = cx - bw / 2, y0 = y(d.total), r = Math.min(4, (padT + plotH - y0) / 2);
          svg.append(el('path', { class: 'pg-bar', d: `M${x0} ${padT + plotH} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + bw - r} Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + r} V${padT + plotH} Z` }));
        }
        if (i % 2 === (days.length - 1) % 2) { const tx = el('text', { x: cx, y: H - 6, class: 'pg-axis', 'text-anchor': 'middle' }); tx.textContent = dateLabel(d.d); svg.append(tx); }
        // hit target: the whole day column
        const hit = el('rect', { x: padL + band * i, y: padT, width: band, height: plotH, class: 'pg-hit', tabindex: 0, 'aria-label': `${dateLabel(d.d, true)}: ${t('pg_attempts', d.total)}` });
        const show = () => {
          tip.replaceChildren(h('b', {}, dateLabel(d.d, true)), h('div', {}, t('pg_attempts', d.total)),
            d.total ? h('div', { class: 'muted' }, `${t('pg_t_rc')} ${num(d.rc)} · ${t('pg_t_wr')} ${num(d.wr)} · ${t('pg_t_lp')} ${num(d.lp)}`) : null);
          tip.hidden = false; tip.style.left = (cx / W * 100) + '%';
          svg.querySelectorAll('.pg-hit').forEach(n => n.classList.toggle('on', n === hit));
        };
        hit.addEventListener('mouseenter', show); hit.addEventListener('focus', show); hit.addEventListener('click', show);
        svg.append(hit);
      });
      const wrap = h('div', { class: 'pg-chartwrap' }, svg, tip);
      wrap.addEventListener('mouseleave', () => { tip.hidden = true; svg.querySelectorAll('.pg-hit.on').forEach(n => n.classList.remove('on')); });
      return wrap;
    }

    // ---- recitation by surah ----
    const bySurah = {};
    rcKeys.forEach(k => { const [s] = k.split(':').map(Number); (bySurah[s] = bySurah[s] || []).push([k, rc[k]]); });
    const surahIds = [...new Set([...Object.keys(bySurah).map(Number), ...Object.keys(prog).map(Number).filter(id => prog[id].quiz || (prog[id].wpm || []).length)])].sort((a, b) => a - b);
    const revisit = rcKeys.filter(k => rc[k] < 70).sort((a, b) => rc[a] - rc[b]).slice(0, 12);
    const recitation = h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('pg_rec_t'))),
      surahIds.length ? h('div', { class: 'pg-tablewrap' }, h('table', { class: 'pg-rows' },
        h('thead', {}, h('tr', {}, [t('pg_col_surah'), t('pg_col_checked'), t('pg_col_avg'), t('pg_col_quiz'), t('pg_col_pace')].map(x => h('th', {}, x)))),
        h('tbody', {}, surahIds.map(id => {
          const c = CH[id - 1], items = bySurah[id] || [], p = prog[id] || {};
          const a = items.length ? items.reduce((s, x) => s + x[1], 0) / items.length : null;
          const pace = Math.max(0, ...(p.wpm || []).map(x => x.wpm));
          return h('tr', {},
            h('td', {}, h('a', { href: '#/s/' + id }, num(id) + '. ' + sname(c))),
            h('td', {}, items.length ? num(items.length) + ' / ' + num(c.n) : '—', items.length ? h('small', { class: 'muted' }, ' · ✓ ' + num(items.filter(x => x[1] === 100).length)) : null),
            h('td', {}, a == null ? '—' : h('div', { class: 'pg-bar-h' }, h('i', { style: `width:${a}%` }), h('span', {}, pct(a)))),
            h('td', {}, p.quiz ? pct(p.quiz) : '—'),
            h('td', {}, pace ? num(pace) + ' ' + t('wpm') : '—'));
        })))) : h('p', { class: 'muted' }, t('pg_rec_none')),
      revisit.length ? h('div', { class: 'pg-revisit' }, h('h3', {}, t('pg_revisit')), h('p', { class: 'muted small' }, t('pg_revisit_d')),
        h('div', { class: 'row left' }, revisit.map(k => { const [s, v] = k.split(':').map(Number); return h('a', { class: 'chip', href: `#/s/${s}/${v}` }, `${sname(CH[s - 1])} ${num(s + ':' + v)} · ${pct(rc[k])}`); }))) : null);

    // ---- writing ----
    const status = (score) => score == null ? 'none' : score >= 70 ? 'hi' : score >= 45 ? 'mid' : 'lo';
    const icon = { none: '·', lo: '!', mid: '◐', hi: '✓' };
    const formsTried = LET.reduce((n, _, i) => n + [0, 1, 2, 3].filter(f => write['l' + i + '.' + f] != null).length, 0);
    const words = window.NoorWrite ? window.NoorWrite.WORDS : [];
    const writing = h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('pg_wr_t')), h('span', {}, t('pg_forms', [formsTried, 28 * 4]))),
      h('p', { class: 'muted small' }, t('pg_wr_d')),
      h('div', { class: 'pg-letters', dir: 'rtl' }, LET.map((X, i) => {
        const sc = write['l' + i + '.0'], st = status(sc);
        return h('div', { class: 'pg-cell st-' + st, title: X[1] + (sc != null ? ' · ' + pct(sc) : '') },
          h('span', { class: 'ar', lang: 'ar' }, X[0]), h('small', {}, (sc != null ? pct(sc) : '—') + ' ' + icon[st]));
      })),
      legend([['hi', t('pg_bin_hi')], ['mid', t('pg_bin_mid')], ['lo', t('pg_bin_lo')], ['none', t('pg_bin_none')]]),
      words.some((_, i) => write['w' + i] != null) ? h('div', { class: 'row left pg-words' }, h('span', { class: 'tlabel' }, t('pg_words')),
        words.map((w, i) => write['w' + i] != null ? h('span', { class: 'chip st-' + status(write['w' + i]) }, h('span', { class: 'ar', lang: 'ar' }, w[0]), ' ' + pct(write['w' + i]) + ' ' + icon[status(write['w' + i])]) : null)) : null);

    function legend(items) {
      return h('div', { class: 'pg-legend' }, items.map(([st, label]) => h('span', { class: 'st-' + st }, h('i', {}, icon[st]), label)));
    }

    // ---- letter pronunciation ----
    const pstatus = (X) => { const p = pron[X[0]]; return !p ? 'none' : p.last ? 'hi' : p.ok ? 'mid' : 'lo'; };
    const speaking = h('section', { class: 'sec pg-sec' },
      h('div', { class: 'sec-title' }, h('h2', {}, t('pg_lp_t'))),
      h('p', { class: 'muted small' }, t('pg_lp_d')),
      h('div', { class: 'pg-letters', dir: 'rtl' }, LET.map(X => {
        const st = pstatus(X), p = pron[X[0]];
        const asL = p && !p.last && p.as ? p.as : null;
        return h('div', { class: 'pg-cell st-' + st, title: X[1] },
          h('span', { class: 'ar', lang: 'ar' }, X[0]),
          h('small', {}, icon[st] + (asL ? ' ≈ ' : ''), asL ? h('span', { class: 'ar', lang: 'ar' }, asL) : null));
      })),
      legend([['hi', t('pg_lp_ok')], ['mid', t('pg_lp_mid')], ['lo', t('pg_lp_bad')], ['none', t('pg_bin_none')]]),
      h('div', { class: 'row left pg-drills' }, h('span', { class: 'tlabel' }, t('pg_drills')),
        h('span', { class: 'chip' }, t('pg_drill_rec') + ': ' + num(store.get('letterQuiz', 0) + '/10')),
        h('span', { class: 'chip' }, t('pg_drill_pron') + ': ' + num(store.get('pronQuiz', 0) + '/10')),
        h('a', { class: 'chip', href: '#/learn' }, t('nav_learn') + ' →')));

    const reset = () => openModal(h('h2', {}, t('pg_reset_t')), h('p', {}, t('pg_reset_d')), window.Sync?.signedIn() ? h('p', { class: 'bk-warn' }, t('sy_reset_note')) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn danger', onclick: () => { ['rc', 'write', 'pron', 'log', 'pronQuiz', 'letterQuiz', 'prog', 'known', 'streak', 'last'].forEach(k => { try { localStorage.removeItem('noor.' + k); } catch { /* ignore */ } }); closeModal(); location.reload(); } }, t('pg_reset_ok')),
        h('button', { class: 'btn', onclick: closeModal }, t('rc_cancel'))));

    app.replaceChildren(
      h('section', { class: 'shead' }, h('div', { class: 'shead-art', html: window.Scenes.forSurah(87) }), h('div', { class: 'shead-in' },
        h('div', { class: 'shead-txt' }, h('div', { class: 'sub' }, t('pg_sub')), h('h1', {}, t('pg_title'))))),
      h('div', { class: 'wrap' },
        window.Goals ? window.Goals.section() : null,
        window.Review ? window.Review.section() : null,
        window.Bookmarks ? window.Bookmarks.progressSection() : null,
        hasAny ? [tiles, activity, recitation, writing, speaking,
          h('div', { class: 'pg-foot' }, h('p', { class: 'muted small' }, t('pg_device_note')), h('button', { class: 'btn sm', onclick: reset }, t('pg_reset')))]
          : h('div', { class: 'endcard pg-empty' }, h('h3', {}, t('pg_empty_t')), h('p', {}, t('pg_empty')),
            h('div', { class: 'row' }, h('a', { class: 'btn gold', href: '#/s/1' }, t('pg_go_surah')), h('a', { class: 'btn', href: '#/learn' }, t('nav_learn')))),
        window.Sync ? window.Sync.section() : null,
        window.Offline ? window.Offline.section() : null,
        window.Backup ? window.Backup.section() : null,
        footer()));
  }

  window.Progress = { view };
})();
