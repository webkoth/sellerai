// Перенесено из finstock (27.09.2026): packages/platforms/src/wb/cards-mapper.test.ts.
// Тесты фото (`imageUrl`) убраны вместе с самим полем — WbCatalogEntry
// синка его не несёт (см. cards-mapper.ts).
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { mapCards } from "./cards-mapper"
import type { WbCardsListResponse } from "./client"

// Фикстура снята с площадки 07.09.2026 инструментом finstock
// `npm run tools:snap-wb-cards` и обрезана до первых 10 карточек — сами
// карточки не редактировались. Тест на выдуманных данных ниже проверяет
// согласованность маппера со спецификацией, а не с площадкой.
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/cards-list-sample.json", import.meta.url), "utf8"),
) as WbCardsListResponse

/**
 * Точное число, а не «больше нуля»: у всех десяти карточек в фикстуре ровно
 * по одному размеру с одним штрихкодом. Маппер, потерявший или удвоивший
 * строки, при проверке «больше нуля» остался бы незамеченным.
 */
const FIXTURE_CARD_COUNT = 10

describe("mapCards на настоящем ответе", () => {
  const cards = mapCards(fixture.cards ?? [])

  it("на каждый штрихкод — одна карточка с артикулом, названием и предметом", () => {
    expect(cards).toHaveLength(FIXTURE_CARD_COUNT)
    for (const card of cards) {
      expect(card.barcode).toMatch(/^\d+$/)
      expect(card.vendorCode).not.toBe("")
      expect(card.title).not.toBe("")
      expect(card.subject).not.toBe("")
    }
  })

  it("штрихкоды не повторяются", () => {
    expect(new Set(cards.map((c) => c.barcode)).size).toBe(cards.length)
  })
})

describe("mapCards на придуманных данных — согласованность со спецификацией", () => {
  it("карточка без размеров или без skus не даёт строк; пустой title заменяется артикулом", () => {
    const cards = mapCards([
      { nmID: 1, vendorCode: "A", title: "", subjectName: "Кулоны", sizes: [{ skus: ["111"] }] },
      { nmID: 2, vendorCode: "B", title: "Б", subjectName: null, sizes: null },
    ])
    expect(cards).toEqual([
      { nmId: 1, barcode: "111", vendorCode: "A", title: "A", subject: "Кулоны" },
    ])
  })

  it("два размера по два штрихкода дают четыре строки; пробельные title и subjectName обработаны", () => {
    // Ни одного такого случая в фикстуре нет: у всех её карточек один размер
    // и непустые title/subjectName. Проверяется согласованность со
    // спецификацией, где всё это допустимо.
    const cards = mapCards([
      {
        nmID: 7,
        vendorCode: "vendor-7",
        title: "  ",
        subjectName: "  ",
        sizes: [{ skus: ["111", "222"] }, { skus: ["333", "   ", "444"] }],
      },
    ])

    expect(cards).toEqual(
      ["111", "222", "333", "444"].map((barcode) => ({
        nmId: 7,
        barcode,
        // Пробельный title сводится к пустому и заменяется артикулом.
        vendorCode: "vendor-7",
        title: "vendor-7",
        // Пробельный subjectName — это отсутствие предмета, а не предмет « ».
        subject: null,
      })),
    )
  })

  it("пустой артикул проходит наружу как есть — решение за вызывающей стороной, не за маппером", () => {
    const cards = mapCards([
      { nmID: 8, vendorCode: "  ", title: "Кулон", subjectName: "Кулоны", sizes: [{ skus: ["555"] }] },
    ])
    expect(cards).toEqual([
      { nmId: 8, barcode: "555", vendorCode: "", title: "Кулон", subject: "Кулоны" },
    ])
  })

  it("баркод с пробелами по краям обрезается в результате — иначе не совпадёт с баркодом в базе", () => {
    const cards = mapCards([
      { nmID: 9, vendorCode: "C", title: "Т", subjectName: "П", sizes: [{ skus: [" 123 "] }] },
    ])
    expect(cards).toEqual([{ nmId: 9, barcode: "123", vendorCode: "C", title: "Т", subject: "П" }])
  })
})
