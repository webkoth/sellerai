import * as fs from 'fs';

interface DictValue {
  id: number;
  value: string;
}

interface Dictionary {
  id: number;
  values: DictValue[];
}

const dict: Record<string, Dictionary> = JSON.parse(fs.readFileSync('./ozon-dictionaries.json', 'utf-8'));

console.log('🎯 ЛУЧШИЕ ЗНАЧЕНИЯ ДЛЯ МЕТЕОРИТНЫХ УКРАШЕНИЙ:\n');

// Материал
console.log('📦 Материал (5309):');
const materials = dict['Материал'].values;
for (const v of materials.slice(0, 30)) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Цвет
console.log('\n🎨 Цвет товара (10096):');
const colors = dict['Цвет товара'].values;
const relevantColors = colors.filter(v =>
  ['черный', 'серый', 'серебристый', 'коричневый', 'золотистый'].includes(v.value)
);
for (const v of relevantColors) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Вставка
console.log('\n💎 Вставка (5289):');
const inserts = dict['Вставка'].values;
for (const v of inserts.slice(0, 40)) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Тип вставки
console.log('\n💎 Тип вставки (5292):');
for (const v of dict['Тип вставки'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Модель браслета
console.log('\n⌚ Модель браслета (9925):');
for (const v of dict['Модель браслета'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Вид браслета
console.log('\n⌚ Вид браслета (23073):');
for (const v of dict['Вид браслета'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Вид замка
console.log('\n🔒 Вид замка (5308):');
for (const v of dict['Вид замка'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Покрытие
console.log('\n✨ Покрытие (11364):');
for (const v of dict['Покрытие'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Стиль украшения
console.log('\n🎭 Стиль украшения (10016):');
for (const v of dict['Стиль украшения'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Тематика
console.log('\n🏷️ Тематика (9917):');
for (const v of dict['Тематика'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Целевая аудитория
console.log('\n👥 Целевая аудитория (9390):');
for (const v of dict['Целевая аудитория'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Упаковка
console.log('\n📦 Упаковка (4386):');
const relevantPkg = dict['Упаковка'].values.filter(v =>
  v.value.includes('коробк') || v.value.includes('подароч') || v.value.includes('Без')
);
for (const v of relevantPkg) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Вид украшения
console.log('\n💍 Вид украшения (23326):');
for (const v of dict['Вид украшения'].values) {
  console.log(`   ${v.id}: ${v.value}`);
}

// Страна
console.log('\n🌍 Страна-изготовитель (4389):');
const russia = dict['Страна-изготовитель'].values.find(v => v.value === 'Россия');
if (russia) {
  console.log(`   ${russia.id}: ${russia.value}`);
}
