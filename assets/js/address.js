/*
 * Адрес доставки — общая форма для личного кабинета и корзины. Добавляет App.address.
 * Подключается после app.js. Справочники городов и индексов (assets/js/geo/<код>.js,
 * источник — GeoNames) загружаются только для выбранной страны.
 *
 * Поля формы называются как столбцы в базе: country, region, city, postal_code, address (улица),
 * house, apartment, floor, building, recipient_name, recipient_phone, company, vat_id, delivery_note.
 */
(function () {
  'use strict';
  var A = window.App;
  var t = A.t;
  var C = A.countries;

  var FIELDS = ['country', 'region', 'city', 'postal_code', 'address', 'house', 'apartment', 'floor', 'building',
    'recipient_name', 'recipient_phone', 'company', 'vat_id', 'delivery_note'];
  var GEO_VERSION = 2; // увеличить после пересборки справочников (tools/build_geo.py)
  var MAX_SUGGEST = 50;  // при вводе
  var MAX_BROWSE = 600;  // при просмотре списка (все места региона)
  var TOP_PLACES = 60;   // без региона — крупные места

  /* ---------- Справочники (GeoNames) ---------- */

  var geoCache = {};   // код → { regions, places: [{ name, key, region }], codes: { индекс: [места] } }
  var geoWaiting = {}; // код → [колбэки], пока файл грузится

  // Для поиска без учёта регистра и диакритики: «Botoşani», «botosani» и «BOTOȘANI» — одно и то же
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().trim();
  }

  function decode(raw) {
    var places = raw.places.split('|').map(function (s) {
      var parts = s.split('~');
      return { name: parts[0], key: norm(parts[0]), region: parts.length > 1 ? parseInt(parts[1], 36) : -1, codes: [] };
    });
    var codes = {};
    var prev = 0;
    raw.postal.split(',').forEach(function (entry) {
      var parts = entry.split('.');
      prev += parseInt(parts[0], 36);
      var code = String(prev);
      while (code.length < raw.postalLength) code = '0' + code;
      codes[code] = parts.slice(1).map(function (p) {
        var i = parseInt(p, 36);
        places[i].codes.push(code);
        return i;
      });
    });
    return { regions: raw.regions, places: places, codes: codes };
  }

  /** Загружает справочник страны; cb(geo) или cb(null), если справочника нет. */
  function loadGeo(code, cb) {
    var c = C.get(code);
    if (!c || !c.geo) { cb(null); return; }
    if (geoCache[code]) { cb(geoCache[code]); return; }
    if (window.GEO && window.GEO[code]) { geoCache[code] = decode(window.GEO[code]); cb(geoCache[code]); return; }
    if (geoWaiting[code]) { geoWaiting[code].push(cb); return; }
    geoWaiting[code] = [cb];
    var s = document.createElement('script');
    s.src = 'assets/js/geo/' + code + '.js?v=' + GEO_VERSION;
    s.onload = s.onerror = function () {
      var geo = window.GEO && window.GEO[code] ? decode(window.GEO[code]) : null;
      if (geo) geoCache[code] = geo;
      geoWaiting[code].forEach(function (f) { f(geo); });
      delete geoWaiting[code];
    };
    document.head.appendChild(s);
  }

  /* ---------- Разметка ---------- */

  function label(id, text, required) {
    return '<label class="field__label" for="' + id + '">' + text +
      (required ? ' <span class="req" title="' + A.esc(t('common.required')) + '">*</span>' : '') + '</label>';
  }

  function input(p, name, opts) {
    opts = opts || {};
    var id = p + '-' + name;
    var control = opts.textarea
      ? '<textarea class="input" id="' + id + '" name="' + name + '" rows="2"' +
          (opts.placeholder ? ' placeholder="' + A.esc(opts.placeholder) + '"' : '') + '></textarea>'
      : '<input class="input" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' +
          (opts.placeholder ? ' placeholder="' + A.esc(opts.placeholder) + '"' : '') +
          (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') +
          (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '>';
    return '<div class="field' + (opts.wide ? ' field--wide' : '') + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.attrs || '') + '>' +
      label(id, t('address.form.' + (opts.label || name)), opts.required) + (opts.before || '') + control + (opts.after || '') +
      '<span class="field__hint" data-hint-for="' + name + '"' + (opts.hint ? '' : ' hidden') + '>' + (opts.hint || '') + '</span>' +
      '<span class="field__error" data-error-for="' + name + '"></span></div>';
  }

  /** Разметка блока адреса; p — префикс id полей (например, «addr»); opts.title: false — без заголовка. */
  function fields(p, opts) {
    opts = opts || {};
    var regionId = p + '-region';
    return (opts.title === false ? '' : '<h3 class="form__section field--wide">' + t('address.sections.place') + '</h3>') +
      '<div class="field field--wide">' + label(p + '-country', t('address.form.country'), true) +
        '<select class="input" id="' + p + '-country" name="country" autocomplete="country">' + C.options(C.fallback()) + '</select></div>' +
      '<div class="field" data-region-field>' + label(regionId, t('address.form.region'), true) +
        '<select class="input" id="' + regionId + '" name="region" autocomplete="address-level1"></select>' +
        '<span class="field__error" data-error-for="region"></span></div>' +
      input(p, 'city', {
        required: true, autocomplete: 'off', placeholder: t('address.form.cityPlaceholder'),
        cls: 'suggest-field', after: '<div class="suggest" id="' + p + '-city-suggest" role="listbox" hidden></div>'
      }) +
      input(p, 'postal_code', { label: 'postalCode', required: true, autocomplete: 'postal-code' }) +
      input(p, 'address', { label: 'street', required: true, autocomplete: 'address-line1', placeholder: t('address.form.streetPlaceholder') }) +
      input(p, 'house', { required: true, placeholder: t('address.form.housePlaceholder') }) +
      input(p, 'apartment', { autocomplete: 'address-line2', placeholder: t('address.form.apartmentPlaceholder') }) +
      input(p, 'floor', { inputmode: 'numeric', placeholder: t('address.form.floorPlaceholder') }) +
      '<div class="field">' + label(p + '-building', t('address.form.building')) +
        '<select class="input" id="' + p + '-building" name="building">' +
          '<option value="">' + t('address.form.buildingChoose') + '</option>' +
          ['house', 'elevator', 'stairs'].map(function (k) { return '<option value="' + k + '">' + t('address.form.buildings.' + k) + '</option>'; }).join('') +
        '</select></div>' +
      '<p class="field__hint field--wide address__note">' + A.icon('alert') + t('address.form.buildingHint') + '</p>' +
      input(p, 'delivery_note', { wide: true, textarea: true, label: 'deliveryNote', placeholder: t('address.form.deliveryNotePlaceholder') }) +

      '<h3 class="form__section field--wide">' + t('address.sections.recipient') + '</h3>' +
      '<label class="check field--wide"><input type="checkbox" data-toggle="recipient"><span>' + t('address.form.recipientOther') + '</span></label>' +
      input(p, 'recipient_name', { label: 'recipientName', required: true, autocomplete: 'off', attrs: ' data-group="recipient" hidden' }) +
      input(p, 'recipient_phone', { label: 'recipientPhone', required: true, type: 'tel', autocomplete: 'off', attrs: ' data-group="recipient" hidden' }) +

      '<h3 class="form__section field--wide">' + t('address.sections.invoice') + '</h3>' +
      '<label class="check field--wide"><input type="checkbox" data-toggle="invoice"><span>' + t('address.form.invoice') + '</span></label>' +
      input(p, 'company', { required: true, autocomplete: 'organization', attrs: ' data-group="invoice" hidden' }) +
      input(p, 'vat_id', { label: 'vatId', required: true, autocomplete: 'off', attrs: ' data-group="invoice" hidden' }) +

      '<p class="address__source field--wide">' +
        t('address.form.source', { link: '<a href="https://www.geonames.org" target="_blank" rel="noopener">GeoNames</a>' }) + '</p>';
  }

  /* ---------- Поведение формы ---------- */

  /**
   * Подключает подсказки и переключатели к форме с блоком fields().
   * Возвращает объект с методом fill(data) — заполнить сохранёнными данными.
   */
  function bind(form) {
    var el = form.elements;
    var geo = null;
    var p = el.country.id.replace(/-country$/, '');
    var suggestBox = document.getElementById(p + '-city-suggest');
    var regionField = form.querySelector('[data-region-field]');
    var active = -1, shown = [];

    function country() { return el.country.value; }
    function hint(name, text) {
      var h = form.querySelector('[data-hint-for="' + name + '"]');
      if (!h) return;
      h.textContent = text || '';
      h.hidden = !text;
    }

    // Регион: список из справочника; сохранённое ранее значение показываем, даже если его нет в списке
    function fillRegions(keep) {
      var c = C.get(country()) || {};
      regionField.hidden = !c.region;
      regionField.querySelector('label').firstChild.textContent = (C.text(country(), 'region') || t('address.form.region')) + ' ';
      // Есть справочник — выбор из списка, нет — обычное поле ввода
      var control = el.region;
      var wantSelect = !!c.geo;
      if ((control.tagName === 'SELECT') !== wantSelect) {
        var next = document.createElement(wantSelect ? 'select' : 'input');
        next.className = 'input';
        next.id = control.id;
        next.name = 'region';
        next.autocomplete = 'address-level1';
        control.parentNode.replaceChild(next, control);
        control = next;
      }
      if (!wantSelect) {
        control.placeholder = C.text(country(), 'regionPlaceholder');
        control.value = keep || '';
        return;
      }
      var list = geo ? geo.regions.slice() : [];
      if (keep && list.indexOf(keep) === -1) list.unshift(keep);
      control.innerHTML = '<option value="">' + t('address.form.regionChoose') + '</option>' +
        list.map(function (r) { return '<option value="' + A.esc(r) + '">' + A.esc(r) + '</option>'; }).join('');
      control.value = keep || '';
      control.disabled = !list.length; // пока грузится справочник
    }

    function applyCountry(keep) {
      keep = keep || {};
      var code = country();
      el.postal_code.placeholder = t('address.form.postalCodePlaceholder', { example: C.text(code, 'postalExample') });
      el.vat_id.placeholder = t('address.form.vatPlaceholder', { example: C.text(code, 'vatExample') });
      form.querySelector('label[for="' + el.vat_id.id + '"]').firstChild.textContent = (C.text(code, 'vat') || t('address.form.vatId')) + ' ';
      hint('postal_code', '');
      geo = null;
      fillRegions(keep.region);
      loadGeo(code, function (g) {
        if (country() !== code) return; // пока грузилось, выбрали другую страну
        geo = g;
        fillRegions(keep.region || el.region.value);
      });
    }

    /* Подсказки городов */

    function regionName(pl) { return geo && pl.region >= 0 ? geo.regions[pl.region] : ''; }

    function byName(x, y) { return x.key.localeCompare(y.key); }

    function regionIndex() { return geo && el.region.value ? geo.regions.indexOf(el.region.value) : -1; }

    /** Список как у выпадающего меню: все места выбранного региона по алфавиту, без региона — крупные места. */
    function browsePlaces() {
      if (!geo) return [];
      var ri = regionIndex();
      if (ri >= 0) {
        // Сначала города региона (несколько индексов, по размеру), дальше все места по алфавиту
        var inRegion = geo.places.filter(function (pl) { return pl.region === ri; });
        var cities = inRegion.filter(function (pl) { return pl.codes.length >= 3; })
          .sort(function (x, y) { return y.codes.length - x.codes.length; });
        var rest = inRegion.filter(function (pl) { return cities.indexOf(pl) === -1; }).sort(byName);
        return cities.concat(rest).slice(0, MAX_BROWSE);
      }
      // Крупные места — у них несколько индексов (у сёл обычно один)
      var big = geo.places.filter(function (pl) { return pl.codes.length >= 3; });
      return big.sort(function (x, y) { return y.codes.length - x.codes.length; }).slice(0, TOP_PLACES).sort(byName);
    }

    function findPlaces(q) {
      var key = norm(q);
      if (!geo) return [];
      if (!key) return browsePlaces();
      var regionIdx = regionIndex();
      var starts = [], contains = [];
      for (var i = 0; i < geo.places.length; i++) {
        var pl = geo.places[i];
        var at = pl.key.indexOf(key);
        if (at === -1) continue;
        (at === 0 ? starts : contains).push(pl);
      }
      // Сначала крупные места (у них больше индексов), затем точное совпадение, потом по алфавиту
      var rank = function (x, y) {
        return y.codes.length - x.codes.length || (y.key === key) - (x.key === key) || x.key.localeCompare(y.key);
      };
      var list = starts.sort(rank).concat(contains.sort(rank));
      // Если регион выбран — сначала места из него
      if (regionIdx >= 0) {
        list = list.filter(function (pl) { return pl.region === regionIdx; })
          .concat(list.filter(function (pl) { return pl.region !== regionIdx; }));
      }
      return list.slice(0, MAX_SUGGEST);
    }

    function renderSuggest() {
      if (!shown.length) { closeSuggest(); return; }
      suggestBox.innerHTML = shown.map(function (pl, i) {
        var meta = [regionName(pl), pl.codes.length === 1 ? t('address.suggest.postal', { code: pl.codes[0] }) :
          t('address.suggest.postalMany', { count: pl.codes.length })].filter(Boolean).join(' · ');
        return '<button type="button" class="suggest__item' + (i === active ? ' is-active' : '') + '" role="option" data-i="' + i + '"' +
          ' aria-selected="' + (i === active) + '"><b>' + A.esc(pl.name) + '</b><span>' + A.esc(meta) + '</span></button>';
      }).join('');
      suggestBox.hidden = false;
      el.city.setAttribute('aria-expanded', 'true');
      var cur = suggestBox.querySelector('.is-active');
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    }

    // Открыть список целиком (по клику или стрелке вниз); текущий город — выделен
    function openList(fromKeyboard) {
      if (!geo) return;
      shown = browsePlaces();
      var cityKey = norm(el.city.value);
      active = shown.findIndex(function (pl) { return pl.key === cityKey; });
      if (active < 0 && fromKeyboard === true) active = 0;
      renderSuggest();
    }
    function closeSuggest() {
      suggestBox.hidden = true;
      suggestBox.innerHTML = '';
      active = -1;
      el.city.setAttribute('aria-expanded', 'false');
    }

    function pickPlace(pl) {
      el.city.value = pl.name;
      if (pl.region >= 0) el.region.value = geo.regions[pl.region];
      if (pl.codes.length === 1) {
        el.postal_code.value = pl.codes[0];
        hint('postal_code', '');
      } else if (pl.codes.indexOf(el.postal_code.value.trim()) === -1) {
        el.postal_code.value = '';
        hint('postal_code', t('address.hints.postalMany'));
      }
      closeSuggest();
    }

    el.city.setAttribute('role', 'combobox');
    el.city.setAttribute('aria-autocomplete', 'list');
    el.city.setAttribute('aria-controls', suggestBox.id);
    el.city.setAttribute('aria-expanded', 'false');
    el.city.addEventListener('input', function () { active = -1; shown = findPlaces(el.city.value); renderSuggest(); });
    el.city.addEventListener('focus', function () { openList(); });
    el.city.addEventListener('click', function () { if (suggestBox.hidden) openList(); });
    el.city.addEventListener('keydown', function (e) {
      if (suggestBox.hidden) {
        if (e.key === 'ArrowDown') { e.preventDefault(); openList(true); }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        renderSuggest();
      } else if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        pickPlace(shown[active]);
      } else if (e.key === 'Escape') {
        closeSuggest();
      }
    });
    el.city.addEventListener('blur', function () { setTimeout(closeSuggest, 150); });
    suggestBox.addEventListener('mousedown', function (e) { e.preventDefault(); }); // не терять фокус поля
    suggestBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]');
      if (b) pickPlace(shown[+b.getAttribute('data-i')]);
    });

    form.addEventListener('change', function (e) {
      if (e.target.name !== 'region') return;
      var ri = regionIndex();
      var cityKey = norm(el.city.value);
      if (!geo || !cityKey || ri < 0) return;
      var inRegion = geo.places.some(function (pl) { return pl.key === cityKey && pl.region === ri; });
      if (!inRegion) { el.city.value = ''; el.postal_code.value = ''; hint('postal_code', ''); }
    });

    /* Индекс → город и регион */

    el.postal_code.addEventListener('input', function () {
      var code = el.postal_code.value.trim().toUpperCase();
      hint('postal_code', '');
      if (!geo || !C.postalValid(country(), code)) return;
      var digits = code.replace(/\D/g, '');
      var ids = geo.codes[code] || geo.codes[digits];
      if (!ids) { hint('postal_code', t('address.hints.postalUnknown', { code: code })); return; }
      var places = ids.map(function (i) { return geo.places[i]; });
      var cityKey = norm(el.city.value);
      var match = places.find(function (pl) { return pl.key === cityKey; });
      if (match || !cityKey) {
        var pl = match || places[0];
        if (!cityKey) el.city.value = pl.name;
        if (pl.region >= 0) el.region.value = geo.regions[pl.region];
        if (!match && places.length > 1) {
          hint('postal_code', t('address.hints.postalOther', { code: code, places: places.map(function (x) { return x.name; }).join(', ') }));
        }
      } else {
        hint('postal_code', t('address.hints.postalOther', { code: code, places: places.map(function (x) { return x.name; }).join(', ') }));
      }
    });

    /* Страна, переключатели «получатель» и «счёт на фирму» */

    el.country.addEventListener('change', function () {
      el.region.value = '';
      el.postal_code.value = '';
      applyCountry();
    });

    function toggleGroup(name, on) {
      form.querySelector('[data-toggle="' + name + '"]').checked = on;
      form.querySelectorAll('[data-group="' + name + '"]').forEach(function (f) { f.hidden = !on; });
    }
    form.querySelectorAll('[data-toggle]').forEach(function (box) {
      box.addEventListener('change', function () { toggleGroup(box.getAttribute('data-toggle'), box.checked); });
    });

    applyCountry();

    return {
      /** Заполняет форму сохранёнными данными (поля, которых нет, не трогает). */
      fill: function (data, onlyEmpty) {
        data = data || {};
        if (data.country && C.list.some(function (c) { return c.code === data.country; })) {
          el.country.innerHTML = C.options(data.country);
        }
        FIELDS.forEach(function (n) {
          if (n === 'country' || n === 'region' || !data[n]) return;
          if (onlyEmpty && el[n].value) return;
          el[n].value = data[n];
        });
        applyCountry({ region: data.country === country() ? data.region : '' });
        if (data.recipient_name || data.recipient_phone) toggleGroup('recipient', true);
        if (data.company || data.vat_id) toggleGroup('invoice', true);
      }
    };
  }

  /* ---------- Проверка и чтение ---------- */

  function groupOn(form, name) {
    var box = form.querySelector('[data-toggle="' + name + '"]');
    return !!box && box.checked;
  }

  /** Ошибки адреса: { поле: текст }. */
  function validate(form) {
    var el = form.elements;
    var v = function (n) { return el[n].value.trim(); };
    var code = v('country');
    var c = C.get(code) || {};
    var e = {};
    if (!v('city')) e.city = t('address.errors.city');
    if (c.region && !v('region')) e.region = t('address.errors.region');
    if (!C.postalValid(code, v('postal_code'))) {
      e.postal_code = t('address.errors.postalCode', { format: C.text(code, 'postalFormat'), example: C.text(code, 'postalExample') });
    }
    if (!v('address')) e.address = t('address.errors.street');
    if (!v('house')) e.house = t('address.errors.house');
    if (groupOn(form, 'recipient')) {
      if (!v('recipient_name')) e.recipient_name = t('address.errors.recipientName');
      if (v('recipient_phone').replace(/\D/g, '').length < 9) e.recipient_phone = t('address.errors.recipientPhone');
    }
    if (groupOn(form, 'invoice')) {
      if (!v('company')) e.company = t('address.errors.company');
      if (v('vat_id').replace(/[^0-9A-Za-z]/g, '').length < 4) e.vat_id = t('address.errors.vatId');
    }
    return e;
  }

  /** Данные адреса для сохранения; скрытые группы — пустые. */
  function read(form) {
    var el = form.elements;
    var d = {};
    FIELDS.forEach(function (n) { d[n] = el[n].value.trim(); });
    d.postal_code = d.postal_code.toUpperCase();
    if (!(C.get(d.country) || {}).region) d.region = '';
    if (!groupOn(form, 'recipient')) { d.recipient_name = ''; d.recipient_phone = ''; }
    if (!groupOn(form, 'invoice')) { d.company = ''; d.vat_id = ''; }
    return d;
  }

  A.address = { fields: fields, bind: bind, validate: validate, read: read, FIELDS: FIELDS, loadGeo: loadGeo, norm: norm };
})();
