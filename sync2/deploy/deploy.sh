#!/usr/bin/env bash
# Выкладка sync2 на VPS (запуск с Mac из sync2/): код без node_modules и .env;
# .env и logs на сервере не трогаются.
set -euo pipefail
HOST=root@147.45.171.40
DIR=/opt/sync2
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# COPYFILE_DISABLE — без служебных ._* файлов macOS в архиве
COPYFILE_DISABLE=1 tar --exclude node_modules --exclude .env --exclude logs -czf "$TMP/sync2.tgz" .
ssh "$HOST" "mkdir -p $DIR/logs"
scp -q "$TMP/sync2.tgz" "$HOST:$DIR/"
ssh "$HOST" "cd $DIR && tar xzf sync2.tgz && rm sync2.tgz && find . -name '._*' -delete && npx -y npm@11.16.0 ci --silent && if [ -f .env ]; then set -a && . ./.env && set +a && npm run db:migrate; else echo '.env нет — миграции пропущены (разовая настройка: deploy/README.md)'; fi"
echo "выложено в $HOST:$DIR"
