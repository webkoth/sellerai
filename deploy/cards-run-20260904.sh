#!/usr/bin/env bash
# Одноразовое создание недостающих карточек Ozon/ЯМ (04.09.2026) + выравнивание остатков. Запуск на VPS через nohup.
# cards требует цены WB (discounts-prices: 1 запрос в ~12 мин, штраф не растёт, но слот один) —
# при 429 ждём ровно столько, сколько просит X-Ratelimit-Retry, и пробуем снова (до 5 раз).
set -u
cd /opt/sellerai-sync
LOG=logs/cards-20260904.log
say() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }
[[ -n "${1:-}" ]] && { say "начальная пауза $1 с"; sleep "$1"; }

for attempt in 1 2 3 4 5; do
  say "попытка $attempt: cards --apply"
  /usr/bin/node sync/dist/orchestrator.js cards --apply > /tmp/cards-apply.log 2>&1 || true
  grep -v '\[READ\]' /tmp/cards-apply.log | grep -E 'К созданию|import task|Ozon цены|Ozon остатки|создано:|❌|FATAL|статус не финализ' | cut -c1-240 | tee -a "$LOG"
  if grep -q 'FATAL' /tmp/cards-apply.log && grep -q 'discountsandprices' /tmp/cards-apply.log; then
    w=$(grep -o 'retry after [0-9]*' /tmp/cards-apply.log | head -1 | grep -o '[0-9]*'); w=${w:-700}
    say "лимит цен WB — жду $((w+30)) с"; sleep $((w+30)); continue
  fi
  if grep -q 'FATAL' /tmp/cards-apply.log; then say "ABORT: другая ошибка"; grep -A3 FATAL /tmp/cards-apply.log | head -5 | tee -a "$LOG"; exit 3; fi
  break
done
say "stocks --apply после карточек (через 60 с)"; sleep 60
/usr/bin/node sync/dist/orchestrator.js stocks --apply 2>&1 | grep -v '\[READ\]' | grep -E 'пул:|К изменению|applied|ошибки|notUpdated|пропущена|STOP|FATAL' | cut -c1-200 | tee -a "$LOG"
say "DONE"
