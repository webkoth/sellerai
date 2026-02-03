# Техническое задание: Калькулятор НПД для Hubmarket

**Версия:** 1.0
**Дата:** 2026-02-03
**Статус:** Draft
**Платформа:** Next.js 14+ (App Router)

---

## 1. Введение

### 1.1 Цель документа

Данное техническое задание описывает функциональность автоматического расчёта НПД (налога на профессиональный доход) для самозанятых продавцов Wildberries в приложении Hubmarket.

### 1.2 Область применения

Модуль предназначен для самозанятых продавцов маркетплейсов, которым необходимо:
- Автоматически рассчитывать налог НПД на основе документов из ЛК WB
- Получать помесячную разбивку доходов и налогов
- Контролировать приближение к лимиту НПД (2.4 млн ₽/год)
- Экспортировать данные в Excel для бухгалтерии

### 1.3 Глоссарий

| Термин | Определение |
|--------|-------------|
| **НПД** | Налог на профессиональный доход — специальный налоговый режим для самозанятых |
| **Самозанятый** | Физическое лицо, зарегистрированное как плательщик НПД |
| **Ставка 4%** | Налоговая ставка для доходов от физических лиц |
| **Ставка 6%** | Налоговая ставка для доходов от юридических лиц и ИП |
| **Лимит НПД** | Максимальный годовой доход самозанятого — 2 400 000 ₽ |
| **Еженедельный отчёт** | PDF-документ WB с данными о реализации товаров физ.лицам |
| **Уведомление о выкупе** | XLSX-документ WB с данными о выкупах юр.лицами |

### 1.4 Референсы

| Документ | Описание |
|----------|----------|
| `scripts/generate_npd_report.py` | Рабочий Python-прототип с эталонной логикой |
| WB Documents API | `https://documents-api.wildberries.ru/api/v1/documents/` |

---

## 2. Бизнес-требования

### 2.1 Целевая аудитория

Самозанятые продавцы Wildberries, которые:
- Ведут учёт доходов для налоговой отчётности
- Хотят автоматизировать расчёт НПД
- Нуждаются в контроле приближения к лимиту 2.4 млн ₽

### 2.2 Проблемы, которые решает функционал

| ID | Проблема | Текущее решение | Боль |
|----|----------|-----------------|------|
| P1 | Ручной расчёт налога | Excel-таблицы | 2-4 часа/месяц |
| P2 | Неясность какие поля использовать | Чтение инструкций WB | Ошибки в расчётах |
| P3 | Разделение доходов по ставкам | Ручная сортировка | Путаница 4%/6% |
| P4 | Контроль лимита НПД | Ручной подсчёт | Риск превышения |
| P5 | Подготовка данных для "Мой налог" | Ручной ввод | Трата времени |

### 2.3 User Stories

#### US-1: Расчёт НПД за год
**Как** самозанятый продавец WB
**Я хочу** получить расчёт НПД за выбранный год
**Чтобы** знать сколько налога я должен заплатить

**Критерии приёмки:**
- [ ] Могу выбрать год для расчёта
- [ ] Вижу итоговую сумму налога
- [ ] Вижу разбивку по месяцам
- [ ] Вижу разделение по ставкам 4% и 6%

#### US-2: Контроль лимита
**Как** самозанятый продавец WB
**Я хочу** видеть сколько осталось до лимита НПД
**Чтобы** планировать свою деятельность

**Критерии приёмки:**
- [ ] Вижу текущий доход и лимит
- [ ] Вижу процент использования лимита
- [ ] Получаю предупреждение при приближении к лимиту (>80%)
- [ ] Получаю алерт при превышении лимита

#### US-3: Экспорт в Excel
**Как** самозанятый продавец WB
**Я хочу** скачать отчёт в формате Excel
**Чтобы** передать его бухгалтеру или сохранить для отчётности

**Критерии приёмки:**
- [ ] Могу скачать Excel-файл
- [ ] Файл содержит помесячную таблицу
- [ ] Файл содержит итоговые суммы
- [ ] Файл содержит информацию о лимите

#### US-4: Просмотр истории
**Как** самозанятый продавец WB
**Я хочу** видеть историю расчётов
**Чтобы** сравнивать периоды и отслеживать динамику

**Критерии приёмки:**
- [ ] Вижу список предыдущих расчётов
- [ ] Могу открыть любой расчёт
- [ ] Вижу дату расчёта

#### US-5: Прогресс расчёта
**Как** самозанятый продавец WB
**Я хочу** видеть прогресс расчёта
**Чтобы** понимать что система работает

**Критерии приёмки:**
- [ ] Вижу этап обработки (скачивание, парсинг, расчёт)
- [ ] Вижу прогресс-бар или счётчик документов
- [ ] Вижу примерное время завершения

---

## 3. Функциональные требования

### 3.1 Источники данных

#### 3.1.1 WB Documents API

**Base URL:** `https://documents-api.wildberries.ru`

**Endpoints:**

```
GET /api/v1/documents/list
  ?locale=ru
  &limit=50
  &offset=0
  &beginTime=YYYY-MM-DD
  &endTime=YYYY-MM-DD
  &sort=date
  &order=asc

GET /api/v1/documents/download
  ?serviceName={serviceName}
  &extension=zip
```

**Headers:**
```
Authorization: {WB_API_TOKEN}
```

#### 3.1.2 Типы документов

| Категория | Формат | Налоговая ставка | Поле для суммы |
|-----------|--------|------------------|----------------|
| Еженедельный отчёт реализации | PDF | 4% | "Всего стоимость реализованного товара" (строка 1./1.1, колонка 6) |
| Уведомление о выкупе | XLSX | 6% | "Итого:" (колонка 5 — "Сумма выкупа") |

### 3.2 Алгоритм расчёта

```typescript
interface NpdCalculationAlgorithm {
  // Шаг 1: Получить список документов за год
  fetchDocuments(year: number): Document[];

  // Шаг 2: Фильтровать по категориям
  filterWeeklyReports(docs: Document[]): Document[];     // 'еженедельный' in category
  filterRedeemNotifications(docs: Document[]): Document[]; // 'выкуп' in category

  // Шаг 3: Скачать и распарсить каждый документ
  downloadAndParse(doc: Document): ParsedAmount;

  // Шаг 4: Агрегировать по месяцам
  aggregateByMonth(amounts: ParsedAmount[]): MonthlyData;

  // Шаг 5: Рассчитать налоги
  calculateTax(monthlyData: MonthlyData): TaxReport;
}
```

**Детали парсинга PDF (еженедельный отчёт):**
```typescript
function parseWeeklyReportPdf(pdfBytes: Buffer): number {
  // 1. Извлечь таблицы из первой страницы PDF
  // 2. Найти строку где:
  //    - Колонка 0 = "1." или "1.1"
  //    - Колонка 1 содержит "всего стоимость реализованного товара"
  // 3. Вернуть значение из колонки 5 (индекс 5)
  // 4. Очистить: убрать пробелы, заменить запятую на точку
}
```

**Детали парсинга XLSX (уведомление о выкупе):**
```typescript
function parseRedeemNotificationXlsx(xlsxBytes: Buffer): number {
  // 1. Открыть активный лист
  // 2. Найти строку где колонка 0 = "Итого:" или "Итого"
  // 3. Вернуть значение из колонки 4 (индекс 4) — "Сумма выкупа"
  // 4. Очистить: убрать пробелы, заменить запятую на точку
}
```

### 3.3 Формулы расчёта

```typescript
// Налог с физ.лиц
const physicalTax = physicalIncome * 0.04;

// Налог с юр.лиц
const legalTax = legalIncome * 0.06;

// Общий налог
const totalTax = physicalTax + legalTax;

// Общий доход
const totalIncome = physicalIncome + legalIncome;

// Остаток до лимита
const remainingLimit = 2_400_000 - totalIncome;

// Процент использования лимита
const limitUsagePercent = (totalIncome / 2_400_000) * 100;
```

### 3.4 Обработка ошибок

| Код | Ситуация | Действие |
|-----|----------|----------|
| `ERR_NO_TOKEN` | Отсутствует WB_API_TOKEN | Показать инструкцию по получению токена |
| `ERR_INVALID_TOKEN` | Невалидный токен (401) | Предложить обновить токен |
| `ERR_RATE_LIMIT` | Превышен лимит API (429) | Автоматический retry через 30 сек |
| `ERR_NO_DOCUMENTS` | Нет документов за период | Показать сообщение "Документы не найдены" |
| `ERR_PARSE_PDF` | Ошибка парсинга PDF | Добавить в список ошибок, продолжить |
| `ERR_PARSE_XLSX` | Ошибка парсинга XLSX | Добавить в список ошибок, продолжить |
| `ERR_DOWNLOAD` | Ошибка скачивания документа | Retry 3 раза, затем добавить в ошибки |

---

## 4. Технические требования

### 4.1 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        Hubmarket (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   UI Layer   │    │   API Layer  │    │  Background  │       │
│  │              │    │              │    │    Jobs      │       │
│  │ NpdCalculator│───▶│ /api/finance │───▶│   Inngest    │       │
│  │ NpdProgress  │◀───│ /npd/*       │◀───│   Workers    │       │
│  │ NpdReport    │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │                   ▼                   │                │
│         │            ┌──────────────┐           │                │
│         │            │   Prisma DB  │           │                │
│         │            │              │           │                │
│         │            │ NpdReport    │◀──────────┘                │
│         │            │ NpdDocument  │                            │
│         │            │ NpdError     │                            │
│         │            └──────────────┘                            │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │     SSE      │  Server-Sent Events для прогресса              │
│  │   /api/npd/  │                                                │
│  │   progress   │                                                │
│  └──────────────┘                                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  WB Documents    │
                    │      API         │
                    │                  │
                    │ Rate Limit: 10s  │
                    └──────────────────┘
```

### 4.2 Структура проекта

```
app/
├── api/
│   └── finance/
│       └── npd/
│           ├── calculate/
│           │   └── route.ts          # POST - запуск расчёта
│           ├── report/
│           │   └── [id]/
│           │       └── route.ts      # GET - получение результата
│           ├── export/
│           │   └── [id]/
│           │       └── route.ts      # GET - экспорт Excel
│           ├── progress/
│           │   └── [id]/
│           │       └── route.ts      # GET - SSE прогресс
│           └── history/
│               └── route.ts          # GET - история расчётов
│
├── (dashboard)/
│   └── finance/
│       └── npd/
│           ├── page.tsx              # Главная страница НПД
│           └── [id]/
│               └── page.tsx          # Страница отчёта
│
├── components/
│   └── finance/
│       └── npd/
│           ├── NpdCalculator.tsx     # Форма запуска
│           ├── NpdProgress.tsx       # Индикатор прогресса
│           ├── NpdReport.tsx         # Таблица результатов
│           ├── NpdExportButton.tsx   # Кнопка экспорта
│           └── NpdLimitWarning.tsx   # Предупреждение о лимите
│
lib/
├── npd/
│   ├── wb-documents-client.ts        # Клиент WB Documents API
│   ├── pdf-parser.ts                 # Парсер PDF
│   ├── xlsx-parser.ts                # Парсер XLSX
│   ├── tax-calculator.ts             # Расчёт налогов
│   └── excel-exporter.ts             # Генерация Excel
│
inngest/
├── client.ts                         # Inngest client
└── functions/
    └── npd-calculation.ts            # Background job

prisma/
└── schema.prisma                     # Модели данных
```

### 4.3 Prisma Schema

```prisma
model NpdReport {
  id            String         @id @default(cuid())
  userId        String
  year          Int
  status        NpdReportStatus @default(PENDING)

  // Итоги
  physicalIncome  Decimal?      @db.Decimal(12, 2)
  legalIncome     Decimal?      @db.Decimal(12, 2)
  physicalTax     Decimal?      @db.Decimal(12, 2)
  legalTax        Decimal?      @db.Decimal(12, 2)
  totalTax        Decimal?      @db.Decimal(12, 2)
  totalIncome     Decimal?      @db.Decimal(12, 2)

  // Лимит
  limitValue      Decimal       @default(2400000) @db.Decimal(12, 2)
  limitRemaining  Decimal?      @db.Decimal(12, 2)
  limitExceeded   Boolean       @default(false)

  // Прогресс
  totalDocuments  Int           @default(0)
  processedDocuments Int        @default(0)
  currentStage    String?

  // Связи
  documents       NpdDocument[]
  errors          NpdError[]
  monthlyData     NpdMonthlyData[]

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?

  @@index([userId, year])
}

enum NpdReportStatus {
  PENDING
  FETCHING_DOCUMENTS
  DOWNLOADING
  PARSING
  CALCULATING
  COMPLETED
  FAILED
}

model NpdDocument {
  id            String      @id @default(cuid())
  reportId      String
  report        NpdReport   @relation(fields: [reportId], references: [id], onDelete: Cascade)

  serviceName   String
  name          String
  category      String
  documentType  NpdDocumentType
  date          DateTime

  // Результат парсинга
  amount        Decimal?    @db.Decimal(12, 2)
  parsed        Boolean     @default(false)
  parseError    String?

  createdAt     DateTime    @default(now())

  @@index([reportId])
}

enum NpdDocumentType {
  WEEKLY_REPORT     // 4%
  REDEEM_NOTIFICATION // 6%
}

model NpdMonthlyData {
  id            String      @id @default(cuid())
  reportId      String
  report        NpdReport   @relation(fields: [reportId], references: [id], onDelete: Cascade)

  month         String      // YYYY-MM
  physicalIncome Decimal    @db.Decimal(12, 2)
  legalIncome   Decimal     @db.Decimal(12, 2)
  physicalTax   Decimal     @db.Decimal(12, 2)
  legalTax      Decimal     @db.Decimal(12, 2)

  @@unique([reportId, month])
}

model NpdError {
  id            String      @id @default(cuid())
  reportId      String
  report        NpdReport   @relation(fields: [reportId], references: [id], onDelete: Cascade)

  documentName  String?
  errorCode     String
  errorMessage  String

  createdAt     DateTime    @default(now())

  @@index([reportId])
}
```

### 4.4 API Endpoints

#### POST /api/finance/npd/calculate

Запускает расчёт НПД.

**Request:**
```typescript
interface CalculateRequest {
  year: number;  // 2024, 2025, 2026
}
```

**Response:**
```typescript
interface CalculateResponse {
  reportId: string;
  status: 'PENDING';
  message: string;
}
```

**Пример:**
```bash
POST /api/finance/npd/calculate
Content-Type: application/json

{
  "year": 2025
}

# Response 202 Accepted
{
  "reportId": "clx1234567890",
  "status": "PENDING",
  "message": "Расчёт запущен. Отслеживайте прогресс через /api/finance/npd/progress/{reportId}"
}
```

#### GET /api/finance/npd/report/[id]

Получает результат расчёта.

**Response:**
```typescript
interface ReportResponse {
  id: string;
  year: number;
  status: NpdReportStatus;

  // Только для COMPLETED
  summary?: {
    physicalIncome: number;
    legalIncome: number;
    physicalTax: number;
    legalTax: number;
    totalTax: number;
    totalIncome: number;
  };

  limit?: {
    value: number;
    remaining: number;
    exceeded: boolean;
    usagePercent: number;
  };

  monthlyData?: {
    month: string;
    monthName: string;
    physicalIncome: number;
    legalIncome: number;
    physicalTax: number;
    legalTax: number;
    totalTax: number;
  }[];

  errors?: {
    documentName: string;
    errorMessage: string;
  }[];

  meta: {
    totalDocuments: number;
    processedDocuments: number;
    createdAt: string;
    completedAt?: string;
  };
}
```

#### GET /api/finance/npd/progress/[id]

Server-Sent Events для отслеживания прогресса.

**Event Stream:**
```
event: progress
data: {"stage":"FETCHING_DOCUMENTS","message":"Получение списка документов...","progress":0}

event: progress
data: {"stage":"DOWNLOADING","message":"Скачивание документа 1/52","progress":2}

event: progress
data: {"stage":"DOWNLOADING","message":"Скачивание документа 52/52","progress":50}

event: progress
data: {"stage":"PARSING","message":"Парсинг документов...","progress":60}

event: progress
data: {"stage":"CALCULATING","message":"Расчёт налогов...","progress":90}

event: complete
data: {"reportId":"clx1234567890","status":"COMPLETED"}
```

#### GET /api/finance/npd/export/[id]

Экспорт в Excel.

**Response:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="npd_report_2025.xlsx"
```

#### GET /api/finance/npd/history

Получает историю расчётов.

**Response:**
```typescript
interface HistoryResponse {
  reports: {
    id: string;
    year: number;
    status: NpdReportStatus;
    totalTax?: number;
    createdAt: string;
  }[];
}
```

### 4.5 Background Job (Inngest)

```typescript
// inngest/functions/npd-calculation.ts
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { WBDocumentsClient } from '@/lib/npd/wb-documents-client';
import { PdfParser } from '@/lib/npd/pdf-parser';
import { XlsxParser } from '@/lib/npd/xlsx-parser';
import { TaxCalculator } from '@/lib/npd/tax-calculator';

export const npdCalculation = inngest.createFunction(
  { id: 'npd-calculation', retries: 3 },
  { event: 'npd/calculate' },
  async ({ event, step }) => {
    const { reportId, year, wbToken } = event.data;

    // Шаг 1: Получить список документов
    await step.run('fetch-documents', async () => {
      await prisma.npdReport.update({
        where: { id: reportId },
        data: { status: 'FETCHING_DOCUMENTS', currentStage: 'Получение списка документов...' }
      });

      const client = new WBDocumentsClient(wbToken);
      const documents = await client.fetchDocuments(year);

      // Сохранить документы в БД
      await prisma.npdDocument.createMany({
        data: documents.map(doc => ({
          reportId,
          serviceName: doc.serviceName,
          name: doc.name,
          category: doc.category,
          documentType: doc.category.toLowerCase().includes('еженедельный')
            ? 'WEEKLY_REPORT'
            : 'REDEEM_NOTIFICATION',
          date: new Date(doc.date),
        }))
      });

      await prisma.npdReport.update({
        where: { id: reportId },
        data: { totalDocuments: documents.length }
      });

      return documents.length;
    });

    // Шаг 2: Скачать и распарсить документы
    const documents = await prisma.npdDocument.findMany({
      where: { reportId }
    });

    await step.run('download-and-parse', async () => {
      await prisma.npdReport.update({
        where: { id: reportId },
        data: { status: 'DOWNLOADING', currentStage: 'Скачивание документов...' }
      });

      const client = new WBDocumentsClient(wbToken);
      const pdfParser = new PdfParser();
      const xlsxParser = new XlsxParser();

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];

        try {
          const zipBytes = await client.downloadDocument(doc.serviceName);

          let amount = 0;
          if (doc.documentType === 'WEEKLY_REPORT') {
            const pdfBytes = extractFromZip(zipBytes, 'pdf');
            if (pdfBytes) {
              amount = await pdfParser.parse(pdfBytes);
            }
          } else {
            const xlsxBytes = extractFromZip(zipBytes, 'xlsx');
            if (xlsxBytes) {
              amount = await xlsxParser.parse(xlsxBytes);
            }
          }

          await prisma.npdDocument.update({
            where: { id: doc.id },
            data: { amount, parsed: true }
          });
        } catch (error) {
          await prisma.npdDocument.update({
            where: { id: doc.id },
            data: { parseError: error.message }
          });

          await prisma.npdError.create({
            data: {
              reportId,
              documentName: doc.name,
              errorCode: 'ERR_PARSE',
              errorMessage: error.message
            }
          });
        }

        await prisma.npdReport.update({
          where: { id: reportId },
          data: {
            processedDocuments: i + 1,
            currentStage: `Обработка ${i + 1}/${documents.length}`
          }
        });

        // Rate limiting: 10 секунд между запросами
        await step.sleep('rate-limit', '10s');
      }
    });

    // Шаг 3: Рассчитать налоги
    await step.run('calculate', async () => {
      await prisma.npdReport.update({
        where: { id: reportId },
        data: { status: 'CALCULATING', currentStage: 'Расчёт налогов...' }
      });

      const parsedDocs = await prisma.npdDocument.findMany({
        where: { reportId, parsed: true }
      });

      const calculator = new TaxCalculator();
      const result = calculator.calculate(parsedDocs);

      // Сохранить помесячные данные
      await prisma.npdMonthlyData.createMany({
        data: Object.entries(result.monthlyData).map(([month, data]) => ({
          reportId,
          month,
          physicalIncome: data.physical,
          legalIncome: data.legal,
          physicalTax: data.physical * 0.04,
          legalTax: data.legal * 0.06,
        }))
      });

      // Обновить итоги
      await prisma.npdReport.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          physicalIncome: result.totals.physical,
          legalIncome: result.totals.legal,
          physicalTax: result.totals.physicalTax,
          legalTax: result.totals.legalTax,
          totalTax: result.totals.totalTax,
          totalIncome: result.totals.totalIncome,
          limitRemaining: 2400000 - result.totals.totalIncome,
          limitExceeded: result.totals.totalIncome > 2400000,
          completedAt: new Date(),
          currentStage: 'Готово'
        }
      });
    });

    return { reportId, status: 'COMPLETED' };
  }
);
```

### 4.6 Зависимости

```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "xlsx": "^0.18.5",
    "inngest": "^3.0.0",
    "exceljs": "^4.4.0"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

### 4.7 Rate Limiting

```typescript
// lib/npd/wb-documents-client.ts
export class WBDocumentsClient {
  private static readonly RATE_LIMIT_DELAY = 10_000; // 10 секунд
  private static readonly RETRY_DELAY = 30_000; // 30 секунд при 429
  private static readonly MAX_RETRIES = 3;

  async fetchDocuments(year: number): Promise<Document[]> {
    // Пагинация с rate limiting
  }

  async downloadDocument(serviceName: string): Promise<Buffer> {
    // Retry при 429
  }
}
```

### 4.8 Environment Variables

```env
# WB Documents API
WB_API_TOKEN=your_token_here

# Inngest
INNGEST_EVENT_KEY=your_event_key
INNGEST_SIGNING_KEY=your_signing_key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/hubmarket
```

---

## 5. UI компоненты

### 5.1 NpdCalculator

```tsx
// components/finance/npd/NpdCalculator.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface NpdCalculatorProps {
  onCalculate: (reportId: string) => void;
}

export function NpdCalculator({ onCalculate }: NpdCalculatorProps) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/finance/npd/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      const data = await response.json();
      onCalculate(data.reportId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-2">Год</label>
        <Select value={year} onChange={setYear}>
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </Select>
      </div>
      <Button onClick={handleCalculate} disabled={loading}>
        {loading ? 'Запуск...' : 'Рассчитать НПД'}
      </Button>
    </div>
  );
}
```

### 5.2 NpdProgress

```tsx
// components/finance/npd/NpdProgress.tsx
'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface NpdProgressProps {
  reportId: string;
  onComplete: () => void;
}

export function NpdProgress({ reportId, onComplete }: NpdProgressProps) {
  const [stage, setStage] = useState('Инициализация...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource(`/api/finance/npd/progress/${reportId}`);

    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setStage(data.message);
      setProgress(data.progress);
    });

    eventSource.addEventListener('complete', () => {
      eventSource.close();
      onComplete();
    });

    return () => eventSource.close();
  }, [reportId, onComplete]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{stage}</div>
      <Progress value={progress} />
      <div className="text-xs text-right">{progress}%</div>
    </div>
  );
}
```

### 5.3 NpdReport

```tsx
// components/finance/npd/NpdReport.tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { NpdExportButton } from './NpdExportButton';

interface NpdReportProps {
  report: ReportResponse;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Январь', '02': 'Февраль', '03': 'Март', '04': 'Апрель',
  '05': 'Май', '06': 'Июнь', '07': 'Июль', '08': 'Август',
  '09': 'Сентябрь', '10': 'Октябрь', '11': 'Ноябрь', '12': 'Декабрь',
};

export function NpdReport({ report }: NpdReportProps) {
  const formatMoney = (value: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);

  return (
    <div className="space-y-6">
      {/* Предупреждение о лимите */}
      {report.limit?.exceeded && (
        <Alert variant="destructive">
          <AlertDescription>
            Внимание! Доход {formatMoney(report.summary!.totalIncome)} превысил лимит НПД {formatMoney(report.limit.value)}!
          </AlertDescription>
        </Alert>
      )}

      {report.limit && report.limit.usagePercent > 80 && !report.limit.exceeded && (
        <Alert variant="warning">
          <AlertDescription>
            Использовано {report.limit.usagePercent.toFixed(1)}% лимита НПД. Осталось {formatMoney(report.limit.remaining)}.
          </AlertDescription>
        </Alert>
      )}

      {/* Сводка */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Физ.лица (4%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(report.summary!.physicalIncome)}</div>
            <div className="text-sm text-muted-foreground">Налог: {formatMoney(report.summary!.physicalTax)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Юр.лица (6%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(report.summary!.legalIncome)}</div>
            <div className="text-sm text-muted-foreground">Налог: {formatMoney(report.summary!.legalTax)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Общий налог НПД</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMoney(report.summary!.totalTax)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">До лимита</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(report.limit!.remaining)}</div>
            <div className="text-sm text-muted-foreground">{report.limit!.usagePercent.toFixed(1)}% использовано</div>
          </CardContent>
        </Card>
      </div>

      {/* Помесячная таблица */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Помесячная разбивка</CardTitle>
          <NpdExportButton reportId={report.id} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Месяц</TableHead>
                <TableHead className="text-right">Физ.лица (4%)</TableHead>
                <TableHead className="text-right">Налог 4%</TableHead>
                <TableHead className="text-right">Юр.лица (6%)</TableHead>
                <TableHead className="text-right">Налог 6%</TableHead>
                <TableHead className="text-right">Итого налог</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.monthlyData?.map((month) => (
                <TableRow key={month.month}>
                  <TableCell>{month.monthName}</TableCell>
                  <TableCell className="text-right">{formatMoney(month.physicalIncome)}</TableCell>
                  <TableCell className="text-right">{formatMoney(month.physicalTax)}</TableCell>
                  <TableCell className="text-right">{formatMoney(month.legalIncome)}</TableCell>
                  <TableCell className="text-right">{formatMoney(month.legalTax)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(month.totalTax)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>ИТОГО</TableCell>
                <TableCell className="text-right">{formatMoney(report.summary!.physicalIncome)}</TableCell>
                <TableCell className="text-right">{formatMoney(report.summary!.physicalTax)}</TableCell>
                <TableCell className="text-right">{formatMoney(report.summary!.legalIncome)}</TableCell>
                <TableCell className="text-right">{formatMoney(report.summary!.legalTax)}</TableCell>
                <TableCell className="text-right">{formatMoney(report.summary!.totalTax)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ошибки */}
      {report.errors && report.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Ошибки обработки ({report.errors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {report.errors.map((error, i) => (
                <li key={i}>{error.documentName}: {error.errorMessage}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### 5.4 NpdExportButton

```tsx
// components/finance/npd/NpdExportButton.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface NpdExportButtonProps {
  reportId: string;
}

export function NpdExportButton({ reportId }: NpdExportButtonProps) {
  const handleExport = () => {
    window.location.href = `/api/finance/npd/export/${reportId}`;
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-2 h-4 w-4" />
      Скачать Excel
    </Button>
  );
}
```

---

## 6. Тестирование

### 6.1 Unit-тесты

```typescript
// __tests__/lib/npd/pdf-parser.test.ts
import { describe, it, expect } from 'vitest';
import { PdfParser } from '@/lib/npd/pdf-parser';
import { readFileSync } from 'fs';

describe('PdfParser', () => {
  const parser = new PdfParser();

  it('should parse weekly report amount', async () => {
    const pdfBytes = readFileSync('__fixtures__/weekly_report_sample.pdf');
    const amount = await parser.parse(pdfBytes);
    expect(amount).toBe(25569.00);
  });

  it('should return 0 for empty PDF', async () => {
    const pdfBytes = readFileSync('__fixtures__/empty.pdf');
    const amount = await parser.parse(pdfBytes);
    expect(amount).toBe(0);
  });

  it('should handle old format PDF', async () => {
    const pdfBytes = readFileSync('__fixtures__/weekly_report_old_format.pdf');
    const amount = await parser.parse(pdfBytes);
    expect(amount).toBeGreaterThan(0);
  });
});
```

```typescript
// __tests__/lib/npd/xlsx-parser.test.ts
import { describe, it, expect } from 'vitest';
import { XlsxParser } from '@/lib/npd/xlsx-parser';
import { readFileSync } from 'fs';

describe('XlsxParser', () => {
  const parser = new XlsxParser();

  it('should parse redeem notification amount', async () => {
    const xlsxBytes = readFileSync('__fixtures__/redeem_notification_sample.xlsx');
    const amount = await parser.parse(xlsxBytes);
    expect(amount).toBe(15234.50);
  });

  it('should return 0 if Итого not found', async () => {
    const xlsxBytes = readFileSync('__fixtures__/invalid_xlsx.xlsx');
    const amount = await parser.parse(xlsxBytes);
    expect(amount).toBe(0);
  });
});
```

```typescript
// __tests__/lib/npd/tax-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { TaxCalculator } from '@/lib/npd/tax-calculator';

describe('TaxCalculator', () => {
  const calculator = new TaxCalculator();

  it('should calculate 4% tax for physical income', () => {
    const result = calculator.calculate([
      { documentType: 'WEEKLY_REPORT', amount: 100000, date: new Date('2025-01-15') }
    ]);
    expect(result.totals.physicalTax).toBe(4000);
  });

  it('should calculate 6% tax for legal income', () => {
    const result = calculator.calculate([
      { documentType: 'REDEEM_NOTIFICATION', amount: 100000, date: new Date('2025-01-15') }
    ]);
    expect(result.totals.legalTax).toBe(6000);
  });

  it('should aggregate by month', () => {
    const result = calculator.calculate([
      { documentType: 'WEEKLY_REPORT', amount: 50000, date: new Date('2025-01-10') },
      { documentType: 'WEEKLY_REPORT', amount: 50000, date: new Date('2025-01-20') },
    ]);
    expect(result.monthlyData['2025-01'].physical).toBe(100000);
  });

  it('should detect limit exceeded', () => {
    const result = calculator.calculate([
      { documentType: 'WEEKLY_REPORT', amount: 2500000, date: new Date('2025-01-15') }
    ]);
    expect(result.limit.exceeded).toBe(true);
  });
});
```

### 6.2 Integration-тесты

```typescript
// __tests__/api/finance/npd/calculate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/finance/npd/calculate/route';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/inngest/client';

vi.mock('@/lib/prisma');
vi.mock('@/inngest/client');

describe('POST /api/finance/npd/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create report and trigger inngest job', async () => {
    const mockReport = { id: 'test-id', year: 2025, status: 'PENDING' };

    vi.mocked(prisma.npdReport.create).mockResolvedValue(mockReport);
    vi.mocked(inngest.send).mockResolvedValue({ ids: ['event-id'] });

    const request = new Request('http://localhost/api/finance/npd/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2025 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data.reportId).toBe('test-id');
    expect(inngest.send).toHaveBeenCalledWith({
      name: 'npd/calculate',
      data: expect.objectContaining({ reportId: 'test-id', year: 2025 }),
    });
  });
});
```

### 6.3 E2E-тесты

```typescript
// e2e/npd-calculation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('NPD Calculation', () => {
  test('should calculate NPD report', async ({ page }) => {
    await page.goto('/finance/npd');

    // Выбрать год
    await page.selectOption('[data-testid="year-select"]', '2025');

    // Нажать кнопку расчёта
    await page.click('[data-testid="calculate-button"]');

    // Дождаться прогресса
    await expect(page.locator('[data-testid="progress-indicator"]')).toBeVisible();

    // Дождаться результата (может занять время)
    await expect(page.locator('[data-testid="npd-report"]')).toBeVisible({ timeout: 120000 });

    // Проверить что есть итоговая сумма
    await expect(page.locator('[data-testid="total-tax"]')).toContainText('₽');
  });

  test('should export to Excel', async ({ page }) => {
    await page.goto('/finance/npd/completed-report-id');

    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/npd_report.*\.xlsx/);
  });
});
```

### 6.4 Граничные случаи

| Кейс | Входные данные | Ожидаемый результат |
|------|----------------|---------------------|
| Нет документов | Пустой год | Сообщение "Документы не найдены" |
| Только физ.лица | Только еженедельные отчёты | legalIncome = 0, legalTax = 0 |
| Только юр.лица | Только уведомления о выкупе | physicalIncome = 0, physicalTax = 0 |
| Превышение лимита | Доход > 2.4 млн | limitExceeded = true, warning |
| Ровно на лимите | Доход = 2.4 млн | limitExceeded = false, remaining = 0 |
| Битый PDF | Некорректный файл | Ошибка в списке, расчёт продолжается |
| Rate limit 429 | Превышен лимит WB API | Retry через 30 сек |

---

## 7. Roadmap

### Фаза 1: MVP (Q1 2026)
- [x] Парсинг PDF еженедельных отчётов (4%)
- [x] Парсинг XLSX уведомлений о выкупе (6%)
- [ ] API endpoints
- [ ] Background job
- [ ] UI компоненты
- [ ] Экспорт в Excel

### Фаза 2: Мульти-маркетплейс (Q2 2026)
- [ ] Ozon НПД (аналогичные документы)
- [ ] Яндекс.Маркет НПД
- [ ] Единый отчёт по всем МП

### Фаза 3: Интеграция с "Мой налог" (Q3 2026)
- [ ] OAuth авторизация в ФНС
- [ ] Автоматическая выгрузка чеков
- [ ] Синхронизация статусов

### Фаза 4: Расширенная аналитика (Q4 2026)
- [ ] Прогноз достижения лимита
- [ ] Оптимизация налоговой нагрузки
- [ ] Интеграция с 1С

---

## Приложение A: WB Documents API Reference

### Аутентификация
```
Authorization: {WB_API_TOKEN}
```

### GET /api/v1/documents/list

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| locale | string | Yes | `ru` |
| limit | int | No | 1-100, default 50 |
| offset | int | No | default 0 |
| beginTime | string | Yes | YYYY-MM-DD |
| endTime | string | Yes | YYYY-MM-DD |
| sort | string | No | `date`, `name` |
| order | string | No | `asc`, `desc` |

**Response:**
```json
{
  "data": {
    "documents": [
      {
        "serviceName": "string (unique ID)",
        "name": "Отчет №123456789 от 2025-01-13",
        "category": "Еженедельный отчёт реализации",
        "categoryId": "string",
        "creationTime": "2025-01-13T12:00:00Z",
        "extensions": ["pdf", "xlsx", "zip"]
      }
    ]
  }
}
```

### GET /api/v1/documents/download

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| serviceName | string | Yes | Document unique ID |
| extension | string | Yes | `pdf`, `xlsx`, `zip` |

**Response:**
```json
{
  "data": {
    "document": "base64_encoded_content"
  }
}
```

---

## Приложение B: Структура PDF "Еженедельный отчёт"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ЕЖЕНЕДЕЛЬНЫЙ ОТЧЕТ РЕАЛИЗАЦИИ                           │
│                         за период: 06.01.2025 - 12.01.2025                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────┬────────────────────────────────────┬─────────┬─────────┬──────────┐│
│  │ №   │ Наименование                       │ Кол-во  │ Цена    │ Сумма    ││
│  ├─────┼────────────────────────────────────┼─────────┼─────────┼──────────┤│
│  │ 1.  │ Всего стоимость реализованного     │    -    │    -    │ 25 569,00││  ◄── Это поле!
│  │     │ товара                              │         │         │          ││
│  ├─────┼────────────────────────────────────┼─────────┼─────────┼──────────┤│
│  │ 2.  │ Услуги WB                          │    -    │    -    │  5 000,00││
│  ├─────┼────────────────────────────────────┼─────────┼─────────┼──────────┤│
│  │     │ ...                                │         │         │          ││
│  └─────┴────────────────────────────────────┴─────────┴─────────┴──────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Алгоритм парсинга:**
1. Открыть первую страницу PDF
2. Извлечь все таблицы
3. Найти строку где:
   - Колонка 0 = "1." или "1.1"
   - Колонка 1 содержит "всего стоимость реализованного товара" (регистронезависимо)
4. Взять значение из колонки 5 (индекс 5)
5. Очистить: убрать пробелы, заменить `,` на `.`

---

## Приложение C: Структура XLSX "Уведомление о выкупе"

```
┌─────┬────────────────────────┬──────────┬──────────┬──────────────┬─────────┐
│  A  │          B             │    C     │    D     │      E       │    F    │
├─────┼────────────────────────┼──────────┼──────────┼──────────────┼─────────┤
│  1  │ Артикул               │ Название │ Кол-во   │ Сумма выкупа │ Статус  │
├─────┼────────────────────────┼──────────┼──────────┼──────────────┼─────────┤
│  2  │ 123456                 │ Товар 1  │    5     │    15 000,00 │ Выкуплен│
├─────┼────────────────────────┼──────────┼──────────┼──────────────┼─────────┤
│  3  │ 789012                 │ Товар 2  │    2     │     5 234,50 │ Выкуплен│
├─────┼────────────────────────┼──────────┼──────────┼──────────────┼─────────┤
│ ... │ ...                    │ ...      │ ...      │ ...          │ ...     │
├─────┼────────────────────────┼──────────┼──────────┼──────────────┼─────────┤
│ N   │ Итого:                 │    -     │    7     │    20 234,50 │    -    │  ◄── Это поле!
└─────┴────────────────────────┴──────────┴──────────┴──────────────┴─────────┘
                                                           ▲
                                                           │
                                                    Колонка 4 (индекс E)
```

**Алгоритм парсинга:**
1. Открыть активный лист
2. Перебрать все строки
3. Найти строку где колонка A = "Итого:" или "Итого"
4. Взять значение из колонки E (индекс 4)
5. Очистить: убрать пробелы, заменить `,` на `.`

---

## История изменений

| Версия | Дата | Автор | Изменения |
|--------|------|-------|-----------|
| 1.0 | 2026-02-03 | Claude | Первоначальная версия |
