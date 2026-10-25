(function () {
  'use strict';
  var A = window.App;
  var t = A.t;
  var root = document.getElementById('legal-root');
  var key = document.body.getAttribute('data-doc');
  var doc = A.lookup('legal.docs.' + key);
  if (!doc) return;

  // Подстановки в тексты: данные продавца и название магазина
  var vars = Object.assign({ name: t('brand.name'), countries: A.countries.names() }, A.lookup('legal.seller'));
  function fill(str) { return A.esc(A.interpolate(str, vars)); }

  document.title = t('pages.legal', { title: doc.title });

  var sections = doc.sections.map(function (s) {
    return '<section class="legal__section"' + (s.anchor ? ' id="' + s.anchor + '"' : '') + '>' +
      '<h2>' + fill(s.title) + '</h2>' +
      (s.paragraphs || []).map(function (p) { return '<p>' + fill(p) + '</p>'; }).join('') +
      (s.list ? '<ul>' + s.list.map(function (li) { return '<li>' + fill(li) + '</li>'; }).join('') + '</ul>' : '') +
    '</section>';
  }).join('');

  // Образец формы отказа (для страницы возврата)
  var form = doc.form
    ? '<section class="legal__form" id="withdrawal-form">' +
        '<h2>' + t('legal.formTitle') + '</h2>' +
        '<p class="muted">' + t('legal.formNote') + '</p>' +
        '<div class="legal__form-body">' + doc.form.map(function (line) { return '<p>' + fill(line) + '</p>'; }).join('') + '</div>' +
      '</section>'
    : '';

  var sellerRows = t('legal.sellerRows').map(function (r) {
    return '<div><dt>' + A.esc(r.label) + '</dt><dd>' + A.esc(vars[r.key]) + '</dd></div>';
  }).join('');

  var nav = Object.keys(A.legalPages).map(function (k) {
    var active = k === key;
    return '<li><a href="' + A.legalPages[k] + '"' + (active ? ' class="is-active" aria-current="page"' : '') + '>' + t('legal.nav.' + k) + '</a></li>';
  }).join('');

  root.innerHTML =
    A.breadcrumbs([{ label: t('nav.home'), href: 'index.html' }, { label: doc.title }]) +
    '<div class="legal">' +
      '<article class="legal__doc">' +
        '<h1 class="page__title">' + A.esc(doc.title) + '</h1>' +
        '<p class="legal__updated">' + t('legal.updated', { date: t('legal.updatedDate') }) + '</p>' +
        '<p class="lead">' + fill(doc.intro) + '</p>' +
        sections + form +
      '</article>' +
      '<aside class="legal__aside">' +
        '<nav class="panel legal__nav" aria-label="' + A.esc(t('legal.docsTitle')) + '"><h2>' + t('legal.docsTitle') + '</h2><ul>' + nav + '</ul></nav>' +
        '<div class="panel legal__seller"><h2>' + t('legal.sellerTitle') + '</h2><dl>' + sellerRows + '</dl></div>' +
      '</aside>' +
    '</div>';
})();
