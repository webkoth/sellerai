import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import {
  CreateMarketplaceAccountDto,
  UpdateMarketplaceAccountDto,
} from '@hubmarket/core';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  async findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateMarketplaceAccountDto) {
    return this.accountsService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketplaceAccountDto,
  ) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.remove(id);
  }

  @Put(':id/set-master')
  async setAsMaster(@Param('id', ParseUUIDPipe) id: string) {
    return this.accountsService.setAsMaster(id);
  }
}
