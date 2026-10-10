import { describe, expect, it } from 'vitest';
import catalogue from '../data/items.json';
import type { Item } from '../types';
import { matchesItemSearch, matchesSearch } from './search';
import { searchDleItems } from './dle';

const items = catalogue as Item[];
const knife = items.find(item => item.id === 114)!;

describe('item search in both languages', () => {
  it('accepts English apostrophe variants, omitted punctuation, case and whitespace', () => {
    for (const query of ["Mom's Knife", 'mom’s knife', 'MOMS KNIFE', 'momsknife', '  moms   knife  ', 'Мамин нож', 'мамин нож', '#114']) {
      expect(matchesItemSearch(knife, query), query).toBe(true);
      expect(searchDleItems(items, query, [])[0].id, query).toBe(114);
    }
  });

  it('handles hyphens and joined words, and prioritizes exact English answers and IDs', () => {
    for (const query of ['x-ray vision', 'X–Ray Vision', 'x ray vision', 'xrayvision']) expect(searchDleItems(items, query, [])[0].id, query).toBe(76);
    expect(searchDleItems(items, 'The D6', [])[0].id).toBe(105);
    expect(searchDleItems(items, '105', [])[0].id).toBe(105);
    expect(searchDleItems(items, 'sad onion', [])[0].id).toBe(1);
    expect(searchDleItems(items, 'mom’s knife', [114]).some(item => item.id === 114)).toBe(false);
  });

  it('keeps empty field filters open and does not turn punctuation-only guesses into every item', () => {
    expect(matchesItemSearch(knife, '   ')).toBe(true);
    expect(searchDleItems(items, '   ', [])).toEqual([]);
    expect(searchDleItems(items, "'", [])).toEqual([]);
    expect(matchesSearch('???', '???')).toBe(true);
    expect(matchesItemSearch(knife, 'Definitely not an Isaac item')).toBe(false);
  });
});
