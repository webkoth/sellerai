import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CanonicalProduct, ProductMarketplaceMapping, CategoryMapping, AttributeMapping } from '@hubmarket/core';

@Module({
  imports: [
    TypeOrmModule.forFeature([CanonicalProduct, ProductMarketplaceMapping, CategoryMapping, AttributeMapping]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
