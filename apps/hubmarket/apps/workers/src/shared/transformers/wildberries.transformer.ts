import { Injectable } from '@nestjs/common';
import { CanonicalProduct, ProductAttributes, ProductSize } from '@hubmarket/core';
import {
  WBProduct,
  WBPriceUpdate,
  WBStockUpdate,
} from '@hubmarket/marketplace-clients';
import {
  MarketplaceTransformer,
  generateUUID,
  normalizePrice,
} from './transformer.interface';

@Injectable()
export class WildberriesTransformer
  implements MarketplaceTransformer<WBProduct, WBPriceUpdate, WBStockUpdate>
{
  /**
   * Transform WB product to canonical format
   */
  toCanonical(
    wbProduct: WBProduct,
    existingCanonical?: Partial<CanonicalProduct>,
  ): Partial<CanonicalProduct> {
    const firstSize = wbProduct.sizes?.[0];
    const barcode = firstSize?.skus?.[0];
    const price = firstSize?.price ? firstSize.price / 100 : null; // WB uses kopecks
    const sizes = this.extractSizes(wbProduct);

    return {
      id: existingCanonical?.id || generateUUID(),
      internalSku: wbProduct.vendorCode,
      barcode: barcode || existingCanonical?.barcode || null,
      name: wbProduct.title,
      brand: wbProduct.brand || existingCanonical?.brand || null,
      description: wbProduct.description || existingCanonical?.description || null,
      attributes: this.mapAttributes(wbProduct, existingCanonical?.attributes),
      images: wbProduct.photos?.map((p) => p.big) || existingCanonical?.images || [],
      sizes: sizes.length > 0 ? sizes : existingCanonical?.sizes || [],
      basePrice: price ?? existingCanonical?.basePrice ?? null,
      currency: 'RUB',
      status: 'active',
      updatedAt: new Date(),
    };
  }

  /**
   * Extract sizes with barcodes from WB product
   */
  extractSizes(wbProduct: WBProduct): ProductSize[] {
    const sizes: ProductSize[] = [];

    for (const size of wbProduct.sizes || []) {
      for (const sku of size.skus || []) {
        sizes.push({
          sizeCode: size.techSize || '',
          techSize: size.techSize || '',
          barcode: sku,
          wmsId: size.wmsId,
          price: size.price ? size.price / 100 : undefined,
        });
      }
    }

    return sizes;
  }

  /**
   * Transform canonical product to WB format
   * Note: WB has complex card creation, this is simplified
   */
  fromCanonical(canonical: CanonicalProduct): WBProduct {
    return {
      nmID: 0, // Will be set by WB
      imtID: 0,
      vendorCode: canonical.internalSku,
      title: canonical.name,
      brand: canonical.brand || '',
      description: canonical.description || undefined,
      photos: canonical.images?.map((url) => ({ big: url })),
      sizes: [
        {
          techSize: canonical.attributes?.size || '',
          skus: canonical.barcode ? [canonical.barcode] : [],
          price: Math.round((canonical.basePrice || 0) * 100), // Convert to kopecks
        },
      ],
      colors: canonical.attributes?.color ? [canonical.attributes.color] : undefined,
    };
  }

  /**
   * Create WB price update from canonical
   */
  toPriceUpdate(canonical: CanonicalProduct, externalId: string): WBPriceUpdate {
    return {
      nmID: parseInt(externalId, 10),
      price: Math.round((canonical.basePrice || 0) * 100), // Kopecks
      discount: 0,
    };
  }

  /**
   * Create WB stock update from canonical
   */
  toStockUpdate(
    canonical: CanonicalProduct,
    externalId: string,
    warehouseId: string,
    quantity: number,
  ): WBStockUpdate {
    return {
      sku: canonical.barcode || canonical.internalSku,
      amount: quantity,
    };
  }

  /**
   * Extract marketplace-specific data for mapping
   */
  extractMappingData(wbProduct: WBProduct): Record<string, unknown> {
    return {
      nmId: wbProduct.nmID,
      imtId: wbProduct.imtID,
      vendorCode: wbProduct.vendorCode,
    };
  }

  private mapAttributes(
    wbProduct: WBProduct,
    existing?: ProductAttributes,
  ): ProductAttributes {
    return {
      ...existing,
      color: wbProduct.colors?.join(', ') || existing?.color,
      size: wbProduct.sizes?.[0]?.techSize || existing?.size,
    };
  }
}
