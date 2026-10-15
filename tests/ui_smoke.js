const path = require('path');
const mod = (n) => require(require.resolve(n, { paths: [process.cwd(), __dirname, '/tmp/node_modules'] }));
const { JSDOM, VirtualConsole, CookieJar } = mod('jsdom');
const XLSX = mod('xlsx');
const mammoth = mod('mammoth');

const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const jar = {};
let pass = 0;
let fail = 0;
const errors = [];

function cookieHeader() {
  return Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
}

async function jfetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  const c = cookieHeader();
  if (c) headers.Cookie = c;
  const res = await fetch(url, Object.assign({}, opts, { headers, redirect: 'manual' }));
  (res.headers.getSetCookie ? res.headers.getSetCookie() : []).forEach((sc) => {
    const [pair] = sc.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  });
  return res;
}

let csrf = '';
async function api(method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await jfetch(BASE + '/api' + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return (await res.json()).data;
}

function check(name, cond, info = '') {
  if (cond) {
    pass++;
    console.log('  PASS ' + name);
  } else {
    fail++;
    console.log('  FAIL ' + name + ' ' + info);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(win, fn, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if (fn(win.document, win)) return true;
    } catch (e) {}
    await sleep(60);
  }
  return false;
}

async function load(p) {
  const vc = new VirtualConsole();
  const pageErrors = [];
  vc.on('jsdomError', (e) => {
    const m = String(e.message || e);
    if (/Not implemented: navigation|Could not load script|Could not load link|ERR_|getaddrinfo|ENOTFOUND|EAI_AGAIN|fetch failed|Could not load/i.test(m)) return;
    pageErrors.push(p + ': ' + m);
  });
  vc.on('error', (m) => pageErrors.push(p + ' console.error: ' + String(m).slice(0, 200)));
  const dom = await JSDOM.fromURL(BASE + p, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      win.fetch = (u, o = {}) => jfetch(new URL(u, win.location.href).href, o);
      win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      win.IntersectionObserver = class { observe(n) { n.classList.add('in'); } unobserve() {} disconnect() {} };
      win.Element.prototype.scrollIntoView = () => {};
      win.Element.prototype.scrollTo = () => {};
      win.scrollTo = () => {};
      win.print = () => { win.__printed = true; };
      win.lucide = { createIcons() {} };
      win.XLSX = XLSX;
      win.mammoth = { convertToHtml: (o) => mammoth.convertToHtml({ buffer: Buffer.from(o.arrayBuffer) }), extractRawText: (o) => mammoth.extractRawText({ buffer: Buffer.from(o.arrayBuffer) }) };
      win.TextDecoder = TextDecoder;
      win.URL.createObjectURL = () => 'blob:x';
      win.URL.revokeObjectURL = () => {};
      win.Blob.prototype.arrayBuffer = function () {
        return new Promise((resolve) => {
          const fr = new win.FileReader();
          fr.onload = () => resolve(fr.result);
          fr.readAsArrayBuffer(this);
        });
      };
    }
  });
  dom.pageErrors = pageErrors;
  return dom;
}

const $$ = (win, s) => Array.from(win.document.querySelectorAll(s));
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));

(async () => {
  let r = await jfetch(BASE + '/api/auth/csrf');
  csrf = (await r.json()).data.csrf_token;
  const email = `ui${Date.now()}@example.com`;
  const reg = await api('POST', '/auth/register', { name: 'Test Talaba', email, password: 'Parol12345', confirm_password: 'Parol12345' });
  csrf = reg.csrf_token;
  const qs = [];
  for (let i = 1; i <= 60; i++) qs.push({ question: `Savol ${i}`, options: [{ text: `To‘g‘ri ${i}`, is_correct: true }, { text: `A${i}`, is_correct: false }, { text: `B${i}`, is_correct: false }, { text: `C${i}`, is_correct: false }] });
  const test = await api('POST', '/tests', { title: 'Smoke test', subject: 'Fan', questions: qs });

  console.log('LANDING');
  let dom = await load('/');
  let w = dom.window;
  check('landing renders features and demo', await waitFor(w, (d) => d.querySelectorAll('#featGrid .feat').length === 8 && d.querySelectorAll('#demoOpts .opt').length === 4));
  const demoBtn = w.document.querySelectorAll('#demoOpts .opt')[1];
  click(demoBtn);
  check('landing demo gives green/red feedback', w.document.querySelector('#demoOpts .is-correct') && w.document.querySelector('#demoOpts .is-wrong'));
  check('landing shows developer contacts', w.document.querySelectorAll('#developer .contact').length === 3 && w.document.body.textContent.includes('23.sanjarovich') && w.document.body.textContent.includes('Rayimbek_Sanjarovich') && w.document.body.textContent.includes('93 478 77 62'));
  check('landing adapts CTA for logged-in user', await waitFor(w, (d) => d.querySelector('#navStart').textContent.includes('Kabinet')));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('DASHBOARD');
  dom = await load('/pages/dashboard.html');
  w = dom.window;
  check('dashboard renders welcome + 8 stat cards', await waitFor(w, (d) => d.querySelector('.welcome') && d.querySelectorAll('.stat-card').length === 8));
  check('dashboard greets by first name', w.document.querySelector('.welcome h1').textContent.includes('Test'));
  check('sidebar shell mounted with developer credit', w.document.querySelector('.sidebar') && w.document.querySelector('.dev-mini').textContent.includes('Rayimbek Sanjarovich'));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('LIBRARY');
  dom = await load('/pages/library.html');
  w = dom.window;
  check('library lists saved test card', await waitFor(w, (d) => d.querySelectorAll('.test-card').length === 1 && d.querySelector('.test-card').textContent.includes('Smoke test') && d.querySelector('.test-card').textContent.includes('60 ta savol')));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('TEST CONFIG');
  dom = await load('/pages/test.html?test=' + test.id);
  w = dom.window;
  check('config shows 25/30/50 + all choices, none disabled', await waitFor(w, (d) => d.querySelectorAll('.choice-grid .choice').length === 4 && d.querySelectorAll('.choice-grid .choice:disabled').length === 0));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('ENGINE (PRACTICE)');
  const att = await api('POST', `/tests/${test.id}/attempts`, { mode: 'practice', count: 25 });
  dom = await load('/pages/test.html?attempt=' + att.attempt_id);
  w = dom.window;
  check('engine renders question with 4 options and 25 nav buttons', await waitFor(w, (d) => d.querySelectorAll('.opts .opt').length === 4 && d.querySelectorAll('.nav-num').length === 25));
  check('no timer elements anywhere', !/taymer|timer|countdown|\d\d:\d\d/i.test(w.document.body.textContent));
  const firstOpts = $$(w, '.opts .opt');
  const rightIdx = firstOpts.findIndex((b) => b.textContent.includes('To‘g‘ri'));
  click(firstOpts[rightIdx]);
  check('correct answer: green option + success feedback', await waitFor(w, (d) => d.querySelector('.opt.is-correct') && d.querySelector('.feedback.show.ok') && d.querySelector('.nav-num.is-correct')));
  click($$(w, '.opts .opt')[0]);
  check('answered options are locked', $$(w, '.opts .opt').every((b) => b.disabled));
  click(w.document.querySelector('.q-foot .btn-primary'));
  check('next question loads, progress updated', await waitFor(w, (d) => d.querySelector('.counter').textContent === 'Savol 2 / 25' && d.querySelector('.quiz-progress .progress-bar').style.width === '4%'));
  const opts2 = $$(w, '.opts .opt');
  const wrongIdx = opts2.findIndex((b) => !b.textContent.includes('To‘g‘ri'));
  click(opts2[wrongIdx]);
  check('wrong answer: red option, correct highlighted green', await waitFor(w, (d) => d.querySelector('.opt.is-wrong') && d.querySelector('.opt.is-correct') && d.querySelector('.feedback.show.bad')));
  click($$(w, '.nav-num')[0]);
  check('returning to Q1 keeps answer and feedback', await waitFor(w, (d) => d.querySelector('.counter').textContent === 'Savol 1 / 25' && d.querySelector('.opt.is-correct') && d.querySelector('.feedback.show.ok')));
  click(w.document.querySelector('.star-btn'));
  check('bookmark toggles on', await waitFor(w, (d) => d.querySelector('.star-btn.on')));
  await sleep(700);
  const st = await api('GET', '/attempts/' + att.attempt_id);
  check('server saved progress and answers', st.questions.filter((q) => q.selected_option_id !== null).length === 2);
  errors.push(...dom.pageErrors);
  w.close();

  dom = await load('/pages/test.html?attempt=' + att.attempt_id);
  w = dom.window;
  check('refresh resumes at saved question with answers', await waitFor(w, (d) => d.querySelector('.counter') && d.querySelector('.nav-num.is-correct') && d.querySelector('.nav-num.is-wrong')));
  click($$(w, '.nav-num')[24]);
  check('last question shows Finish button, hides Next', await waitFor(w, (d) => !d.querySelector('.q-foot .btn-success').classList.contains('hidden') && d.querySelector('.q-foot .btn-primary').classList.contains('hidden')));
  click(w.document.querySelector('.q-foot .btn-success'));
  check('finish asks for confirmation about unanswered questions', await waitFor(w, (d) => d.querySelector('.modal-overlay') && d.querySelector('.modal-body').textContent.includes('23')));
  click(w.document.querySelector('.modal-foot .btn-primary'));
  await sleep(900);
  const done = await api('GET', '/attempts/' + att.attempt_id);
  check('attempt completed on server (1 correct, 1 wrong, 23 unanswered)', done.attempt.status === 'completed' && done.attempt.result.correct === 1 && done.attempt.result.incorrect === 1 && done.attempt.result.unanswered === 23);
  errors.push(...dom.pageErrors);
  w.close();

  console.log('ENGINE (EXAM)');
  const ex = await api('POST', `/tests/${test.id}/attempts`, { mode: 'exam', count: 25 });
  dom = await load('/pages/test.html?attempt=' + ex.attempt_id);
  w = dom.window;
  await waitFor(w, (d) => d.querySelectorAll('.opts .opt').length === 4);
  click($$(w, '.opts .opt')[0]);
  check('exam: selection saved without correct/wrong colouring', await waitFor(w, (d) => d.querySelector('.opt.is-selected') && !d.querySelector('.opt.is-correct') && !d.querySelector('.opt.is-wrong') && d.querySelector('.nav-num.is-answered')));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('RESULTS');
  dom = await load('/pages/results.html?attempt=' + att.attempt_id);
  w = dom.window;
  check('results show score ring, 4 stat cards, 4%', await waitFor(w, (d) => d.querySelector('.ring .fg') && d.querySelectorAll('.stat-card').length === 4 && d.querySelector('.ring-text b').textContent === '4'));
  click($$(w, '.row.wrap .btn-primary')[0]);
  check('review lists 25 questions with colour states', await waitFor(w, (d) => d.querySelectorAll('.review-item').length === 25 && d.querySelector('.review-item.correct') && d.querySelector('.review-item.wrong') && d.querySelector('.review-item.unanswered')));
  const printBtn = $$(w, '.row.wrap .btn-secondary')[1];
  click(printBtn);
  await waitFor(w, (d) => d.querySelector('.modal-overlay'));
  w.document.querySelector('#inc-rev').checked = true;
  click(w.document.querySelector('.modal-foot .btn-primary'));
  check('print report builds with review and calls print()', await waitFor(w, (d, ww) => d.querySelectorAll('#print-report .p-q').length === 25 && ww.__printed === true));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('MISTAKES / STATISTICS / SETTINGS');
  dom = await load('/pages/mistakes.html');
  w = dom.window;
  check('mistakes page lists the wrong answer with revision button', await waitFor(w, (d) => d.querySelectorAll('.m-item').length >= 1 && d.querySelector('.m-group .btn-primary')));
  click($$(w, '.tab')[1]);
  check('bookmarks tab shows bookmarked question', await waitFor(w, (d) => d.querySelectorAll('.m-item').length >= 1));
  errors.push(...dom.pageErrors);
  w.close();
  dom = await load('/pages/statistics.html');
  w = dom.window;
  check('statistics render charts from real data', await waitFor(w, (d) => d.querySelectorAll('.chart svg').length >= 3 && d.querySelectorAll('.stat-card').length === 8));
  errors.push(...dom.pageErrors);
  w.close();
  dom = await load('/pages/settings.html');
  w = dom.window;
  check('settings has profile, password, theme and developer card', await waitFor(w, (d) => d.querySelector('#developer') && d.querySelectorAll('#developer .contact').length === 3 && d.querySelector('#p-name')));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('IMPORT');
  dom = await load('/pages/import.html');
  w = dom.window;
  check('import page shows dropzone and format table', await waitFor(w, (d) => d.querySelector('.dropzone') && d.querySelector('.tbl')));
  const csv = "Savol,To'g'ri javob,Xato 1,Xato 2\nHTML nima?,Belgilash tili,Baza,OT\nCSS nima?,Bezash tili,Server,Kompilyator\nCSS nima?,Bezash tili,Server,Kompilyator\n,Yo'q,A,B\nSavol,Javob,,\n";
  const file = new w.File([csv], 'import-test.csv', { type: 'text/csv' });
  const input = w.document.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('mapping step: 3 valid, 2 invalid, 1 duplicate', await waitFor(w, (d) => d.querySelector('.stat-strip') && d.querySelector('.stat-strip .s.ok b').textContent === '3' && d.querySelector('.stat-strip .s.bad b').textContent === '2' && d.querySelector('.stat-strip .s.warn b').textContent === '1', 10000));
  click(w.document.querySelector('.row .btn-primary.btn-lg'));
  check('editor shows 3 question cards, duplicate flagged', await waitFor(w, (d) => d.querySelectorAll('.q-edit').length === 3 && d.querySelector('.q-edit.dup')));
  const titleIn = w.document.querySelector('#m-title');
  check('title prefilled from filename', titleIn.value === 'import-test');
  const radios = $$(w, '.q-edit')[0].querySelectorAll('input[type=radio]');
  radios[1].checked = true;
  radios[1].dispatchEvent(new w.Event('change', { bubbles: true }));
  check('changing correct answer updates editor', await waitFor(w, (d) => d.querySelectorAll('.q-edit')[0].querySelectorAll('.opt-edit')[1].classList.contains('correct')));
  radios[0].checked = true;
  radios[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  const skip = $$(w, '.q-edit')[2].querySelector('.qe-head input[type=checkbox]');
  skip.checked = false;
  skip.dispatchEvent(new w.Event('change', { bubbles: true }));
  check('skipping a question updates the count', await waitFor(w, (d) => d.querySelector('.sticky-bar').textContent.includes('2 ta savol saqlanadi')));
  click(w.document.querySelector('.sticky-bar .btn-success'));
  check('save persists and shows success panel', await waitFor(w, (d) => d.querySelector('.success-panel'), 10000));
  const lib = await api('GET', '/tests?q=import-test');
  check('imported test exists in DB with 2 questions', lib.total === 1 && lib.items[0].question_count === 2);
  errors.push(...dom.pageErrors);
  w.close();

  console.log('EDIT MODE');
  dom = await load('/pages/import.html?edit=' + lib.items[0].id);
  w = dom.window;
  check('edit mode loads questions from API', await waitFor(w, (d) => d.querySelectorAll('.q-edit').length === 2 && d.querySelector('.page-head h1').textContent.includes('tahrirlash')));
  click(w.document.querySelector('.sticky-bar .btn-success'));
  check('edit save creates version 2', await waitFor(w, (d) => d.querySelector('.success-panel') && d.querySelector('.success-panel').textContent.includes('v2')));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('AUTH PAGES');
  for (const [k, p] of Object.entries(jar)) delete jar[k];
  dom = await load('/pages/login.html');
  w = dom.window;
  check('login page renders form and aside with developer credit', await waitFor(w, (d) => d.querySelector('#loginForm') && d.querySelector('.auth-aside').textContent.includes('Rayimbek Sanjarovich') && d.querySelector('.pw-toggle')));
  errors.push(...dom.pageErrors);
  w.close();
  dom = await load('/pages/dashboard.html');
  w = dom.window;
  await sleep(1200);
  check('guest on dashboard is redirected to login (no content rendered)', !w.document.querySelector('.welcome'));
  w.close();
  dom = await load('/pages/register.html');
  w = dom.window;
  await waitFor(w, (d) => d.querySelector('#registerForm') && d.querySelector('.pw-toggle'));
  const rf = w.document.querySelector('#registerForm');
  rf.elements.name.value = 'A';
  rf.elements.email.value = 'bad';
  rf.elements.password.value = 'short';
  rf.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  check('register shows client-side validation errors', await waitFor(w, (d) => d.querySelectorAll('.field-error').length >= 3));
  errors.push(...dom.pageErrors);
  w.close();

  console.log('\nPAGE ERRORS: ' + errors.length);
  errors.slice(0, 10).forEach((e) => console.log('  ! ' + e));
  check('no uncaught JS errors in any page', errors.length === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('HARNESS ERROR', e);
  process.exit(2);
});
