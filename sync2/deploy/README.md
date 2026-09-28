# Выкладка sync2 на VPS (этапы 1.3b–1.4)

VPS `root@147.45.171.40`: Ubuntu 24.04, Node 24, PostgreSQL 18 (общий с другими проектами —
трогать только роль и базу `sync2`). Старый синк `/opt/sellerai-sync`, его `.env` и строки крона
не меняются.

## Обычная выкладка

```bash
cd sync2 && npm run deploy
```

Серверная часть — распаковка, `npm ci`, `db:migrate` (если есть `.env`) — идёт под `flock -w 600 /tmp/sync2.lock`,
той же блокировкой, что крон `tick`: тик не стартует между новым кодом и миграцией. Идущий тик выкладка ждёт до
10 минут; не дождалась — падает, ничего не распаковав (архив остаётся в `/opt/sync2/sync2.tgz`, повторить
`npm run deploy`). `compare-v1` крона под блокировкой не идёт — выкладку не делать около 06:05 UTC.

## Разовая настройка

Выполнять по шагам, проверяя вывод. Пароль базы создаётся на сервере и сразу пишется в `.env` —
в терминал и в git он не попадает.

```bash
# 1) Роль и база — только свои
ssh root@147.45.171.40 'cd /tmp && sudo -u postgres createuser sync2 && sudo -u postgres createdb -O sync2 sync2'

# 2) Код (миграции пропустятся — .env ещё нет)
cd sync2 && npm run deploy

# 3) .env: ключи площадок и Telegram — из .env старого синка, пароль базы — новый
ssh root@147.45.171.40 'set -e; cd /opt/sync2; umask 077
P=$(openssl rand -hex 16)
sudo -u postgres psql -q -c "ALTER ROLE sync2 LOGIN PASSWORD '"'"'$P'"'"'"
grep -E "^(WB_API_TOKEN|OZON_CLIENT_ID|OZON_API_TOKEN|YM_API_TOKEN|YM_BUSINESS_ID|YM_CAMPAIGN_ID|YAKIT_API_TOKEN|TELEGRAM_BOT_TOKEN)=" /opt/sellerai-sync/.env > .env
cat >> .env <<EOF
DATABASE_URL=postgres://sync2:$P@localhost:5432/sync2
SYNC_WRITE_MODE=dry-run
LOG_LEVEL=info
YM_WAREHOUSE_IDS=2369574
KIT_WAREHOUSE_ID=01980d4c-1b53-7aa1-ab23-1b7c23604704
TELEGRAM_CHAT_ID=-1004395280612
V1_LEDGER_PATH=/opt/sellerai-sync/data/state/inventory.json
EOF
chmod 600 .env; grep -oE "^[A-Z_0-9]+=" .env'

# 4) Миграции, площадки, режимы записи
ssh root@147.45.171.40 'cd /opt/sync2 && set -a && . ./.env && set +a && npm run db:migrate && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts" && $T seed-channels && $T write-mode ozon dry-run && $T write-mode ym dry-run && $T write-mode kit dry-run'

# 5) Первый прогон руками — не в минуты старого синка (3,8,…,58 и :00/:30)
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; $T tick; $T runs 5; free -m'

# 6) Крон — ДОПИСАТЬ к существующему, не заменять (старый синк живёт там же)
ssh root@147.45.171.40 'crontab -l > /opt/sync2/logs/crontab.before-sync2.txt; crontab -l | grep -q "/opt/sync2" || (crontab -l; cat /opt/sync2/deploy/crontab.sync2.txt) | crontab -; crontab -l | grep sync2'

# 7) Ротация логов
ssh root@147.45.171.40 'cp /opt/sync2/deploy/logrotate.sync2 /etc/logrotate.d/sync2 && logrotate -d /etc/logrotate.d/sync2 2>&1 | tail -3'
```

Память: после первого `tick` проверить `free -m`; если свободной (`available`) меньше 150 МБ —
не включать крон, сообщить владельцу.

## Каталог WB отклонён (`catalogRejected`)

Каталог WB пуст или короче 90 % прошлого принятого — `ingest` не пишет снимки и заказы зеркал, пока каталог
не примут вручную (текст в `runs.error`). Если усадка настоящая (карточки удалены в WB) — принять под той же
блокировкой, что и крон:

```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts ingest --accept-catalog'
```

## Этап 1.4 — запись на площадки

План с «да» владельца на каждом шаге: `docs/superpowers/plans/2026-09-28-sync2-stage-1-4-pereklyuchenie.md`
(Task 15–19). Не выполнять в минуты кронов (`sync2` `1,6,…,56`; старый синк `3,8,…,58`, `:00/:30`).

**Выкладка кода** — обычная (`npm run deploy`, миграция 0003: `products.wb_chrt_id`, `writes.uncertain`,
`writes.external_sku`). Без миграции новый код не пишет журнал `writes` и в dry-run.

**`.env`** — склады записи (без них запись WB/Ozon невозможна, чтение работает):

```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
cp .env logs/.env.bak-1-4
grep -q '^WB_WAREHOUSE_ID=' .env || echo 'WB_WAREHOUSE_ID=1408913' >> .env
grep -q '^OZON_WAREHOUSE_ID=' .env || echo 'OZON_WAREHOUSE_ID=1020005023618600' >> .env
grep -E '^(WB_WAREHOUSE_ID|OZON_WAREHOUSE_ID|SYNC_WRITE_MODE)=' .env
REMOTE
```

На шаге A — `SYNC_WRITE_MODE=apply` (площадки WB/Ozon/ЯМ/KIT до шага B защищены своим `dry-run` в `channels`).

**Крон** — блок `sync2` заменяется целиком (tick раз в 5 минут, `compare-v1`, `drift`, `prune`); WB — в `dry-run`
(план WB в журнале для предпросмотра шага B):

```bash
scp deploy/crontab.sync2.txt root@147.45.171.40:/opt/sync2/deploy/crontab.sync2.txt
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
crontab -l > /opt/sync2/logs/crontab.before-1-4.txt
crontab -l | grep -v -e '/opt/sync2' -e '^# sync2 (этап 1.3b' -e '^# timeout 9m: зависший' -e '^# сверка со старым синком — раз в сутки' > /tmp/cron.1-4
cat /opt/sync2/deploy/crontab.sync2.txt >> /tmp/cron.1-4
crontab /tmp/cron.1-4 && rm /tmp/cron.1-4
crontab -l | grep -n -e 'sync2' -e 'orchestrator.js'
cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts write-mode wb dry-run
REMOTE
```

Откат крона: `ssh root@147.45.171.40 'crontab /opt/sync2/logs/crontab.before-1-4.txt'`.

### Шаг A — сайт

```bash
# 1) глобальный apply (запись всё ещё не идёт: WB/Ozon/ЯМ/KIT — dry-run, сайт — off)
ssh root@147.45.171.40 'cd /opt/sync2 && cp .env logs/.env.bak-1-4A && sed -i "s/^SYNC_WRITE_MODE=.*/SYNC_WRITE_MODE=apply/" .env && grep ^SYNC_WRITE_MODE= .env'
# 2) полный PUT пула на сайт (витрина ещё на wb — пишется только pool_stocks)
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock sh -c "$T tick && $T site-push-all --confirm"'
# 3) витрина на пул — сервер сайта; ожидается agg_mismatch = 0 и 200 /catalog
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
cp .env /root/kotelnika-env.bak-1-4A
sed -i 's/^STOCK_SOURCE=.*/STOCK_SOURCE=pool/' .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
npm run stock:recalc-pool
set -a && . ./.env && set +a
psql "$DATABASE_URL" -X -A -F " | " \
  -c "select count(*) as agg_mismatch from wb_products p where p.stocks <> coalesce((select sum(ps.quantity) from wb_product_sizes s join wb_product_skus sk on sk.size_id = s.id join pool_stocks ps on ps.barcode = sk.sku where s.product_id = p.id), 0)" \
  -c "select count(*) filter (where is_visible) as visible, count(*) as products from wb_products"
REMOTE
curl -s -o /dev/null -w "%{http_code} /catalog\n" https://kotelnikovartifact.ru/catalog
# 4) тик и план сайта
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock $T tick; $T runs 2; $T plan site'
# 5) запись сайта в apply и первый боевой тик
ssh root@147.45.171.40 'cd /opt/sync2 && T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"; flock /tmp/sync2.lock sh -c "$T write-mode site apply --confirm && $T tick"; $T runs 2; $T plan site'
```

`write-mode <площадка> apply` печатает план площадки из последнего `pool` и отказывает (код 2), если `pool` не
запускался, упал, не пересчитал пул, старше 15 минут или план площадки отклонён предохранителем; без `--confirm`
режим не меняется.

### Перед шагом B — живая проверка тела записи ЯМ (решение владельца 28.09, п. 6)

Одному офферу ЯМ записать его текущий остаток (значение не меняется) телом, которое формирует отправитель sync2
(`ymStocksBody`, `packages/platforms/src/ym/stock-writer.ts`); успех — `status: OK` и тот же остаток при чтении.
Выполнять с предпросмотром тела и «да» владельца в момент шага.

### Шаг B — WB, Ozon, ЯМ, KIT разом

Условия (только чтение, утром после `compare-v1`): `compare-v1` — «расходится 0»; `plan ozon`/`plan ym` — только
строки многоразмерных карточек или пусто; `plan kit` — пусто; `plan wb` — пусто или заказы последних минут.

Окно переключения — одно «да» на весь скрипт, сразу после тика `sync2`. Строки старого синка `orders --apply`,
`stocks --apply` и `reconcile` (решение владельца 28.09, п. 2) закомментированы префиксом `#OFF-1.4`; `finance`
остаётся. Не дошли до переключения — крон старого синка возвращается сам (`trap`):

```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"
exec 9>/tmp/sync2.lock
flock -w 600 9                                   # тики sync2 стоят до конца скрипта
crontab -l > /opt/sync2/logs/crontab.before-1-4B.txt
trap 'crontab /opt/sync2/logs/crontab.before-1-4B.txt; echo "СТОП: крон старого синка возвращён, sync2 в dry-run"' ERR
crontab -l | sed -E 's@^([^#].*orchestrator\.js (orders --apply|stocks --apply|reconcile).*)$@#OFF-1.4 \1@' | crontab -
crontab -l | grep -n 'orchestrator.js'
# Последний прогон заказов старого синка: заказы, которые он увидел, но ещё не записал на WB, — на WB.
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/dist/orchestrator.js orders --apply 2>&1 | tail -3
$T tick
$T check-wb                                      # код ≠ 0 — стоп: снимок WB расходится с пулом
for c in wb ozon ym kit; do $T write-mode "$c" apply --confirm; done
trap - ERR
$T tick                                          # первый боевой тик: WB в режиме self
$T runs 2
$T plan
REMOTE
```

Затем снять `compare-v1` с крона (леджер старого синка больше не обновляется):

```bash
ssh root@147.45.171.40 'crontab -l | grep -v -e "cli.ts compare-v1" -e "^# сверка со старым синком — 09:05 МСК" | crontab - && crontab -l | grep -n sync2'
```

После шага B WB руками правят только физику (поступление, брак, потеря): продажи Ozon, ЯМ, KIT и сайта снимает
с WB синк (решение владельца 28.09, п. 3).

### Наблюдение

`drift --print` — пул ↔ последние снимки площадок и записи за сутки (без `--print` — в Telegram, крон 06:10 UTC);
`check-wb` — снимок WB = пул (код 0/3); `plan [<площадка>]` — план/итог последнего `pool`. Уведомления: смена
статуса `ingest`/`pool`, напоминание каждые 72 прогона (≈6 ч), «площадка X: запись не проходит N тиков подряд»
(с 3-го тика) и «снова проходит».

## Откат этапа 1.4

Каждый вариант — одно «да» владельца на весь вариант.

**Вариант A — откат шага A** (сайт снова на WB; до шага B):

```bash
ssh root@147.45.171.40 'cd /opt/sync2 && flock /tmp/sync2.lock node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts write-mode site off'
ssh root@201.34.133.76 'bash -s' <<'REMOTE'
set -euo pipefail
cd /var/www/kotelnika-store
sed -i 's/^STOCK_SOURCE=.*/STOCK_SOURCE=wb/' .env
bash scripts/check-stock-source.sh .env
pm2 reload ecosystem.config.cjs --update-env
npm run wb:sync:stocks        # агрегат снова от WB (~5,5 мин)
REMOTE
```

**Вариант B — откат шага B** (WB, Ozon, ЯМ, KIT снова пишет старый синк; сайт остаётся на пуле). Последний тик
`sync2` с записью выравнивает WB по всем заказам до этой минуты — пересев от WB тогда не теряет их. Если откат
из-за ошибочных записей `sync2` — строку `$T tick` убрать, а заказы последних 10 минут
(`select * from pool_events where occurred_at > now() - interval '10 minutes'`) сверить с WB руками.

```bash
ssh root@147.45.171.40 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/sync2
T="node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts"
exec 9>/tmp/sync2.lock
flock -w 600 9
$T tick                                                   # последний тик с записью
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/scripts/ledger-reseed-from-wb.mjs --apply | tail -3
for c in wb ozon ym kit; do $T write-mode "$c" dry-run; done
flock -w 120 /tmp/sai-ledger.lock /usr/bin/node /opt/sellerai-sync/sync/dist/orchestrator.js stocks --apply | tail -5
crontab -l | sed -E 's@^#OFF-1\.4 @@' | crontab -          # orders, stocks и reconcile старого синка
grep -q 'cli.ts compare-v1' <(crontab -l) || (crontab -l; echo '5 6 * * * cd /opt/sync2 && timeout 5m node_modules/.bin/tsx --env-file=.env apps/worker/src/cli.ts compare-v1 >> logs/compare.log 2>&1') | crontab -
crontab -l | grep -n -e 'orchestrator.js' -e 'compare-v1'
REMOTE
```

Пересев — без `--no-wb-orders`: иначе заказы KIT не помечаются учтёнными и первый `stocks` вычтет их повторно.
WB возвращается в `external` сам (действующий режим WB — `dry-run`). Владельцу: «продажи на сайте снова снимаем
с WB руками».

**Вариант «полный»** — вариант B, затем
`ssh root@147.45.171.40 'sed -i "s/^SYNC_WRITE_MODE=.*/SYNC_WRITE_MODE=dry-run/" /opt/sync2/.env'`, затем вариант A.

## Откат

```bash
ssh root@147.45.171.40 'crontab -l | grep -v "sync2" | crontab -'
```

Старый синк при этом не затрагивается. После шага B этапа 1.4 снятие крона `sync2` без отката 1.4 оставляет
площадки без писателя — сначала «Откат этапа 1.4». Полное удаление — дополнительно
`rm -rf /opt/sync2 /etc/logrotate.d/sync2` и `sudo -u postgres dropdb sync2 && sudo -u postgres dropuser sync2`.
