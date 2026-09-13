"""Загрузка креативов РСЯ в хранилище KIT и обновление images/images.json.

Коммандер тянет картинки по публичным ссылкам из колонок «Изображение 1…5» XLSX,
поэтому файлы должны лежать в интернете. Хранилище KIT (POST /v1/files) отдаёт
постоянные ссылки на avatars.mds.yandex.net, отдельный хостинг не нужен.
"""
from pathlib import Path
import json, os, time, urllib.request, urllib.error, uuid

ROOT = Path('/Users/minas/projects/sai_kotelnikovartifact')
IMG = ROOT / 'marketing/direct/images'
MANIFEST = IMG / 'images.json'
API = 'https://api.kit.yandex.net'


def token() -> str:
    for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
        if line.startswith('YAKIT_API_TOKEN='):
            return line.split('=', 1)[1].strip().strip('"')
    raise SystemExit('YAKIT_API_TOKEN не найден')


TOK = token()


def upload(path: Path) -> dict:
    data = path.read_bytes()
    b = '----kit' + uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f'Content-Type: image/jpeg\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(f'{API}/v1/files', data=body, method='POST',
                                 headers={'Authorization': 'Bearer ' + TOK,
                                          'Content-Type': f'multipart/form-data; boundary={b}'})
    for attempt in range(6):
        try:
            return json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503):
                time.sleep(2 + attempt)
                continue
            raise SystemExit(f'{path.name}: {e.code} {e.read()[:200].decode()}')
    raise SystemExit(f'{path.name}: не загрузился')


def main():
    sources = {s['key']: s for s in json.loads((IMG / '_sources.json').read_text())}
    out, n = {}, 0
    for key in sorted(sources):
        path = IMG / f'{key}.jpg'
        r = upload(path)
        s = sources[key]
        out[key] = {'file': f'marketing/direct/images/{key}.jpg', 'url': r['url'],
                    'size': s['size'], 'image_id': r['id'], 'public': True,
                    'content_type': 'image/jpeg', 'kit_id': s['kit_id'], 'scene': s['src']}
        n += 1
        if n % 10 == 0:
            print(f'  {n}/{len(sources)}')
        time.sleep(0.3)
    MANIFEST.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'загружено: {n}, манифест: {MANIFEST}')


if __name__ == '__main__':
    main()
