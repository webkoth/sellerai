-- Настройки селлера для Unit-экономики
-- Миграция 003

-- Таблица настроек магазина
CREATE TABLE IF NOT EXISTS seller_settings (
  id SERIAL PRIMARY KEY,
  marketplace VARCHAR(10) NOT NULL DEFAULT 'wb',

  -- Налоги
  tax_system VARCHAR(30) NOT NULL DEFAULT 'usn_income',
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 6.0,

  -- Страховые взносы ИП (toggle)
  insurance_enabled BOOLEAN DEFAULT true,
  insurance_fixed DECIMAL(10,2) DEFAULT 49500,
  insurance_percent DECIMAL(5,2) DEFAULT 1.0,

  -- Бухгалтер (toggle)
  accountant_enabled BOOLEAN DEFAULT true,
  accountant_monthly DECIMAL(10,2) DEFAULT 3000,

  -- Возвраты/отмены (toggle)
  returns_enabled BOOLEAN DEFAULT true,
  return_percent DECIMAL(5,2) DEFAULT 15.0,
  cancel_percent DECIMAL(5,2) DEFAULT 8.0,

  -- Прочие расходы (toggle)
  other_enabled BOOLEAN DEFAULT false,
  other_monthly DECIMAL(10,2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(marketplace)
);

-- Дефолтные настройки для WB при первом запуске
INSERT INTO seller_settings (marketplace) VALUES ('wb')
ON CONFLICT (marketplace) DO NOTHING;

-- Таблица себестоимости товаров
CREATE TABLE IF NOT EXISTS product_costs (
  id SERIAL PRIMARY KEY,
  marketplace VARCHAR(10) NOT NULL DEFAULT 'wb',
  nm_id VARCHAR(50) NOT NULL,

  cost_price DECIMAL(10,2) NOT NULL,           -- Себестоимость (обязательно)
  packaging_cost DECIMAL(10,2) DEFAULT 50,     -- Упаковка (дефолт 50₽)
  packaging_enabled BOOLEAN DEFAULT true,      -- Toggle упаковки

  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(marketplace, nm_id)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_product_costs_nm_id ON product_costs(nm_id);
CREATE INDEX IF NOT EXISTS idx_product_costs_marketplace ON product_costs(marketplace);

-- Комментарии к таблицам
COMMENT ON TABLE seller_settings IS 'Настройки магазина для расчёта unit-экономики';
COMMENT ON TABLE product_costs IS 'Себестоимость товаров для расчёта маржи';

COMMENT ON COLUMN seller_settings.tax_system IS 'Система налогообложения: usn_income, usn_income_expense, osno, npd';
COMMENT ON COLUMN seller_settings.insurance_fixed IS 'Фиксированные страховые взносы ИП (₽/год)';
COMMENT ON COLUMN seller_settings.insurance_percent IS 'Процент от дохода свыше 300К';
COMMENT ON COLUMN product_costs.cost_price IS 'Себестоимость единицы товара (₽)';
