/**
 * Script to execute Ozon import
 */
import * as fs from 'fs';

// Credentials loaded from .env in main()

interface OzonProduct {
  offerId: string;
  name: string;
  description: string;
  price: string;
  oldPrice: string;
  vat: string;
  descriptionCategoryId: number;
  barcode: string;
  images: string[];
  weight: number;
  depth: number;
  height: number;
  width: number;
  attributes: Array<{
    id: number;
    values?: Array<{ value: string }>;
  }>;
}

// Type ID from existing product on Ozon
const OZON_TYPE_ID = 87458883;

async function importToOzon(products: OzonProduct[]): Promise<{ taskId: number }> {
  const items = products.map((p) => ({
    offer_id: p.offerId,
    name: p.name,
    description: p.description || '',
    price: p.price,
    old_price: p.oldPrice || '0',
    vat: p.vat || '0',
    description_category_id: p.descriptionCategoryId,
    type_id: OZON_TYPE_ID,
    images: p.images || [],
    barcode: p.barcode,
    weight: p.weight || 100,
    dimension_unit: 'mm',
    weight_unit: 'g',
    depth: p.depth || 100,
    height: p.height || 100,
    width: p.width || 100,
    attributes: (p.attributes || []).map((attr) => ({
      id: attr.id,
      complex_id: 0,
      values: (attr.values || []).map((v: { value?: string; dictionary_value_id?: number }) => {
        if (v.dictionary_value_id) {
          return { dictionary_value_id: v.dictionary_value_id };
        }
        return { value: v.value || '' };
      }),
    })),
    complex_attributes: [],
    currency_code: 'RUB',
  }));

  console.log(`📤 Отправляем ${items.length} товаров на Ozon...`);

  const response = await fetch('https://api-seller.ozon.ru/v3/product/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  const result = await response.json() as { result: { task_id: number } };
  return { taskId: result.result.task_id };
}

async function checkImportStatus(taskId: number): Promise<{
  status: string;
  items: Array<{
    offer_id: string;
    product_id?: number;
    status: string;
    errors?: Array<{ code: string; message: string }>;
  }>;
}> {
  const response = await fetch('https://api-seller.ozon.ru/v1/product/import/info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({ task_id: taskId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  const result = await response.json() as {
    result: {
      items: Array<{
        offer_id: string;
        product_id?: number;
        status: string;
        errors?: Array<{ code: string; message: string }>;
      }>;
    };
  };

  const items = result.result.items || [];
  const hasErrors = items.some((i) => i.errors && i.errors.length > 0);
  const allDone = items.every((i) => i.status === 'imported' || i.status === 'failed');
  const status = hasErrors ? 'has_errors' : allDone ? 'completed' : 'processing';

  return { status, items };
}

async function main() {
  // Load .env using dotenv-like parsing
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }

  console.log(`🔑 Client ID: ${process.env.OZON_CLIENT_ID}`);

  // Read prepared import data
  const importData = JSON.parse(fs.readFileSync('./ozon-import-mcp.json', 'utf-8'));
  const products: OzonProduct[] = importData.products;

  console.log(`📦 Загружено ${products.length} товаров для импорта\n`);

  try {
    // Execute import
    const { taskId } = await importToOzon(products);
    console.log(`✅ Импорт запущен! Task ID: ${taskId}\n`);

    // Wait and check status
    console.log('⏳ Ожидаем обработки...');

    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      const { status, items } = await checkImportStatus(taskId);

      const imported = items.filter((i) => i.status === 'imported').length;
      const failed = items.filter((i) => i.status === 'failed').length;
      const pending = items.filter((i) => i.status !== 'imported' && i.status !== 'failed').length;

      console.log(`  [${attempts}] Статус: ${status} | ✅ ${imported} | ❌ ${failed} | ⏳ ${pending}`);

      if (status === 'completed' || status === 'has_errors') {
        console.log('\n📊 РЕЗУЛЬТАТЫ ИМПОРТА:');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ Успешно: ${imported}`);
        console.log(`❌ Ошибок: ${failed}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        if (failed > 0) {
          console.log('❌ ОШИБКИ:');
          for (const item of items.filter((i) => i.errors && i.errors.length > 0)) {
            console.log(`  • ${item.offer_id}:`);
            for (const err of item.errors || []) {
              console.log(`    - ${err.message}`);
            }
          }
        }

        // Save results
        fs.writeFileSync('./ozon-import-result.json', JSON.stringify({ taskId, status, items }, null, 2));
        console.log('\n💾 Результаты сохранены в ozon-import-result.json');

        break;
      }
    }

    if (attempts >= maxAttempts) {
      console.log('\n⚠️ Превышено время ожидания. Проверьте статус позже:');
      console.log(`   Task ID: ${taskId}`);
    }

  } catch (error) {
    console.error('❌ Ошибка импорта:', error);
    process.exit(1);
  }
}

main().catch(console.error);
