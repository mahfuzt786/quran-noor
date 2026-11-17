/* Illustrations — inline animated SVG. No people or animals are depicted. */
(function () {
  // small deterministic random so scenes look the same on every load
  const rnd = (seed) => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  const stars = (n, w, h, seed = 7) => {
    const r = rnd(seed); let s = '';
    for (let i = 0; i < n; i++) {
      s += `<circle class="tw" style="animation-delay:${(r() * 4).toFixed(2)}s" cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.5 + r() * 1.3).toFixed(2)}" fill="#fff"/>`;
    }
    return s;
  };
  const sky = (id, a, b, c) => `<defs><linearGradient id="sk-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".6" stop-color="${c}"/>` : ''}<stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#sk-${id})"/>`;
  const moon = (x, y, r, bg) => `<g class="float"><circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="#f2c66d" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="#f6d998"/><circle cx="${x + r * 0.42}" cy="${y - r * 0.18}" r="${r * 0.86}" fill="${bg}"/></g>`;
  const hills = (c1, c2) => `<path d="M0 150 Q60 112 120 140 T240 132 T320 142 V180 H0Z" fill="${c1}"/><path d="M0 164 Q80 140 170 160 T320 154 V180 H0Z" fill="${c2}"/>`;
  const cloud = (x, y, s, cls, o = 0.85) => `<g class="${cls}" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="26" ry="9" fill="#fff"/><ellipse cx="-10" cy="-7" rx="13" ry="9" fill="#fff"/><ellipse cx="8" cy="-9" rx="15" ry="11" fill="#fff"/></g>`;
  const rays = (x, y, r1, r2, n, col) => {
    let s = `<g class="spin" style="transform-origin:${x}px ${y}px">`;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      s += `<line x1="${(x + Math.cos(a) * r1).toFixed(1)}" y1="${(y + Math.sin(a) * r1).toFixed(1)}" x2="${(x + Math.cos(a) * r2).toFixed(1)}" y2="${(y + Math.sin(a) * r2).toFixed(1)}" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    return s + '</g>';
  };
  const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 Q4 -30 -2 -62" stroke="#3b2a1a" stroke-width="5" fill="none" stroke-linecap="round"/><g class="sway" style="transform-origin:-2px -62px">${[-70, -35, 0, 35, 70].map(a => `<path d="M-2 -62 q14 -22 40 -8 q-22 -4 -40 8z" fill="#1f7a5a" transform="rotate(${a - 60} -2 -62)"/>`).join('')}</g></g>`;

  const S = {
    night: () => sky('n', '#070b22', '#1b2b5e') + stars(40, 320, 120, 3) + moon(236, 52, 22, '#0c1434') + hills('#10193d', '#0a1029'),
    dawn: () => sky('d', '#27306e', '#f7b267', '#e07a5f') + stars(14, 320, 60, 5) +
      `<g class="rise"><circle cx="160" cy="150" r="46" fill="#ffd27a" opacity=".25"/><circle cx="160" cy="150" r="30" fill="#ffe2a3"/></g>` +
      rays(160, 150, 40, 54, 14, '#ffe2a3') + hills('#5b3a5e', '#2c2147'),
    sun: () => sky('s', '#3b8ed0', '#cfeaf7') + `<circle cx="230" cy="62" r="40" fill="#ffe08a" opacity=".3"/>` + rays(230, 62, 34, 46, 16, '#ffd45e') +
      `<circle cx="230" cy="62" r="26" fill="#ffd45e"/>` + cloud(70, 60, 1, 'drift') + cloud(150, 104, 0.7, 'drift2', 0.7) + hills('#5fae7b', '#3f8a63'),
    stars: () => sky('st', '#050818', '#1a1f52') + stars(90, 320, 170, 11) +
      `<g class="shoot"><line x1="0" y1="0" x2="46" y2="16" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/><circle cx="46" cy="16" r="2.2" fill="#fff"/></g>` +
      `<g class="spin" style="transform-origin:160px 86px" fill="none" stroke="#f2c66d" stroke-width="1.2" opacity=".7"><rect x="138" y="64" width="44" height="44"/><rect x="138" y="64" width="44" height="44" transform="rotate(45 160 86)"/></g><circle cx="160" cy="86" r="6" fill="#f6d998" class="pulse"/>`,
    mountain: () => sky('m', '#2a2a6a', '#f2a57b', '#a35d86') + stars(16, 320, 60, 9) + moon(62, 44, 14, '#30306f') +
      `<path d="M0 180 L70 84 L118 138 L176 58 L250 150 L290 112 L320 140 V180Z" fill="#3a2b5c"/><path d="M176 58 l-16 22 l14 -6 l8 10 l10 -6z" fill="#fbe9d7" opacity=".85"/><path d="M0 180 L50 132 L110 166 L190 122 L260 168 L320 150 V180Z" fill="#231a3d"/>` +
      `<g transform="translate(246 160)"><rect x="-2.5" y="-26" width="5" height="26" fill="#2b1a12"/><g class="sway" style="transform-origin:0 -26px"><circle cx="0" cy="-36" r="15" fill="#2f7d57"/><circle cx="-11" cy="-28" r="10" fill="#28704d"/><circle cx="11" cy="-28" r="10" fill="#28704d"/></g></g>`,
    river: () => sky('r', '#12495c', '#bfe9df', '#4fb3a5') + cloud(70, 42, 0.8, 'drift', 0.6) + `<path d="M0 118 Q80 92 160 110 T320 100 V180 H0Z" fill="#2c7a64"/>` +
      `<path d="M150 104 C120 126 210 138 150 180 H250 C300 150 190 128 200 104Z" fill="#7fd6e6"/>` +
      [0, 1, 2].map(i => `<path class="flow" style="animation-delay:${i * 0.6}s" d="M${168 + i * 6} ${118 + i * 18} q10 6 20 0 t20 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`).join('') +
      palm(70, 150, 0.8) + palm(284, 158, 0.65),
    kaaba: () => sky('k', '#0b0f2a', '#4a2f5c', '#22214f') + stars(46, 320, 110, 13) + moon(262, 40, 13, '#10143a') +
      `<path d="M0 150 H320 V180 H0Z" fill="#d9c7a3"/><path d="M0 150 H320 V156 H0Z" fill="#b9a57d"/>` +
      `<g class="float-sm"><rect x="118" y="62" width="84" height="90" fill="#121212"/><path d="M202 62 l18 -10 v90 l-18 10z" fill="#050505"/><path d="M118 62 l18 -10 h84 l-18 10z" fill="#1c1c1c"/><rect x="118" y="84" width="84" height="9" fill="#e3b851"/><path d="M202 84 l18 -10 v9 l-18 10z" fill="#b8902f"/><path d="M150 152 v-30 a8 8 0 0 1 16 0 v30z" fill="#e3b851"/></g>` +
      `<ellipse cx="160" cy="156" rx="90" ry="6" fill="#000" opacity=".18"/>`,
    garden: () => sky('g', '#7cc6e8', '#e9f7d8') + `<circle cx="64" cy="48" r="20" fill="#ffe08a"/>` + cloud(210, 46, 0.9, 'drift') +
      `<path d="M0 140 Q90 112 180 134 T320 128 V180 H0Z" fill="#59b377"/><path d="M0 160 Q110 140 200 158 T320 150 V180 H0Z" fill="#3c9463"/>` +
      palm(96, 150, 1) + palm(206, 156, 0.8) + palm(266, 146, 0.9) +
      [40, 150, 240, 300].map((x, i) => `<g class="pulse" style="animation-delay:${i * 0.5}s"><circle cx="${x}" cy="${168 - (i % 2) * 6}" r="3" fill="#ffd45e"/><circle cx="${x}" cy="${168 - (i % 2) * 6}" r="6" fill="#fff" opacity=".35"/></g>`).join(''),
    book: () => sky('b', '#0a1030', '#1d3d5c') + stars(30, 320, 100, 17) +
      `<g class="glow">${[-50, -25, 0, 25, 50].map(a => `<path d="M160 118 l-7 -92 h14z" fill="#f6d998" opacity=".16" transform="rotate(${a} 160 118)"/>`).join('')}</g>` +
      `<g class="float-sm"><path d="M160 112 C140 98 112 96 92 102 V134 C112 128 140 130 160 142Z" fill="#fdf6e3"/><path d="M160 112 C180 98 208 96 228 102 V134 C208 128 180 130 160 142Z" fill="#f4e7c3"/>` +
      [0, 1, 2].map(i => `<path d="M102 ${110 + i * 7} q26 -5 50 6" stroke="#b9a57d" stroke-width="1.4" fill="none"/><path d="M218 ${110 + i * 7} q-26 -5 -50 6" stroke="#b9a57d" stroke-width="1.4" fill="none"/>`).join('') +
      `<path d="M160 112 V142" stroke="#c9a24a" stroke-width="2"/></g><path d="M120 168 L160 140 L200 168 M132 168 L172 146 M188 168 L148 146" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    pattern: () => sky('p', '#0c1336', '#17335a') + stars(26, 320, 180, 21) +
      [56, 40, 24].map((r, i) => `<g class="${i % 2 ? 'spin-rev' : 'spin'}" style="transform-origin:160px 90px" fill="none" stroke="${i === 1 ? '#4fd1b5' : '#f2c66d'}" stroke-width="1.4" opacity="${0.9 - i * 0.15}"><rect x="${160 - r}" y="${90 - r}" width="${r * 2}" height="${r * 2}"/><rect x="${160 - r}" y="${90 - r}" width="${r * 2}" height="${r * 2}" transform="rotate(45 160 90)"/></g>`).join('') +
      `<circle cx="160" cy="90" r="7" fill="#f6d998" class="pulse"/>`
  };

  const MAP = {
    dawn: [113, 89, 93, 74, 100], night: [92, 97, 73, 17, 94], sun: [91, 103, 79],
    stars: [86, 85, 53, 82, 81, 67, 37], mountain: [95, 52, 88, 7, 20], river: [108, 47, 76, 55, 13, 16],
    kaaba: [106, 105, 2, 3, 22, 90, 48, 110, 14], garden: [56, 36, 18, 80, 19, 78, 6], book: [1, 96, 68, 112, 114, 12, 39, 87]
  };
  const byId = {};
  Object.keys(MAP).forEach(k => MAP[k].forEach(id => (byId[id] = k)));

  window.Scenes = {
    forSurah(id) {
      const k = byId[id] || 'pattern';
      return `<svg class="scene" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration">${S[k]()}</svg>`;
    },
    hero() {
      const win = [448, 498, 548, 628, 678, 728].map((x, i) => `<path class="lamp" style="animation-delay:${i * 0.7}s" d="M${x} 404 v-44 a12 12 0 0 1 24 0 v44z" fill="#f2c66d"/>`).join('');
      const minaret = (x) => `<g><rect x="${x}" y="196" width="26" height="224" fill="#0a1230"/><rect x="${x - 6}" y="246" width="38" height="8" rx="2" fill="#0a1230"/><rect x="${x - 4}" y="196" width="34" height="7" rx="2" fill="#0a1230"/><path d="M${x - 2} 196 q15 -52 30 0z" fill="#0a1230"/><line x1="${x + 13}" y1="160" x2="${x + 13}" y2="140" stroke="#f2c66d" stroke-width="2"/><circle cx="${x + 13}" cy="136" r="4" fill="#f2c66d"/><rect class="lamp" x="${x + 8}" y="214" width="10" height="18" rx="5" fill="#f2c66d"/></g>`;
      const lantern = (x, len, d) => `<g class="swing" style="transform-origin:${x}px -260px;animation-delay:${d}s"><line x1="${x}" y1="-260" x2="${x}" y2="${len}" stroke="#c9a24a" stroke-width="1.5"/><g transform="translate(${x} ${len})"><circle cx="0" cy="24" r="34" fill="#f2c66d" opacity=".12" class="pulse"/><path d="M-6 0 h12 l4 8 h-20z" fill="#c9a24a"/><path d="M-12 8 h24 l5 30 h-34z" fill="#f6d998" opacity=".92"/><path d="M-12 8 h24 M-17 38 h34 M0 8 v30 M-8 8 l-3 30 M8 8 l3 30" stroke="#8a6a1f" stroke-width="1.4" fill="none"/><path d="M-17 38 h34 l-6 8 h-22z" fill="#c9a24a"/></g></g>`;
      // tall sky above the skyline so the headline sits in open sky and the mosque stays low
      return `<svg class="hero-svg" viewBox="0 -260 1200 680" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs><linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050818"/><stop offset=".55" stop-color="#121e4e"/><stop offset="1" stop-color="#36407f"/></linearGradient>
        <radialGradient id="hglow" cx=".5" cy="1" r=".6"><stop offset="0" stop-color="#f2c66d" stop-opacity=".32"/><stop offset="1" stop-color="#f2c66d" stop-opacity="0"/></radialGradient></defs>
        <rect y="-260" width="1200" height="680" fill="url(#hsky)"/><rect y="-260" width="1200" height="680" fill="url(#hglow)"/>
        <g transform="translate(0 -260)">${stars(170, 1200, 540, 29)}</g>
        <g class="float"><circle cx="985" cy="-70" r="80" fill="#f2c66d" opacity=".09"/><circle cx="985" cy="-70" r="40" fill="#f6d998"/><circle cx="1002" cy="-78" r="34" fill="#0b1438"/></g>
        <g opacity=".5">${cloud(180, 0, 2.2, 'drift', 0.12)}${cloud(780, 90, 1.8, 'drift2', 0.1)}</g>
        <path d="M0 360 Q200 300 420 346 T820 330 T1200 350 V420 H0Z" fill="#0e1740"/>
        ${lantern(110, -40, 0)}${lantern(215, 30, 0.8)}${lantern(1110, 10, 0.4)}
      </svg>
      <svg class="hero-mosque" viewBox="340 126 520 294" aria-hidden="true">
        ${minaret(372)}${minaret(802)}
        <path d="M500 304 C500 196 700 196 700 304Z" fill="#0a1230"/><line x1="600" y1="224" x2="600" y2="196" stroke="#f2c66d" stroke-width="2.4"/>
        <g transform="translate(600 186)"><circle r="9" fill="#f2c66d"/><circle cx="3.5" cy="-2" r="7.5" fill="#17265c"/></g>
        <path d="M424 304 C424 258 500 258 500 304Z M700 304 C700 258 776 258 776 304Z" fill="#0a1230"/>
        <rect x="416" y="300" width="368" height="120" fill="#0a1230"/>${win}
        <path d="M580 420 v-58 a20 20 0 0 1 40 0 v58z" fill="#f6d998" class="lamp"/>
      </svg>`;
    }
  };
})();
