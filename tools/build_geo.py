"""
Справочники адресов из GeoNames (почтовые индексы, CC BY 4.0, https://www.geonames.org).

Как обновить или добавить страну (код, например RO):
  1. Скачать https://download.geonames.org/export/zip/RO.zip и распаковать в <папка>/RO/RO.txt.
  2. Добавить код в список в конце файла и, если нужен регион, правило в region_of().
  3. python tools/build_geo.py <папка> assets/js/geo
  4. В countries.js поставить стране geo: true; в address.js увеличить GEO_VERSION.
Для каждой страны пишет assets/js/geo/<код>.js:
  window.GEO.<код> = { regions: [...], places: [[название, индекс региона], ...], postal: {индекс: [места]} }
"""
import json, os, re, sys

SRC = sys.argv[1]   # папка с распакованными <код>/<код>.txt
OUT = sys.argv[2]   # assets/js/geo

CH_NAMES = {
    'AG': 'Aargau', 'AI': 'Appenzell Innerrhoden', 'AR': 'Appenzell Ausserrhoden', 'BE': 'Bern',
    'BL': 'Basel-Landschaft', 'BS': 'Basel-Stadt', 'FR': 'Fribourg', 'GE': 'Genève', 'GL': 'Glarus',
    'GR': 'Graubünden', 'JU': 'Jura', 'LU': 'Luzern', 'NE': 'Neuchâtel', 'NW': 'Nidwalden',
    'OW': 'Obwalden', 'SG': 'St. Gallen', 'SH': 'Schaffhausen', 'SO': 'Solothurn', 'SZ': 'Schwyz',
    'TG': 'Thurgau', 'TI': 'Ticino', 'UR': 'Uri', 'VD': 'Vaud', 'VS': 'Valais', 'ZG': 'Zug', 'ZH': 'Zürich'
}
IT_FIX = {
    'FC': 'Forlì-Cesena', 'PU': 'Pesaro e Urbino', 'RC': 'Reggio Calabria', 'RE': 'Reggio Emilia',
    'AO': 'Aosta', 'MS': 'Massa-Carrara', 'BZ': 'Bolzano', 'MB': 'Monza e Brianza'
}


def ro(s):
    # правильная румынская орфография: ș, ț с запятой снизу
    return s.replace('ş', 'ș').replace('ţ', 'ț').replace('Ş', 'Ș').replace('Ţ', 'Ț')


def rows(code):
    for line in open(os.path.join(SRC, code, code + '.txt'), encoding='utf-8'):
        r = line.rstrip('\n').split('\t')
        yield {'postal': r[1], 'place': r[2], 'a1': r[3], 'a1c': r[4], 'a2': r[5], 'a2c': r[6], 'acc': r[11]}


def build(code):
    regions, places, postal = [], [], {}
    region_idx, place_idx = {}, {}

    def region_of(r):
        if code == 'RO':
            return ro(r['a1'])
        if code == 'CH':
            return '%s (%s)' % (CH_NAMES[r['a1c']], r['a1c'])
        if code == 'IT':
            return '%s (%s)' % (IT_FIX.get(r['a2c'], r['a2']), r['a2c'])
        return None  # Германия: регион в адресе не нужен

    for r in rows(code):
        name = r['place'].strip()
        if code == 'DE' and r['acc'] == '':
            continue  # индексы отдельных фирм и абонентских ящиков
        if code in ('CH', 'DE', 'IT') and re.search(r'\d', name):
            continue  # абонентские ящики и служебные адреса: «Aarau 1», «Genève 84 Votation»
        if code == 'RO':
            name = re.sub(r'\s\d+$', '', ro(name))  # «București 22» — номер отделения
        reg = region_of(r)
        ri = -1
        if reg is not None:
            if reg not in region_idx:
                region_idx[reg] = len(regions)
                regions.append(reg)
            ri = region_idx[reg]
        key = (name, ri)
        if key not in place_idx:
            place_idx[key] = len(places)
            places.append([name, ri] if ri >= 0 else [name])
        pi = place_idx[key]
        lst = postal.setdefault(r['postal'], [])
        if pi not in lst:
            lst.append(pi)

    # Регионы по алфавиту (с учётом диакритики), индексы мест — пересчитать
    order = sorted(range(len(regions)), key=lambda i: strip(regions[i]))
    remap = {old: new for new, old in enumerate(order)}
    regions = [regions[i] for i in order]
    for p in places:
        if len(p) > 1:
            p[1] = remap[p[1]]
    # Компактный формат (декодирует App.geo в app.js):
    #   places — «название» или «название~регион(36)», через «|»;
    #   postal — индексы по возрастанию: «разница с предыдущим(36).место(36)[.место…]», через «,»;
    #   postalLength — длина индекса (для ведущих нулей).
    for p in places:
        assert '|' not in p[0] and '~' not in p[0], p
    b36 = lambda n: format_base36(n)
    place_str = '|'.join(p[0] + ('~' + b36(p[1]) if len(p) > 1 else '') for p in places)
    codes = sorted(postal, key=int)
    length = len(codes[0])
    assert all(len(c) == length and c.isdigit() for c in codes), code
    parts, prev = [], 0
    for c in codes:
        n = int(c)
        parts.append(b36(n - prev) + ''.join('.' + b36(i) for i in postal[c]))
        prev = n
    data = {'regions': regions, 'places': place_str, 'postalLength': length, 'postal': ','.join(parts)}
    js = ('/* Справочник адресов: %s. Источник — GeoNames (www.geonames.org), лицензия CC BY 4.0.\n'
          '   Собирается скриптом, вручную не править. */\n'
          'window.GEO = window.GEO || {};\nwindow.GEO.%s = %s;\n') % (code, code, json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    open(os.path.join(OUT, code + '.js'), 'w', encoding='utf-8').write(js)
    print(code, 'regions', len(regions), 'places', len(places), 'postal', len(postal), 'size', len(js.encode('utf-8')) // 1024, 'KB')


def format_base36(n):
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    out = ''
    while True:
        n, r = divmod(n, 36)
        out = digits[r] + out
        if not n:
            return out


def strip(s):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()


os.makedirs(OUT, exist_ok=True)
for c in ['RO', 'DE', 'CH', 'IT']:
    build(c)
