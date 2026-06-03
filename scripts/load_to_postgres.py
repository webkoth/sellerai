#!/usr/bin/env python3
"""
Загрузка категорий и комиссий маркетплейсов в PostgreSQL.
Использует psql через subprocess (не требует psycopg2).
"""

import json
import subprocess
import sys
import os
import re
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / 'data'
DB_URL = 'postgresql://minas@localhost:5432/dashboard'


def run_sql(sql: str, description: str = ''):
    """Execute SQL via psql."""
    result = subprocess.run(
        ['psql', DB_URL, '-v', 'ON_ERROR_STOP=1'],
        input=sql,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        print(f"  ОШИБКА: {description}")
        print(f"  stderr: {result.stderr[:500]}")
        return False
    return True


def escape_sql(value):
    """Escape string for SQL."""
    if value is None:
        return 'NULL'
    s = str(value).replace("'", "''").replace("\\", "\\\\")
    return f"'{s}'"


def slugify(text):
    """Convert text to slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text[:100]


# ============================================================
# 1. WB CATEGORIES
# ============================================================

def load_wb_categories():
    """Загрузить категории WB в таблицу wb_categories."""
    filepath = DATA_DIR / 'categories' / 'wb_categories.json'
    if not filepath.exists():
        print("  Файл wb_categories.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    categories = data['categories']
    print(f"  Загружаем {len(categories)} категорий WB...")

    sql_parts = ["""
DROP TABLE IF EXISTS wb_categories CASCADE;
CREATE TABLE wb_categories (
    subject_id INTEGER PRIMARY KEY,
    subject_name TEXT NOT NULL,
    parent_id INTEGER,
    parent_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wb_categories_parent ON wb_categories(parent_id);
CREATE INDEX idx_wb_categories_name ON wb_categories(subject_name);
"""]

    # Batch insert
    batch_size = 500
    for i in range(0, len(categories), batch_size):
        batch = categories[i:i + batch_size]
        values = []
        for cat in batch:
            sid = cat['subjectID']
            sname = escape_sql(cat['subjectName'])
            pid = cat.get('parentID') or 'NULL'
            pname = escape_sql(cat.get('parentName', ''))
            values.append(f"({sid}, {sname}, {pid}, {pname})")

        sql_parts.append(
            f"INSERT INTO wb_categories (subject_id, subject_name, parent_id, parent_name) VALUES\n"
            + ",\n".join(values) + "\nON CONFLICT (subject_id) DO UPDATE SET subject_name = EXCLUDED.subject_name, parent_id = EXCLUDED.parent_id, parent_name = EXCLUDED.parent_name;\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "WB categories"):
        print(f"  OK: {len(categories)} категорий WB загружено")


# ============================================================
# 2. WB COMMISSIONS
# ============================================================

def load_wb_commissions():
    """Загрузить комиссии WB в таблицу wb_commission_rates."""
    filepath = DATA_DIR / 'commissions' / 'wb_commissions.json'
    if not filepath.exists():
        print("  Файл wb_commissions.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    commissions = data['commissions']
    print(f"  Загружаем {len(commissions)} комиссий WB...")

    sql_parts = ["""
DROP TABLE IF EXISTS wb_commission_rates CASCADE;
CREATE TABLE wb_commission_rates (
    subject_id INTEGER PRIMARY KEY,
    subject_name TEXT NOT NULL,
    parent_id INTEGER,
    parent_name TEXT,
    kgvp_marketplace DOUBLE PRECISION NOT NULL DEFAULT 0,
    kgvp_supplier DOUBLE PRECISION NOT NULL DEFAULT 0,
    kgvp_supplier_express DOUBLE PRECISION NOT NULL DEFAULT 0,
    kgvp_booking DOUBLE PRECISION NOT NULL DEFAULT 0,
    kgvp_pickup DOUBLE PRECISION NOT NULL DEFAULT 0,
    paid_storage_kgvp DOUBLE PRECISION NOT NULL DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wb_commission_rates_parent ON wb_commission_rates(parent_id);
CREATE INDEX idx_wb_commission_rates_name ON wb_commission_rates(subject_name);
COMMENT ON TABLE wb_commission_rates IS 'Комиссии WB по предметам (из /api/v1/tariffs/commission)';
COMMENT ON COLUMN wb_commission_rates.kgvp_marketplace IS 'Комиссия FBO (%)';
COMMENT ON COLUMN wb_commission_rates.kgvp_supplier IS 'Комиссия FBS (%)';
COMMENT ON COLUMN wb_commission_rates.kgvp_supplier_express IS 'Комиссия экспресс-доставка (%)';
COMMENT ON COLUMN wb_commission_rates.kgvp_booking IS 'Комиссия бронирование (%)';
COMMENT ON COLUMN wb_commission_rates.kgvp_pickup IS 'Комиссия самовывоз (%)';
COMMENT ON COLUMN wb_commission_rates.paid_storage_kgvp IS 'Комиссия платное хранение (%)';
"""]

    batch_size = 500
    for i in range(0, len(commissions), batch_size):
        batch = commissions[i:i + batch_size]
        values = []
        for c in batch:
            sid = c['subjectID']
            sname = escape_sql(c['subjectName'])
            pid = c.get('parentID') or 'NULL'
            pname = escape_sql(c.get('parentName', ''))
            fbo = c.get('kgvpMarketplace', 0)
            fbs = c.get('kgvpSupplier', 0)
            express = c.get('kgvpSupplierExpress', 0)
            booking = c.get('kgvpBooking', 0)
            pickup = c.get('kgvpPickup', 0)
            storage = c.get('paidStorageKgvp', 0)
            values.append(f"({sid}, {sname}, {pid}, {pname}, {fbo}, {fbs}, {express}, {booking}, {pickup}, {storage})")

        sql_parts.append(
            "INSERT INTO wb_commission_rates (subject_id, subject_name, parent_id, parent_name, "
            "kgvp_marketplace, kgvp_supplier, kgvp_supplier_express, kgvp_booking, kgvp_pickup, paid_storage_kgvp) VALUES\n"
            + ",\n".join(values) + "\nON CONFLICT (subject_id) DO UPDATE SET "
            "subject_name = EXCLUDED.subject_name, kgvp_marketplace = EXCLUDED.kgvp_marketplace, "
            "kgvp_supplier = EXCLUDED.kgvp_supplier, kgvp_supplier_express = EXCLUDED.kgvp_supplier_express, "
            "kgvp_booking = EXCLUDED.kgvp_booking, kgvp_pickup = EXCLUDED.kgvp_pickup, "
            "paid_storage_kgvp = EXCLUDED.paid_storage_kgvp, fetched_at = NOW();\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "WB commissions"):
        print(f"  OK: {len(commissions)} комиссий WB загружено")


# ============================================================
# 3. WB BOX TARIFFS
# ============================================================

def load_wb_box_tariffs():
    """Загрузить тарифы коробов WB."""
    filepath = DATA_DIR / 'commissions' / 'wb_box_tariffs.json'
    if not filepath.exists():
        print("  Файл wb_box_tariffs.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    raw = data.get('raw_response', {})
    response = raw.get('response', raw)
    inner = response.get('data', response)
    dtNext = inner.get('dtNextBox', '')
    dtTill = inner.get('dtTillMax', '')
    warehouses = inner.get('warehouseList', [])

    print(f"  Загружаем {len(warehouses)} складов с тарифами коробов WB...")

    sql_parts = ["""
DROP TABLE IF EXISTS wb_box_tariffs CASCADE;
CREATE TABLE wb_box_tariffs (
    id SERIAL PRIMARY KEY,
    warehouse_name TEXT NOT NULL,
    warehouse_id INTEGER,
    box_delivery_and_storage_expr TEXT,
    box_delivery_base TEXT,
    box_delivery_liter TEXT,
    box_storage_base TEXT,
    box_storage_liter TEXT,
    dt_next_box TEXT,
    dt_till_max TEXT,
    fetched_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wb_box_tariffs_warehouse ON wb_box_tariffs(warehouse_name);
COMMENT ON TABLE wb_box_tariffs IS 'Тарифы коробов WB по складам (из /api/v1/tariffs/box)';
"""]

    if warehouses:
        values = []
        for wh in warehouses:
            wname = escape_sql(wh.get('warehouseName', ''))
            wid = wh.get('warehouseId', 'NULL')
            expr = escape_sql(wh.get('boxDeliveryAndStorageExpr', ''))
            base = escape_sql(wh.get('boxDeliveryBase', ''))
            liter = escape_sql(wh.get('boxDeliveryLiter', ''))
            sbase = escape_sql(wh.get('boxStorageBase', ''))
            sliter = escape_sql(wh.get('boxStorageLiter', ''))
            values.append(
                f"({wname}, {wid}, {expr}, {base}, {liter}, {sbase}, {sliter}, "
                f"{escape_sql(dtNext)}, {escape_sql(dtTill)})"
            )

        sql_parts.append(
            "INSERT INTO wb_box_tariffs (warehouse_name, warehouse_id, box_delivery_and_storage_expr, "
            "box_delivery_base, box_delivery_liter, box_storage_base, box_storage_liter, "
            "dt_next_box, dt_till_max) VALUES\n"
            + ",\n".join(values) + ";\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "WB box tariffs"):
        print(f"  OK: {len(warehouses)} складов загружено")


# ============================================================
# 4. WB RETURN TARIFFS
# ============================================================

def load_wb_return_tariffs():
    """Загрузить тарифы возвратов WB."""
    filepath = DATA_DIR / 'commissions' / 'wb_return_tariffs.json'
    if not filepath.exists():
        print("  Файл wb_return_tariffs.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    raw = data.get('raw_response', {})
    response = raw.get('response', raw)
    inner = response.get('data', response)
    warehouses = inner.get('warehouseList', [])

    print(f"  Загружаем тарифы возвратов WB ({len(warehouses)} складов)...")

    sql_parts = ["""
DROP TABLE IF EXISTS wb_return_tariffs CASCADE;
CREATE TABLE wb_return_tariffs (
    id SERIAL PRIMARY KEY,
    warehouse_name TEXT NOT NULL,
    warehouse_id INTEGER,
    data JSONB NOT NULL,
    fetched_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_wb_return_tariffs_warehouse ON wb_return_tariffs(warehouse_name);
COMMENT ON TABLE wb_return_tariffs IS 'Тарифы возвратов WB (из /api/v1/tariffs/return)';
"""]

    if warehouses:
        values = []
        for wh in warehouses:
            wname = escape_sql(wh.get('warehouseName', wh.get('warehouse_name', 'unknown')))
            wid = wh.get('warehouseId', wh.get('warehouse_id', 'NULL'))
            jdata = escape_sql(json.dumps(wh, ensure_ascii=False))
            values.append(f"({wname}, {wid}, {jdata}::jsonb)")

        sql_parts.append(
            "INSERT INTO wb_return_tariffs (warehouse_name, warehouse_id, data) VALUES\n"
            + ",\n".join(values) + ";\n"
        )
    else:
        # Store raw response as single record
        jdata = escape_sql(json.dumps(response, ensure_ascii=False))
        sql_parts.append(
            f"INSERT INTO wb_return_tariffs (warehouse_name, warehouse_id, data) VALUES ('raw_response', 0, {jdata}::jsonb);\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "WB return tariffs"):
        print(f"  OK: тарифы возвратов WB загружены")


# ============================================================
# 5. OZON CATEGORIES
# ============================================================

def load_ozon_categories():
    """Загрузить категории Ozon в таблицу ozon_categories."""
    filepath = DATA_DIR / 'categories' / 'ozon_categories.json'
    if not filepath.exists():
        print("  Файл ozon_categories.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    categories = data['categories']
    print(f"  Загружаем {data['total']} категорий Ozon (дерево)...")

    sql_parts = ["""
DROP TABLE IF EXISTS ozon_categories CASCADE;
CREATE TABLE ozon_categories (
    category_id INTEGER PRIMARY KEY,
    category_name TEXT NOT NULL,
    parent_id INTEGER,
    level INTEGER NOT NULL DEFAULT 0,
    has_children BOOLEAN DEFAULT FALSE,
    fetched_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_ozon_categories_parent ON ozon_categories(parent_id);
CREATE INDEX idx_ozon_categories_name ON ozon_categories(category_name);
CREATE INDEX idx_ozon_categories_level ON ozon_categories(level);
COMMENT ON TABLE ozon_categories IS 'Категории Ozon (из /v1/description-category/tree)';
"""]

    # Flatten the tree, skip entries with id=0 (empty placeholders)
    flat = []
    seen_ids = set()

    def flatten(cats, parent_id=None, level=0):
        for cat in cats:
            cid = cat.get('description_category_id', cat.get('category_id', 0))
            cname = cat.get('category_name', cat.get('title', ''))
            children = cat.get('children', [])

            if cid and cid != 0 and cid not in seen_ids:
                seen_ids.add(cid)
                flat.append({
                    'id': cid,
                    'name': cname,
                    'parent_id': parent_id,
                    'level': level,
                    'has_children': len(children) > 0,
                })

            if children:
                flatten(children, cid if cid else parent_id, level + 1)

    flatten(categories)
    print(f"    Развёрнуто {len(flat)} уникальных категорий из дерева (без ID=0)")

    batch_size = 500
    for i in range(0, len(flat), batch_size):
        batch = flat[i:i + batch_size]
        values = []
        for c in batch:
            cid = c['id']
            cname = escape_sql(c['name'])
            pid = c['parent_id'] if c['parent_id'] is not None else 'NULL'
            level = c['level']
            has_ch = 'TRUE' if c['has_children'] else 'FALSE'
            values.append(f"({cid}, {cname}, {pid}, {level}, {has_ch})")

        sql_parts.append(
            "INSERT INTO ozon_categories (category_id, category_name, parent_id, level, has_children) VALUES\n"
            + ",\n".join(values) + "\nON CONFLICT (category_id) DO UPDATE SET "
            "category_name = EXCLUDED.category_name, parent_id = EXCLUDED.parent_id, "
            "level = EXCLUDED.level, has_children = EXCLUDED.has_children, fetched_at = NOW();\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "Ozon categories"):
        print(f"  OK: {len(flat)} категорий Ozon загружено")


# ============================================================
# 6. YM CATEGORIES
# ============================================================

def load_ym_categories():
    """Загрузить категории Яндекс.Маркет в таблицу ym_categories."""
    filepath = DATA_DIR / 'categories' / 'ym_categories.json'
    if not filepath.exists():
        print("  Файл ym_categories.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    # YM categories are nested under result
    result = data.get('categories', data.get('result', {}))
    root_children = []

    if isinstance(result, dict):
        root_children = result.get('children', [])
    elif isinstance(result, list):
        root_children = result

    print(f"  Загружаем {data.get('total', '?')} категорий Яндекс.Маркет...")

    sql_parts = ["""
DROP TABLE IF EXISTS ym_categories CASCADE;
CREATE TABLE ym_categories (
    category_id INTEGER PRIMARY KEY,
    category_name TEXT NOT NULL,
    parent_id INTEGER,
    level INTEGER NOT NULL DEFAULT 0,
    has_children BOOLEAN DEFAULT FALSE,
    fetched_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_ym_categories_parent ON ym_categories(parent_id);
CREATE INDEX idx_ym_categories_name ON ym_categories(category_name);
CREATE INDEX idx_ym_categories_level ON ym_categories(level);
COMMENT ON TABLE ym_categories IS 'Категории Яндекс.Маркет (из /v2/categories/tree)';
"""]

    flat = []

    def flatten(cats, parent_id=None, level=0):
        for cat in cats:
            cid = cat.get('id', 0)
            cname = cat.get('name', '')
            children = cat.get('children', [])
            flat.append({
                'id': cid,
                'name': cname,
                'parent_id': parent_id,
                'level': level,
                'has_children': len(children) > 0,
            })
            if children:
                flatten(children, cid, level + 1)

    flatten(root_children)
    print(f"    Развёрнуто {len(flat)} категорий из дерева")

    batch_size = 500
    for i in range(0, len(flat), batch_size):
        batch = flat[i:i + batch_size]
        values = []
        for c in batch:
            cid = c['id']
            cname = escape_sql(c['name'])
            pid = c['parent_id'] if c['parent_id'] is not None else 'NULL'
            level = c['level']
            has_ch = 'TRUE' if c['has_children'] else 'FALSE'
            values.append(f"({cid}, {cname}, {pid}, {level}, {has_ch})")

        sql_parts.append(
            "INSERT INTO ym_categories (category_id, category_name, parent_id, level, has_children) VALUES\n"
            + ",\n".join(values) + "\nON CONFLICT (category_id) DO UPDATE SET "
            "category_name = EXCLUDED.category_name, parent_id = EXCLUDED.parent_id, "
            "level = EXCLUDED.level, has_children = EXCLUDED.has_children, fetched_at = NOW();\n"
        )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "YM categories"):
        print(f"  OK: {len(flat)} категорий Яндекс.Маркет загружено")


# ============================================================
# 7. YM COMMISSIONS
# ============================================================

def load_ym_commissions():
    """Загрузить тарифы Яндекс.Маркет в таблицу ym_commission_rates."""
    filepath = DATA_DIR / 'commissions' / 'ym_commissions.json'
    if not filepath.exists():
        print("  Файл ym_commissions.json не найден")
        return

    with open(filepath) as f:
        data = json.load(f)

    tariffs = data.get('tariffs_by_category', [])
    if not tariffs:
        print("  Нет тарифов YM для загрузки")
        return

    print(f"  Загружаем {len(tariffs)} тарифов Яндекс.Маркет...")

    sql_parts = ["""
DROP TABLE IF EXISTS ym_commission_rates CASCADE;
CREATE TABLE ym_commission_rates (
    category_id INTEGER PRIMARY KEY,
    category_name TEXT NOT NULL,
    offers_count INTEGER DEFAULT 0,
    fee_percent DOUBLE PRECISION DEFAULT 0,
    fee_amount DOUBLE PRECISION DEFAULT 0,
    agency_commission DOUBLE PRECISION DEFAULT 0,
    payment_transfer_percent DOUBLE PRECISION DEFAULT 0,
    delivery_to_customer_percent DOUBLE PRECISION DEFAULT 0,
    delivery_to_customer_amount DOUBLE PRECISION DEFAULT 0,
    middle_mile_amount DOUBLE PRECISION DEFAULT 0,
    tariffs_raw JSONB,
    fetched_at TIMESTAMP DEFAULT NOW()
);
COMMENT ON TABLE ym_commission_rates IS 'Комиссии Яндекс.Маркет по категориям (из /tariffs/calculate)';
COMMENT ON COLUMN ym_commission_rates.fee_percent IS 'Комиссия за продажу (%)';
COMMENT ON COLUMN ym_commission_rates.payment_transfer_percent IS 'Перевод оплаты (%)';
COMMENT ON COLUMN ym_commission_rates.delivery_to_customer_percent IS 'Доставка покупателю (%)';
COMMENT ON COLUMN ym_commission_rates.middle_mile_amount IS 'Средняя миля (₽)';
"""]

    values = []
    for t in tariffs:
        cid = t['categoryId']
        cname = escape_sql(t['categoryName'])
        offers_count = t.get('offersCount', 0)

        fee_pct = 0
        fee_amt = 0
        agency = 0
        payment_pct = 0
        delivery_pct = 0
        delivery_amt = 0
        middle_mile = 0

        for tariff in t.get('tariffs', []):
            params = {p['name']: p['value'] for p in tariff.get('parameters', [])}
            amount = tariff.get('amount', 0)
            vtype = params.get('valueType', '')
            value = float(params.get('value', 0))

            if tariff['type'] == 'FEE':
                fee_pct = value if vtype == 'relative' else 0
                fee_amt = amount
            elif tariff['type'] == 'AGENCY_COMMISSION':
                agency = amount
            elif tariff['type'] == 'PAYMENT_TRANSFER':
                payment_pct = value if vtype == 'relative' else 0
            elif tariff['type'] == 'DELIVERY_TO_CUSTOMER':
                delivery_pct = value if vtype == 'relative' else 0
                delivery_amt = amount
            elif tariff['type'] == 'MIDDLE_MILE':
                middle_mile = amount

        raw = escape_sql(json.dumps(t['tariffs'], ensure_ascii=False))
        values.append(
            f"({cid}, {cname}, {offers_count}, {fee_pct}, {fee_amt}, {agency}, "
            f"{payment_pct}, {delivery_pct}, {delivery_amt}, {middle_mile}, {raw}::jsonb)"
        )

    sql_parts.append(
        "INSERT INTO ym_commission_rates (category_id, category_name, offers_count, "
        "fee_percent, fee_amount, agency_commission, payment_transfer_percent, "
        "delivery_to_customer_percent, delivery_to_customer_amount, middle_mile_amount, tariffs_raw) VALUES\n"
        + ",\n".join(values)
        + "\nON CONFLICT (category_id) DO UPDATE SET "
        "category_name = EXCLUDED.category_name, fee_percent = EXCLUDED.fee_percent, "
        "fee_amount = EXCLUDED.fee_amount, agency_commission = EXCLUDED.agency_commission, "
        "payment_transfer_percent = EXCLUDED.payment_transfer_percent, "
        "delivery_to_customer_percent = EXCLUDED.delivery_to_customer_percent, "
        "delivery_to_customer_amount = EXCLUDED.delivery_to_customer_amount, "
        "middle_mile_amount = EXCLUDED.middle_mile_amount, tariffs_raw = EXCLUDED.tariffs_raw, "
        "fetched_at = NOW();\n"
    )

    sql = "\n".join(sql_parts)
    if run_sql(sql, "YM commissions"):
        print(f"  OK: {len(tariffs)} тарифов Яндекс.Маркет загружено")


# ============================================================
# MAIN
# ============================================================

def main():
    print("=" * 60)
    print("Загрузка данных в PostgreSQL")
    print(f"БД: {DB_URL}")
    print(f"Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # --- WB ---
    print("\n🔵 WILDBERRIES")
    print("-" * 40)

    print("\n📁 Категории:")
    load_wb_categories()

    print("\n💰 Комиссии:")
    load_wb_commissions()

    print("\n📦 Тарифы коробов:")
    load_wb_box_tariffs()

    print("\n↩️  Тарифы возвратов:")
    load_wb_return_tariffs()

    # --- OZON ---
    print("\n\n🟠 OZON")
    print("-" * 40)

    print("\n📁 Категории:")
    load_ozon_categories()

    # --- YM ---
    print("\n\n🟡 ЯНДЕКС.МАРКЕТ")
    print("-" * 40)

    print("\n📁 Категории:")
    load_ym_categories()

    print("\n💰 Тарифы:")
    load_ym_commissions()

    # --- SUMMARY ---
    print("\n\n" + "=" * 60)
    print("ПРОВЕРКА — КОЛИЧЕСТВО ЗАПИСЕЙ")
    print("=" * 60)

    tables = [
        'wb_categories',
        'wb_commission_rates',
        'wb_box_tariffs',
        'wb_return_tariffs',
        'ozon_categories',
        'ozon_commission_rates',
        'ym_categories',
        'ym_commission_rates',
    ]

    for table in tables:
        result = subprocess.run(
            ['psql', DB_URL, '-t', '-c', f'SELECT count(*) FROM {table};'],
            capture_output=True, text=True, timeout=10,
        )
        count = result.stdout.strip() if result.returncode == 0 else 'N/A'
        print(f"  {table}: {count} записей")


if __name__ == '__main__':
    main()
