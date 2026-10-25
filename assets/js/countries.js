/*
 * Страны доставки — только данные (названия и подписи — в texts.js → countries[код]).
 *
 * code    — код страны ISO (2 буквы), так он хранится в базе (profiles.country, orders.country).
 * enabled — доставляем ли в эту страну: только такие страны видны в адресе и при заказе.
 * postal  — формат почтового индекса (регулярное выражение, без учёта регистра).
 * region  — есть ли поле «регион» (уезд, провинция, область…); подпись — в texts.js.
 * geo     — есть справочник городов и индексов assets/js/geo/<код>.js (собирается tools/build_geo.py
 *           из GeoNames): подсказки городов, регион из списка, город по индексу.
 *
 * Как добавить страну: поставить enabled: true (или добавить запись) и проверить, что в
 * texts.js → countries есть её название и подписи. Первая включённая страна — по умолчанию.
 */
window.COUNTRIES = [
  { code: 'RO', enabled: true, geo: true, postal: '^\\d{6}$', region: true },
  { code: 'DE', enabled: true, geo: true, postal: '^\\d{5}$' },
  { code: 'CH', enabled: true, geo: true, postal: '^\\d{4}$', region: true },
  { code: 'IT', enabled: true, geo: true, postal: '^\\d{5}$', region: true },

  // Подготовлены, но выключены — включить, когда начнётся доставка
  { code: 'MD', enabled: false, postal: '^(MD-?)?\\d{4}$', region: true },
  { code: 'AT', enabled: false, postal: '^\\d{4}$' },
  { code: 'FR', enabled: false, postal: '^\\d{5}$' },
  { code: 'ES', enabled: false, postal: '^\\d{5}$', region: true },
  { code: 'BG', enabled: false, postal: '^\\d{4}$', region: true },
  { code: 'HU', enabled: false, postal: '^\\d{4}$' },
  { code: 'PL', enabled: false, postal: '^\\d{2}-\\d{3}$' },
  { code: 'NL', enabled: false, postal: '^\\d{4} ?[A-Z]{2}$' },
  { code: 'BE', enabled: false, postal: '^\\d{4}$' }
];
