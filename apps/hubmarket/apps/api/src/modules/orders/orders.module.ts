import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '@hubmarket/core';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), StocksModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
