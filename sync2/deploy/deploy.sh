#!/usr/bin/env bash
# Выкладка sync2 на VPS (запуск с Mac из sync2/): код без node_modules и .env;
# .env и logs на сервере не трогаются.
set -euo pipefail
HOST=root@147.45.171.40
DIR=/opt/sync2
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# COPYFILE_DISABLE — без служебных ._* файлов macOS в архиве
COPYFILE_DISABLE=1 tar --no-xattrs --exclude node_modules --exclude .env --exclude logs -czf "$TMP/sync2.tgz" .
ssh "$HOST" "mkdir -p $DIR/logs"
scp -q "$TMP/sync2.tgz" "$HOST:$DIR/"
# Серверная часть (распаковка, npm ci, миграции) — под той же блокировкой, что крон `tick`
# (flock -n /tmp/sync2.lock в deploy/crontab.sync2.txt): тик не стартует между новым кодом и
# миграцией базы (новый код на старой схеме). Идущий тик выкладка ждёт до 10 минут (тик
# ограничен timeout 9m); не дождалась — падает, ничего не распаковав.
# Скрипт уходит через stdin (`bash -s`) — без вложенных кавычек в ssh-строке. Поэтому у команд,
# которые могли бы читать stdin, он закрыт (</dev/null): иначе они съели бы остаток скрипта.
ssh "$HOST" "flock -w 600 /tmp/sync2.lock bash -s -- $DIR" <<'REMOTE'
set -euo pipefail
cd "$1"
tar xzf sync2.tgz
rm sync2.tgz
find . -name '._*' -delete
npx -y npm@11.16.0 ci --silent </dev/null
if [ -f .env ]; then
  set -a && . ./.env && set +a
  npm run db:migrate </dev/null
else
  echo '.env нет — миграции пропущены (разовая настройка: deploy/README.md)'
fi
REMOTE
echo "выложено в $HOST:$DIR"
