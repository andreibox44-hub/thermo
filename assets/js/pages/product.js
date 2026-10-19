(function () {
  'use strict';
  var A = window.App;
  var t = A.t;
  var root = document.getElementById('product-root');
  var p = A.getProduct(A.params.get('id'));

  if (!p) {
    document.title = t('pages.productNotFound');
    root.innerHTML =
      '<div class="empty empty--page">' +
        '<div class="empty__icon">' + A.icon('search') + '</div>' +
        '<h1>' + t('product.notFoundTitle') + '</h1>' +
        '<p>' + t('product.notFoundText') + '</p>' +
        '<a class="btn btn--primary" href="catalog.html">' + t('common.backToCatalog') + '</a>' +
      '</div>';
    return;
  }

  var name = A.productText(p, 'name');
  var heater = A.isHeater(p);
  document.title = t('pages.product', { name: name });

  /* ---------- Характеристики ---------- */

  function has(v) { return v !== undefined && v !== null; }
  var celsius = has(p.range) ? t('units.celsius', { from: p.range[0], to: p.range[1] }) : null;
  var cycles = has(p.cycles) ? t('units.cycles', { value: A.formatNumber(p.cycles) }) : null;
  var years = has(p.lifetime) ? t('units.years', { from: p.lifetime[0], to: p.lifetime[1] }) : null;
  var sections = has(p.sections) ? A.plural('common.sections', p.sections) : null;
  var current = has(p.current) ? t('units.a', { value: A.formatNumber(p.current) }) : null;

  // Показываем только характеристики, заданные у товара
  var specs = [
    ['type', t('typeSingle.' + p.type)],
    ['deviceType', has(p.deviceType) && t('specValues.deviceType.' + p.deviceType)],
    ['mount', has(p.mount) && t('specValues.mount.' + p.mount)],
    ['sections', sections],
    ['area', heater && A.areaLabel(p)],
    ['ceiling', has(p.ceiling) && t('units.upToM', { value: A.formatNumber(p.ceiling) })],
    ['power', has(p.power) && A.formatPower(p.power)],
    ['current', current],
    ['consumption', has(p.consumption) && A.formatConsumption(p.consumption)],
    ['dimensions', has(p.dimensions) ? t('units.mm', { value: p.dimensions.join('×') }) : heater && t('common.tbd')],
    ['weight', has(p.weight) ? t('units.kg', { value: A.formatNumber(p.weight) }) : heater && t('common.tbd')],
    ['body', has(p.body) && t('specValues.body.' + p.body)],
    ['control', has(p.control) && t('specValues.control.' + p.control)],
    ['supply', has(p.voltage) && t('units.supply', { voltage: p.voltage, frequency: p.frequency })],
    ['network', has(p.network) && t('specValues.network.' + p.network)],
    ['lifetime', years],
    ['range', celsius],
    ['cycles', cycles],
    ['certs', p.certs.length && p.certs.map(function (c) { return t('certs.' + c); }).join(', ')]
  ].filter(function (s) { return s[1]; });

  var specsHtml = specs.map(function (s) {
    return '<div class="specs__row"><dt>' + t('specs.' + s[0]) + '</dt><dd>' + A.esc(s[1]) + '</dd></div>';
  }).join('');

  var keySpecs = !heater ? [
    ['thermo', t('specs.range'), celsius],
    ['check', t('specs.cycles'), cycles]
  ] : [
    ['area', t('specs.area'), A.areaLabel(p)],
    ['bolt', t('specs.power'), A.formatPower(p.power)],
    years ? ['lifetime', t('specs.lifetime'), years] : ['filter', t('specs.sections'), sections]
  ];
  keySpecs = keySpecs.filter(function (k) { return k[2]; });

  var related = A.products
    .filter(function (x) { return x.id !== p.id; })
    .sort(function (a, b) {
      return (b.type === p.type) - (a.type === p.type) ||
        Math.abs((a.area || 0) - (p.area || 0)) - Math.abs((b.area || 0) - (p.area || 0));
    })
    .slice(0, 4);

  var perkIcons = ['truck', 'shield'];
  var featureIcons = { metal: 'shield', touch: 'touch', wifi: 'wifi', fan: 'fan' };

  root.innerHTML =
    A.breadcrumbs([
      { label: t('nav.home'), href: 'index.html' },
      { label: t('nav.catalog'), href: 'catalog.html' },
      { label: t('types.' + p.type), href: 'catalog.html?type=' + p.type },
      { label: name }
    ]) +

    '<div class="product">' +
      '<div class="product__media">' + A.certBadges(p) + A.heaterSVG(p) + '</div>' +

      '<div class="product__info">' +
        '<a class="product__type" href="catalog.html?type=' + p.type + '">' + t('typeSingle.' + p.type) + '</a>' +
        '<h1 class="product__title">' + A.esc(name) + '</h1>' +
        '<p class="product__short">' + A.esc(A.productText(p, 'short')) + '</p>' +

        '<div class="product__keyspecs product__keyspecs--' + keySpecs.length + '">' + keySpecs.map(function (k) {
          return '<div>' + A.icon(k[0]) + '<span>' + k[1] + '</span><b>' + A.esc(k[2]) + '</b></div>';
        }).join('') + '</div>' +

        A.warningBlock(p) +
        '<div class="buy">' +
          '<div class="buy__price">' + A.priceBlock(p, 'price--lg') +
            (p.price > 0 ? '' : '<p class="buy__note">' + t('product.priceNote') + '</p>') + '</div>' +
          '<div class="buy__actions">' + A.stepper(1, 'id="qty"') + A.addButton(p, 'btn--lg buy__btn') + '</div>' +
          '<ul class="buy__perks">' + t('product.perks').map(function (txt, i) {
            return '<li>' + A.icon(perkIcons[i % perkIcons.length]) + A.esc(txt) + '</li>';
          }).join('') + '</ul>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="tabs" id="tabs">' +
      '<div class="tabs__list" role="tablist">' +
        ['description', 'specs', 'delivery'].map(function (k, i) {
          return '<button class="tabs__tab' + (i === 0 ? ' is-active' : '') + '" role="tab" id="tab-' + k + '" aria-controls="panel-' + k + '" aria-selected="' + (i === 0) + '"' + (i ? ' tabindex="-1"' : '') + '>' + t('product.tabs.' + k) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="tabs__panel" role="tabpanel" id="panel-description" aria-labelledby="tab-description">' +
        '<div class="prose">' + A.productText(p, 'description').map(function (para) { return '<p>' + A.esc(para) + '</p>'; }).join('') + '</div>' +
        (p.features.length ?
          '<h3>' + t('product.featuresTitle') + '</h3>' +
          '<ul class="features">' + p.features.map(function (f) { return '<li>' + A.icon(featureIcons[f] || 'check') + t('features.' + f) + '</li>'; }).join('') + '</ul>'
          : '') +
      '</div>' +
      '<div class="tabs__panel" role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" hidden>' +
        '<dl class="specs">' + specsHtml + '</dl>' +
      '</div>' +
      '<div class="tabs__panel" role="tabpanel" id="panel-delivery" aria-labelledby="tab-delivery" hidden>' +
        '<div class="delivery">' + t('product.delivery').map(function (d) {
          return '<div><h3>' + A.esc(d.title) + '</h3><p>' + A.esc(d.text) + '</p></div>';
        }).join('') + '</div>' +
      '</div>' +
    '</div>' +

    '<section class="section section--tight">' +
      '<h2 class="section__title">' + t('product.related') + '</h2>' +
      '<div class="grid">' + related.map(A.productCard).join('') + '</div>' +
    '</section>';

  /* Количество для кнопки «В корзину» */
  var qty = document.getElementById('qty');
  var buyBtn = root.querySelector('.buy__btn');
  qty.addEventListener('stepper:change', function (e) { buyBtn.setAttribute('data-qty', e.detail); });

  /* Вкладки */
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.tabs__tab'));
  function select(tab) {
    tabs.forEach(function (tb) {
      var on = tb === tab;
      tb.classList.toggle('is-active', on);
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
      document.getElementById(tb.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab); });
    tab.addEventListener('keydown', function (e) {
      var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
})();
