import { Injectable } from '@nestjs/common';
import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline';
import { CategoryMappingService } from '../services/category-mapping.service';

@Injectable()
export class CategoriesCommand {
  constructor(private readonly categoryService: CategoryMappingService) {}

  register(program: Command): void {
    const categories = program
      .command('categories')
      .description('Manage category mappings between marketplaces');

    // List category mappings
    categories
      .command('list')
      .description('List all category mappings')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .action(async (options) => {
        const mappings = await this.categoryService.listCategoryMappings(options.org);

        if (mappings.length === 0) {
          console.log('No category mappings found.');
          return;
        }

        console.log('\nCategory Mappings:');
        console.log('─'.repeat(100));

        for (const mapping of mappings) {
          console.log(`\n${mapping.canonicalCategory}`);
          console.log(`  ID: ${mapping.id}`);
          if (mapping.wbSubjectId) {
            console.log(`  WB: ${mapping.wbSubjectName} (${mapping.wbSubjectId})`);
          }
          if (mapping.ozonCategoryId) {
            console.log(`  Ozon: ${mapping.ozonCategoryName} (${mapping.ozonCategoryId})`);
          }
          if (mapping.yandexCategoryId) {
            console.log(`  Yandex: ${mapping.yandexCategoryName} (${mapping.yandexCategoryId})`);
          }
          if (mapping.attributeMappings?.length > 0) {
            console.log(`  Attributes: ${mapping.attributeMappings.length}`);
          }
        }
      });

    // Import categories from marketplace
    categories
      .command('import')
      .description('Import categories from a marketplace')
      .requiredOption('-m, --marketplace <marketplace>', 'Marketplace (wildberries, ozon)')
      .option('-a, --account <accountId>', 'Marketplace account ID')
      .action(async (options) => {
        const accounts = await this.categoryService.getAccounts();
        let account = accounts.find(
          (a) => a.marketplace === options.marketplace && (!options.account || a.id === options.account),
        );

        if (!account) {
          console.error(`No ${options.marketplace} account found.`);
          process.exit(1);
        }

        console.log(`\nImporting categories from ${options.marketplace}...`);

        try {
          if (options.marketplace === 'wildberries') {
            const result = await this.categoryService.importWildberriesCategories(account);
            console.log(`\nFound ${result.categories.length} WB categories:`);
            console.log('─'.repeat(80));

            // Group by parent
            const grouped = new Map<string, typeof result.categories>();
            for (const cat of result.categories) {
              const key = cat.parentName || 'Root';
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key)!.push(cat);
            }

            for (const [parent, cats] of grouped) {
              console.log(`\n${parent}:`);
              for (const cat of cats.slice(0, 10)) {
                console.log(`  [${cat.subjectId}] ${cat.subjectName}`);
              }
              if (cats.length > 10) {
                console.log(`  ... and ${cats.length - 10} more`);
              }
            }
          } else if (options.marketplace === 'ozon') {
            const result = await this.categoryService.importOzonCategories(account);
            console.log(`\nFound ${result.categories.length} Ozon categories:`);
            console.log('─'.repeat(80));

            for (const cat of result.categories.slice(0, 30)) {
              console.log(`  [${cat.categoryId}] ${cat.categoryName}`);
            }
            if (result.categories.length > 30) {
              console.log(`  ... and ${result.categories.length - 30} more`);
            }
          }
        } catch (error) {
          console.error(`Error importing categories:`, error);
          process.exit(1);
        }
      });

    // Create category mapping
    categories
      .command('create')
      .description('Create a new category mapping')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .requiredOption('-c, --category <name>', 'Canonical category name')
      .option('--wb-id <id>', 'Wildberries subject ID')
      .option('--wb-name <name>', 'Wildberries subject name')
      .option('--ozon-id <id>', 'Ozon category ID')
      .option('--ozon-type <id>', 'Ozon type ID')
      .option('--ozon-name <name>', 'Ozon category name')
      .option('--yandex-id <id>', 'Yandex category ID')
      .option('--yandex-name <name>', 'Yandex category name')
      .action(async (options) => {
        const mapping = await this.categoryService.createCategoryMapping(options.org, {
          canonicalCategory: options.category,
          wbSubjectId: options.wbId ? parseInt(options.wbId, 10) : undefined,
          wbSubjectName: options.wbName,
          ozonCategoryId: options.ozonId,
          ozonTypeId: options.ozonType ? parseInt(options.ozonType, 10) : undefined,
          ozonCategoryName: options.ozonName,
          yandexCategoryId: options.yandexId,
          yandexCategoryName: options.yandexName,
        });

        console.log(`\nCreated category mapping:`);
        console.log(`  ID: ${mapping.id}`);
        console.log(`  Category: ${mapping.canonicalCategory}`);
      });

    // Export mappings to CSV
    categories
      .command('export')
      .description('Export category mappings to CSV')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .requiredOption('-f, --file <path>', 'Output file path')
      .action(async (options) => {
        const csv = await this.categoryService.exportMappingsToCSV(options.org);
        fs.writeFileSync(options.file, csv, 'utf-8');
        console.log(`Exported mappings to ${options.file}`);
      });

    // Import mappings from CSV
    categories
      .command('import-csv')
      .description('Import category mappings from CSV')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .requiredOption('-f, --file <path>', 'Input file path')
      .action(async (options) => {
        if (!fs.existsSync(options.file)) {
          console.error(`File not found: ${options.file}`);
          process.exit(1);
        }

        const csv = fs.readFileSync(options.file, 'utf-8');
        const result = await this.categoryService.importMappingsFromCSV(options.org, csv);

        console.log(`\nImport completed:`);
        console.log(`  Imported: ${result.imported}`);
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          for (const err of result.errors) {
            console.log(`    - ${err}`);
          }
        }
      });

    // Interactive mapping wizard
    categories
      .command('wizard')
      .description('Interactive category mapping wizard')
      .requiredOption('-o, --org <organizationId>', 'Organization ID')
      .action(async (options) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const question = (prompt: string): Promise<string> => {
          return new Promise((resolve) => {
            rl.question(prompt, resolve);
          });
        };

        console.log('\nCategory Mapping Wizard');
        console.log('═'.repeat(50));

        const canonicalCategory = await question('\nEnter canonical category name: ');
        if (!canonicalCategory) {
          console.log('Cancelled.');
          rl.close();
          return;
        }

        const wbSubjectId = await question('Wildberries subject ID (or press Enter to skip): ');
        let wbSubjectName = '';
        if (wbSubjectId) {
          wbSubjectName = await question('Wildberries subject name: ');
        }

        const ozonCategoryId = await question('Ozon category ID (or press Enter to skip): ');
        let ozonTypeId = '';
        let ozonCategoryName = '';
        if (ozonCategoryId) {
          ozonTypeId = await question('Ozon type ID: ');
          ozonCategoryName = await question('Ozon category name: ');
        }

        const yandexCategoryId = await question('Yandex category ID (or press Enter to skip): ');
        let yandexCategoryName = '';
        if (yandexCategoryId) {
          yandexCategoryName = await question('Yandex category name: ');
        }

        const mapping = await this.categoryService.createCategoryMapping(options.org, {
          canonicalCategory,
          wbSubjectId: wbSubjectId ? parseInt(wbSubjectId, 10) : undefined,
          wbSubjectName: wbSubjectName || undefined,
          ozonCategoryId: ozonCategoryId || undefined,
          ozonTypeId: ozonTypeId ? parseInt(ozonTypeId, 10) : undefined,
          ozonCategoryName: ozonCategoryName || undefined,
          yandexCategoryId: yandexCategoryId || undefined,
          yandexCategoryName: yandexCategoryName || undefined,
        });

        console.log(`\nCategory mapping created!`);
        console.log(`  ID: ${mapping.id}`);

        rl.close();
      });

    // Add attribute mapping
    categories
      .command('add-attribute')
      .description('Add attribute mapping to a category')
      .requiredOption('-c, --category <categoryId>', 'Category mapping ID')
      .requiredOption('-n, --name <name>', 'Canonical attribute name')
      .option('--wb-name <name>', 'WB characteristic name')
      .option('--ozon-id <id>', 'Ozon attribute ID')
      .option('--ozon-dict', 'Ozon attribute is dictionary', false)
      .option('--yandex-name <name>', 'Yandex parameter name')
      .option('--required-wb', 'Required for WB', false)
      .option('--required-ozon', 'Required for Ozon', false)
      .option('--required-yandex', 'Required for Yandex', false)
      .option('--type <type>', 'Value type (string, number, boolean, dictionary, array)', 'string')
      .option('--default <value>', 'Default value')
      .action(async (options) => {
        const attr = await this.categoryService.addAttributeMapping(options.category, {
          canonicalName: options.name,
          wbCharacteristicName: options.wbName,
          ozonAttributeId: options.ozonId ? parseInt(options.ozonId, 10) : undefined,
          ozonIsDictionary: options.ozonDict,
          yandexParameterName: options.yandexName,
          isRequiredWb: options.requiredWb,
          isRequiredOzon: options.requiredOzon,
          isRequiredYandex: options.requiredYandex,
          valueType: options.type,
          defaultValue: options.default,
        });

        console.log(`\nAttribute mapping created:`);
        console.log(`  ID: ${attr.id}`);
        console.log(`  Name: ${attr.canonicalName}`);
      });

    // Import Ozon dictionary values
    categories
      .command('import-dictionary')
      .description('Import Ozon dictionary values for an attribute')
      .requiredOption('--attr <attributeId>', 'Ozon attribute ID')
      .requiredOption('--cat <categoryId>', 'Ozon category ID')
      .requiredOption('--type <typeId>', 'Ozon type ID')
      .option('-a, --account <accountId>', 'Marketplace account ID')
      .action(async (options) => {
        const accounts = await this.categoryService.getAccounts();
        let account = accounts.find(
          (a) => a.marketplace === 'ozon' && (!options.account || a.id === options.account),
        );

        if (!account) {
          console.error('No Ozon account found.');
          process.exit(1);
        }

        console.log(`\nImporting dictionary values for attribute ${options.attr}...`);

        const imported = await this.categoryService.importOzonDictionaryValues(
          account,
          parseInt(options.attr, 10),
          parseInt(options.cat, 10),
          parseInt(options.type, 10),
        );

        console.log(`Imported ${imported} dictionary values.`);
      });

    // Search dictionary values
    categories
      .command('search-dictionary')
      .description('Search dictionary values')
      .requiredOption('-m, --marketplace <marketplace>', 'Marketplace (ozon)')
      .requiredOption('--attr <attributeId>', 'Attribute ID')
      .requiredOption('-q, --query <query>', 'Search query')
      .action(async (options) => {
        const values = await this.categoryService.searchDictionaryValue(
          options.marketplace,
          parseInt(options.attr, 10),
          options.query,
        );

        if (values.length === 0) {
          console.log('No matching values found.');
          return;
        }

        console.log(`\nFound ${values.length} matching values:`);
        for (const value of values) {
          console.log(`  [${value.valueId}] ${value.valueText}`);
          if (value.info) {
            console.log(`      Info: ${value.info}`);
          }
        }
      });
  }
}
