import type { BoardPreferences, Item } from '../types';

export const DEFAULT_PREFERENCES: BoardPreferences = {
  sort: 'random', groupBy: 'none', nameLanguage: 'en', excludedStyle: 'flip',
  theme: 'basement', showQuality: true, showIds: false, iconGrid: true, sampling: 'random',
};

export const BOARD_THEMES = [
  { id: 'basement', name: 'Подвал', color: '#28282a' },
  { id: 'slate', name: 'Катакомбы', color: '#24313b' },
  { id: 'blue', name: 'Синие стены', color: '#3a4a68' },
  { id: 'purple', name: 'Планетарий', color: '#23222a' },
  { id: 'blood', name: 'Красная комната', color: '#4b1616' },
  { id: 'earth', name: 'Тёмная комната', color: '#2c211b' },
  { id: 'flesh', name: 'Мясная комната', color: '#432d28' },
] as const;

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

export function normalizePreferences(value: unknown): BoardPreferences {
  const p = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return {
    sort: choice(p.sort, ['random', 'id', 'name', 'quality'], 'random'),
    groupBy: choice(p.groupBy, ['none', 'type', 'quality', 'pool', 'collection', 'transformation', 'achievement'], 'none'),
    nameLanguage: choice(p.nameLanguage, ['en', 'ru'], 'en'),
    excludedStyle: choice(p.excludedStyle, ['flip', 'dim', 'hide'], 'flip'),
    theme: choice(p.theme, BOARD_THEMES.map(t => t.id), 'basement'),
    showQuality: typeof p.showQuality === 'boolean' ? p.showQuality : true,
    showIds: typeof p.showIds === 'boolean' ? p.showIds : false,
    iconGrid: typeof p.iconGrid === 'boolean' ? p.iconGrid : true,
    sampling: choice(p.sampling, ['random', 'balanced'], 'random'),
  };
}

export function itemLabel(item: Item, language: BoardPreferences['nameLanguage']) {
  return language === 'ru' ? item.nameRu || item.name : item.name;
}

export function sortBoard(items: Item[], preferences: BoardPreferences): Item[] {
  if (preferences.sort === 'random') return items;
  return [...items].sort((a, b) => {
    if (preferences.sort === 'id') return a.id - b.id;
    if (preferences.sort === 'quality') return b.quality - a.quality || a.id - b.id;
    return itemLabel(a, preferences.nameLanguage).localeCompare(itemLabel(b, preferences.nameLanguage), preferences.nameLanguage === 'ru' ? 'ru' : 'en');
  });
}

export function groupBoard(items: Item[], preferences: BoardPreferences): { title: string; items: Item[] }[] {
  const ordered = sortBoard(items, preferences);
  if (preferences.groupBy === 'none') return [{ title: '', items: ordered }];
  const groups = new Map<string, Item[]>();
  for (const item of ordered) {
    let key: string;
    switch (preferences.groupBy) {
      case 'type': key = { active: 'Активные', passive: 'Пассивные', familiar: 'Спутники' }[item.type]; break;
      case 'quality': key = `Качество ${item.quality}`; break;
      case 'pool': key = item.pools?.[0] || 'Без пула'; break;
      case 'collection': key = item.collections?.[0] || 'Без коллекции'; break;
      case 'transformation': key = item.transformations?.[0] || 'Без превращения'; break;
      case 'achievement': key = item.achievement || 'Без достижения'; break;
    }
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([title, group]) => ({ title, items: group }));
}

/** A compact, portable code transfers only the shared field, never player secrets. */
export function encodeBoard(ids: number[]): string {
  return `IGC1:${ids.map(id => id.toString(36)).join('.')}`;
}

export function decodeBoard(code: string, available: Set<number>): number[] | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith('IGC1:') || trimmed.length > 6000) return null;
  const pieces = trimmed.slice(5).split('.');
  if (!pieces.length || pieces.length > 1000 || pieces.some(p => !/^[0-9a-z]{1,4}$/i.test(p))) return null;
  const ids = pieces.map(p => parseInt(p, 36));
  if (ids.some(id => !available.has(id)) || new Set(ids).size !== ids.length) return null;
  return ids;
}
