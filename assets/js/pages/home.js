(function () {
  'use strict';
  var A = window.App;
  var t = A.t;

  /* Цифры в первом экране */
  document.getElementById('hero-stats').innerHTML = t('home.hero.stats').map(function (s) {
    return '<li><b>' + A.esc(s.value) + '</b><span>' + A.esc(s.label) + '</span></li>';
  }).join('');

  /* Иллюстрация первого экрана: в большой карточке по очереди сменяются модели */
  var SHOWCASE = ['pkn-2v', 'pkn-1', 'pkn-6v', 'pkn-3-1-0-10', 'pkn-3', 'pkn-2-in', 'pkn-0-5']
    .map(A.getProduct).filter(Boolean);
  document.getElementById('hero-visual').innerHTML =
    '<a class="hero__card hero__card--main" id="hero-showcase" href="' + A.productUrl(SHOWCASE[0]) + '">' +
      '<span class="hero__name" aria-live="polite"></span>' +
      '<span class="hero__slides">' + SHOWCASE.map(function (p, i) {
        return '<span class="hero__slide' + (i === 0 ? ' is-active' : '') + '">' + A.productImage(p) + '</span>';
      }).join('') + '</span>' +
    '</a>' +
    '<div class="hero__card hero__card--side">' + A.productImage(A.getProduct('control-unit')) + '</div>' +
    '<div class="hero__chip">' + A.icon('wifi') + '<div><b>' + t('home.hero.tempValue') + '</b><span>' + t('home.hero.tempLabel') + '</span></div></div>';

  (function showcase() {
    var link = document.getElementById('hero-showcase');
    var name = link.querySelector('.hero__name');
    var slides = link.querySelectorAll('.hero__slide');
    var current = 0, timer = null, hover = false;

    function label(p) {
      return '<small>' + t('typeSingle.' + p.type) + '</small>' + A.esc(A.productText(p, 'name'));
    }
    function show(i) {
      slides[current].classList.remove('is-active');
      current = i;
      slides[current].classList.add('is-active');
      link.href = A.productUrl(SHOWCASE[current]);
      name.classList.remove('is-in');
      void name.offsetWidth; // перезапуск анимации подписи
      name.innerHTML = label(SHOWCASE[current]);
      name.classList.add('is-in');
    }
    function tick() { if (!hover && !document.hidden) show((current + 1) % slides.length); }

    show(0);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(tick, 3200);
    link.addEventListener('mouseenter', function () { hover = true; });
    link.addEventListener('mouseleave', function () { hover = false; });
  })();

  /* Преимущества */
  var benefitIcons = ['lifetime', 'wifi', 'shield', 'bolt'];
  document.getElementById('benefits').innerHTML = t('home.benefits.items').map(function (b, i) {
    return '<div class="benefit"><span class="benefit__icon">' + A.icon(benefitIcons[i % benefitIcons.length]) + '</span>' +
      '<h3>' + A.esc(b.title) + '</h3><p>' + A.esc(b.text) + '</p></div>';
  }).join('');

  /* Категории */
  var byOrder = function (a, b) { return a.order - b.order; };
  var types = Object.keys(A.dict.types);
  document.getElementById('categories').innerHTML = types.map(function (type) {
    var items = A.products.filter(function (p) { return p.type === type; }).sort(byOrder);
    if (!items.length) return '';
    var priced = items.filter(function (p) { return p.price > 0; }).map(function (p) { return p.price; });
    var price = priced.length ? t('common.from', { value: A.formatPrice(Math.min.apply(null, priced)) }) : t('common.priceOnRequest');
    // Обложка — модель из середины линейки
    var cover = items[Math.floor((items.length - 1) / 2)];
    return '<a class="category" href="catalog.html?type=' + type + '">' +
      '<div class="category__media">' + A.productImage(cover) + '</div>' +
      '<div class="category__body">' +
        '<h3>' + t('types.' + type) + '</h3>' +
        '<p>' + t('typeDescriptions.' + type) + '</p>' +
        '<div class="category__meta"><span>' + A.plural('common.models', items.length) + '</span>' +
        '<b>' + price + '</b></div>' +
      '</div>' +
    '</a>';
  }).join('');

  /* Витрина: по модели из каждой категории обогревателей */
  var showcase = ['pkn-1', 'pkn-2v', 'pkn-2-in', 'pkn-3-1-6-16'].map(A.getProduct).filter(Boolean);
  document.getElementById('popular').innerHTML = showcase.map(A.productCard).join('');
  document.getElementById('popular-all').innerHTML = '<span>' + t('home.popular.all') + '</span>' + A.icon('arrow');

  /* Подбор модели по площади */
  var areaInput = document.getElementById('calc-area');
  var areaRange = document.getElementById('calc-area-range');
  var result = document.getElementById('calc-result');
  var link = document.getElementById('calc-link');
  var heaters = A.products.filter(function (p) { return p.type === 'floor' || p.type === 'ventilated'; })
    .sort(function (a, b) { return a.area - b.area; });
  var maxArea = heaters[heaters.length - 1].area;
  areaInput.max = areaRange.max = maxArea;

  function clamp(v) { return Math.max(5, Math.min(maxArea, v)); }

  function recalc() {
    var area = clamp(parseFloat(areaInput.value) || 0);
    var model = heaters.find(function (p) { return p.area >= area; });
    if (model) {
      result.innerHTML = '<b>' + A.esc(A.productText(model, 'name')) + '</b>' +
        '<small>' + t('home.calc.resultArea', { value: t('units.upToM2', { value: A.formatNumber(model.area) }) }) + '</small>';
    } else {
      result.innerHTML = '<small>' + t('home.calc.noModel') + '</small>';
    }
    link.href = 'catalog.html?area=' + Math.ceil(area);
  }

  areaRange.addEventListener('input', function () { areaInput.value = areaRange.value; recalc(); });
  areaInput.addEventListener('input', function () { areaRange.value = areaInput.value; recalc(); });
  areaInput.addEventListener('change', function () {
    areaInput.value = clamp(parseFloat(areaInput.value) || 5);
    areaRange.value = areaInput.value;
    recalc();
  });
  document.getElementById('calc-form').addEventListener('submit', function (e) { e.preventDefault(); });
  recalc();
})();
