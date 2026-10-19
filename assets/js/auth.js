/*
 * Личный кабинет: вход, регистрация, профиль и заказы через Supabase.
 * Подключается после app.js на страницах, где нужен аккаунт (кабинет, корзина),
 * вместе с config.js и vendor/supabase.js. Добавляет App.auth.
 */
(function () {
  'use strict';
  var A = window.App;
  var cfg = window.CONFIG || {};
  var enabled = !!(cfg.supabaseUrl && cfg.supabaseKey && window.supabase);

  // Ссылка из письма «сменить пароль» — запоминаем до того, как библиотека очистит адрес
  var recovery = /type=recovery/.test(window.location.hash);

  var client = enabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { storageKey: 'thermo.auth' } })
    : null;

  function unwrap(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  // Адрес для ссылок из писем; со страницы, открытой как файл, он не годится
  function returnUrl() {
    return /^https?:$/.test(window.location.protocol) ? window.location.href.split('#')[0].split('?')[0] : undefined;
  }

  /** Понятный текст ошибки по коду Supabase. */
  function errorText(err) {
    var code = err && err.code;
    if (code && A.lookup('account.errors.' + code)) return A.t('account.errors.' + code);
    if (err && (err.name === 'AuthRetryableFetchError' || err instanceof TypeError)) return A.t('account.errors.network');
    return A.t('account.errors.generic');
  }

  A.auth = {
    enabled: enabled,
    recovery: recovery,
    errorText: errorText,

    currentUser: function () {
      return client.auth.getSession().then(function (res) {
        var data = unwrap(res);
        return data.session ? data.session.user : null;
      });
    },
    /** cb(event, user): SIGNED_IN, SIGNED_OUT, PASSWORD_RECOVERY и др. */
    onChange: function (cb) {
      client.auth.onAuthStateChange(function (event, session) {
        cb(event, session ? session.user : null);
      });
    },

    signUp: function (email, password, name) {
      return client.auth.signUp({
        email: email,
        password: password,
        options: { data: { name: name }, emailRedirectTo: returnUrl() }
      }).then(unwrap).then(function (data) {
        // Почта уже занята: при включённом подтверждении Supabase не говорит об этом прямо
        if (data.user && data.user.identities && !data.user.identities.length) {
          var err = new Error('exists');
          err.code = 'user_already_exists';
          throw err;
        }
        return data;
      });
    },
    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: email, password: password }).then(unwrap);
    },
    signOut: function () {
      return client.auth.signOut({ scope: 'local' }).then(function (res) { if (res.error) throw res.error; });
    },
    resetPassword: function (email) {
      return client.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }).then(unwrap);
    },
    updatePassword: function (password) {
      return client.auth.updateUser({ password: password }).then(unwrap);
    },

    profile: function (userId) {
      return client.from('profiles').select('name, phone, city, address').eq('id', userId).maybeSingle()
        .then(unwrap).then(function (p) { return p || {}; });
    },
    saveProfile: function (userId, data) {
      var row = { updated_at: new Date().toISOString() };
      for (var k in data) row[k] = data[k];
      return client.from('profiles').update(row).eq('id', userId).then(unwrap);
    },

    orders: function () {
      return client.from('orders').select('id, items, status, created_at')
        .order('created_at', { ascending: false }).then(unwrap);
    },
    /** Сохраняет заказ; возвращает его номер. */
    createOrder: function (order) {
      return client.from('orders').insert(order).select('id').single().then(unwrap)
        .then(function (row) { return row.id; });
    },

    deleteAccount: function () {
      return client.rpc('delete_account').then(unwrap).then(function () {
        return client.auth.signOut({ scope: 'local' });
      });
    }
  };
})();
