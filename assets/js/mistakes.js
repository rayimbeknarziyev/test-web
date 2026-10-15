(function () {
  'use strict';

  let tab = TF.query.get('tab') === 'bookmarks' ? 'bookmarks' : 'mistakes';
  let root;
  let body;
  const store = { mistakes: { groups: new Map(), page: 0, total: 0, loaded: false }, bookmarks: { groups: new Map(), page: 0, total: 0, loaded: false } };

  function merge(kind, d) {
    const s = store[kind];
    d.groups.forEach((g) => {
      const ex = s.groups.get(g.test_id);
      if (ex) ex.items.push(...g.items);
      else s.groups.set(g.test_id, g);
    });
    s.page = d.page;
    s.total = d.total;
    s.loaded = true;
  }

  async function toggleBookmark(item, btn) {
    btn.disabled = true;
    try {
      if (item.bookmark_id) {
        await Api.del('/bookmarks/' + item.bookmark_id);
        item.bookmark_id = null;
        TF.toast('info', 'Belgi olib tashlandi.', 1800);
      } else {
        item.bookmark_id = (await Api.post('/bookmarks', { question_id: item.question_id })).id;
        TF.toast('success', 'Savol belgilandi.', 1800);
      }
      store.bookmarks = { groups: new Map(), page: 0, total: 0, loaded: false };
      paint();
    } catch (err) {
      TF.toast('error', err.message);
      btn.disabled = false;
    }
  }

  function mistakeItem(it) {
    const starBtn = TF.el('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm star-btn' + (it.bookmark_id ? ' on' : ''), 'aria-label': it.bookmark_id ? 'Belgini olib tashlash' : 'Belgilash' }, TF.icon('star'));
    starBtn.addEventListener('click', () => toggleBookmark(it, starBtn));
    return TF.el(
      'div',
      { class: 'card m-item' },
      TF.el('div', { class: 'row between', style: 'align-items:flex-start' }, TF.el('div', { class: 'q break', text: it.text }), starBtn),
      it.last_selected ? TF.el('div', { class: 'ans-line ' + (it.resolved ? 'gray' : 'red') }, TF.icon('x'), TF.el('span', null, TF.el('b', { text: 'Oxirgi tanlov: ' }), it.last_selected)) : null,
      TF.el('div', { class: 'ans-line green' }, TF.icon('check'), TF.el('span', null, TF.el('b', { text: 'To‘g‘ri javob: ' }), it.correct_answer || '—')),
      TF.el('div', { class: 'meta-row' }, TF.el('span', { class: 'badge badge-red' }, TF.icon('repeat'), `${it.wrong_count} marta xato`), it.resolved ? TF.el('span', { class: 'badge badge-green' }, TF.icon('check-check'), 'O‘zlashtirilgan') : TF.el('span', { class: 'badge badge-amber' }, 'Takrorlash kerak'), TF.el('span', { class: 'small muted', text: TF.fmtDate(it.last_at, true) }))
    );
  }

  function bookmarkItem(it) {
    const rm = TF.el('button', { type: 'button', class: 'btn btn-ghost btn-icon btn-sm star-btn on', 'aria-label': 'Belgini olib tashlash' }, TF.icon('star'));
    rm.addEventListener('click', async () => {
      rm.disabled = true;
      try {
        await Api.del('/bookmarks/' + it.id);
        TF.toast('info', 'Belgi olib tashlandi.', 1800);
        store.bookmarks = { groups: new Map(), page: 0, total: 0, loaded: false };
        store.mistakes = { groups: new Map(), page: 0, total: 0, loaded: false };
        paint();
      } catch (err) {
        TF.toast('error', err.message);
        rm.disabled = false;
      }
    });
    return TF.el('div', { class: 'card m-item' }, TF.el('div', { class: 'row between', style: 'align-items:flex-start' }, TF.el('div', { class: 'q break', text: it.text }), rm), it.correct_answer ? TF.el('div', { class: 'ans-line green' }, TF.icon('check'), TF.el('span', null, TF.el('b', { text: 'To‘g‘ri javob: ' }), it.correct_answer)) : TF.el('div', { class: 'ans-line gray' }, TF.icon('lock'), 'Imtihon yakunlangach javob ko‘rinadi.'));
  }

  function groupBlock(g, kind) {
    const count = kind === 'mistakes' ? g.unresolved_count : g.bookmark_count;
    return TF.el(
      'section',
      { class: 'm-group' },
      TF.el('div', { class: 'section-title', style: 'margin-top:0' }, TF.el('div', null, TF.el('h2', { class: 'break', text: g.title }), TF.el('span', { class: 'small muted', text: kind === 'mistakes' ? `${g.unresolved_count} ta savol takrorlashni kutmoqda` : `${g.bookmark_count} ta belgilangan savol` })), count > 0 ? TF.el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: (e) => TF.busy(e.currentTarget, () => TF.startAttempt(g.test_id, { mode: 'practice', source: kind }).catch((er) => TF.toast('error', er.message))) }, TF.icon('play'), `Takrorlash (${count})`) : null),
      TF.el('div', { class: 'stack stagger' }, g.items.map((it, i) => ((c) => (c.style.setProperty('--i', Math.min(i, 8)), c))(kind === 'mistakes' ? mistakeItem(it) : bookmarkItem(it))))
    );
  }

  async function load(kind, more) {
    const s = store[kind];
    const path = kind === 'mistakes' ? '/mistakes' : '/bookmarks';
    const d = await Api.get(`${path}?page=${more ? s.page + 1 : 1}&per_page=30`);
    merge(kind, d);
  }

  async function paint() {
    const kind = tab;
    const s = store[kind];
    if (!s.loaded) {
      TF.mount(body, TF.skeletons(3, 'sk-tall'));
      try {
        await load(kind, false);
      } catch (err) {
        TF.mount(body, TF.empty('triangle-alert', 'Yuklab bo‘lmadi', err.message, [TF.el('button', { class: 'btn btn-primary', onclick: paint }, 'Qayta urinish')]));
        return;
      }
    }
    if (tab !== kind) return;
    const groups = Array.from(s.groups.values());
    if (!groups.length) {
      TF.mount(body, TF.el('div', { class: 'card pad' }, kind === 'mistakes' ? TF.empty('party-popper', 'Hozircha xatolar yo‘q', 'Test yechganingizda xato qilingan savollar shu yerda to‘planadi va ularni qayta mashq qilishingiz mumkin.', [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, 'Testlarga o‘tish')]) : TF.empty('star', 'Belgilangan savollar yo‘q', 'Test paytida savol yonidagi yulduzchani bosib, uni keyinchalik takrorlash uchun belgilang.', [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, 'Testlarga o‘tish')])));
      return;
    }
    const shown = groups.reduce((n, g) => n + g.items.length, 0);
    TF.mount(body, groups.map((g) => groupBlock(g, kind)), shown < s.total ? TF.el('div', { class: 'center' }, TF.el('button', { class: 'btn btn-secondary', type: 'button', onclick: (e) => TF.busy(e.currentTarget, async () => (await load(kind, true), paint())) }, `Yana yuklash (${s.total - shown})`)) : null);
  }

  (async function () {
    try {
      await TF.init({ auth: 'required', nav: 'mistakes' });
    } catch (e) {
      return;
    }
    root = TF.$('#page');
    body = TF.el('div');
    const tabs = TF.el('div', { class: 'tabs', role: 'tablist' });
    const paintTabs = () =>
      TF.mount(
        tabs,
        [['mistakes', 'target', 'Xatolarim'], ['bookmarks', 'star', 'Belgilanganlar']].map(([k, i, l]) => TF.el('button', { type: 'button', role: 'tab', class: 'tab' + (tab === k ? ' active' : ''), 'aria-selected': String(tab === k), onclick: () => ((tab = k), paintTabs(), paint()) }, TF.icon(i), l))
      );
    TF.mount(root, TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: 'Xatolar ustida ishlash' }), TF.el('p', { text: 'Xato qilgan va belgilagan savollaringizni qayta mashq qiling.' }))), TF.el('div', { style: 'margin-bottom:22px' }, tabs), body);
    paintTabs();
    paint();
  })();
})();
