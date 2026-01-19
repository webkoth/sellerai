import { Injectable } from '@nestjs/common';
import { CanonicalProduct, ProductAttributes } from '@hubmarket/core';
import {
  OzonProduct,
  OzonPriceUpdate,
  OzonStockUpdate,
} from '@hubmarket/marketplace-clients';
import {
  MarketplaceTransformer,
  generateUUID,
  normalizePrice,
} from './transformer.interface';

@Injectable()
export class OzonTransformer
  implements MarketplaceTransformer<OzonProduct, OzonPriceUpdate, OzonStockUpdate>
{
  /**
   * Transform Ozon product to canonical format
   */
  toCanonical(
    ozonProduct: OzonProduct,
    existingCanonical?: Partial<CanonicalProduct>,
  ): Partial<CanonicalProduct> {
    return {
      id: existingCanonical?.id || generateUUID(),
      internalSku: ozonProduct.offer_id,
      barcode: ozonProduct.barcode || existingCanonical?.barcode || null,
      name: ozonProduct.name,
      brand: this.extractAttribute(ozonProduct.attributes, 85) || existingCanonical?.brand || null, // 85 = Brand
      description: existingCanonical?.description || null, // Ozon doesn't return description in list
      attributes: this.mapAttributes(ozonProduct, existingCanonical?.attributes),
      images: ozonProduct.images || existingCanonical?.images || [],
      basePrice: normalizePrice(ozonProduct.price) ?? existingCanonical?.basePrice ?? null,
      currency: 'RUB',
      status: ozonProduct.archived ? 'archived' : 'active',
      updatedAt: new Date(),
    };
  }

  /**
   * Transform canonical to Ozon product import format
   */
  fromCanonical(canonical: CanonicalProduct): OzonProduct {
    return {
      id: 0, // Will be set by Ozon
      offer_id: canonical.internalSku,
      name: canonical.name,
      barcode: canonical.barcode || undefined,
      price: String(canonical.basePrice || 0),
      images: canonical.images,
      attributes: this.mapAttributesToOzon(canonical.attributes),
    };
  }

  /**
   * Create Ozon price update from canonical
   */
  toPriceUpdate(canonical: CanonicalProduct, externalId: string): OzonPriceUpdate {
    return {
      offer_id: canonical.internalSku,
      product_id: parseInt(externalId, 10) || undefined,
      price: String(canonical.basePrice || 0),
      old_price: canonical.basePrice ? String(canonical.basePrice * 1.1) : undefined, // Optional strikethrough
      min_price: canonical.minPrice ? String(canonical.minPrice) : undefined,
    };
  }

  /**
   * Create Ozon stock update from canonical (FBO)
   */
  toStockUpdate(
    canonical: CanonicalProduct,
    externalId: string,
    warehouseId: string,
    quantity: number,
  ): OzonStockUpdate {
    return {
      offer_id: canonical.internalSku,
      product_id: parseInt(externalId, 10) || undefined,
      stock: quantity,
    };
  }

  /**
   * Create Ozon FBS stock update (with warehouse)
   */
  toStockUpdateFBS(
    canonical: CanonicalProduct,
    externalId: string,
    warehouseId: number,
    quantity: number,
  ): { offer_id: string; product_id?: number; warehouse_id: number; stock: number } {
    return {
      offer_id: canonical.internalSku,
      product_id: parseInt(externalId, 10) || undefined,
      warehouse_id: warehouseId,
      stock: quantity,
    };
  }

  /**
   * Extract marketplace-specific data for mapping
   */
  extractMappingData(ozonProduct: OzonProduct): Record<string, unknown> {
    return {
      product_id: ozonProduct.id,
      offer_id: ozonProduct.offer_id,
      is_fbo_visible: ozonProduct.is_fbo_visible,
      is_fbs_visible: ozonProduct.is_fbs_visible,
    };
  }

  private extractAttribute(
    attributes: OzonProduct['attributes'],
    attributeId: number,
  ): string | null {
    const attr = attributes?.find((a) => a.attribute_id === attributeId);
    return attr?.values?.[0]?.value || null;
  }

  private mapAttributes(
    ozonProduct: OzonProduct,
    existing?: ProductAttributes,
  ): ProductAttributes {
    return {
      ...existing,
      // Map common Ozon attribute IDs to universal names
      color: this.extractAttribute(ozonProduct.attributes, 10096) || existing?.color, // Color
      size: this.extractAttribute(ozonProduct.attributes, 10097) || existing?.size, // Size
    };
  }

  private mapAttributesToOzon(attrs?: ProductAttributes): OzonProduct['attributes'] {
    if (!attrs) return [];

    const attributes: OzonProduct['attributes'] = [];

    // Map universal attributes back to Ozon format
    if (attrs.color && typeof attrs.color === 'string') {
      attributes.push({
        attribute_id: 10096,
        values: [{ value: attrs.color }],
      });
    }

    if (attrs.brand && typeof attrs.brand === 'string') {
      attributes.push({
        attribute_id: 85,
        values: [{ value: attrs.brand }],
      });
    }

    return attributes;
  }
}
