-- Marketplace Workspace Database Schema
-- PostgreSQL 17.x
-- Migration: 001_init

-- ============================================
-- ОПЕРАЦИОННЫЙ ЛОГ (аудит всех действий)
-- ============================================
CREATE TABLE IF NOT EXISTS operations_log (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marketplace VARCHAR(10) NOT NULL CHECK(marketplace IN ('wb', 'ozon', 'ym')),
    domain VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    tool_name VARCHAR(100),
    params JSONB,
    result JSONB,
    success BOOLEAN DEFAULT TRUE,
    confirmed_by VARCHAR(100),
    preview_shown JSONB,  -- БЫЛО → СТАЛО preview
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_operations_domain ON operations_log(domain);
CREATE INDEX IF NOT EXISTS idx_operations_tool ON operations_log(tool_name);

-- ============================================
-- КЭШ ТОВАРОВ
-- ============================================
CREATE TABLE IF NOT EXISTS products_cache (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    nm_id VARCHAR(50) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(50),
    name TEXT,
    brand VARCHAR(100),
    category VARCHAR(200),

    price DECIMAL(10,2),
    price_discount DECIMAL(10,2),
    discount_percent DECIMAL(5,2),

    stock_fbo INTEGER DEFAULT 0,
    stock_fbs INTEGER DEFAULT 0,

    rating DECIMAL(3,2),
    reviews_count INTEGER DEFAULT 0,
    orders_30d INTEGER DEFAULT 0,
    revenue_30d DECIMAL(15,2) DEFAULT 0,

    raw_data JSONB,  -- Полные данные API

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced TIMESTAMP WITH TIME ZONE,

    UNIQUE(marketplace, nm_id)
);

CREATE INDEX IF NOT EXISTS idx_products_marketplace ON products_cache(marketplace);
CREATE INDEX IF NOT EXISTS idx_products_nm_id ON products_cache(nm_id);
CREATE INDEX IF NOT EXISTS idx_products_revenue ON products_cache(revenue_30d DESC);
CREATE INDEX IF NOT EXISTS idx_products_raw_data ON products_cache USING GIN(raw_data);

-- ============================================
-- ЕЖЕДНЕВНЫЕ СНИМКИ
-- ============================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    marketplace VARCHAR(10) NOT NULL,
    nm_id VARCHAR(50) NOT NULL,

    orders INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    returns INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,

    position_category INTEGER,
    position_search INTEGER,

    stock_fbo INTEGER,
    stock_fbs INTEGER,

    rating DECIMAL(3,2),
    reviews_new INTEGER DEFAULT 0,

    raw_data JSONB,

    UNIQUE(date, marketplace, nm_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(date DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_nm_id ON daily_snapshots(nm_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_marketplace_date ON daily_snapshots(marketplace, date DESC);

-- ============================================
-- ОТЗЫВЫ
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    review_id VARCHAR(100) NOT NULL,
    nm_id VARCHAR(50) NOT NULL,

    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    text TEXT,
    author_name VARCHAR(200),

    created_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE,
    answer_text TEXT,

    sentiment VARCHAR(20) CHECK(sentiment IN ('positive', 'neutral', 'negative')),
    topics TEXT[],  -- PostgreSQL массив

    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(marketplace, review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_nm_id ON reviews(nm_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_unanswered ON reviews(rating, answered_at) WHERE answered_at IS NULL;

-- ============================================
-- ШАБЛОНЫ ОТВЕТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS review_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK(type IN ('positive', 'neutral', 'negative', 'question')),
    category VARCHAR(100),
    template_text TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- РЕКЛАМНЫЕ КАМПАНИИ
-- ============================================
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    campaign_id VARCHAR(100) NOT NULL,
    name VARCHAR(200),
    type VARCHAR(50),
    status VARCHAR(50),

    budget_daily DECIMAL(10,2),
    budget_total DECIMAL(10,2),
    spent_total DECIMAL(10,2) DEFAULT 0,

    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    orders INTEGER DEFAULT 0,
    revenue DECIMAL(15,2) DEFAULT 0,

    ctr DECIMAL(5,2),
    cpc DECIMAL(10,2),
    cpo DECIMAL(10,2),
    roi DECIMAL(10,2),

    raw_data JSONB,

    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(marketplace, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_marketplace ON ad_campaigns(marketplace);
CREATE INDEX IF NOT EXISTS idx_campaigns_roi ON ad_campaigns(roi);

-- ============================================
-- НАСТРОЙКИ АЛЕРТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    marketplace VARCHAR(10),
    nm_id VARCHAR(50),

    condition TEXT NOT NULL,
    threshold DECIMAL(10,2),

    is_active BOOLEAN DEFAULT TRUE,
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ИСТОРИЯ АЛЕРТОВ
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_history (
    id SERIAL PRIMARY KEY,
    alert_config_id INTEGER REFERENCES alerts_config(id) ON DELETE SET NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message TEXT,
    data JSONB,
    acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alerts_history_triggered ON alerts_history(triggered_at DESC);

-- ============================================
-- КОНКУРЕНТЫ
-- ============================================
CREATE TABLE IF NOT EXISTS competitors (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    our_nm_id VARCHAR(50) NOT NULL,
    competitor_nm_id VARCHAR(50) NOT NULL,
    competitor_name VARCHAR(200),

    price DECIMAL(10,2),
    rating DECIMAL(3,2),
    reviews_count INTEGER,

    raw_data JSONB,

    tracked_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked TIMESTAMP WITH TIME ZONE,

    UNIQUE(marketplace, our_nm_id, competitor_nm_id)
);

-- ============================================
-- ИСТОРИЯ ЦЕН
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    nm_id VARCHAR(50) NOT NULL,

    price_old DECIMAL(10,2),
    price_new DECIMAL(10,2),
    discount_old DECIMAL(5,2),
    discount_new DECIMAL(5,2),

    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by VARCHAR(100),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_price_history_nm_id ON price_history(nm_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed ON price_history(changed_at DESC);

-- ============================================
-- ПОСТАВКИ
-- ============================================
CREATE TABLE IF NOT EXISTS supplies (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    supply_id VARCHAR(100),

    status VARCHAR(50),
    warehouse VARCHAR(100),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    planned_date DATE,
    accepted_at TIMESTAMP WITH TIME ZONE,

    items_count INTEGER,
    items_data JSONB
);

-- ============================================
-- ФИНАНСОВЫЕ ЗАПИСИ
-- ============================================
CREATE TABLE IF NOT EXISTS finance_records (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    revenue DECIMAL(15,2) DEFAULT 0,
    commission DECIMAL(15,2) DEFAULT 0,
    logistics DECIMAL(15,2) DEFAULT 0,
    storage DECIMAL(15,2) DEFAULT 0,
    penalties DECIMAL(15,2) DEFAULT 0,
    ads_spend DECIMAL(15,2) DEFAULT 0,

    net_profit DECIMAL(15,2) DEFAULT 0,

    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(marketplace, period_start, period_end)
);

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW v_low_stock AS
SELECT
    p.*,
    CASE
        WHEN p.orders_30d > 0 THEN (p.stock_fbo + p.stock_fbs)::DECIMAL / (p.orders_30d / 30.0)
        ELSE 999
    END as days_of_stock
FROM products_cache p
WHERE (p.stock_fbo + p.stock_fbs) > 0
ORDER BY days_of_stock ASC;

CREATE OR REPLACE VIEW v_unanswered_negative_reviews AS
SELECT * FROM reviews
WHERE rating <= 2 AND answered_at IS NULL
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW v_top_products AS
SELECT * FROM products_cache
ORDER BY revenue_30d DESC
LIMIT 20;

CREATE OR REPLACE VIEW v_inefficient_ads AS
SELECT * FROM ad_campaigns
WHERE roi < 100 AND spent_total > 1000
ORDER BY roi ASC;

-- View для последних операций
CREATE OR REPLACE VIEW v_recent_operations AS
SELECT
    id,
    timestamp,
    marketplace,
    domain,
    action,
    tool_name,
    success,
    confirmed_by,
    preview_shown IS NOT NULL as had_preview
FROM operations_log
ORDER BY timestamp DESC
LIMIT 100;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для products_cache
DROP TRIGGER IF EXISTS update_products_cache_updated_at ON products_cache;
CREATE TRIGGER update_products_cache_updated_at
    BEFORE UPDATE ON products_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для ad_campaigns
DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at
    BEFORE UPDATE ON ad_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Базовые шаблоны ответов
INSERT INTO review_templates (name, type, category, template_text) VALUES
('Благодарность за 5 звёзд', 'positive', 'general', 'Здравствуйте! Благодарим вас за высокую оценку! Мы рады, что товар вам понравился. Будем рады видеть вас снова!'),
('Ответ на конструктивную критику', 'neutral', 'general', 'Здравствуйте! Спасибо за ваш отзыв. Мы обязательно учтём ваши замечания для улучшения качества нашей продукции.'),
('Решение проблемы с качеством', 'negative', 'quality', 'Здравствуйте! Приносим извинения за доставленные неудобства. Пожалуйста, свяжитесь с нами для решения вопроса. Мы обязательно разберёмся в ситуации.'),
('Ответ на вопрос о товаре', 'question', 'general', 'Здравствуйте! Благодарим за ваш вопрос. {answer}')
ON CONFLICT DO NOTHING;

-- Базовые алерты
INSERT INTO alerts_config (name, type, marketplace, condition, threshold, is_active) VALUES
('Низкий остаток WB', 'low_stock', 'wb', 'stock_fbo + stock_fbs < threshold', 10, true),
('Негативный отзыв WB', 'negative_review', 'wb', 'rating <= threshold', 2, true),
('Падение рейтинга', 'rating_drop', NULL, 'rating < threshold', 4.0, true)
ON CONFLICT DO NOTHING;
