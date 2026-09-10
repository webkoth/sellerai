#!/usr/bin/env bash
# Одноразовое восстановление синка после простоя 03.08–03.09.2026 (запускается на VPS через nohup).
# Ждёт окна лимита statistics-api WB (/supplier/orders), затем:
#   stocks --apply  (леджер уже пересеян от WB) → при успехе ставит crontab из deploy/crontab.txt.
# Каждый 429 продлевает штрафное окно WB, поэтому между попытками пауза 20 мин и не больше 6 попыток.
set -u
cd /opt/sellerai-sync
LOG=logs/restore-20260903.log
WAIT_UNTIL="${1:-}"          # epoch UTC, до которого спать перед первой попыткой (пусто = сразу)
say() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

if [[ -n "$WAIT_UNTIL" ]]; then
  now=$(date -u +%s); [[ "$WAIT_UNTIL" -gt "$now" ]] && { say "сплю до $(date -u -d @"$WAIT_UNTIL" +%FT%TZ) ($((WAIT_UNTIL-now)) с)"; sleep $((WAIT_UNTIL-now)); }
fi

for attempt in 1 2 3 4 5 6; do
  say "попытка $attempt: stocks --apply"
  TELEGRAM_BOT_TOKEN= /usr/bin/node sync/dist/orchestrator.js stocks --apply > /tmp/restore-stocks.log 2>&1
  grep -v '\[READ\]\|wb_fetch_retry' /tmp/restore-stocks.log | grep -E 'пул:|К изменению|→|applied|ошибки|notUpdated|пропущена|STOP|FATAL|Не удалось' | tee -a "$LOG"
  if grep -q 'applied:' /tmp/restore-stocks.log; then
    say "stocks --apply OK → ставлю crontab (чужие задачи на VPS, например tg-digest, сохраняются)"
    crontab -l > "logs/crontab.before-restore-$(date -u +%Y%m%dT%H%M%SZ).txt" 2>/dev/null || true
    { crontab -l 2>/dev/null | grep -v 'sellerai-sync' | grep -v '^$'; cat deploy/crontab.txt; } | crontab - \
      && crontab -l | grep -v '^#' | grep -v '^$' | tee -a "$LOG"
    say "DONE"
    exit 0
  fi
  if grep -q 'STOP: аномально много' /tmp/restore-stocks.log; then say "ABORT: сработал guard, нужен ручной разбор"; exit 3; fi
  say "не прошло (скорее всего лимит WB) — пауза 20 мин"
  sleep 1200
done
say "FAILED: 6 попыток исчерпаны"
exit 4
