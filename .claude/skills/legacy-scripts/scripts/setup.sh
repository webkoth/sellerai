#!/bin/bash
# SellerAI Setup Script
# Запуск: chmod +x scripts/setup.sh && ./scripts/setup.sh

set -e

echo "================================================"
echo "  SellerAI — Установка рабочего пространства"
echo "================================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Ошибка: Node.js не установлен${NC}"
    echo "Установите Node.js 18+ с https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Ошибка: требуется Node.js 18+, установлен: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Проверка/создание .env файла
if [ ! -f ".env" ]; then
    echo ""
    echo -e "${YELLOW}Файл .env не найден. Создаю из шаблона...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓${NC} Создан .env из .env.example"
    echo -e "${YELLOW}⚠ ВАЖНО: Заполните .env своими API токенами!${NC}"
    echo ""
fi

# Установка и сборка MCP серверов
echo ""
echo "Установка MCP серверов..."
echo ""

# Wildberries MCP
echo "→ Wildberries MCP..."
cd mcp/wb-mcp
npm install --silent
npm run build --silent
cd ../..
echo -e "${GREEN}✓${NC} wb-mcp"

# Ozon MCP
echo "→ Ozon MCP..."
cd mcp/ozon-mcp
npm install --silent
npm run build --silent
cd ../..
echo -e "${GREEN}✓${NC} ozon-mcp"

# Яндекс.Маркет MCP
echo "→ Яндекс.Маркет MCP..."
cd mcp/ym-mcp
npm install --silent
npm run build --silent
cd ../..
echo -e "${GREEN}✓${NC} ym-mcp"

# Создание директории для логов
mkdir -p logs

echo ""
echo "================================================"
echo -e "${GREEN}  Установка завершена!${NC}"
echo "================================================"
echo ""
echo "Следующие шаги:"
echo "  1. Заполните .env файл своими API токенами"
echo "  2. Запустите: claude"
echo ""
echo "Полезные команды:"
echo "  /weekly-report  — еженедельный отчёт"
echo "  /unit-economics — юнит-экономика товара"
echo "  /funnel         — воронка продаж"
echo ""
