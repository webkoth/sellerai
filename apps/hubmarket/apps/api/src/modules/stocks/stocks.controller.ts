import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get(':productId')
  async getProductStocks(@Param('productId') productId: string) {
    return this.stocksService.getProductStocks(productId);
  }

  @Put(':productId')
  async updateStock(
    @Param('productId') productId: string,
    @Body() body: { available: number; warehouseId?: string },
  ) {
    return this.stocksService.updateStock(productId, body);
  }
}
