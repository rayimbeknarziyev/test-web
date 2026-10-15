(function () {
  'use strict';

  const id = Number(TF.query.get('attempt')) || 0;
  const C = 2 * Math.PI * 70;
  let A;
  let root;

  const message = (p) => (p >= 90 ? 'Ajoyib natija! Mavzuni mukammal o‘zlashtirgansiz. 🎉' : p >= 70 ? 'Yaxshi natija! Biroz takrorlash bilan yanada yaxshilanadi.' : p >= 50 ? 'Qoniqarli. Xatolaringizni ko‘rib chiqing va qayta urinib ko‘ring.' : 'Hali mashq kerak. Xatolar ustida ishlab, qayta urinib ko‘ring — albatta ulgurasiz! 💪');
  const modeText = (a) => (a.source === 'mistakes' ? 'Xatolarni takrorlash' : a.source === 'bookmarks' ? 'Belgilanganlarni takrorlash' : a.mode === 'exam' ? 'Imtihon rejimi' : 'Mashq rejimi');

  function statCard(icon, tone, value, label) {
    return TF.el('div', { class: 'card stat-card tone-' + tone }, TF.el('div', { class: 'stat-icon' }, TF.icon(icon)), TF.el('div', null, TF.el('div', { class: 'stat-value', text: String(value) }), TF.el('div', { class: 'stat-label', text: label })));
  }

  async function retry(btn) {
    await TF.busy(btn, async () => {
      try {
        const total = A.total_questions;
        const body = A.source === 'test' ? { mode: A.mode, count: [25, 30, 50].includes(total) ? total : 'all' } : { mode: 'practice', source: A.source };
        await TF.startAttempt(A.test_id, body);
      } catch (err) {
        TF.toast('error', err.message);
      }
    });
  }

  async function showReview(holder, btn) {
    await TF.busy(btn, async () => {
      try {
        const d = await Api.get(`/attempts/${id}/review`);
        let filter = 'all';
        const list = TF.el('div', { class: 'stack' });
        const chips = TF.el('div', { class: 'chips', style: 'margin-bottom:16px' });
        const paint = () => {
          TF.mount(
            chips,
            [['all', 'Hammasi', d.questions.length], ['correct', 'To‘g‘ri', d.questions.filter((q) => q.status === 'correct').length], ['wrong', 'Noto‘g‘ri', d.questions.filter((q) => q.status === 'wrong').length], ['unanswered', 'Javobsiz', d.questions.filter((q) => q.status === 'unanswered').length]].map(([k, l, n]) => TF.el('button', { type: 'button', class: 'chip' + (filter === k ? ' active' : ''), onclick: () => ((filter = k), paint()) }, `${l} (${n})`))
          );
          TF.mount(
            list,
            d.questions
              .filter((q) => filter === 'all' || q.status === filter)
              .map((q) => {
                const labels = { correct: ['badge-green', 'To‘g‘ri', 'circle-check'], wrong: ['badge-red', 'Noto‘g‘ri', 'circle-x'], unanswered: ['badge-amber', 'Javobsiz', 'circle-help'] }[q.status];
                return TF.el(
                  'article',
                  { class: 'card review-item ' + q.status },
                  TF.el('div', { class: 'row between' }, TF.el('span', { class: 'small muted', style: 'font-weight:700', text: `Savol ${q.number}` }), TF.el('span', { class: 'badge ' + labels[0] }, TF.icon(labels[2]), labels[1])),
                  TF.el('div', { class: 'rv-q', text: q.text }),
                  q.options.map((o) => TF.el('div', { class: 'rv-opt' + (o.is_correct ? ' ok' : o.selected ? ' bad' : '') }, TF.el('span', { text: o.text }), o.is_correct && o.selected ? TF.el('span', { class: 'tag', text: '✓ Sizning javobingiz' }) : o.is_correct ? TF.el('span', { class: 'tag', text: '✓ To‘g‘ri javob' }) : o.selected ? TF.el('span', { class: 'tag', text: '✗ Sizning javobingiz' }) : null)),
                  q.explanation ? TF.el('p', { class: 'small muted break', style: 'margin-top:10px', text: 'Izoh: ' + q.explanation }) : null
                );
              })
          );
        };
        paint();
        TF.mount(holder, TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Javoblarni ko‘rib chiqish' })), chips, list);
        holder.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        TF.toast('error', err.message);
      }
    });
  }

  async function printReport() {
    const include = TF.el('input', { type: 'checkbox', id: 'inc-rev' });
    const body = TF.el('div', null, TF.el('p', { style: 'margin-bottom:14px', text: 'Hisobot brauzerning chop etish oynasida ochiladi. “PDF sifatida saqlash” ni tanlab, PDF olishingiz mumkin.' }), TF.el('label', { class: 'check', style: 'color:var(--text)' }, include, 'Savollar bo‘yicha batafsil tahlilni qo‘shish'));
    const ok = await TF.modal({
      title: 'Hisobotni chop etish / PDF',
      icon: 'printer',
      body,
      actions: [
        { label: 'Bekor qilish', value: false, variant: 'btn-ghost' },
        { label: 'Hisobotni ochish', icon: 'file-down', variant: 'btn-primary', value: true }
      ]
    });
    if (!ok) return;
    try {
      const d = await Api.get(`/attempts/${id}/report?review=${include.checked ? 1 : 0}`);
      const r = d.attempt.result;
      const rows = [['Test nomi', d.attempt.test_title], ['Rejim', modeText(d.attempt)], ['Talaba', d.student], ['Urinish sanasi', TF.fmtDate(d.attempt.completed_at, true)], ['Jami savollar', r.total], ['To‘g‘ri javoblar', r.correct], ['Noto‘g‘ri javoblar', r.incorrect], ['Javobsiz savollar', r.unanswered], ['Ball', `${r.score} / ${r.total}`], ['Natija', r.percentage + '%']];
      const sheet = TF.el('div', { class: 'print-sheet' }, TF.el('h1', { text: 'TestFlow Pro — natija hisoboti' }), TF.el('div', { class: 'p-sub', text: 'Hisobot yaratilgan sana: ' + TF.fmtDate(d.generated_at, true) }), TF.el('table', null, rows.map(([k, v]) => TF.el('tr', null, TF.el('th', { text: k }), TF.el('td', { text: String(v) })))));
      if (d.review) {
        sheet.append(TF.el('h2', { text: 'Savollar tahlili', style: 'margin:12pt 0 8pt' }));
        d.review.forEach((q) => {
          sheet.append(TF.el('div', { class: 'p-q' }, TF.el('b', { text: `${q.number}. ${q.text}` }), q.options.map((o) => TF.el('div', { class: 'p-opt' + (o.is_correct ? ' ok' : o.selected ? ' bad' : ''), text: `${o.is_correct ? '✓ ' : o.selected ? '✗ ' : '• '}${o.text}` })), q.status === 'unanswered' ? TF.el('div', { class: 'p-opt', text: 'Javob berilmagan' }) : null));
        });
      }
      TF.mount(TF.$('#print-report'), sheet);
      setTimeout(() => window.print(), 150);
    } catch (err) {
      TF.toast('error', err.message);
    }
  }

  function render(data) {
    A = data.attempt;
    const r = A.result;
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('class', 'ring');
    ring.setAttribute('viewBox', '0 0 160 160');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'bg');
    bg.setAttribute('cx', 80);
    bg.setAttribute('cy', 80);
    bg.setAttribute('r', 70);
    const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fg.setAttribute('class', 'fg ' + TF.scoreClass(r.percentage));
    fg.setAttribute('cx', 80);
    fg.setAttribute('cy', 80);
    fg.setAttribute('r', 70);
    fg.style.strokeDasharray = String(C);
    fg.style.strokeDashoffset = String(C);
    ring.append(bg, fg);
    const pctNode = TF.el('b', { text: '0' });
    const pointsNode = TF.el('span', { text: '0' });
    const reviewHolder = TF.el('div');
    const reviewBtn = TF.el('button', { class: 'btn btn-primary', type: 'button' }, TF.icon('eye'), 'Javoblarni ko‘rish');
    const retryBtn = TF.el('button', { class: 'btn btn-secondary', type: 'button' }, TF.icon('rotate-ccw'), 'Qayta urinish');
    reviewBtn.addEventListener('click', () => showReview(reviewHolder, reviewBtn));
    retryBtn.addEventListener('click', () => retry(retryBtn));

    TF.mount(
      root,
      TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: 'Test natijalari' }), TF.el('p', { class: 'break', text: `${A.test_title} · ${modeText(A)} · ${TF.fmtDate(A.completed_at, true)}` }))),
      TF.el(
        'div',
        { class: 'score-card' },
        TF.el('div', { class: 'ring-wrap' }, ring, TF.el('div', { class: 'ring-text' }, pctNode, TF.el('small', { text: '%' }))),
        TF.el('div', { class: 'score-info' }, TF.el('div', { class: 'score-points' }, pointsNode, ` / ${r.total} ball`), TF.el('p', { class: 'result-msg', text: message(r.percentage) }), TF.el('p', { class: 'small muted', text: 'Foiz = to‘g‘ri javoblar ÷ jami savollar × 100, eng yaqin butun songa yaxlitlanadi. Har bir savol — 1 ball.' }))
      ),
      TF.el('div', { class: 'stat-grid', style: 'margin-top:18px' }, statCard('list-checks', 'blue', r.total, 'Jami savollar'), statCard('circle-check', 'green', r.correct, 'To‘g‘ri'), statCard('circle-x', 'red', r.incorrect, 'Noto‘g‘ri'), statCard('circle-help', 'amber', r.unanswered, 'Javobsiz')),
      TF.el('div', { class: 'row wrap', style: 'margin-top:22px' }, reviewBtn, retryBtn, TF.el('button', { class: 'btn btn-secondary', type: 'button', onclick: printReport }, TF.icon('printer'), 'Hisobot / PDF'), TF.el('a', { class: 'btn btn-ghost', href: TF.page('dashboard.html') }, TF.icon('layout-dashboard'), 'Bosh sahifa')),
      reviewHolder
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        fg.style.strokeDashoffset = String(C * (1 - r.percentage / 100));
        TF.countUp(pctNode, r.percentage, { duration: 1300 });
        TF.countUp(pointsNode, r.score, { duration: 1300 });
      })
    );
  }

  (async function () {
    try {
      await TF.init({ auth: 'required', nav: 'dashboard' });
    } catch (e) {
      return;
    }
    root = TF.$('#page');
    if (!id) {
      location.replace(TF.page('dashboard.html'));
      return;
    }
    TF.mount(root, TF.el('div', { class: 'grid' }, TF.skeletons(2, 'sk-tall')));
    try {
      const d = await Api.get('/attempts/' + id);
      if (d.attempt.status !== 'completed') {
        location.replace(TF.page('test.html') + '?attempt=' + id);
        return;
      }
      render(d);
    } catch (err) {
      TF.mount(root, TF.empty('triangle-alert', 'Natijani yuklab bo‘lmadi', err.message, [TF.el('a', { class: 'btn btn-primary', href: TF.page('dashboard.html') }, 'Bosh sahifa')]));
    }
  })();
})();
