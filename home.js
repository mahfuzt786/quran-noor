/* Homepage (#/): what Noor is, what is free and what full access adds, sign-in and sync, the app and offline use,
   and the policies. The surah list lives at #/surahs. #/home/<section> opens the page at that section
   (full-access, sync, offline), which is where sign-in and payment send people back to. */
(function () {
  'use strict';
  const N = () => window.Noor;

  function view(app, focus) {
    const { h, t, num, store, footer } = N();
    const ch = N().chapters(), lastId = store.get('last', null)?.id, last = lastId && ch.find(c => c.id === lastId);
    const Pro = window.Pro, pay = !!(Pro && Pro.ready()), pro = !!(Pro && Pro.has());

    const feat = (ic, k) => h('div', { class: 'hm-feat' }, h('span', { class: 'hm-ic', 'aria-hidden': 'true' }, ic), h('h3', {}, t('hm_f_' + k)), h('p', {}, t('hm_f_' + k + '_d')));
    const list = (keys) => h('ul', { class: 'hm-list' }, keys.map(k => h('li', {}, t(k))));

    const plans = pay ? h('section', { class: 'sec', id: 'full-access' },
      h('div', { class: 'sec-title' }, h('h2', {}, (pro ? '✓ ' : '🔓 ') + t('hm_plans_t')), h('span', {}, t('hm_plans_sub'))),
      h('div', { class: 'hm-plans' },
        h('div', { class: 'hm-plan' },
          h('div', { class: 'hm-plan-h' }, h('h3', {}, t('hm_free_t')), h('b', { class: 'hm-price' }, t('hm_free_p'))),
          list(['hm_free_1', 'hm_free_2', 'hm_free_3', 'hm_free_4', 'hm_free_5']),
          h('a', { class: 'btn', href: '#/surahs' }, t('hm_free_go'))),
        h('div', { class: 'hm-plan hm-plan-pro' + (pro ? ' have' : '') },
          h('div', { class: 'hm-plan-h' }, h('h3', {}, t('hm_pro_t')), h('b', { class: 'hm-price' }, t('hm_pro_p')), h('span', { class: 'muted small' }, t('hm_pro_once'))),
          list(['hm_pro_1', 'hm_pro_2', 'hm_pro_3', 'hm_pro_4', 'hm_pro_5']),
          Pro.offerBox({ compact: true })))) : null;

    app.replaceChildren(
      h('section', { class: 'hero' }, h('div', { class: 'hero-art', html: window.Scenes.hero() }), h('div', { class: 'hero-in' },
        h('div', { class: 'salam' }, t('salam')),
        h('h1', {}, t('hero_h1')),
        h('p', {}, t('hero_p')),
        h('div', { class: 'cta' },
          h('a', { class: 'btn gold lg', href: '#/s/' + (last ? last.id : 1) }, last ? t('cta_continue', N().sname(last)) : t('cta_start')),
          h('a', { class: 'btn glass', href: '#/learn' }, t('cta_learn')),
          h('a', { class: 'btn glass', href: '#/surahs' }, t('cta_all')),
          h('a', { class: 'btn glass', href: 'surah/' }, '📖 ' + t('hm_pages'))))),
      h('div', { class: 'wrap' },
        window.Goals ? window.Goals.homeCard() : null,
        window.Review ? window.Review.homeCard() : null,

        h('section', { class: 'sec' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('hm_feat_t')), h('span', {}, t('hm_feat_sub'))),
          h('div', { class: 'hm-feats' },
            feat('📖', 'read'), feat('🔤', 'words'), feat('🎓', 'learn'), feat('🎤', 'recite'), feat('🧠', 'hifz'), feat('🔁', 'review'))),

        plans,
        window.Sync ? window.Sync.section() : null,
        window.Offline ? window.Offline.section() : null,

        h('section', { class: 'sec', id: 'faq' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('hm_faq_t')), h('span', {}, t('hm_faq_sub'))),
          h('div', { class: 'hm-faq' }, [1, 2, 3, 4, 5, 6, 7].map(i => h('details', {}, h('summary', {}, t('hm_q' + i)), h('p', {}, t('hm_a' + i)))))),

        h('section', { class: 'sec', id: 'policies' },
          h('div', { class: 'sec-title' }, h('h2', {}, t('hm_pol_t')), h('span', {}, t('hm_pol_sub'))),
          h('div', { class: 'hm-pols' },
            h('a', { class: 'hm-pol', href: 'privacy.html' }, h('b', {}, '🔒 ' + t('sy_privacy_link')), h('span', {}, t('hm_pol_privacy'))),
            h('a', { class: 'hm-pol', href: 'terms.html' }, h('b', {}, '📄 ' + t('hm_terms')), h('span', {}, t('hm_pol_terms'))),
            h('a', { class: 'hm-pol', href: 'refund.html' }, h('b', {}, '↩ ' + t('hm_refund')), h('span', {}, t('hm_pol_refund'))),
            h('a', { class: 'hm-pol', href: 'mailto:mahfuzz786@gmail.com' }, h('b', {}, '✉ ' + t('hm_contact')), h('span', {}, 'mahfuzz786@gmail.com · +91 96788 38912')))),
        footer()));

    if (focus) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' }), 60);
    else window.scrollTo(0, 0);
  }

  window.Home = { view };
})();
