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

  var STORAGE_KEY = 'thermo.auth';
  // Чьё избранное сейчас в браузере (id пользователя) — чтобы объединить его с аккаунтом один раз
  var FAV_OWNER_KEY = 'thermo.favorites.owner';
  var client = enabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { storageKey: STORAGE_KEY } })
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

  // Вход через сторонние сервисы (сейчас только Google); кнопка видна, только если сервис включён в Supabase
  var OAUTH_ORDER = ['google'];
  var providersPromise = null;

  A.auth = {
    enabled: enabled,
    OAUTH_ORDER: OAUTH_ORDER,

    /**
     * Какие сервисы входа включены в Supabase (Authentication → Sign In / Providers).
     * Включили там Google — кнопка появляется сама. Ошибка сети — просто без кнопок.
     */
    providers: function () {
      if (!providersPromise) {
        providersPromise = window.fetch(cfg.supabaseUrl + '/auth/v1/settings', { headers: { apikey: cfg.supabaseKey } })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .then(function (d) { return OAUTH_ORDER.filter(function (p) { return d.external && d.external[p]; }); })
          .catch(function () { return []; });
      }
      return providersPromise;
    },
    /** Переход на страницу входа сервиса; после входа сервис вернёт на эту же страницу. */
    signInWithProvider: function (provider) {
      // Сервис возвращает покупателя по адресу сайта — у файла, открытого с диска, адреса нет
      if (!returnUrl()) {
        var err = new Error('needs hosting');
        err.code = 'oauth_needs_hosting';
        return Promise.reject(err);
      }
      return client.auth.signInWithOAuth({
        provider: provider,
        options: { redirectTo: returnUrl() }
      }).then(unwrap);
    },
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
      return client.auth.signOut({ scope: 'local' }).then(function (res) {
        if (res.error) throw res.error;
        // Избранное принадлежит аккаунту — в браузере его не оставляем
        forgetFavorites();
      });
    },
    resetPassword: function (email) {
      return client.auth.resetPasswordForEmail(email, { redirectTo: returnUrl() }).then(unwrap);
    },
    updatePassword: function (password) {
      return client.auth.updateUser({ password: password }).then(unwrap);
    },

    profile: function (userId) {
      return client.from('profiles').select('name, phone, favorites, ' + A.address.FIELDS.join(', ')).eq('id', userId).maybeSingle()
        .then(unwrap).then(function (p) { return p || {}; });
    },
    saveProfile: function (userId, data) {
      var row = { updated_at: new Date().toISOString() };
      for (var k in data) row[k] = data[k];
      return client.from('profiles').update(row).eq('id', userId).then(unwrap);
    },

    /**
     * Избранное аккаунта и браузера. При первом входе на этом устройстве списки объединяются,
     * дальше главный — список в браузере (его меняют сердечки на любой странице).
     * Возвращает итоговый список.
     */
    syncFavorites: function (userId, serverList) {
      var local = A.favorites.read();
      var server = (serverList || []).filter(function (id) { return A.getProduct(id); });
      var owner = null;
      try { owner = window.localStorage.getItem(FAV_OWNER_KEY); } catch (e) { /* нет доступа */ }
      var list = owner === userId ? local : local.concat(server.filter(function (id) { return local.indexOf(id) === -1; }));
      try { window.localStorage.setItem(FAV_OWNER_KEY, userId); } catch (e) { /* нет доступа */ }
      if (list.join() !== local.join()) A.favorites.write(list);
      if (list.join() !== server.join()) A.auth.saveFavorites(userId, list).catch(function () {});
      return list;
    },
    saveFavorites: function (userId, list) {
      return client.from('profiles').update({ favorites: list.slice(0, 100) }).eq('id', userId).then(unwrap);
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

    /** Удаляет аккаунт на сервере и сессию в браузере; после этого страницу нужно перезагрузить. */
    deleteAccount: function () {
      return client.rpc('delete_account').then(unwrap).then(function () {
        // Пользователя уже нет: сервер ответит на выход ошибкой 403, библиотека её пропускает
        // и всё равно забывает сессию — иначе она осталась бы в памяти страницы
        return client.auth.signOut({ scope: 'local' }).catch(function () {});
      }).then(function () {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* нет доступа к хранилищу */ }
        forgetFavorites();
      });
    }
  };

  function forgetFavorites() {
    try { window.localStorage.removeItem(FAV_OWNER_KEY); } catch (e) { /* нет доступа */ }
    A.favorites.write([]);
  }

  // Покупатель вошёл: изменения избранного на этой странице сразу сохраняем в аккаунте
  if (enabled) {
    document.addEventListener('favorites:change', function () {
      var owner = null;
      try { owner = window.localStorage.getItem(FAV_OWNER_KEY); } catch (e) { return; }
      if (!owner) return;
      A.auth.currentUser().then(function (u) {
        if (u && u.id === owner) return A.auth.saveFavorites(u.id, A.favorites.read());
      }).catch(function () {});
    });
  }
})();
