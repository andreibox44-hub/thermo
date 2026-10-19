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
      '<div class="auth"><section class="panel">' + body + '</section></div>';

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

  /* ---------- Личный кабинет ---------- */

  function renderAccount() {
    root.innerHTML = crumbs +
      '<div class="page__head">' +
        '<div class="account__head">' +
          '<h1 class="page__title">' + t('account.title') + '</h1>' +
          '<p class="muted" id="account-hello">' + A.esc(user.email) + '</p>' +
        '</div>' +
        '<button class="btn btn--ghost" type="button" id="sign-out">' + A.icon('logout') + '<span>' + t('account.signOut') + '</span></button>' +
      '</div>' +
      '<div class="account">' +
        '<section class="panel" id="profile-panel"><h2>' + t('account.profile.title') + '</h2><p class="muted">' + t('account.loading') + '</p></section>' +
        '<section class="panel"><h2>' + t('account.orders.title') + '</h2><div id="orders"><p class="muted">' + t('account.loading') + '</p></div></section>' +
        '<section class="panel account__danger">' +
          '<div><h2>' + t('account.remove.title') + '</h2><p class="muted">' + t('account.remove.text') + '</p></div>' +
          '<button class="btn btn--danger" type="button" id="delete-account">' + A.icon('trash') + '<span>' + t('account.remove.button') + '</span></button>' +
        '</section>' +
      '</div>';

    document.getElementById('sign-out').addEventListener('click', function () {
      user = null;
      auth.signOut().catch(function () {}).then(function () { renderGuest('signIn'); });
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

    var id = user.id;
    auth.profile(id).then(function (p) {
      if (!user || user.id !== id) return;
      renderProfile(p);
    }, function (err) {
      document.querySelector('#profile-panel .muted').textContent = auth.errorText(err);
    });
    auth.orders().then(function (list) {
      if (!user || user.id !== id) return;
      renderOrders(list);
    }, function (err) {
      document.getElementById('orders').innerHTML = '<p class="muted">' + A.esc(auth.errorText(err)) + '</p>';
    });
  }

  function renderProfile(p) {
    if (p.name) document.getElementById('account-hello').innerHTML = A.esc(t('account.hello', { name: p.name })) + ' · ' + A.esc(user.email);
    var panel = document.getElementById('profile-panel');
    panel.innerHTML = '<h2>' + t('account.profile.title') + '</h2>' +
      '<p class="muted">' + t('account.profile.text') + '</p>' +
      '<form class="form form--grid" id="profile-form" novalidate>' +
        field('profile', 'name', { autocomplete: 'name', value: p.name }) +
        field('profile', 'phone', { type: 'tel', placeholder: 'account.form.phonePlaceholder', autocomplete: 'tel', value: p.phone }) +
        field('profile', 'email', { type: 'email', readonly: true, value: user.email, hint: 'account.form.emailFixed' }) +
        field('profile', 'city', { autocomplete: 'address-level2', value: p.city }) +
        field('profile', 'address', { wide: true, placeholder: 'account.form.addressPlaceholder', autocomplete: 'street-address', value: p.address }) +
        '<p class="form__error field--wide" role="alert"></p>' +
        '<div class="field--wide"><button class="btn btn--primary" type="submit">' + t('account.profile.save') + '</button></div>' +
      '</form>';

    var form = document.getElementById('profile-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = values(form);
      var errors = {};
      if (!v.name) errors.name = t('account.errors.name');
      if (v.phone && v.phone.replace(/\D/g, '').length < 10) errors.phone = t('account.errors.phone');
      if (!showErrors(form, errors)) return;
      var data = { name: v.name, phone: v.phone, city: v.city, address: v.address };
      run(form, auth.saveProfile(user.id, data), function () {
        busy(form, false);
        document.getElementById('account-hello').innerHTML = A.esc(t('account.hello', { name: data.name })) + ' · ' + A.esc(user.email);
        A.toast(t('account.profile.saved'));
      });
    });
  }

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
