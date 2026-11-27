/* Writing practice for the Learn chapter: write a letter or word with finger or mouse, then get a score.
   The target is drawn in the Quran font on a small hidden grid; the score compares that shape with the strokes:
   how much of the letter the strokes cover, and how much of the ink lies on the letter. */
(function () {
  'use strict';
  const N = 64;                 // scoring grid
  const FONT = '"Amiri Quran", "Scheherazade New", serif';
  const ZWJ = '‍';
  // short words written without vowel marks, for joining practice
  const WORDS = [['بسم', 'বিছমি', 'নামত'], ['الله', 'আল্লাহ', 'আল্লাহ'], ['رب', 'ৰাব্ব', 'প্ৰতিপালক'], ['قل', 'ক্বুল', 'কোৱা'], ['هو', 'হুৱা', 'তেওঁ'],
    ['احد', 'আহাদ', 'এক'], ['نور', 'নূৰ', 'পোহৰ'], ['كتاب', 'কিতাব', 'কিতাপ'], ['صلاة', 'ছালাত', 'নামাজ'], ['سلام', 'ছালাম', 'শান্তি']];

  function layout(ctx, text, S) {
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let fs = S * .6; ctx.font = `${fs}px ${FONT}`;
    let m = ctx.measureText(text);
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, hh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    fs *= Math.min(1.25, (S * .74) / Math.max(w, 1), (S * .74) / Math.max(hh, 1));
    ctx.font = `${fs}px ${FONT}`; m = ctx.measureText(text);
    return { fs, x: S / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, y: S / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 };
  }
  function mask(draw) {
    const c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'); draw(x);
    const d = x.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) m[i] = d[i * 4 + 3] > 70 ? 1 : 0;
    return m;
  }
  function dilate(m, r) {
    const o = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x])
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < N && xx >= 0 && xx < N && dx * dx + dy * dy <= r * r + 1) o[yy * N + xx] = 1;
      }
    return o;
  }
  const count = (m) => m.reduce((a, b) => a + b, 0);
  // connected pieces of a mask (a letter's body and each of its dots); 8-connected
  function pieces(m) {
    const lab = new Int32Array(N * N).fill(-1), out = [];
    for (let i = 0; i < N * N; i++) {
      if (!m[i] || lab[i] >= 0) continue;
      const cells = [], stack = [i]; lab[i] = out.length;
      while (stack.length) {
        const c = stack.pop(); cells.push(c);
        const x = c % N, y = (c - x) / N;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, j = yy * N + xx;
          if (xx >= 0 && xx < N && yy >= 0 && yy < N && m[j] && lab[j] < 0) { lab[j] = out.length; stack.push(j); }
        }
      }
      out.push(cells);
    }
    return out;
  }
  // share of `m` that lies inside `inside`, where every piece of m counts for at least a fifth —
  // so a missing dot (ب / ت / ث) or a stray extra dot matters even though it is little ink
  function pieceShare(m, inside) {
    const ps = pieces(m), total = ps.reduce((a, p) => a + p.length, 0);
    let wsum = 0, hit = 0;
    ps.forEach(p => { const w = Math.max(p.length, total * .2); wsum += w; hit += w * p.filter(c => inside[c]).length / p.length; });
    return wsum ? hit / wsum : 0;
  }
  function bbox(m) {
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y * N + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  /** Score strokes (in S-pixel coordinates) against text. fit=true scales the strokes onto the letter first. */
  function score(text, strokes, S, fit, tol = 2) {
    const k = N / S;
    const G = mask(x => { const L = layout(x, text, S); x.scale(k, k); x.font = `${L.fs}px ${FONT}`; x.fillStyle = '#000'; x.fillText(text, L.x, L.y); });
    let tf = { s: 1, dx: 0, dy: 0 };
    const pts = strokes.flat();
    if (fit && pts.length) {
      const gb = bbox(G); if (gb) {
        let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
        pts.forEach(p => { sx0 = Math.min(sx0, p.x); sx1 = Math.max(sx1, p.x); sy0 = Math.min(sy0, p.y); sy1 = Math.max(sy1, p.y); });
        const gw = (gb.x1 - gb.x0) / k, gh = (gb.y1 - gb.y0) / k, dw = Math.max(sx1 - sx0, S * .02), dh = Math.max(sy1 - sy0, S * .02);
        const s = Math.min(gw / dw, gh / dh, 4);
        tf = { s, dx: (gb.x0 + gb.x1) / 2 / k - (sx0 + sx1) / 2 * s, dy: (gb.y0 + gb.y1) / 2 / k - (sy0 + sy1) / 2 * s };
      }
    }
    const map = (p) => ({ x: p.x * tf.s + tf.dx, y: p.y * tf.s + tf.dy });
    const D = mask(x => drawStrokes(x, strokes.map(st => st.map(map)), k, S * .05 * k, '#000'));
    const nD = count(D), nG = count(G);
    if (!nD || !nG) return { f: 0, G, D, tf, empty: !nD };
    const dG = dilate(G, tol), dD = dilate(D, tol);
    const P = pieceShare(D, dG), R = pieceShare(G, dD);
    // ink outside the letter weighs more than a missing bit, so covering everything with scribble does not pass
    const b2 = .36, f = P + R ? (1 + b2) * P * R / (b2 * P + R) : 0;
    // dots: a small piece of the letter left uncovered, or a small piece of ink away from the letter
    const small = (ps, total) => ps.filter(p => p.length < total * .25);
    // dots are checked with a tighter tolerance than the overall shape (ت / ث, ع / غ have dots close to other ink)
    const dG1 = dilate(G, 1), dD1 = dilate(D, 1);
    const missingDots = small(pieces(G), nG).filter(p => p.filter(c => dD1[c]).length / p.length < .5).length;
    const extraDots = small(pieces(D), nD).filter(p => p.filter(c => dG1[c]).length / p.length < .5).length;
    return { f, P, R, G, D, dG, dD, tf, missingDots, extraDots };
  }
  function drawStrokes(x, strokes, k, width, color) {
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = width; x.strokeStyle = color; x.fillStyle = color;
    strokes.forEach(st => {
      if (!st.length) return;
      if (st.length === 1) { x.beginPath(); x.arc(st[0].x * k, st[0].y * k, width / 2, 0, Math.PI * 2); x.fill(); return; }
      x.beginPath(); x.moveTo(st[0].x * k, st[0].y * k);
      for (let i = 1; i < st.length; i++) x.lineTo(st[i].x * k, st[i].y * k);
      x.stroke();
    });
    x.restore();
  }

  /** Build the writing tab inside body. ctx: { h, L, num, LET, forms, D, sayWord, store, burst, AS } */
  function tab(body, ctx) {
    const { h, L, num, LET, forms, D, sayWord, store, burst, AS } = ctx;
    const css = getComputedStyle(document.documentElement);
    const col = (v) => css.getPropertyValue(v).trim() || '#f2c66d';
    let kind = store.get('wKind', 'letter'), mode = store.get('wMode', 'trace'), li = store.get('wLetter', 1), fi = 0, wi = 0;
    const fixed = ctx.fixedLetter != null;     // smart review: one letter, no picker
    if (fixed) { kind = 'letter'; li = ctx.fixedLetter; }
    let strokes = [], checked = null, demoT = null;
    const best = store.get('write', {});
    const item = () => kind === 'letter' ? { text: forms(LET[li][0], LET[li][5])[fi], id: 'l' + li + '.' + fi, name: window.Learn.nameOf ? window.Learn.nameOf(LET[li]) : LET[li][1], ex: D.ex[LET[li][0]] } : { text: WORDS[wi][0], id: 'w' + wi, name: WORDS[wi][1], mean: WORDS[wi][2] };

    const canvas = h('canvas', { class: 'wpad', 'aria-label': L('Writing area', 'লিখাৰ ঠাই') });
    const target = h('div', { class: 'wtarget' });
    const result = h('div', { class: 'wresult', 'aria-live': 'polite' });
    const picker = h('div', { class: 'wpicker' });
    let S = 360, dpr = 1;

    const seg = (opts, cur, set) => h('div', { class: 'seg' }, opts.map(([v, label]) => h('button', { 'aria-pressed': String(cur === v), onclick: () => set(v) }, label)));
    const controls = h('div', { class: 'wcontrols' });
    function drawControls() {
      controls.replaceChildren(
        fixed ? null : h('div', { class: 'tgroup' }, h('span', { class: 'tlabel' }, L('Write', 'লিখক')), seg([['letter', L('Letters', 'আখৰ')], ['word', L('Words', 'শব্দ')]], kind, v => { kind = v; store.set('wKind', v); reset(); drawAll(); })),
        h('div', { class: 'tgroup' }, h('span', { class: 'tlabel' }, L('Mode', 'ধৰণ')), seg([['trace', L('Trace over', 'ওপৰেদি লিখক')], ['free', L('From memory', 'নিজে লিখক')]], mode, v => { mode = v; store.set('wMode', v); reset(); drawAll(); })));
    }
    function drawPicker() {
      if (kind === 'letter') {
        picker.replaceChildren(
          fixed ? null : h('div', { class: 'wletters', dir: 'rtl' }, LET.map((X, i) => h('button', { class: 'chip arc' + (i === li ? ' on' : '') + ((best['l' + i + '.0'] || 0) >= 70 ? ' done' : ''), lang: 'ar', 'aria-label': X[1], onclick: () => { li = i; fi = 0; store.set('wLetter', i); reset(); drawAll(); } }, X[0]))),
          h('div', { class: 'row left' }, [L('Alone', 'অকলে'), L('Start', 'আৰম্ভণি'), L('Middle', 'মাজত'), L('End', 'শেষত')].map((lab, i) => h('button', { class: 'chip' + (i === fi ? ' on' : ''), onclick: () => { fi = i; reset(); drawAll(); } }, lab))));
      } else {
        picker.replaceChildren(h('div', { class: 'row left' }, WORDS.map((w, i) => h('button', { class: 'chip' + (i === wi ? ' on' : '') + ((best['w' + i] || 0) >= 70 ? ' done' : ''), onclick: () => { wi = i; reset(); drawAll(); } }, h('span', { class: 'ar', lang: 'ar' }, w[0]), ' ' + w[1]))));
      }
    }
    function drawTarget() {
      const it = item();
      target.replaceChildren(...[
        h('div', { class: 'wglyph', lang: 'ar', dir: 'rtl' }, it.text),
        h('div', { class: 'wname' }, h('b', { lang: 'as' }, it.name), it.mean ? h('span', { class: 'muted' }, ' · ' + it.mean) : null),
        it.ex ? h('button', { class: 'btn sm', onclick: () => sayWord(it.ex) }, '🔊 ' + L('Hear an example word', 'উদাহৰণ শব্দ শুনক')) : null,
        h('p', { class: 'muted small' }, mode === 'trace'
          ? L('Write over the faint letter. Arabic is written from right to left; add the dots last.', 'ফিকা আখৰটোৰ ওপৰেদি লিখক। আৰবী সোঁফালৰ পৰা বাওঁফাললৈ লিখা হয়; ফুটবোৰ শেষত দিয়ক।')
          : L('Look at the letter, then write it in the box from memory. Size and position do not matter.', 'আখৰটো চাই লওক, তাৰ পিছত মনৰ পৰা বাকচত লিখক। আকাৰ আৰু স্থান গুৰুত্বপূৰ্ণ নহয়।'))].filter(Boolean));
    }

    // fixed drawing coordinates; CSS scales the canvas to the screen and pointer positions are mapped back
    function size() {
      S = 420; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = S * dpr; canvas.height = S * dpr;
    }
    function paint(reveal) {
      const x = canvas.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, S, S);
      // guide lines
      x.strokeStyle = col('--line'); x.lineWidth = 1; x.setLineDash([4, 6]);
      [S / 2].forEach(p => { x.beginPath(); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.stroke(); });
      x.setLineDash([]);
      const it = item(), Lr = layout(x, it.text, S);
      x.font = `${Lr.fs}px ${FONT}`;
      if (mode === 'trace' || checked || reveal != null) {
        x.globalAlpha = checked ? .28 : .2; x.fillStyle = col('--gold'); x.fillText(it.text, Lr.x, Lr.y); x.globalAlpha = 1;
      }
      if (reveal != null) {   // demo: reveal the letter from right to left
        x.save(); x.beginPath(); x.rect(S * (1 - reveal), 0, S * reveal, S); x.clip();
        x.fillStyle = col('--gold'); x.fillText(it.text, Lr.x, Lr.y); x.restore();
      }
      if (checked && !checked.empty) {
        const c = S / N;
        for (let i = 0; i < N * N; i++) {
          const gx = (i % N) * c, gy = Math.floor(i / N) * c;
          if (checked.G[i] && !checked.dD[i]) { x.fillStyle = 'rgba(255,90,90,.55)'; x.fillRect(gx, gy, c, c); }
          else if (checked.D[i] && !checked.dG[i]) { x.fillStyle = 'rgba(255,165,60,.6)'; x.fillRect(gx, gy, c, c); }
        }
        const tf = checked.tf;
        drawStrokes(x, strokes.map(st => st.map(p => ({ x: p.x * tf.s + tf.dx, y: p.y * tf.s + tf.dy }))), 1, S * .05, col('--teal'));
      } else drawStrokes(x, strokes, 1, S * .05, col('--text'));
    }
    function reset() { strokes = []; checked = null; result.replaceChildren(); cancelAnimationFrame(demoT); demoT = null; }
    function drawAll() { drawControls(); drawPicker(); drawTarget(); paint(); }

    // pointer drawing
    let drawing = null;
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * S / r.width, y: (e.clientY - r.top) * S / r.height }; };
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); if (checked) { checked = null; strokes = []; result.replaceChildren(); } canvas.setPointerCapture(e.pointerId); drawing = [pt(e)]; strokes.push(drawing); paint(); });
    canvas.addEventListener('pointermove', (e) => { if (!drawing) return; e.preventDefault(); const p = pt(e), l = drawing[drawing.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) > 1.2) { drawing.push(p); paint(); } });
    const end = () => { drawing = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

    function check() {
      const it = item();
      if (!strokes.length) { result.replaceChildren(h('p', { class: 'muted' }, L('Write the letter in the box first.', 'প্ৰথমে বাকচটোত লিখক।'))); return; }
      const r = score(it.text, strokes, S, mode === 'free');
      checked = r; paint();
      const hi = mode === 'free' ? 65 : 75, mid = mode === 'free' ? 45 : 55;
      const dotsWrong = r.missingDots || r.extraDots;
      const pct = Math.round(Math.min(r.f * 100, dotsWrong ? hi - 8 : 100));
      best[it.id] = Math.max(best[it.id] || 0, pct); store.set('write', best);
      window.Noor.log('wr', pct); window.Noor.touchDay();
      const grade = pct >= hi ? 'good' : pct >= mid ? 'hard' : 'again';
      if (kind === 'letter') window.Review?.result('w:' + li, grade);
      const dotMsg = r.missingDots ? L('A dot is missing — check the dots.', 'এটা ফুট বাকী আছে — ফুটবোৰ চাওক।') : r.extraDots ? L('There is an extra dot — check the dots.', 'অতিৰিক্ত ফুট দিছে — ফুটবোৰ চাওক।') : '';
      const msg = dotMsg && pct >= mid ? L('Good shape — ', 'আকৃতি ভাল — ') + dotMsg : pct >= hi ? L('Excellent — well written!', 'চমৎকাৰ — বৰ সুন্দৰকৈ লিখিছে!') : pct >= mid ? L('Good — compare with the red parts and try again.', 'ভাল — ৰঙা অংশবোৰ চাই আকৌ চেষ্টা কৰক।') : L('Not yet — watch the demo, then try again.', 'এতিয়াও হোৱা নাই — দেখুওৱাটো চাই আকৌ চেষ্টা কৰক।');
      result.replaceChildren(...[
        h('div', { class: 'wscore ' + (pct >= hi ? 'hi' : pct >= mid ? 'mid' : 'lo') }, h('b', {}, num(pct) + '%'), h('span', {}, msg)),
        h('div', { class: 'rc-legend' }, h('span', { class: 'lg lg-ok' }, L('your writing', 'আপোনাৰ লিখা')), h('span', { class: 'lg lg-wrong' }, L('missing part of the letter', 'আখৰৰ বাকী থকা অংশ')), h('span', { class: 'lg lg-close' }, L('outside the letter', 'আখৰৰ বাহিৰত'))),
        mode === 'free' ? h('p', { class: 'muted small' }, L('Your writing has been resized onto the letter to compare the shape.', 'আকাৰ মিলাবলৈ আপোনাৰ লিখা আখৰটোৰ ওপৰত মিলাই দেখুওৱা হৈছে।')) : null,
        h('div', { class: 'row left' },
          h('button', { class: 'btn sm gold', onclick: () => { reset(); paint(); } }, L('Write again', 'আকৌ লিখক')),
          fixed ? null : h('button', { class: 'btn sm', onclick: next }, L('Next →', 'পৰৱৰ্তী →')))].filter(Boolean));
      ctx.onChecked && ctx.onChecked(grade);
      if (pct >= hi) burst(result);
      drawPicker();
    }
    function next() {
      if (kind === 'letter') { li = (li + 1) % LET.length; fi = 0; store.set('wLetter', li); } else wi = (wi + 1) % WORDS.length;
      reset(); drawAll();
    }
    function demo() {
      reset(); const t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 1600); paint(p); if (p < 1) demoT = requestAnimationFrame(step); else { demoT = null; setTimeout(() => { if (!strokes.length && !checked) paint(); }, 900); } };
      demoT = requestAnimationFrame(step);
    }

    body.replaceChildren(
      h('p', { class: 'lead' }, L('Writing a letter helps you remember its shape. Trace over the faint letter first, then try writing it from memory. Use your finger on a phone, or the mouse on a computer.',
        'আখৰ লিখিলে তাৰ আকৃতি মনত থাকে। প্ৰথমে ফিকা আখৰটোৰ ওপৰেদি লিখক, তাৰ পিছত মনৰ পৰা লিখিবলৈ চেষ্টা কৰক। ফোনত আঙুলিৰে, কম্পিউটাৰত মাউছেৰে লিখক।')),
      controls, picker,
      h('div', { class: 'wsplit' },
        h('div', { class: 'wleft' }, h('div', { class: 'wpadwrap' }, canvas),
          h('div', { class: 'row left wbtns' },
            h('button', { class: 'btn sm', onclick: () => { strokes.pop(); checked = null; result.replaceChildren(); paint(); } }, '↶ ' + L('Undo', 'উভতাই নিয়ক')),
            h('button', { class: 'btn sm', onclick: () => { reset(); paint(); } }, L('Clear', 'মচক')),
            h('button', { class: 'btn sm', onclick: demo }, L('Show me', 'দেখুৱাওক')),
            h('button', { class: 'btn sm gold', onclick: check }, '✓ ' + L('Check', 'পৰীক্ষা কৰক')))),
        h('div', { class: 'wright' }, target, result)));
    drawControls(); drawPicker(); drawTarget();
    requestAnimationFrame(() => { size(); paint(); });
    size();
    const fontReady = document.fonts && document.fonts.load ? document.fonts.load(`40px ${FONT}`, 'بسم') : Promise.resolve();
    fontReady.then(() => paint()).catch(() => { });
    const onResize = () => { if (!canvas.isConnected) return removeEventListener('resize', onResize); size(); paint(); };
    addEventListener('resize', onResize);
    paint();
  }

  window.NoorWrite = { tab, score, WORDS };
})();
