/*
 * Данные товаров без текстов. Названия лежат в texts.js → products[id],
 * описания собираются из шаблонов texts.js → productTemplates[type].
 *
 * price — в валюте из texts.js → meta.currency; 0 означает «цена уточняется».
 * power и consumption — в ваттах (consumption — среднее потребление, Вт/ч).
 * dimensions — габариты в мм, weight — кг, area — м² (null — «уточняется»).
 * current — номинальный ток, А. sections — число секций радиатора.
 * warnings — предупреждения на странице товара (тексты в texts.js → warnings).
 */

/* Общее для напольных, с вентиляцией и встраиваемых в пол (см. HEATER_COMMON_TYPES) */
window.HEATER_COMMON_TYPES = ['floor', 'ventilated', 'inFloor'];
window.HEATER_COMMON = {
  body: 'metal',
  control: 'touchWifi',
  voltage: 220,
  frequency: 50,
  network: 'single',
  lifetime: [30, 50],
  ceiling: 2.8,
  features: ['metal', 'touch', 'wifi']
};

/* Общее для всех товаров категории. certs — отметки сертификатов (тексты в texts.js → certs) */
window.CATEGORY_COMMON = {
  floor: { deviceType: 'condensedSteam', certs: ['ce'] },
  ventilated: { deviceType: 'condensedSteam', certs: ['ce'] },
  inFloor: { deviceType: 'condensedSteam' },
  aluminum: { deviceType: 'condensedSteam', certs: ['ce'] }
};

window.PRODUCTS = [
  /* Напольные */
  { id: 'pkn-0-5', type: 'floor', mount: 'floor', price: 0, order: 1,
    area: 7, power: 500, current: 2.2, consumption: 85, dimensions: [600, 150, 120], weight: 10 },
  { id: 'pkn-1', type: 'floor', mount: 'floor', price: 0, order: 2,
    area: 14, power: 1000, current: 4.5, consumption: 170, dimensions: [600, 400, 150], weight: 20 },
  { id: 'pkn-2', type: 'floor', mount: 'floor', price: 0, order: 3,
    area: 27, power: 2000, current: 9.1, consumption: 335, dimensions: [1200, 400, 150], weight: 30 },
  { id: 'pkn-3', type: 'floor', mount: 'floor', price: 0, order: 4,
    area: 40, power: 3000, current: 13.6, consumption: 535, dimensions: [1080, 540, 150], weight: 43 },

  /* С вентиляцией */
  { id: 'pkn-2v', type: 'ventilated', mount: 'floor', price: 0, order: 5,
    area: 55, power: 2000, current: 9.1, consumption: 1000, dimensions: [1280, 400, 150], weight: 35, extraFeatures: ['fan'] },
  { id: 'pkn-6v', type: 'ventilated', mount: 'floor', price: 0, order: 6,
    area: 200, power: 6000, current: 27.3, consumption: 3000, dimensions: [1330, 350, 310], weight: 43, extraFeatures: ['fan'],
    warnings: ['separateLine'] },

  /* Встраиваемые в пол — характеристики как у напольных */
  { id: 'pkn-1-in', type: 'inFloor', mount: 'inFloor', price: 0, order: 7,
    area: 14, power: 1000, current: 4.5, consumption: 170, dimensions: [600, 400, 150], weight: 20 },
  { id: 'pkn-2-in', type: 'inFloor', mount: 'inFloor', price: 0, order: 8,
    area: 27, power: 2000, current: 9.1, consumption: 335, dimensions: [1200, 400, 150], weight: 30 },
  { id: 'pkn-3-in', type: 'inFloor', mount: 'inFloor', price: 0, order: 9,
    area: 40, power: 3000, current: 13.6, consumption: 535, dimensions: [1080, 540, 150], weight: 43 },

  /* Алюминиевые радиаторы. Мощность и число секций — из названия модели;
     габариты и вес, где не указаны, — «уточняются» */
  { id: 'pkn-3-0-42-4', type: 'aluminum', price: 0, order: 10, sections: 4, power: 420, current: 1.9, area: null },
  { id: 'pkn-3-0-6-6', type: 'aluminum', price: 0, order: 11, sections: 6, power: 600, current: 2.7, area: null },
  { id: 'pkn-3-0-85-8', type: 'aluminum', price: 0, order: 12, sections: 8, power: 850, current: 3.9, area: null },
  { id: 'pkn-3-1-0-10', type: 'aluminum', price: 0, order: 13, sections: 10, power: 1000, current: 4.5, area: null },
  { id: 'pkn-3-1-2-12', type: 'aluminum', price: 0, order: 14, sections: 12, power: 1200, current: 5.5, area: null },
  { id: 'pkn-3-1-4-14', type: 'aluminum', price: 0, order: 15, sections: 14, power: 1400, current: 6.4, area: null },
  { id: 'pkn-3-1-6-16', type: 'aluminum', price: 0, order: 16,
    sections: 16, power: 1600, current: 7.3, area: null, dimensions: [570, 1240, 100], weight: 22.1 },

  /* Аксессуары */
  { id: 'control-unit', type: 'accessory', price: 0, order: 20,
    cycles: 50000, range: [0, 30] }
];

// Подмешиваем общие характеристики категорий и серии
window.PRODUCTS.forEach(function (p) {
  function merge(src) { for (var k in src) if (p[k] === undefined) p[k] = src[k]; }
  merge(window.CATEGORY_COMMON[p.type] || {});
  if (window.HEATER_COMMON_TYPES.indexOf(p.type) !== -1) merge(window.HEATER_COMMON);
  p.features = (p.features || []).concat(p.extraFeatures || []);
  p.certs = p.certs || [];
  p.warnings = p.warnings || [];
});
