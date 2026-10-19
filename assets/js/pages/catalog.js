(function () {
  'use strict';
  var A = window.App;
  var t = A.t;

  var POWER_RANGES = {
    low: function (w) { return w <= 1000; },
    mid: function (w) { return w > 1000 && w <= 2000; },
    high: function (w) { return w > 2000; }
  };
  // Товары без цены (0) при сортировке по цене уходят в конец
  function priceKey(p, dir) { return p.price > 0 ? p.price * dir : Infinity; }
  var SORTS = {
    default: function (a, b) { return a.order - b.order; },
    priceAsc: function (a, b) { return priceKey(a, 1) - priceKey(b, 1) || a.order - b.order; },
    priceDesc: function (a, b) { return priceKey(a, -1) - priceKey(b, -1) || a.order - b.order; },
    area: function (a, b) { return (a.area || Infinity) - (b.area || Infinity) || a.order - b.order; },
    power: function (a, b) { return (b.power || 0) - (a.power || 0) || a.order - b.order; }
  };
  var anyPriced = A.products.some(function (p) { return p.price > 0; });

  var form = document.getElementById('filters-form');
  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var search = document.getElementById('search');
  var sort = document.getElementById('sort');
  var filters = document.getElementById('filters');

  /* ---------- Состояние из адресной строки ---------- */

  function list(param) {
    var v = A.params.get(param);
    return v ? v.split(',').filter(Boolean) : [];
  }

  var state = {
    q: A.params.get('q') || '',
    sort: SORTS[A.params.get('sort')] ? A.params.get('sort') : 'default',
    types: list('type'),
    power: list('power'),
    priceMin: anyPriced ? A.params.get('priceMin') || '' : '',
    priceMax: anyPriced ? A.params.get('priceMax') || '' : '',
    area: parseInt(A.params.get('area'), 10) || 0
  };

  /* ---------- Разметка фильтров ---------- */

  function checkbox(name, value, label, count) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="' + value + '">' +
      '<span>' + label + '</span>' + (count !== undefined ? '<small>' + count + '</small>' : '') + '</label>';
  }

  document.getElementById('filter-types').innerHTML = Object.keys(A.dict.types).map(function (type) {
    var n = A.products.filter(function (p) { return p.type === type; }).length;
    return checkbox('type', type, t('types.' + type), n);
  }).join('');

  document.getElementById('filter-power').innerHTML = Object.keys(POWER_RANGES).map(function (k) {
    return checkbox('power', k, t('catalog.powerRanges.' + k));
  }).join('');

  // Пока цены не заданы, фильтр по цене не нужен
  document.getElementById('filter-price').hidden = !anyPriced;

  sort.innerHTML = Object.keys(SORTS)
    .filter(function (k) { return anyPriced || k.indexOf('price') !== 0; })
    .map(function (k) { return '<option value="' + k + '">' + t('catalog.sort.' + k) + '</option>'; })
    .join('');
  if (!sort.querySelector('option[value="' + state.sort + '"]')) state.sort = 'default';

  document.getElementById('search-icon').innerHTML = A.icon('search');
  document.getElementById('filters-close').innerHTML = A.icon('close');
  document.getElementById('empty-icon').innerHTML = A.icon('search');
  document.getElementById('crumbs').innerHTML = A.breadcrumbs([
    { label: t('nav.home'), href: 'index.html' },
    { label: t('nav.catalog') }
  ]);

  /* ---------- Синхронизация формы и состояния ---------- */

  function stateToForm() {
    search.value = state.q;
    sort.value = state.sort;
    form.querySelectorAll('input[type=checkbox]').forEach(function (el) {
      el.checked = state[el.name === 'type' ? 'types' : el.name].indexOf(el.value) !== -1;
    });
    form.elements.priceMin.value = state.priceMin;
    form.elements.priceMax.value = state.priceMax;
    form.elements.area.value = state.area || '';
  }

  function formToState() {
    function checked(name) {
      return Array.prototype.filter.call(form.querySelectorAll('input[name=' + name + ']'), function (el) { return el.checked; })
        .map(function (el) { return el.value; });
    }
    state.q = search.value.trim();
    state.sort = sort.value;
    state.types = checked('type');
    state.power = checked('power');
    state.priceMin = form.elements.priceMin.value;
    state.priceMax = form.elements.priceMax.value;
    state.area = Math.max(0, parseInt(form.elements.area.value, 10) || 0);
  }

  function stateToUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'default') p.set('sort', state.sort);
    if (state.types.length) p.set('type', state.types.join(','));
    if (state.power.length) p.set('power', state.power.join(','));
    if (state.priceMin) p.set('priceMin', state.priceMin);
    if (state.priceMax) p.set('priceMax', state.priceMax);
    if (state.area) p.set('area', state.area);
    var qs = p.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  /* ---------- Фильтрация ---------- */

  function matches(p) {
    if (state.types.length && state.types.indexOf(p.type) === -1) return false;
    if ((state.priceMin || state.priceMax) && !(p.price > 0)) return false;
    if (state.priceMin && p.price < +state.priceMin) return false;
    if (state.priceMax && p.price > +state.priceMax) return false;
    // Фильтры по мощности и площади относятся только к обогревателям
    if (state.power.length && !(A.isHeater(p) && state.power.some(function (k) { return POWER_RANGES[k](p.power); }))) return false;
    if (state.area && !(A.isHeater(p) && p.area >= state.area)) return false;
    if (state.q) {
      var hay = (A.productText(p, 'name') + ' ' + t('typeSingle.' + p.type)).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function activeFilterCount() {
    return state.types.length + state.power.length +
      (state.priceMin ? 1 : 0) + (state.priceMax ? 1 : 0) + (state.area ? 1 : 0);
  }

  function chip(label, key, value) {
    return '<button class="chip" type="button" data-remove="' + key + '"' + (value ? ' data-value="' + value + '"' : '') + '>' +
      A.esc(label) + A.icon('close') + '</button>';
  }

  function renderChips() {
    var html = '';
    if (state.area) html += chip(t('catalog.areaChip', { value: A.formatNumber(state.area) }), 'area');
    state.types.forEach(function (v) { html += chip(t('types.' + v), 'types', v); });
    state.power.forEach(function (v) { html += chip(t('catalog.powerRanges.' + v), 'power', v); });
    if (state.priceMin) html += chip(t('common.from', { value: A.formatPrice(+state.priceMin) }), 'priceMin');
    if (state.priceMax) html += chip(t('common.upTo', { value: A.formatPrice(+state.priceMax) }), 'priceMax');
    if (html) html += '<button class="chip chip--reset" type="button" data-reset>' + t('catalog.reset') + '</button>';
    document.getElementById('chips').innerHTML = html;
  }

  function render() {
    var result = A.products.filter(matches).sort(SORTS[state.sort]);
    grid.innerHTML = result.map(A.productCard).join('');
    grid.hidden = result.length === 0;
    empty.hidden = result.length !== 0;

    document.getElementById('found').textContent = A.plural('common.products', result.length);
    document.getElementById('filters-apply').textContent =
      t('catalog.filtersApply', { count: A.plural('common.products', result.length) });

    var n = activeFilterCount();
    document.getElementById('filters-open').innerHTML = A.icon('filter') + '<span>' + t('catalog.filters') + '</span>' +
      (n ? '<b class="counter">' + n + '</b>' : '');

    renderChips();
    stateToUrl();
  }

  function update() { formToState(); render(); }

  function reset() {
    state.types = []; state.power = [];
    state.priceMin = ''; state.priceMax = ''; state.area = 0; state.q = '';
    stateToForm();
    render();
  }

  /* ---------- События ---------- */

  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
  form.querySelectorAll('input[type=number]').forEach(function (el) {
    el.addEventListener('input', debounce(update, 400));
  });
  search.addEventListener('input', debounce(update, 200));
  sort.addEventListener('change', update);

  document.getElementById('filters-reset').addEventListener('click', reset);
  document.getElementById('empty-reset').addEventListener('click', reset);

  document.getElementById('chips').addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    if (btn.hasAttribute('data-reset')) return reset();
    var key = btn.getAttribute('data-remove');
    var value = btn.getAttribute('data-value');
    if (Array.isArray(state[key])) state[key] = state[key].filter(function (v) { return v !== value; });
    else state[key] = key === 'area' ? 0 : '';
    stateToForm();
    render();
  });

  // Панель фильтров на телефоне
  function openFilters(open) {
    filters.classList.toggle('is-open', open);
    document.body.classList.toggle('filters-open', open);
  }
  document.getElementById('filters-open').addEventListener('click', function () { openFilters(true); });
  document.getElementById('filters-close').addEventListener('click', function () { openFilters(false); });
  document.getElementById('filters-apply').addEventListener('click', function () { openFilters(false); });
  document.getElementById('filters-backdrop').addEventListener('click', function () { openFilters(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openFilters(false); });

  function debounce(fn, ms) {
    var timer;
    return function () { clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

  stateToForm();
  render();
})();
