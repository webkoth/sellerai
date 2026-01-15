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

async function getAllSizes() {
  let allSizes: Array<{id: number; value: string}> = [];
  let lastId = '';
  
  for (let i = 0; i < 5; i++) {
    const body: Record<string, unknown> = {
      description_category_id: 17027899,
      type_id: 87458883,
      attribute_id: 5326,
      language: 'RU',
      limit: 100,
    };
    if (lastId) {
      body.last_value_id = parseInt(lastId);
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

    const result = await response.json() as { result: Array<{id: number; value: string}>, has_next: boolean };
    if (!result.result || result.result.length === 0) break;
    
    allSizes = [...allSizes, ...result.result];
    lastId = String(result.result[result.result.length - 1].id);
    
    if (!result.has_next) break;
  }

  // Find common bracelet sizes (18, 19, 20, 21)
  console.log('📏 Размеры браслетов:');
  const braceletSizes = allSizes.filter(s => 
    ['17', '18', '19', '20', '21', '22', 'Универсальный', 'Безразмерный'].includes(s.value)
  );
  for (const s of braceletSizes) {
    console.log(`  ${s.id}: ${s.value}`);
  }

  // Find "универсальный" or similar
  const universal = allSizes.filter(s => 
    s.value.toLowerCase().includes('универс') || 
    s.value.toLowerCase().includes('безраз') ||
    s.value.toLowerCase().includes('one size')
  );
  if (universal.length > 0) {
    console.log('\n🎯 Универсальные размеры:');
    for (const s of universal) {
      console.log(`  ${s.id}: ${s.value}`);
    }
  }
}

getAllSizes().catch(console.error);
