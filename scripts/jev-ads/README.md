# Чистка рекламы через TypeSafe Jev

Черновик и правила: `business-os/execution/2026-09-28-jev-chistka-reklamy.md`, инструмент: `business-os/tools/jev.md`.

Повторный прогон (04.10 — KIT, 08.10 — WB):
1. Отчёт Директа по площадкам кампании 714530831 (Placement, AdGroupName, Impressions, Clicks, Cost, Conversions) в TSV — путь в `PLACEMENTS`.
2. Корзины по площадкам — тот же отчёт с `Goals: ["604982732"]`, `AttributionModels: ["LSC"]`.
3. WB: `GET /api/advert/v2/adverts?statuses=9,11` → `wb_adverts.json`, `POST /adv/v0/normquery/stats` → `nq_stats.json`, карточки `content/v2/get/cards/list` → `wb_cards.json`.
4. `TYPESAFE_API_KEY` в окружении, `python3 jev_ads.py`. Второй вопрос WB (общий запрос или про особенность товара, Score) задавался отдельным прогоном — см. черновик, раздел Г.

`data-2026-09-28/` — результаты первого прогона для сравнения.
