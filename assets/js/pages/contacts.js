(function () {
  'use strict';
  var A = window.App;
  var t = A.t;

  document.getElementById('crumbs').innerHTML = A.breadcrumbs([
    { label: t('nav.home'), href: 'index.html' },
    { label: t('nav.contacts') }
  ]);

  /* Карточки с контактами */
  document.getElementById('contact-cards').innerHTML = t('contacts.cards').map(function (c) {
    return '<div class="contact-card"><span class="benefit__icon">' + A.icon(c.icon) + '</span>' +
      '<div><h3>' + A.esc(c.title) + '</h3>' +
      c.lines.map(function (line) { return '<p>' + linkify(line, c.icon) + '</p>'; }).join('') +
      '</div></div>';
  }).join('');

  // Телефоны и почту делаем кликабельными
  function linkify(line, kind) {
    var safe = A.esc(line);
    if (kind === 'phone') {
      return A.telLink(line, safe);
    }
    if (kind === 'mail') {
      return safe.replace(/[\w.+-]+@[\w.-]+\.\w+/, function (m) { return '<a href="mailto:' + m + '">' + m + '</a>'; });
    }
    return safe;
  }

  /* Схематичная карта */
  document.getElementById('map').innerHTML =
    '<svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="600" height="400" class="map__bg"/>' +
      '<path class="map__park" d="M380 40h170v120H380z"/>' +
      '<path class="map__water" d="M0 320c90-30 160 20 260-10s170-40 340 0v90H0z"/>' +
      '<g class="map__road map__road--main"><path d="M0 200h600"/><path d="M300 0v400"/></g>' +
      '<g class="map__road"><path d="M0 90h600"/><path d="M120 0v320"/><path d="M470 0v330"/><path d="M0 270h600"/></g>' +
      '<g class="map__block">' +
        '<rect x="140" y="110" width="140" height="70" rx="6"/><rect x="320" y="110" width="130" height="70" rx="6"/>' +
        '<rect x="140" y="220" width="140" height="35" rx="6"/><rect x="320" y="220" width="130" height="35" rx="6"/>' +
        '<rect x="20" y="110" width="80" height="70" rx="6"/><rect x="20" y="10" width="80" height="60" rx="6"/>' +
        '<rect x="140" y="10" width="140" height="60" rx="6"/><rect x="490" y="220" width="100" height="35" rx="6"/>' +
      '</g>' +
    '</svg>' +
    '<div class="map__pin">' + A.icon('pin') + '</div>' +
    '<div class="map__label">' + A.icon('flame') + '<span>' + t('contacts.mapLabel') + '</span></div>';

  /* Вопросы и ответы */
  document.getElementById('faq-list').innerHTML = t('contacts.faq').map(function (f) {
    return '<details class="faq__item"><summary>' + A.esc(f.q) + A.icon('plus') + '</summary><p>' + A.esc(f.a) + '</p></details>';
  }).join('');

  /* Форма обратной связи */
  var form = document.getElementById('contact-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = {};
    ['name', 'contact', 'message'].forEach(function (n) {
      if (!form.elements[n].value.trim()) errors[n] = t('contacts.errors.' + n);
    });
    form.querySelectorAll('[data-error-for]').forEach(function (el) {
      var n = el.getAttribute('data-error-for');
      el.textContent = errors[n] || '';
      form.elements[n].classList.toggle('is-invalid', !!errors[n]);
      form.elements[n].setAttribute('aria-invalid', errors[n] ? 'true' : 'false');
    });
    var first = Object.keys(errors)[0];
    if (first) { form.elements[first].focus(); return; }

    // Демонстрация: сообщение никуда не отправляется
    form.reset();
    A.toast(t('contacts.sent'));
  });
})();
