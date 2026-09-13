// Генератор файлов импорта для Директ Коммандера из kampanii.mjs (магазин KOTELNIKOVARTIFACT на KIT).
// Формат: официальный XLSX-шаблон Директа direct_example.xlsx (единая перфоманс-кампания,
// комбинаторные объявления). Лист «Тексты»: шапка в строках 6–9, заголовок таблицы 10–11,
// данные с 12-й строки; листы «Регионы» и «Словарь значений полей» берутся из шаблона как есть.
// Запуск: node marketing/direct/build.mjs → marketing/direct/dist/<кампания>.xlsx + summary.md
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COUNTER, NEGATIVES_COMMON, NETWORK_ADS, REGION, SITE, campaigns } from './kampanii.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'dist')
const ref = join(here, 'ref')
const TEMPLATE = join(ref, 'direct_example.xlsx')
const TEMPLATE_URL = 'https://doc-static.yandex.net/src/support/direct/ru/files/direct_example.xlsx'
mkdirSync(out, { recursive: true })
mkdirSync(ref, { recursive: true })
if (!existsSync(TEMPLATE)) execFileSync('curl', ['-sL', '-o', TEMPLATE, TEMPLATE_URL])

// Колонки листа «Тексты» по шаблону. Пропущенные (ID, длины, видео, статусы) не заполняем.
const COLS = {
  extra: 'A', adType: 'B', groupName: 'D', groupNo: 'E', phrase: 'G',
  h: ['I', 'J', 'K', 'L', 'M', 'N', 'O'], t: ['P', 'Q', 'R'],
  link: 'AO', display: 'AP', region: 'AQ', bid: 'AS', bidNet: 'AT',
  slTitles: 'AW', slDescs: 'AX', slHrefs: 'AY', callouts: 'BE', groupNeg: 'BF', img: ['AC', 'AD', 'AE', 'AF', 'AG'],
}
const FIRST_DATA_ROW = 12
// Картинки объявления группы: до 5 ссылок из images/images.json (ключи вида `<group>-<a|b|c>-<1x1|4x3|16x9>`).
// Порядок: сначала три формата главного кадра группы, затем второй товар той же коллекции.
// Надписей на картинках нет: РСЯ рисует заголовок и текст сама и режет кадр до 30% по бокам,
// 40% снизу и 25% сверху (см. research-rsya-2026.md). Если манифеста нет, колонки пустые,
// картинки привязываются в Коммандере вручную из images/.
const IMAGES_MANIFEST = join(here, 'images', 'images.json')
const IMAGES = existsSync(IMAGES_MANIFEST) ? JSON.parse(readFileSync(IMAGES_MANIFEST, 'utf8')) : {}
const IMAGE_ORDER = ['a-1x1', 'a-4x3', 'a-16x9', 'b-1x1', 'b-16x9', 'b-4x3', 'c-1x1', 'c-16x9', 'c-4x3']
const IMAGE_ORDER_BY_GROUP = {}
const groupImages = (slug) => (IMAGE_ORDER_BY_GROUP[slug] ?? IMAGE_ORDER).map((k) => IMAGES[`${slug}-${k}`]?.url).filter(Boolean).slice(0, 5)
const AD_TYPE = 'Комбинаторное'
const LIMITS = { h: 56, word: 22, t: 81, display: 20, slTitle: 30, slDesc: 60, callout: 25, kwWords: 7, kwPerGroup: 200 }
const DISPLAY = { meteority: 'метеориты', amulety: 'амулеты', braslety: 'браслеты', podarki: 'подарки', chasy: 'часы-с-метеоритом' }

// РСЯ-зеркало поисковой кампании: те же группы и фразы, к объявлению группы добавляется
// объявление страницы из NETWORK_ADS (вопрос-боль для сетей). UTM-кампания с суффиксом -rsya,
// utm_term = площадка.
function networkMirror(c) {
  const netAd = NETWORK_ADS[c.id]
  return {
    ...c,
    id: `${c.id}-rsya`,
    base: c.id,
    name: c.name.replace(/^Поиск · /, 'РСЯ · '),
    kind: 'network',
    utm: { campaign: `${c.utm.campaign}-rsya` },
    groups: c.groups.map((g) => ({ ...g, ads: netAd ? [...g.ads, netAd] : g.ads })),
  }
}
const allCampaigns = campaigns.flatMap((c) => (c.kind === 'search' ? [c, networkMirror(c)] : [c]))

const errors = []
const check = (cond, msg) => { if (!cond) errors.push(msg) }
const noDash = (s, where) => check(!/—/.test(s), `длинное тире: ${where}: ${s}`)

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const strCell = (ref, v) => `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`
const numCell = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`

function utmLink(c, g) {
  const path = g.path ?? c.path
  const q = new URLSearchParams({ ...(g.query ?? c.query ?? {}), utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: c.utm.campaign, utm_content: g.slug })
  // {keyword} и {source} подставляет Директ, поэтому они вне URLSearchParams.
  const term = c.kind === 'network' ? '{source}' : '{keyword}'
  return `${SITE}${path}?${q.toString()}&utm_term=${term}`
}

function sitelinkHref(c, g, href) {
  const [p, anchor] = href.split('#')
  const q = new URLSearchParams({ ...(p === (g.path ?? c.path) ? g.query ?? c.query ?? {} : {}), utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: c.utm.campaign, utm_content: `${g.slug}-sitelink` })
  return `${SITE}${p}?${q.toString()}${anchor ? `#${anchor}` : ''}`
}

// Комбинаторное объявление группы: все заголовки и тексты из вариантов объявлений.
function combinatorial(g, where) {
  const headlines = []
  const texts = []
  for (const a of g.ads) { headlines.push(a.h1); texts.push(a.text) }
  for (const a of g.ads) if (a.h2) headlines.push(a.h2)
  check(headlines.length <= 7, `${where}: больше 7 заголовков`)
  check(texts.length <= 3, `${where}: больше 3 текстов`)
  for (const h of headlines) {
    check(h.length <= LIMITS.h, `${where}: заголовок ${h.length} > ${LIMITS.h}: ${h}`)
    check(!h.split(/\s+/).some((w) => w.length > LIMITS.word), `${where}: слово длиннее ${LIMITS.word}: ${h}`)
    noDash(h, where)
  }
  for (const t of texts) { check(t.length <= LIMITS.t, `${where}: текст ${t.length} > ${LIMITS.t}: ${t}`); noDash(t, where) }
  return { headlines, texts }
}

function dataRow(rowNo, { extra, group, groupNo, phrase, ad, link, display, bid, bidNet, sitelinks, callouts, negatives, images = [] }) {
  const cells = [
    strCell(`${COLS.extra}${rowNo}`, extra),
    strCell(`${COLS.adType}${rowNo}`, AD_TYPE),
    strCell(`${COLS.groupName}${rowNo}`, group),
    numCell(`${COLS.groupNo}${rowNo}`, groupNo),
    strCell(`${COLS.phrase}${rowNo}`, phrase),
    ...ad.headlines.map((h, i) => strCell(`${COLS.h[i]}${rowNo}`, h)),
    ...ad.texts.map((t, i) => strCell(`${COLS.t[i]}${rowNo}`, t)),
    strCell(`${COLS.link}${rowNo}`, link),
    strCell(`${COLS.display}${rowNo}`, display),
    strCell(`${COLS.region}${rowNo}`, REGION),
    numCell(`${COLS.bid}${rowNo}`, bid),
    numCell(`${COLS.bidNet}${rowNo}`, bidNet),
    strCell(`${COLS.slTitles}${rowNo}`, sitelinks.map((s) => s.title).join('||')),
    strCell(`${COLS.slDescs}${rowNo}`, sitelinks.map((s) => s.desc).join('||')),
    strCell(`${COLS.slHrefs}${rowNo}`, sitelinks.map((s) => s.href).join('||')),
    strCell(`${COLS.callouts}${rowNo}`, callouts.join('||')),
    strCell(`${COLS.groupNeg}${rowNo}`, negatives.join(', ')),
    ...images.map((u, i) => strCell(`${COLS.img[i]}${rowNo}`, u)),
  ]
  return `<row r="${rowNo}" spans="1:59">${cells.join('')}</row>`
}

// Лист «Тексты» из шаблона: строки 6–11 сохраняем (стили, объединения), меняем три ячейки шапки
// и заменяем данные. Формулы длин и calcChain убираем, они только для примера.
function buildSheet(templateXml, { title, negativesCampaign, rows }) {
  const start = templateXml.indexOf('<sheetData>') + '<sheetData>'.length
  const end = templateXml.indexOf('</sheetData>')
  const head = templateXml.slice(0, start)
  const tail = templateXml.slice(end)
  const body = templateXml.slice(start, end)
  const headerRows = [...body.matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)]
    .filter((m) => Number(m[1]) < FIRST_DATA_ROW)
    .map((m) => m[0])
    .map((row) => row
      .replace(/<c r="A6"[^>]*>[\s\S]*?<\/c>/, strCell('A6', title))
      .replace(/<c r="E8"[^>]*>[\s\S]*?<\/c>/, '')
      .replace(/<c r="E9"[^>]*>[\s\S]*?<\/c>/, strCell('E9', negativesCampaign.join(', '))))
  const lastRow = FIRST_DATA_ROW + rows.length - 1
  return (head + headerRows.join('') + rows.join('') + tail).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A6:BG${lastRow}"/>`)
}

function writeXlsx(file, sheetXml) {
  const tmp = mkdtempSync(join(tmpdir(), 'direct-xlsx-'))
  execFileSync('unzip', ['-oq', TEMPLATE, '-d', tmp])
  writeFileSync(join(tmp, 'xl/worksheets/sheet1.xml'), sheetXml, 'utf8')
  rmSync(join(tmp, 'xl/calcChain.xml'), { force: true })
  const ct = join(tmp, '[Content_Types].xml')
  writeFileSync(ct, readFileSync(ct, 'utf8').replace(/<Override[^>]*calcChain[^>]*\/>/, ''))
  const rels = join(tmp, 'xl/_rels/workbook.xml.rels')
  writeFileSync(rels, readFileSync(rels, 'utf8').replace(/<Relationship[^>]*calcChain[^>]*\/>/, ''))
  rmSync(file, { force: true })
  execFileSync('zip', ['-X', '-r', '-q', file, '[Content_Types].xml', '_rels', 'docProps', 'xl'], { cwd: tmp })
  rmSync(tmp, { recursive: true, force: true })
}

const templateSheet = (() => {
  const tmp = mkdtempSync(join(tmpdir(), 'direct-tpl-'))
  execFileSync('unzip', ['-oq', TEMPLATE, 'xl/worksheets/sheet1.xml', '-d', tmp])
  const s = readFileSync(join(tmp, 'xl/worksheets/sheet1.xml'), 'utf8')
  rmSync(tmp, { recursive: true, force: true })
  return s
})()

const summary = []
let groupNo = 0
for (const c of allCampaigns) {
  const display = DISPLAY[c.base ?? c.id] ?? DISPLAY[c.path?.slice(1)] ?? ''
  const campaignNegatives = [...new Set([...NEGATIVES_COMMON, ...(c.negatives ?? [])])]
  const bid = c.kind === 'network' ? 10 : 30
  const bidNet = 10
  const rows = []
  let kws = 0

  for (const g of c.groups) {
    groupNo += 1
    const where = `${c.id}/${g.slug}`
    const ad = combinatorial(g, where)
    const disp = DISPLAY[g.slug] ?? display
    check(disp.length <= LIMITS.display, `${where}: отображаемая ссылка > ${LIMITS.display}`)
    const sitelinks = (g.sitelinks ?? c.sitelinks ?? []).map((s) => ({ ...s, href: sitelinkHref(c, g, s.href) }))
    const callouts = g.callouts ?? c.callouts ?? []
    check(sitelinks.length <= 8, `${where}: больше 8 быстрых ссылок`)
    for (const s of sitelinks) {
      check(s.title.length <= LIMITS.slTitle, `${where}: быстрая ссылка > ${LIMITS.slTitle}: ${s.title}`)
      check(s.desc.length <= LIMITS.slDesc, `${where}: описание быстрой ссылки > ${LIMITS.slDesc}: ${s.desc}`)
    }
    for (const co of callouts) check(co.length <= LIMITS.callout, `${where}: уточнение > ${LIMITS.callout}: ${co}`)
    check(g.keywords.length <= LIMITS.kwPerGroup, `${where}: больше 200 фраз`)
    // Минус-слова группы: только список группы; общий и кампанийный лежат в шапке кампании.
    const negatives = g.negatives ?? []
    for (const k of g.keywords) {
      check(k.split(/\s+/).length <= LIMITS.kwWords, `${where}: фраза длиннее 7 слов: ${k}`)
      const kwWords = k.toLowerCase().split(/\s+/)
      for (const n of [...campaignNegatives, ...negatives]) {
        const nw = n.toLowerCase().split(/\s+/)
        check(!nw.every((w) => kwWords.includes(w)), `${where}: минус-слово «${n}» гасит фразу «${k}»`)
      }
    }
    const link = utmLink(c, g)
    const images = groupImages(g.slug)
    // Все фразы главного объявления помечаются «-», как в шаблоне; «+» только для дополнительных объявлений.
    for (const phrase of [...g.keywords, '---autotargeting']) {
      rows.push(dataRow(FIRST_DATA_ROW + rows.length, { extra: '-', group: g.name, groupNo, phrase, ad, link, display: disp, bid, bidNet, sitelinks, callouts, negatives, images }))
    }
    kws += g.keywords.length
    summary.push({ campaign: c.name, group: g.name, kws: g.keywords.length, headlines: ad.headlines.length, texts: ad.texts.length, images: images.length, link })
  }

  if (!errors.length) {
    const sheet = buildSheet(templateSheet, { title: c.name, negativesCampaign: campaignNegatives, rows })
    writeXlsx(join(out, `${c.id}.xlsx`), sheet)
  }
  console.log(`${c.id}.xlsx: групп ${c.groups.length}, фраз ${kws}, строк ${rows.length}`)
}

if (errors.length) {
  console.error(`\nОшибки (${errors.length}):\n- ` + errors.join('\n- '))
  process.exit(1)
}

const md = [
  `# Сводка файлов импорта (счётчик Метрики ${COUNTER}, регион ${REGION})`,
  '',
  '| Кампания | Группа | Фраз | Заголовков | Текстов | Картинок | Ссылка |',
  '|---|---|---:|---:|---:|---:|---|',
  ...summary.map((s) => `| ${s.campaign} | ${s.group} | ${s.kws} | ${s.headlines} | ${s.texts} | ${s.images} | ${s.link} |`),
  '',
]
md.push('## Тексты объявлений по группам', '')
for (const c of allCampaigns) for (const g of c.groups) {
  md.push(`### ${g.name}`, '', `Посадочная: ${g.path ?? c.path}`, '', 'Заголовки:')
  for (const a of g.ads) md.push(`- ${a.h1}`)
  for (const a of g.ads) if (a.h2) md.push(`- ${a.h2}`)
  md.push('', 'Тексты:')
  for (const a of g.ads) md.push(`- ${a.text}`)
  md.push('', `Фразы (${g.keywords.length}): ${g.keywords.join(' · ')}`, '', `Минус-слова группы: ${(g.negatives ?? []).join(', ') || 'нет'}`, '')
}
const c0 = allCampaigns[0]
md.push('## Быстрые ссылки и уточнения', '', ...c0.sitelinks.map((s) => `- ${s.title}: ${s.desc} → ${s.href}`), '', `Уточнения: ${c0.callouts.join(' · ')}`, '', `Минус-слова кампании: ${[...new Set([...NEGATIVES_COMMON, ...(c0.negatives ?? [])])].join(', ')}`, '')
writeFileSync(join(out, 'summary.md'), md.join('\n'), 'utf8')
console.log(`summary.md: ${summary.length} групп`)
