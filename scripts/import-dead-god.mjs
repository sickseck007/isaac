import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { load } from 'cheerio';
import { normalizeUnlockSections } from './lib/unlocks.mjs';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/import-dead-god.mjs <saved dead-god.ru HTML>');
const source = readFileSync(resolve(input));
const $ = load(source.toString('utf8'));
const catalogue = JSON.parse(readFileSync('src/data/items.json', 'utf8'));
const itemMap = new Map(catalogue.map(item => [item.id, item]));
const additionalIcons = new Map((existsSync('public/reference-icons/manifest.json') ? JSON.parse(readFileSync('public/reference-icons/manifest.json', 'utf8')) : []).map(entry => [entry.key, entry.icon]));
const categoryLabels = { item: 'Предметы', trinket: 'Брелоки', cards_and_runes: 'Карты и руны', pills: 'Пилюли', transformation: 'Превращения', pickup: 'Пикапы', environment: 'Окружение' };
const records = [];

$('.item-data').each((_, element) => {
  const node = $(element);
  const fields = {};
  node.children().each((_, child) => {
    for (const key of Object.keys(child.attribs ?? {})) {
      if (key.startsWith('data-') || ['character-type', 'other-opening', 'ignore-spritesheet', 'abyss-locust'].includes(key)) {
        (fields[key] ??= []).push({ text: $(child).text().trim(), html: $(child).html() ?? '' });
      }
    }
  });
  const text = key => fields[key]?.map(value => value.text).find(Boolean) || '';
  const json = key => { try { return JSON.parse(text(key)); } catch { return null; } };
  const type = json('data-type');
  const category = ['passive_item', 'active_item'].includes(type?.value) ? 'item' : type?.value;
  const id = Number(text('data-id'));
  if (!(category in categoryLabels) || !Number.isInteger(id) || !text('data-name')) throw new Error('Unrecognized source record; aborting to prevent an incomplete import.');
  records.push({ key: `${category}-${id}`, category, id, name: text('data-name'), nameRu: text('data-name-rus'), quality: text('data-quality') && Number.isInteger(Number(text('data-quality'))) ? Number(text('data-quality')) : null, fields, sourceIcon: text('data-icon'), sourceType: type, tags: json('data-tags') ?? [], pools: json('data-pools') ?? [], keywords: text('data-keywords') });
});
if (records.length < 1000 || new Set(records.map(record => record.key)).size !== records.length) throw new Error('Source coverage or unique-key check failed.');
const byKey = new Map(records.map(record => [record.key, record]));
const normalizeName = name => name.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const byName = new Map();
for (const record of records) for (const name of [record.name, record.nameRu]) if (name && !byName.has(normalizeName(name))) byName.set(normalizeName(name), record);
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const find = name => byName.get(normalizeName(name));
if (byKey.has('environment-7023')) byName.set(normalizeName('Sacrificial Room'), byKey.get('environment-7023'));
const byImage = new Map(records.filter(record => record.sourceIcon).map(record => [basename(record.sourceIcon), record]));
let missingIllustrations = 0;
let linkedReferences = 0;
const unresolvedReferences = new Set();

function link(record, label) {
  return `<a href="#entry=${encodeURIComponent(record.key)}">${escape(label || record.nameRu || record.name)}</a>`;
}
function cleanHtml(html) {
  const fragment = load(html, {}, false);
  fragment('script,style,iframe,form,input,button').remove();
  fragment('*').each((_, element) => {
    const node = fragment(element);
    const color = node.attr('data-color');
    for (const attribute of Object.keys(element.attribs ?? {})) {
      if (!['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'data-tooltip'].includes(attribute)) node.removeAttr(attribute);
    }
    if (color === '#00FF00') node.attr('class', 'stat-positive');
    if (color === '#FF0000') node.attr('class', 'stat-negative');
    const href = node.attr('href');
    if (href && !/^(https?:\/\/|#)/i.test(href)) node.removeAttr('href');
  });
  fragment('img').each((_, element) => {
    const node = fragment(element);
    const filename = basename(node.attr('src') ?? '');
    const knownId = /collectibles_(\d+)/.exec(filename)?.[1];
    const record = find(node.attr('data-tooltip') || '') || byImage.get(filename) || (knownId ? byKey.get(`item-${knownId}`) : null);
    if (record) {
      const item = record.category === 'item' ? itemMap.get(record.id) : null;
      node.replaceWith(item ? `<a href="#entry=${record.key}"><img src="${escape(item.icon)}" alt="${escape(record.nameRu || record.name)}" title="${escape(record.nameRu || record.name)}" /></a>` : link(record));
    } else {
      missingIllustrations += 1;
      const label = node.attr('alt') || node.attr('title') || node.attr('data-tooltip') || filename.replace(/\.[^.]+$/, '').replaceAll('-', ' ');
      node.replaceWith(`<span class="source-illustration">${escape(label || 'Иллюстрация')}</span>`);
    }
  });
  fragment('[data-tooltip]').removeAttr('data-tooltip');
  return fragment.html().replace(/item:\[([^\]]+)\]/g, (_, name) => {
    const record = find(name);
    if (record) { linkedReferences += 1; return link(record); }
    unresolvedReferences.add(name);
    return `<strong>${escape(name)}</strong>`;
  });
}

const fieldLabels = { 'data-opening-character': 'Персонаж для открытия', 'character-type': 'Версия персонажа', 'data-opening-ending': 'Цель для открытия', 'data-opening-achievment': 'ID достижения' };
const versions = new Set(['Rebirth', 'Afterbirth', 'Afterbirth+', 'Repentance']);
const transformations = new Set(records.filter(record => record.category === 'transformation').map(record => record.name));
const index = [];
const details = {};
const extraDetails = {};
mkdirSync('public/data/descriptions', { recursive: true });
for (const record of records) {
  const text = key => record.fields[key]?.map(value => value.text).find(Boolean) || '';
  const allHtml = key => [...new Set((record.fields[key] ?? []).filter(value => value.text || value.html.includes('<img')).map(value => value.html))].map(cleanHtml).join('\n');
  const pools = record.pools.filter(pool => !pool.value.startsWith('greed_')).map(pool => pool.label);
  const greedPools = record.pools.filter(pool => pool.value.startsWith('greed_')).map(pool => pool.label);
  const tags = record.tags.map(tag => tag.name);
  const collections = tags.filter(tag => versions.has(tag));
  const transformationTags = tags.filter(tag => transformations.has(tag));
  const metadata = [];
  if (pools.length) metadata.push({ label: 'Пулы', value: pools.join(', ') });
  if (greedPools.length) metadata.push({ label: 'Пулы Greed mode', value: greedPools.join(', ') });
  if (collections.length) metadata.push({ label: 'Коллекция', value: collections.join(', ') });
  if (transformationTags.length) metadata.push({ label: 'Превращения', value: transformationTags.join(', ') });
  if (tags.length) metadata.push({ label: 'Теги', value: tags.join(', ') });
  if (record.sourceType?.value === 'active_item') {
    let unit; let activeType;
    try { unit = JSON.parse(text('data-charges-measure')).label; } catch { /* source does not define units */ }
    try { activeType = JSON.parse(text('data-active-type')).label; } catch { /* absent */ }
    if (text('data-charges')) metadata.push({ label: 'Заряд', value: `${text('data-charges')}${unit ? ` · ${unit}` : ''}` });
    if (activeType) metadata.push({ label: 'Тип активного предмета', value: activeType });
  }
  for (const [key, label] of Object.entries(fieldLabels)) {
    const value = text(key);
    if (value && value !== 'none' && !(key === 'character-type' && text('data-opening-character') === 'none')) metadata.push({ label, value });
  }
  if (text('data-is-quest')) metadata.push({ label: 'Особый предмет', value: 'Квестовый' });
  const sections = [['data-description', 'Эффекты и подробности'], ['data-synergies', 'Синергии и взаимодействия'], ['data-bugs', 'Баги и особенности'], ['data-opening', 'Как открыть']].map(([key, title]) => ({ title, html: allHtml(key) })).filter(section => section.html.trim());
  normalizeUnlockSections(record, sections);
  if (!sections.length) sections.push({ title: 'Описание', html: '<p>В сохранённой версии справочника подробное описание отсутствует.</p>' });
  const description = { sourceUrl: 'https://dead-god.ru/', nameRu: record.nameRu, tagline: text('data-ingame-description-rus') || text('data-ingame-description'), taglineOriginal: text('data-ingame-description'), metadata, sections };
  writeFileSync(`public/data/descriptions/${record.key}.json`, JSON.stringify(description) + '\n');
  const item = record.category === 'item' ? itemMap.get(record.id) : null;
  if (item) {
    details[record.id] = description;
    item.nameRu = record.nameRu || item.nameRu;
    if (record.quality !== null && record.quality >= 0 && record.quality <= 4) item.quality = record.quality;
    item.pools = pools;
    item.greedPools = greedPools;
    item.tags = tags;
    item.collections = collections;
    item.transformations = transformationTags;
    item.achievement = text('data-opening-achievment') ? `Достижение #${text('data-opening-achievment')}` : undefined;
    item.keywords = record.keywords;
  } else extraDetails[record.key] = description;
  const icon = item?.icon || additionalIcons.get(record.key);
  index.push({ key: record.key, category: record.category, categoryLabel: categoryLabels[record.category], typeLabel: record.sourceType?.label || categoryLabels[record.category], id: record.id, name: record.name, nameRu: record.nameRu, quality: record.quality, ...(icon ? { icon } : {}), keywords: record.keywords });
}
const missing = catalogue.filter(item => !details[item.id]);
if (missing.length) throw new Error(`Missing game item descriptions: ${missing.map(item => item.id).join(', ')}`);
mkdirSync('public/data', { recursive: true });
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
write('src/data/items.json', catalogue);
write('src/data/itemDetails.json', details);
write('src/data/referenceIndex.json', index);
write('src/data/referenceExtras.json', extraDetails);
write('public/data/dead-god-all.json', records);
const counts = Object.fromEntries(Object.keys(categoryLabels).map(category => [category, records.filter(record => record.category === category).length]));
const settings = {
  pools: $('input[name="pool"]').map((_, element) => ({ value: $(element).attr('value'), label: $(`label[for="${$(element).attr('id')}"]`).text().trim() })).get(),
  tags: $('input[name="tag"]').map((_, element) => ({ value: $(element).attr('value'), label: $(`label[for="${$(element).attr('id')}"]`).attr('data-tooltip') || '' })).get(),
  controls: $('input[type="radio"],input[type="checkbox"]').map((_, element) => ({ name: $(element).attr('name') || '', value: $(element).attr('value') || '', id: $(element).attr('id') || '', label: $(`label[for="${$(element).attr('id')}"]`).text().trim() })).get(),
};
write('public/data/dead-god-settings.json', settings);
write('public/data/dead-god-provenance.json', { source: 'https://dead-god.ru/', inputFilename: basename(input), inputSha256: createHash('sha256').update(source).digest('hex'), importedAt: new Date().toISOString(), recordCount: records.length, counts, gameItemsMatched: Object.keys(details).length, linkedReferences, missingIllustrations, unresolvedReferences: [...unresolvedReferences].sort(), scope: 'All item-data entries and settings present in the user-provided homepage HTML. Separate pages and companion saved-resource files were not included in this upload.', sourceAuthorizedByUser: true });
console.log(JSON.stringify({ records: records.length, counts, gameDescriptions: Object.keys(details).length, extraDescriptions: Object.keys(extraDetails).length, linkedReferences, missingIllustrations, unresolvedReferences: unresolvedReferences.size }));
await import('./build-dle-clues.mjs');
