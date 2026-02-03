import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// FBS warehouse ID - Краснодар
const WAREHOUSE_ID = 1020005003459950;

interface ProductInStock {
  nmId: number;
  barcode: string;
  vendorCode: string;
  stock: number;
}

async function updateStocks() {
  // Read WB products with stock data
  const productsJson = fs.readFileSync('./products-in-stock.json', 'utf-8');
  const products: ProductInStock[] = JSON.parse(productsJson);

  console.log(`📦 Загружено ${products.length} товаров с остатками\n`);

  // Prepare stocks update
  const stocks = products.map(p => ({
    offer_id: p.vendorCode || p.barcode || String(p.nmId),
    stock: p.stock,
    warehouse_id: WAREHOUSE_ID,
  }));

  console.log('📊 Примеры обновлений:');
  for (const s of stocks.slice(0, 5)) {
    console.log(`  ${s.offer_id}: ${s.stock} шт`);
  }
  console.log('');

  // Send to Ozon API v2
  const response = await fetch('https://api-seller.ozon.ru/v2/products/stocks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({ stocks }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  const result = await response.json() as { 
    result: Array<{
      offer_id: string;
      product_id: number;
      updated: boolean;
      warehouse_id: number;
      errors?: Array<{ code: string; message: string }>;
    }> 
  };

  const updated = result.result.filter(r => r.updated).length;
  const failed = result.result.filter(r => !r.updated).length;

  console.log('📊 РЕЗУЛЬТАТЫ ОБНОВЛЕНИЯ ОСТАТКОВ:');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Обновлено: ${updated}`);
  console.log(`❌ Ошибок: ${failed}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (failed > 0) {
    console.log('❌ ОШИБКИ:');
    for (const r of result.result.filter(r => !r.updated)) {
      console.log(`  • ${r.offer_id}:`);
      for (const err of r.errors || []) {
        console.log(`    - ${err.message}`);
      }
    }
  }

  // Calculate totals
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  console.log(`\n📦 Общий остаток: ${totalStock} шт на ${products.length} товаров`);

  fs.writeFileSync('./ozon-stocks-result.json', JSON.stringify(result, null, 2));
  console.log('💾 Результаты сохранены в ozon-stocks-result.json');
}

updateStocks().catch(console.error);
