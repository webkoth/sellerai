/**
 * Script to prepare WB products for Ozon import
 */
import * as fs from 'fs';

// Ozon category from existing product
const OZON_CATEGORY_ID = 17027899;
const OZON_TYPE_ID = 87458883;

interface WBProduct {
  nmId: number;
  barcode: string;
  vendorCode: string;
  title: string;
  description?: string;
  photos: string[];
  price: number;
  discount: number;
  finalPrice: number;
  stock: number;
  brand: string;
  category: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight?: number;
  };
  characteristics: Array<{
    name: string;
    value: string[];
  }>;
}

interface OzonProduct {
  offerId: string;
  name: string;
  description: string;
  price: string;
  oldPrice: string;
  vat: string;
  descriptionCategoryId: number;
  barcode: string;
  images: string[];
  weight: number;
  depth: number;
  height: number;
  width: number;
  attributes: Array<{
    id: number;
    value?: string;
    values?: Array<{ value?: string; dictionary_value_id?: number }>;
  }>;
}

// Ozon attribute IDs for jewelry category
const OZON_ATTR = {
  // Обязательные
  BRAND: 85,                    // Бренд
  GENDER: 9163,                 // Пол
  SIZE: 5326,                   // Размер изделия
  MODEL_NAME: 9048,             // Название модели
  TYPE: 8229,                   // Тип
  // Дополнительные (для контент-рейтинга)
  MATERIAL: 5309,               // Материал
  COLOR: 10096,                 // Цвет товара
  INSERT_TYPE: 5292,            // Тип вставки
  BRACELET_MODEL: 9925,         // Модель браслета
  BRACELET_TYPE: 23073,         // Вид браслета
  LOCK_TYPE: 5308,              // Вид замка
  COATING: 11364,               // Покрытие
  COUNTRY: 4389,                // Страна-изготовитель
  STYLE: 10016,                 // Стиль украшения
  THEME: 9917,                  // Тематика
  AUDIENCE: 9390,               // Целевая аудитория
  PACKAGING: 4386,              // Упаковка
  JEWELRY_TYPE: 23326,          // Вид украшения
  WEIGHT_PRODUCT: 4383,         // Вес товара, г
};

// Dictionary values
const DICT_VALUES = {
  // Обязательные
  GENDER_MALE: 22880,           // Мужской
  GENDER_FEMALE: 22881,         // Женский
  SIZE_UNIVERSAL: 39290,        // Безразмерный
  TYPE_BRACELET: 87458883,      // Браслет
  // Дополнительные
  MATERIAL_ALLOY: 61767,        // Бижутерный сплав
  COLOR_GRAY: 61576,            // серый
  COLOR_BLACK: 61574,           // черный
  INSERT_NATURAL_STONE: 970941536, // Натуральный камень
  BRACELET_WITH_INSERTS: 970630277, // со вставками
  BRACELET_FROM_STONES: 970835970,  // из камней
  BRACELET_ON_WRIST: 972086681, // на запястье
  LOCK_SLIDING: 972086488,      // Затягивающийся
  LOCK_NONE: 62701,             // Без замка
  COATING_NONE: 971149016,      // Без покрытия
  COUNTRY_RUSSIA: 90295,        // Россия
  STYLE_CASUAL: 970672426,      // Повседневный
  THEME_SYMBOLS: 970673584,     // Символика
  THEME_OTHER: 970673577,       // Другое
  AUDIENCE_ADULT: 43241,        // Взрослая
  PACKAGING_GIFT_BOX: 85843,    // Подарочная коробка
  JEWELRY_BRACELET_HAND: 972866483, // Браслет на руку
};

async function main() {
  // Read WB products
  const productsJson = fs.readFileSync('./products-in-stock.json', 'utf-8');
  const wbProducts: WBProduct[] = JSON.parse(productsJson);

  console.log(`📦 Загружено ${wbProducts.length} товаров WB\n`);

  // Transform to Ozon format
  const ozonProducts: OzonProduct[] = [];
  const skipped: Array<{ nmId: number; reason: string }> = [];

  for (const wb of wbProducts) {
    // Skip products without photos
    if (!wb.photos || wb.photos.length === 0) {
      skipped.push({ nmId: wb.nmId, reason: 'Нет фото' });
      continue;
    }

    // Use vendorCode as offer_id (must be unique)
    const offerId = wb.vendorCode || wb.barcode || String(wb.nmId);

    // Calculate old price for discount display
    const oldPrice = wb.price > wb.finalPrice ? String(wb.price) : '0';

    // Convert dimensions from cm to mm (Ozon uses mm)
    const depth = wb.dimensions?.length ? Math.round(wb.dimensions.length * 10) : 100;
    const height = wb.dimensions?.height ? Math.round(wb.dimensions.height * 10) : 100;
    const width = wb.dimensions?.width ? Math.round(wb.dimensions.width * 10) : 100;
    // Weight in grams (WB sends in kg, so multiply by 1000)
    const weight = wb.dimensions?.weight ? Math.round(wb.dimensions.weight * 1000) : 100;

    // Generate description if missing
    const description = wb.description || `${wb.title || wb.category}. Бренд: ${wb.brand || 'Artefacto'}. Категория: ${wb.category}.`;

    // Generate model name from vendorCode or title
    const modelName = wb.vendorCode || wb.title?.split(' ').slice(0, 3).join(' ') || `Model-${wb.nmId}`;

    const ozonProduct: OzonProduct = {
      offerId,
      name: wb.title || wb.category,
      description,
      price: String(wb.finalPrice),
      oldPrice,
      vat: '0', // No VAT
      descriptionCategoryId: OZON_CATEGORY_ID,
      barcode: wb.barcode,
      images: wb.photos.filter(Boolean).slice(0, 15), // Ozon max 15 images
      weight,
      depth,
      height,
      width,
      attributes: [
        // ═══════════════════════════════════════════
        // ОБЯЗАТЕЛЬНЫЕ АТРИБУТЫ
        // ═══════════════════════════════════════════
        // Бренд (ID 85)
        {
          id: OZON_ATTR.BRAND,
          values: [{ value: 'kotelnikovartifact' }],
        },
        // Пол (ID 9163) - Мужской + Женский = унисекс
        {
          id: OZON_ATTR.GENDER,
          values: [
            { dictionary_value_id: DICT_VALUES.GENDER_MALE },
            { dictionary_value_id: DICT_VALUES.GENDER_FEMALE },
          ],
        },
        // Размер изделия (ID 5326) - Безразмерный
        {
          id: OZON_ATTR.SIZE,
          values: [{ dictionary_value_id: DICT_VALUES.SIZE_UNIVERSAL }],
        },
        // Название модели (ID 9048)
        {
          id: OZON_ATTR.MODEL_NAME,
          values: [{ value: modelName }],
        },
        // Тип (ID 8229) - Браслет
        {
          id: OZON_ATTR.TYPE,
          values: [{ dictionary_value_id: DICT_VALUES.TYPE_BRACELET }],
        },
        // ═══════════════════════════════════════════
        // ДОПОЛНИТЕЛЬНЫЕ АТРИБУТЫ (для контент-рейтинга)
        // ═══════════════════════════════════════════
        // Материал (ID 5309) - Бижутерный сплав
        {
          id: OZON_ATTR.MATERIAL,
          values: [{ dictionary_value_id: DICT_VALUES.MATERIAL_ALLOY }],
        },
        // Цвет товара (ID 10096) - серый
        {
          id: OZON_ATTR.COLOR,
          values: [{ dictionary_value_id: DICT_VALUES.COLOR_GRAY }],
        },
        // Тип вставки (ID 5292) - Натуральный камень
        {
          id: OZON_ATTR.INSERT_TYPE,
          values: [{ dictionary_value_id: DICT_VALUES.INSERT_NATURAL_STONE }],
        },
        // Модель браслета (ID 9925) - со вставками
        {
          id: OZON_ATTR.BRACELET_MODEL,
          values: [{ dictionary_value_id: DICT_VALUES.BRACELET_WITH_INSERTS }],
        },
        // Вид браслета (ID 23073) - на запястье
        {
          id: OZON_ATTR.BRACELET_TYPE,
          values: [{ dictionary_value_id: DICT_VALUES.BRACELET_ON_WRIST }],
        },
        // Вид замка (ID 5308) - Затягивающийся
        {
          id: OZON_ATTR.LOCK_TYPE,
          values: [{ dictionary_value_id: DICT_VALUES.LOCK_SLIDING }],
        },
        // Покрытие (ID 11364) - Без покрытия
        {
          id: OZON_ATTR.COATING,
          values: [{ dictionary_value_id: DICT_VALUES.COATING_NONE }],
        },
        // Страна-изготовитель (ID 4389) - Россия
        {
          id: OZON_ATTR.COUNTRY,
          values: [{ dictionary_value_id: DICT_VALUES.COUNTRY_RUSSIA }],
        },
        // Стиль украшения (ID 10016) - Повседневный
        {
          id: OZON_ATTR.STYLE,
          values: [{ dictionary_value_id: DICT_VALUES.STYLE_CASUAL }],
        },
        // Тематика (ID 9917) - Символика
        {
          id: OZON_ATTR.THEME,
          values: [{ dictionary_value_id: DICT_VALUES.THEME_SYMBOLS }],
        },
        // Целевая аудитория (ID 9390) - Взрослая
        {
          id: OZON_ATTR.AUDIENCE,
          values: [{ dictionary_value_id: DICT_VALUES.AUDIENCE_ADULT }],
        },
        // Упаковка (ID 4386) - Подарочная коробка
        {
          id: OZON_ATTR.PACKAGING,
          values: [{ dictionary_value_id: DICT_VALUES.PACKAGING_GIFT_BOX }],
        },
        // Вид украшения (ID 23326) - Браслет на руку
        {
          id: OZON_ATTR.JEWELRY_TYPE,
          values: [{ dictionary_value_id: DICT_VALUES.JEWELRY_BRACELET_HAND }],
        },
        // Вес товара (ID 4383) - в граммах
        {
          id: OZON_ATTR.WEIGHT_PRODUCT,
          values: [{ value: String(weight) }],
        },
      ],
    };

    ozonProducts.push(ozonProduct);
  }

  console.log('📊 РЕЗУЛЬТАТЫ ПОДГОТОВКИ:');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Готово к импорту: ${ozonProducts.length}`);
  console.log(`⏭️ Пропущено: ${skipped.length}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (skipped.length > 0) {
    console.log('⚠️ Пропущенные товары:');
    for (const s of skipped.slice(0, 10)) {
      console.log(`  - nmId ${s.nmId}: ${s.reason}`);
    }
    if (skipped.length > 10) {
      console.log(`  ... и ещё ${skipped.length - 10}`);
    }
    console.log('');
  }

  // Show sample products
  console.log('📋 ПРИМЕРЫ ТОВАРОВ ДЛЯ ИМПОРТА:');
  for (const p of ozonProducts.slice(0, 5)) {
    console.log(`\n  • ${p.name.substring(0, 50)}...`);
    console.log(`    offer_id: ${p.offerId}`);
    console.log(`    Цена: ${p.price}₽ (было ${p.oldPrice}₽)`);
    console.log(`    Баркод: ${p.barcode}`);
    console.log(`    Фото: ${p.images.length} шт`);
  }

  // Calculate totals
  const totalValue = ozonProducts.reduce((sum, p) => sum + parseInt(p.price), 0);
  console.log('\n📊 СВОДКА:');
  console.log(`  - Товаров: ${ozonProducts.length}`);
  console.log(`  - Общая стоимость: ${totalValue.toLocaleString('ru-RU')}₽`);
  console.log(`  - Категория Ozon: ${OZON_CATEGORY_ID}`);

  // Save to file
  const outputPath = './ozon-import-data.json';
  fs.writeFileSync(outputPath, JSON.stringify(ozonProducts, null, 2));
  console.log(`\n💾 Данные сохранены в ${outputPath}`);

  // Also create a simpler format for MCP tool
  const mcpInput = {
    products: ozonProducts.map(p => ({
      offerId: p.offerId,
      name: p.name,
      description: p.description,
      price: p.price,
      oldPrice: p.oldPrice,
      vat: p.vat,
      descriptionCategoryId: p.descriptionCategoryId,
      barcode: p.barcode,
      images: p.images,
      weight: p.weight,
      depth: p.depth,
      height: p.height,
      width: p.width,
      attributes: p.attributes,
    })),
    confirm: false, // Preview mode
  };

  fs.writeFileSync('./ozon-import-mcp.json', JSON.stringify(mcpInput, null, 2));
  console.log('💾 Данные для MCP сохранены в ozon-import-mcp.json');
}

main().catch(console.error);
