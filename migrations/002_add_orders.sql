-- Add Orders Table
-- Migration: 002_add_orders

-- ============================================
-- ЗАКАЗЫ
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    marketplace VARCHAR(10) NOT NULL DEFAULT 'wb',
    srid VARCHAR(100) NOT NULL,
    nm_id VARCHAR(50) NOT NULL,
    vendor_code VARCHAR(100),

    brand VARCHAR(100),
    category VARCHAR(200),
    product_name TEXT,

    quantity INTEGER DEFAULT 1,
    total_price DECIMAL(10,2),
    discount_percent DECIMAL(5,2),

    warehouse_name VARCHAR(200),
    region_name VARCHAR(200),

    status VARCHAR(50),
    is_cancel BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE,
    cancel_date TIMESTAMP WITH TIME ZONE,

    raw_data JSONB,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(marketplace, srid)
);

CREATE INDEX IF NOT EXISTS idx_orders_nm_id ON orders(nm_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_marketplace_created ON orders(marketplace, created_at DESC);

-- View для статистики заказов
CREATE OR REPLACE VIEW v_orders_stats AS
SELECT
    marketplace,
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE is_cancel = true) as canceled_orders,
    SUM(total_price) as total_revenue,
    AVG(total_price) as avg_order_value
FROM orders
GROUP BY marketplace, DATE(created_at)
ORDER BY order_date DESC;
