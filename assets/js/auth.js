(function () {
  'use strict';

  const safeNext = () => {
    const n = TF.query.get('next');
    return n && /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : 'dashboard.html';
  };

  function enhancePasswords() {
    TF.$$('.input-group.has-toggle').forEach((g) => {
      const input = TF.$('input', g);
      const btn = TF.el('button', { type: 'button', class: 'pw-toggle', 'aria-label': 'Parolni ko‘rsatish' }, TF.icon('eye'));
      btn.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        TF.mount(btn, TF.icon(show ? 'eye-off' : 'eye'));
      });
      g.append(btn);
    });
  }

  function strengthOf(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/\p{L}/u.test(pw) && /\d/.test(pw)) s++;
    if (pw.length >= 12) s++;
    if (/[^\p{L}\d]/u.test(pw) && /[A-ZА-Я]/u.test(pw)) s++;
    return pw ? Math.max(1, s) : 0;
  }

  function clientErrors(v, mode) {
    const e = {};
    if (mode === 'register' && v.name.trim().length < 2) e.name = 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak.';
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || '')) e.email = 'Email manzili noto‘g‘ri.';
    if (mode === 'register' || mode === 'reset') {
      if (v.password.length < 8 || !/\p{L}/u.test(v.password) || !/\d/.test(v.password)) e.password = 'Parol kamida 8 ta belgi, harf va raqamdan iborat bo‘lishi kerak.';
      else if (v.password !== v.confirm_password) e.confirm_password = 'Parollar mos kelmadi.';
    }
    if (mode === 'login' && !v.password) e.password = 'Parolni kiriting.';
    return e;
  }

  const values = (form) => Object.fromEntries(new FormData(form).entries());

  function initLogin() {
    const form = TF.$('#loginForm');
    if (TF.query.get('expired')) TF.toast('warning', 'Sessiya muddati tugadi. Qayta kiring.');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values(form);
      const errs = clientErrors(v, 'login');
      TF.setErrors(form, errs);
      if (Object.keys(errs).length) return;
      await TF.busy(TF.$('button[type=submit]', form), async () => {
        try {
          const d = await Api.post('/auth/login', { email: v.email, password: v.password });
          Api.csrf = d.csrf_token;
          location.href = safeNext();
        } catch (err) {
          if (err.status === 422) TF.setErrors(form, err.errors);
          else TF.toast('error', err.message);
        }
      });
    });
  }

  function initRegister() {
    const form = TF.$('#registerForm');
    const meter = TF.$('#strength');
    form.elements.password.addEventListener('input', (e) => (meter.dataset.level = String(strengthOf(e.target.value))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values(form);
      const errs = clientErrors(v, 'register');
      TF.setErrors(form, errs);
      if (Object.keys(errs).length) return;
      await TF.busy(TF.$('button[type=submit]', form), async () => {
        try {
          const d = await Api.post('/auth/register', v);
          Api.csrf = d.csrf_token;
          location.href = TF.page('dashboard.html');
        } catch (err) {
          if (err.status === 422) TF.setErrors(form, err.errors);
          else TF.toast('error', err.message);
        }
      });
    });
  }

  function notice(type, text) {
    const holder = TF.$('#forgotNotice');
    TF.mount(holder, TF.el('div', { class: 'badge badge-' + (type === 'ok' ? 'green' : 'amber'), style: 'display:flex;white-space:normal;padding:12px 14px;border-radius:12px;margin-bottom:16px;font-size:.88rem;line-height:1.5' }, TF.icon(type === 'ok' ? 'circle-check' : 'info'), text));
  }

  function initForgot() {
    const token = TF.query.get('token');
    const forgot = TF.$('#forgotForm');
    const reset = TF.$('#resetForm');
    if (token) {
      forgot.classList.add('hidden');
      reset.classList.remove('hidden');
      TF.$('#forgotTitle').textContent = 'Yangi parol o‘rnating';
      TF.$('#forgotSub').textContent = 'Yangi parolni kiriting.';
    }
    forgot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values(forgot);
      const errs = clientErrors(v, 'forgot');
      TF.setErrors(forgot, errs);
      if (Object.keys(errs).length) return;
      await TF.busy(TF.$('button[type=submit]', forgot), async () => {
        try {
          const d = await Api.post('/auth/forgot-password', { email: v.email });
          void d;
          notice('ok', 'Agar bu email ro‘yxatdan o‘tgan bo‘lsa, tiklash havolasi yuborildi.');
        } catch (err) {
          if (err.status === 501) notice('info', err.message);
          else TF.toast('error', err.message);
        }
      });
    });
    reset.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = values(reset);
      const errs = clientErrors(v, 'reset');
      TF.setErrors(reset, errs);
      if (Object.keys(errs).length) return;
      await TF.busy(TF.$('button[type=submit]', reset), async () => {
        try {
          await Api.post('/auth/reset-password', { token, password: v.password, confirm_password: v.confirm_password });
          TF.toast('success', 'Parol yangilandi.');
          setTimeout(() => (location.href = TF.page('login.html')), 900);
        } catch (err) {
          if (err.status === 422) TF.setErrors(reset, err.errors);
          else if (err.status === 501) notice('info', err.message);
          else TF.toast('error', err.message);
        }
      });
    });
  }

  (async function () {
    try {
      await TF.init({ auth: 'guest', shell: false });
    } catch (e) {
      return;
    }
    TF.authAside(TF.$('#auth-aside'));
    enhancePasswords();
    const page = document.body.dataset.page;
    if (page === 'login') initLogin();
    if (page === 'register') initRegister();
    if (page === 'forgot') initForgot();
  })();
})();
