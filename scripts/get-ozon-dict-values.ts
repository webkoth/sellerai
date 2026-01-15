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

interface DictValue {
  id: number;
  value: string;
}

async function getDictionaryValues(attributeId: number, attributeName: string): Promise<DictValue[]> {
  const response = await fetch('https://api-seller.ozon.ru/v1/description-category/attribute/values', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({
      description_category_id: CATEGORY_ID,
      type_id: TYPE_ID,
      attribute_id: attributeId,
      language: 'RU',
      limit: 100,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Error for ${attributeName}: ${text}`);
    return [];
  }

  const result = await response.json() as { result: DictValue[] };
  return result.result || [];
}

async function main() {
  // Пол (Gender) - ID 9163
  console.log('👤 ПОЛ (ID 9163):');
  const genderValues = await getDictionaryValues(9163, 'Пол');
  for (const v of genderValues.slice(0, 10)) {
    console.log(`  ${v.id}: ${v.value}`);
  }

  // Размер изделия (Size) - ID 5326
  console.log('\n📏 РАЗМЕР ИЗДЕЛИЯ (ID 5326):');
  const sizeValues = await getDictionaryValues(5326, 'Размер изделия');
  for (const v of sizeValues.slice(0, 20)) {
    console.log(`  ${v.id}: ${v.value}`);
  }

  // Тип (Type) - ID 8229
  console.log('\n🏷️ ТИП (ID 8229):');
  const typeValues = await getDictionaryValues(8229, 'Тип');
  for (const v of typeValues.slice(0, 15)) {
    console.log(`  ${v.id}: ${v.value}`);
  }

  // Save for reference
  fs.writeFileSync('./ozon-dict-values.json', JSON.stringify({
    gender: genderValues,
    size: sizeValues,
    type: typeValues,
  }, null, 2));
  console.log('\n💾 Сохранено в ozon-dict-values.json');
}

main().catch(console.error);
