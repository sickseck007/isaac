import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import items from '../data/items.json';
import reference from '../data/referenceIndex.json';

describe('imported Dead God catalogue', () => {
  it('covers every game item with a local icon, source description, and matching source quality', () => {
    expect(items).toHaveLength(718);
    for (const item of items) {
      const entry = reference.find(e => e.key === `item-${item.id}`)!;
      expect(entry, `Missing reference entry for ${item.id}`).toBeDefined();
      expect(entry.quality).toBe(item.quality);
      expect(existsSync(`public/${item.icon}`)).toBe(true);
      const description = JSON.parse(readFileSync(`public/data/descriptions/item-${item.id}.json`, 'utf8'));
      expect(description.sourceUrl).toBe('https://dead-god.ru/');
      expect(description.sections.length).toBeGreaterThan(0);
      expect(description.sections.some((section: { html: string }) => section.html.trim().length > 0)).toBe(true);
    }
  });

  it('keeps category identities distinct, including pill zero and item/trinket ID collisions', () => {
    expect(reference).toHaveLength(1185);
    expect(new Set(reference.map(e => e.key)).size).toBe(1185);
    expect(reference.some(e => e.key === 'pills-0')).toBe(true);
    expect(reference.some(e => e.key === 'item-1')).toBe(true);
    expect(reference.some(e => e.key === 'trinket-1')).toBe(true);
    for (const entry of reference) {
      expect(existsSync(`public/data/descriptions/${entry.key}.json`)).toBe(true);
      if ('icon' in entry) expect(existsSync(`public/${entry.icon}`)).toBe(true);
    }
  });

  it('retains real effects, synergies, unlocks, pools, and achievement information', () => {
    const read = (key: string) => JSON.parse(readFileSync(`public/data/descriptions/${key}.json`, 'utf8'));
    expect(read('item-1').sections[0].html).toContain('+0,7 Слёзы');
    expect(read('item-118').sections.some((s: { title: string }) => s.title === 'Синергии и взаимодействия')).toBe(true);
    expect(read('item-331').sections.some((s: { html: string }) => s.html.includes('Потерянного'))).toBe(true);
    expect(items.find(item => item.id === 331)?.pools).toContain('Angel Room');
    expect(items.find(item => item.id === 331)?.achievement).toBe('Достижение #156');
    const source = JSON.parse(readFileSync('public/data/dead-god-provenance.json', 'utf8'));
    expect(source.gameItemsMatched).toBe(718);
    expect(source.unresolvedReferences).toEqual([]);
  });

  it('labels every initially available collectible without mislabelling achievement unlocks', () => {
    const source: { key: string; category: string; fields: Record<string, { text: string }[]> }[] = JSON.parse(readFileSync('public/data/dead-god-all.json', 'utf8'));
    const bundled = JSON.parse(readFileSync('src/data/itemDetails.json', 'utf8'));
    let initiallyAvailable = 0;
    for (const record of source.filter(record => record.category === 'item')) {
      const text = (key: string) => (record.fields[key] ?? []).map(value => value.text.trim()).filter(Boolean).join(' ');
      const detail = JSON.parse(readFileSync(`public/data/descriptions/${record.key}.json`, 'utf8'));
      const opening = detail.sections.find((section: { title: string }) => section.title === 'Как открыть');
      const hasCondition = ['data-opening-achievment', 'data-opening-character', 'data-opening-ending', 'other-opening'].some(key => text(key) && text(key) !== 'none');
      if (hasCondition) {
        expect(opening?.html ?? '', record.key).not.toContain('Открыт с начала');
      } else if (!text('data-opening') || text('data-opening') === 'Открыто со старта') {
        expect(opening?.html, record.key).toBe('<p>Открыт с начала.</p>');
        initiallyAvailable++;
      }
      const id = record.key.slice('item-'.length);
      if (bundled[id]) expect(detail, record.key).toEqual(bundled[id]);
    }
    expect(initiallyAvailable).toBe(441);
  });
});
