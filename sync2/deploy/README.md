# Выкладка sync2 на VPS (этап 1.3b, dry-run)

VPS `root@147.45.171.40`: Ubuntu 24.04, Node 24, PostgreSQL 18 (общий с другими проектами —
трогать только роль и базу `sync2`). Старый синк `/opt/sellerai-sync`, его `.env` и строки крона
не меняются.

## Обычная выкладка

```bash
cd sync2 && npm run deploy
```

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

## Откат

```bash
ssh root@147.45.171.40 'crontab -l | grep -v "sync2" | crontab -'
```

Старый синк при этом не затрагивается. Полное удаление — дополнительно
`rm -rf /opt/sync2 /etc/logrotate.d/sync2` и `sudo -u postgres dropdb sync2 && sudo -u postgres dropuser sync2`.
