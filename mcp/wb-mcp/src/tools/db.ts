import { z } from 'zod';
import { query } from '../db/postgres.js';
import { logRead, logError } from '../utils/logger.js';

// Input schema for db_query
export const DBQueryInputSchema = z.object({
  sql: z.string().describe('SQL query to execute (read-only, SELECT only)'),
  params: z.array(z.unknown()).optional().describe('Query parameters for prepared statement'),
  limit: z.number().optional().default(100).describe('Maximum rows to return'),
});

export type DBQueryInput = z.infer<typeof DBQueryInputSchema>;

// Forbidden SQL keywords (write operations)
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'VACUUM',
  'REINDEX',
  'CLUSTER',
];

/**
 * Validate SQL query for safety
 */
function validateQuery(sql: string): { valid: boolean; error?: string } {
  const upperSql = sql.toUpperCase().trim();

  // Must start with SELECT or WITH (for CTEs)
  if (!upperSql.startsWith('SELECT') && !upperSql.startsWith('WITH')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Match keyword as a whole word (not part of another word)
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, error: `Forbidden keyword: ${keyword}` };
    }
  }

  // Check for semicolons (prevent multiple statements)
  const withoutStrings = sql.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  if (withoutStrings.includes(';') && !withoutStrings.trim().endsWith(';')) {
    return { valid: false, error: 'Multiple statements are not allowed' };
  }

  return { valid: true };
}

/**
 * Execute a read-only SQL query
 */
export async function executeQuery(input: DBQueryInput): Promise<{
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  truncated: boolean;
}> {
  const { sql, params, limit } = input;

  // Validate query
  const validation = validateQuery(sql);
  if (!validation.valid) {
    throw new Error(`Invalid query: ${validation.error}`);
  }

  try {
    // Add LIMIT if not present
    let safeSql = sql.trim();
    if (!safeSql.toUpperCase().includes('LIMIT')) {
      safeSql = `${safeSql} LIMIT ${limit}`;
    }

    const result = await query(safeSql, params as unknown[]);

    const columns = result.fields?.map((f) => f.name) || [];
    const rows = result.rows as Record<string, unknown>[];
    const truncated = rows.length >= limit;

    await logRead('db_query', 'database', { sql: sql.substring(0, 200) }, {
      rowCount: rows.length,
      truncated,
    });

    return {
      rows,
      rowCount: rows.length,
      columns,
      truncated,
    };
  } catch (error) {
    await logError('db_query', 'database', { sql: sql.substring(0, 200) }, error as Error);
    throw error;
  }
}

/**
 * Format query result as markdown table
 */
export function formatQueryResultAsMarkdown(
  rows: Record<string, unknown>[],
  columns: string[],
  truncated: boolean
): string {
  if (rows.length === 0) {
    return 'Результат пуст (0 строк)';
  }

  const lines: string[] = [];

  // Header
  lines.push('| ' + columns.join(' | ') + ' |');
  lines.push('|' + columns.map(() => '---').join('|') + '|');

  // Rows (limit to 50 for display)
  for (const row of rows.slice(0, 50)) {
    const values = columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') return JSON.stringify(val).substring(0, 30);
      const str = String(val);
      return str.length > 30 ? str.substring(0, 27) + '...' : str;
    });
    lines.push('| ' + values.join(' | ') + ' |');
  }

  if (rows.length > 50) {
    lines.push(`\n... показано 50 из ${rows.length} строк`);
  }

  lines.push(`\n**Всего строк:** ${rows.length}${truncated ? ' (ограничено LIMIT)' : ''}`);

  return lines.join('\n');
}

/**
 * Get available tables and views
 */
export function getAvailableTables(): string {
  return [
    '## Доступные таблицы и представления',
    '',
    '### Таблицы',
    '- `products_cache` — кэш товаров (nm_id, name, price, stock, etc.)',
    '- `price_history` — история изменений цен',
    '- `stock_history` — история изменений остатков',
    '- `orders` — заказы',
    '- `order_items` — позиции заказов',
    '- `reviews` — отзывы',
    '- `campaigns` — рекламные кампании',
    '- `campaign_stats` — статистика кампаний',
    '- `operations_log` — лог операций MCP',
    '',
    '### Views (готовые отчёты)',
    '- `v_product_summary` — сводка по товарам',
    '- `v_daily_sales` — продажи по дням',
    '- `v_price_changes` — изменения цен',
    '- `v_review_stats` — статистика отзывов',
    '- `v_campaign_performance` — эффективность рекламы',
    '',
    '### Примеры запросов',
    '```sql',
    '-- Топ-10 товаров по выручке',
    'SELECT name, price, orders_30d, revenue_30d',
    'FROM products_cache',
    'WHERE marketplace = \'wb\'',
    'ORDER BY revenue_30d DESC',
    'LIMIT 10;',
    '',
    '-- История изменений цен за неделю',
    'SELECT * FROM v_price_changes',
    'WHERE changed_at > NOW() - INTERVAL \'7 days\';',
    '```',
  ].join('\n');
}
