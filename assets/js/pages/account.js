(function () {
  'use strict';
  var A = window.App;
  var t = A.t;
  var auth = A.auth;
  var root = document.getElementById('account-root');
  var crumbs = A.breadcrumbs([{ label: t('nav.home'), href: 'index.html' }, { label: t('account.title') }]);
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var MIN_PASSWORD = 8;
  var dateFormat = new Intl.DateTimeFormat(A.dict.meta.locale, { day: 'numeric', month: 'long', year: 'numeric' });
  var user = null;

  /* ---------- Помощники форм ---------- */

  function field(form, name, opts) {
    opts = opts || {};
    var id = 'a-' + form + '-' + name;
    var hint = opts.hint ? '<span class="field__hint">' + t(opts.hint) + '</span>' : '';
    return '<div class="field' + (opts.wide ? ' field--wide' : '') + '">' +
      '<label class="field__label" for="' + id + '">' + t('account.form.' + (opts.label || name)) + '</label>' +
      '<input class="input" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' +
        (opts.placeholder ? ' placeholder="' + A.esc(t(opts.placeholder)) + '"' : '') +
        (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') +
        (opts.value ? ' value="' + A.esc(opts.value) + '"' : '') +
        (opts.readonly ? ' readonly' : '') + '>' +
      hint + '<span class="field__error" data-error-for="' + name + '"></span></div>';
  }

  /** Показывает ошибки полей; возвращает true, если ошибок нет. */
  function showErrors(form, errors) {
    form.querySelectorAll('[data-error-for]').forEach(function (el) {
      var name = el.getAttribute('data-error-for');
      el.textContent = errors[name] || '';
      form.elements[name].classList.toggle('is-invalid', !!errors[name]);
      form.elements[name].setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
    });
    setFormError(form, '');
    var first = Object.keys(errors)[0];
    if (first) form.elements[first].focus();
    return !first;
  }

  function setFormError(form, text) {
    var el = form.querySelector('.form__error');
    if (el) el.textContent = text;
  }

  function busy(form, on) {
    form.querySelectorAll('button[type="submit"]').forEach(function (b) { b.disabled = on; });
  }

  /** Отправка формы: блокирует кнопку, ошибку сервера показывает под формой. */
  function run(form, promise, done) {
    busy(form, true);
    promise.then(done, function (err) {
      busy(form, false);
      setFormError(form, auth.errorText(err));
    });
  }

  function values(form) {
    var v = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name && el.type !== 'radio') v[el.name] = el.value.trim();
    });
    return v;
  }

  function notice(icon, title, text, button) {
    root.innerHTML = crumbs +
      '<div class="empty empty--page">' +
        '<div class="empty__icon">' + A.icon(icon) + '</div>' +
        '<h1>' + title + '</h1>' +
        '<p>' + text + '</p>' + (button || '') +
      '</div>';
  }

  /* ---------- Кабинет не подключён ---------- */

  function renderNotReady() {
    notice('user', t('account.notReady.title'), t('account.notReady.text'),
      '<a class="btn btn--primary" href="catalog.html">' + t('account.notReady.button') + '</a>');
  }

  /* ---------- Вход, регистрация, восстановление пароля ---------- */

  function renderGuest(mode) {
    var body;
    if (mode === 'reset') {
      body = '<h2>' + t('account.reset.title') + '</h2>' +
        '<p class="muted">' + t('account.reset.text') + '</p>' +
        '<form class="form" id="auth-form" novalidate>' +
          field('reset', 'email', { type: 'email', placeholder: 'account.form.emailPlaceholder', autocomplete: 'email' }) +
          '<p class="form__error" role="alert"></p>' +
          '<button class="btn btn--primary btn--block" type="submit">' + t('account.reset.submit') + '</button>' +
          '<button class="link-btn link-btn--accent" type="button" data-mode="signIn">' + t('account.reset.back') + '</button>' +
        '</form>';
    } else {
      var signUp = mode === 'signUp';
      body = '<div class="segmented" role="group">' +
          ['signIn', 'signUp'].map(function (m) {
            return '<label><input type="radio" name="mode" value="' + m + '"' + (m === mode ? ' checked' : '') + '><span>' + t('account.tabs.' + m) + '</span></label>';
          }).join('') +
        '</div>' +
        '<p class="muted auth__intro">' + t('account.intro') + '</p>' +
        '<form class="form" id="auth-form" novalidate>' +
          (signUp ? field('signUp', 'name', { autocomplete: 'name' }) : '') +
          field(mode, 'email', { type: 'email', placeholder: 'account.form.emailPlaceholder', autocomplete: 'email' }) +
          field(mode, 'password', {
            type: 'password',
            autocomplete: signUp ? 'new-password' : 'current-password',
            hint: signUp ? 'account.form.passwordHint' : ''
          }) +
          '<p class="form__error" role="alert"></p>' +
          '<button class="btn btn--primary btn--block" type="submit">' + t('account.' + mode) + '</button>' +
          (signUp
            ? '<p class="form__note">' + t('account.agree', { privacy: '<a href="' + A.legalPages.privacy + '">' + t('account.agreePrivacy') + '</a>' }) + '</p>'
            : '<button class="link-btn link-btn--accent" type="button" data-mode="reset">' + t('account.forgot') + '</button>') +
        '</form>';
    }

    root.innerHTML = crumbs +
      '<div class="page__head"><h1 class="page__title">' + t('account.title') + '</h1></div>' +
      '<div class="auth"><section class="panel">' + body + '</section></div>' +
      '<div class="account__guestfavs" id="guest-favorites" hidden></div>';
    renderGuestFavorites();

    var form = document.getElementById('auth-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitGuest(mode, form);
    });
  }

  root.addEventListener('change', function (e) {
    if (e.target.name === 'mode') renderGuest(e.target.value);
  });
  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode]');
    if (btn) renderGuest(btn.getAttribute('data-mode'));
  });

  function submitGuest(mode, form) {
    var v = values(form);
    var errors = {};
    if (mode === 'signUp' && !v.name) errors.name = t('account.errors.name');
    if (!EMAIL_RE.test(v.email)) errors.email = t('account.errors.email');
    if (mode === 'signUp' && form.elements.password.value.length < MIN_PASSWORD) errors.password = t('account.errors.password');
    if (mode === 'signIn' && !form.elements.password.value) errors.password = t('account.errors.passwordEmpty');
    if (!showErrors(form, errors)) return;

    var password = form.elements.password ? form.elements.password.value : '';
    if (mode === 'signIn') {
      run(form, auth.signIn(v.email, password), function (data) {
        user = data.user;
        renderAccount();
      });
    } else if (mode === 'signUp') {
      run(form, auth.signUp(v.email, password, v.name), function (data) {
        if (data.session) {
          user = data.user;
          renderAccount();
        } else {
          // Включено подтверждение почты: войти можно после перехода по ссылке
          notice('mail', t('account.checkEmail.title'), t('account.checkEmail.text', { email: '<b>' + A.esc(v.email) + '</b>' }),
            '<button class="btn btn--primary" type="button" data-mode="signIn">' + t('account.checkEmail.button') + '</button>');
        }
      });
    } else {
      run(form, auth.resetPassword(v.email), function () {
        notice('mail', t('account.reset.title'), t('account.reset.sent'),
          '<button class="btn btn--primary" type="button" data-mode="signIn">' + t('account.reset.back') + '</button>');
      });
    }
  }

  /* ---------- Новый пароль (по ссылке из письма) ---------- */

  function renderNewPassword() {
    root.innerHTML = crumbs +
      '<div class="page__head"><h1 class="page__title">' + t('account.title') + '</h1></div>' +
      '<div class="auth"><section class="panel">' +
        '<h2>' + t('account.newPassword.title') + '</h2>' +
        '<form class="form" id="password-form" novalidate>' +
          field('new', 'password', { label: 'newPassword', type: 'password', autocomplete: 'new-password', hint: 'account.form.passwordHint' }) +
          '<p class="form__error" role="alert"></p>' +
          '<button class="btn btn--primary btn--block" type="submit">' + t('account.newPassword.submit') + '</button>' +
        '</form>' +
      '</section></div>';

    var form = document.getElementById('password-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var password = form.elements.password.value;
      if (!showErrors(form, password.length < MIN_PASSWORD ? { password: t('account.errors.password') } : {})) return;
      run(form, auth.updatePassword(password), function () {
        A.toast(t('account.newPassword.done'));
        renderAccount();
      });
    });
  }

  /* ---------- Личный кабинет: разделы ---------- */

  var SECTIONS = [
    { key: 'profile', icon: 'user' },
    { key: 'address', icon: 'pin' },
    { key: 'favorites', icon: 'heart' },
    { key: 'orders', icon: 'cart' }
  ];
  var state = null; // { profile, orders } — загружаются один раз при входе

  function sectionFromHash() {
    var key = window.location.hash.slice(1);
    return SECTIONS.some(function (s) { return s.key === key; }) ? key : 'profile';
  }

  function renderAccount() {
    state = { profile: null, orders: null, profileError: '', ordersError: '' };
    root.innerHTML = crumbs +
      '<div class="page__head">' +
        '<div class="account__head">' +
          '<h1 class="page__title">' + t('account.title') + '</h1>' +
          '<p class="muted" id="account-hello">' + A.esc(user.email) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="account">' +
        '<nav class="account__nav" aria-label="' + A.esc(t('account.title')) + '">' +
          SECTIONS.map(function (s) {
            return '<a class="account__tab" href="#' + s.key + '" data-section="' + s.key + '">' + A.icon(s.icon) +
              '<span>' + t('account.sections.' + s.key) + '</span><span class="account__count" id="count-' + s.key + '"></span></a>';
          }).join('') +
          '<button class="account__tab account__tab--out" type="button" id="sign-out">' + A.icon('logout') + '<span>' + t('account.signOut') + '</span></button>' +
        '</nav>' +
        '<div class="account__body" id="account-body"></div>' +
      '</div>';

    document.getElementById('sign-out').addEventListener('click', function () {
      user = null;
      auth.signOut().catch(function () {}).then(function () { renderGuest('signIn'); });
    });

    showSection(sectionFromHash());
    updateCounts();

    var id = user.id;
    auth.profile(id).then(function (p) {
      if (!user || user.id !== id) return;
      state.profile = p;
      auth.syncFavorites(id, p.favorites);
      if (p.name) setHello(p.name);
      showSection(current);
    }, function (err) {
      state.profileError = auth.errorText(err);
      showSection(current);
    });
    auth.orders().then(function (list) {
      if (!user || user.id !== id) return;
      state.orders = list;
      updateCounts();
      if (current === 'orders') showSection('orders');
    }, function (err) {
      state.ordersError = auth.errorText(err);
      if (current === 'orders') showSection('orders');
    });
  }

  function setHello(name) {
    document.getElementById('account-hello').innerHTML = A.esc(t('account.hello', { name: name })) + ' · ' + A.esc(user.email);
  }

  function updateCounts() {
    var counts = { favorites: A.favorites.read().length, orders: state && state.orders ? state.orders.length : 0 };
    Object.keys(counts).forEach(function (k) {
      var el = document.getElementById('count-' + k);
      if (el) el.textContent = counts[k] || '';
    });
  }

  var current = 'profile';
  function showSection(key) {
    var body = document.getElementById('account-body');
    if (!body) return;
    current = key;
    document.querySelectorAll('.account__tab[data-section]').forEach(function (a) {
      var on = a.getAttribute('data-section') === key;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      // На телефоне меню — полоска с прокруткой: показываем выбранную вкладку
      if (on && a.parentNode.scrollWidth > a.parentNode.clientWidth) a.parentNode.scrollLeft = a.offsetLeft - 8;
    });
    if (key === 'favorites') { body.innerHTML = favoritesPanel(); return; }
    if (key === 'orders') {
      body.innerHTML = '<section class="panel"><h2>' + t('account.orders.title') + '</h2><div id="orders"></div></section>';
      var el = document.getElementById('orders');
      if (state.ordersError) el.innerHTML = '<p class="muted">' + A.esc(state.ordersError) + '</p>';
      else if (!state.orders) el.innerHTML = '<p class="muted">' + t('account.loading') + '</p>';
      else renderOrders(state.orders);
      return;
    }
    // Мои данные и адрес — нужен профиль
    if (!state.profile) {
      body.innerHTML = '<section class="panel"><h2>' + t('account.sections.' + key) + '</h2><p class="muted">' +
        A.esc(state.profileError || t('account.loading')) + '</p></section>';
      return;
    }
    if (key === 'address') renderAddress(state.profile); else renderProfile(state.profile);
  }

  window.addEventListener('hashchange', function () {
    if (user && document.getElementById('account-body')) showSection(sectionFromHash());
  });
  document.addEventListener('favorites:change', function () {
    if (!user) { if (document.getElementById('guest-favorites')) renderGuestFavorites(); return; }
    updateCounts();
    if (current === 'favorites') showSection('favorites');
  });

  /* ---------- Мои данные ---------- */

  function renderProfile(p) {
    document.getElementById('account-body').innerHTML =
      '<section class="panel">' +
        '<h2>' + t('account.profile.title') + '</h2>' +
        '<p class="muted">' + t('account.profile.text') + '</p>' +
        '<form class="form form--grid" id="profile-form" novalidate>' +
          field('profile', 'name', { autocomplete: 'name', value: p.name }) +
          field('profile', 'phone', { type: 'tel', placeholder: 'account.form.phonePlaceholder', autocomplete: 'tel', value: p.phone }) +
          field('profile', 'email', { wide: true, type: 'email', readonly: true, value: user.email, hint: 'account.form.emailFixed' }) +
          '<p class="form__error field--wide" role="alert"></p>' +
          '<div class="field--wide"><button class="btn btn--primary" type="submit">' + t('account.profile.save') + '</button></div>' +
        '</form>' +
      '</section>' +
      '<section class="panel account__danger">' +
        '<div><h2>' + t('account.remove.title') + '</h2><p class="muted">' + t('account.remove.text') + '</p></div>' +
        '<button class="btn btn--danger" type="button" id="delete-account">' + A.icon('trash') + '<span>' + t('account.remove.button') + '</span></button>' +
      '</section>';

    var form = document.getElementById('profile-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = values(form);
      var errors = {};
      if (!v.name) errors.name = t('account.errors.name');
      if (v.phone && v.phone.replace(/\D/g, '').length < 10) errors.phone = t('account.errors.phone');
      if (!showErrors(form, errors)) return;
      var data = { name: v.name, phone: v.phone };
      run(form, auth.saveProfile(user.id, data), function () {
        busy(form, false);
        state.profile.name = data.name;
        state.profile.phone = data.phone;
        setHello(data.name);
        A.toast(t('account.profile.saved'));
      });
    });

    document.getElementById('delete-account').addEventListener('click', function (e) {
      if (!window.confirm(t('account.remove.confirm'))) return;
      var btn = e.currentTarget;
      btn.disabled = true;
      auth.deleteAccount().then(function () {
        window.location.replace('account.html?deleted=1');
      }, function (err) {
        btn.disabled = false;
        window.alert(auth.errorText(err));
      });
    });
  }

  /* ---------- Адрес доставки ---------- */

  function renderAddress(p) {
    document.getElementById('account-body').innerHTML =
      '<section class="panel">' +
        '<h2>' + t('account.address.title') + '</h2>' +
        '<p class="muted">' + t('account.address.text', { countries: A.esc(A.countries.names()) }) + '</p>' +
        '<form class="form form--grid address-form" id="address-form" novalidate>' +
          A.address.fields('addr', { title: false }) +
          '<p class="form__error field--wide" role="alert"></p>' +
          '<div class="field--wide"><button class="btn btn--primary" type="submit">' + t('account.address.save') + '</button></div>' +
        '</form>' +
      '</section>';

    var form = document.getElementById('address-form');
    A.address.bind(form).fill(p);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!showErrors(form, A.address.validate(form))) return;
      var data = A.address.read(form);
      run(form, auth.saveProfile(user.id, data), function () {
        busy(form, false);
        Object.keys(data).forEach(function (k) { state.profile[k] = data[k]; });
        A.toast(t('account.address.saved'));
      });
    });
  }

  /* ---------- Избранное ---------- */

  function favoritesGrid(list) {
    return '<div class="grid account__favs">' + list.map(function (id) { return A.productCard(A.getProduct(id)); }).join('') + '</div>';
  }

  function favoritesPanel() {
    var list = A.favorites.read();
    return '<section class="panel">' +
      '<h2>' + t('account.favorites.title') + '</h2>' +
      (list.length
        ? '<p class="muted">' + t('account.favorites.text') + '</p>' + favoritesGrid(list)
        : '<div class="empty orders__empty"><div class="empty__icon">' + A.icon('heart') + '</div>' +
            '<p>' + t('account.favorites.empty') + '</p>' +
            '<a class="btn btn--ghost" href="catalog.html">' + t('account.favorites.emptyButton') + '</a></div>') +
    '</section>';
  }

  // Без входа: избранное этого браузера под формой входа
  function renderGuestFavorites() {
    var el = document.getElementById('guest-favorites');
    if (!el) return;
    var list = A.favorites.read();
    el.hidden = !list.length;
    el.innerHTML = list.length
      ? '<section class="panel"><h2>' + t('account.favorites.guestTitle') + '</h2>' +
          '<p class="muted">' + t('account.favorites.guestText') + '</p>' + favoritesGrid(list) + '</section>'
      : '';
  }

  /* ---------- Мои заказы ---------- */

  function orderTotal(items) {
    var unpriced = items.some(function (i) { return !(i.price > 0); });
    if (unpriced) return t('common.priceOnRequest');
    return A.formatPrice(items.reduce(function (s, i) { return s + i.price * i.qty; }, 0));
  }

  function renderOrders(list) {
    var el = document.getElementById('orders');
    if (!list.length) {
      el.innerHTML = '<div class="empty orders__empty">' +
        '<div class="empty__icon">' + A.icon('cart') + '</div>' +
        '<p>' + t('account.orders.empty') + '</p>' +
        '<a class="btn btn--ghost" href="catalog.html">' + t('account.orders.emptyButton') + '</a></div>';
      return;
    }
    el.innerHTML = '<ul class="orders">' + list.map(function (o) {
      var items = Array.isArray(o.items) ? o.items : [];
      var status = A.lookup('account.orders.status.' + o.status) || o.status;
      return '<li class="order">' +
        '<div class="order__head">' +
          '<b>' + t('account.orders.number', { number: o.id }) + '</b>' +
          '<span class="muted">' + dateFormat.format(new Date(o.created_at)) + '</span>' +
          '<span class="order__status order__status--' + A.esc(o.status) + '">' + A.esc(status) + '</span>' +
        '</div>' +
        '<ul class="order__items">' + items.map(function (i) {
          var p = A.getProduct(i.id);
          var name = p ? '<a href="' + A.productUrl(p) + '">' + A.esc(A.productText(p, 'name')) + '</a>' : A.esc(i.id);
          return '<li>' + name + ' <span class="muted">× ' + A.formatNumber(i.qty) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="order__total"><span>' + t('cart.total') + '</span><b>' + orderTotal(items) + '</b></div>' +
      '</li>';
    }).join('') + '</ul>';
  }

  /* ---------- Запуск ---------- */

  if (!auth || !auth.enabled) { renderNotReady(); return; }

  if (A.params.get('deleted')) {
    A.toast(t('account.remove.done'));
    window.history.replaceState(null, '', 'account.html');
  }

  auth.onChange(function (event, u) {
    if (event === 'PASSWORD_RECOVERY') {
      user = u;
      renderNewPassword();
    } else if (event === 'SIGNED_OUT' && user) {
      // Вышли в другой вкладке
      user = null;
      renderGuest('signIn');
    }
  });

  auth.currentUser().then(function (u) {
    user = u;
    if (auth.recovery && u) renderNewPassword();
    else if (u) renderAccount();
    else renderGuest('signIn');
  }, function () {
    renderGuest('signIn');
  });
})();
