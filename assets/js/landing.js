(function () {
  'use strict';

  const FEATURES = [
    ['upload-cloud', 'Oson import', 'Excel, CSV, Word va TXT fayllaridan savollarni oling. Saqlashdan oldin ko‘rib chiqing va tahrirlang.'],
    ['shuffle', 'Tasodifiy tartib', 'Savollar va variantlar har bir urinishda bir marta aralashtiriladi, javob joyi doim o‘zgaradi.'],
    ['zap', 'Darhol feedback', 'Mashq rejimida javob zahoti tekshiriladi. Imtihon rejimida natija oxirida ochiladi.'],
    ['target', 'Xatolar ustida ishlash', 'Noto‘g‘ri javoblaringiz saqlanadi — faqat shularni qayta mashq qiling.'],
    ['star', 'Belgilangan savollar', 'Qiyin savollarni yulduzcha bilan belgilab, keyin alohida takrorlang.'],
    ['history', 'Davom ettirish', 'Brauzerni yopsangiz ham, test aynan qolgan joyingizdan davom etadi.'],
    ['bar-chart-3', 'Haqiqiy statistika', 'O‘rtacha natija, faollik, zaif mavzular — barchasi real yozuvlardan hisoblanadi.'],
    ['printer', 'Hisobot va PDF', 'Natijangizni chop eting yoki PDF sifatida saqlang.']
  ];
  const STEPS = [
    ['Ro‘yxatdan o‘ting', 'Ism, email va parol bilan bir daqiqada hisob yarating.'],
    ['Faylni yuklang', 'Savollar jadvalini sudrab tashlang va ustunlarni tekshiring.'],
    ['Test yeching', '25, 30 yoki 50 ta savolni mashq yoki imtihon rejimida yeching.'],
    ['Tahlil qiling', 'Natijani ko‘ring, xatolaringizni takrorlang va o‘sishni kuzating.']
  ];
  const DEMO = [['Belgilash tili', true], ['Ma’lumotlar bazasi', false], ['Operatsion tizim', false], ['Dasturlash muharriri', false]];

  function reveal() {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    TF.$$('.reveal').forEach((n) => io.observe(n));
  }

  function demo() {
    const box = TF.$('#demoOpts');
    const note = TF.$('#demoNote');
    let done = false;
    const paint = (picked) => {
      TF.mount(
        box,
        DEMO.map(([text, ok], i) => {
          let cls = 'opt';
          let mk = null;
          if (picked !== null) {
            if (ok) {
              cls += ' is-correct' + (picked === i ? ' pop' : '');
              mk = 'circle-check';
            } else if (picked === i) {
              cls += ' is-wrong shake';
              mk = 'circle-x';
            } else cls += ' is-dim';
          }
          return TF.el('button', { type: 'button', class: cls, disabled: picked !== null, onclick: () => !done && ((done = true), paint(i), (note.textContent = DEMO[i][1] ? 'To‘g‘ri javob! Aynan shunday ishlaydi.' : 'Noto‘g‘ri — to‘g‘ri javob yashil rangda ko‘rsatildi.')) }, TF.el('span', { class: 'letter', text: 'ABCD'[i] }), TF.el('span', { class: 'txt', text: text }), TF.el('span', { class: 'mark' }, mk ? TF.icon(mk) : null));
        })
      );
    };
    paint(null);
  }

  (async function () {
    TF.$('#year').textContent = String(new Date().getFullYear());
    TF.$('#themeBtn').addEventListener('click', () => {
      TF.theme.toggle();
      TF.mount(TF.$('#themeBtn'), TF.icon(TF.theme.get() === 'dark' ? 'sun' : 'moon'));
    });
    TF.mount(TF.$('#themeBtn'), TF.icon(TF.theme.get() === 'dark' ? 'sun' : 'moon'));
    TF.mount(TF.$('#featGrid'), FEATURES.map(([i, t, d], n) => TF.el('div', { class: 'card feat hover reveal', style: `--i:${n % 4}` }, TF.el('div', { class: 'f-ico' }, TF.icon(i)), TF.el('h3', { text: t }), TF.el('p', { text: d }))));
    TF.mount(TF.$('#stepsGrid'), STEPS.map(([t, d], n) => TF.el('div', { class: 'card st reveal', style: `--i:${n}` }, TF.el('h3', { text: t }), TF.el('p', { text: d }))));
    demo();
    reveal();
    try {
      await Api.boot();
      if (Api.user) {
        TF.$('#navLogin').remove();
        const s = TF.$('#navStart');
        s.href = TF.page('dashboard.html');
        s.textContent = 'Kabinetga o‘tish';
        const h = TF.$('#heroStart');
        h.href = TF.page('dashboard.html');
        TF.mount(h, TF.icon('layout-dashboard'), ' Kabinetga o‘tish');
      }
    } catch (e) {}
  })();
})();
