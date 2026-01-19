import { Injectable } from '@nestjs/common';
import { CanonicalProduct, ProductAttributes } from '@hubmarket/core';
import {
  YandexOffer,
  YandexPriceUpdate,
  YandexStockUpdate,
} from '@hubmarket/marketplace-clients';
import {
  MarketplaceTransformer,
  generateUUID,
  normalizePrice,
} from './transformer.interface';

@Injectable()
export class YandexTransformer
  implements MarketplaceTransformer<YandexOffer, YandexPriceUpdate, YandexStockUpdate>
{
  /**
   * Transform Yandex offer to canonical format
   */
  toCanonical(
    yandexOffer: YandexOffer,
    existingCanonical?: Partial<CanonicalProduct>,
  ): Partial<CanonicalProduct> {
    return {
      id: existingCanonical?.id || generateUUID(),
      internalSku: yandexOffer.offerId,
      barcode: yandexOffer.barcodes?.[0] || existingCanonical?.barcode || null,
      name: yandexOffer.name,
      brand: yandexOffer.vendor || existingCanonical?.brand || null,
      description: yandexOffer.description || existingCanonical?.description || null,
      attributes: this.mapAttributes(yandexOffer, existingCanonical?.attributes),
      images: yandexOffer.pictures || existingCanonical?.images || [],
      basePrice: yandexOffer.basicPrice?.value ?? existingCanonical?.basePrice ?? null,
      currency: yandexOffer.basicPrice?.currencyId || 'RUB',
      status: yandexOffer.archived ? 'archived' : 'active',
      updatedAt: new Date(),
    };
  }

  /**
   * Transform canonical to Yandex offer format
   */
  fromCanonical(canonical: CanonicalProduct): YandexOffer {
    return {
      offerId: canonical.internalSku,
      name: canonical.name,
      vendor: canonical.brand || undefined,
      description: canonical.description || undefined,
      barcodes: canonical.barcode ? [canonical.barcode] : undefined,
      pictures: canonical.images,
      manufacturerCountries: canonical.attributes?.country
        ? [canonical.attributes.country]
        : undefined,
      weightDimensions: this.mapWeightDimensions(canonical.attributes),
    };
  }

  /**
   * Create Yandex price update from canonical
   */
  toPriceUpdate(canonical: CanonicalProduct, externalId: string): YandexPriceUpdate {
    return {
      offerId: canonical.internalSku,
      price: {
        value: canonical.basePrice || 0,
        currencyId: canonical.currency || 'RUB',
      },
    };
  }

  /**
   * Create Yandex stock update from canonical
   */
  toStockUpdate(
    canonical: CanonicalProduct,
    externalId: string,
    warehouseId: string,
    quantity: number,
  ): YandexStockUpdate {
    return {
      sku: canonical.internalSku,
      warehouseId: parseInt(warehouseId, 10),
      items: [
        {
          count: quantity,
          type: 'FIT',
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  /**
   * Extract marketplace-specific data for mapping
   */
  extractMappingData(yandexOffer: YandexOffer): Record<string, unknown> {
    return {
      offerId: yandexOffer.offerId,
    };
  }

  private mapAttributes(
    yandexOffer: YandexOffer,
    existing?: ProductAttributes,
  ): ProductAttributes {
    const attrs: ProductAttributes = { ...existing };

    // Map Yandex characteristics to universal format
    for (const char of yandexOffer.characteristics || []) {
      const name = char.name.toLowerCase();
      if (name.includes('цвет') || name.includes('color')) {
        attrs.color = char.value;
      } else if (name.includes('размер') || name.includes('size')) {
        attrs.size = char.value;
      }
    }

    // Map weight/dimensions
    if (yandexOffer.weightDimensions) {
      attrs.weight = yandexOffer.weightDimensions.weight;
      attrs.dimensions = {
        length: yandexOffer.weightDimensions.length,
        width: yandexOffer.weightDimensions.width,
        height: yandexOffer.weightDimensions.height,
      };
    }

    // Map country
    if (yandexOffer.manufacturerCountries?.length) {
      attrs.country = yandexOffer.manufacturerCountries[0];
    }

    return attrs;
  }

  private mapWeightDimensions(
    attrs?: ProductAttributes,
  ): YandexOffer['weightDimensions'] {
    if (!attrs?.dimensions && !attrs?.weight) return undefined;

    return {
      length: attrs.dimensions?.length || 0,
      width: attrs.dimensions?.width || 0,
      height: attrs.dimensions?.height || 0,
      weight: attrs.weight || 0,
    };
  }
}
