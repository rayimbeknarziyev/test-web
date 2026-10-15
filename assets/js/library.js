(function () {
  'use strict';

  const state = { q: '', subject: '', sort: 'newest', page: 1 };
  let root;
  let grid;
  let pager;
  let subjectSel;
  let user;

  function scoreBox(label, value) {
    return TF.el('div', null, TF.el('b', { text: value === null || value === undefined ? '—' : value + '%' }), TF.el('span', { text: label }));
  }

  async function renameModal(t) {
    const form = TF.el(
      'form',
      { novalidate: true },
      TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'rn-title', text: 'Test nomi' }), TF.el('input', { class: 'input', id: 'rn-title', name: 'title', value: t.title, maxlength: 200 })),
      TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'rn-subject', text: 'Fan (ixtiyoriy)' }), TF.el('input', { class: 'input', id: 'rn-subject', name: 'subject', value: t.subject || '', maxlength: 100 })),
      TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'rn-desc', text: 'Tavsif (ixtiyoriy)' }), TF.el('textarea', { class: 'textarea', id: 'rn-desc', name: 'description', maxlength: 2000 }, t.description || ''))
    );
    form.addEventListener('submit', (e) => e.preventDefault());
    const res = await TF.modal({
      title: 'Test ma’lumotlarini tahrirlash',
      icon: 'pencil',
      body: form,
      actions: [
        { label: 'Bekor qilish', value: false, variant: 'btn-ghost' },
        {
          label: 'Saqlash',
          variant: 'btn-primary',
          handler: async () => {
            const v = Object.fromEntries(new FormData(form).entries());
            if (!v.title.trim()) {
              TF.setErrors(form, { title: 'Test nomini kiriting.' });
              return false;
            }
            try {
              await Api.patch('/tests/' + t.id, { title: v.title, subject: v.subject, description: v.description });
              return true;
            } catch (err) {
              if (err.status === 422) TF.setErrors(form, err.errors);
              else TF.toast('error', err.message);
              return false;
            }
          }
        }
      ]
    });
    if (res === true) {
      TF.toast('success', 'Test yangilandi.');
      load();
    }
  }

  async function removeTest(t) {
    const ok = await TF.confirm('Testni o‘chirasizmi?', `“${t.title}” kutubxonadan olib tashlanadi. Avvalgi urinishlar natijalari tarixda saqlanib qoladi.`, { danger: true, ok: 'O‘chirish' });
    if (!ok) return;
    try {
      await Api.del('/tests/' + t.id);
      TF.toast('success', 'Test o‘chirildi.');
      load();
    } catch (err) {
      TF.toast('error', err.message);
    }
  }

  function menu(t) {
    const wrap = TF.el('div', { class: 'menu-btn' });
    const btn = TF.el('button', { type: 'button', class: 'btn btn-secondary btn-icon', 'aria-label': 'Boshqa amallar', 'aria-haspopup': 'true' }, TF.icon('ellipsis'));
    let dd = null;
    const close = () => {
      if (dd) dd.remove();
      dd = null;
      document.removeEventListener('click', outside, true);
    };
    const outside = (e) => {
      if (!wrap.contains(e.target)) close();
    };
    btn.addEventListener('click', () => {
      if (dd) return close();
      dd = TF.el(
        'div',
        { class: 'dropdown' },
        TF.el('button', { type: 'button', onclick: () => (close(), renameModal(t)) }, TF.icon('pencil'), 'Nom va tavsifni tahrirlash'),
        TF.el('button', { type: 'button', onclick: () => (location.href = TF.page('import.html') + '?edit=' + t.id) }, TF.icon('list-checks'), 'Savollarni tahrirlash'),
        TF.el('button', { type: 'button', class: 'danger', onclick: () => (close(), removeTest(t)) }, TF.icon('trash-2'), 'O‘chirish')
      );
      wrap.append(dd);
      setTimeout(() => document.addEventListener('click', outside, true), 0);
    });
    wrap.append(btn);
    return wrap;
  }

  function card(t) {
    const actions = TF.el('div', { class: 'card-actions' });
    if (t.unfinished_attempt_id) {
      actions.append(TF.el('a', { class: 'btn btn-success', href: TF.page('test.html') + '?attempt=' + t.unfinished_attempt_id }, TF.icon('play'), 'Davom ettirish'));
      actions.append(TF.el('a', { class: 'btn btn-secondary', href: TF.page('test.html') + '?test=' + t.id }, TF.icon('rotate-cw'), 'Yangi'));
    } else {
      actions.append(TF.el('a', { class: 'btn btn-primary', href: TF.page('test.html') + '?test=' + t.id }, TF.icon('play'), 'Boshlash'));
    }
    actions.append(menu(t));
    return TF.el(
      'article',
      { class: 'card test-card hover' },
      TF.el('div', { class: 'row between' }, t.subject ? TF.el('span', { class: 'badge badge-violet', text: t.subject }) : TF.el('span', { class: 'badge badge-gray' }, 'Fan ko‘rsatilmagan'), t.unfinished_attempt_id ? TF.el('span', { class: 'badge badge-amber' }, TF.icon('pause'), 'Tugallanmagan') : null),
      TF.el('h3', { text: t.title }),
      t.description ? TF.el('p', { class: 'desc', text: t.description }) : null,
      TF.el('div', { class: 'meta-row' }, TF.el('span', { class: 'badge' }, TF.icon('list-checks'), `${t.question_count} ta savol`), TF.el('span', { class: 'badge badge-gray' }, TF.icon('history'), `${t.attempts_count} ta urinish`), t.current_version > 1 ? TF.el('span', { class: 'badge badge-gray', text: 'v' + t.current_version }) : null),
      TF.el('div', { class: 'mini-stats' }, scoreBox('Eng yaxshi', t.best_score), scoreBox('Oxirgi', t.latest_score), TF.el('div', null, TF.el('b', { text: t.last_attempt_at ? TF.fmtDate(t.last_attempt_at) : '—' }), TF.el('span', { text: 'Oxirgi urinish' }))),
      actions
    );
  }

  function renderPager(total, per) {
    TF.clear(pager);
    const pages = Math.ceil(total / per);
    if (pages <= 1) return;
    pager.append(
      TF.el('button', { class: 'btn btn-secondary btn-sm', disabled: state.page <= 1, onclick: () => ((state.page -= 1), load()) }, TF.icon('chevron-left'), 'Oldingi'),
      TF.el('span', { class: 'muted', text: `${state.page} / ${pages}` }),
      TF.el('button', { class: 'btn btn-secondary btn-sm', disabled: state.page >= pages, onclick: () => ((state.page += 1), load()) }, 'Keyingi', TF.icon('chevron-right'))
    );
  }

  async function load() {
    TF.mount(grid, TF.skeletons(3, 'sk-tall'));
    const qs = new URLSearchParams({ page: state.page, per_page: 12, sort: state.sort });
    if (state.q) qs.set('q', state.q);
    if (state.subject) qs.set('subject', state.subject);
    try {
      const d = await Api.get('/tests?' + qs.toString());
      const cur = subjectSel.value;
      TF.mount(subjectSel, TF.el('option', { value: '', text: 'Barcha fanlar' }), d.subjects.map((s) => TF.el('option', { value: s, text: s })));
      subjectSel.value = d.subjects.includes(cur) ? cur : '';
      TF.clear(grid);
      if (!d.items.length) {
        const filtered = state.q || state.subject;
        grid.append(TF.el('div', { class: 'card pad', style: 'grid-column:1/-1' }, filtered ? TF.empty('search-x', 'Hech narsa topilmadi', 'Qidiruv yoki filtrni o‘zgartirib ko‘ring.') : TF.empty('library', 'Kutubxonangiz bo‘sh', 'Birinchi test faylingizni yuklang va o‘qishni boshlang.', [TF.el('a', { class: 'btn btn-primary', href: TF.page('import.html') }, TF.icon('upload-cloud'), 'Test yuklash')])));
        TF.clear(pager);
        return;
      }
      d.items.forEach((t) => grid.append(card(t)));
      TF.stagger(grid);
      renderPager(d.total, d.per_page);
    } catch (err) {
      TF.mount(grid, TF.el('div', { class: 'card pad', style: 'grid-column:1/-1' }, TF.empty('triangle-alert', 'Yuklab bo‘lmadi', err.message, [TF.el('button', { class: 'btn btn-primary', onclick: load }, 'Qayta urinish')])));
    }
  }

  (async function () {
    try {
      user = await TF.init({ auth: 'required', nav: 'library' });
    } catch (e) {
      return;
    }
    root = TF.$('#page');
    const search = TF.el('input', { class: 'input', type: 'search', placeholder: 'Test nomi bo‘yicha qidirish…', 'aria-label': 'Qidirish' });
    subjectSel = TF.el('select', { class: 'select', 'aria-label': 'Fan' }, TF.el('option', { value: '', text: 'Barcha fanlar' }));
    const sortSel = TF.el('select', { class: 'select', 'aria-label': 'Saralash' }, [['newest', 'Eng yangi'], ['oldest', 'Eng eski'], ['attempted', 'Oxirgi urinish']].map(([v, l]) => TF.el('option', { value: v, text: l })));
    grid = TF.el('div', { class: 'test-grid' });
    pager = TF.el('div', { class: 'pager' });
    TF.mount(
      root,
      TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: 'Testlarim' }), TF.el('p', { text: 'Shaxsiy test kutubxonangiz.' })), TF.el('div', { class: 'actions' }, TF.el('a', { class: 'btn btn-primary', href: TF.page('import.html') }, TF.icon('plus'), 'Yangi test'))),
      TF.el('div', { class: 'toolbar' }, TF.el('div', { class: 'search input-group' }, TF.icon('search'), search), subjectSel, sortSel),
      grid,
      pager
    );
    search.addEventListener('input', TF.debounce(() => ((state.q = search.value.trim()), (state.page = 1), load()), 300));
    subjectSel.addEventListener('change', () => ((state.subject = subjectSel.value), (state.page = 1), load()));
    sortSel.addEventListener('change', () => ((state.sort = sortSel.value), (state.page = 1), load()));
    load();
  })();
})();
