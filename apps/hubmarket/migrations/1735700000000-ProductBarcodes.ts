import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductBarcodes1735700000000 implements MigrationInterface {
  name = 'ProductBarcodes1735700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create product_barcodes table for multiple barcodes per product
    await queryRunner.query(`
      CREATE TABLE "product_barcodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "canonicalProductId" uuid NOT NULL,
        "barcode" varchar(50) NOT NULL,
        "sizeCode" varchar(50),
        "techSize" varchar(100),
        "wmsId" varchar(100),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_barcodes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pb_canonical_product" FOREIGN KEY ("canonicalProductId")
          REFERENCES "canonical_products"("id") ON DELETE CASCADE
      )
    `);

    // Unique constraint on barcode (globally unique)
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_product_barcodes_barcode" ON "product_barcodes" ("barcode")`);

    // Index for product lookup
    await queryRunner.query(`CREATE INDEX "IDX_product_barcodes_canonicalProductId" ON "product_barcodes" ("canonicalProductId")`);

    // 2. Add sizes JSONB column to canonical_products
    await queryRunner.query(`
      ALTER TABLE "canonical_products"
      ADD COLUMN "sizes" jsonb NOT NULL DEFAULT '[]'
    `);

    // 3. Migrate existing barcode data to product_barcodes table
    await queryRunner.query(`
      INSERT INTO "product_barcodes" ("canonicalProductId", "barcode")
      SELECT "id", "barcode"
      FROM "canonical_products"
      WHERE "barcode" IS NOT NULL AND "barcode" != ''
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove sizes column
    await queryRunner.query(`ALTER TABLE "canonical_products" DROP COLUMN IF EXISTS "sizes"`);

    // Drop product_barcodes table
    await queryRunner.query(`DROP TABLE IF EXISTS "product_barcodes"`);
  }
}
