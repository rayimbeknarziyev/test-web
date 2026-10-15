(function () {
  'use strict';

  function card(icon, tone, value, label, suffix) {
    const v = TF.el('div', { class: 'stat-value', text: '0' });
    if (value === null || value === undefined) v.textContent = '—';
    else TF.countUp(v, value, { suffix: suffix || '' });
    return TF.el('div', { class: 'card stat-card tone-' + tone }, TF.el('div', { class: 'stat-icon' }, TF.icon(icon)), TF.el('div', null, v, TF.el('div', { class: 'stat-label', text: label })));
  }

  function chartCard(title, sub, node, legend) {
    return TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: title }), sub ? TF.el('span', { class: 'small muted', text: sub }) : null), node, legend || null);
  }

  function render(root, d) {
    const t = d.totals;
    const head = TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: 'Statistika' }), TF.el('p', { text: 'Barcha ko‘rsatkichlar haqiqiy urinishlaringiz asosida hisoblanadi.' })));
    if (!t.completed_attempts && !t.questions_answered) {
      TF.mount(root, head, TF.el('div', { class: 'card pad' }, TF.empty('bar-chart-3', 'Statistika hali mavjud emas', 'Birinchi testni yechganingizdan so‘ng natijalar, grafiklar va tahlillar shu yerda paydo bo‘ladi.', [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, TF.icon('play'), 'Test yechishni boshlash')])));
      return;
    }
    const stats = TF.el('div', { class: 'stat-grid' }, card('flag', 'violet', t.completed_attempts, 'Yakunlangan urinishlar'), card('gauge', 'amber', t.average_score, 'O‘rtacha natija', '%'), card('trophy', 'green', t.best_score, 'Eng yaxshi natija', '%'), card('percent', 'blue', t.correct_rate, 'To‘g‘ri javoblar ulushi', '%'), card('list-checks', 'blue', t.questions_answered, 'Javob berilgan savollar'), card('star', 'amber', t.bookmarks, 'Belgilangan savollar'), card('check-check', 'green', t.mistakes_resolved, 'O‘zlashtirilgan xatolar'), card('target', 'red', t.mistakes_unresolved, 'Takrorlash kerak'));
    TF.stagger(stats);

    const history = TF.el('div', { class: 'chart' });
    const daily = TF.el('div', { class: 'chart' });
    const weekly = TF.el('div', { class: 'chart' });

    const subjects = d.by_subject.length ? TF.el('div', null, d.by_subject.map((s) => TF.hbar(`${s.subject} (${s.attempts} urinish)`, s.average))) : TF.empty('book-open', 'Ma’lumot yo‘q', null, [], true);
    const byTest = d.by_test.length ? TF.el('div', null, d.by_test.map((s) => TF.hbar(`${s.title} · eng yaxshi ${s.best}%`, s.average))) : TF.empty('file-text', 'Ma’lumot yo‘q', null, [], true);

    const totalM = t.mistakes_total;
    const revPct = totalM ? Math.round((t.mistakes_resolved / totalM) * 100) : 0;
    const revision = TF.el(
      'div',
      null,
      totalM ? TF.el('div', null, TF.el('div', { class: 'row between', style: 'margin-bottom:8px' }, TF.el('b', { text: `${t.mistakes_resolved} / ${totalM} xato o‘zlashtirildi` }), TF.el('b', { text: revPct + '%' })), TF.el('div', { class: 'progress', style: 'height:12px' }, TF.el('div', { class: 'progress-bar green', style: `width:${revPct}%` })), TF.el('p', { class: 'small muted', style: 'margin-top:10px', text: t.mistakes_unresolved ? `${t.mistakes_unresolved} ta savol hali takrorlashni kutmoqda.` : 'Barcha xatolar o‘zlashtirilgan. Ajoyib!' }), t.mistakes_unresolved ? TF.el('a', { class: 'btn btn-secondary btn-sm', href: TF.page('mistakes.html'), style: 'margin-top:12px' }, 'Xatolarga o‘tish') : null) : TF.empty('smile', 'Xatolar yo‘q', 'Hali xato qilingan savol qayd etilmagan.', [], true)
    );

    TF.mount(
      root,
      head,
      stats,
      TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Natijalar dinamikasi' })),
      TF.el('div', { class: 'grid grid-2' }, chartCard('Oxirgi natijalar', 'Test urinishlari, %', d.score_history.length ? history : TF.empty('line-chart', 'Ma’lumot yo‘q', null, [], true)), chartCard('Yakunlangan urinishlar', 'Oxirgi 30 kun', daily)),
      TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Faollik' })),
      chartCard('Haftalik javoblar', 'Oxirgi 7 kun', weekly, TF.el('div', { class: 'legend' }, TF.el('span', null, TF.el('i', { style: 'background:var(--green)' }), 'To‘g‘ri'), TF.el('span', null, TF.el('i', { style: 'background:var(--red)' }), 'Noto‘g‘ri'), TF.el('span', null, TF.el('i', { style: 'background:var(--blue)' }), 'Baholanmagan'))),
      TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Tahlil' })),
      TF.el('div', { class: 'grid grid-2' }, chartCard('Fanlar bo‘yicha o‘rtacha natija', null, subjects), chartCard('Testlar bo‘yicha o‘rtacha natija', null, byTest)),
      TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Takrorlash jarayoni' })),
      chartCard('Xatolar ustida ishlash', null, revision)
    );

    if (d.score_history.length) TF.charts.line(history, d.score_history.map((h) => ({ label: TF.fmtDate(h.completed_at).slice(0, 5), value: h.percentage })), { label: 'Natijalar tarixi' });
    TF.charts.bars(daily, d.attempts_daily.map((x, i) => ({ label: i % 5 === 0 || i === 29 ? x.date.slice(8) + '.' + x.date.slice(5, 7) : '', segments: [{ value: x.attempts, cls: 'bar-blue' }] })), { slot: 22, label: 'Kunlik urinishlar' });
    TF.charts.bars(weekly, d.weekly.map((w) => ({ label: TF.weekday(w.date), segments: [{ value: w.correct, cls: 'bar-ok' }, { value: w.wrong, cls: 'bar-bad' }, { value: Math.max(0, w.answered - w.correct - w.wrong), cls: 'bar-blue' }] })), { slot: 64, label: 'Haftalik javoblar' });
  }

  (async function () {
    try {
      await TF.init({ auth: 'required', nav: 'statistics' });
    } catch (e) {
      return;
    }
    const root = TF.$('#page');
    TF.mount(root, TF.el('div', { class: 'grid' }, TF.skeletons(4), TF.skeletons(2, 'sk-tall')));
    try {
      render(root, await Api.get('/statistics'));
    } catch (err) {
      TF.mount(root, TF.empty('triangle-alert', 'Statistikani yuklab bo‘lmadi', err.message, [TF.el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Qayta urinish')]));
    }
  })();
})();
