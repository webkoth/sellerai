import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MarketplaceAccount,
  CreateMarketplaceAccountDto,
  UpdateMarketplaceAccountDto,
} from '@hubmarket/core';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepository: Repository<MarketplaceAccount>,
  ) {}

  async findAll(): Promise<MarketplaceAccount[]> {
    return this.accountRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<MarketplaceAccount> {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Marketplace account ${id} not found`);
    }
    return account;
  }

  async findMaster(organizationId: string): Promise<MarketplaceAccount | null> {
    return this.accountRepository.findOne({
      where: { organizationId, isMaster: true, isActive: true },
    });
  }

  async findSlaves(organizationId: string): Promise<MarketplaceAccount[]> {
    return this.accountRepository.find({
      where: { organizationId, isMaster: false, isActive: true },
    });
  }

  async findAllActive(organizationId: string): Promise<MarketplaceAccount[]> {
    return this.accountRepository.find({
      where: { organizationId, isActive: true },
    });
  }

  async create(dto: CreateMarketplaceAccountDto): Promise<MarketplaceAccount> {
    const account = this.accountRepository.create(dto);
    return this.accountRepository.save(account);
  }

  async update(
    id: string,
    dto: UpdateMarketplaceAccountDto,
  ): Promise<MarketplaceAccount> {
    const account = await this.findById(id);
    Object.assign(account, dto);
    return this.accountRepository.save(account);
  }

  async remove(id: string): Promise<void> {
    const account = await this.findById(id);
    await this.accountRepository.remove(account);
  }

  async setAsMaster(id: string): Promise<MarketplaceAccount> {
    const account = await this.findById(id);

    // Remove master status from all accounts in the same organization
    await this.accountRepository.update(
      { organizationId: account.organizationId, isMaster: true },
      { isMaster: false },
    );

    // Set this account as master
    account.isMaster = true;
    return this.accountRepository.save(account);
  }
}
