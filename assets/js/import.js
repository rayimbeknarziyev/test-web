(function () {
  'use strict';

  const IP = window.ImportParser;
  const S = { mode: 'create', testId: null, testTitle: '', file: null, format: '', sources: [], selected: new Set(), mapping: null, items: [], meta: { title: '', subject: '', description: '' }, step: 1, rendered: 0, warnings: [] };
  const BATCH = 40;
  let root;
  let uid = 0;

  const STEPS = [['upload-cloud', 'Fayl'], ['columns-3', 'Sozlash'], ['list-checks', 'Tekshirish'], ['badge-check', 'Saqlash']];

  function stepper(active) {
    return TF.el(
      'div',
      { class: 'stepper' },
      STEPS.map(([icon, label], i) => {
        const n = i + 1;
        const cls = n === active ? 'active' : n < active ? 'done' : '';
        return TF.el('div', { class: 'step ' + cls }, TF.el('span', { class: 'n' }, n < active ? TF.icon('check') : String(n)), TF.el('span', { class: 't', text: label }));
      })
    );
  }

  function head(title, sub) {
    return TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: title }), TF.el('p', { text: sub })));
  }

  function downloadTemplate() {
    const rows = [
      ['Savol', 'To‘g‘ri javob', 'Xato javob 1', 'Xato javob 2', 'Xato javob 3'],
      ['HTML nima?', 'Belgilash tili', 'Ma’lumotlar bazasi', 'Operatsion tizim', 'Dasturlash muharriri'],
      ['CSS nima uchun ishlatiladi?', 'Sahifani bezash uchun', 'Server yozish uchun', 'Ma’lumot saqlash uchun', '']
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = TF.el('a', { href: url, download: 'testflow-shablon.csv' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function showUpload() {
    S.step = 1;
    const input = TF.el('input', { type: 'file', accept: '.xlsx,.xls,.csv,.docx,.txt', hidden: true });
    const zone = TF.el(
      'div',
      { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Fayl yuklash' },
      TF.el('div', { class: 'dz-icon' }, TF.icon('cloud-upload')),
      TF.el('h2', { text: 'Faylni shu yerga tashlang' }),
      TF.el('p', { class: 'muted', style: 'margin:6px 0 18px', text: 'yoki kompyuteringizdan tanlang' }),
      TF.el('button', { type: 'button', class: 'btn btn-primary btn-lg', onclick: (e) => (e.stopPropagation(), input.click()) }, TF.icon('folder-open'), 'Fayl tanlash'),
      TF.el('div', { class: 'format-tags' }, ['.xlsx', '.xls', '.csv', '.docx', '.txt'].map((f) => TF.el('span', { text: f }))),
      TF.el('p', { class: 'small muted', style: 'margin-top:12px', text: `Maksimal hajm: ${window.TF_CONFIG.MAX_UPLOAD_MB} MB · Maksimal savollar: ${IP.MAX_QUESTIONS}` })
    );
    const status = TF.el('div');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => (e.preventDefault(), zone.classList.add('drag'))));
    ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => (e.preventDefault(), zone.classList.remove('drag'))));
    zone.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files;
      if (!f || !f.length) return;
      if (f.length > 1) TF.toast('info', 'Faqat birinchi fayl olinadi.');
      handleFile(f[0], status);
    });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (f) handleFile(f, status);
    });
    const format = TF.el(
      'div',
      { class: 'card pad', style: 'margin-top:22px' },
      TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Fayl formati' }), TF.el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: downloadTemplate }, TF.icon('download'), 'Namuna (.csv)')),
      TF.el('div', { class: 'table-wrap' }, TF.el('table', { class: 'tbl' }, TF.el('thead', null, TF.el('tr', null, ['1-ustun', '2-ustun', '3-ustun', '4-ustun', '5-ustun'].map((h) => TF.el('th', { text: h })))), TF.el('tbody', null, TF.el('tr', null, TF.el('td', { class: 'role-q', text: 'Savol' }), TF.el('td', { class: 'role-c', text: 'To‘g‘ri javob' }), TF.el('td', { class: 'role-w', text: 'Xato javob' }), TF.el('td', { class: 'role-w', text: 'Xato javob' }), TF.el('td', { class: 'role-w', text: 'Xato javob' }))))),
      TF.el('p', { class: 'small muted', style: 'margin-top:12px', text: 'Xato javoblar soni savoldan savolga farq qilishi mumkin. Word (.docx) fayllarda savollar jadval ko‘rinishida bo‘lishi kerak. Keyingi qadamda ustunlarni o‘zingiz moslashingiz mumkin.' })
    );
    TF.mount(root, head('Test yuklash', 'Fayldan savollarni o‘qing, tekshiring va kutubxonangizga saqlang.'), stepper(1), zone, input, status, format);
  }

  async function handleFile(file, statusEl) {
    const bar = TF.el('div', { class: 'progress-bar' });
    TF.mount(
      statusEl,
      TF.el(
        'div',
        { class: 'card pad', style: 'margin-top:18px' },
        TF.el('div', { class: 'file-chip' }, TF.el('div', { class: 'ficon' }, TF.icon('file-spreadsheet')), TF.el('div', { class: 'grow', style: 'min-width:0;flex:1' }, TF.el('div', { class: 'break', style: 'font-weight:700', text: file.name }), TF.el('div', { class: 'small muted', text: `${(file.name.split('.').pop() || '').toUpperCase()} · ${IP.formatSize(file.size)} · o‘qilmoqda…` }))),
        TF.el('div', { class: 'progress', style: 'margin-top:14px' }, bar)
      )
    );
    let p = 6;
    bar.style.width = p + '%';
    const timer = setInterval(() => {
      p = Math.min(90, p + (90 - p) * 0.12);
      bar.style.width = p + '%';
    }, 120);
    const t0 = Date.now();
    try {
      const r = await IP.readFile(file);
      const wait = 450 - (Date.now() - t0);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      clearInterval(timer);
      bar.style.width = '100%';
      await new Promise((res) => setTimeout(res, 250));
      S.file = file;
      S.format = r.format;
      S.sources = r.sources;
      S.warnings = r.warning ? [r.warning] : [];
      S.selected = new Set(r.sources.length > 1 ? [r.sources[0].id] : r.sources.map((s) => s.id));
      S.mapping = IP.guessMapping(r.sources[0]);
      S.meta.title = file.name.replace(/\.[^.]+$/, '').slice(0, 200);
      showMapping();
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof IP.ImportError ? err.message : 'Faylni o‘qishda kutilmagan xatolik yuz berdi.';
      TF.mount(statusEl, TF.el('div', { class: 'card pad', style: 'margin-top:18px;border-color:var(--red)' }, TF.empty('file-x', 'Faylni o‘qib bo‘lmadi', msg, [TF.el('button', { class: 'btn btn-secondary', type: 'button', onclick: downloadTemplate }, TF.icon('download'), 'Namuna shablon')], true)));
      TF.toast('error', msg, 7000);
    }
  }

  function selectedSources() {
    return S.sources.filter((s) => S.selected.has(s.id));
  }

  function showMapping() {
    S.step = 2;
    const summary = TF.el('div');
    const preview = TF.el('div');
    const continueBtn = TF.el('button', { class: 'btn btn-primary btn-lg', type: 'button' }, TF.icon('arrow-right'), 'Savollarni ko‘rib chiqish');
    const mapBox = TF.el('div');
    let result = null;

    const colLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));
    const maxCols = () => Math.max(1, ...selectedSources().map((s) => s.cols));

    function renderMapping() {
      const n = maxCols();
      const opts = Array.from({ length: n }, (_, i) => i);
      const sel = (key, label) => {
        const s = TF.el('select', { class: 'select', 'aria-label': label }, opts.map((i) => TF.el('option', { value: i, text: `${i + 1}-ustun (${colLetter(i)})` })));
        s.value = String(S.mapping[key]);
        s.addEventListener('change', () => {
          S.mapping[key] = Number(s.value);
          S.mapping.w = S.mapping.w.filter((c) => c !== S.mapping.q && c !== S.mapping.c);
          renderMapping();
          recompute();
        });
        return TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', text: label }), s);
      };
      const wrongChecks = TF.el(
        'div',
        { class: 'chips' },
        opts
          .filter((i) => i !== S.mapping.q && i !== S.mapping.c)
          .map((i) => {
            const on = S.mapping.w.includes(i);
            return TF.el('button', { type: 'button', class: 'chip' + (on ? ' active' : ''), onclick: () => ((S.mapping.w = on ? S.mapping.w.filter((c) => c !== i) : [...S.mapping.w, i].sort((a, b) => a - b)), renderMapping(), recompute()) }, `${i + 1}-ustun`);
          })
      );
      TF.mount(
        mapBox,
        TF.el('div', { class: 'map-grid' }, sel('q', 'Savol ustuni'), sel('c', 'To‘g‘ri javob ustuni'), TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', text: 'Birinchi qator' }), TF.el('label', { class: 'check', style: 'min-height:46px' }, TF.el('input', { type: 'checkbox', checked: S.mapping.header, onchange: (e) => ((S.mapping.header = e.target.checked), renderPreview(), recompute()) }), 'Sarlavha qatori (o‘tkazib yuboriladi)'))),
        TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', text: 'Xato javob ustunlari' }), wrongChecks, TF.el('span', { class: 'field-hint', text: 'Bosib ustunni qo‘shing yoki olib tashlang.' }))
      );
      renderPreview();
    }

    function renderPreview() {
      const src = selectedSources()[0];
      if (!src) return TF.clear(preview);
      const n = maxCols();
      const role = (i) => (i === S.mapping.q ? 'role-q' : i === S.mapping.c ? 'role-c' : S.mapping.w.includes(i) ? 'role-w' : '');
      const label = (i) => (i === S.mapping.q ? 'Savol' : i === S.mapping.c ? 'To‘g‘ri' : S.mapping.w.includes(i) ? 'Xato' : '—');
      TF.mount(
        preview,
        TF.el('div', { class: 'label', style: 'margin:14px 0 8px', text: `Namuna (“${src.label}”, dastlabki 6 qator)` }),
        TF.el(
          'div',
          { class: 'table-wrap' },
          TF.el(
            'table',
            { class: 'tbl' },
            TF.el('thead', null, TF.el('tr', null, Array.from({ length: n }, (_, i) => TF.el('th', { class: role(i), text: `${i + 1} · ${label(i)}` })))),
            TF.el('tbody', null, src.rows.slice(0, 6).map((r, ri) => TF.el('tr', { style: ri === 0 && S.mapping.header ? 'opacity:.5' : null }, Array.from({ length: n }, (_, i) => TF.el('td', { class: role(i), title: r[i] || '', text: r[i] || '' })))))
          )
        )
      );
    }

    function recompute() {
      const sel = selectedSources();
      if (!sel.length) {
        result = null;
        continueBtn.disabled = true;
        TF.mount(summary, TF.el('div', { class: 'status', style: 'color:var(--amber)', text: 'Kamida bitta varaq yoki jadvalni tanlang.' }));
        return;
      }
      if (S.mapping.q === S.mapping.c) {
        result = null;
        continueBtn.disabled = true;
        TF.mount(summary, TF.el('div', { class: 'err-text', text: 'Savol va to‘g‘ri javob uchun turli ustunlarni tanlang.' }));
        return;
      }
      result = IP.buildQuestions(sel, S.mapping);
      const st = result.stats;
      continueBtn.disabled = st.valid === 0;
      TF.mount(
        summary,
        TF.el('div', { class: 'stat-strip' }, TF.el('div', { class: 's' }, TF.el('b', { text: st.rows }), TF.el('span', { text: 'Aniqlangan qatorlar' })), TF.el('div', { class: 's ok' }, TF.el('b', { text: st.valid }), TF.el('span', { text: 'Yaroqli savollar' })), TF.el('div', { class: 's bad' }, TF.el('b', { text: st.invalid }), TF.el('span', { text: 'Yaroqsiz qatorlar' })), TF.el('div', { class: 's warn' }, TF.el('b', { text: st.duplicates }), TF.el('span', { text: 'Takroriy savollar' }))),
        result.warnings.length || S.warnings.length ? TF.el('div', { class: 'small', style: 'margin-top:12px;color:var(--amber)' }, [...S.warnings, ...result.warnings].map((w) => TF.el('div', { text: '⚠ ' + w }))) : null,
        result.skipped.length ? TF.el('details', { style: 'margin-top:12px' }, TF.el('summary', { style: 'cursor:pointer;font-weight:600;color:var(--red)', text: `O‘tkazib yuborilgan qatorlar (${result.skipped.length})` }), TF.el('div', { class: 'skipped-list', style: 'margin-top:8px' }, result.skipped.slice(0, 200).map((s) => TF.el('div', { text: `${s.at}: ${s.reason}` })))) : null,
        st.duplicates ? TF.el('p', { class: 'small muted', style: 'margin-top:10px', text: 'Takroriy savollar avtomatik o‘chirilmaydi — keyingi qadamda ularni ko‘rib chiqib, kerak bo‘lsa o‘tkazib yuborishingiz mumkin.' }) : null
      );
    }

    const srcBox = TF.el('div');
    if (S.sources.length > 1) {
      TF.mount(
        srcBox,
        TF.el('div', { class: 'card pad', style: 'margin-bottom:18px' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Qaysi varaqlar import qilinadi?' })), TF.el('p', { class: 'small muted', style: 'margin-bottom:12px', text: 'Fayl bir nechta varaq/jadvaldan iborat. Faqat belgilanganlari import qilinadi; ustun sozlamasi hammasiga bir xil qo‘llanadi.' }), TF.el('div', { class: 'grid' }, S.sources.map((s) => TF.el('label', { class: 'check' }, TF.el('input', { type: 'checkbox', checked: S.selected.has(s.id), onchange: (e) => (e.target.checked ? S.selected.add(s.id) : S.selected.delete(s.id), renderMapping(), recompute()) }), TF.el('span', null, TF.el('b', { text: s.label }), TF.el('span', { class: 'muted', text: `  ·  ${s.rows.length} qator, ${s.cols} ustun` }))))))
      );
    }

    continueBtn.addEventListener('click', () => {
      if (!result || !result.questions.length) return;
      S.items = result.questions.map((q) => ({ uid: ++uid, question: q.question, explanation: '', options: q.options.map((o) => ({ ...o })), include: true, duplicate: q.duplicate, source: q.source }));
      S.mode = 'create';
      showEditor();
    });

    TF.mount(
      root,
      head('Ustunlarni moslash', 'Fayl tuzilmasini tekshiring. Ustunlar noto‘g‘ri aniqlangan bo‘lsa, o‘zgartiring.'),
      stepper(2),
      TF.el('div', { class: 'file-chip', style: 'margin-bottom:18px' }, TF.el('div', { class: 'ficon' }, TF.icon('file-check')), TF.el('div', { style: 'flex:1;min-width:0' }, TF.el('div', { class: 'break', style: 'font-weight:700', text: S.file.name }), TF.el('div', { class: 'small muted', text: `${S.format.toUpperCase()} · ${IP.formatSize(S.file.size)} · ${S.sources.length} ta manba` })), TF.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: showUpload }, TF.icon('refresh-cw'), 'Boshqa fayl')),
      srcBox,
      TF.el('div', { class: 'card pad' }, mapBox, preview),
      TF.el('div', { class: 'card pad', style: 'margin-top:18px' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Natija' })), summary),
      TF.el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:20px' }, continueBtn)
    );
    renderMapping();
    recompute();
  }

  function itemProblem(it) {
    if (!it.question.trim()) return 'Savol matni bo‘sh.';
    if (it.question.trim().length > 2000) return 'Savol 2000 belgidan uzun.';
    if (it.options.length < 2) return 'Kamida 2 ta variant kerak.';
    const texts = it.options.map((o) => o.text.trim().toLowerCase());
    if (texts.some((t) => !t)) return 'Bo‘sh variant bor.';
    if (new Set(texts).size !== texts.length) return 'Takroriy variantlar bor.';
    if (it.options.filter((o) => o.is_correct).length !== 1) return 'Aynan bitta to‘g‘ri javob belgilang.';
    return null;
  }

  function showEditor() {
    S.step = 3;
    S.rendered = 0;
    const list = TF.el('div', { class: 'stack' });
    const moreBtn = TF.el('button', { class: 'btn btn-secondary', type: 'button' });
    const bar = TF.el('div', { class: 'sticky-bar' });
    const saveBtn = TF.el('button', { class: 'btn btn-success btn-lg', type: 'button' }, TF.icon('save'), 'Saqlash');
    const info = TF.el('div', { class: 'small' });
    const edit = S.mode === 'edit';

    function updateBar() {
      const inc = S.items.filter((i) => i.include);
      const bad = inc.filter((i) => itemProblem(i));
      const titleOk = edit || S.meta.title.trim().length > 0;
      saveBtn.disabled = !inc.length || bad.length > 0 || !titleOk;
      TF.mount(
        info,
        TF.el('b', { text: `${inc.length} ta savol saqlanadi` }),
        bad.length ? TF.el('span', { style: 'color:var(--red);margin-left:10px', text: `· ${bad.length} tasida xatolik bor` }) : null,
        S.items.length - inc.length ? TF.el('span', { class: 'muted', style: 'margin-left:10px', text: `· ${S.items.length - inc.length} tasi o‘tkazib yuboriladi` }) : null
      );
    }

    function card(it, idx) {
      const holder = TF.el('div', { class: 'card q-edit' });
      const render = () => {
        const prob = it.include ? itemProblem(it) : null;
        holder.className = 'card q-edit' + (it.include ? '' : ' skipped') + (prob ? ' has-error' : '') + (it.duplicate && !prob ? ' dup' : '');
        const ta = TF.el('textarea', { class: 'textarea', rows: 2, 'aria-label': `${idx + 1}-savol matni`, maxlength: 2000 }, it.question);
        const grow = () => {
          ta.style.height = 'auto';
          ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px';
        };
        ta.addEventListener('input', () => {
          it.question = ta.value;
          grow();
          updateErr();
          updateBar();
        });
        const errBox = TF.el('div', { class: 'err-text' });
        const updateErr = () => {
          const p = it.include ? itemProblem(it) : null;
          errBox.textContent = p || '';
          holder.classList.toggle('has-error', !!p);
        };
        const optRows = it.options.map((o, oi) => {
          const radio = TF.el('input', { type: 'radio', name: 'c' + it.uid, checked: o.is_correct, 'aria-label': 'To‘g‘ri javob' });
          radio.addEventListener('change', () => {
            it.options.forEach((x, k) => (x.is_correct = k === oi));
            render();
            updateBar();
          });
          const inp = TF.el('input', { class: 'input', value: o.text, maxlength: 1000, 'aria-label': `${oi + 1}-variant`, placeholder: 'Variant matni' });
          inp.addEventListener('input', () => {
            o.text = inp.value;
            updateErr();
            updateBar();
          });
          return TF.el(
            'div',
            { class: 'opt-edit' + (o.is_correct ? ' correct' : '') },
            radio,
            inp,
            TF.el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Variantni o‘chirish', disabled: it.options.length <= 2, onclick: () => (it.options.splice(oi, 1), it.options.some((x) => x.is_correct) || null, render(), updateBar()) }, TF.icon('x'))
          );
        });
        TF.mount(
          holder,
          TF.el(
            'div',
            { class: 'qe-head' },
            TF.el('span', { class: 'qe-num', text: '#' + (idx + 1) }),
            it.duplicate ? TF.el('span', { class: 'badge badge-amber' }, TF.icon('copy'), 'Takroriy savol') : null,
            it.source ? TF.el('span', { class: 'small muted', text: it.source }) : null,
            TF.el('span', { style: 'flex:1' }),
            TF.el('label', { class: 'check small' }, TF.el('input', { type: 'checkbox', checked: it.include, onchange: (e) => ((it.include = e.target.checked), render(), updateBar()) }), 'Qo‘shish'),
            TF.el('button', { class: 'btn btn-danger-ghost btn-sm btn-icon', type: 'button', 'aria-label': 'Savolni olib tashlash', onclick: async () => {
              S.items = S.items.filter((x) => x !== it);
              holder.remove();
              TF.toast('info', 'Savol ro‘yxatdan olib tashlandi.');
              updateBar();
            } }, TF.icon('trash-2'))
          ),
          ta,
          TF.el('div', { class: 'stack', style: 'gap:8px' }, optRows),
          TF.el('div', { class: 'row between wrap' }, TF.el('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: it.options.length >= 10, onclick: () => (it.options.push({ text: '', is_correct: false }), render(), updateBar()) }, TF.icon('plus'), 'Variant qo‘shish'), errBox),
          TF.el('details', null, TF.el('summary', { class: 'small muted', style: 'cursor:pointer', text: 'Izoh qo‘shish (ixtiyoriy)' }), TF.el('textarea', { class: 'textarea', rows: 2, maxlength: 2000, placeholder: 'Javob tushuntirishi', 'aria-label': 'Izoh', style: 'margin-top:8px', oninput: (e) => (it.explanation = e.target.value) }, it.explanation || ''))
        );
        updateErr();
        requestAnimationFrame(grow);
      };
      render();
      return holder;
    }

    function renderMore() {
      const next = S.items.slice(S.rendered, S.rendered + BATCH);
      next.forEach((it, i) => list.append(card(it, S.rendered + i)));
      S.rendered += next.length;
      const left = S.items.length - S.rendered;
      moreBtn.classList.toggle('hidden', left <= 0);
      moreBtn.textContent = `Yana ${Math.min(BATCH, left)} ta ko‘rsatish (${left} ta qoldi)`;
    }
    moreBtn.addEventListener('click', renderMore);

    const metaCard = edit
      ? TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'row' }, TF.el('span', { class: 'badge badge-violet' }, TF.icon('git-branch'), 'Versiya'), TF.el('span', { class: 'small muted', text: 'Saqlaganingizda yangi versiya yaratiladi. Avvalgi urinishlar va natijalar o‘zgarmaydi.' })))
      : TF.el(
          'div',
          { class: 'card pad' },
          TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Test ma’lumotlari' })),
          TF.el('div', { class: 'grid grid-2' }, TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'm-title', text: 'Test nomi *' }), TF.el('input', { class: 'input', id: 'm-title', value: S.meta.title, maxlength: 200, oninput: (e) => ((S.meta.title = e.target.value), updateBar()) })), TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'm-subject', text: 'Fan (ixtiyoriy)' }), TF.el('input', { class: 'input', id: 'm-subject', value: S.meta.subject, maxlength: 100, oninput: (e) => (S.meta.subject = e.target.value) }))),
          TF.el('div', { class: 'field', style: 'margin-bottom:0' }, TF.el('label', { class: 'label', for: 'm-desc', text: 'Tavsif (ixtiyoriy)' }), TF.el('textarea', { class: 'textarea', id: 'm-desc', maxlength: 2000, style: 'min-height:70px', oninput: (e) => (S.meta.description = e.target.value) }, S.meta.description))
        );

    saveBtn.addEventListener('click', () => TF.busy(saveBtn, save));
    TF.mount(bar, info, TF.el('div', { class: 'row' }, edit ? TF.el('a', { class: 'btn btn-ghost', href: TF.page('library.html') }, 'Bekor qilish') : TF.el('button', { class: 'btn btn-ghost', type: 'button', onclick: showMapping }, TF.icon('arrow-left'), 'Orqaga'), saveBtn));

    TF.mount(
      root,
      head(edit ? 'Savollarni tahrirlash' : 'Savollarni tekshirish', edit ? `“${S.testTitle}” — savollarni o‘zgartiring, qo‘shing yoki olib tashlang.` : 'Saqlashdan oldin har bir savolni ko‘rib chiqing va kerak bo‘lsa tahrirlang.'),
      stepper(3),
      TF.el('div', { class: 'stack' }, metaCard, !edit && S.warnings.length ? TF.el('div', { class: 'small', style: 'color:var(--amber)', text: '⚠ ' + S.warnings.join(' ') }) : null, list, TF.el('div', { class: 'center' }, moreBtn)),
      bar
    );
    renderMore();
    updateBar();
  }

  async function save() {
    const inc = S.items.filter((i) => i.include);
    if (!inc.length) return TF.toast('warning', 'Saqlash uchun kamida bitta savol qoldiring.');
    const bad = inc.findIndex((i) => itemProblem(i));
    if (bad >= 0) return TF.toast('error', 'Xatoli savollarni tuzating.');
    const questions = inc.map((i) => ({ question: i.question.trim(), explanation: i.explanation.trim() || null, options: i.options.map((o) => ({ text: o.text.trim(), is_correct: !!o.is_correct })) }));
    try {
      if (S.mode === 'edit') {
        const d = await Api.post(`/tests/${S.testId}/versions`, { questions });
        showDone({ id: S.testId, text: `Yangi versiya (v${d.version_number}) saqlandi. Avvalgi natijalar o‘zgarishsiz qoladi.`, count: questions.length });
      } else {
        const d = await Api.post('/tests', { title: S.meta.title, subject: S.meta.subject, description: S.meta.description, source_filename: S.file ? S.file.name : '', questions });
        showDone({ id: d.id, text: 'Test kutubxonangizga saqlandi.', count: questions.length });
      }
    } catch (err) {
      if (err.status === 422) {
        const first = Object.values(err.errors || {})[0];
        TF.toast('error', first || err.message, 7000);
      } else TF.toast('error', err.message, 7000);
    }
  }

  function showDone(d) {
    S.step = 4;
    const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    check.setAttribute('viewBox', '0 0 52 52');
    check.setAttribute('class', 'check-anim');
    check.innerHTML = '<circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/>';
    TF.mount(
      root,
      stepper(4),
      TF.el('div', { class: 'card' }, TF.el('div', { class: 'success-panel' }, check, TF.el('h2', { text: 'Muvaffaqiyatli saqlandi!' }), TF.el('p', { class: 'muted', text: `${d.count} ta savol · ${d.text}` }), TF.el('div', { class: 'row wrap', style: 'justify-content:center;margin-top:10px' }, TF.el('a', { class: 'btn btn-primary btn-lg', href: TF.page('test.html') + '?test=' + d.id }, TF.icon('play'), 'Testni boshlash'), TF.el('a', { class: 'btn btn-secondary btn-lg', href: TF.page('library.html') }, TF.icon('library'), 'Kutubxonaga o‘tish'))))
    );
    TF.toast('success', 'Saqlandi!');
  }

  async function loadEdit(id) {
    TF.mount(root, TF.el('div', { class: 'grid' }, TF.skeletons(3, 'sk-tall')));
    try {
      const d = await Api.get(`/tests/${id}/preview`);
      S.mode = 'edit';
      S.testId = id;
      S.testTitle = d.test.title;
      S.items = d.questions.map((q) => ({ uid: ++uid, question: q.question, explanation: q.explanation || '', options: q.options.map((o) => ({ text: o.text, is_correct: o.is_correct })), include: true, duplicate: false, source: '' }));
      showEditor();
    } catch (err) {
      TF.mount(root, TF.empty('triangle-alert', 'Testni yuklab bo‘lmadi', err.message, [TF.el('a', { class: 'btn btn-primary', href: TF.page('library.html') }, 'Kutubxonaga qaytish')]));
    }
  }

  (async function () {
    try {
      await TF.init({ auth: 'required', nav: 'import' });
    } catch (e) {
      return;
    }
    root = TF.$('#page');
    window.addEventListener('beforeunload', (e) => {
      if (S.step === 3) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    const edit = Number(TF.query.get('edit'));
    if (edit > 0) loadEdit(edit);
    else showUpload();
  })();
})();
