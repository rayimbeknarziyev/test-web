(function () {
  'use strict';

  const modeLabel = (a) => (a.source !== 'test' ? (a.source === 'mistakes' ? 'Xatolar' : 'Belgilangan') : a.mode === 'exam' ? 'Imtihon' : 'Mashq');

  function statCard(icon, tone, value, label, suffix) {
    const v = TF.el('div', { class: 'stat-value', text: '0' });
    if (value === null || value === undefined) v.textContent = '—';
    else TF.countUp(v, value, { suffix: suffix || '' });
    return TF.el('div', { class: 'card stat-card tone-' + tone }, TF.el('div', { class: 'stat-icon' }, TF.icon(icon)), TF.el('div', null, v, TF.el('div', { class: 'stat-label', text: label })));
  }

  function attemptRow(a) {
    return TF.el(
      'a',
      { class: 'list-item', href: TF.page('results.html') + '?attempt=' + a.id },
      TF.el('div', { class: 'score-dot ' + TF.scoreClass(a.percentage), text: a.percentage + '%' }),
      TF.el('div', { class: 'grow' }, TF.el('div', { class: 'title', text: a.test_title }), TF.el('div', { class: 'small muted', text: `${modeLabel(a)} · ${a.correct_count}/${a.total_questions} · ${TF.fmtDate(a.completed_at, true)}` })),
      TF.icon('chevron-right')
    );
  }

  function recommendations(d) {
    const t = d.totals;
    const out = [];
    d.weak_areas.forEach((w) => {
      out.push({
        icon: 'target',
        title: `“${w.title}” — aniqlik ${w.accuracy}%`,
        text: w.unresolved > 0 ? `${w.unresolved} ta xato savol hali o‘zlashtirilmagan. Ular ustida ishlang.` : 'Testni yana bir marta yechib ko‘ring.',
        action: w.unresolved > 0 ? { label: 'Takrorlash', run: () => TF.startAttempt(w.test_id, { mode: 'practice', source: 'mistakes' }) } : { label: 'Boshlash', href: TF.page('test.html') + '?test=' + w.test_id }
      });
    });
    if (t.tests > 0 && !t.studied_today) out.push({ icon: 'flame', title: 'Bugun hali mashq qilmadingiz', text: t.streak > 0 ? `${t.streak} kunlik seriyani saqlab qolish uchun bugun ham mashq qiling.` : 'Kuniga bir necha savol ham katta natija beradi.', action: { label: 'Testlarga o‘tish', href: TF.page('library.html') } });
    if (t.bookmarks > 0) out.push({ icon: 'star', title: `${t.bookmarks} ta belgilangan savol`, text: 'Belgilangan savollarni qayta ko‘rib chiqing.', action: { label: 'Ko‘rish', href: TF.page('mistakes.html') + '?tab=bookmarks' } });
    return out.slice(0, 4);
  }

  function render(root, user, d) {
    const t = d.totals;
    TF.clear(root);
    const first = user.name.split(' ')[0];
    const welcome = TF.el(
      'section',
      { class: 'welcome' },
      TF.el('div', null, TF.el('h1', { text: `Salom, ${first}! 👋` }), TF.el('p', { text: t.tests ? 'Bilimingizni mustahkamlash uchun bugun ham mashq qiling.' : 'Boshlash uchun birinchi test faylingizni yuklang.' }), TF.el('div', { class: 'chips' }, TF.el('span', { class: 'pill' }, TF.icon('flame'), `${t.streak} kunlik seriya`), TF.el('span', { class: 'pill' }, TF.icon('check-check'), `Bugun: ${t.today_answered} ta javob`))),
      TF.el('div', { class: 'row wrap' }, TF.el('a', { class: 'btn btn-primary btn-lg', href: TF.page('import.html') }, TF.icon('upload-cloud'), 'Test yuklash'), t.tests ? TF.el('a', { class: 'btn btn-lg', style: 'background:rgba(255,255,255,.14);color:#fff', href: TF.page('library.html') }, TF.icon('library'), 'Testlarim') : null)
    );
    root.append(welcome);

    if (!t.tests && !t.completed_attempts) {
      root.append(TF.el('div', { class: 'card pad', style: 'margin-top:22px' }, TF.empty('rocket', 'Hali hech narsa yo‘q — keling, boshlaymiz!', 'Excel, CSV yoki Word faylidagi savollaringizni yuklang. Biz ularni interaktiv testga aylantiramiz, natijalaringiz esa shu yerda real vaqtda ko‘rinadi.', [TF.el('a', { class: 'btn btn-primary btn-lg', href: TF.page('import.html') }, TF.icon('upload-cloud'), 'Birinchi testni yuklash')])));
      return;
    }

    const stats = TF.el(
      'div',
      { class: 'stat-grid', style: 'margin-top:22px' },
      statCard('library', 'blue', t.tests, 'Saqlangan testlar'),
      statCard('flag', 'violet', t.completed_attempts, 'Yakunlangan urinishlar'),
      statCard('gauge', 'amber', t.average_score, 'O‘rtacha natija', '%'),
      statCard('trophy', 'green', t.best_score, 'Eng yaxshi natija', '%'),
      statCard('list-checks', 'blue', t.questions_answered, 'Javob berilgan savollar'),
      statCard('circle-check', 'green', t.correct, 'To‘g‘ri javoblar'),
      statCard('circle-x', 'red', t.incorrect, 'Noto‘g‘ri javoblar'),
      statCard('percent', 'violet', t.correct_rate, 'To‘g‘ri javoblar ulushi', '%')
    );
    TF.stagger(stats);
    root.append(stats);

    if (d.unfinished.length) {
      const list = TF.el('div', { class: 'grid grid-2', style: 'margin-top:22px' });
      d.unfinished.slice(0, 2).forEach((u) => {
        const pct = Math.round((u.answered_count / u.total_questions) * 100);
        list.append(
          TF.el(
            'div',
            { class: 'card pad hover' },
            TF.el('div', { class: 'row between' }, TF.el('span', { class: 'badge badge-amber' }, TF.icon('pause'), 'Tugallanmagan'), TF.el('span', { class: 'small muted', text: modeLabel(u) })),
            TF.el('h3', { style: 'margin:12px 0 4px;overflow-wrap:anywhere', text: u.test_title }),
            TF.el('div', { class: 'small muted', text: `${u.answered_count} / ${u.total_questions} savolga javob berildi` }),
            TF.el('div', { class: 'progress', style: 'margin:12px 0 16px' }, TF.el('div', { class: 'progress-bar', style: `width:${pct}%` })),
            TF.el('a', { class: 'btn btn-primary btn-block', href: TF.page('test.html') + '?attempt=' + u.id }, TF.icon('play'), 'Davom ettirish')
          )
        );
      });
      root.append(TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Davom ettirish' })), list);
    }

    const chart = TF.el('div', { class: 'chart' });
    const weekCard = TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Haftalik faollik' }), TF.el('span', { class: 'small muted', text: 'Oxirgi 7 kun' })), chart, TF.el('div', { class: 'legend' }, TF.el('span', null, TF.el('i', { style: 'background:var(--green)' }), 'To‘g‘ri'), TF.el('span', null, TF.el('i', { style: 'background:var(--red)' }), 'Noto‘g‘ri'), TF.el('span', null, TF.el('i', { style: 'background:var(--blue)' }), 'Baholanmagan')));
    const recs = recommendations(d);
    const recCard = TF.el(
      'div',
      { class: 'card pad' },
      TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Zaif tomonlar va tavsiyalar' })),
      recs.length
        ? TF.el(
            'div',
            { class: 'list' },
            recs.map((r) =>
              TF.el(
                'div',
                { class: 'list-item' },
                TF.el('div', { class: 'stat-icon', style: 'width:40px;height:40px;border-radius:12px' }, TF.icon(r.icon)),
                TF.el('div', { class: 'grow' }, TF.el('div', { style: 'font-weight:600;overflow-wrap:anywhere', text: r.title }), TF.el('div', { class: 'small muted', text: r.text })),
                r.action.href ? TF.el('a', { class: 'btn btn-secondary btn-sm', href: r.action.href }, r.action.label) : TF.el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: (e) => TF.busy(e.currentTarget, () => r.action.run().catch((er) => TF.toast('error', er.message))) }, r.action.label)
              )
            )
          )
        : TF.empty('sparkles', 'Hozircha tavsiyalar yo‘q', 'Bir nechta test yechganingizdan so‘ng zaif mavzularingiz shu yerda ko‘rinadi.', [], true)
    );
    root.append(TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Faollik va tavsiyalar' })), TF.el('div', { class: 'split' }, weekCard, recCard));
    TF.charts.bars(
      chart,
      d.weekly.map((w) => ({ label: TF.weekday(w.date), segments: [{ value: w.correct, cls: 'bar-ok' }, { value: w.wrong, cls: 'bar-bad' }, { value: Math.max(0, w.answered - w.correct - w.wrong), cls: 'bar-blue' }] })),
      { label: 'Haftalik faollik', slot: 56 }
    );

    const recent = TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'So‘nggi urinishlar' })), d.recent_attempts.length ? TF.el('div', { class: 'list' }, d.recent_attempts.map(attemptRow)) : TF.empty('history', 'Hali urinish yo‘q', 'Birinchi testni yeching — natija shu yerda paydo bo‘ladi.', [], true));
    const tests = TF.el(
      'div',
      { class: 'card pad' },
      TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Yaqinda yuklangan testlar' }), TF.el('a', { class: 'small', href: TF.page('library.html') }, 'Hammasi')),
      d.recent_tests.length
        ? TF.el(
            'div',
            { class: 'list' },
            d.recent_tests.map((x) =>
              TF.el('a', { class: 'list-item', href: TF.page('test.html') + '?test=' + x.id }, TF.el('div', { class: 'stat-icon', style: 'width:40px;height:40px;border-radius:12px' }, TF.icon('file-text')), TF.el('div', { class: 'grow' }, TF.el('div', { class: 'title', text: x.title }), TF.el('div', { class: 'small muted', text: `${x.question_count} ta savol · ${TF.fmtDate(x.created_at)}` })), TF.icon('play'))
            )
          )
        : TF.empty('upload-cloud', 'Testlar yo‘q', null, [], true)
    );
    root.append(TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Tarix' })), TF.el('div', { class: 'grid grid-2' }, recent, tests));
  }

  (async function () {
    let user;
    try {
      user = await TF.init({ auth: 'required', nav: 'dashboard' });
    } catch (e) {
      return;
    }
    const root = TF.$('#page');
    TF.mount(root, TF.el('div', { class: 'grid' }, TF.skeletons(1, 'sk-tall'), TF.skeletons(4)));
    try {
      render(root, user, await Api.get('/statistics'));
    } catch (err) {
      TF.mount(root, TF.empty('triangle-alert', 'Ma’lumotlarni yuklab bo‘lmadi', err.message, [TF.el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Qayta urinish')]));
    }
  })();
})();
