import { describe, expect, it } from 'vitest';
import { decodeBoard, DEFAULT_PREFERENCES, encodeBoard, groupBoard, normalizePreferences, sortBoard } from './board';
import { balancedSample, createGame, normalizeGame } from './game';
import type { Item } from '../types';

const items: Item[] = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, name: `Item ${index + 1}`, nameRu: `Предмет ${index + 1}`, quality: (index % 5) as Item['quality'], type: index % 2 ? 'active' : 'passive', icon: `items/${index + 1}.png` }));

describe('portable fields', () => {
  it('restores IDs once in existing fields and preserves later explicit choices', () => {
    const game = createGame(items);
    game.players[0].eliminated = [game.boardIds[0]];
    game.players[1].secretItemId = items[0].id;
    game.preferences.showIds = false;
    const { preferencesVersion: _preferencesVersion, ...legacy } = game;
    const restored = normalizeGame(legacy, items)!;
    expect(restored.preferences.showIds).toBe(true);
    expect(restored.boardIds).toEqual(game.boardIds);
    expect(restored.players).toEqual(game.players);
    restored.preferences.showIds = false;
    expect(normalizeGame(restored, items)?.preferences.showIds).toBe(false);
    expect(createGame(items).preferences.showIds).toBe(true);
  });

  it('round-trips the precise order without sharing player state', () => {
    const board = [50, 1, 17, 9];
    expect(decodeBoard(encodeBoard(board), new Set(items.map(i => i.id)))).toEqual(board);
    for (const invalid of ['', 'foo', 'IGC1:', 'IGC1:1.1', 'IGC1:zzz', 'IGC1:1.<script>', 'IGC1:-1']) expect(decodeBoard(invalid, new Set(items.map(i => i.id)))).toBeNull();
  });

  it('preserves old saves by supplying missing display preferences', () => {
    const game = createGame(items);
    game.players[0].eliminated = [game.boardIds[0]];
    game.players[1].secretItemId = items[0].id;
    game.players[1].secretRevealed = false;
    const { preferences: _preferences, ...legacy } = game;
    expect(normalizeGame(legacy, items)?.preferences).toEqual(DEFAULT_PREFERENCES);
    const { boardView: _boardView, ...oldPreferences } = game.preferences;
    const restored = normalizeGame({ ...game, preferences: oldPreferences }, items)!;
    expect(restored.preferences.boardView).toBe('all');
    expect(restored.boardIds).toEqual(game.boardIds);
    expect(restored.players).toEqual(game.players);
    expect(normalizePreferences({ boardView: 'single' }).boardView).toBe('single');
    expect(normalizePreferences({ boardView: 'invalid' }).boardView).toBe('all');
    expect(normalizePreferences({ theme: 'url(unsafe)', sort: 'unknown', excludedStyle: 'hide', showIds: true })).toEqual({ ...DEFAULT_PREFERENCES, excludedStyle: 'hide', showIds: true });
  });
});

describe('balanced fields and display', () => {
  it('draws equal quality counts without repeats when all qualities are available', () => {
    const chosen = balancedSample(items.map(i => i.id), 25, items);
    expect(new Set(chosen).size).toBe(25);
    const byId = new Map(items.map(i => [i.id, i]));
    for (const quality of [0, 1, 2, 3, 4]) expect(chosen.filter(id => byId.get(id)?.quality === quality)).toHaveLength(5);
  });

  it('fills a restricted pool after sparse qualities run out', () => {
    const subset = items.filter(i => i.quality === 4 || i.id === 1);
    expect(balancedSample(subset.map(i => i.id), 100, items).sort((a, b) => a - b)).toEqual(subset.map(i => i.id));
  });

  it('sorts and groups without duplicating or mutating original cards', () => {
    const board = [items[4], items[1], items[0]];
    expect(sortBoard(board, { ...DEFAULT_PREFERENCES, sort: 'id' }).map(i => i.id)).toEqual([1, 2, 5]);
    expect(board.map(i => i.id)).toEqual([5, 2, 1]);
    const groups = groupBoard(board, { ...DEFAULT_PREFERENCES, groupBy: 'type', sort: 'quality' });
    expect(groups.flatMap(group => group.items).map(i => i.id).sort()).toEqual([1, 2, 5]);
    expect(groups.map(group => group.title)).toEqual(['Пассивные', 'Активные']);
  });
});
