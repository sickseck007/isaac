import { describe, expect, it } from 'vitest';
import catalogue from '../data/items.json';
import clueData from '../data/dleClues.json';
import emojiData from '../data/emojiClues.json';
import type { Item } from '../types';
import type { ClueMap, EmojiMap } from './dle';
import { compareItems, compareSets, createDle, hintLevel, isFinished, modePools, nextDle, normalizeDle, revealDle, searchDleItems, submitDleGuess } from './dle';

const items = catalogue as Item[];
const clues = clueData as ClueMap;
const emojis = emojiData as EmojiMap;
const pools = modePools(items, clues, emojis);
const item = (id: number) => items.find(item => item.id === id)!;

describe('IsaacDle', () => {
  it('uses all 718 collectibles for classic and icon, distinct effect clues, and valid unique emoji rebuses', () => {
    expect(pools.classic).toHaveLength(718);
    expect(pools.icon).toEqual(pools.classic);
    expect(pools.effects.length).toBeGreaterThan(700);
    expect(new Set(pools.effects.map(id => clues[id].effects.join(' ').toLocaleLowerCase())).size).toBe(pools.effects.length);
    expect(pools.emoji).toHaveLength(160);
    expect(new Set(Object.values(emojis).map(emoji => emoji.join(''))).size).toBe(160);
    for (const [id, clue] of Object.entries(clues)) {
      const source = item(Number(id));
      expect(source).toBeDefined();
      expect(clue.effects.join(' ')).not.toMatch(/<a|#entry=|<img/);
      for (const name of [source.name, source.nameRu].filter((name): name is string => !!name)) {
        expect(clue.effects.join(' ').toLocaleLowerCase(), id).not.toContain(name.toLocaleLowerCase());
      }
    }
  });

  it('compares complete and overlapping lists, empty lists, and quality direction', () => {
    expect(compareSets(['Angel Room', 'Secret Room'], ['Secret Room', 'Angel Room'])).toBe('exact');
    expect(compareSets(['Angel Room'], ['Angel Room', 'Ultra Secret Room'])).toBe('partial');
    expect(compareSets([], [])).toBe('exact');
    expect(compareSets([], ['Guppy'])).toBe('wrong');
    expect(compareItems(item(1), item(182), clues, 'tainted').find(cell => cell.key === 'quality')).toMatchObject({ match: 'wrong', direction: 'up' });
    expect(compareItems(item(182), item(1), clues, 'tainted').find(cell => cell.key === 'quality')).toMatchObject({ direction: 'down' });
    expect(compareItems(item(331), item(182), clues, 'tainted').find(cell => cell.key === 'pools')?.match).toBe('partial');
    expect(compareItems(item(182), item(182), clues, 'tainted').every(cell => cell.match === 'exact')).toBe(true);
  });

  it('distinguishes numeric stat modifiers, Lost unlocks, Tainted Lost pools and Birthright pools', () => {
    expect(clues[1].stats).toEqual(['Слёзы']);
    expect(clues[72].stats).toEqual(['Слёзы', 'Здоровье']);
    expect(clues[78].stats).toEqual(['Здоровье']);
    expect(clues[182].stats).toEqual(['Урон', 'Слёзы', 'Скорость выстрела', 'Здоровье']);
    expect(clues[331].lostUnlock).toBe(true);
    expect(clues[1].lostUnlock).toBe(false);
    expect(clues[15].taintedLostPool).toBe(false);
    expect(clues[1].taintedLostPool).toBe(true);
    expect(clues[1].lostBirthrightPool).toBe(true);
    expect(compareItems(item(1), item(331), clues, 'unlock').find(cell => cell.key === 'lost')).toMatchObject({ value: 'Нет', match: 'wrong' });
    expect(compareItems(item(1), item(331), clues, 'tainted').find(cell => cell.key === 'lost')).toMatchObject({ value: 'Да', match: 'exact' });
    expect(clues[112].initiallyAvailable).toBe(false);
  });

  it('awards a win once, excludes repeats, reveals without points, and keeps modes independent', () => {
    const state = createDle(pools);
    state.rounds.classic.targetId = 182;
    const wrong = submitDleGuess(state, 1, pools);
    expect(submitDleGuess(wrong, 1, pools)).toBe(wrong);
    expect(submitDleGuess(wrong, -1, pools)).toBe(wrong);
    const win = submitDleGuess(wrong, 182, pools);
    expect(isFinished(win.rounds.classic)).toBe(true);
    expect(win.stats.classic).toEqual({ solved: 1, skipped: 0, points: 92 });
    expect(submitDleGuess(win, 182, pools)).toBe(win);
    expect(revealDle(win)).toBe(win);
    expect(win.rounds.icon).toEqual(state.rounds.icon);
    const skipped = revealDle(wrong);
    expect(skipped.stats.classic).toEqual({ solved: 0, skipped: 1, points: 0 });
    expect(revealDle(skipped)).toBe(skipped);
    const next = nextDle(win, pools);
    expect(next.rounds.classic.targetId).not.toBe(182);
    expect(next.rounds.classic.guesses).toEqual([]);
    expect(next.stats.classic).toEqual(win.stats.classic);
    expect(nextDle(wrong, pools).stats.classic.skipped).toBe(1);
  });

  it('reveals hints after two errors or manual hints and applies their score cost', () => {
    const state = createDle(pools);
    state.mode = 'icon';
    state.rounds.icon = { targetId: 105, guesses: [1, 2], revealed: false, hints: 1, rotation: 180 };
    expect(hintLevel(state.rounds.icon)).toBe(2);
    const win = submitDleGuess(state, 105, pools);
    expect(win.stats.icon.points).toBe(69);
    expect(hintLevel({ ...state.rounds.icon, guesses: [1, 2, 3, 4, 5, 6], hints: 3 })).toBe(3);
  });

  it('restores mode, progress and settings while repairing invalid saves safely', () => {
    const state = createDle(pools);
    state.mode = 'emoji';
    state.lostRule = 'birthright';
    state.rounds.emoji.targetId = 3;
    state.rounds.emoji.guesses = [1];
    state.iconSettings.rotate = false;
    expect(normalizeDle(JSON.parse(JSON.stringify(state)), pools)).toEqual(state);
    const damaged = normalizeDle({ ...state, rounds: { emoji: { targetId: 3, guesses: [1, 1, '2', -1, 3, 12], hints: -20, rotation: 999 } }, stats: { emoji: { solved: -1, skipped: 'x', points: Infinity } } }, pools);
    expect(damaged.rounds.emoji).toMatchObject({ targetId: 3, guesses: [1, 3], hints: 0, rotation: 90 });
    expect(damaged.stats.emoji).toEqual({ solved: 0, skipped: 0, points: 0 });
    expect(normalizeDle({ version: 99 }, pools).mode).toBe('classic');
  });

  it('searches Russian, English and IDs, prioritizes exact matches and excludes past guesses', () => {
    expect(searchDleItems(items, ' священное сердце ', [])[0].id).toBe(182);
    expect(searchDleItems(items, 'sacred heart', [])[0].id).toBe(182);
    expect(searchDleItems(items, '182', [])[0].id).toBe(182);
    expect(searchDleItems(items, 'sacred heart', [182])).toEqual([]);
    expect(searchDleItems(items, '   ', [])).toEqual([]);
    expect(searchDleItems(items, 'the', []).length).toBeLessThanOrEqual(8);
  });
});
