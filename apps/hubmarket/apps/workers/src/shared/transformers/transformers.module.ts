import { Module, Global } from '@nestjs/common';
import { WildberriesTransformer } from './wildberries.transformer';
import { OzonTransformer } from './ozon.transformer';
import { YandexTransformer } from './yandex.transformer';
import { TransformerFactory } from './transformer.factory';

@Global()
@Module({
  providers: [
    WildberriesTransformer,
    OzonTransformer,
    YandexTransformer,
    TransformerFactory,
  ],
  exports: [
    WildberriesTransformer,
    OzonTransformer,
    YandexTransformer,
    TransformerFactory,
  ],
})
export class TransformersModule {}
