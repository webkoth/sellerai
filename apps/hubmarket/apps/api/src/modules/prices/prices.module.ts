import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { CanonicalProduct, ProductMarketplaceMapping } from '@hubmarket/core';

@Module({
  imports: [
    TypeOrmModule.forFeature([CanonicalProduct, ProductMarketplaceMapping]),
  ],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
