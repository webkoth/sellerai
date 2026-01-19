import { Injectable } from '@nestjs/common';
import { MarketplaceType } from '@hubmarket/core';
import { WildberriesTransformer } from './wildberries.transformer';
import { OzonTransformer } from './ozon.transformer';
import { YandexTransformer } from './yandex.transformer';

export type AnyTransformer = WildberriesTransformer | OzonTransformer | YandexTransformer;

@Injectable()
export class TransformerFactory {
  constructor(
    private readonly wbTransformer: WildberriesTransformer,
    private readonly ozonTransformer: OzonTransformer,
    private readonly yandexTransformer: YandexTransformer,
  ) {}

  getTransformer(marketplace: MarketplaceType): AnyTransformer {
    switch (marketplace) {
      case 'wildberries':
        return this.wbTransformer;
      case 'ozon':
        return this.ozonTransformer;
      case 'yandex_market':
        return this.yandexTransformer;
      default:
        throw new Error(`Unknown marketplace: ${marketplace}`);
    }
  }
}
