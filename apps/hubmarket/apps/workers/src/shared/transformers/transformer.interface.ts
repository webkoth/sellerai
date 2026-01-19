import { CanonicalProduct, ProductAttributes } from '@hubmarket/core';

/**
 * Base interface for marketplace transformers
 * Handles conversion between marketplace-specific format and canonical format
 */
export interface MarketplaceTransformer<TMarketplaceProduct, TMarketplacePrice, TMarketplaceStock> {
  /**
   * Transform marketplace product to canonical format
   */
  toCanonical(
    mpProduct: TMarketplaceProduct,
    existingCanonical?: Partial<CanonicalProduct>,
  ): Partial<CanonicalProduct>;

  /**
   * Transform canonical product to marketplace format for create/update
   */
  fromCanonical(canonical: CanonicalProduct): TMarketplaceProduct;

  /**
   * Transform canonical price to marketplace price update format
   */
  toPriceUpdate(
    canonical: CanonicalProduct,
    externalId: string,
  ): TMarketplacePrice;

  /**
   * Transform canonical stock to marketplace stock update format
   */
  toStockUpdate(
    canonical: CanonicalProduct,
    externalId: string,
    warehouseId: string,
    quantity: number,
  ): TMarketplaceStock;
}

/**
 * Common utilities for transformers
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function normalizePrice(price: number | string | undefined): number | null {
  if (price === undefined || price === null) return null;
  const parsed = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(parsed) ? null : parsed;
}

export function normalizeStock(stock: number | string | undefined): number {
  if (stock === undefined || stock === null) return 0;
  const parsed = typeof stock === 'string' ? parseInt(stock, 10) : stock;
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}
