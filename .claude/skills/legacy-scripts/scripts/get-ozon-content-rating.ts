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

async function getProductsList(): Promise<Array<{ product_id: number; offer_id: string }>> {
  const response = await fetch('https://api-seller.ozon.ru/v2/product/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({ limit: 100 }),
  });

  if (!response.ok) {
    console.error('Products list error:', await response.text());
    return [];
  }

  const result = await response.json() as { result: { items: Array<{ product_id: number; offer_id: string }> } };
  return result.result?.items || [];
}

async function main() {
  // Get products list
  const products = await getProductsList();
  console.log(`📦 Найдено ${products.length} товаров\n`);

  if (products.length === 0) {
    console.log('❌ Товары не найдены (возможно, ещё на модерации)');
  }

  // Get full attributes list for category
  console.log('📋 АТРИБУТЫ ДЛЯ КАТЕГОРИИ "БРАСЛЕТЫ" (type_id: 87458883):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const attrResponse = await fetch('https://api-seller.ozon.ru/v1/description-category/attribute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({
      description_category_id: 17027899,
      type_id: 87458883,
      language: 'RU',
    }),
  });

  if (!attrResponse.ok) {
    console.error('Attributes error:', await attrResponse.text());
    return;
  }

  const attrResult = await attrResponse.json() as { result: Array<{
    id: number;
    name: string;
    is_required: boolean;
    is_collection: boolean;
    group_name: string;
    description: string;
    type: string;
    dictionary_id?: number;
  }> };

  // Group by category
  const groups = new Map<string, typeof attrResult.result>();
  for (const attr of attrResult.result) {
    const group = attr.group_name || 'Другое';
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(attr);
  }

  for (const [groupName, attrs] of groups) {
    const required = attrs.filter(a => a.is_required);
    const optional = attrs.filter(a => !a.is_required);
    
    console.log(`\n📁 ${groupName}`);
    console.log(`   Обязательных: ${required.length}, Необязательных: ${optional.length}`);
    
    if (optional.length > 0) {
      console.log('   Необязательные:');
      for (const attr of optional) {
        const hasDict = attr.dictionary_id ? '📖' : '📝';
        console.log(`      ${hasDict} [${attr.id}] ${attr.name}`);
      }
    }
  }

  // Get search and additional attrs
  const searchAttrs = attrResult.result.filter(a => a.group_name === 'Поисковые характеристики' && !a.is_required);
  const additionalAttrs = attrResult.result.filter(a => a.group_name === 'Дополнительные характеристики' && !a.is_required);

  // Summary
  console.log('\n\n📊 РЕКОМЕНДАЦИИ ДЛЯ МАКСИМАЛЬНОГО РЕЙТИНГА (100 баллов):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n1️⃣  ПОИСКОВЫЕ ХАРАКТЕРИСТИКИ (до 30 баллов):');
  console.log(`    Доступно: ${searchAttrs.length} необязательных`);
  console.log(`    Для 30 баллов: заполнить >70% = минимум ${Math.ceil(searchAttrs.length * 0.7)}`);
  console.log(`    Для 22.5 баллов: заполнить 50-70% = минимум ${Math.ceil(searchAttrs.length * 0.5)}`);
  
  console.log('\n2️⃣  ОПИСАНИЕ + RICH-КОНТЕНТ (до 20 баллов):');
  console.log('    • Rich-контент JSON → 20 баллов');
  console.log('    • Описание >500 символов → 10 баллов');
  console.log('    • Описание 101-500 символов → 5 баллов');
  
  console.log('\n3️⃣  МЕДИА (до 25 баллов):');
  console.log('    • Видеообложка → +12.5 баллов');
  console.log('    • Видео (1 шт) → +7.5 баллов');
  console.log('    • 3+ фото → +5 баллов');
  console.log('    ✅ У нас есть фото (9+ шт) = 5 баллов');
  
  console.log('\n4️⃣  ДОПОЛНИТЕЛЬНЫЕ ХАРАКТЕРИСТИКИ (до 25 баллов):');
  console.log(`    Доступно: ${additionalAttrs.length} необязательных`);
  console.log(`    Для 25 баллов: заполнить >50% = минимум ${Math.ceil(additionalAttrs.length * 0.5)}`);
  console.log(`    Для 12.5 баллов: заполнить 2+ характеристики`);

  // Save full list
  fs.writeFileSync('./ozon-optional-attributes.json', JSON.stringify({
    search: searchAttrs,
    additional: additionalAttrs,
    all: attrResult.result,
  }, null, 2));
  console.log('\n\n💾 Полный список атрибутов сохранён в ozon-optional-attributes.json');
}

main().catch(console.error);
