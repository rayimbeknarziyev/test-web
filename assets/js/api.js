(function () {
  'use strict';

  class ApiError extends Error {
    constructor(status, message, errors) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors || {};
    }
  }

  const Api = (window.Api = { csrf: null, user: null, onUnauthorized: null, ApiError });

  Api.request = async function (method, path, body, retried = false) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && Api.csrf) headers['X-CSRF-Token'] = Api.csrf;
    let res;
    try {
      res = await fetch(TF.apiBase + path, { method, headers, credentials: 'include', body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new ApiError(0, 'Server bilan aloqa yo‘q. Internet yoki server holatini tekshiring.');
    }
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    if (!res.ok || !json || json.success === false) {
      const err = new ApiError(res.status, (json && json.message) || 'Kutilmagan xatolik yuz berdi.', json && json.errors);
      if (res.status === 403 && /token/i.test(err.message) && !retried) {
        await Api.boot();
        return Api.request(method, path, body, true);
      }
      if (res.status === 401 && Api.onUnauthorized) Api.onUnauthorized(err);
      throw err;
    }
    return json.data;
  };

  Api.get = (p) => Api.request('GET', p);
  Api.post = (p, b) => Api.request('POST', p, b === undefined ? {} : b);
  Api.patch = (p, b) => Api.request('PATCH', p, b);
  Api.del = (p) => Api.request('DELETE', p);

  Api.boot = async function () {
    const data = await Api.request('GET', '/auth/csrf');
    Api.csrf = data.csrf_token;
    Api.user = data.user;
    return data;
  };

  window.Auth = {
    async logout() {
      try {
        await Api.post('/auth/logout');
      } catch (e) {}
      Api.user = null;
      location.href = TF.page('login.html');
    }
  };
})();
