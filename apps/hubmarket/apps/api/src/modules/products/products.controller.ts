import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('status') status?: string,
  ) {
    return this.productsService.findAll({ page, limit, status });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Get(':id/mappings')
  async getMappings(@Param('id') id: string) {
    return this.productsService.getMappings(id);
  }
}
