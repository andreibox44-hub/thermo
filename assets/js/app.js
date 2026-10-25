/*
 * Общая логика сайта: переводы, корзина, шапка и подвал, карточка товара,
 * иллюстрации обогревателей и мелкие помощники. Подключается на каждой странице
 * после texts.js и products.js, до скрипта конкретной страницы.
 */
(function () {
  'use strict';

  var LANG_KEY = 'thermo.lang';
  var CART_KEY = 'thermo.cart';
  var FAV_KEY = 'thermo.favorites';
  var DEFAULT_LANG = 'ru';

  /* ---------- Хранилище (localStorage может быть недоступен) ---------- */

  var storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { /* приватный режим — просто не сохраняем */ }
    }
  };

  /* ---------- Переводы ---------- */

  var languages = Object.keys(window.TEXTS);
  var lang = storage.get(LANG_KEY, DEFAULT_LANG);
  if (!window.TEXTS[lang]) lang = DEFAULT_LANG;
  var dict = window.TEXTS[lang];
  var pluralRules = new Intl.PluralRules(dict.meta.locale);

  function lookup(key) {
    var parts = key.split('.');
    var node = dict;
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function (m, name) {
      return params[name] !== undefined ? params[name] : m;
    });
  }

  /** Строка по ключу: t('nav.home'), t('catalog.found', { count: 5 }). */
  function t(key, params) {
    var value = lookup(key);
    if (value === undefined) {
      console.warn('[i18n] нет перевода: ' + key);
      return key;
    }
    return typeof value === 'string' ? interpolate(value, params) : value;
  }

  /** Множественное число: plural('common.products', 3) → «3 товара». */
  function plural(key, n, params) {
    var forms = lookup(key) || {};
    var form = forms[pluralRules.select(n)] || forms.other || key;
    var all = { n: formatNumber(n) };
    for (var k in params) all[k] = params[k];
    return interpolate(form, all);
  }

  /** Переводит элементы с атрибутами data-i18n, data-i18n-placeholder, data-i18n-aria. */
  function applyTranslations(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    (root || document).querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
  }

  function setLang(code) {
    if (!window.TEXTS[code]) return;
    storage.set(LANG_KEY, code);
    window.location.reload();
  }

  /* ---------- Форматирование ---------- */

  var priceLocale = dict.meta.priceLocale || dict.meta.locale;
  var priceWhole = new Intl.NumberFormat(priceLocale, {
    style: 'currency', currency: dict.meta.currency, minimumFractionDigits: 0, maximumFractionDigits: 0
  });
  var priceCents = new Intl.NumberFormat(priceLocale, {
    style: 'currency', currency: dict.meta.currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  var numberFormat = new Intl.NumberFormat(dict.meta.locale);

  /** Цена: 1 290 € или 1 290,50 €, если есть центы. */
  function formatPrice(v) { return (v % 1 ? priceCents : priceWhole).format(v); }
  function formatNumber(v) { return numberFormat.format(v); }

  /** Мощность в кВт: 500 → «0,5 кВт». */
  function formatPower(w) { return t('units.kw', { value: formatNumber(w / 1000) }); }

  /** Потребление: 170 → «170 Вт/ч», 3000 → «3 кВт/ч». */
  function formatConsumption(w) {
    return w >= 1000 ? t('units.kwh', { value: formatNumber(w / 1000) }) : t('units.wh', { value: formatNumber(w) });
  }

  /** Цена товара или «Цена уточняется», если цена 0. */
  function priceLabel(v) { return v > 0 ? formatPrice(v) : t('common.priceOnRequest'); }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * Ссылка tel: для телефона. Пока номер — заглушка с X, ссылка не нужна:
   * выводим просто текст в <span> с тем же классом.
   */
  function telLink(phone, inner, cls) {
    var c = cls ? ' class="' + cls + '"' : '';
    if (/x/i.test(phone)) return '<span' + c + '>' + inner + '</span>';
    return '<a' + c + ' href="tel:' + phone.replace(/[^\d+]/g, '') + '">' + inner + '</a>';
  }

  /* ---------- Товары ---------- */

  var products = window.PRODUCTS;
  var byId = {};
  products.forEach(function (p) { byId[p.id] = p; });

  function getProduct(id) { return byId[id] || null; }
  function isHeater(p) { return p.type !== 'accessory'; }

  function has(v) { return v !== undefined && v !== null; }

  /** Площадь: «до 14 м²» или «Уточняется», если не задана. */
  function areaLabel(p) {
    return has(p.area) ? t('units.upToM2', { value: formatNumber(p.area) }) : t('common.tbd');
  }

  /** Значения для подстановки в шаблоны описаний (только те, что есть у товара). */
  function productVars(p) {
    var v = { name: t('products.' + p.id + '.name') };
    if (has(p.area)) v.area = formatNumber(p.area);
    if (has(p.volume)) v.volume = formatNumber(p.volume);
    if (has(p.ceiling)) v.ceiling = formatNumber(p.ceiling);
    if (has(p.power)) v.power = formatPower(p.power);
    if (has(p.consumption)) v.consumption = formatConsumption(p.consumption);
    if (has(p.current)) v.current = t('units.a', { value: formatNumber(p.current) });
    if (has(p.sections)) v.sections = plural('common.sections', p.sections);
    if (has(p.range)) v.range = t('units.celsius', { from: p.range[0], to: p.range[1] });
    if (has(p.cycles)) v.cycles = t('units.cycles', { value: formatNumber(p.cycles) });
    return v;
  }

  /**
   * Текст товара: name — из texts.products, short/description — из
   * texts.products[id], а если там нет, то из шаблона texts.productTemplates[type].
   */
  function productText(p, field) {
    if (field === 'name') return t('products.' + p.id + '.name');
    var value = lookup('products.' + p.id + '.' + field);
    if (value === undefined) value = lookup('productTemplates.' + p.type + '.' + field);
    if (value === undefined) return '';
    var vars = productVars(p);
    return Array.isArray(value)
      ? value.map(function (s) { return interpolate(s, vars); })
      : interpolate(value, vars);
  }
  function productUrl(p) { return 'product.html?id=' + encodeURIComponent(p.id); }

  /* ---------- Избранное ----------
     Хранится в браузере; если покупатель вошёл, auth.js сохраняет его и в аккаунте. */

  var favorites = {
    read: function () {
      var raw = storage.get(FAV_KEY, []);
      return Array.isArray(raw) ? raw.filter(function (id) { return byId[id]; }) : [];
    },
    has: function (id) { return favorites.read().indexOf(id) !== -1; },
    write: function (list) {
      storage.set(FAV_KEY, list.slice(0, 100));
      document.dispatchEvent(new CustomEvent('favorites:change'));
    },
    /** Добавляет или убирает товар; возвращает true, если товар теперь в избранном. */
    toggle: function (id) {
      var list = favorites.read();
      var i = list.indexOf(id);
      if (i === -1) list.unshift(id); else list.splice(i, 1);
      favorites.write(list);
      return i === -1;
    }
  };

  /* ---------- Корзина ---------- */

  var cart = {
    read: function () {
      var raw = storage.get(CART_KEY, []);
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (i) { return i && byId[i.id] && i.qty > 0; });
    },
    write: function (items) {
      storage.set(CART_KEY, items);
      document.dispatchEvent(new CustomEvent('cart:change'));
    },
    add: function (id, qty) {
      var items = cart.read();
      var found = items.find(function (i) { return i.id === id; });
      if (found) found.qty = Math.min(99, found.qty + (qty || 1));
      else items.push({ id: id, qty: Math.min(99, qty || 1) });
      cart.write(items);
    },
    setQty: function (id, qty) {
      var items = cart.read();
      items.forEach(function (i) { if (i.id === id) i.qty = Math.max(1, Math.min(99, qty)); });
      cart.write(items);
    },
    remove: function (id) {
      cart.write(cart.read().filter(function (i) { return i.id !== id; }));
    },
    clear: function () { cart.write([]); },
    has: function (id) { return cart.read().some(function (i) { return i.id === id; }); },
    count: function () {
      return cart.read().reduce(function (sum, i) { return sum + i.qty; }, 0);
    },
    /** Итоги: позиции с товарами и сумма. Доставку считает менеджер. */
    totals: function () {
      var lines = cart.read().map(function (i) {
        var p = byId[i.id];
        return { product: p, qty: i.qty, sum: p.price * i.qty };
      });
      return {
        lines: lines,
        count: lines.reduce(function (s, l) { return s + l.qty; }, 0),
        total: lines.reduce(function (s, l) { return s + l.sum; }, 0),
        // Есть товары без цены — итог показать нельзя
        hasUnpriced: lines.some(function (l) { return !(l.product.price > 0); })
      };
    }
  };

  /* ---------- Иконки ---------- */

  var ICON_PATHS = {
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3h2.6l2.3 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 7H6.1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    phone: '<path d="M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 5.1 5.1l1.4-2.3L19 13.5V17a2 2 0 0 1-2 2A15 15 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    flame: '<path d="M12 3c.5 3.5 5 5.5 5 10.5a5 5 0 0 1-10 0c0-2.3 1.2-3.8 2.2-4.8.2 1.5 1 2.6 2 3 0-3 .3-6 .8-8.7z"/>',
    return: '<path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="M8 5L4 9l4 4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    area: '<path d="M4 4h16v16H4z"/><path d="M4 9h5V4M20 15h-5v5"/>',
    thermo: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
    wifi: '<path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0"/><circle cx="12" cy="19.5" r=".6"/>',
    touch: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4.6 1a2 2 0 0 1 1.5 2.3L17 20H9.5L6 15.5a1.5 1.5 0 0 1 2.3-1.9L9 14.5"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-5 6-8 10-10"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-6 3.5-6s2 4-1.5 6.5M14 12c4 0 6 1 6 3.5s-4 2-6.5-1.5M12 14c0 4-1 6-3.5 6s-2-4 1.5-6.5M10 12c-4 0-6-1-6-3.5s4-2 6.5 1.5"/>',
    lifetime: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M12 8v4l2.5 1.5"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      ICON_PATHS[name] + '</svg>';
  }

  /* ---------- Иллюстрации обогревателей ---------- */

  var svgUid = 0;
  var METAL = { body: '#eef0f3', edge: '#c3c9d2', shade: '#d9dde3', detail: '#8a94a6', screen: '#1f2937', glow: '#ff6b2c' };

  function heatWaves(cx, top) {
    var g = '<g class="heat-waves" fill="none" stroke="' + METAL.glow + '" stroke-width="3" stroke-linecap="round" opacity=".55">';
    [-30, 0, 30].forEach(function (dx) {
      var x = cx + dx;
      g += '<path d="M' + x + ' ' + top + 'c-6-6 6-10 0-16"/>';
    });
    return g + '</g>';
  }

  // Сенсорная панель с индикатором Wi‑Fi
  function touchPanel(x, y) {
    return '<rect x="' + x + '" y="' + y + '" width="34" height="13" rx="4" fill="' + METAL.screen + '"/>' +
      '<circle cx="' + (x + 8) + '" cy="' + (y + 6.5) + '" r="2.5" fill="' + METAL.glow + '"/>' +
      '<path d="M' + (x + 20) + ' ' + (y + 6) + 'a6 6 0 0 1 8 0M' + (x + 21.8) + ' ' + (y + 8.3) + 'a3 3 0 0 1 4.4 0" fill="none" stroke="#7dd3fc" stroke-width="1.4" stroke-linecap="round"/>';
  }

  /** Векторная картинка товара по типу; пропорции корпуса — из габаритов. */
  function heaterSVG(p) {
    var id = 'h' + (++svgUid);
    var m = METAL;
    var body = '';
    var grad = 'url(#' + id + 'g)';

    if (p.type === 'floor' || p.type === 'ventilated') {
      var s = Math.min(196 / p.dimensions[0], 104 / p.dimensions[1]);
      var w = Math.round(p.dimensions[0] * s), h = Math.round(p.dimensions[1] * s);
      var x = (240 - w) / 2, y = 152 - h;
      body = heatWaves(120, y - 8) +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + grad + '" stroke="' + m.edge + '" stroke-width="2"/>';
      var slits = Math.max(4, Math.floor((w - 24) / 13));
      var slitH = Math.min(18, h * 0.28);
      for (var i = 0; i < slits; i++) {
        body += '<rect x="' + (x + 12 + i * 13) + '" y="' + (y + 7) + '" width="7" height="' + slitH + '" rx="2.5" fill="' + m.shade + '"/>';
      }
      if (p.type === 'ventilated') {
        var r = Math.min(h * 0.3, 24), fx = x + 14 + r, fy = y + h - r - 8;
        body += '<circle cx="' + fx + '" cy="' + fy + '" r="' + r + '" fill="' + m.shade + '"/>' +
          '<circle cx="' + fx + '" cy="' + fy + '" r="' + (r * 0.7) + '" fill="none" stroke="' + m.detail + '" stroke-width="1.6"/>' +
          '<circle cx="' + fx + '" cy="' + fy + '" r="' + (r * 0.38) + '" fill="none" stroke="' + m.detail + '" stroke-width="1.6"/>' +
          '<circle cx="' + fx + '" cy="' + fy + '" r="3" fill="' + m.detail + '"/>';
      }
      body += touchPanel(x + w - 46, y + h - 22) +
        '<path d="M' + (x + 18) + ' ' + (y + h) + 'v10M' + (x + w - 18) + ' ' + (y + h) + 'v10" stroke="' + m.detail + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M' + (x + 6) + ' ' + (y + h + 11) + 'h24M' + (x + w - 30) + ' ' + (y + h + 11) + 'h24" stroke="' + m.detail + '" stroke-width="4" stroke-linecap="round"/>';
    } else if (p.type === 'aluminum') {
      // Секционный радиатор: число секций — из данных
      var n = p.sections || 10;
      var sw = Math.min(14, 196 / n), rw = sw * n, rx0 = (240 - rw) / 2, ry = 44, rh = 104;
      body = heatWaves(120, ry - 8) +
        '<rect x="' + rx0 + '" y="' + (ry + 8) + '" width="' + rw + '" height="8" fill="' + m.edge + '"/>' +
        '<rect x="' + rx0 + '" y="' + (ry + rh - 16) + '" width="' + rw + '" height="8" fill="' + m.edge + '"/>';
      for (var k = 0; k < n; k++) {
        var sx = rx0 + k * sw + 0.8;
        body += '<rect x="' + sx + '" y="' + ry + '" width="' + (sw - 1.6) + '" height="' + rh + '" rx="' + Math.min(4, sw / 3) + '" fill="' + grad + '" stroke="' + m.edge + '" stroke-width="1.4"/>' +
          '<path d="M' + (sx + (sw - 1.6) / 2) + ' ' + (ry + 22) + 'v' + (rh - 44) + '" stroke="' + m.shade + '" stroke-width="2" stroke-linecap="round"/>';
      }
      body += '<rect x="' + (rx0 + rw) + '" y="' + (ry + rh - 18) + '" width="8" height="12" rx="2" fill="' + m.detail + '"/>' +
        '<rect x="' + (rx0 - 8) + '" y="' + (ry + 6) + '" width="8" height="12" rx="2" fill="' + m.detail + '"/>';
    } else if (p.type === 'inFloor') {
      // Пол в перспективе и решётка, утопленная в него
      var len = Math.min(170, 70 + p.dimensions[0] / 10);
      var gx = 120 - len / 2;
      body = '<path d="M12 98h216l-16 64H28z" fill="#e7dccd"/>' +
        '<path d="M12 98h216" stroke="#d6c6b0" stroke-width="2"/>' +
        '<g stroke="#d9cab6" stroke-width="1.5"><path d="M70 98l-8 64"/><path d="M130 98l-2 64"/><path d="M190 98l4 64"/></g>' +
        '<path d="M' + gx + ' 112h' + len + 'l-4 22h-' + (len - 8) + 'z" fill="' + m.screen + '"/>' +
        '<path d="M' + (gx + 3) + ' 114h' + (len - 6) + 'l-3 17h-' + (len - 12) + 'z" fill="' + grad + '"/>';
      for (var j = 0; j < Math.floor(len / 9); j++) {
        var lx = gx + 8 + j * 9;
        body += '<path d="M' + lx + ' 115l-1 15" stroke="' + m.detail + '" stroke-width="2.4" stroke-linecap="round"/>';
      }
      body += heatWaves(120, 98) + touchPanel(gx + len - 40, 140);
    } else {
      // Блок управления
      body = '<rect x="72" y="22" width="96" height="134" rx="16" fill="' + grad + '" stroke="' + m.edge + '" stroke-width="2"/>' +
        '<rect x="84" y="36" width="72" height="46" rx="8" fill="' + m.screen + '"/>' +
        '<text x="120" y="67" text-anchor="middle" font-family="Manrope, sans-serif" font-size="22" font-weight="700" fill="#fff">+22°</text>' +
        '<circle cx="146" cy="44" r="2.5" fill="' + m.glow + '"/>' +
        '<circle cx="98" cy="108" r="11" fill="' + m.shade + '"/><path d="M93 108h10" stroke="' + m.detail + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="142" cy="108" r="11" fill="' + m.shade + '"/><path d="M137 108h10M142 103v10" stroke="' + m.detail + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<rect x="100" y="134" width="40" height="5" rx="2.5" fill="' + m.shade + '"/>';
    }

    return '<svg class="heater-svg" viewBox="0 0 240 180" role="img" aria-label="' + esc(productText(p, 'name')) + '">' +
      '<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="' + m.body + '"/></linearGradient></defs>' +
      (p.type === 'inFloor' ? '' : '<ellipse cx="120" cy="170" rx="92" ry="5" fill="#0f172a" opacity=".07"/>') +
      body + '</svg>';
  }

  /** Фото товара, а если фото нет — векторная картинка. Встраиваемые — фото в интерьере. */
  function productImage(p) {
    if (!p.image) return heaterSVG(p);
    return '<img class="product-img' + (p.type === 'inFloor' ? ' product-img--scene' : '') + '" src="' + esc(p.image) +
      '" alt="' + esc(productText(p, 'name')) + '" loading="lazy" decoding="async">';
  }

  /* ---------- Общие компоненты ---------- */

  function priceBlock(p, cls) {
    if (!(p.price > 0)) {
      return '<div class="price price--request ' + (cls || '') + '"><span class="price__now">' + t('common.priceOnRequest') + '</span></div>';
    }
    return '<div class="price ' + (cls || '') + '">' +
      '<span class="price__now">' + formatPrice(p.price) + '</span>' +
      (p.oldPrice ? '<s class="price__old">' + formatPrice(p.oldPrice) + '</s>' : '') +
      '</div>';
  }

  function addButton(p, extraCls) {
    var inCart = cart.has(p.id);
    return '<button class="btn btn--primary ' + (extraCls || '') + (inCart ? ' is-in-cart' : '') + '" data-add-to-cart="' + esc(p.id) + '">' +
      icon(inCart ? 'check' : 'cart') + '<span>' + t(inCart ? 'common.inCart' : 'common.addToCart') + '</span></button>';
  }

  /** Короткие характеристики для карточки: площадь и мощность или диапазон терморегулятора. */
  function cardSpecs(p) {
    if (!isHeater(p)) {
      return '<span class="card__spec">' + icon('thermo') + t('units.celsius', { from: p.range[0], to: p.range[1] }) + '</span>';
    }
    return '<span class="card__spec">' + icon('area') + (has(p.area) ? areaLabel(p) : t('common.areaTbd')) + '</span>' +
      '<span class="card__spec">' + icon('bolt') + formatPower(p.power) + '</span>';
  }

  /** Короткая пометка о предупреждениях — для карточки и корзины. */
  function warningNote(p) {
    if (!p.warnings.length) return '';
    return '<p class="warn-note">' + icon('alert') + p.warnings.map(function (w) { return t('warnings.' + w + 'Short'); }).join(', ') + '</p>';
  }

  /** Заметный блок предупреждений — для страницы товара. */
  function warningBlock(p) {
    if (!p.warnings.length) return '';
    return '<div class="warn" role="note">' + icon('alert') + '<div><b>' + t('warnings.title') + '</b>' +
      p.warnings.map(function (w) { return '<p>' + t('warnings.' + w) + '</p>'; }).join('') + '</div></div>';
  }

  /** Метки на фото: сертификаты (слева, «Сертификат CE») и ECO (справа). */
  function certBadges(p) {
    var html = p.certs.length ? '<span class="certs">' + p.certs.map(function (c) {
      return '<span class="cert">' + icon('shield') + t('certs.' + c) + '</span>';
    }).join('') + '</span>' : '';
    if (p.eco) html += '<span class="eco">' + icon('leaf') + t('certs.eco') + '</span>';
    return html;
  }

  /** Сердечко «В избранное». withLabel — с подписью (страница товара). */
  function favButton(p, withLabel) {
    var on = favorites.has(p.id);
    var label = t(on ? 'favorites.remove' : 'favorites.add');
    return '<button type="button" class="fav-btn' + (withLabel ? ' fav-btn--label' : '') + (on ? ' is-on' : '') + '" data-fav="' + esc(p.id) + '"' +
      ' aria-pressed="' + on + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + icon('heart') +
      (withLabel ? '<span>' + t(on ? 'favorites.inList' : 'favorites.add') + '</span>' : '') + '</button>';
  }

  /** Обновляет все сердечки товара на странице. */
  function syncFavButtons(id) {
    var on = favorites.has(id);
    document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (b) {
      var label = t(on ? 'favorites.remove' : 'favorites.add');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', label);
      b.title = label;
      var span = b.querySelector('span');
      if (span) span.textContent = t(on ? 'favorites.inList' : 'favorites.add');
    });
  }

  function productCard(p) {
    var url = productUrl(p);
    return '<article class="card">' +
      '<div class="card__mediawrap">' +
        '<a class="card__media" href="' + url + '" tabindex="-1">' + certBadges(p) + productImage(p) + '</a>' +
        favButton(p) +
      '</div>' +
      '<div class="card__body">' +
        '<span class="card__type">' + t('typeSingle.' + p.type) + '</span>' +
        '<h3 class="card__title"><a href="' + url + '">' + esc(productText(p, 'name')) + '</a></h3>' +
        '<div class="card__meta">' + cardSpecs(p) + '</div>' +
        warningNote(p) +
        '<div class="card__footer">' + priceBlock(p) + addButton(p) + '</div>' +
      '</div>' +
    '</article>';
  }

  function stepper(value, attrs) {
    return '<div class="stepper" ' + (attrs || '') + '>' +
      '<button type="button" class="stepper__btn" data-step="-1" aria-label="' + esc(t('common.decrease')) + '">' + icon('minus') + '</button>' +
      '<input class="stepper__input" type="number" inputmode="numeric" min="1" max="99" value="' + value + '" aria-label="' + esc(t('common.quantity')) + '">' +
      '<button type="button" class="stepper__btn" data-step="1" aria-label="' + esc(t('common.increase')) + '">' + icon('plus') + '</button>' +
    '</div>';
  }

  /** Разметка хлебных крошек: [{label, href?}, ...] */
  function breadcrumbs(items) {
    return '<nav class="breadcrumbs" aria-label="' + esc(t('common.breadcrumbs')) + '"><ol>' +
      items.map(function (it) {
        return '<li>' + (it.href ? '<a href="' + it.href + '">' + esc(it.label) + '</a>' : '<span aria-current="page">' + esc(it.label) + '</span>') + '</li>';
      }).join('') + '</ol></nav>';
  }

  /* ---------- Уведомления ---------- */

  var toastTimer;
  function toast(message, link) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = icon('check', 'toast__icon') + '<span>' + esc(message) + '</span>' +
      (link ? '<a href="' + link.href + '">' + esc(link.label) + '</a>' : '');
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 3200);
  }

  /* ---------- Шапка и подвал ---------- */

  var page = document.body.getAttribute('data-page');
  // Значок логотипа — тот же файл, что и иконка вкладки (favicon)
  var LOGO_MARK = '<img class="logo__mark" src="assets/img/logo.svg?v=2" alt="" width="38" height="38">';
  // «Glow» — тёплым градиентом, «den» — цветом текста
  function logoText() {
    return '<span class="logo__text"><span class="logo__glow">' + t('brand.glow') + '</span>' + t('brand.den') + '</span>';
  }

  function renderHeader() {
    var links = [
      { key: 'home', href: 'index.html' },
      { key: 'catalog', href: 'catalog.html' },
      { key: 'contacts', href: 'contacts.html' }
    ];
    var activeKey = page === 'product' ? 'catalog' : page;

    var langSwitch = languages.length > 1
      ? '<label class="lang"><span class="visually-hidden">' + t('header.language') + '</span><select id="lang-select">' +
        languages.map(function (code) {
          return '<option value="' + code + '"' + (code === lang ? ' selected' : '') + '>' + window.TEXTS[code].meta.label + '</option>';
        }).join('') + '</select></label>'
      : '';

    var phone = t('header.phone');
    document.getElementById('site-header').innerHTML =
      '<header class="header">' +
        '<div class="container header__inner">' +
          '<a class="logo" href="index.html">' + LOGO_MARK + logoText() + '</a>' +
          '<nav class="nav" id="site-nav">' +
            links.map(function (l) {
              return '<a class="nav__link' + (l.key === activeKey ? ' is-active' : '') + '" href="' + l.href + '"' +
                (l.key === activeKey ? ' aria-current="page"' : '') + '>' + t('nav.' + l.key) + '</a>';
            }).join('') +
            '<a class="nav__link nav__fav" href="account.html#favorites">' + icon('heart') + t('nav.favorites') + '</a>' +
            telLink(phone, icon('phone') + phone, 'nav__phone') +
          '</nav>' +
          '<div class="header__actions">' +
            telLink(phone, '<b>' + phone + '</b><small>' + t('header.phoneHint') + '</small>', 'header__phone') +
            langSwitch +
            '<a class="account-btn fav-link" href="account.html#favorites" id="fav-link" title="' + esc(t('nav.favorites')) + '">' + icon('heart') +
              '<span class="fav-link__count" id="fav-count"></span></a>' +
            '<a class="account-btn' + (page === 'account' ? ' is-active' : '') + '" href="account.html" aria-label="' + esc(t('nav.account')) + '" title="' + esc(t('nav.account')) + '"' +
              (page === 'account' ? ' aria-current="page"' : '') + '>' + icon('user') + '</a>' +
            '<a class="cart-btn' + (page === 'cart' ? ' is-active' : '') + '" href="cart.html" id="cart-btn">' + icon('cart') +
              '<span class="cart-btn__label">' + t('nav.cart') + '</span><span class="cart-btn__count" id="cart-count"></span></a>' +
            '<button class="burger" id="burger" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="' + esc(t('header.openMenu')) + '">' + icon('menu') + '</button>' +
          '</div>' +
        '</div>' +
      '</header>';

    var burger = document.getElementById('burger');
    var nav = document.getElementById('site-nav');
    burger.addEventListener('click', function () {
      var open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', t(open ? 'header.closeMenu' : 'header.openMenu'));
      burger.innerHTML = icon(open ? 'close' : 'menu');
    });

    var select = document.getElementById('lang-select');
    if (select) select.addEventListener('change', function () { setLang(select.value); });

    updateCartCount();
  }

  function updateCartCount() {
    var el = document.getElementById('cart-count');
    if (!el) return;
    var n = cart.count();
    el.textContent = n > 99 ? '99+' : n;
    el.hidden = n === 0;
    document.getElementById('cart-btn').setAttribute('aria-label', t('header.cartAria', { count: n }));
  }

  // Юридические страницы: ключ документа в texts.legal.docs → файл страницы
  var LEGAL_PAGES = { terms: 'terms.html', privacy: 'privacy.html', returns: 'returns.html', delivery: 'delivery.html' };

  // Обязательные для румынских магазинов ссылки: ANPC (SAL) и платформа SOL
  var DISPUTE_LINKS = {
    sal: 'https://anpc.ro/ce-este-sal/',
    sol: 'https://ec.europa.eu/consumers/odr'
  };

  function renderFooter() {
    var types = Object.keys(dict.types);
    var badges = ['sal', 'sol'].map(function (k) {
      return '<a class="trust-badge trust-badge--' + k + '" href="' + DISPUTE_LINKS[k] + '" target="_blank" rel="noopener" aria-label="' + esc(t('legal.badges.' + k + '.aria')) + '">' +
        '<span class="trust-badge__mark">' + t('legal.badges.' + k + '.title') + '</span>' +
        '<span class="trust-badge__text">' + t('legal.badges.' + k + '.text') + '</span></a>';
    }).join('');

    document.getElementById('site-footer').innerHTML =
      '<footer class="footer">' +
        '<div class="container footer__grid">' +
          '<div class="footer__about">' +
            '<a class="logo logo--light" href="index.html">' + LOGO_MARK + logoText() + '</a>' +
            '<p>' + t('footer.about') + '</p>' +
          '</div>' +
          '<div><h4>' + t('footer.catalogTitle') + '</h4><ul>' +
            types.map(function (k) { return '<li><a href="catalog.html?type=' + k + '">' + t('types.' + k) + '</a></li>'; }).join('') +
          '</ul></div>' +
          '<div><h4>' + t('footer.infoTitle') + '</h4><ul>' +
            Object.keys(LEGAL_PAGES).map(function (k) {
              return '<li><a href="' + LEGAL_PAGES[k] + '">' + t('legal.nav.' + k) + '</a></li>';
            }).join('') +
            '<li><a href="contacts.html#faq">' + t('footer.info.faq') + '</a></li>' +
            '<li><button class="footer__link-btn" type="button" data-cookie-settings>' + t('cookies.settings') + '</button></li>' +
          '</ul></div>' +
          '<div><h4>' + t('footer.contactsTitle') + '</h4><ul class="footer__contacts">' +
            '<li>' + icon('phone') + telLink(t('header.phone'), t('header.phone')) + '</li>' +
            '<li>' + icon('mail') + '<a href="mailto:' + t('footer.email') + '">' + t('footer.email') + '</a></li>' +
            '<li>' + icon('pin') + t('footer.address') + ', ' + t('footer.country') + '</li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="container footer__legal">' +
          '<p class="footer__seller">' + esc(t('footer.seller', lookup('legal.seller'))) + '</p>' +
          '<div class="footer__badges">' + badges + '</div>' +
        '</div>' +
        '<div class="container footer__bottom">' +
          '<span>' + t('footer.rights', { year: new Date().getFullYear() }) + '</span>' +
          '<span>' + t('footer.demo') + '</span>' +
        '</div>' +
      '</footer>';
  }

  /* ---------- Согласие на cookies ---------- */

  // Сайт хранит в браузере только необходимое (корзина, язык, этот выбор).
  // Внешний шрифт Google Fonts передаёт Google IP-адрес, поэтому грузим его только с согласия.
  var CONSENT_KEY = 'thermo.consent';
  var CONSENT_VERSION = 1;
  var FONT_URL = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';

  function getConsent() {
    var c = storage.get(CONSENT_KEY, null);
    return c && c.v === CONSENT_VERSION ? c : null;
  }

  function setFonts(enabled) {
    var existing = document.querySelectorAll('[data-external-font]');
    if (!enabled) { existing.forEach(function (el) { el.remove(); }); return; }
    if (existing.length) return;
    [['preconnect', 'https://fonts.googleapis.com'], ['preconnect', 'https://fonts.gstatic.com', true], ['stylesheet', FONT_URL]]
      .forEach(function (l) {
        var link = document.createElement('link');
        link.rel = l[0];
        link.href = l[1];
        if (l[2]) link.crossOrigin = '';
        link.setAttribute('data-external-font', '');
        document.head.appendChild(link);
      });
  }

  function hideCookieBanner() {
    var el = document.getElementById('cookie-banner');
    if (el) el.remove();
  }

  function showCookieBanner() {
    hideCookieBanner();
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.className = 'cookie';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'cookie-title');
    el.setAttribute('aria-describedby', 'cookie-text');
    el.innerHTML =
      '<div class="cookie__body">' +
        '<h2 class="cookie__title" id="cookie-title">' + t('cookies.title') + '</h2>' +
        '<p class="cookie__text" id="cookie-text">' + t('cookies.text') + ' <a href="' + LEGAL_PAGES.privacy + '#cookies">' + t('cookies.more') + '</a></p>' +
      '</div>' +
      '<div class="cookie__actions">' +
        // Кнопки равнозначны: отказ не сложнее согласия
        '<button class="btn btn--ghost" type="button" data-consent="necessary">' + t('cookies.necessaryOnly') + '</button>' +
        '<button class="btn btn--primary" type="button" data-consent="all">' + t('cookies.acceptAll') + '</button>' +
      '</div>';
    document.body.appendChild(el);
  }

  document.addEventListener('click', function (e) {
    var choice = e.target.closest('[data-consent]');
    if (choice) {
      var value = choice.getAttribute('data-consent');
      storage.set(CONSENT_KEY, { v: CONSENT_VERSION, choice: value, date: new Date().toISOString() });
      setFonts(value === 'all');
      hideCookieBanner();
      return;
    }
    if (e.target.closest('[data-cookie-settings]')) showCookieBanner();
  });

  function initConsent() {
    var c = getConsent();
    setFonts(!!c && c.choice === 'all');
    if (!c) showCookieBanner();
  }


  /* ---------- Глобальные обработчики ---------- */

  // Счётчик избранного в шапке
  function updateFavCount() {
    var el = document.getElementById('fav-count');
    if (!el) return;
    var n = favorites.read().length;
    el.textContent = n || '';
    el.hidden = !n;
    document.getElementById('fav-link').setAttribute('aria-label', t('favorites.headerAria', { count: n }));
  }
  document.addEventListener('favorites:change', updateFavCount);
  window.addEventListener('storage', function (e) {
    if (e.key === FAV_KEY) document.dispatchEvent(new CustomEvent('favorites:change'));
  });

  // Сердечко: добавить в избранное или убрать
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-fav');
    var on = favorites.toggle(id);
    syncFavButtons(id);
    if (on) {
      btn.classList.remove('is-pop');
      void btn.offsetWidth; // анимация «пульса» заново
      btn.classList.add('is-pop');
    }
    toast(t(on ? 'favorites.added' : 'favorites.removed'), on ? { href: 'account.html#favorites', label: t('favorites.open') } : null);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    var id = btn.getAttribute('data-add-to-cart');
    var qty = parseInt(btn.getAttribute('data-qty') || '1', 10);
    cart.add(id, qty);
    btn.classList.add('is-in-cart');
    var label = btn.querySelector('span');
    if (label) {
      btn.querySelector('svg').outerHTML = icon('check');
      label.textContent = t('common.inCart');
    }
    if (page !== 'cart') toast(t('common.added'), { href: 'cart.html', label: t('common.goToCart') });
  });

  // Степпер: кнопки +/− и ручной ввод. Наружу отдаёт событие stepper:change.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.stepper__btn');
    if (!b) return;
    var input = b.parentNode.querySelector('.stepper__input');
    var v = Math.max(1, Math.min(99, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute('data-step'), 10)));
    input.value = v;
    b.parentNode.dispatchEvent(new CustomEvent('stepper:change', { bubbles: true, detail: v }));
  });
  document.addEventListener('change', function (e) {
    if (!e.target.classList.contains('stepper__input')) return;
    var v = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
    e.target.value = v;
    e.target.parentNode.dispatchEvent(new CustomEvent('stepper:change', { bubbles: true, detail: v }));
  });

  document.addEventListener('cart:change', updateCartCount);
  // Корзина изменилась в другой вкладке
  window.addEventListener('storage', function (e) {
    if (e.key === CART_KEY) document.dispatchEvent(new CustomEvent('cart:change'));
  });

  /* ---------- Запуск ---------- */

  document.documentElement.lang = dict.meta.lang;
  if (dict.pages[page]) document.title = t('pages.' + page);
  renderHeader();
  updateFavCount();
  renderFooter();
  applyTranslations();
  initConsent();

  window.App = {
    t: t,
    plural: plural,
    lang: lang,
    dict: dict,
    applyTranslations: applyTranslations,
    formatPrice: formatPrice,
    formatNumber: formatNumber,
    formatPower: formatPower,
    formatConsumption: formatConsumption,
    priceLabel: priceLabel,
    areaLabel: areaLabel,
    certBadges: certBadges,
    warningNote: warningNote,
    warningBlock: warningBlock,
    esc: esc,
    telLink: telLink,
    icon: icon,
    products: products,
    getProduct: getProduct,
    isHeater: isHeater,
    productText: productText,
    productUrl: productUrl,
    heaterSVG: heaterSVG,
    favorites: favorites,
    favButton: favButton,
    syncFavButtons: syncFavButtons,
    updateFavCount: updateFavCount,
    productImage: productImage,
    productCard: productCard,
    priceBlock: priceBlock,
    addButton: addButton,
    stepper: stepper,
    breadcrumbs: breadcrumbs,
    toast: toast,
    cart: cart,
    legalPages: LEGAL_PAGES,
    lookup: lookup,
    interpolate: interpolate,
    params: new URLSearchParams(window.location.search)
  };
})();
