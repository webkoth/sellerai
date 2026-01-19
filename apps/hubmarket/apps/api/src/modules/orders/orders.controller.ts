import { Controller, Get, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('marketplaceAccountId') marketplaceAccountId?: string,
  ) {
    return this.ordersService.findAll({ page, limit, marketplaceAccountId });
  }
}
