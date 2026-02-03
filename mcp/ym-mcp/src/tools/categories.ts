/**
 * Categories tools for Yandex Market MCP
 */

import { z } from 'zod';
import { apiRequest } from '../api/client.js';

// Input schemas
export const GetCategoriesInputSchema = z.object({
  language: z.enum(['RU', 'EN']).default('RU').optional().describe('Язык (по умолчанию RU)'),
}).strict();

export type GetCategoriesInput = z.infer<typeof GetCategoriesInputSchema>;

export const SearchCategoriesInputSchema = z.object({
  query: z.string().describe('Поисковый запрос для поиска категории'),
  language: z.enum(['RU', 'EN']).default('RU').optional(),
}).strict();

export type SearchCategoriesInput = z.infer<typeof SearchCategoriesInputSchema>;

// Response types
export interface Category {
  id: number;
  name: string;
  children?: Category[];
}

interface CategoriesResponse {
  status?: string;
  result?: Category;
}

// Get categories tree
export async function getCategories(input: GetCategoriesInput): Promise<{
  categories: Category[];
  total: number;
}> {
  const response = await apiRequest<CategoriesResponse>(
    '/v2/categories/tree',
    'POST',
    { language: input.language || 'RU' }
  );

  const rootCategory = response.result;
  if (!rootCategory || !rootCategory.children) {
    return { categories: [], total: 0 };
  }

  return {
    categories: rootCategory.children,
    total: countCategories(rootCategory.children),
  };
}

// Count all categories recursively
function countCategories(categories: Category[]): number {
  let count = categories.length;
  for (const cat of categories) {
    if (cat.children) {
      count += countCategories(cat.children);
    }
  }
  return count;
}

// Search categories by query
export async function searchCategories(input: SearchCategoriesInput): Promise<{
  categories: Array<{ id: number; name: string; path: string[] }>;
  total: number;
}> {
  const response = await apiRequest<CategoriesResponse>(
    '/v2/categories/tree',
    'POST',
    { language: input.language || 'RU' }
  );

  const rootCategory = response.result;
  if (!rootCategory || !rootCategory.children) {
    return { categories: [], total: 0 };
  }

  const query = input.query.toLowerCase();
  const results: Array<{ id: number; name: string; path: string[] }> = [];

  // Recursive search
  function searchInCategory(category: Category, path: string[]): void {
    const currentPath = [...path, category.name];

    if (category.name.toLowerCase().includes(query)) {
      // Only add leaf categories (no children or empty children)
      if (!category.children || category.children.length === 0) {
        results.push({
          id: category.id,
          name: category.name,
          path: currentPath,
        });
      }
    }

    if (category.children) {
      for (const child of category.children) {
        searchInCategory(child, currentPath);
      }
    }
  }

  for (const category of rootCategory.children) {
    searchInCategory(category, []);
  }

  return {
    categories: results.slice(0, 50), // Limit results
    total: results.length,
  };
}

// Format categories as markdown
export function formatCategoriesAsMarkdown(categories: Category[], depth = 0): string {
  if (depth === 0 && (!categories || categories.length === 0)) {
    return '## Категории Яндекс.Маркет\n\nКатегории не найдены.';
  }

  const lines: string[] = [];

  if (depth === 0) {
    lines.push('## Категории Яндекс.Маркет (верхний уровень)');
    lines.push('');
    lines.push('| ID | Название | Подкатегорий |');
    lines.push('|----|----------|--------------|');
  }

  for (const cat of categories) {
    const childCount = cat.children?.length || 0;
    const indent = '  '.repeat(depth);

    if (depth === 0) {
      lines.push(`| ${cat.id} | ${cat.name} | ${childCount} |`);
    } else {
      lines.push(`${indent}- **${cat.name}** (ID: ${cat.id})`);
    }
  }

  if (depth === 0) {
    lines.push('');
    lines.push('> Используйте `ym_search_categories` для поиска конкретной категории');
  }

  return lines.join('\n');
}

// Format search results as markdown
export function formatSearchResultsAsMarkdown(
  results: Array<{ id: number; name: string; path: string[] }>,
  query: string
): string {
  if (!results || results.length === 0) {
    return `## Поиск категорий: "${query}"\n\nКатегории не найдены.`;
  }

  const lines: string[] = [
    `## Поиск категорий: "${query}"`,
    '',
    `Найдено: ${results.length} категорий (только листовые)`,
    '',
    '| ID | Категория | Путь |',
    '|----|-----------|------|',
  ];

  for (const result of results) {
    const pathStr = result.path.slice(0, -1).join(' → ');
    lines.push(`| ${result.id} | **${result.name}** | ${pathStr || '-'} |`);
  }

  lines.push('');
  lines.push('> Используйте найденный ID в поле `marketCategoryId` при создании товара');

  return lines.join('\n');
}
