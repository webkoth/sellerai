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

  it("chrtId размера есть у каждой строки — ключ записи остатка WB", () => {
    for (const card of cards) expect(typeof card.chrtId).toBe("number")
  })
})

describe("mapCards на придуманных данных — согласованность со спецификацией", () => {
  it("chrtId размера — в каждую строку его штрихкодов; размер без chrtID — строки без поля", () => {
    const cards = mapCards([
      { nmID: 5, vendorCode: "R", title: "Р", subjectName: "Кольца", sizes: [{ chrtID: 440206878, skus: ["1", "2"] }, { skus: ["3"] }] },
    ])
    expect(cards.map((c) => [c.barcode, c.chrtId])).toEqual([
      ["1", 440206878],
      ["2", 440206878],
      ["3", undefined],
    ])
  })

  it("chrtID не целое положительное (0, отрицательное, дробное) — строки без поля: ключ записи не выдумываем", () => {
    const cards = mapCards([
      {
        nmID: 6,
        vendorCode: "S",
        title: "С",
        subjectName: null,
        sizes: [{ chrtID: 0, skus: ["1"] }, { chrtID: -5, skus: ["2"] }, { chrtID: 1.5, skus: ["3"] }],
      },
    ])
    expect(cards.map((c) => "chrtId" in c)).toEqual([false, false, false])
  })

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
