(function () {
  'use strict';

  function profileCard(user) {
    const form = TF.el('form', { novalidate: true }, TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'p-name', text: 'To‘liq ism' }), TF.el('input', { class: 'input', id: 'p-name', name: 'name', value: user.name, maxlength: 120 })), TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'p-email', text: 'Email' }), TF.el('input', { class: 'input', id: 'p-email', value: user.email, disabled: true })), TF.el('button', { class: 'btn btn-primary', type: 'submit' }, TF.icon('save'), 'Saqlash'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      if (name.length < 2) return TF.setErrors(form, { name: 'Ism kamida 2 ta belgidan iborat bo‘lishi kerak.' });
      TF.setErrors(form, {});
      await TF.busy(TF.$('button[type=submit]', form), async () => {
        try {
          const d = await Api.patch('/auth/profile', { name });
          Api.user = d.user;
          TF.toast('success', 'Profil yangilandi.');
          TF.$$('.user-chip .who b').forEach((n) => (n.textContent = d.user.name));
          TF.$$('.user-chip .avatar').forEach((n) => (n.textContent = TF.initials(d.user.name)));
        } catch (err) {
          if (err.status === 422) TF.setErrors(form, err.errors);
          else TF.toast('error', err.message);
        }
      });
    });
    return TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Profil' })), form);
  }

  function passwordCard() {
    const mk = (name, label, auto) => TF.el('div', { class: 'field' }, TF.el('label', { class: 'label', for: 'pw-' + name, text: label }), TF.el('input', { class: 'input', id: 'pw-' + name, name, type: 'password', autocomplete: auto }));
    const form = TF.el('form', { novalidate: true }, mk('current_password', 'Joriy parol', 'current-password'), mk('new_password', 'Yangi parol', 'new-password'), mk('confirm_password', 'Yangi parolni tasdiqlang', 'new-password'), TF.el('button', { class: 'btn btn-primary', type: 'submit' }, TF.icon('key-round'), 'Parolni yangilash'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(form).entries());
      const errs = {};
      if (!v.current_password) errs.current_password = 'Joriy parolni kiriting.';
      if (v.new_password.length < 8 || !/\p{L}/u.test(v.new_password) || !/\d/.test(v.new_password)) errs.new_password = 'Parol kamida 8 ta belgi, harf va raqamdan iborat bo‘lishi kerak.';
      else if (v.new_password !== v.confirm_password) errs.confirm_password = 'Parollar mos kelmadi.';
      TF.setErrors(form, errs);
      if (Object.keys(errs).length) return;
      await TF.busy(TF.$('button[type=submit]', form), async () => {
        try {
          await Api.post('/auth/password', v);
          form.reset();
          TF.toast('success', 'Parol yangilandi.');
        } catch (err) {
          if (err.status === 422) TF.setErrors(form, err.errors);
          else TF.toast('error', err.message);
        }
      });
    });
    return TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Parolni o‘zgartirish' })), form);
  }

  function themeCard() {
    const seg = TF.el('div', { class: 'theme-seg' });
    const paint = () =>
      TF.mount(
        seg,
        [['light', 'sun', 'Yorug‘'], ['dark', 'moon', 'Qorong‘i']].map(([k, i, l]) => TF.el('button', { type: 'button', class: TF.theme.get() === k ? 'active' : '', onclick: () => (TF.theme.set(k), paint()) }, TF.icon(i), l))
      );
    paint();
    return TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Ko‘rinish' })), TF.el('p', { class: 'small muted', style: 'margin-bottom:14px', text: 'Kechasi o‘qish uchun qorong‘i rejim qulay.' }), seg);
  }

  function developerCard() {
    const d = TF.dev;
    const contact = (icon, label, value, href) => TF.el('a', { class: 'contact', href, target: href.startsWith('tel:') ? null : '_blank', rel: 'noopener' }, TF.el('span', { class: 'c-ico' }, TF.icon(icon)), TF.el('span', { style: 'min-width:0' }, TF.el('small', { text: label }), TF.el('b', { text: value })));
    return TF.el(
      'section',
      { class: 'dev-card', id: 'developer' },
      TF.el('div', { class: 'row', style: 'gap:16px' }, TF.el('div', { class: 'dev-big-avatar', text: 'RS' }), TF.el('div', null, TF.el('span', { class: 'pill', style: 'margin-bottom:8px' }, TF.icon('code-2'), 'Dasturchi'), TF.el('h3', { text: d.name }))),
      TF.el('p', { text: 'TestFlow Pro talabalarning mustaqil o‘qishi uchun yaratilgan. Savol, taklif yoki hamkorlik bo‘yicha bemalol bog‘laning.' }),
      TF.el('div', { class: 'contact-grid' }, contact('instagram', 'Instagram', '@' + d.instagram, 'https://instagram.com/' + d.instagram), contact('send', 'Telegram', '@' + d.telegram, 'https://t.me/' + d.telegram), contact('phone', 'Telefon', d.phone, 'tel:' + d.phoneRaw))
    );
  }

  (async function () {
    let user;
    try {
      user = await TF.init({ auth: 'required', nav: 'settings' });
    } catch (e) {
      return;
    }
    const root = TF.$('#page');
    const about = TF.el('div', { class: 'card pad' }, TF.el('div', { class: 'card-head' }, TF.el('h3', { text: 'Dastur haqida' })), TF.el('div', { class: 'stack small', style: 'gap:8px' }, TF.el('div', { class: 'row between' }, TF.el('span', { class: 'muted', text: 'Nomi' }), TF.el('b', { text: 'TestFlow Pro' })), TF.el('div', { class: 'row between' }, TF.el('span', { class: 'muted', text: 'Texnologiyalar' }), TF.el('b', { text: 'PHP · MySQL · JavaScript' })), TF.el('div', { class: 'row between' }, TF.el('span', { class: 'muted', text: 'Ro‘yxatdan o‘tgan sana' }), TF.el('b', { text: TF.fmtDate(user.created_at) }))), TF.el('button', { class: 'btn btn-danger-ghost btn-block', type: 'button', style: 'margin-top:16px', onclick: () => Auth.logout() }, TF.icon('log-out'), 'Tizimdan chiqish'));
    TF.mount(root, TF.el('div', { class: 'page-head' }, TF.el('div', null, TF.el('h1', { text: 'Sozlamalar' }), TF.el('p', { text: 'Profil, xavfsizlik va ko‘rinish.' }))), TF.el('div', { class: 'grid grid-2' }, profileCard(user), passwordCard()), TF.el('div', { class: 'grid grid-2', style: 'margin-top:18px' }, themeCard(), about), TF.el('div', { style: 'margin-top:18px' }, developerCard()));
    if (location.hash === '#developer') setTimeout(() => TF.$('#developer').scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  })();
})();
