import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Command } from 'commander';
import {
  MarketplaceAccount,
  CanonicalProduct,
  ProductMarketplaceMapping,
} from '@hubmarket/core';

@Injectable()
export class SyncCommand {
  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(CanonicalProduct)
    private readonly productRepo: Repository<CanonicalProduct>,
    @InjectRepository(ProductMarketplaceMapping)
    private readonly mappingRepo: Repository<ProductMarketplaceMapping>,
  ) {}

  register(program: Command): void {
    const sync = program
      .command('sync')
      .description('Sync management commands');

    // List accounts
    sync
      .command('accounts')
      .description('List marketplace accounts')
      .option('-o, --org <organizationId>', 'Filter by organization ID')
      .action(async (options) => {
        const where = options.org ? { organizationId: options.org } : {};
        const accounts = await this.accountRepo.find({ where });

        if (accounts.length === 0) {
          console.log('No marketplace accounts found.');
          return;
        }

        console.log('\nMarketplace Accounts:');
        console.log('─'.repeat(80));

        for (const account of accounts) {
          console.log(`\n${account.name}`);
          console.log(`  ID: ${account.id}`);
          console.log(`  Marketplace: ${account.marketplace}`);
          console.log(`  Master: ${account.isMaster ? 'Yes' : 'No'}`);
          console.log(`  Active: ${account.isActive ? 'Yes' : 'No'}`);
          console.log(`  Last Sync: ${account.lastSyncAt || 'Never'}`);
        }
      });

    // Show sync status
    sync
      .command('status')
      .description('Show sync status')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .action(async (options) => {
        const accounts = await this.accountRepo.find({
          where: { organizationId: options.org },
        });

        const products = await this.productRepo.count({
          where: { organizationId: options.org },
        });

        console.log('\nSync Status:');
        console.log('─'.repeat(60));
        console.log(`\nTotal canonical products: ${products}`);
        console.log(`\nMarketplace accounts: ${accounts.length}`);

        for (const account of accounts) {
          const mappings = await this.mappingRepo.count({
            where: { marketplaceAccountId: account.id },
          });

          const syncedMappings = await this.mappingRepo.count({
            where: { marketplaceAccountId: account.id, syncStatus: 'synced' },
          });

          const pendingMappings = await this.mappingRepo.count({
            where: { marketplaceAccountId: account.id, syncStatus: 'pending' },
          });

          const errorMappings = await this.mappingRepo.count({
            where: { marketplaceAccountId: account.id, syncStatus: 'error' },
          });

          console.log(`\n${account.name} (${account.marketplace})${account.isMaster ? ' [MASTER]' : ''}:`);
          console.log(`  Total mappings: ${mappings}`);
          console.log(`  Synced: ${syncedMappings}`);
          console.log(`  Pending: ${pendingMappings}`);
          console.log(`  Errors: ${errorMappings}`);
          console.log(`  Last sync: ${account.lastSyncAt || 'Never'}`);
        }
      });

    // List products
    sync
      .command('products')
      .description('List canonical products')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .option('-l, --limit <limit>', 'Limit results', '20')
      .option('-s, --status <status>', 'Filter by status')
      .action(async (options) => {
        const where: Record<string, unknown> = { organizationId: options.org };
        if (options.status) {
          where.status = options.status;
        }

        const products = await this.productRepo.find({
          where,
          take: parseInt(options.limit, 10),
          order: { updatedAt: 'DESC' },
        });

        if (products.length === 0) {
          console.log('No products found.');
          return;
        }

        console.log('\nCanonical Products:');
        console.log('─'.repeat(100));

        for (const product of products) {
          console.log(`\n${product.name}`);
          console.log(`  ID: ${product.id}`);
          console.log(`  SKU: ${product.internalSku}`);
          console.log(`  Price: ${product.basePrice} ${product.currency}`);
          console.log(`  Stock: ${product.totalStock}`);
          console.log(`  Status: ${product.status}`);
        }
      });

    // Show product mappings
    sync
      .command('mappings')
      .description('Show product marketplace mappings')
      .requiredOption('-p, --product <productId>', 'Canonical product ID')
      .action(async (options) => {
        const mappings = await this.mappingRepo.find({
          where: { canonicalProductId: options.product },
        });

        if (mappings.length === 0) {
          console.log('No mappings found for this product.');
          return;
        }

        console.log('\nProduct Mappings:');
        console.log('─'.repeat(80));

        for (const mapping of mappings) {
          const account = await this.accountRepo.findOne({
            where: { id: mapping.marketplaceAccountId },
          });

          console.log(`\n${account?.name || 'Unknown'} (${account?.marketplace || 'unknown'}):`);
          console.log(`  Mapping ID: ${mapping.id}`);
          console.log(`  External ID: ${mapping.externalId || 'Not set'}`);
          console.log(`  External SKU: ${mapping.externalSku || 'Not set'}`);
          console.log(`  Sync Status: ${mapping.syncStatus}`);
          console.log(`  Current Price: ${mapping.currentPrice || 'Not set'}`);
          console.log(`  Current Stock: ${mapping.currentStock}`);
          console.log(`  Last Sync: ${mapping.lastSyncAt || 'Never'}`);
          if (mapping.lastError) {
            console.log(`  Last Error: ${mapping.lastError}`);
          }
        }
      });

    // Show product details with all mappings
    sync
      .command('product')
      .description('Show detailed product info')
      .requiredOption('-i, --id <id>', 'Product ID')
      .action(async (options) => {
        const product = await this.productRepo.findOne({
          where: { id: options.id },
          relations: ['mappings'],
        });

        if (!product) {
          console.log('Product not found.');
          return;
        }

        console.log('\nProduct Details:');
        console.log('═'.repeat(80));
        console.log(`Name: ${product.name}`);
        console.log(`ID: ${product.id}`);
        console.log(`Internal SKU: ${product.internalSku}`);
        console.log(`Barcode: ${product.barcode || 'Not set'}`);
        console.log(`Brand: ${product.brand || 'Not set'}`);
        console.log(`Base Price: ${product.basePrice} ${product.currency}`);
        console.log(`Min Price: ${product.minPrice || 'Not set'}`);
        console.log(`Total Stock: ${product.totalStock}`);
        console.log(`Status: ${product.status}`);
        console.log(`Category ID: ${product.categoryId || 'Not set'}`);
        console.log(`Category Mapping ID: ${product.categoryMappingId || 'Not set'}`);

        if (product.description) {
          console.log(`\nDescription:\n${product.description.substring(0, 200)}${product.description.length > 200 ? '...' : ''}`);
        }

        if (product.images?.length > 0) {
          console.log(`\nImages: ${product.images.length}`);
        }

        if (Object.keys(product.attributes).length > 0) {
          console.log(`\nAttributes:`);
          for (const [key, value] of Object.entries(product.attributes)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        }

        if (product.mappings?.length > 0) {
          console.log(`\nMarketplace Mappings:`);
          for (const mapping of product.mappings) {
            const account = await this.accountRepo.findOne({
              where: { id: mapping.marketplaceAccountId },
            });
            console.log(`\n  ${account?.marketplace || 'unknown'}:`);
            console.log(`    External ID: ${mapping.externalId || 'Not set'}`);
            console.log(`    External SKU: ${mapping.externalSku || 'Not set'}`);
            console.log(`    Status: ${mapping.syncStatus}`);
            console.log(`    Price: ${mapping.currentPrice || 'Not synced'}`);
            console.log(`    Stock: ${mapping.currentStock}`);
          }
        }
      });
  }
}
