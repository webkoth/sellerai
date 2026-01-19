import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { PricesService } from './prices.service';

@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get(':productId')
  async getProductPrices(@Param('productId') productId: string) {
    return this.pricesService.getProductPrices(productId);
  }

  @Put(':productId')
  async updatePrice(
    @Param('productId') productId: string,
    @Body() body: { basePrice: number; minPrice?: number },
  ) {
    return this.pricesService.updatePrice(productId, body);
  }
}
