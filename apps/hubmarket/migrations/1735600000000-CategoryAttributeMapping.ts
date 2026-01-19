import { MigrationInterface, QueryRunner } from 'typeorm';

export class CategoryAttributeMapping1735600000000 implements MigrationInterface {
  name = 'CategoryAttributeMapping1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. category_mappings - Universal category mapping between marketplaces
    await queryRunner.query(`
      CREATE TABLE "category_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "canonicalCategory" varchar(255) NOT NULL,
        "wbSubjectId" integer,
        "wbSubjectName" varchar(255),
        "ozonCategoryId" bigint,
        "ozonTypeId" integer,
        "ozonCategoryName" varchar(255),
        "yandexCategoryId" bigint,
        "yandexCategoryName" varchar(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_category_mappings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_category_mappings_organizationId" ON "category_mappings" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "IDX_category_mappings_wbSubjectId" ON "category_mappings" ("wbSubjectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_category_mappings_ozonCategoryId" ON "category_mappings" ("ozonCategoryId")`);
    await queryRunner.query(`CREATE INDEX "IDX_category_mappings_yandexCategoryId" ON "category_mappings" ("yandexCategoryId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_category_mappings_org_canonical" ON "category_mappings" ("organizationId", "canonicalCategory")`);

    // 2. attribute_mappings - Attribute mapping between marketplaces for each category
    await queryRunner.query(`
      CREATE TABLE "attribute_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "categoryMappingId" uuid NOT NULL,
        "canonicalName" varchar(100) NOT NULL,
        "wbCharacteristicName" varchar(255),
        "wbCharacteristicId" integer,
        "ozonAttributeId" integer,
        "ozonIsDictionary" boolean NOT NULL DEFAULT false,
        "yandexParameterId" bigint,
        "yandexParameterName" varchar(255),
        "isRequiredWb" boolean NOT NULL DEFAULT false,
        "isRequiredOzon" boolean NOT NULL DEFAULT false,
        "isRequiredYandex" boolean NOT NULL DEFAULT false,
        "valueType" varchar(50) NOT NULL DEFAULT 'string',
        "defaultValue" varchar(500),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attribute_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_am_category_mapping" FOREIGN KEY ("categoryMappingId")
          REFERENCES "category_mappings"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_attribute_mappings_categoryMappingId" ON "attribute_mappings" ("categoryMappingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_attribute_mappings_canonicalName" ON "attribute_mappings" ("canonicalName")`);
    await queryRunner.query(`CREATE INDEX "IDX_attribute_mappings_ozonAttributeId" ON "attribute_mappings" ("ozonAttributeId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_attribute_mappings_category_canonical" ON "attribute_mappings" ("categoryMappingId", "canonicalName")`);

    // 3. dictionary_values_cache - Cache for marketplace dictionary values (Ozon dictionary attributes)
    await queryRunner.query(`
      CREATE TABLE "dictionary_values_cache" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "marketplace" varchar(50) NOT NULL,
        "attributeId" integer NOT NULL,
        "valueId" bigint NOT NULL,
        "valueText" varchar(500) NOT NULL,
        "parentValueId" bigint,
        "info" varchar(500),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dictionary_values_cache" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_dvc_marketplace" ON "dictionary_values_cache" ("marketplace")`);
    await queryRunner.query(`CREATE INDEX "IDX_dvc_attributeId" ON "dictionary_values_cache" ("attributeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_dvc_valueText" ON "dictionary_values_cache" ("valueText")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dvc_marketplace_attr_value" ON "dictionary_values_cache" ("marketplace", "attributeId", "valueId")`);

    // 4. Add categoryMappingId to canonical_products for linking products to category mappings
    await queryRunner.query(`
      ALTER TABLE "canonical_products"
      ADD COLUMN "categoryMappingId" uuid,
      ADD CONSTRAINT "FK_cp_category_mapping" FOREIGN KEY ("categoryMappingId")
        REFERENCES "category_mappings"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`CREATE INDEX "IDX_canonical_products_categoryMappingId" ON "canonical_products" ("categoryMappingId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove categoryMappingId from canonical_products
    await queryRunner.query(`ALTER TABLE "canonical_products" DROP CONSTRAINT IF EXISTS "FK_cp_category_mapping"`);
    await queryRunner.query(`ALTER TABLE "canonical_products" DROP COLUMN IF EXISTS "categoryMappingId"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "dictionary_values_cache"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attribute_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_mappings"`);
  }
}
