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

async function getWarehouses() {
  // Get FBS warehouses list
  const response = await fetch('https://api-seller.ozon.ru/v1/warehouse/list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Id': process.env.OZON_CLIENT_ID!,
      'Api-Key': process.env.OZON_API_TOKEN!,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ozon API Error ${response.status}: ${text}`);
  }

  const result = await response.json() as { result: Array<{
    warehouse_id: number;
    name: string;
    is_rfbs: boolean;
    status: string;
  }> };

  console.log('🏭 СКЛАДЫ OZON:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  for (const w of result.result || []) {
    console.log(`\nID: ${w.warehouse_id}`);
    console.log(`  Название: ${w.name}`);
    console.log(`  FBS: ${w.is_rfbs ? 'Да' : 'Нет'}`);
    console.log(`  Статус: ${w.status}`);
  }

  return result.result;
}

getWarehouses().catch(console.error);
