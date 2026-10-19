(function () {
  'use strict';
  var A = window.App;
  var t = A.t;
  var root = document.getElementById('cart-root');
  var ordered = false;
  var crumbs = A.breadcrumbs([{ label: t('nav.home'), href: 'index.html' }, { label: t('nav.cart') }]);

  function renderEmpty() {
    root.innerHTML = crumbs +
      '<div class="empty empty--page">' +
        '<div class="empty__icon">' + A.icon('cart') + '</div>' +
        '<h1>' + t('cart.emptyTitle') + '</h1>' +
        '<p>' + t('cart.emptyText') + '</p>' +
        '<a class="btn btn--primary" href="catalog.html">' + t('cart.emptyButton') + '</a>' +
      '</div>';
  }

  function field(name, opts) {
    opts = opts || {};
    var id = 'f-' + name;
    var control = opts.textarea
      ? '<textarea class="input" id="' + id + '" name="' + name + '" rows="3"></textarea>'
      : '<input class="input" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' +
        (opts.placeholder ? ' placeholder="' + A.esc(t(opts.placeholder)) + '"' : '') +
        (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') +
        (opts.required ? ' required' : '') + '>';
    return '<div class="field' + (opts.wide ? ' field--wide' : '') + '">' +
      '<label class="field__label" for="' + id + '">' + t('cart.form.' + name) + (opts.required ? ' <span class="req" title="' + A.esc(t('common.required')) + '">*</span>' : '') + '</label>' +
      control + '<span class="field__error" data-error-for="' + name + '"></span></div>';
  }

  function renderLayout() {
    root.innerHTML = crumbs +
      '<div class="page__head">' +
        '<h1 class="page__title">' + t('cart.title') + '</h1>' +
        '<button class="link-btn" type="button" id="cart-clear">' + A.icon('trash') + t('cart.clear') + '</button>' +
      '</div>' +
      '<div class="cart">' +
        '<div class="cart__main">' +
          '<ul class="cart__items" id="cart-items"></ul>' +
          '<section class="panel">' +
            '<h2>' + t('cart.checkout') + '</h2>' +
            '<form class="form form--grid" id="checkout" novalidate>' +
              field('name', { required: true, autocomplete: 'name' }) +
              field('phone', { required: true, type: 'tel', placeholder: 'cart.form.phonePlaceholder', autocomplete: 'tel' }) +
              field('email', { type: 'email', placeholder: 'cart.form.emailPlaceholder', autocomplete: 'email' }) +
              field('city', { required: true, autocomplete: 'address-level2' }) +
              field('address', { required: true, wide: true, placeholder: 'cart.form.addressPlaceholder', autocomplete: 'street-address' }) +
              '<fieldset class="field field--wide"><legend class="field__label">' + t('cart.form.payment') + '</legend>' +
                '<div class="segmented">' +
                  '<label><input type="radio" name="payment" value="card" checked><span>' + t('cart.form.paymentCard') + '</span></label>' +
                  '<label><input type="radio" name="payment" value="cash"><span>' + t('cart.form.paymentCash') + '</span></label>' +
                '</div></fieldset>' +
              field('comment', { textarea: true, wide: true }) +
            '</form>' +
          '</section>' +
        '</div>' +
        '<aside class="cart__aside"><div class="summary" id="cart-summary"></div></aside>' +
      '</div>';

    document.getElementById('cart-clear').addEventListener('click', function () {
      if (window.confirm(t('cart.clearConfirm'))) A.cart.clear();
    });
    document.getElementById('checkout').addEventListener('submit', submit);
  }

  function renderItems(totals) {
    document.getElementById('cart-items').innerHTML = totals.lines.map(function (l) {
      var p = l.product;
      var name = A.esc(A.productText(p, 'name'));
      return '<li class="cart-item" data-id="' + A.esc(p.id) + '">' +
        '<a class="cart-item__media" href="' + A.productUrl(p) + '" tabindex="-1">' + A.heaterSVG(p) + '</a>' +
        '<div class="cart-item__info">' +
          '<span class="card__type">' + t('typeSingle.' + p.type) + '</span>' +
          '<a class="cart-item__name" href="' + A.productUrl(p) + '">' + name + '</a>' +
          A.warningNote(p) +
          (p.price > 0 ? '<span class="muted">' + t('cart.pricePerItem', { value: A.formatPrice(p.price) }) + '</span>' : '') +
        '</div>' +
        A.stepper(l.qty) +
        '<div class="cart-item__sum' + (p.price > 0 ? '' : ' is-request') + '">' + A.priceLabel(l.sum) + '</div>' +
        '<button class="icon-btn cart-item__remove" type="button" data-remove aria-label="' + A.esc(t('cart.removeAria', { name: A.productText(p, 'name') })) + '">' + A.icon('trash') + '</button>' +
      '</li>';
    }).join('');
  }

  function renderSummary(totals) {
    var total = totals.hasUnpriced ? t('common.priceOnRequest') : A.formatPrice(totals.total);
    document.getElementById('cart-summary').innerHTML =
      '<h2>' + t('cart.summary') + '</h2>' +
      '<dl class="summary__rows">' +
        '<div><dt>' + t('cart.itemsTotal', { count: totals.count }) + '</dt><dd>' + total + '</dd></div>' +
        '<div><dt>' + t('cart.delivery') + '</dt><dd>' + t('cart.deliveryCalc') + '</dd></div>' +
      '</dl>' +
      (totals.hasUnpriced ? '<div class="summary__info">' + A.icon('clock') + '<span>' + t('cart.priceNote') + '</span></div>' : '') +
      '<div class="summary__total' + (totals.hasUnpriced ? ' is-request' : '') + '"><span>' + t('cart.total') + '</span><b>' + total + '</b></div>' +
      '<button class="btn btn--primary btn--lg btn--block" type="submit" form="checkout">' + t('cart.form.submit') + '</button>' +
      '<p class="summary__note">' + t('cart.form.agree') + '</p>';
  }

  function render() {
    var totals = A.cart.totals();
    if (!totals.lines.length) { renderEmpty(); return; }
    if (!document.getElementById('cart-items')) renderLayout();
    renderItems(totals);
    renderSummary(totals);
  }

  /* Изменение количества и удаление */
  root.addEventListener('stepper:change', function (e) {
    var item = e.target.closest('.cart-item');
    if (item) A.cart.setQty(item.getAttribute('data-id'), e.detail);
  });
  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove]');
    if (btn) A.cart.remove(btn.closest('.cart-item').getAttribute('data-id'));
  });

  /* Оформление заказа */
  function submit(e) {
    e.preventDefault();
    var form = e.target;
    var v = function (n) { return form.elements[n].value.trim(); };
    var errors = {};
    if (!v('name')) errors.name = t('cart.errors.name');
    if (v('phone').replace(/\D/g, '').length < 10) errors.phone = t('cart.errors.phone');
    if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) errors.email = t('cart.errors.email');
    if (!v('city')) errors.city = t('cart.errors.city');
    if (!v('address')) errors.address = t('cart.errors.address');

    form.querySelectorAll('[data-error-for]').forEach(function (el) {
      var name = el.getAttribute('data-error-for');
      el.textContent = errors[name] || '';
      form.elements[name].classList.toggle('is-invalid', !!errors[name]);
      form.elements[name].setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
    });

    var first = Object.keys(errors)[0];
    if (first) { form.elements[first].focus(); return; }

    // Демонстрация: заказ никуда не отправляется
    var number = String(Math.floor(100000 + Math.random() * 900000));
    ordered = true;
    A.cart.clear();
    root.innerHTML =
      '<div class="empty empty--page empty--success">' +
        '<div class="empty__icon">' + A.icon('check') + '</div>' +
        '<h1>' + t('cart.success.title') + '</h1>' +
        '<p>' + t('cart.success.text', { number: number }) + '</p>' +
        '<a class="btn btn--primary" href="index.html">' + t('cart.success.button') + '</a>' +
      '</div>';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('cart:change', function () { if (!ordered) render(); });
  render();
})();
