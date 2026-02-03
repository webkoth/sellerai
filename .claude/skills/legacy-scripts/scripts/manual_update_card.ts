const WB_API_TOKEN = process.env.WB_API_TOKEN;
const WB_API_URL = 'https://content-api.wildberries.ru';

if (!WB_API_TOKEN) {
  console.error('Error: WB_API_TOKEN is not set');
  process.exit(1);
}

const updateData = {
  nmId: 267915412,
  vendorCode: "JW-NB-AGT-M-0018",
  title: "Метеорит железный Кампо Дель Сьело Аргентина коллекционный",
  description: `Погрузитесь в тайны космоса и древних культур с уникальным образцом метеорита Кампо-дель-Сьело. Этот небесный посланник не просто камень – это мост между земными цивилизациями и звездными мирами.
Ключевые особенности:
Возраст: около 4,5 миллиардов лет
Место падения: "Небесные Поля" Аргентины
Вес образца: 114,4 грамма, параметры: 17,8х18,6х31,9– идеальный размер для медитаций и ритуалов.
Состав: железо-никелевый сплав с редкими включениями.

Почему именно этот образец:
Вес в 114,4 граммов делает этот метеорит идеальным для персональных практик. Он достаточно большой, чтобы ощутить его энергию, и в то же время удобен для ношения с собой как талисмана.
Станьте обладателем частицы космоса и древней мудрости. Позвольте метеориту Кампо-дель-Сьело стать вашим проводником в мир тайных знаний и силы звезд. Прикоснитесь к вечности – закажите свой метеорит прямо сейчас!

Происхождение и космическая история:
Формирование: Метеорит Кампо-дель-Сьело образовался около 4,5 миллиардов лет назад, на заре формирования Солнечной системы.
Состав: Относится к железным метеоритам группы IAB, состоит преимущественно из железа с примесями никеля и других элементов.
Космическое путешествие: Миллиарды лет дрейфовал в космосе, вероятно, являясь частью крупного астероида.

Падение на Землю:
Примерно 4000-5000 лет назад (около 2000-3000 лет до н.э.).
Место падения: Район Гран-Чако в Аргентине, на границе провинций Чако и Сантьяго-дель-Эстеро.
Характер падения: Произошел метеоритный дождь, создавший не менее 26 кратеров на площади около 1000 кв. км.

Проводник Изобилия:
Древние культуры верили в способность Кампо-дель-Сьело привлекать материальное и духовное богатство, открывая каналы космического изобилия. 
Помните, что полное раскрытие мистических свойств метеорита Кампо-дель-Сьело требует искреннего намерения, уважительного отношения и регулярной практики. Этот небесный посланник может стать мощным инструментом для тех, кто готов к глубокому исследованию тайн космоса и собственной души.`
};

async function main() {
  console.log(`Fetching card ${updateData.nmId}...`);

  // 1. Get current card
  const getResponse = await fetch(`${WB_API_URL}/content/v2/get/cards/list`, {
    method: 'POST',
    headers: {
      'Authorization': WB_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      settings: {
        cursor: { limit: 1 },
        filter: {
          withPhoto: -1,
          nmID: [updateData.nmId]
        }
      }
    })
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to get card: ${await getResponse.text()}`);
  }

  const getData = await getResponse.json();
  const card = getData.cards?.[0];

  if (!card) {
    throw new Error('Card not found');
  }

  console.log(`Found card: ${card.title}`);

  // 2. Update card
  const payload = {
    nmID: card.nmID,
    vendorCode: updateData.vendorCode || card.vendorCode,
    brand: card.brand,
    title: updateData.title,
    description: updateData.description,
    dimensions: card.dimensions,
    characteristics: card.characteristics,
    sizes: card.sizes
  };

  console.log('Sending update...');
  
  const updateResponse = await fetch(`${WB_API_URL}/content/v2/cards/update`, {
    method: 'POST',
    headers: {
      'Authorization': WB_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([payload])
  });

  if (!updateResponse.ok) {
    // Check if it's a 204 (No Content) which might mean success but usually update returns something
    // But specific endpoint doc says: "Если запрос обработан успешно, в ответе вернётся 200 OK" or details
    const text = await updateResponse.text();
    // Sometimes API returns error in body even with 200, but here checking status first
    throw new Error(`Update failed: ${text}`);
  }

  const result = await updateResponse.json();
  console.log('Update result:', JSON.stringify(result, null, 2));
  console.log('✅ Card updated successfully!');
}

main().catch(console.error);
