#!/usr/bin/env npx ts-node
/**
 * PreToolUse Hook: Валидация изменения цен на маркетплейсах
 *
 * Проверяет:
 * - Цена не снижается более чем на 30%
 * - Цена не повышается более чем на 50%
 * - Скидка не превышает 70%
 * - Операция в preview режиме (confirm=false) - разрешается без вопросов
 */

import {
  PreToolUseInput,
  PreToolUseOutput,
  WbUpdatePriceInput,
  OzonUpdatePriceInput,
  readInput,
  writeOutput,
  allowTool,
  denyTool,
  askUser,
} from './types';

const MAX_PRICE_DECREASE_PERCENT = 30;
const MAX_PRICE_INCREASE_PERCENT = 50;
const MAX_DISCOUNT_PERCENT = 70;

function validateWbPriceChange(input: WbUpdatePriceInput): PreToolUseOutput {
  // Preview режим - всегда разрешаем
  if (!input.confirm) {
    return allowTool();
  }

  // Проверка скидки
  if (input.discount !== undefined && input.discount > MAX_DISCOUNT_PERCENT) {
    return askUser(
      `Скидка ${input.discount}% превышает ${MAX_DISCOUNT_PERCENT}%. ` +
      `Это может сильно снизить маржинальность. Продолжить?`
    );
  }

  // Если указана только скидка без цены - разрешаем (после проверки выше)
  if (input.price === undefined) {
    return allowTool();
  }

  return allowTool();
}

function validateOzonPriceChange(input: OzonUpdatePriceInput): PreToolUseOutput {
  // Preview режим - всегда разрешаем
  if (!input.confirm) {
    return allowTool();
  }

  // Базовая проверка - цена должна быть положительной
  if (input.price !== undefined) {
    const price = parseFloat(input.price);
    if (isNaN(price) || price <= 0) {
      return denyTool('Цена должна быть положительным числом');
    }
  }

  // Проверка старой цены (зачёркнутой) - должна быть больше текущей
  if (input.price && input.oldPrice) {
    const price = parseFloat(input.price);
    const oldPrice = parseFloat(input.oldPrice);

    if (oldPrice <= price) {
      return askUser(
        `Старая цена (${oldPrice}₽) должна быть больше текущей (${price}₽) ` +
        `для отображения скидки. Исправить?`
      );
    }

    // Проверка размера "скидки"
    const discountPercent = ((oldPrice - price) / oldPrice) * 100;
    if (discountPercent > MAX_DISCOUNT_PERCENT) {
      return askUser(
        `Скидка ${discountPercent.toFixed(0)}% (${oldPrice}₽ → ${price}₽) превышает ${MAX_DISCOUNT_PERCENT}%. ` +
        `Продолжить?`
      );
    }
  }

  return allowTool();
}

function main(): void {
  try {
    const input = readInput<PreToolUseInput>();

    let output: PreToolUseOutput;

    if (input.tool_name === 'mcp__wb-mcp__wb_update_price') {
      output = validateWbPriceChange(input.tool_input as WbUpdatePriceInput);
    } else if (input.tool_name === 'mcp__ozon-mcp__ozon_update_price') {
      output = validateOzonPriceChange(input.tool_input as OzonUpdatePriceInput);
    } else {
      // Неизвестный инструмент - разрешаем
      output = allowTool();
    }

    writeOutput(output);
  } catch (error) {
    // В случае ошибки - разрешаем операцию (fail-open)
    // Чтобы не блокировать работу из-за ошибок в hook
    writeOutput(allowTool());
  }
}

main();
