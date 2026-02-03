import * as fs from 'fs';

// Load .env
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

const CATEGORY_ID = 17027899;
const TYPE_ID = 87458883;

async function getAttributes() {
  const response = await fetch('https://api-seller.ozon.ru/v1/description-category/attribute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({
      description_category_id: CATEGORY_ID,
      type_id: TYPE_ID,
      language: 'RU',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  const result = await response.json() as { result: Array<{
    id: number;
    name: string;
    is_required: boolean;
    type: string;
    description: string;
    dictionary_id?: number;
  }> };

  console.log('📋 АТРИБУТЫ КАТЕГОРИИ (обязательные):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const required = result.result.filter(a => a.is_required);
  for (const attr of required) {
    console.log(`\nID: ${attr.id}`);
    console.log(`  Название: ${attr.name}`);
    console.log(`  Тип: ${attr.type}`);
    console.log(`  Описание: ${attr.description?.substring(0, 80) || '-'}`);
    if (attr.dictionary_id) {
      console.log(`  Словарь ID: ${attr.dictionary_id}`);
    }
  }

  // Save all attributes
  fs.writeFileSync('./ozon-attributes.json', JSON.stringify(result.result, null, 2));
  console.log('\n💾 Все атрибуты сохранены в ozon-attributes.json');
}

getAttributes().catch(console.error);
