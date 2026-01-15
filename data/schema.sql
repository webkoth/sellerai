-- Marketplace Workspace Database Schema
-- SQLite 3.x

-- ============================================
-- ОПЕРАЦИОННЫЙ ЛОГ (аудит всех действий)
-- ============================================
CREATE TABLE IF NOT EXISTS operations_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    marketplace TEXT NOT NULL CHECK(marketplace IN ('wb', 'ozon', 'ym')),
    domain TEXT NOT NULL,
    action TEXT NOT NULL,
    tool_name TEXT,
    params TEXT,
    result TEXT,
    success BOOLEAN DEFAULT 1,
    confirmed_by TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_operations_domain ON operations_log(domain);

-- ============================================
-- КЭШ ТОВАРОВ
-- ============================================
CREATE TABLE IF NOT EXISTS products_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    nm_id TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    name TEXT,
    brand TEXT,
    category TEXT,
    
    price REAL,
    price_discount REAL,
    discount_percent REAL,
    
    stock_fbo INTEGER DEFAULT 0,
    stock_fbs INTEGER DEFAULT 0,
    
    rating REAL,
    reviews_count INTEGER DEFAULT 0,
    orders_30d INTEGER DEFAULT 0,
    revenue_30d REAL DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_synced DATETIME,
    
    UNIQUE(marketplace, nm_id)
);

CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products_cache(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_nm_id ON products_cache(nm_id);

-- ============================================
-- ЕЖЕДНЕВНЫЕ СНИМКИ
-- ============================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    marketplace TEXT NOT NULL,
    nm_id TEXT NOT NULL,
    
    orders INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    returns INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    
    position_category INTEGER,
    position_search INTEGER,
    
    stock_fbo INTEGER,
    stock_fbs INTEGER,
    
    rating REAL,
    reviews_new INTEGER DEFAULT 0,
    
    UNIQUE(date, marketplace, nm_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_snapshots_nm_id ON daily_snapshots(nm_id);

-- ============================================
-- ОТЗЫВЫ
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    review_id TEXT NOT NULL,
    nm_id TEXT NOT NULL,
    
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    text TEXT,
    author_name TEXT,
    
    created_at DATETIME,
    answered_at DATETIME,
    answer_text TEXT,
    
    sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative')),
    topics TEXT,
    
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(marketplace, review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_nm_id ON reviews(nm_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- ============================================
-- ШАБЛОНЫ ОТВЕТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS review_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('positive', 'neutral', 'negative', 'question')),
    category TEXT,
    template_text TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- РЕКЛАМНЫЕ КАМПАНИИ
-- ============================================
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    name TEXT,
    type TEXT,
    status TEXT,
    
    budget_daily REAL,
    budget_total REAL,
    spent_total REAL DEFAULT 0,
    
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    
    ctr REAL,
    cpc REAL,
    cpo REAL,
    roi REAL,
    
    created_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(marketplace, campaign_id)
);

-- ============================================
-- НАСТРОЙКИ АЛЕРТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    marketplace TEXT,
    nm_id TEXT,
    
    condition TEXT NOT NULL,
    threshold REAL,
    
    is_active BOOLEAN DEFAULT 1,
    last_triggered DATETIME,
    trigger_count INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ИСТОРИЯ АЛЕРТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_config_id INTEGER REFERENCES alerts_config(id),
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message TEXT,
    data TEXT,
    acknowledged BOOLEAN DEFAULT 0
);

-- ============================================
-- КОНКУРЕНТЫ
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    our_nm_id TEXT NOT NULL,
    competitor_nm_id TEXT NOT NULL,
    competitor_name TEXT,
    
    price REAL,
    rating REAL,
    reviews_count INTEGER,
    
    tracked_since DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked DATETIME,
    
    UNIQUE(marketplace, our_nm_id, competitor_nm_id)
);

-- ============================================
-- ИСТОРИЯ ЦЕН
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    nm_id TEXT NOT NULL,
    
    price_old REAL,
    price_new REAL,
    discount_old REAL,
    discount_new REAL,
    
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by TEXT,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_price_history_nm_id ON price_history(nm_id);

-- ============================================
-- ПОСТАВКИ
-- ============================================
CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    supply_id TEXT,
    
    status TEXT,
    warehouse TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    planned_date DATE,
    accepted_at DATETIME,
    
    items_count INTEGER,
    items_data TEXT
);

-- ============================================
-- ФИНАНСОВЫЕ ЗАПИСИ
-- ============================================
CREATE TABLE IF NOT EXISTS finance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    marketplace TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    revenue REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    logistics REAL DEFAULT 0,
    storage REAL DEFAULT 0,
    penalties REAL DEFAULT 0,
    ads_spend REAL DEFAULT 0,
    
    net_profit REAL DEFAULT 0,
    
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(marketplace, period_start, period_end)
);

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW IF NOT EXISTS v_low_stock AS
SELECT 
    p.*,
    CASE 
        WHEN p.orders_30d > 0 THEN (p.stock_fbo + p.stock_fbs) / (p.orders_30d / 30.0)
        ELSE 999
    END as days_of_stock
FROM products_cache p
WHERE (p.stock_fbo + p.stock_fbs) > 0
ORDER BY days_of_stock ASC;

CREATE VIEW IF NOT EXISTS v_unanswered_negative_reviews AS
SELECT * FROM reviews
WHERE rating <= 2 AND answered_at IS NULL
ORDER BY created_at DESC;

CREATE VIEW IF NOT EXISTS v_top_products AS
SELECT * FROM products_cache
ORDER BY revenue_30d DESC
LIMIT 20;

CREATE VIEW IF NOT EXISTS v_inefficient_ads AS
SELECT * FROM ad_campaigns
WHERE roi < 100 AND spent_total > 1000
ORDER BY roi ASC;
