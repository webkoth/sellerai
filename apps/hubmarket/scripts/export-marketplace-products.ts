/**
 * Export products from all marketplaces to JSON files for analysis
 */
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { MarketplaceAccount } from '../libs/core/src';
import {
  WildberriesClient,
  OzonClient,
  YandexMarketClient,
} from '../libs/marketplace-clients/src';

const OUTPUT_DIR = path.join(__dirname, '../data/marketplace-exports');

interface ExportResult {
  marketplace: string;
  exportedAt: string;
  totalProducts: number;
  products: any[];
}

async function getDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'admin',
    database: process.env.DB_DATABASE || 'hubmarket',
    entities: [MarketplaceAccount],
  });
  await ds.initialize();
  return ds;
}

async function exportWildberries(account: MarketplaceAccount): Promise<ExportResult> {
  console.log('\n=== Exporting Wildberries products ===');

  const client = new WildberriesClient({
    token: (account.credentials as any).token || (account.credentials as any).apiKey,
  });

  const allProducts: any[] = [];
  let cursor: number | undefined;

  do {
    const response = await client.getProductsList({
      limit: 100,
      nmID: cursor,
    });

    const products = response.cards || [];
    allProducts.push(...products);

    console.log(`  Fetched ${products.length} products (total: ${allProducts.length})`);

    if (products.length === 100) {
      cursor = products[products.length - 1]?.nmID;
    } else {
      cursor = undefined;
    }
  } while (cursor);

  // Get prices using getProductsWithPrices
  console.log('  Fetching prices...');
  try {
    const pricesResponse = await client.getProductsWithPrices({ limit: 1000 });
    const pricesMap = new Map(
      (pricesResponse.data?.listGoods || []).map((p: any) => [p.nmID, p])
    );

    // Merge prices into products
    for (const product of allProducts) {
      const priceData = pricesMap.get(product.nmID);
      if (priceData) {
        (product as any).priceInfo = priceData;
      }
    }
    console.log(`  Found prices for ${pricesMap.size} products`);
  } catch (e: any) {
    console.log(`  Warning: Could not fetch prices: ${e.message}`);
  }

  // Get stocks
  console.log('  Fetching stocks...');
  try {
    const warehouses = await client.getWarehouses();
    console.log(`  Found ${warehouses?.length || 0} warehouses`);

    for (const warehouse of warehouses || []) {
      try {
        const stocksResponse = await client.getStocks(warehouse.id, []);
        console.log(`  Warehouse ${warehouse.name}: ${stocksResponse.stocks?.length || 0} stock entries`);

        // Map stocks by SKU
        const stocksMap = new Map(
          (stocksResponse.stocks || []).map((s: any) => [s.sku, s])
        );

        // Merge stocks into products
        for (const product of allProducts) {
          const skus = product.sizes?.flatMap((s: any) => s.skus) || [];
          for (const sku of skus) {
            const stockData = stocksMap.get(sku);
            if (stockData) {
              if (!(product as any).stockInfo) {
                (product as any).stockInfo = [];
              }
              (product as any).stockInfo.push({
                warehouse: warehouse.name,
                warehouseId: warehouse.id,
                ...stockData
              });
            }
          }
        }
      } catch (e: any) {
        console.log(`  Warning: Could not fetch stocks for warehouse ${warehouse.name}: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.log(`  Warning: Could not fetch warehouses: ${e.message}`);
  }

  return {
    marketplace: 'wildberries',
    exportedAt: new Date().toISOString(),
    totalProducts: allProducts.length,
    products: allProducts,
  };
}

async function exportOzon(account: MarketplaceAccount): Promise<ExportResult> {
  console.log('\n=== Exporting Ozon products ===');

  const client = new OzonClient({
    clientId: (account.credentials as any).clientId,
    apiKey: (account.credentials as any).apiKey,
  });

  const allProducts: any[] = [];
  let lastId: string | undefined;

  do {
    const response = await client.getProductsList({
      limit: 100,
      last_id: lastId,
    });

    const items = response.result?.items || [];

    // Get detailed info for products (use offer_ids for lookup)
    if (items.length > 0) {
      const offerIds = items.map((item: any) => item.offer_id);

      try {
        const detailsResponse = await client.getProductsInfo({ offer_id: offerIds });
        const detailsMap = new Map(
          (detailsResponse.result?.items || []).map((p: any) => [p.offer_id, p])
        );

        for (const item of items) {
          const details = detailsMap.get(item.offer_id);
          allProducts.push({
            ...item,
            details,
          });
        }
      } catch (e: any) {
        console.log(`  Warning: Could not fetch details: ${e.message}`);
        allProducts.push(...items);
      }
    }

    console.log(`  Fetched ${items.length} products (total: ${allProducts.length})`);

    lastId = response.result?.last_id;
    if (!lastId || items.length < 100) {
      lastId = undefined;
    }
  } while (lastId);

  // Get stocks (with pagination)
  console.log('  Fetching stocks...');
  try {
    const stocksMap = new Map<string, any[]>();
    let stocksLastId: string | undefined;

    do {
      const stocksResponse = await client.getStocksInfo({
        limit: 1000,
        last_id: stocksLastId,
        filter: { visibility: 'ALL' },
      });

      for (const stock of stocksResponse.result?.items || []) {
        const existing = stocksMap.get(stock.offer_id) || [];
        existing.push(stock);
        stocksMap.set(stock.offer_id, existing);
      }

      stocksLastId = stocksResponse.result?.last_id;
      if (!stocksLastId || (stocksResponse.result?.items?.length || 0) < 1000) {
        stocksLastId = undefined;
      }
    } while (stocksLastId);

    for (const product of allProducts) {
      const stocks = stocksMap.get(product.offer_id);
      if (stocks) {
        (product as any).stockInfo = stocks;
      }
    }
    console.log(`  Found stocks for ${stocksMap.size} products`);
  } catch (e: any) {
    console.log(`  Warning: Could not fetch stocks: ${e.message}`);
  }

  // Get prices (with pagination)
  console.log('  Fetching prices...');
  try {
    const pricesMap = new Map<string, any>();
    let pricesLastId: string | undefined;

    do {
      const pricesResponse = await client.getPricesInfo({
        limit: 1000,
        last_id: pricesLastId,
        filter: { visibility: 'ALL' },
      });

      for (const price of pricesResponse.result?.items || []) {
        pricesMap.set(price.offer_id, price);
      }

      pricesLastId = pricesResponse.result?.last_id;
      if (!pricesLastId || (pricesResponse.result?.items?.length || 0) < 1000) {
        pricesLastId = undefined;
      }
    } while (pricesLastId);

    for (const product of allProducts) {
      const price = pricesMap.get(product.offer_id);
      if (price) {
        (product as any).priceInfo = price;
      }
    }
    console.log(`  Found prices for ${pricesMap.size} products`);
  } catch (e: any) {
    console.log(`  Warning: Could not fetch prices: ${e.message}`);
  }

  return {
    marketplace: 'ozon',
    exportedAt: new Date().toISOString(),
    totalProducts: allProducts.length,
    products: allProducts,
  };
}

async function exportYandex(account: MarketplaceAccount): Promise<ExportResult> {
  console.log('\n=== Exporting Yandex Market products ===');

  const client = new YandexMarketClient({
    oauthToken: (account.credentials as any).oauthToken || (account.credentials as any).apiKey,
    businessId: Number((account.credentials as any).businessId),
    campaignId: Number((account.credentials as any).campaignId),
  });

  const allProducts: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await client.getOfferMappings({
      limit: 200,
      page_token: pageToken,
    });

    const mappings = response.result?.offerMappings || [];

    for (const mapping of mappings) {
      allProducts.push({
        offer: mapping.offer,
        mapping: mapping.mapping,
      });
    }

    console.log(`  Fetched ${mappings.length} products (total: ${allProducts.length})`);

    pageToken = response.result?.paging?.nextPageToken;
  } while (pageToken);

  // Get stocks
  console.log('  Fetching stocks...');
  try {
    const stocksResponse = await client.getStocks({ limit: 200 });
    const stocksMap = new Map<string, any>();

    for (const warehouse of stocksResponse.result?.warehouses || []) {
      for (const offer of warehouse.offers || []) {
        stocksMap.set(offer.offerId, {
          warehouse: warehouse.warehouseId,
          ...offer,
        });
      }
    }

    for (const product of allProducts) {
      const stock = stocksMap.get(product.offer?.offerId);
      if (stock) {
        (product as any).stockInfo = stock;
      }
    }
    console.log(`  Found stocks for ${stocksMap.size} products`);
  } catch (e: any) {
    console.log(`  Warning: Could not fetch stocks: ${e.message}`);
  }

  // Get prices
  console.log('  Fetching prices...');
  try {
    const pricesResponse = await client.getPrices({ limit: 200 });
    const pricesMap = new Map(
      (pricesResponse.result?.offers || []).map((o: any) => [o.offerId, o])
    );

    for (const product of allProducts) {
      const price = pricesMap.get(product.offer?.offerId);
      if (price) {
        (product as any).priceInfo = price;
      }
    }
    console.log(`  Found prices for ${pricesMap.size} products`);
  } catch (e: any) {
    console.log(`  Warning: Could not fetch prices: ${e.message}`);
  }

  return {
    marketplace: 'yandex_market',
    exportedAt: new Date().toISOString(),
    totalProducts: allProducts.length,
    products: allProducts,
  };
}

async function main() {
  console.log('Starting marketplace products export...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const ds = await getDataSource();
  const accountRepo = ds.getRepository(MarketplaceAccount);
  const accounts = await accountRepo.find({ where: { isActive: true } });

  console.log(`Found ${accounts.length} active marketplace accounts`);

  const results: ExportResult[] = [];

  for (const account of accounts) {
    try {
      let result: ExportResult;

      switch (account.marketplace) {
        case 'wildberries':
          result = await exportWildberries(account);
          break;
        case 'ozon':
          result = await exportOzon(account);
          break;
        case 'yandex_market':
          result = await exportYandex(account);
          break;
        default:
          console.log(`Unknown marketplace: ${account.marketplace}`);
          continue;
      }

      results.push(result);

      // Save to file
      const filename = `${account.marketplace}_products_${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      console.log(`\nSaved ${result.totalProducts} products to ${filepath}`);

    } catch (error: any) {
      console.error(`\nError exporting ${account.marketplace}:`, error.message);
    }
  }

  await ds.destroy();

  console.log('\n=== Export Summary ===');
  for (const result of results) {
    console.log(`${result.marketplace}: ${result.totalProducts} products`);
  }
}

main().catch(console.error);
