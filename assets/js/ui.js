(function () {
  'use strict';

  const cfg = window.TF_CONFIG || {};
  const TF = (window.TF = {});
  const path = location.pathname;

  TF.base = typeof cfg.BASE_PATH === 'string' ? cfg.BASE_PATH : path.replace(/\/pages\/[^/]*$/, '').replace(/\/index\.html$/, '').replace(/\/$/, '');
  TF.apiBase = cfg.API_BASE || TF.base + '/api';
  TF.page = (name) => TF.base + '/pages/' + name;
  TF.home = () => (TF.base || '') + '/';
  TF.dev = cfg.DEVELOPER;
  TF.query = new URLSearchParams(location.search);

  TF.$ = (sel, root = document) => root.querySelector(sel);
  TF.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  TF.el = function (tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'dataset') Object.assign(n.dataset, v);
        else if (k === 'for') n.htmlFor = v;
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'string') n.style.cssText = v;
        else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return n;
  };

  TF.icon = (name, cls) => TF.el('i', { 'data-lucide': name, class: cls || null });
  TF.refreshIcons = () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  };
  TF.clear = (node) => {
    node.replaceChildren();
    return node;
  };
  TF.mount = (node, ...kids) => {
    node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
    return node;
  };

  let iconTimer = null;
  new MutationObserver(() => {
    clearTimeout(iconTimer);
    iconTimer = setTimeout(() => {
      if (document.querySelector('i[data-lucide]')) TF.refreshIcons();
    }, 16);
  }).observe(document.documentElement, { childList: true, subtree: true });

  TF.debounce = (fn, ms = 300) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  TF.parseDate = (s) => {
    if (!s) return null;
    const d = new Date(String(s).replace(' ', 'T'));
    return isNaN(d) ? null : d;
  };
  const pad = (n) => String(n).padStart(2, '0');
  TF.fmtDate = (s, withTime = false) => {
    const d = TF.parseDate(s);
    if (!d) return '—';
    const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
  };
  const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
  TF.weekday = (s) => WEEKDAYS[TF.parseDate(s + ' 00:00:00').getDay()];
  TF.initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  TF.scoreClass = (p) => (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low');
  TF.plural = (n, word) => `${n} ta ${word}`;

  TF.countUp = (node, to, opts = {}) => {
    const suffix = opts.suffix || '';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !to) {
      node.textContent = to + suffix;
      return;
    }
    const dur = opts.duration || 900;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      node.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  TF.stagger = (container) => {
    Array.from(container.children).forEach((c, i) => c.style.setProperty('--i', i));
    container.classList.add('stagger');
  };

  TF.toast = (type, message, ms = 4500) => {
    let wrap = TF.$('.toast-wrap');
    if (!wrap) {
      wrap = TF.el('div', { class: 'toast-wrap', 'aria-live': 'polite' });
      document.body.append(wrap);
    }
    const icons = { success: 'circle-check', error: 'circle-alert', warning: 'triangle-alert', info: 'info' };
    const t = TF.el('div', { class: 'toast ' + type, role: 'status' }, TF.icon(icons[type] || 'info'), TF.el('span', { text: message }));
    const remove = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    };
    t.addEventListener('click', remove);
    wrap.append(t);
    setTimeout(remove, ms);
  };

  TF.modal = function (opts) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const actions = opts.actions || [];
      const foot = TF.el('div', { class: 'modal-foot' });
      const overlay = TF.el('div', { class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true' });
      let done = false;
      const close = (value) => {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey);
        overlay.classList.add('closing');
        setTimeout(() => {
          overlay.remove();
          if (prevFocus && prevFocus.focus) prevFocus.focus();
        }, 180);
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === 'Escape' && opts.dismissible !== false) close(null);
      };
      actions.forEach((a) => {
        const btn = TF.el('button', { type: 'button', class: 'btn ' + (a.variant || 'btn-secondary') }, a.icon ? TF.icon(a.icon) : null, a.label);
        btn.addEventListener('click', async () => {
          if (a.handler) {
            btn.classList.add('is-loading');
            let r;
            try {
              r = await a.handler();
            } finally {
              btn.classList.remove('is-loading');
            }
            if (r === false) return;
          }
          close(a.value === undefined ? true : a.value);
        });
        a.node = btn;
        foot.append(btn);
      });
      const modal = TF.el(
        'div',
        { class: 'modal' + (opts.wide ? ' wide' : '') },
        TF.el('div', { class: 'modal-head' }, opts.icon ? TF.el('span', { class: 'm-icon' + (opts.danger ? ' danger' : '') }, TF.icon(opts.icon)) : null, TF.el('h3', { text: opts.title || '' })),
        TF.el('div', { class: 'modal-body' }, typeof opts.body === 'string' ? TF.el('p', { text: opts.body }) : opts.body),
        actions.length ? foot : null
      );
      overlay.append(modal);
      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay && opts.dismissible !== false) close(null);
      });
      document.addEventListener('keydown', onKey);
      document.body.append(overlay);
      const focusTarget = modal.querySelector('input,textarea,select') || (actions.length ? actions[actions.length - 1].node : null);
      if (focusTarget) setTimeout(() => focusTarget.focus(), 60);
    });
  };

  TF.confirm = (title, text, o = {}) =>
    TF.modal({
      title,
      body: text,
      icon: o.icon || (o.danger ? 'triangle-alert' : 'circle-help'),
      danger: !!o.danger,
      actions: [
        { label: o.cancel || 'Bekor qilish', value: false, variant: 'btn-ghost' },
        { label: o.ok || 'Tasdiqlash', value: true, variant: o.danger ? 'btn-danger' : 'btn-primary' }
      ]
    }).then((v) => v === true);

  TF.busy = async (btn, fn) => {
    if (btn.classList.contains('is-loading')) return undefined;
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      return await fn();
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  };

  TF.setErrors = (form, errors) => {
    TF.$$('.field-error', form).forEach((n) => n.remove());
    TF.$$('.is-invalid', form).forEach((n) => n.classList.remove('is-invalid'));
    let first = null;
    Object.entries(errors || {}).forEach(([name, msg]) => {
      const input = form.elements[name];
      if (!input) return;
      input.classList.add('is-invalid');
      const holder = input.closest('.field') || input.parentElement;
      holder.append(TF.el('div', { class: 'field-error', text: msg }));
      first = first || input;
    });
    if (first) first.focus();
  };

  TF.skeletons = (n, cls = 'sk-card') => Array.from({ length: n }, () => TF.el('div', { class: 'skeleton ' + cls }));

  TF.empty = (icon, title, text, actions, compact) =>
    TF.el('div', { class: 'empty' + (compact ? ' compact' : '') }, TF.el('div', { class: 'empty-icon' }, TF.icon(icon)), TF.el('h3', { text: title }), text ? TF.el('p', { text }) : null, actions && actions.length ? TF.el('div', { class: 'actions' }, actions) : null);

  TF.link = (href, className, ...kids) => TF.el('a', { href, class: className || null }, ...kids);

  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, text) => {
    const n = document.createElementNS(SVGNS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, String(v)));
    if (text !== undefined) n.textContent = text;
    return n;
  };

  TF.charts = {
    bars(container, data, opts = {}) {
      TF.clear(container);
      const H = opts.height || 190;
      const slot = opts.slot || 52;
      const W = Math.max(300, data.length * slot);
      const top = 16;
      const bottom = 28;
      const max = Math.max(opts.max || 0, ...data.map((d) => d.segments.reduce((s, x) => s + x.value, 0)), 1);
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label || 'Diagramma' });
      [0, 0.5, 1].forEach((f) => {
        const y = top + (H - top - bottom) * (1 - f);
        s.append(svg('line', { x1: 0, x2: W, y1: y, y2: y, class: 'grid-line' }));
      });
      data.forEach((d, i) => {
        const x = i * slot + slot * 0.2;
        const bw = slot * 0.6;
        let acc = 0;
        d.segments.forEach((seg) => {
          if (seg.value <= 0) return;
          const h = ((H - top - bottom) * seg.value) / max;
          const y = H - bottom - acc - h;
          const r = svg('rect', { x, y, width: bw, height: h, rx: 5, class: 'bar ' + (seg.cls || 'bar-blue'), style: `--i:${i}` });
          r.append(svg('title', {}, `${d.label}: ${seg.value}`));
          s.append(r);
          acc += h;
        });
        if (acc === 0) s.append(svg('rect', { x, y: H - bottom - 3, width: bw, height: 3, rx: 1.5, class: 'bar bar-soft' }));
        s.append(svg('text', { x: x + bw / 2, y: H - 9, 'text-anchor': 'middle' }, d.label));
        const total = d.segments.reduce((sum, x) => sum + x.value, 0);
        if (total > 0) s.append(svg('text', { x: x + bw / 2, y: H - bottom - acc - 5, 'text-anchor': 'middle', style: 'font-weight:700' }, total));
      });
      container.append(s);
    },
    line(container, points, opts = {}) {
      TF.clear(container);
      const W = Math.max(320, points.length * 46);
      const H = opts.height || 210;
      const l = 30;
      const r = 12;
      const t = 14;
      const b = 28;
      const min = 0;
      const max = 100;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opts.label || 'Grafik' });
      const defs = svg('defs');
      const grad = svg('linearGradient', { id: 'areaGrad', x1: 0, y1: 0, x2: 0, y2: 1 });
      grad.append(svg('stop', { offset: '0%', 'stop-color': '#3478f6', 'stop-opacity': 0.35 }), svg('stop', { offset: '100%', 'stop-color': '#3478f6', 'stop-opacity': 0 }));
      defs.append(grad);
      s.append(defs);
      [0, 25, 50, 75, 100].forEach((v) => {
        const y = t + (H - t - b) * (1 - (v - min) / (max - min));
        s.append(svg('line', { x1: l, x2: W - r, y1: y, y2: y, class: 'grid-line' }), svg('text', { x: l - 6, y: y + 4, 'text-anchor': 'end' }, v));
      });
      const step = points.length > 1 ? (W - l - r) / (points.length - 1) : 0;
      const xy = points.map((p, i) => [points.length > 1 ? l + i * step : (W + l - r) / 2, t + (H - t - b) * (1 - (p.value - min) / (max - min))]);
      if (xy.length > 1) {
        const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        const len = Math.ceil(xy.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - xy[i - 1][0], p[1] - xy[i - 1][1]) : 0), 0)) + 10;
        s.append(svg('path', { d: `${d} L${xy[xy.length - 1][0]} ${H - b} L${xy[0][0]} ${H - b} Z`, class: 'area' }));
        s.append(svg('path', { d, class: 'line', style: `--len:${len}` }));
      }
      xy.forEach((p, i) => {
        const c = svg('circle', { cx: p[0], cy: p[1], r: 5, class: 'dot', style: `--i:${i}` });
        c.append(svg('title', {}, `${points[i].label}: ${points[i].value}%`));
        s.append(c);
        if (points.length <= 12 || i % Math.ceil(points.length / 10) === 0) s.append(svg('text', { x: p[0], y: H - 9, 'text-anchor': 'middle' }, points[i].label));
      });
      container.append(s);
    }
  };

  TF.hbar = (label, value, suffix = '%', tone) =>
    TF.el('div', { class: 'hbar' }, TF.el('div', { class: 'hb-top' }, TF.el('span', { text: label, title: label }), TF.el('span', { text: value + suffix })), TF.el('div', { class: 'progress' }, TF.el('div', { class: 'progress-bar' + (tone === 'green' || value >= 70 ? ' green' : ''), style: `width:${Math.max(2, Math.min(100, value))}%` })));

  TF.theme = {
    get: () => document.documentElement.getAttribute('data-theme') || 'light',
    set(t) {
      document.documentElement.setAttribute('data-theme', t);
      try {
        localStorage.setItem('tf-theme', t);
      } catch (e) {}
      TF.$$('[data-theme-icon]').forEach((b) => TF.mount(b, TF.icon(t === 'dark' ? 'sun' : 'moon')));
    },
    init() {
      let t = null;
      try {
        t = localStorage.getItem('tf-theme');
      } catch (e) {}
      if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
    },
    toggle() {
      TF.theme.set(TF.theme.get() === 'dark' ? 'light' : 'dark');
    }
  };
  TF.theme.init();

  const NAV = [
    ['dashboard', 'Bosh sahifa', 'layout-dashboard'],
    ['library', 'Testlarim', 'library'],
    ['import', 'Test yuklash', 'upload-cloud'],
    ['mistakes', 'Xatolarim', 'target'],
    ['statistics', 'Statistika', 'bar-chart-3'],
    ['settings', 'Sozlamalar', 'settings']
  ];

  TF.mountShell = function (active, user) {
    const page = document.getElementById('page');
    const app = TF.el('div', { class: 'app' });
    const themeBtn = () => TF.el('button', { type: 'button', class: 'icon-light', 'data-theme-icon': '', 'aria-label': 'Mavzuni almashtirish', onclick: TF.theme.toggle }, TF.icon(TF.theme.get() === 'dark' ? 'sun' : 'moon'));
    const logout = TF.el('button', { type: 'button', class: 'icon-light', 'aria-label': 'Chiqish', title: 'Chiqish', onclick: () => Auth.logout() }, TF.icon('log-out'));
    const sidebar = TF.el(
      'aside',
      { class: 'sidebar' },
      TF.el('a', { class: 'brand', href: TF.page('dashboard.html') }, TF.el('span', { class: 'brand-mark' }, TF.icon('layers')), TF.el('span', null, 'TestFlow', TF.el('small', { text: 'Pro' }))),
      TF.el('nav', { class: 'nav' }, NAV.map(([id, label, icon]) => TF.el('a', { class: 'nav-item' + (id === active ? ' active' : ''), href: TF.page(id + '.html'), 'data-nav-id': id }, TF.icon(icon), TF.el('span', { text: label })))),
      TF.el(
        'div',
        { class: 'sidebar-foot' },
        TF.el('a', { class: 'dev-mini', href: TF.page('settings.html') + '#developer' }, TF.el('span', { class: 'dev-avatar', text: 'RS' }), TF.el('span', null, TF.el('b', { text: 'Dasturchi' }), TF.el('span', { text: TF.dev.name }))),
        TF.el('div', { class: 'user-chip' }, TF.el('span', { class: 'avatar', text: TF.initials(user.name) }), TF.el('span', { class: 'who' }, TF.el('b', { text: user.name }), TF.el('span', { text: user.email })), themeBtn(), logout)
      )
    );
    const topbar = TF.el(
      'header',
      { class: 'topbar' },
      TF.el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Menyu', onclick: () => app.classList.toggle('sidebar-open') }, TF.icon('menu')),
      TF.el('a', { class: 'brand', href: TF.page('dashboard.html') }, TF.el('span', { class: 'brand-mark' }, TF.icon('layers')), 'TestFlow'),
      TF.el('span', { class: 'spacer' }),
      TF.el('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'data-theme-icon': '', 'aria-label': 'Mavzu', onclick: TF.theme.toggle }, TF.icon(TF.theme.get() === 'dark' ? 'sun' : 'moon'))
    );
    const scrim = TF.el('div', { class: 'scrim', onclick: () => app.classList.remove('sidebar-open') });
    page.replaceWith(app);
    app.append(sidebar, scrim, TF.el('div', { class: 'main' }, topbar, page));
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a')) app.classList.remove('sidebar-open');
    });
    return app;
  };

  TF.authAside = function (target) {
    const d = TF.dev;
    TF.mount(
      target,
      TF.el('a', { class: 'brand', href: TF.home(), style: 'color:#fff' }, TF.el('span', { class: 'brand-mark' }, TF.icon('layers')), TF.el('span', null, 'TestFlow', TF.el('small', { text: 'Pro' }))),
      TF.el(
        'div',
        null,
        TF.el('h2', { text: 'Bilimingizni mustaqil, o‘z sur’atingizda mustahkamlang' }),
        TF.el('p', { class: 'lead', text: 'Test faylingizni yuklang, savollarni aralashtirib yeching, xatolaringiz ustida ishlang va natijalaringizni kuzatib boring. Vaqt chegarasi yo‘q.' }),
        TF.el(
          'ul',
          { class: 'auth-points' },
          [
            ['upload-cloud', 'Excel, CSV va Word fayllaridan import'],
            ['shuffle', 'Savollar va variantlar tasodifiy tartibda'],
            ['target', 'Xatolar ustida ishlash va belgilangan savollar'],
            ['bar-chart-3', 'Real ma’lumotlarga asoslangan statistika']
          ].map(([i, t]) => TF.el('li', null, TF.el('span', { class: 'pt' }, TF.icon(i)), t))
        )
      ),
      TF.el('div', { class: 'auth-credit' }, TF.icon('code-2'), 'Dasturchi: ', TF.el('a', { href: 'https://t.me/' + d.telegram, target: '_blank', rel: 'noopener' }, d.name), TF.el('span', { text: '·' }), TF.el('a', { href: 'https://instagram.com/' + d.instagram, target: '_blank', rel: 'noopener' }, '@' + d.instagram))
    );
  };

  TF.startAttempt = async function (testId, body) {
    const r = await Api.post(`/tests/${testId}/attempts`, body);
    location.href = TF.page('test.html') + '?attempt=' + r.attempt_id;
  };

  TF.init = async function (opts = {}) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || a.getAttribute('href').startsWith('#')) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(() => (location.href = a.href), 150);
    });
    try {
      await Api.boot();
    } catch (err) {
      const page = document.getElementById('page') || document.body;
      TF.mount(
        page,
        TF.el('div', { class: 'fatal' }, TF.empty('wifi-off', 'Serverga ulanib bo‘lmadi', err.message || 'Internet aloqasi yoki serverni tekshiring.', [TF.el('button', { class: 'btn btn-primary', onclick: () => location.reload() }, TF.icon('refresh-cw'), 'Qayta urinish')]))
      );
      throw err;
    }
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    if (opts.auth === 'required' && !Api.user) {
      location.replace(TF.page('login.html') + '?next=' + next);
      throw new Error('redirect');
    }
    if (opts.auth === 'guest' && Api.user) {
      location.replace(TF.page('dashboard.html'));
      throw new Error('redirect');
    }
    Api.onUnauthorized = () => {
      if (Api.user) {
        Api.user = null;
        location.replace(TF.page('login.html') + '?expired=1&next=' + next);
      }
    };
    if (opts.shell !== false && Api.user) TF.mountShell(opts.nav, Api.user);
    return Api.user;
  };
})();
