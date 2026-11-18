/* Daily goals and reminders.
   Goal: targets per activity per day. Progress comes from the practice log (recite, letters, writing)
   and the per-day listening counter.
   Reminder: a website cannot notify while it is closed (no push server), so the reminder is a daily
   repeating calendar event with an alarm — a downloadable .ics file or a Google Calendar link. */
(function () {
  'use strict';
  const KINDS = ['li', 'rc', 'lp', 'wr'];   // listened verses, checked verses, letters said, letters written
  const PRESETS = { easy: { li: 7, rc: 3, lp: 0, wr: 0 }, regular: { li: 15, rc: 5, lp: 5, wr: 0 }, serious: { li: 30, rc: 10, lp: 10, wr: 5 } };
  const N = () => window.Noor;
  const localDay = (ms) => { const x = new Date(ms); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };

  const get = () => N().store.get('goal', null);
  function set(g) { N().store.set('goal', g); }

  /** What was done on a given day: { li, rc, lp, wr } */
  function doneOn(day) {
    const { store } = N();
    const log = store.get('log', []).filter(e => e.d === day);
    return {
      li: store.get('listen', {})[day] || 0,
      rc: log.filter(e => e.t === 'rc').length,
      lp: log.filter(e => e.t === 'lp' || e.t === 'lw').length,
      wr: log.filter(e => e.t === 'wr').length
    };
  }
  /** Progress towards the goal on a day: { done, goal, pct (0–1), met } */
  function status(day = localDay(Date.now())) {
    const g = get(), done = doneOn(day);
    if (!g) return { done, goal: null, pct: 0, met: false };
    const active = KINDS.filter(k => g[k] > 0);
    const pct = active.length ? active.reduce((a, k) => a + Math.min(1, done[k] / g[k]), 0) / active.length : 0;
    return { done, goal: g, pct, met: active.length > 0 && active.every(k => done[k] >= g[k]) };
  }
  /** Days in a row the goal was met, counting today only once it is met. */
  function streak() {
    if (!get()) return 0;
    let n = 0, k = status().met ? 0 : 1;
    while (n < 400 && status(localDay(Date.now() - k * 864e5)).met) { n++; k++; }
    return n;
  }

  /** Called after any practice is recorded: celebrate once when today's goal is reached. */
  function afterLog() {
    const { store, toast, t } = N();
    const today = localDay(Date.now());
    if (!get() || store.get('goalMet', '') === today) { refreshCards(); return; }
    if (status().met) {
      store.set('goalMet', today);
      toast(t('gl_met_toast'));
    }
    refreshCards();
  }

  // ---------- UI ----------
  function ring(pct, size = 92) {
    const r = size / 2 - 7, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
    return `<svg class="gl-ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gl-track"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gl-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
  function lines(st) {
    const { h, t, num } = N();
    return h('ul', { class: 'gl-lines' }, KINDS.filter(k => st.goal[k] > 0).map(k => {
      const ok = st.done[k] >= st.goal[k];
      return h('li', { class: ok ? 'ok' : '' }, h('span', { class: 'gl-ic', 'aria-hidden': 'true' }, ok ? '✓' : '○'), h('span', {}, t('gl_k_' + k)),
        h('b', {}, num(Math.min(st.done[k], st.goal[k])) + '/' + num(st.goal[k])));
    }));
  }

  /** Compact card for the home page. */
  function homeCard() {
    const { h, t, num, store } = N();
    const st = status(), last = store.get('last', null);
    const el = h('section', { class: 'gl-card gl-home' + (st.met ? ' met' : ''), 'data-goal-card': '' });
    if (!st.goal) {
      el.append(h('div', { class: 'gl-body' }, h('h3', {}, '🎯 ' + t('gl_set_t')), h('p', { class: 'muted' }, t('gl_set_d'))),
        h('a', { class: 'btn gold sm', href: '#/progress' }, t('gl_set_btn')));
      return el;
    }
    const pct = Math.round(st.pct * 100), sk = streak();
    el.append(
      h('div', { class: 'gl-ringwrap', html: ring(st.pct) }, h('b', { class: 'gl-pct' }, num(pct) + '%')),
      h('div', { class: 'gl-body' },
        h('h3', {}, st.met ? '✓ ' + t('gl_done_t') : t('gl_today_t')),
        lines(st),
        sk ? h('p', { class: 'muted small' }, '🔥 ' + t('gl_streak', sk)) : null),
      h('div', { class: 'gl-actions' },
        st.met ? null : h('a', { class: 'btn gold sm', href: last ? `#/s/${last.id}` : '#/s/1' }, t('gl_continue')),
        h('a', { class: 'btn sm', href: '#/progress' }, t('gl_change'))));
    return el;
  }

  function refreshCards() {
    document.querySelectorAll('[data-goal-card]').forEach(old => {
      const fresh = old.classList.contains('gl-home') ? homeCard() : null;
      if (fresh) old.replaceWith(fresh);
    });
    document.querySelectorAll('[data-goal-section]').forEach(old => old.replaceWith(section()));
  }

  /** Full section for the progress page: today, goal editor and reminder. */
  function section() {
    const { h, t, num, store } = N();
    const st = status(), g = get() || { ...PRESETS.regular }, sk = streak();
    let draft = { ...g };
    const wrap = h('section', { class: 'sec pg-sec gl-sec', id: 'goal', 'data-goal-section': '' });

    // last 7 days: met or not
    const week = [];
    for (let k = 6; k >= 0; k--) { const d = localDay(Date.now() - k * 864e5); week.push({ d, s: status(d) }); }
    const D = window.Noor.lang() === 'as' ? ['দেও', 'সোম', 'মঙল', 'বুধ', 'বৃহ', 'শুক্ৰ', 'শনি'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const today = st.goal ? h('div', { class: 'gl-card' + (st.met ? ' met' : '') },
      h('div', { class: 'gl-ringwrap', html: ring(st.pct, 110) }, h('b', { class: 'gl-pct' }, num(Math.round(st.pct * 100)) + '%')),
      h('div', { class: 'gl-body' }, h('h3', {}, st.met ? '✓ ' + t('gl_done_t') : t('gl_today_t')), lines(st),
        h('p', { class: 'muted small' }, sk ? '🔥 ' + t('gl_streak', sk) : t('gl_streak0'))),
      h('div', { class: 'gl-week', 'aria-label': t('gl_week') }, week.map(({ d, s }) => {
        const dt = new Date(d + 'T12:00'), cls = s.met ? 'met' : s.pct > 0 ? 'part' : '';
        return h('div', { class: 'gl-day ' + cls, title: d }, h('i', {}, s.met ? '✓' : s.pct > 0 ? num(Math.round(s.pct * 100)) : '·'), h('small', {}, D[dt.getDay()]));
      }))) : null;

    // editor
    const stepper = (k) => {
      const val = h('b', {}, num(draft[k]));
      const ch = (d) => { draft[k] = Math.max(0, Math.min(200, draft[k] + d)); val.textContent = num(draft[k]); presetBtns.forEach(b => b.setAttribute('aria-pressed', 'false')); };
      return h('div', { class: 'gl-step' }, h('span', {}, t('gl_k_' + k)),
        h('div', { class: 'speed' }, h('button', { 'aria-label': t('slower'), onclick: () => ch(k === 'li' ? -5 : -1) }, '−'), val, h('button', { 'aria-label': t('faster'), onclick: () => ch(k === 'li' ? 5 : 1) }, '+')));
    };
    const steppers = h('div', { class: 'gl-steps' });
    const drawSteppers = () => steppers.replaceChildren(...KINDS.map(stepper));
    const presetBtns = Object.keys(PRESETS).map(p => h('button', {
      'aria-pressed': String(KINDS.every(k => PRESETS[p][k] === draft[k])),
      onclick: (e) => { draft = { ...PRESETS[p], time: draft.time }; presetBtns.forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); drawSteppers(); }
    }, t('gl_p_' + p)));
    drawSteppers();
    const saveBtn = h('button', { class: 'btn gold', onclick: () => {
      if (!KINDS.some(k => draft[k] > 0)) { N().toast(t('gl_need_one')); return; }
      set({ ...draft, time: (get() || {}).time || draft.time || '20:00' }); N().toast(t('gl_saved')); afterLog();
    } }, st.goal ? t('gl_save') : t('gl_start'));
    const editor = h('div', { class: 'gl-edit' },
      h('h3', {}, t('gl_edit_t')),
      h('div', { class: 'seg gl-presets' }, presetBtns),
      steppers,
      h('div', { class: 'row left' }, saveBtn, st.goal ? h('button', { class: 'btn sm', onclick: () => { store.set('goal', null); refreshCards(); } }, t('gl_remove')) : null));

    // reminder
    const time = h('input', { type: 'time', value: (get() || {}).time || '20:00', 'aria-label': t('gl_time'), class: 'gl-time', onchange: () => { const cur = get(); if (cur) set({ ...cur, time: time.value }); } });
    const reminder = h('div', { class: 'gl-rem' },
      h('h3', {}, '⏰ ' + t('gl_rem_t')),
      h('p', { class: 'muted small' }, t('gl_rem_d')),
      h('div', { class: 'row left' }, h('label', { class: 'gl-timel' }, t('gl_time'), time)),
      h('div', { class: 'row left' },
        h('button', { class: 'btn gold sm', onclick: () => downloadIcs(time.value || '20:00') }, '📅 ' + t('gl_ics')),
        h('a', { class: 'btn sm', href: '#', target: '_blank', rel: 'noopener', onclick: (e) => { e.currentTarget.href = googleLink(time.value || '20:00'); } }, t('gl_gcal'))),
      h('p', { class: 'muted small' }, t('gl_rem_note')));

    wrap.append(h('div', { class: 'sec-title' }, h('h2', {}, '🎯 ' + t('gl_title')), st.goal ? h('span', {}, t('gl_sub')) : null),
      h('div', { class: 'gl-grid' }, today || h('div', { class: 'gl-card' }, h('div', { class: 'gl-body' }, h('h3', {}, t('gl_set_t')), h('p', { class: 'muted' }, t('gl_set_d')))), editor, reminder));
    return wrap;
  }

  // ---------- calendar reminder ----------
  function siteUrl() { return location.origin + location.pathname; }
  function eventText() {
    const { t } = N(), g = get();
    const parts = g ? KINDS.filter(k => g[k] > 0).map(k => `${t('gl_k_' + k)}: ${N().num(g[k])}`) : [];
    return { title: t('gl_ev_title'), body: (parts.length ? t('gl_ev_goal') + ' ' + parts.join(', ') + '. ' : '') + siteUrl() };
  }
  function nextStart(hhmm) {
    const [hh, mm] = hhmm.split(':').map(Number), d = new Date();
    d.setHours(hh, mm, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1);
    return d;
  }
  const stamp = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  // iCalendar lines must be folded at 75 octets (UTF-8 bytes), without splitting a character
  function fold(line) {
    const enc = new TextEncoder(); const out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function ics(hhmm) {
    const { title, body } = eventText(), start = nextStart(hhmm), now = new Date();
    const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Noor//Quran practice reminder//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:noor-daily-' + now.getTime() + '@' + location.hostname, 'DTSTAMP:' + utc, 'DTSTART:' + stamp(start), 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
      'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(body), 'URL:' + siteUrl(),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }
  function downloadIcs(hhmm) {
    const cur = get(); if (cur) set({ ...cur, time: hhmm });
    const blob = new Blob([ics(hhmm)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'noor-daily-practice.ics';
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    N().toast(N().t('gl_ics_done'));
  }
  function googleLink(hhmm) {
    const cur = get(); if (cur) set({ ...cur, time: hhmm });
    const { title, body } = eventText(), start = nextStart(hhmm), end = new Date(start.getTime() + 15 * 60000);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: title, details: body, dates: stamp(start) + '/' + stamp(end), recur: 'RRULE:FREQ=DAILY' });
    return 'https://calendar.google.com/calendar/render?' + q.toString();
  }

  window.Goals = { get, status, streak, afterLog, homeCard, section, ics, googleLink, PRESETS };
})();
