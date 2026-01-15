/**
 * Script to get WB products with FBS stock and prepare for Ozon import
 */
import 'dotenv/config';

const WB_TOKEN = process.env.WB_API_TOKEN!;
const WAREHOUSE_ID = 1408913; // "Мой склад Краснодар"

interface WBCard {
  nmId: number;
  vendorCode: string;
  subjectName: string;
  brand: string;
  title: string;
  description?: string;
  photos: string[];
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weightBrutto?: number;
  };
  characteristics: Array<{
    id: number;
    name: string;
    value: string[];
  }>;
  sizes: Array<{
    chrtID: number;
    techSize: string;
    wbSize: string;
    skus: string[];
  }>;
}

interface WBPrice {
  nmID: number;
  sizes: Array<{
    price: number;
    discountedPrice: number;
  }>;
  discount?: number;
}

interface FBSStock {
  sku: string;
  amount: number;
}

async function fetchWB<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': WB_TOKEN,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WB API Error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// Get all product cards with photos
async function getAllCards(): Promise<WBCard[]> {
  const url = 'https://content-api.wildberries.ru/content/v2/get/cards/list';
  const allCards: WBCard[] = [];
  let cursor: Record<string, unknown> = { limit: 100 };

  while (true) {
    const result = await fetchWB<{
      cards?: WBCard[];
      cursor?: { total: number; updatedAt?: string; nmID?: number };
    }>(url, {
      method: 'POST',
      body: JSON.stringify({
        settings: {
          cursor,
          filter: { withPhoto: 1 },
        },
      }),
    });

    const cards = result.cards || [];
    if (cards.length === 0) break;

    allCards.push(...cards);

    const total = result.cursor?.total || 0;
    if (total < 100) break;

    cursor = {
      limit: 100,
      updatedAt: result.cursor?.updatedAt,
      nmID: result.cursor?.nmID,
    };
  }

  return allCards;
}

// Get prices for products
async function getPrices(): Promise<Map<number, { price: number; discount: number }>> {
  const prices = new Map<number, { price: number; discount: number }>();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `https://discounts-prices-api.wildberries.ru/api/v2/list/goods/filter?limit=${limit}&offset=${offset}`;
    const result = await fetchWB<{
      data?: { listGoods?: WBPrice[] };
    }>(url);

    const goods = result.data?.listGoods || [];
    if (goods.length === 0) break;

    for (const item of goods) {
      const size = item.sizes?.[0];
      if (size) {
        prices.set(item.nmID, {
          price: size.price,
          discount: item.discount || 0,
        });
      }
    }

    if (goods.length < limit) break;
    offset += limit;
  }

  return prices;
}

// Get FBS stocks by barcodes
async function getFBSStocks(barcodes: string[]): Promise<Map<string, number>> {
  const stocks = new Map<string, number>();

  if (barcodes.length === 0) return stocks;

  // Split into batches of 1000
  for (let i = 0; i < barcodes.length; i += 1000) {
    const batch = barcodes.slice(i, i + 1000);
    const url = `https://marketplace-api.wildberries.ru/api/v3/stocks/${WAREHOUSE_ID}`;

    try {
      const result = await fetchWB<{ stocks?: FBSStock[] }>(url, {
        method: 'POST',
        body: JSON.stringify({ skus: batch }),
      });

      for (const item of result.stocks || []) {
        stocks.set(item.sku, item.amount);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  }

  return stocks;
}

// Main execution
async function main() {
  console.log('🔄 Получаем карточки товаров WB...');
  const cards = await getAllCards();
  console.log(`✅ Получено ${cards.length} карточек`);

  console.log('🔄 Получаем цены...');
  const prices = await getPrices();
  console.log(`✅ Получено ${prices.size} цен`);

  // Extract all barcodes
  const barcodeToCard = new Map<string, WBCard>();
  for (const card of cards) {
    for (const size of card.sizes || []) {
      for (const barcode of size.skus || []) {
        barcodeToCard.set(barcode, card);
      }
    }
  }
  console.log(`📦 Всего баркодов: ${barcodeToCard.size}`);

  console.log('🔄 Получаем FBS остатки...');
  const stocks = await getFBSStocks([...barcodeToCard.keys()]);
  console.log(`✅ Получено остатков для ${stocks.size} баркодов`);

  // Filter products with stock >= 1
  const productsInStock: Array<{
    nmId: number;
    barcode: string;
    vendorCode: string;
    title: string;
    description?: string;
    photos: string[];
    price: number;
    discount: number;
    stock: number;
    brand: string;
    category: string;
    dimensions?: WBCard['dimensions'];
    characteristics: WBCard['characteristics'];
  }> = [];

  for (const [barcode, amount] of stocks) {
    if (amount >= 1) {
      const card = barcodeToCard.get(barcode);
      if (card) {
        const priceData = prices.get(card.nmId);
        productsInStock.push({
          nmId: card.nmId,
          barcode,
          vendorCode: card.vendorCode,
          title: card.title,
          description: card.description,
          photos: card.photos,
          price: priceData?.price || 0,
          discount: priceData?.discount || 0,
          stock: amount,
          brand: card.brand,
          category: card.subjectName,
          dimensions: card.dimensions,
          characteristics: card.characteristics,
        });
      }
    }
  }

  console.log('\n📊 РЕЗУЛЬТАТЫ:');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Всего карточек WB: ${cards.length}`);
  console.log(`Товаров с остатком >= 1: ${productsInStock.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log('📦 ТОВАРЫ В НАЛИЧИИ:');
  for (const product of productsInStock) {
    const discountedPrice = product.price * (1 - product.discount / 100);
    console.log(`\n  • ${product.title.substring(0, 50)}...`);
    console.log(`    nmId: ${product.nmId}`);
    console.log(`    Артикул: ${product.vendorCode}`);
    console.log(`    Баркод: ${product.barcode}`);
    console.log(`    Цена: ${product.price}₽ (скидка ${product.discount}% → ${discountedPrice.toFixed(0)}₽)`);
    console.log(`    Остаток: ${product.stock} шт.`);
    console.log(`    Категория: ${product.category}`);
  }

  // Save to file for Ozon import
  const outputPath = './products-for-ozon.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(productsInStock, null, 2));
  console.log(`\n💾 Данные сохранены в ${outputPath}`);
}

main().catch(console.error);
