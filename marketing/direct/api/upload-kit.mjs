// Загрузка РСЯ-кампании магазина KOTELNIKOVARTIFACT (KIT) в Директ через API v501 черновиком (без модерации).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const SRC = '/Users/minas/projects/sai_kotelnikovartifact/marketing/direct'
const { COUNTER, NEGATIVES_COMMON, NETWORK_ADS, SITE, campaigns } = await import(`${SRC}/kampanii.mjs`)
const cfg = JSON.parse(readFileSync('/Users/minas/projects/yandex/projects.json', 'utf8'))
const TOKEN = (Array.isArray(cfg) ? cfg : cfg.projects).find((p) => p.id === 'webkoth').token
const BASE = 'https://api.direct.yandex.com/json/v501'
const args = process.argv.slice(2)
const RUN = args.includes('--run')
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const LOG = new URL('./created-kit.json', import.meta.url).pathname
const created = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {}
const save = () => writeFileSync(LOG, JSON.stringify(created, null, 2))

const DISPLAY = { meteority: 'метеориты', amulety: 'амулеты', braslety: 'браслеты', podarki: 'подарки', chasy: 'часы-с-метеоритом' }
const WEEKLY = 9300 // README и решение 2026-09-06: 40 000 ₽ на 4 недели
const GOAL_CART = 604982732 // «Добавить в корзину»
const IMAGES = JSON.parse(readFileSync(`${SRC}/images/images.json`, 'utf8'))
const IMAGE_ORDER = ['a-1x1', 'a-4x3', 'a-16x9', 'b-1x1', 'b-16x9', 'b-4x3', 'c-1x1', 'c-16x9', 'c-4x3']
const SOLD_OUT = new Set((process.env.SOLD_OUT ?? '').split(',').filter(Boolean))
const groupImages = (slug) => IMAGE_ORDER.map((k) => IMAGES[`${slug}-${k}`]).filter((x) => x && !SOLD_OUT.has(x.kit_id)).slice(0, 5)
const TODAY = new Date().toISOString().slice(0, 10)

function mirror(c) { return { ...c, base: c.id } }
function utmLink(c, g) {
  const q = new URLSearchParams({ ...(g.query ?? c.query ?? {}), utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: c.utm.campaign, utm_content: g.slug })
  return `${SITE}${g.path ?? c.path}?${q.toString()}&utm_term={source}`
}
function sitelinkHref(c, g, href) {
  const [p, anchor] = href.split('#')
  const q = new URLSearchParams({ ...(p === (g.path ?? c.path) ? g.query ?? c.query ?? {} : {}), utm_source: 'yandex', utm_medium: 'cpc', utm_campaign: c.utm.campaign, utm_content: `${g.slug}-sitelink` })
  return `${SITE}${p}?${q.toString()}${anchor ? `#${anchor}` : ''}`
}
function combinatorial(g) {
  const titles = [], texts = []
  for (const a of g.ads) { titles.push(a.h1); texts.push(a.text) }
  for (const a of g.ads) if (a.h2) titles.push(a.h2)
  const u = (a) => [...new Set(a)]
  const T = u(titles), X = u(texts)
  if (T.length > 7 || X.length > 3) throw new Error(`${g.slug}: лимит заголовков/текстов`)
  return { titles: T, texts: X }
}
const schedule = [1, 2, 3, 4, 5, 6, 7].map((d) => [d, ...Array.from({ length: 24 }, (_, h) => (d <= 5 && h >= 8 && h < 20 ? 100 : 0))].join(','))

let unitsLast = ''
const V501 = new Set(['campaigns', 'adgroups', 'ads'])
async function api(service, method, params) {
  const base = V501.has(service) ? BASE : 'https://api.direct.yandex.com/json/v5'
  const r = await fetch(`${base}/${service}`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Accept-Language': 'ru', 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ method, params }) })
  unitsLast = r.headers.get('Units') ?? unitsLast
  const raw = await r.text()
  let d
  try { d = JSON.parse(raw) } catch { throw new Error(`${service}.${method}: HTTP ${r.status}, не JSON: ${raw.slice(0, 200)}`) }
  if (d.error) throw new Error(`${service}.${method}: ${d.error.error_code} ${d.error.error_string} ${d.error.error_detail ?? ''}`)
  return d.result
}
function ids(res, key = 'Id') {
  return res.AddResults.map((x, i) => {
    if (x.Errors?.length) throw new Error(`элемент ${i}: ${JSON.stringify(x.Errors)}`)
    if (x.Warnings?.length) console.log('   предупреждение:', JSON.stringify(x.Warnings))
    return x[key]
  })
}

const plan = campaigns.filter((c) => c.kind === 'network').map(mirror)
for (const c of plan) {
  const negatives = [...new Set([...NEGATIVES_COMMON, ...(c.negatives ?? [])])]
  const groups = c.groups.map((g) => ({ g, ad: combinatorial(g), href: utmLink(c, g),
    sitelinks: (g.sitelinks ?? c.sitelinks ?? []).map((s) => ({ Title: s.title, Description: s.desc, Href: sitelinkHref(c, g, s.href) })) }))
  const kw = groups.reduce((n, x) => n + x.g.keywords.length, 0)
  console.log(`\n== ${c.name}: групп ${groups.length}, фраз ${kw}, недельный бюджет ${WEEKLY} ₽, минус-слов ${negatives.length}`)
  for (const x of groups) console.log(`   ${x.g.name}: фраз ${x.g.keywords.length}, заголовков ${x.ad.titles.length}, текстов ${x.ad.texts.length}, быстрых ссылок ${x.sitelinks.length}, кадров ${groupImages(x.g.slug).length} (${[...new Set(groupImages(x.g.slug).map((i) => i.kit_id))].join(', ')})\n     ${x.href}`)
  if (!RUN) continue
  if (created[c.base]?.done) { console.log('   уже загружена, пропуск:', created[c.base].campaignId); continue }
  const rec = (created[c.base] ??= {})
  // 1. Изображения страницы
  rec.images ??= {}
  for (const x of groups) {
    if (rec.images[x.g.slug]) continue
    const imgs = groupImages(x.g.slug).map((i) => ({ Name: i.file.split('/').pop().replace(/\.jpg$/, ''), ImageData: readFileSync(`/Users/minas/projects/sai_kotelnikovartifact/${i.file}`).toString('base64') }))
    rec.images[x.g.slug] = ids(await api('adimages', 'add', { AdImages: imgs }), 'AdImageHash'); save(); console.log(`   кадры «${x.g.name}»:`, rec.images[x.g.slug].length)
  }
  // 2. Уточнения
  if (!rec.callouts) {
    rec.callouts = ids(await api('adextensions', 'add', { AdExtensions: (c.callouts ?? []).map((t) => ({ Callout: { CalloutText: t } })) })); save(); console.log('   уточнения:', rec.callouts.length)
  }
  // 3. Кампания
  if (!rec.campaignId) {
    rec.campaignId = ids(await api('campaigns', 'add', { Campaigns: [{
      Name: c.name, StartDate: TODAY,
      NegativeKeywords: { Items: negatives },
      UnifiedCampaign: {
        BiddingStrategy: { Search: { BiddingStrategyType: 'SERVING_OFF' }, Network: { BiddingStrategyType: 'WB_MAXIMUM_CONVERSION_RATE', WbMaximumConversionRate: { WeeklySpendLimit: WEEKLY * 1_000_000, GoalId: GOAL_CART } } },
        CounterIds: { Items: [COUNTER] },
        Settings: [{ Option: 'ADD_METRICA_TAG', Value: 'YES' }],
      },
    }] }))[0]; save(); console.log('   кампания:', rec.campaignId)
  }
  // 4. Группы, быстрые ссылки, объявления, фразы
  rec.groups ??= {}
  for (const x of groups) {
    const gr = (rec.groups[x.g.slug] ??= {})
    if (!gr.adGroupId) {
      gr.adGroupId = ids(await api('adgroups', 'add', { AdGroups: [{ Name: x.g.name, CampaignId: rec.campaignId, RegionIds: [225],
        ...(x.g.negatives?.length ? { NegativeKeywords: { Items: x.g.negatives } } : {}), UnifiedAdGroup: { OfferRetargeting: 'NO' } }] }))[0]; save()
    }
    if (!gr.sitelinkSetId && x.sitelinks.length) {
      gr.sitelinkSetId = ids(await api('sitelinks', 'add', { SitelinksSets: [{ Sitelinks: x.sitelinks }] }))[0]; save()
    }
    if (!gr.adId) {
      gr.adId = ids(await api('ads', 'add', { Ads: [{ AdGroupId: gr.adGroupId, ResponsiveAd: {
        Titles: x.ad.titles, Texts: x.ad.texts, Href: x.href, DisplayUrlPath: DISPLAY[c.base],
        ...(gr.sitelinkSetId ? { SitelinkSetId: gr.sitelinkSetId } : {}), AdExtensionIds: rec.callouts, AdImageHashes: rec.images[x.g.slug] } }] }))[0]; save()
    }
    if (!gr.keywords) {
      gr.keywords = ids(await api('keywords', 'add', { Keywords: [...x.g.keywords, '---autotargeting'].map((k) => ({ AdGroupId: gr.adGroupId, Keyword: k })) })).length; save()
    }
    console.log(`   группа «${x.g.name}»: группа ${gr.adGroupId}, объявление ${gr.adId}, фраз ${gr.keywords}`)
  }
  rec.done = true; save()
  console.log('   баллы API:', unitsLast)
}
