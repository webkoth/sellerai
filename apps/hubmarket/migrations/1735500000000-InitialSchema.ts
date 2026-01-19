import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1735500000000 implements MigrationInterface {
  name = 'InitialSchema1735500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. marketplace_accounts
    await queryRunner.query(`
      CREATE TABLE "marketplace_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "marketplace" varchar(50) NOT NULL,
        "name" varchar(255) NOT NULL,
        "isMaster" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "credentials" jsonb NOT NULL,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "lastSyncAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_marketplace_accounts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_marketplace_accounts_organizationId" ON "marketplace_accounts" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_marketplace_accounts_org_mp" ON "marketplace_accounts" ("organizationId", "marketplace")`);

    // 2. canonical_products
    await queryRunner.query(`
      CREATE TABLE "canonical_products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "internalSku" varchar(255) NOT NULL,
        "barcode" varchar(50),
        "name" varchar(500) NOT NULL,
        "brand" varchar(255),
        "description" text,
        "categoryId" varchar(100),
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "images" jsonb NOT NULL DEFAULT '[]',
        "basePrice" decimal(15,2),
        "minPrice" decimal(15,2),
        "currency" varchar(3) NOT NULL DEFAULT 'RUB',
        "totalStock" integer NOT NULL DEFAULT 0,
        "status" varchar(50) NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_canonical_products" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_canonical_products_organizationId" ON "canonical_products" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_canonical_products_internalSku" ON "canonical_products" ("internalSku")`);
    await queryRunner.query(`CREATE INDEX "IDX_canonical_products_barcode" ON "canonical_products" ("barcode")`);
    await queryRunner.query(`CREATE INDEX "IDX_canonical_products_status" ON "canonical_products" ("status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_canonical_products_org_sku" ON "canonical_products" ("organizationId", "internalSku")`);

    // 3. product_marketplace_mappings
    await queryRunner.query(`
      CREATE TABLE "product_marketplace_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "canonicalProductId" uuid NOT NULL,
        "marketplaceAccountId" uuid NOT NULL,
        "externalId" varchar(255),
        "externalSku" varchar(255),
        "marketplaceUrl" varchar(500),
        "marketplaceData" jsonb NOT NULL DEFAULT '{}',
        "syncStatus" varchar(50) NOT NULL DEFAULT 'pending',
        "lastSyncAt" TIMESTAMP WITH TIME ZONE,
        "lastError" text,
        "currentPrice" decimal(15,2),
        "oldPrice" decimal(15,2),
        "currentStock" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_marketplace_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pmm_canonical_product" FOREIGN KEY ("canonicalProductId")
          REFERENCES "canonical_products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pmm_marketplace_account" FOREIGN KEY ("marketplaceAccountId")
          REFERENCES "marketplace_accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_pmm_canonicalProductId" ON "product_marketplace_mappings" ("canonicalProductId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pmm_marketplaceAccountId" ON "product_marketplace_mappings" ("marketplaceAccountId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pmm_externalId" ON "product_marketplace_mappings" ("externalId")`);
    await queryRunner.query(`CREATE INDEX "IDX_pmm_externalSku" ON "product_marketplace_mappings" ("externalSku")`);
    await queryRunner.query(`CREATE INDEX "IDX_pmm_syncStatus" ON "product_marketplace_mappings" ("syncStatus")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_pmm_product_account" ON "product_marketplace_mappings" ("canonicalProductId", "marketplaceAccountId")`);

    // 4. stock_levels
    await queryRunner.query(`
      CREATE TABLE "stock_levels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "canonicalProductId" uuid NOT NULL,
        "warehouseId" uuid NOT NULL,
        "available" integer NOT NULL DEFAULT 0,
        "reserved" integer NOT NULL DEFAULT 0,
        "safetyBuffer" integer NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_levels" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_levels_product" FOREIGN KEY ("canonicalProductId")
          REFERENCES "canonical_products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_stock_levels_canonicalProductId" ON "stock_levels" ("canonicalProductId")`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_levels_warehouseId" ON "stock_levels" ("warehouseId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_stock_levels_product_warehouse" ON "stock_levels" ("canonicalProductId", "warehouseId")`);

    // 5. orders
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "marketplaceAccountId" uuid NOT NULL,
        "externalOrderId" varchar(255) NOT NULL,
        "status" varchar(50) NOT NULL,
        "items" jsonb NOT NULL DEFAULT '[]',
        "stockUpdated" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_marketplace_account" FOREIGN KEY ("marketplaceAccountId")
          REFERENCES "marketplace_accounts"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_orders_organizationId" ON "orders" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_marketplaceAccountId" ON "orders" ("marketplaceAccountId")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_externalOrderId" ON "orders" ("externalOrderId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_orders_account_external" ON "orders" ("marketplaceAccountId", "externalOrderId")`);

    // 6. stock_sync_events
    await queryRunner.query(`
      CREATE TABLE "stock_sync_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "canonicalProductId" uuid NOT NULL,
        "sourceMarketplaceAccountId" uuid,
        "sourceOrderId" uuid,
        "delta" integer NOT NULL,
        "reason" varchar(50) NOT NULL,
        "syncedTo" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_sync_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sse_canonical_product" FOREIGN KEY ("canonicalProductId")
          REFERENCES "canonical_products"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_sse_canonicalProductId" ON "stock_sync_events" ("canonicalProductId")`);
    await queryRunner.query(`CREATE INDEX "IDX_sse_sourceMarketplaceAccountId" ON "stock_sync_events" ("sourceMarketplaceAccountId")`);
    await queryRunner.query(`CREATE INDEX "IDX_sse_createdAt" ON "stock_sync_events" ("createdAt")`);

    // 7. sync_jobs
    await queryRunner.query(`
      CREATE TABLE "sync_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "marketplaceAccountId" uuid,
        "jobType" varchar(50) NOT NULL,
        "direction" varchar(20) NOT NULL,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "totalItems" integer NOT NULL DEFAULT 0,
        "processedItems" integer NOT NULL DEFAULT 0,
        "successItems" integer NOT NULL DEFAULT 0,
        "failedItems" integer NOT NULL DEFAULT 0,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "completedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_organizationId" ON "sync_jobs" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_marketplaceAccountId" ON "sync_jobs" ("marketplaceAccountId")`);
    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_status" ON "sync_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_sync_jobs_createdAt" ON "sync_jobs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_sync_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_marketplace_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "canonical_products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketplace_accounts"`);
  }
}
