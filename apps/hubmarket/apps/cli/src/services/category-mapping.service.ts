import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CategoryMapping,
  AttributeMapping,
  DictionaryValueCache,
  MarketplaceAccount,
} from '@hubmarket/core';

export interface CategoryImportResult {
  marketplace: string;
  imported: number;
  errors: string[];
}

export interface CategoryMappingInput {
  canonicalCategory: string;
  wbSubjectId?: number;
  wbSubjectName?: string;
  ozonCategoryId?: string;
  ozonTypeId?: number;
  ozonCategoryName?: string;
  yandexCategoryId?: string;
  yandexCategoryName?: string;
}

export interface AttributeMappingInput {
  canonicalName: string;
  wbCharacteristicName?: string;
  wbCharacteristicId?: number;
  ozonAttributeId?: number;
  ozonIsDictionary?: boolean;
  yandexParameterId?: string;
  yandexParameterName?: string;
  isRequiredWb?: boolean;
  isRequiredOzon?: boolean;
  isRequiredYandex?: boolean;
  valueType?: 'string' | 'number' | 'boolean' | 'dictionary' | 'array';
  defaultValue?: string;
}

@Injectable()
export class CategoryMappingService {
  constructor(
    @InjectRepository(CategoryMapping)
    private readonly categoryRepo: Repository<CategoryMapping>,
    @InjectRepository(AttributeMapping)
    private readonly attributeRepo: Repository<AttributeMapping>,
    @InjectRepository(DictionaryValueCache)
    private readonly dictionaryRepo: Repository<DictionaryValueCache>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
  ) {}

  async getAccounts(organizationId?: string): Promise<MarketplaceAccount[]> {
    const where = organizationId ? { organizationId } : {};
    return this.accountRepo.find({ where });
  }

  async listCategoryMappings(organizationId: string): Promise<CategoryMapping[]> {
    return this.categoryRepo.find({
      where: { organizationId },
      relations: ['attributeMappings'],
      order: { canonicalCategory: 'ASC' },
    });
  }

  async getCategoryMapping(id: string): Promise<CategoryMapping | null> {
    return this.categoryRepo.findOne({
      where: { id },
      relations: ['attributeMappings'],
    });
  }

  async createCategoryMapping(
    organizationId: string,
    input: CategoryMappingInput,
  ): Promise<CategoryMapping> {
    const mapping = this.categoryRepo.create({
      organizationId,
      ...input,
    });
    return this.categoryRepo.save(mapping);
  }

  async updateCategoryMapping(
    id: string,
    input: Partial<CategoryMappingInput>,
  ): Promise<CategoryMapping | null> {
    await this.categoryRepo.update(id, input);
    return this.getCategoryMapping(id);
  }

  async deleteCategoryMapping(id: string): Promise<boolean> {
    const result = await this.categoryRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async addAttributeMapping(
    categoryMappingId: string,
    input: AttributeMappingInput,
  ): Promise<AttributeMapping> {
    const mapping = this.attributeRepo.create({
      categoryMappingId,
      ...input,
    });
    return this.attributeRepo.save(mapping);
  }

  async updateAttributeMapping(
    id: string,
    input: Partial<AttributeMappingInput>,
  ): Promise<AttributeMapping | null> {
    await this.attributeRepo.update(id, input);
    return this.attributeRepo.findOne({ where: { id } });
  }

  async deleteAttributeMapping(id: string): Promise<boolean> {
    const result = await this.attributeRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async importWildberriesCategories(
    account: MarketplaceAccount,
  ): Promise<{ categories: Array<{ subjectId: number; subjectName: string; parentName: string }> }> {
    // NOTE: WB categories API requires separate implementation
    // For now, return common categories as examples
    // In production, this should call: GET https://content-api.wildberries.ru/content/v2/object/all?name=...

    console.log('  Note: WB category import requires manual lookup via API or WB seller portal.');
    console.log('  Common WB categories can be found at: https://seller.wildberries.ru/');
    console.log('  API endpoint: /content/v2/object/all (requires specific subject/parent names)');

    // Return empty - user needs to manually specify categories
    return { categories: [] };
  }

  async importOzonCategories(
    account: MarketplaceAccount,
  ): Promise<{ categories: Array<{ categoryId: number; categoryName: string; typeId?: number; typeName?: string }> }> {
    // NOTE: Ozon category tree API requires separate implementation
    // For now, return info about how to get categories
    // In production, this should call: POST /v1/description-category/tree

    console.log('  Note: Ozon category import requires the category tree API.');
    console.log('  API endpoint: POST /v1/description-category/tree');
    console.log('  Common Ozon categories can be found in Ozon seller portal.');

    // Return empty - user needs to manually specify categories
    return { categories: [] };
  }

  async importOzonDictionaryValues(
    account: MarketplaceAccount,
    attributeId: number,
    categoryId: number,
    typeId: number,
  ): Promise<number> {
    // NOTE: Ozon attribute values API requires separate implementation
    // In production, this should call: POST /v1/description-category/attribute/values

    console.log(`  Note: Importing dictionary values for attribute ${attributeId}`);
    console.log('  API endpoint: POST /v1/description-category/attribute/values');
    console.log('  This requires category_id, type_id, and attribute_id parameters.');

    // Return 0 - user needs to implement full API call
    return 0;
  }

  async searchDictionaryValue(
    marketplace: string,
    attributeId: number,
    searchText: string,
  ): Promise<DictionaryValueCache[]> {
    return this.dictionaryRepo
      .createQueryBuilder('dvc')
      .where('dvc.marketplace = :marketplace', { marketplace })
      .andWhere('dvc.attributeId = :attributeId', { attributeId })
      .andWhere('LOWER(dvc.valueText) LIKE LOWER(:search)', { search: `%${searchText}%` })
      .limit(50)
      .getMany();
  }

  async exportMappingsToCSV(organizationId: string): Promise<string> {
    const mappings = await this.listCategoryMappings(organizationId);

    const lines: string[] = [
      'canonical_category,wb_subject_id,wb_subject_name,ozon_category_id,ozon_type_id,ozon_category_name,yandex_category_id,yandex_category_name',
    ];

    for (const mapping of mappings) {
      lines.push([
        `"${mapping.canonicalCategory}"`,
        mapping.wbSubjectId || '',
        `"${mapping.wbSubjectName || ''}"`,
        mapping.ozonCategoryId || '',
        mapping.ozonTypeId || '',
        `"${mapping.ozonCategoryName || ''}"`,
        mapping.yandexCategoryId || '',
        `"${mapping.yandexCategoryName || ''}"`,
      ].join(','));
    }

    return lines.join('\n');
  }

  async importMappingsFromCSV(
    organizationId: string,
    csvContent: string,
  ): Promise<{ imported: number; errors: string[] }> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    const errors: string[] = [];
    let imported = 0;

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      try {
        const parts = this.parseCSVLine(lines[i]);
        if (parts.length < 8) {
          errors.push(`Line ${i + 1}: Invalid format`);
          continue;
        }

        const [
          canonicalCategory,
          wbSubjectId,
          wbSubjectName,
          ozonCategoryId,
          ozonTypeId,
          ozonCategoryName,
          yandexCategoryId,
          yandexCategoryName,
        ] = parts;

        await this.categoryRepo.upsert(
          {
            organizationId,
            canonicalCategory: canonicalCategory.replace(/"/g, ''),
            wbSubjectId: wbSubjectId ? parseInt(wbSubjectId, 10) : null,
            wbSubjectName: wbSubjectName?.replace(/"/g, '') || null,
            ozonCategoryId: ozonCategoryId || null,
            ozonTypeId: ozonTypeId ? parseInt(ozonTypeId, 10) : null,
            ozonCategoryName: ozonCategoryName?.replace(/"/g, '') || null,
            yandexCategoryId: yandexCategoryId || null,
            yandexCategoryName: yandexCategoryName?.replace(/"/g, '') || null,
          },
          ['organizationId', 'canonicalCategory'],
        );

        imported++;
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { imported, errors };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  }
}
