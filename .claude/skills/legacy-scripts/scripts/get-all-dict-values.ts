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

const CATEGORY_ID = 17027899;
const TYPE_ID = 87458883;

interface DictValue {
  id: number;
  value: string;
  info?: string;
  picture?: string;
}

async function getDictionaryValues(attributeId: number, attributeName: string): Promise<DictValue[]> {
  const allValues: DictValue[] = [];
  let lastId = 0;
  
  for (let i = 0; i < 10; i++) {
    const body: Record<string, unknown> = {
      description_category_id: CATEGORY_ID,
      type_id: TYPE_ID,
      attribute_id: attributeId,
      language: 'RU',
      limit: 5000,
    };
    if (lastId > 0) {
      body.last_value_id = lastId;
    }

    const response = await fetch('https://api-seller.ozon.ru/v1/description-category/attribute/values', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': process.env.OZON_CLIENT_ID!,
        'Api-Key': process.env.OZON_API_TOKEN!,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`Error for ${attributeName}: ${response.status}`);
      break;
    }

    const result = await response.json() as { result: DictValue[], has_next: boolean };
    if (!result.result || result.result.length === 0) break;
    
    allValues.push(...result.result);
    
    if (!result.has_next) break;
    lastId = result.result[result.result.length - 1].id;
  }

  return allValues;
}

// Key attributes to get
const ATTRIBUTES = [
  { id: 5309, name: 'Материал' },
  { id: 10096, name: 'Цвет товара' },
  { id: 5289, name: 'Вставка' },
  { id: 5292, name: 'Тип вставки' },
  { id: 9925, name: 'Модель браслета' },
  { id: 23073, name: 'Вид браслета' },
  { id: 5308, name: 'Вид замка' },
  { id: 11364, name: 'Покрытие' },
  { id: 4389, name: 'Страна-изготовитель' },
  { id: 10016, name: 'Стиль украшения' },
  { id: 9917, name: 'Тематика' },
  { id: 9912, name: 'Дизайн' },
  { id: 9390, name: 'Целевая аудитория' },
  { id: 4386, name: 'Упаковка' },
  { id: 23326, name: 'Вид украшения' },
];

async function main() {
  const dictionaries: Record<string, { id: number; values: DictValue[] }> = {};

  for (const attr of ATTRIBUTES) {
    console.log(`📖 Получаю словарь: ${attr.name}...`);
    const values = await getDictionaryValues(attr.id, attr.name);
    dictionaries[attr.name] = { id: attr.id, values };
    
    // Show some relevant values
    console.log(`   Найдено: ${values.length} значений`);
    
    // Find relevant values for meteorite jewelry
    const relevant = values.filter(v => {
      const val = v.value.toLowerCase();
      return val.includes('метеор') || 
             val.includes('камен') || 
             val.includes('натур') ||
             val.includes('серебр') ||
             val.includes('черн') ||
             val.includes('серый') ||
             val.includes('космос') ||
             val.includes('унисекс') ||
             val.includes('россия') ||
             val.includes('эзотер') ||
             val.includes('колл') ||
             val.includes('без') ||
             val.includes('минерал') ||
             val.includes('браслет') ||
             val.includes('шнур') ||
             val.includes('регулир') ||
             val.includes('авторск') ||
             val.includes('подароч') ||
             val.includes('коробк');
    });
    
    if (relevant.length > 0) {
      console.log(`   🎯 Подходящие:`);
      for (const v of relevant.slice(0, 5)) {
        console.log(`      ${v.id}: ${v.value}`);
      }
    }
    console.log('');
  }

  fs.writeFileSync('./ozon-dictionaries.json', JSON.stringify(dictionaries, null, 2));
  console.log('\n💾 Все словари сохранены в ozon-dictionaries.json');
}

main().catch(console.error);
