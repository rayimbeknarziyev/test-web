(function () {
  'use strict';

  const LETTERS = 'ABCDEFGHIJ';
  const attemptId = Number(TF.query.get('attempt')) || 0;
  const testId = Number(TF.query.get('test')) || 0;

  function configScreen(root, d) {
    const t = d.test;
    const st = { mode: 'practice', count: null };
    const total = t.question_count;
    const startBtn = TF.el('button', { class: 'btn btn-primary btn-lg', type: 'button' }, TF.icon('rocket'), 'Testni boshlash');
    const counts = [25, 30, 50].map((n) => ({ value: n, ok: total >= n }));
    st.count = (counts.find((c) => c.ok) || { value: 'all' }).value;

    const modeBox = TF.el('div', { class: 'grid grid-2' });
    const countBox = TF.el('div', { class: 'choice-grid' });

    function paint() {
      TF.mount(
        modeBox,
        [
          ['practice', 'graduation-cap', 'Mashq rejimi', 'Har bir javob darhol tekshiriladi, to‘g‘ri javob va izoh ko‘rsatiladi.'],
          ['exam', 'clipboard-check', 'Imtihon rejimi', 'Natijalar oxirigacha yashirin. Test yakunlangach hammasi tekshiriladi.']
        ].map(([v, icon, title, desc]) =>
          TF.el('button', { type: 'button', class: 'card mode-card choice' + (st.mode === v ? ' selected' : ''), style: 'padding:20px;text-align:left;grid-template-columns:auto 1fr;display:flex', onclick: () => ((st.mode = v), paint()) }, TF.el('span', { class: 'm-ico' }, TF.icon(icon)), TF.el('span', null, TF.el('b', { text: title }), TF.el('span', { class: 'd', text: desc })))
        )
      );
      TF.mount(
        countBox,
        counts.map((c) =>
          TF.el('button', { type: 'button', class: 'choice' + (st.count === c.value ? ' selected' : ''), disabled: !c.ok, 'aria-pressed': String(st.count === c.value), onclick: () => ((st.count = c.value), paint()) }, TF.el('span', { class: 'big', text: c.value }), TF.el('span', { class: 'cap', text: c.ok ? 'ta savol' : `yetarli emas (${total} ta bor)` }))
        ),
        TF.el('button', { type: 'button', class: 'choice' + (st.count === 'all' ? ' selected' : ''), 'aria-pressed': String(st.count === 'all'), onclick: () => ((st.count = 'all'), paint()) }, TF.el('span', { class: 'big', text: total }), TF.el('span', { class: 'cap', text: 'Barchasi' }))
      );
    }
    paint();

    startBtn.addEventListener('click', () =>
      TF.busy(startBtn, async () => {
        try {
          await TF.startAttempt(t.id, { mode: st.mode, count: st.count });
        } catch (err) {
          TF.toast('error', err.message);
        }
      })
    );

    const special = [];
    if (d.mistakes_count > 0) special.push(['target', 'Xatolar ustida ishlash', `${d.mistakes_count} ta o‘zlashtirilmagan savol`, 'mistakes']);
    if (d.bookmarks_count > 0) special.push(['star', 'Belgilangan savollar', `${d.bookmarks_count} ta belgilangan savol`, 'bookmarks']);

    TF.mount(
      root,
      TF.el('a', { class: 'btn btn-ghost btn-sm', href: TF.page('library.html'), style: 'margin-bottom:12px' }, TF.icon('arrow-left'), 'Kutubxona'),
      TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { class: 'break', text: t.title }), TF.el('p', { text: `${t.question_count} ta savol${t.subject ? ' · ' + t.subject : ''} · v${t.current_version}` }))),
      d.unfinished_attempt_id ? TF.el('div', { class: 'card pad', style: 'margin-bottom:18px;border-color:var(--amber)' }, TF.el('div', { class: 'row between wrap' }, TF.el('div', null, TF.el('b', { text: 'Tugallanmagan urinish bor' }), TF.el('div', { class: 'small muted', text: 'Qolgan joyingizdan davom ettirishingiz mumkin.' })), TF.el('a', { class: 'btn btn-success', href: TF.page('test.html') + '?attempt=' + d.unfinished_attempt_id }, TF.icon('play'), 'Davom ettirish'))) : null,
      TF.el('div', { class: 'card pad', style: 'margin-bottom:18px' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: '1. Rejimni tanlang' })), modeBox),
      TF.el('div', { class: 'card pad', style: 'margin-bottom:18px' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: '2. Savollar soni' }), TF.el('span', { class: 'small muted', text: 'Savollar tasodifiy tanlanadi' })), countBox, TF.el('p', { class: 'small muted', style: 'margin-top:14px', text: 'Vaqt chegarasi yo‘q. Savollar va variantlar tartibi test boshida bir marta aralashtiriladi. Birinchi tanlangan javob yakuniy hisoblanadi.' })),
      TF.el('div', { class: 'row', style: 'justify-content:flex-end' }, startBtn),
      special.length
        ? TF.el(
            'div',
            null,
            TF.el('div', { class: 'section-title' }, TF.el('h2', { text: 'Maxsus mashqlar' })),
            TF.el(
              'div',
              { class: 'grid grid-2' },
              special.map(([icon, title, sub, src]) =>
                TF.el('div', { class: 'card pad hover row between' }, TF.el('div', { class: 'row' }, TF.el('div', { class: 'stat-icon' }, TF.icon(icon)), TF.el('div', null, TF.el('b', { text: title }), TF.el('div', { class: 'small muted', text: sub }))), TF.el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: (e) => TF.busy(e.currentTarget, () => TF.startAttempt(t.id, { mode: 'practice', source: src }).catch((er) => TF.toast('error', er.message))) }, 'Boshlash'))
              )
            )
          )
        : null
    );
  }

  function engine(root, data) {
    const A = data.attempt;
    const Q = data.questions;
    const total = Q.length;
    const practice = A.mode === 'practice';
    const pending = new Set();
    let index = Math.min(A.current_question_index || 0, total - 1);
    let saveTimer = null;

    root.className = 'quiz';
    const counter = TF.el('div', { class: 'counter' });
    const bar = TF.el('div', { class: 'progress-bar' });
    const saveInd = TF.el('div', { class: 'save-ind', 'aria-live': 'polite' });
    const qNum = TF.el('span', { class: 'badge' });
    const bm = TF.el('button', { type: 'button', class: 'btn btn-ghost btn-icon star-btn', 'aria-label': 'Savolni belgilash', title: 'Belgilash (B)' }, TF.icon('star'));
    const qText = TF.el('h2', { class: 'q-text' });
    const opts = TF.el('div', { class: 'opts', role: 'group', 'aria-label': 'Javob variantlari' });
    const fb = TF.el('div', { class: 'feedback', role: 'status' });
    const prev = TF.el('button', { class: 'btn btn-secondary', type: 'button' }, TF.icon('arrow-left'), TF.el('span', { text: 'Oldingi savol' }));
    const next = TF.el('button', { class: 'btn btn-primary', type: 'button' }, TF.el('span', { text: 'Keyingi savol' }), TF.icon('arrow-right'));
    const fin = TF.el('button', { class: 'btn btn-success', type: 'button' }, TF.icon('flag'), TF.el('span', { text: 'Testni yakunlash' }));
    const card = TF.el('section', { class: 'q-card' }, TF.el('div', { class: 'q-head' }, qNum, bm), qText, opts, fb, TF.el('div', { class: 'q-foot' }, prev, TF.el('span', { class: 'spacer' }), next, fin));
    const grid = TF.el('div', { class: 'nav-grid' });
    const endBtn = TF.el('button', { class: 'btn btn-secondary btn-block', type: 'button' }, TF.icon('square'), 'Testni tugatish');
    const side = TF.el(
      'aside',
      { class: 'q-side card' },
      TF.el('div', { class: 'side-title', style: 'font-weight:700', text: 'Savollar' }),
      grid,
      TF.el('div', { class: 'legend-grid' }, TF.el('span', null, TF.el('i', { style: 'background:var(--bg-soft);border:1px solid var(--border-strong)' }), 'Javobsiz'), TF.el('span', null, TF.el('i', { style: 'background:var(--blue)' }), 'Joriy'), practice ? TF.el('span', null, TF.el('i', { style: 'background:var(--green)' }), 'To‘g‘ri') : TF.el('span', null, TF.el('i', { style: 'background:var(--violet)' }), 'Javob berilgan'), practice ? TF.el('span', null, TF.el('i', { style: 'background:var(--red)' }), 'Noto‘g‘ri') : null),
      TF.el('div', { class: 'side-actions' }, endBtn, TF.el('p', { class: 'small muted', style: 'margin-top:12px', text: 'Tugmalar: ← → navigatsiya, 1–9 / A–D javob, B belgilash.' }))
    );

    const fsKey = 'tf-fs';
    const setScale = (s) => {
      s = Math.max(0.85, Math.min(1.5, Math.round(s * 100) / 100));
      document.documentElement.style.setProperty('--q-scale', String(s));
      try {
        localStorage.setItem(fsKey, String(s));
      } catch (e) {}
      return s;
    };
    let scale = 1;
    try {
      scale = parseFloat(localStorage.getItem(fsKey)) || 1;
    } catch (e) {}
    setScale(scale);

    const top = TF.el(
      'header',
      { class: 'quiz-top' },
      TF.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Chiqish', onclick: exit }, TF.icon('log-out'), TF.el('span', { class: 'hide-sm', text: 'Chiqish' })),
      TF.el('div', { class: 'qt-title' }, TF.el('b', { text: A.test_title }), TF.el('span', { text: 'Test jarayoni · ' + (practice ? 'Mashq rejimi' : 'Imtihon rejimi') + (A.source !== 'test' ? ' · takrorlash' : '') })),
      saveInd,
      TF.el('div', { class: 'row hide-sm', style: 'gap:2px' }, TF.el('button', { class: 'btn btn-ghost btn-sm btn-icon', type: 'button', 'aria-label': 'Shriftni kichraytirish', onclick: () => (scale = setScale(scale - 0.1)) }, TF.el('b', { text: 'A−' })), TF.el('button', { class: 'btn btn-ghost btn-sm btn-icon', type: 'button', 'aria-label': 'Shriftni kattalashtirish', onclick: () => (scale = setScale(scale + 0.1)) }, TF.el('b', { text: 'A+' })), TF.el('button', { class: 'btn btn-ghost btn-sm btn-icon', type: 'button', 'data-theme-icon': '', 'aria-label': 'Mavzu', onclick: TF.theme.toggle }, TF.icon(TF.theme.get() === 'dark' ? 'sun' : 'moon'))),
      counter,
      TF.el('button', { class: 'btn btn-success btn-sm mobile-finish', type: 'button', onclick: finish }, TF.icon('flag'))
    );
    TF.mount(root, top, TF.el('div', { class: 'quiz-progress', role: 'progressbar', 'aria-label': 'Progress' }, bar), TF.el('div', { class: 'quiz-body' }, card, side));

    const answeredCount = () => Q.filter((q) => q.selected_option_id !== null).length;
    const cur = () => Q[index];

    function mark(state) {
      clearTimeout(saveTimer);
      saveInd.className = 'save-ind show' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
      TF.mount(saveInd, state === 'saving' ? [TF.icon('loader'), 'Saqlanmoqda…'] : state === 'ok' ? [TF.icon('check'), 'Saqlandi'] : [TF.icon('cloud-off'), 'Saqlanmadi']);
      if (state === 'ok') saveTimer = setTimeout(() => saveInd.classList.remove('show'), 1600);
    }

    function renderNav() {
      if (grid.children.length !== total) {
        TF.mount(grid, Q.map((_, i) => TF.el('button', { type: 'button', class: 'nav-num', text: String(i + 1), 'aria-label': `${i + 1}-savol`, onclick: () => go(i) })));
      }
      Q.forEach((q, i) => {
        const b = grid.children[i];
        const answered = q.selected_option_id !== null;
        b.className = 'nav-num' + (i === index ? ' is-current' : '') + (answered && practice && q.revealed ? (q.is_correct ? ' is-correct' : ' is-wrong') : answered ? ' is-answered' : '');
        if (i === index) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      const c = grid.children[index];
      if (c && grid.scrollWidth > grid.clientWidth) grid.scrollTo({ left: c.offsetLeft - grid.clientWidth / 2 + c.offsetWidth / 2, behavior: 'smooth' });
    }

    function renderProgress() {
      const a = answeredCount();
      bar.style.width = Math.round((a / total) * 100) + '%';
      counter.textContent = `Savol ${index + 1} / ${total}`;
      document.title = `${index + 1}/${total} — ${A.test_title}`;
    }

    function render(dir, animate) {
      const q = cur();
      if (dir) {
        card.classList.remove('enter-next', 'enter-prev');
        void card.offsetWidth;
        card.classList.add(dir === 'next' ? 'enter-next' : 'enter-prev');
      }
      TF.mount(qNum, `Savol ${index + 1}`);
      qText.textContent = q.text;
      bm.classList.toggle('on', !!q.bookmark_id);
      bm.setAttribute('aria-pressed', String(!!q.bookmark_id));
      const answered = q.selected_option_id !== null;
      TF.mount(
        opts,
        q.options.map((o, i) => {
          let cls = 'opt';
          let mk = null;
          const isSel = o.id === q.selected_option_id || q._pending === o.id;
          if (q._pending === o.id) cls += ' is-selected is-pending';
          else if (answered) {
            if (practice && q.revealed) {
              if (o.id === q.correct_option_id) {
                cls += ' is-correct' + (animate && isSel ? ' pop' : '');
                mk = 'circle-check';
              } else if (isSel) {
                cls += ' is-wrong' + (animate ? ' shake' : '');
                mk = 'circle-x';
              } else cls += ' is-dim';
            } else if (isSel) {
              cls += ' is-selected';
              mk = 'circle-check';
            } else cls += ' is-dim';
          }
          return TF.el('button', { type: 'button', class: cls, disabled: answered || pending.has(q.attempt_question_id), 'aria-pressed': String(isSel), onclick: () => choose(i) }, TF.el('span', { class: 'letter', text: LETTERS[i] || String(i + 1) }), TF.el('span', { class: 'txt', text: o.text }), TF.el('span', { class: 'mark' }, mk ? TF.icon(mk) : null));
        })
      );
      fb.className = 'feedback';
      TF.clear(fb);
      if (answered && practice && q.revealed) {
        const ok = q.is_correct;
        const correctText = (q.options.find((o) => o.id === q.correct_option_id) || {}).text;
        fb.classList.add('show', ok ? 'ok' : 'bad');
        TF.mount(fb, TF.icon(ok ? 'circle-check' : 'circle-x'), TF.el('div', { class: 'fb-body' }, TF.el('b', { text: ok ? 'To‘g‘ri javob!' : 'Noto‘g‘ri javob' }), !ok && correctText ? TF.el('div', { class: 'break', text: 'To‘g‘ri javob: ' + correctText }) : null, q.explanation ? TF.el('div', { class: 'expl break', text: q.explanation }) : null));
      } else if (answered && !practice) {
        fb.classList.add('show', 'ok');
        fb.style.background = 'var(--blue-soft)';
        fb.style.color = 'var(--blue)';
        TF.mount(fb, TF.icon('lock'), TF.el('div', { class: 'fb-body' }, TF.el('b', { style: 'color:var(--blue)', text: 'Javob saqlandi' }), TF.el('div', { text: 'Natija test yakunlangach ko‘rsatiladi.' })));
      } else {
        fb.style.background = '';
        fb.style.color = '';
      }
      const last = index === total - 1;
      prev.disabled = index === 0;
      next.classList.toggle('hidden', last);
      fin.classList.toggle('hidden', !last);
      renderNav();
      renderProgress();
    }

    async function choose(i) {
      const q = cur();
      if (q.selected_option_id !== null || pending.has(q.attempt_question_id)) return;
      const opt = q.options[i];
      if (!opt) return;
      pending.add(q.attempt_question_id);
      q._pending = opt.id;
      render(null);
      mark('saving');
      try {
        const r = await Api.post(`/attempts/${A.id}/answers`, { attempt_question_id: q.attempt_question_id, option_id: opt.id });
        q.selected_option_id = r.selected_option_id;
        if (practice) {
          q.revealed = true;
          q.is_correct = r.is_correct;
          q.correct_option_id = r.correct_option_id;
          q.explanation = r.explanation;
        }
        mark('ok');
      } catch (err) {
        mark('err');
        TF.toast('error', err.status === 409 ? 'Bu urinish yakunlangan.' : 'Javob saqlanmadi: ' + err.message);
      } finally {
        pending.delete(q.attempt_question_id);
        delete q._pending;
      }
      if (cur() === q) render(null, true);
      else {
        renderNav();
        renderProgress();
      }
    }

    const persist = TF.debounce(async () => {
      mark('saving');
      try {
        await Api.patch(`/attempts/${A.id}/progress`, { current_question_index: index });
        mark('ok');
      } catch (e) {
        mark('err');
      }
    }, 400);

    function go(i) {
      if (i < 0 || i >= total || i === index) return;
      const dir = i > index ? 'next' : 'prev';
      index = i;
      render(dir);
      persist();
    }

    async function toggleBookmark() {
      const q = cur();
      bm.disabled = true;
      try {
        if (q.bookmark_id) {
          await Api.del('/bookmarks/' + q.bookmark_id);
          q.bookmark_id = null;
          TF.toast('info', 'Belgi olib tashlandi.', 1800);
        } else {
          const r = await Api.post('/bookmarks', { question_id: q.question_id });
          q.bookmark_id = r.id;
          TF.toast('success', 'Savol belgilandi.', 1800);
        }
        render(null);
      } catch (err) {
        TF.toast('error', err.message);
      } finally {
        bm.disabled = false;
      }
    }

    async function finish() {
      const left = total - answeredCount();
      const ok = await TF.confirm('Testni yakunlaysizmi?', left > 0 ? `${left} ta savolga javob berilmagan. Yakunlasangiz, ular javobsiz hisoblanadi.` : 'Barcha savollarga javob berildi. Natijalarni ko‘rishga tayyormisiz?', { ok: 'Yakunlash', icon: 'flag' });
      if (!ok) return;
      try {
        await Api.post(`/attempts/${A.id}/finish`);
        location.href = TF.page('results.html') + '?attempt=' + A.id;
      } catch (err) {
        TF.toast('error', err.message);
      }
    }

    async function exit() {
      const ok = await TF.confirm('Testdan chiqasizmi?', 'Jarayoningiz saqlanadi. Keyinroq kutubxonadan davom ettirishingiz mumkin.', { ok: 'Chiqish', icon: 'log-out' });
      if (ok) location.href = TF.page('library.html');
    }

    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    fin.addEventListener('click', finish);
    endBtn.addEventListener('click', finish);
    bm.addEventListener('click', toggleBookmark);

    document.addEventListener('keydown', (e) => {
      if (document.querySelector('.modal-overlay') || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft') go(index - 1);
      else if (/^[1-9]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (/^[a-jA-J]$/.test(e.key) && e.key.toLowerCase() !== 'b') choose(LETTERS.indexOf(e.key.toUpperCase()));
      else if (e.key.toLowerCase() === 'b') toggleBookmark();
    });

    window.addEventListener('beforeunload', () => {
      if (navigator.sendBeacon) return;
    });

    render(null);
  }

  (async function () {
    const attemptMode = attemptId > 0;
    try {
      await TF.init({ auth: 'required', nav: 'library', shell: !attemptMode });
    } catch (e) {
      return;
    }
    const root = TF.$('#page');
    if (attemptMode) {
      TF.mount(root, TF.el('div', { class: 'page' }, TF.skeletons(1, 'sk-tall')));
      try {
        const data = await Api.get('/attempts/' + attemptId);
        if (data.attempt.status === 'completed') {
          location.replace(TF.page('results.html') + '?attempt=' + attemptId);
          return;
        }
        if (!data.questions.length) throw new Error('Bu urinishda savollar yo‘q.');
        engine(root, data);
      } catch (err) {
        TF.mount(root, TF.el('div', { class: 'page' }, TF.empty('triangle-alert', 'Urinishni yuklab bo‘lmadi', err.message, [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, 'Kutubxonaga qaytish')])));
      }
    } else if (testId > 0) {
      TF.mount(root, TF.el('div', { class: 'grid' }, TF.skeletons(3, 'sk-tall')));
      try {
        configScreen(root, await Api.get('/tests/' + testId));
      } catch (err) {
        TF.mount(root, TF.empty('triangle-alert', 'Testni yuklab bo‘lmadi', err.message, [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, 'Kutubxonaga qaytish')]));
      }
    } else {
      location.replace(TF.page('library.html'));
    }
  })();
})();
