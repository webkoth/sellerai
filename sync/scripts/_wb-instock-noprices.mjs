/**
 * WB-наличие (FBS) БЕЗ ценового эндпоинта.
 * discounts-prices-api.wildberries.ru отвечает 429 с окном ~11 мин (X-Ratelimit-Limit: 1) и каждый
 * неудачный запрос продлевает штраф — для сверки остатков цены не нужны, поэтому берём только
 * карточки (content-api) и остатки FBS по баркодам (marketplace-api). finalPrice/price = 0.
 * Формат элементов совпадает с WbItem из sync/src/clients.ts.
 */
export async function listWbInStockNoPrices({ minQuantity = 1, log = console.log } = {}) {
  const H = { Authorization: process.env.WB_API_TOKEN, 'Content-Type': 'application/json' };
  const j = async (url, init) => {
    const r = await fetch(url, { ...init, headers: H });
    if (!r.ok) throw new Error(`WB ${r.status} ${url}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const cards = [];
  let cursor = { limit: 100 };
  for (;;) {
    const res = await j('https://content-api.wildberries.ru/content/v2/get/cards/list', {
      method: 'POST', body: JSON.stringify({ settings: { cursor, filter: { withPhoto: 1 } } }),
    });
    const page = res.cards || [];
    if (!page.length) break;
    cards.push(...page);
    if ((res.cursor?.total || 0) < 100) break;
    cursor = { limit: 100, updatedAt: res.cursor?.updatedAt, nmID: res.cursor?.nmID };
  }
  const bcToCard = new Map();
  for (const c of cards) for (const s of c.sizes || []) for (const bc of s.skus || []) bcToCard.set(bc, c);
  const whs = await j('https://marketplace-api.wildberries.ru/api/v3/warehouses');
  const stock = new Map();
  const bcs = [...bcToCard.keys()];
  for (const w of whs || []) {
    for (let i = 0; i < bcs.length; i += 1000) {
      const res = await j(`https://marketplace-api.wildberries.ru/api/v3/stocks/${w.id}`, { method: 'POST', body: JSON.stringify({ skus: bcs.slice(i, i + 1000) }) });
      for (const s of res.stocks || []) stock.set(s.sku, (stock.get(s.sku) || 0) + s.amount);
    }
  }
  const out = [];
  for (const [bc, amount] of stock) {
    if (amount < minQuantity) continue;
    const c = bcToCard.get(bc);
    if (!c) continue;
    out.push({ barcode: String(bc), vendorCode: String(c.vendorCode), nmId: Number(c.nmID) || 0, stock: amount, category: c.subjectName, title: c.title, finalPrice: 0, price: 0, discount: 0 });
  }
  log(`WB: карточек ${cards.length}, баркодов ${bcToCard.size}, складов ${(whs || []).length}, в наличии ${out.length}`);
  return out;
}
