import { readFileSync, writeFileSync } from 'node:fs';
import { load } from 'cheerio';

const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'));
const source = new Map(JSON.parse(readFileSync('public/data/dead-god-all.json', 'utf8')).map(record => [record.key, record]));
const clues = {};
for (const item of items) {
  const detail = JSON.parse(readFileSync(`public/data/descriptions/item-${item.id}.json`, 'utf8'));
  const section = detail.sections.find(section => section.title === 'Эффекты и подробности');
  const $ = load(section?.html ?? '', {}, false);
  $('a').replaceWith('другой предмет');
  $('img').remove();
  $('br').replaceWith(' ');
  const names = [item.name, item.nameRu].filter(Boolean);
  const mask = text => names.reduce((text, name) => text.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'), 'этот предмет'), text);
  let effects = $('p,li').map((_, element) => mask($(element).text().replace(/\s+/g, ' ').trim())).get().filter(Boolean);
  if (!effects.length && $.text().trim()) effects = [mask($.text().replace(/\s+/g, ' ').trim())];
  const fullText = $.text();
  const statPatterns = {
    'Урон': /(?:[+−-]\s*\d+(?:[.,]\d+)?\s+(?:плоский\s+)?урон|[xх×]\s*\d+(?:[.,]\d+)?\s+множитель\s+урона)/iu,
    'Слёзы': /(?:[+−-]\s*\d+(?:[.,]\d+)?\s+сл[ёе]зы|[xх×]\s*\d+(?:[.,]\d+)?\s+множитель\s+скорострельности)/iu,
    'Скорость': /[+−-]\s*\d+(?:[.,]\d+)?\s+скорость(?!\s+выстрел)/iu,
    'Дальность': /[+−-]\s*\d+(?:[.,]\d+)?\s+дальность/iu,
    'Скорость выстрела': /[+−-]\s*\d+(?:[.,]\d+)?\s+скорость\s+выстрел/iu,
    'Удача': /[+−-]\s*\d+(?:[.,]\d+)?\s+удач/iu,
    'Здоровье': /[+−-]\s*\d+(?:[.,]\d+)?\s+(?:(?:красн[а-яё]*|син[а-яё]*|ч[её]рн[а-яё]*|золот[а-яё]*|бел[а-яё]*|вечн[а-яё]*)\s+)?(?:HP|здоровь|сердц)/iu,
  };
  const record = source.get(`item-${item.id}`);
  const lostUnlock = record?.fields['data-opening-character']?.some(value => value.text === 'lost') ?? false;
  clues[item.id] = {
    effects: [...new Set(effects)].slice(0, 3).map(text => text.length > 500 ? `${text.slice(0, 497).trimEnd()}…` : text),
    initiallyAvailable: detail.sections.some(section => section.title === 'Как открыть' && section.html.includes('Открыт с начала')),
    stats: Object.entries(statPatterns).filter(([, pattern]) => pattern.test(fullText)).map(([label]) => label),
    lostUnlock,
    taintedLostPool: item.tags?.includes('Tainted Lost') ?? false,
    lostBirthrightPool: item.tags?.includes('The Lost’s Birthright') ?? false,
  };
}
writeFileSync('src/data/dleClues.json', JSON.stringify(clues, null, 2) + '\n');
console.log(`Prepared local clues for ${Object.keys(clues).length} collectibles.`);
