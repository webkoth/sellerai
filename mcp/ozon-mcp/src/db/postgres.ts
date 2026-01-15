import pg from 'pg';
import { getDatabaseUrl } from '../utils/auth.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create database pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

/**
 * Close database pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Execute a query
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const dbPool = getPool();
  const start = Date.now();
  const result = await dbPool.query<T>(text, params);
  const duration = Date.now() - start;

  // Log slow queries
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
  }

  return result;
}

/**
 * Cache product data
 */
export async function cacheProduct(product: {
  marketplace: string;
  productId: string;
  offerId?: string;
  sku?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  category?: string;
  price?: number;
  priceDiscount?: number;
  discountPercent?: number;
  stockFbo?: number;
  stockFbs?: number;
  rating?: number;
  reviewsCount?: number;
  orders30d?: number;
  revenue30d?: number;
  rawData?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO products_cache
     (marketplace, nm_id, sku, barcode, name, brand, category,
      price, price_discount, discount_percent, stock_fbo, stock_fbs,
      rating, reviews_count, orders_30d, revenue_30d, raw_data, last_synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
     ON CONFLICT (marketplace, nm_id) DO UPDATE SET
       sku = EXCLUDED.sku,
       barcode = EXCLUDED.barcode,
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       category = EXCLUDED.category,
       price = EXCLUDED.price,
       price_discount = EXCLUDED.price_discount,
       discount_percent = EXCLUDED.discount_percent,
       stock_fbo = EXCLUDED.stock_fbo,
       stock_fbs = EXCLUDED.stock_fbs,
       rating = EXCLUDED.rating,
       reviews_count = EXCLUDED.reviews_count,
       orders_30d = EXCLUDED.orders_30d,
       revenue_30d = EXCLUDED.revenue_30d,
       raw_data = EXCLUDED.raw_data,
       last_synced = NOW()`,
    [
      product.marketplace,
      product.productId,
      product.offerId || product.sku || null,
      product.barcode || null,
      product.name || null,
      product.brand || null,
      product.category || null,
      product.price || null,
      product.priceDiscount || null,
      product.discountPercent || null,
      product.stockFbo || 0,
      product.stockFbs || 0,
      product.rating || null,
      product.reviewsCount || 0,
      product.orders30d || 0,
      product.revenue30d || 0,
      product.rawData ? JSON.stringify(product.rawData) : null,
    ]
  );
}

/**
 * Get cached product
 */
export async function getCachedProduct(
  marketplace: string,
  productId: string,
  maxAgeMinutes = 15
): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT * FROM products_cache
     WHERE marketplace = $1 AND nm_id = $2
     AND last_synced > NOW() - INTERVAL '${maxAgeMinutes} minutes'`,
    [marketplace, productId]
  );
  return result.rows[0] || null;
}

/**
 * Get all cached products
 */
export async function getAllCachedProducts(
  marketplace: string,
  maxAgeMinutes = 15
): Promise<Record<string, unknown>[]> {
  const result = await query(
    `SELECT * FROM products_cache
     WHERE marketplace = $1
     AND last_synced > NOW() - INTERVAL '${maxAgeMinutes} minutes'
     ORDER BY revenue_30d DESC NULLS LAST`,
    [marketplace]
  );
  return result.rows;
}

/**
 * Log price change
 */
export async function logPriceChange(params: {
  marketplace: string;
  productId: string;
  priceOld: number;
  priceNew: number;
  discountOld?: number;
  discountNew?: number;
  changedBy?: string;
  reason?: string;
}): Promise<void> {
  await query(
    `INSERT INTO price_history
     (marketplace, nm_id, price_old, price_new, discount_old, discount_new, changed_by, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.marketplace,
      params.productId,
      params.priceOld,
      params.priceNew,
      params.discountOld || null,
      params.discountNew || null,
      params.changedBy || 'mcp',
      params.reason || null,
    ]
  );
}
