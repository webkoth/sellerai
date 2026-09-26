# sync2 — синк остатков, цен и карточек на пять площадок

Спека: `../docs/superpowers/specs/2026-09-25-sync-v2-design.md`.
Решение: `business-os/decisions/2026-09-25-sinhronizaciya-ostatkov-cen-i-kartochek.md`.
Пишется по правилам finstock (`~/projects/finstock/CLAUDE.md`) и позже переносится туда копированием папок.

## Запуск локально

```bash
cd sync2
npm install
createdb sync2 && createdb sync2_test
cp .env.example .env
npm run db:migrate
npm run cli -- seed-channels
npm run cli -- ping
```

## Проверки

```bash
npm run typecheck
npm test          # быстрые тесты; тесты базы пропускаются без TEST_DATABASE_URL
npm run test:db   # тесты на живой базе sync2_test (схема стирается!)
```

## Правила

- Слои: площадка → адаптер (`packages/platforms`) → сырьё (только дописывается) → домен (чистый) → действие.
- Запись на площадку — только через `executeWrites` (`packages/platforms/src/writer.ts`).
  Действует меньший из двух режимов: `SYNC_WRITE_MODE` и `channels.write_mode`. По умолчанию оба `off`.
  Битый режим, неизвестная площадка, дубль операции — не отправляются. Сбой журнала `writes` после отправки
  бросает `WriteJournalError` с итогами по позициям — `withRun` пишет их в лог.
- Защита от дублей — уникальными индексами и check-ограничениями в базе, не проверками в коде.
- Каждая джоба — внутри `withRun`: журнал `runs`, лог с `run_id`.
- Текст ошибки — только через `errorText` из `@sync2/shared`.
- Изменение схемы: правка `packages/db/src/schema.ts` → `npm run db:generate` → миграция в git.

## Пул остатков (этап 1.2)

- `packages/domain` — чистые функции, из `@sync2/shared` только типы:
  - `reconcilePool` — перенос из finstock (`cabinetId → channelId`), 21 тест перенесены как есть;
  - `toPoolOrders` — заказы WB не вычитаются (они в снимке WB), `cancelled_before_ship` возвращает единицу, `returned` — нет;
  - `wbSignalAccepted` / `acceptedWbBarcodes` / `applyWbWriteOutcomes` — когда WB пишет sync2: WB правится только по баркодам,
    чей сигнал WB принят в этом прогоне; применилась запись → ожидание = база и `expectedAt = now`; исход неизвестен →
    `max(база, факт)`; не применилась → факт из снимка;
  - `planStockWrites` — было → станет по площадкам (с артикулом), сироты обнуляются, `hold` удерживает баркоды площадки,
    больше 120 разных баркодов — не писать ничего.
- `packages/db`: `upsertOrders`/`loadOrdersSince`, `insertStockSnapshot`/`latestStockSnapshots`,
  `loadPoolState`/`savePoolRun` (одна транзакция). Время из базы — `toIso`: Postgres отдаёт текст, домен живёт в ISO.
- Приёмка: `packages/db/src/pool-cycle.db.test.ts` — вся история товара на живой базе.
