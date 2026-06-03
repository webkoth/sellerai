#!/usr/bin/env python3
"""
Скачивание категорий и комиссий со всех маркетплейсов.
WB, Ozon, Яндекс.Маркет.
Использует только стандартную библиотеку Python (urllib).
"""

import json
import os
import sys
import time
import ssl
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path
from datetime import datetime


PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / 'data'
CATEGORIES_DIR = DATA_DIR / 'categories'
COMMISSIONS_DIR = DATA_DIR / 'commissions'

CATEGORIES_DIR.mkdir(parents=True, exist_ok=True)
COMMISSIONS_DIR.mkdir(parents=True, exist_ok=True)


def load_env():
    """Загрузить переменные из .env файла."""
    env_path = PROJECT_ROOT / '.env'
    if not env_path.exists():
        print(f"Файл .env не найден: {env_path}")
        return

    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and value:
                os.environ.setdefault(key, value)


def save_json(data, filepath: Path):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    size_kb = filepath.stat().st_size / 1024
    print(f"  Сохранено: {filepath.name} ({size_kb:.1f} KB)")


def api_get(url, headers, params=None, timeout=30):
    """HTTP GET запрос."""
    if params:
        url = url + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers, method='GET')
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode('utf-8'))


def api_post(url, headers, body=None, timeout=30):
    """HTTP POST запрос."""
    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode('utf-8'))


# ============================================================
# WILDBERRIES
# ============================================================

def fetch_wb_categories():
    """Получить все предметы (subjects) WB через Content API."""
    token = os.environ.get('WB_API_TOKEN', '')
    if not token:
        print("  WB_API_TOKEN не найден, пропускаем")
        return None

    headers = {'Authorization': token, 'Content-Type': 'application/json'}
    all_subjects = []
    offset = 0
    limit = 1000

    print("  Загружаем предметы (subjects) WB...")
    while True:
        params = {
            'name': '',
            'limit': limit,
            'locale': 'ru',
            'offset': offset,
        }
        try:
            data = api_get(
                'https://content-api.wildberries.ru/content/v2/object/all',
                headers, params
            )
        except Exception as e:
            print(f"  Ошибка WB Content API: {e}")
            break

        subjects = data.get('data', [])
        if not subjects:
            break

        all_subjects.extend(subjects)
        print(f"    Получено {len(all_subjects)} предметов...")

        if len(subjects) < limit:
            break

        offset += limit
        time.sleep(0.5)

    if all_subjects:
        save_json({
            'marketplace': 'wildberries',
            'type': 'categories',
            'fetched_at': datetime.now().isoformat(),
            'total': len(all_subjects),
            'categories': all_subjects
        }, CATEGORIES_DIR / 'wb_categories.json')
    else:
        print("  Категории WB не получены")

    return all_subjects


def fetch_wb_commissions():
    """Получить тарифы комиссий WB через Common API."""
    token = os.environ.get('WB_API_TOKEN', '')
    if not token:
        print("  WB_API_TOKEN не найден, пропускаем")
        return None

    headers = {'Authorization': token, 'Content-Type': 'application/json'}

    print("  Загружаем комиссии WB...")
    try:
        data = api_get(
            'https://common-api.wildberries.ru/api/v1/tariffs/commission',
            headers
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if e.fp else ''
        print(f"  Ошибка WB Common API: {e.code} {e.reason}")
        print(f"  Тело ответа: {body[:500]}")
        return None
    except Exception as e:
        print(f"  Ошибка WB Common API: {e}")
        return None

    commissions = data.get('report', data.get('data', data))

    save_json({
        'marketplace': 'wildberries',
        'type': 'commissions',
        'fetched_at': datetime.now().isoformat(),
        'total': len(commissions) if isinstance(commissions, list) else 1,
        'raw_response': data,
        'commissions': commissions
    }, COMMISSIONS_DIR / 'wb_commissions.json')

    return commissions


def fetch_wb_box_tariffs():
    """Получить тарифы коробов WB."""
    token = os.environ.get('WB_API_TOKEN', '')
    if not token:
        return None

    headers = {'Authorization': token, 'Content-Type': 'application/json'}

    print("  Загружаем тарифы коробов WB...")
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        data = api_get(
            'https://common-api.wildberries.ru/api/v1/tariffs/box',
            headers,
            params={'date': today}
        )
    except Exception as e:
        print(f"  Ошибка WB Box Tariffs API: {e}")
        return None

    save_json({
        'marketplace': 'wildberries',
        'type': 'box_tariffs',
        'fetched_at': datetime.now().isoformat(),
        'raw_response': data,
    }, COMMISSIONS_DIR / 'wb_box_tariffs.json')

    return data


def fetch_wb_return_tariffs():
    """Получить тарифы возвратов WB."""
    token = os.environ.get('WB_API_TOKEN', '')
    if not token:
        return None

    headers = {'Authorization': token, 'Content-Type': 'application/json'}

    print("  Загружаем тарифы возвратов WB...")
    today = datetime.now().strftime('%Y-%m-%d')
    try:
        data = api_get(
            'https://common-api.wildberries.ru/api/v1/tariffs/return',
            headers,
            params={'date': today}
        )
    except Exception as e:
        print(f"  Ошибка WB Return Tariffs API: {e}")
        return None

    save_json({
        'marketplace': 'wildberries',
        'type': 'return_tariffs',
        'fetched_at': datetime.now().isoformat(),
        'raw_response': data,
    }, COMMISSIONS_DIR / 'wb_return_tariffs.json')

    return data


# ============================================================
# OZON
# ============================================================

def fetch_ozon_categories():
    """Получить полное дерево категорий Ozon."""
    client_id = os.environ.get('OZON_CLIENT_ID', '')
    api_key = os.environ.get('OZON_API_TOKEN', '')
    if not client_id or not api_key:
        print("  OZON credentials не найдены, пропускаем")
        return None

    headers = {
        'Client-Id': client_id,
        'Api-Key': api_key,
        'Content-Type': 'application/json',
    }

    print("  Загружаем дерево категорий Ozon (description-category/tree)...")
    try:
        data = api_post(
            'https://api-seller.ozon.ru/v1/description-category/tree',
            headers,
            body={'language': 'RU'}
        )
    except Exception as e:
        print(f"  Ошибка Ozon API: {e}")
        return None

    categories = data.get('result', [])

    def count_cats(cats):
        total = len(cats)
        for cat in cats:
            children = cat.get('children', [])
            if children:
                total += count_cats(children)
        return total

    total = count_cats(categories)
    print(f"    Итого категорий (с подкатегориями): {total}")

    save_json({
        'marketplace': 'ozon',
        'type': 'categories',
        'fetched_at': datetime.now().isoformat(),
        'total': total,
        'categories': categories
    }, CATEGORIES_DIR / 'ozon_categories.json')

    return categories


def fetch_ozon_commissions():
    """Получить комиссии Ozon из цен товаров."""
    client_id = os.environ.get('OZON_CLIENT_ID', '')
    api_key = os.environ.get('OZON_API_TOKEN', '')
    if not client_id or not api_key:
        print("  OZON credentials не найдены, пропускаем")
        return None

    headers = {
        'Client-Id': client_id,
        'Api-Key': api_key,
        'Content-Type': 'application/json',
    }

    print("  Загружаем цены с комиссиями Ozon...")
    all_items = []
    last_id = ''
    limit = 1000

    while True:
        body = {
            'filter': {'visibility': 'ALL'},
            'limit': limit,
        }
        if last_id:
            body['last_id'] = last_id

        try:
            data = api_post(
                'https://api-seller.ozon.ru/v5/product/info/prices',
                headers, body
            )
        except Exception as e:
            print(f"  Ошибка Ozon Prices API: {e}")
            break

        result = data.get('result', {})
        items = result.get('items', [])
        if not items:
            break

        all_items.extend(items)
        last_id = result.get('last_id', '')
        print(f"    Получено {len(all_items)} товаров с комиссиями...")

        if len(items) < limit or not last_id:
            break

        time.sleep(0.3)

    if all_items:
        save_json({
            'marketplace': 'ozon',
            'type': 'commissions',
            'fetched_at': datetime.now().isoformat(),
            'total': len(all_items),
            'note': 'Комиссии из цен товаров (sales_percent в поле commissions)',
            'products_with_commissions': all_items
        }, COMMISSIONS_DIR / 'ozon_commissions.json')
    else:
        print("    Товаров не найдено (возможно нет товаров на Ozon)")

    return all_items


# ============================================================
# ЯНДЕКС.МАРКЕТ
# ============================================================

def fetch_ym_categories():
    """Получить категории Яндекс.Маркет."""
    token = os.environ.get('YM_API_TOKEN', '') or os.environ.get('YM_TOKEN', '')
    if not token:
        print("  YM_API_TOKEN не найден, пропускаем")
        return None

    headers = {
        'Api-Key': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    print("  Загружаем категории Яндекс.Маркет...")
    try:
        data = api_post(
            'https://api.partner.market.yandex.ru/v2/categories/tree',
            headers,
            body={'language': 'RU'}
        )
    except Exception as e:
        print(f"  Ошибка YM API: {e}")
        return None

    result = data.get('result', {})
    categories = result if isinstance(result, list) else result.get('children', [])

    def count_ym(cats):
        total = len(cats)
        for cat in cats:
            children = cat.get('children', [])
            if children:
                total += count_ym(children)
        return total

    total = count_ym(categories)
    print(f"    Итого категорий: {total}")

    save_json({
        'marketplace': 'yandex_market',
        'type': 'categories',
        'fetched_at': datetime.now().isoformat(),
        'total': total,
        'categories': data.get('result', categories)
    }, CATEGORIES_DIR / 'ym_categories.json')

    return categories


def fetch_ym_commissions():
    """Получить тарифы Яндекс.Маркет."""
    token = os.environ.get('YM_API_TOKEN', '') or os.environ.get('YM_TOKEN', '')
    campaign_id = os.environ.get('YM_CAMPAIGN_ID', '')
    if not token or not campaign_id:
        print("  YM credentials не полные, пропускаем тарифы")
        return None

    headers = {
        'Api-Key': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    print("  Загружаем тарифы Яндекс.Маркет...")

    business_id = os.environ.get('YM_BUSINESS_ID', '')

    business_id_val = business_id
    campaign_id_val = int(campaign_id) if campaign_id else 0

    # 1. Получаем все товары с категориями
    print("    Получаем товары для определения категорий...")
    all_mappings = []
    page_token = None

    while True:
        body = {'filter': {}, 'limit': 200}
        if page_token:
            body['page_token'] = page_token
        try:
            data = api_post(
                f'https://api.partner.market.yandex.ru/businesses/{business_id_val}/offer-mappings',
                headers, body
            )
        except Exception as e:
            print(f"    Ошибка получения товаров: {e}")
            break

        mappings = data.get('result', {}).get('offerMappings', [])
        all_mappings.extend(mappings)

        paging = data.get('result', {}).get('paging', {})
        page_token = paging.get('nextPageToken')
        if not page_token or not mappings:
            break
        time.sleep(0.3)

    print(f"    Получено {len(all_mappings)} товаров")

    if not all_mappings:
        print("    Нет товаров для расчёта тарифов")
        return None

    # 2. Группируем по категориям
    categories_map = {}
    for m in all_mappings:
        mapping = m.get('mapping', {})
        cat_id = mapping.get('marketCategoryId')
        cat_name = mapping.get('marketCategoryName', '')
        if cat_id:
            if cat_id not in categories_map:
                categories_map[cat_id] = {
                    'categoryId': cat_id,
                    'categoryName': cat_name,
                    'offers': []
                }
            categories_map[cat_id]['offers'].append(m['offer'])

    print(f"    Найдено {len(categories_map)} уникальных категорий")

    # 3. Рассчитываем тарифы для каждой категории
    print("    Рассчитываем тарифы по категориям...")
    all_tariffs = []

    for cat_id, cat_data in categories_map.items():
        # Берём первый товар как представителя категории
        offer = cat_data['offers'][0]
        offer_id = offer.get('offerId', 'unknown')

        calc_body = {
            'parameters': {
                'campaignId': campaign_id_val,
            },
            'offers': [{
                'offerId': offer_id,
                'categoryId': cat_id,
                'price': 10000,  # Стандартная цена для расчёта
                'length': 20, 'width': 15, 'height': 10, 'weight': 0.5,
            }],
        }

        try:
            result = api_post(
                'https://api.partner.market.yandex.ru/tariffs/calculate',
                headers, calc_body
            )
            tariff_offers = result.get('result', {}).get('offers', [])
            if tariff_offers:
                tariff_data = tariff_offers[0]
                all_tariffs.append({
                    'categoryId': cat_id,
                    'categoryName': cat_data['categoryName'],
                    'offersCount': len(cat_data['offers']),
                    'tariffs': tariff_data.get('tariffs', []),
                })
        except Exception as e:
            print(f"      Ошибка для категории {cat_id}: {e}")

        time.sleep(0.2)

    if all_tariffs:
        save_json({
            'marketplace': 'yandex_market',
            'type': 'commissions',
            'fetched_at': datetime.now().isoformat(),
            'total': len(all_tariffs),
            'note': 'Тарифы рассчитаны через /tariffs/calculate для каждой категории (при цене 10000₽, вес 0.5кг)',
            'tariffs_by_category': all_tariffs
        }, COMMISSIONS_DIR / 'ym_commissions.json')
    else:
        print("    Тарифы не получены")

    return all_tariffs


# ============================================================
# MAIN
# ============================================================

def main():
    load_env()

    print("=" * 60)
    print("Скачивание категорий и комиссий маркетплейсов")
    print(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # --- WILDBERRIES ---
    print("\n🔵 WILDBERRIES")
    print("-" * 40)

    print("\n📁 Категории:")
    wb_cats = fetch_wb_categories()

    print("\n💰 Комиссии:")
    wb_comm = fetch_wb_commissions()

    print("\n📦 Тарифы коробов:")
    fetch_wb_box_tariffs()

    print("\n↩️  Тарифы возвратов:")
    fetch_wb_return_tariffs()

    # --- OZON ---
    print("\n\n🟠 OZON")
    print("-" * 40)

    print("\n📁 Категории:")
    ozon_cats = fetch_ozon_categories()

    print("\n💰 Комиссии (из цен товаров):")
    ozon_comm = fetch_ozon_commissions()

    # --- ЯНДЕКС.МАРКЕТ ---
    print("\n\n🟡 ЯНДЕКС.МАРКЕТ")
    print("-" * 40)

    print("\n📁 Категории:")
    ym_cats = fetch_ym_categories()

    print("\n💰 Тарифы:")
    ym_comm = fetch_ym_commissions()

    # --- АВИТО ---
    print("\n\n🟢 АВИТО")
    print("-" * 40)
    print("  Авито не предоставляет API для категорий и комиссий")
    print("  Документация: https://developers.avito.ru/api-catalog")

    # --- SUMMARY ---
    print("\n\n" + "=" * 60)
    print("ИТОГО — СОХРАНЁННЫЕ ФАЙЛЫ")
    print("=" * 60)

    for subdir in [CATEGORIES_DIR, COMMISSIONS_DIR]:
        for f in sorted(subdir.glob('*.json')):
            size_kb = f.stat().st_size / 1024
            try:
                with open(f) as fh:
                    data = json.load(fh)
                total = data.get('total', '?')
            except Exception:
                total = '?'
            rel = f.relative_to(DATA_DIR)
            print(f"  {rel}: {total} записей ({size_kb:.1f} KB)")

    print(f"\nФайлы сохранены в: {DATA_DIR}")


if __name__ == '__main__':
    main()
