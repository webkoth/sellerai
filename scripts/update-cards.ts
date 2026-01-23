/**
 * Script to update WB cards with proper nmId filtering
 * Works around the WB API filter bug
 */
import 'dotenv/config';

const WB_API_TOKEN = process.env.WB_API_TOKEN?.replace(/^["']|["']$/g, '') || '';
const CONTENT_API_URL = 'https://content-api.wildberries.ru';

interface CardUpdate {
  nmId: number;
  newTitle: string;
}

interface Card {
  nmID: number;
  imtID: number;
  vendorCode: string;
  subjectID: number;
  subjectName: string;
  brand: string;
  title: string;
  description?: string;
  photos: Array<{ big: string }>;
  dimensions?: { length: number; width: number; height: number };
  characteristics: Array<{ id: number; name: string; value: string | string[] }>;
  sizes: Array<{ techSize: string; wbSize: string; skus: string[] }>;
}

async function fetchWB<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': WB_API_TOKEN,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WB API Error ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function getAllCards(): Promise<Card[]> {
  const allCards: Card[] = [];
  let cursor: Record<string, unknown> = { limit: 100 };

  while (true) {
    const result = await fetchWB<{
      cards?: Card[];
      cursor?: { total: number; updatedAt?: string; nmID?: number };
    }>(`${CONTENT_API_URL}/content/v2/get/cards/list`, {
      method: 'POST',
      body: JSON.stringify({
        settings: {
          cursor,
          filter: { withPhoto: -1 },
        },
      }),
    });

    const cards = result.cards || [];
    if (cards.length === 0) break;

    allCards.push(...cards);
    console.log(`Loaded ${allCards.length} cards...`);

    if (!result.cursor?.updatedAt || !result.cursor?.nmID) break;

    cursor = {
      limit: 100,
      updatedAt: result.cursor.updatedAt,
      nmID: result.cursor.nmID,
    };
  }

  return allCards;
}

async function updateCard(card: Card, newTitle: string): Promise<void> {
  const payload = {
    nmID: card.nmID,
    vendorCode: card.vendorCode,
    brand: card.brand,
    title: newTitle,
    description: card.description,
    dimensions: card.dimensions,
    characteristics: card.characteristics,
    sizes: card.sizes,
  };

  await fetchWB(`${CONTENT_API_URL}/content/v2/cards/update`, {
    method: 'POST',
    body: JSON.stringify([payload]),
  });
}

async function main() {
  const updates: CardUpdate[] = [
    // Группа 1: Подвески с уникальными названиями
    { nmId: 292662989, newTitle: 'Подвеска "Меркаба" с метеоритом Муонионалуста' },
    { nmId: 446306396, newTitle: 'Подвеска с метеоритом Муонионалуста и молдавитом' },
    { nmId: 387711805, newTitle: 'Подвеска "Сияние" с метеоритом Муонионалуста' },
    { nmId: 635576126, newTitle: 'Подвеска "Шестиконечная звезда" с метеоритом Муонионалуста' },
    { nmId: 676688948, newTitle: 'Подвеска "Непобедимое солнце" с метеоритом Муонионалуста' },

    // Группа 2: Эзотерика -> нейтральные названия
    { nmId: 731575790, newTitle: 'Коллекционный метеорит Кампо Дель Сьело железный' },
    { nmId: 327127352, newTitle: 'Браслет "Синергия" с метеоритом Алетай' },
    { nmId: 292157496, newTitle: 'Браслет "Звёздный путь" с метеоритом Алетай и бусиной Дзи' },
    { nmId: 303598439, newTitle: 'Браслет с метеоритом Алетай и лабрадоритом' },

    // Группа 3: Браслеты с Алетай
    { nmId: 561815738, newTitle: 'Браслет "Непобедимое Солнце" с метеоритом Алетай и Дзи' },
    { nmId: 567344728, newTitle: 'Браслет с метеоритом Алетай и Дзи "Сердце Будды"' },

    // Группа 4: Кулоны из Алетай
    { nmId: 678802293, newTitle: 'Кулон "Тибетский щит" из метеорита Алетай' },
    { nmId: 685257465, newTitle: 'Кулон "Би-диск" из метеорита Алетай' },

    // Группа 5: Коллекционный метеорит Сихотэ-Алинь
    { nmId: 445351461, newTitle: 'Коллекционный метеорит Сихотэ-Алинь 12 гр' },
    { nmId: 445397811, newTitle: 'Коллекционный метеорит Сихотэ-Алинь 24 гр' },

    // Группа 6: Подвеска из метеорита Сихотэ-Алинь
    { nmId: 679816837, newTitle: 'Подвеска "Космический странник" из метеорита Сихотэ-Алинь' },
    { nmId: 685264731, newTitle: 'Подвеска "Небесный посланник" из метеорита Сихотэ-Алинь' },

    // Группа 7: Метеорит Сихотэ-Алинь (простые названия)
    { nmId: 526534735, newTitle: 'Метеорит Сихотэ-Алинь индивидуальный образец №1' },
    { nmId: 526554159, newTitle: 'Метеорит Сихотэ-Алинь индивидуальный образец №2' },
    { nmId: 528130767, newTitle: 'Метеорит Сихотэ-Алинь индивидуальный образец №3' },

    // Группа 8: Коллекционный образец метеорит Сихотэ-Алинь
    { nmId: 447659169, newTitle: 'Коллекционный образец метеорит Сихотэ-Алинь №1' },
    { nmId: 447659932, newTitle: 'Коллекционный образец метеорит Сихотэ-Алинь №2' },
    { nmId: 528126045, newTitle: 'Коллекционный образец метеорит Сихотэ-Алинь №3' },
    { nmId: 528127722, newTitle: 'Коллекционный образец метеорит Сихотэ-Алинь №4' },
    { nmId: 528137045, newTitle: 'Коллекционный образец метеорит Сихотэ-Алинь №5' },

    // Группа 9: Коллекционный образец метеорит Дронино
    { nmId: 366261520, newTitle: 'Коллекционный образец метеорит Дронино №1' },
    { nmId: 374584531, newTitle: 'Коллекционный образец метеорит Дронино №2' },
    { nmId: 516959913, newTitle: 'Коллекционный образец метеорит Дронино №3' },
    { nmId: 516988052, newTitle: 'Коллекционный образец метеорит Дронино №4' },
    { nmId: 517010714, newTitle: 'Коллекционный образец метеорит Дронино №5' },
    { nmId: 542418030, newTitle: 'Коллекционный образец метеорит Дронино №6' },
    { nmId: 597008791, newTitle: 'Коллекционный образец метеорит Дронино №7' },

    // Группа 10: Коллекционный образец метеорит Campo del Cielo
    { nmId: 468695583, newTitle: 'Коллекционный образец метеорит Campo del Cielo №1' },
    { nmId: 468705942, newTitle: 'Коллекционный образец метеорит Campo del Cielo №2' },
    { nmId: 699156637, newTitle: 'Коллекционный образец метеорит Campo del Cielo №3' },
    { nmId: 699184297, newTitle: 'Коллекционный образец метеорит Campo del Cielo №4' },
  ];

  console.log('Loading all cards from WB API...');
  const allCards = await getAllCards();
  console.log(`Total cards loaded: ${allCards.length}`);

  // Create map for quick lookup
  const cardMap = new Map<number, Card>();
  allCards.forEach(card => cardMap.set(card.nmID, card));

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    const card = cardMap.get(update.nmId);

    if (!card) {
      console.error(`[ERROR] Card ${update.nmId} not found!`);
      errorCount++;
      continue;
    }

    try {
      console.log(`[${update.nmId}] "${card.title}" -> "${update.newTitle}"`);
      await updateCard(card, update.newTitle);
      console.log(`[${update.nmId}] OK`);
      successCount++;

      // Rate limiting - 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[${update.nmId}] ERROR:`, error);
      errorCount++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
