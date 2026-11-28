/* Backup and restore: everything this site keeps in the browser (scores, goals, saved verses, settings and,
   optionally, the user's recordings) goes into one file the user keeps, and can be loaded on any device.
   Nothing leaves the device unless the user moves the file. */
(function () {
  'use strict';
  const N = () => window.Noor;
  const PREFIX = 'noor.', APP = 'noor-quran', VERSION = 1;
  const MAX_FILE = 80 * 1024 * 1024, MAX_VALUE = 4 * 1024 * 1024;
  const localDay = (ms) => { const x = new Date(ms); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const dmy = (ms) => { const x = new Date(ms); return N().num(x.getDate() + '/' + (x.getMonth() + 1) + '/' + x.getFullYear()); };

  function localData() {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && k !== PREFIX + 'lastBackup' && !k.startsWith(PREFIX + 'sync')) data[k] = localStorage.getItem(k);
      }
    } catch { /* storage unavailable */ }
    return data;
  }

  const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

  /** The backup as a plain object. */
  async function build(withVoice) {
    const out = { app: APP, v: VERSION, created: Date.now(), data: localData(), voice: [] };
    if (withVoice && window.Recite?.voice) {
      for (const [k, rec] of await window.Recite.voice.all()) {
        if (!rec || !rec.blob) continue;
        try { out.voice.push({ k, t: rec.t, match: rec.match, score: rec.score, audio: await toDataURL(rec.blob) }); } catch { /* skip that one */ }
      }
    }
    return out;
  }

  /** Checks a parsed file and returns a clean backup, or throws with an i18n key. */
  function validate(o) {
    if (!o || typeof o !== 'object' || o.app !== APP || typeof o.data !== 'object' || !o.data) throw new Error('bk_bad');
    if (typeof o.v !== 'number' || o.v > VERSION) throw new Error('bk_newer');
    const data = {};
    for (const [k, v] of Object.entries(o.data)) {
      if (typeof k !== 'string' || !k.startsWith(PREFIX) || !/^noor\.[A-Za-z0-9_.-]{1,40}$/.test(k)) continue;
      if (typeof v !== 'string' || v.length > MAX_VALUE) continue;
      try { JSON.parse(v); } catch { continue; }
      data[k] = v;
    }
    const voice = (Array.isArray(o.voice) ? o.voice : []).filter(r => r && typeof r.k === 'string' && /^\d{1,3}:\d{1,3}$/.test(r.k)
      && typeof r.audio === 'string' && /^data:audio\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*;base64,/i.test(r.audio));
    return { created: +o.created || 0, data, voice };
  }

  const parse = (raw, key, d) => { try { return raw[key] ? JSON.parse(raw[key]) : d; } catch { return d; } };
  function summary(b) {
    const d = b.data;
    return {
      checked: Object.keys(parse(d, 'noor.rc', {})).length,
      saved: parse(d, 'noor.bm', []).length,
      letters: Object.keys(parse(d, 'noor.pron', {})).length + Object.keys(parse(d, 'noor.write', {})).length,
      days: new Set(parse(d, 'noor.log', []).map(e => e.d)).size,
      voice: b.voice.length,
      goal: !!parse(d, 'noor.goal', null)
    };
  }

  /** Replaces everything in this browser with the backup. */
  async function apply(b) {
    const keep = (k) => k === PREFIX + 'lastBackup' || k.startsWith(PREFIX + 'sync');
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && !keep(k)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    for (const [k, v] of Object.entries(b.data)) { if (keep(k)) continue; try { localStorage.setItem(k, v); } catch { throw new Error('bk_full'); } }
    if (window.Recite?.voice) {
      await window.Recite.voice.clear();
      for (const r of b.voice) {
        try { const blob = await (await fetch(r.audio)).blob(); await window.Recite.voice.set(r.k, { blob, t: +r.t || Date.now(), match: r.match, score: r.score }); } catch { /* skip that one */ }
      }
    }
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = N().h('a', { href: url, download: name, hidden: true });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function makeFile(withVoice) {
    const b = await build(withVoice);
    const name = `noor-backup-${localDay(b.created)}.json`;
    return new File([JSON.stringify(b)], name, { type: 'application/json' });
  }
  const noteBackedUp = () => { N().store.set('lastBackup', Date.now()); };

  /** The Backup card on the Progress page. */
  function section() {
    const { h, t, num, store, openModal, closeModal, toast } = N();
    const last = store.get('lastBackup', 0);
    const ago = last ? Math.floor((Date.now() - last) / 864e5) : null;
    const hasVoice = !!window.Recite?.voice;
    const voiceBox = hasVoice ? h('input', { type: 'checkbox', checked: true }) : null;
    const status = h('p', { class: 'bk-last' + (ago == null || ago > 14 ? ' warn' : '') },
      last ? t('bk_last', ago === 0 ? t('bk_today') : t('bk_days', ago)) + ' (' + dmy(last) + ')' : t('bk_never'));
    const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };

    const saveBtn = h('button', { class: 'btn gold' }, '⬇ ' + t('bk_save'));
    saveBtn.addEventListener('click', async () => {
      if (window.Pro && !window.Pro.need('backup')) return;
      busy(saveBtn, true);
      try { const f = await makeFile(voiceBox?.checked); download(f, f.name); } catch { toast(t('bk_fail')); busy(saveBtn, false); return; }
      noteBackedUp(); busy(saveBtn, false); toast(t('bk_saved'));
      status.className = 'bk-last'; status.textContent = t('bk_last', t('bk_today')) + ' (' + dmy(Date.now()) + ')';
    });

    // on phones the file can go straight to WhatsApp, Drive or email
    let shareBtn = null;
    try {
      if (navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })) {
        shareBtn = h('button', { class: 'btn', onclick: async () => {
          if (window.Pro && !window.Pro.need('backup')) return;
          busy(shareBtn, true);
          try { const f = await makeFile(voiceBox?.checked); await navigator.share({ files: [f], title: t('bk_title') }); noteBackedUp(); toast(t('bk_saved')); }
          catch (e) { if (e && e.name !== 'AbortError') toast(t('bk_fail')); }
          busy(shareBtn, false);
        } }, '↗ ' + t('bk_share'));
      }
    } catch { /* sharing files not supported */ }

    const picker = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: () => { const f = picker.files[0]; picker.value = ''; if (f) readFile(f); } });
    const loadBtn = h('button', { class: 'btn', onclick: () => { if (window.Pro && !window.Pro.need('backup')) return; picker.click(); } }, '⬆ ' + t('bk_load'));

    async function readFile(f) {
      let b;
      try {
        if (f.size > MAX_FILE) throw new Error('bk_big');
        b = validate(JSON.parse(await f.text()));
      } catch (e) { const k = e && /^bk_/.test(e.message) ? e.message : 'bk_bad'; openModal(h('h2', {}, t('bk_load_t')), h('p', {}, t(k)), h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: closeModal }, t('close')))); return; }
      const s = summary(b);
      const line = (n, key) => h('li', {}, h('b', {}, num(n)), ' ', t(key));
      openModal(
        h('h2', {}, t('bk_load_t')),
        h('p', {}, t('bk_from', b.created ? dmy(b.created) : '—')),
        h('ul', { class: 'bk-sum' }, line(s.checked, 'bk_s_checked'), line(s.saved, 'bk_s_saved'), line(s.letters, 'bk_s_letters'), line(s.days, 'bk_s_days'), hasVoice ? line(s.voice, 'bk_s_voice') : null, s.goal ? h('li', {}, '🎯 ', t('bk_s_goal')) : null),
        h('p', { class: 'bk-warn' }, t('bk_replace_warn')),
        h('div', { class: 'row' },
          h('button', { class: 'btn gold', onclick: async (e) => {
            e.currentTarget.disabled = true;
            try { await apply(b); } catch (err) { closeModal(); toast(t(err && /^bk_/.test(err.message) ? err.message : 'bk_fail')); return; }
            store.set('lastBackup', b.created || Date.now());
            closeModal(); toast(t('bk_restored')); setTimeout(() => location.reload(), 900);
          } }, t('bk_replace_ok')),
          h('button', { class: 'btn', onclick: closeModal }, t('rc_cancel'))));
    }

    return h('section', { class: 'sec pg-sec bk-sec', id: 'backup' },
      h('div', { class: 'sec-title' }, h('h2', {}, '💾 ' + t('bk_title')), h('span', {}, t('bk_sub'))),
      h('div', { class: 'bk-card' },
        h('div', { class: 'bk-col' },
          h('h3', {}, t('bk_save_t')), h('p', { class: 'muted' }, t('bk_save_d')), status,
          hasVoice ? h('label', { class: 'rc-rectog' }, voiceBox, t('bk_with_voice')) : null,
          h('div', { class: 'row left' }, saveBtn, shareBtn)),
        h('div', { class: 'bk-col' },
          h('h3', {}, t('bk_load_t')), h('p', { class: 'muted' }, t('bk_load_d')),
          h('div', { class: 'row left' }, loadBtn, picker))),
      h('p', { class: 'muted small' }, t('bk_privacy')));
  }

  window.Backup = { section, build, validate, apply, summary };
})();
