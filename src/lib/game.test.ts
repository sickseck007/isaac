import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '../types';
import {
  createGame, createPlayer, newBoard, normalizeGame, randomIndex, randomSample,
  resetPlayer, toggleItem,
} from './game';

const items: Item[] = Array.from({ length: 120 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`,
  quality: 2,
  type: 'passive',
  icon: `/items/${index + 1}.png`,
}));

afterEach(() => vi.restoreAllMocks());

describe('random selection', () => {
  it('samples unique items without changing the original pool and caps the size', () => {
    const pool = [1, 1, 2, 3, 4, 4];
    const selection = randomSample(pool, 100);
    expect([...selection].sort()).toEqual([1, 2, 3, 4]);
    expect(pool).toEqual([1, 1, 2, 3, 4, 4]);
    expect(randomSample(pool, 2)).toHaveLength(2);
    expect(randomSample([], 30)).toEqual([]);
    expect(randomSample(pool, -1)).toEqual([]);
    expect(randomSample(pool, Number.NaN)).toEqual([]);
  });

  it('rejects the biased remainder of the uint32 range before choosing an index', () => {
    const random = vi.spyOn(crypto, 'getRandomValues')
      .mockReturnValueOnce(new Uint32Array([2 ** 32 - 1]))
      .mockReturnValueOnce(new Uint32Array([8]));
    expect(randomIndex(3)).toBe(2);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid pool lengths', () => {
    for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1]) {
      expect(() => randomIndex(size)).toThrow(RangeError);
    }
    expect(randomIndex(1)).toBe(0);
  });
});

describe('player state', () => {
  it('starts three independent players on a shared unique board', () => {
    const game = createGame(items);
    expect(game.players.map((player) => player.name)).toEqual(['Игрок 1', 'Игрок 2', 'Игрок 3']);
    expect(new Set(game.players.map((player) => player.id)).size).toBe(3);
    expect(game.activePlayerId).toBe(game.players[0].id);
    expect(game.boardIds).toHaveLength(30);
    expect(new Set(game.boardIds).size).toBe(30);
    expect(game.poolIds).toHaveLength(120);
    expect(game.columns).toBe(6);
    expect(game.showNames).toBe(true);
    expect(game.players[0].eliminated).not.toBe(game.players[1].eliminated);
    expect(createPlayer(7).name).toBe('Игрок 8');
    expect(createGame(items.slice(0, 4)).boardSize).toBe(4);
  });

  it('flips only the selected player’s cards and never mutates existing state', () => {
    const game = createGame(items);
    const [first, second] = game.players;
    const item = game.boardIds[0];
    const flipped = toggleItem(game, first.id, item);
    expect(flipped.players[0].eliminated).toEqual([item]);
    expect(flipped.players[1]).toBe(second);
    expect(game.players[0].eliminated).toEqual([]);
    expect(toggleItem(flipped, first.id, item).players[0].eliminated).toEqual([]);
    expect(toggleItem(game, first.id, 10000)).toBe(game);
    expect(toggleItem(game, 'missing-player', item)).toBe(game);
  });

  it('resets one player’s eliminated cards while keeping their secret and other players', () => {
    const game = createGame(items);
    game.players[0].eliminated = [game.boardIds[0]];
    game.players[0].secretItemId = 1;
    game.players[0].secretRevealed = true;
    game.players[1].eliminated = [game.boardIds[1]];
    const reset = resetPlayer(game, game.players[0].id);
    expect(reset.players[0].eliminated).toEqual([]);
    expect(reset.players[0].secretItemId).toBe(1);
    expect(reset.players[0].secretRevealed).toBe(true);
    expect(reset.players[1]).toBe(game.players[1]);
    expect(game.players[0].eliminated).toHaveLength(1);
    expect(resetPlayer(game, 'missing-player')).toBe(game);
  });

  it('builds a new round only from the selected pool and clears all player secrets', () => {
    const game = createGame(items);
    game.poolIds = [2, 4, 6, 8, 10, 12, 14, 16];
    game.boardSize = 6;
    for (const player of game.players) {
      player.eliminated = [game.boardIds[0]];
      player.secretItemId = 1;
      player.secretRevealed = true;
    }
    const next = newBoard(game);
    expect(next.boardIds).toHaveLength(6);
    expect(new Set(next.boardIds).size).toBe(6);
    expect(next.boardIds.every((id) => game.poolIds.includes(id))).toBe(true);
    for (const player of next.players) {
      expect(player.eliminated).toEqual([]);
      expect(player.secretItemId).toBeNull();
      expect(player.secretRevealed).toBe(false);
    }
    expect(next.players[0].eliminated).not.toBe(next.players[1].eliminated);
    expect(game.players[0].eliminated).toHaveLength(1);
    expect(game.players[0].secretItemId).toBe(1);
  });

  it('keeps the saved board size consistent when a new round uses a smaller pool', () => {
    const game = createGame(items);
    game.poolIds = [2, 4, 6, 6];
    const next = newBoard(game);
    expect(next.boardSize).toBe(3);
    expect(next.boardIds).toHaveLength(3);
    expect([...next.boardIds].sort()).toEqual([2, 4, 6]);
    expect(next.poolIds).toEqual([2, 4, 6]);
    expect(game.boardSize).toBe(30);
    expect(game.poolIds).toEqual([2, 4, 6, 6]);
  });
});

describe('saved game normalization', () => {
  it('restores a valid saved game without sharing mutable arrays or players', () => {
    const original = createGame(items);
    original.players[0].eliminated = [original.boardIds[0]];
    original.players[0].secretItemId = 10;
    original.players[0].secretRevealed = true;
    const restored = normalizeGame(original, items)!;
    expect(restored).toEqual(original);
    expect(restored).not.toBe(original);
    expect(restored.boardIds).not.toBe(original.boardIds);
    expect(restored.poolIds).not.toBe(original.poolIds);
    expect(restored.players[0]).not.toBe(original.players[0]);
    restored.players[0].eliminated.push(original.boardIds[1]);
    expect(original.players[0].eliminated).toHaveLength(1);
  });

  it('sanitizes unavailable and duplicate IDs, malformed preferences, and unsafe secrets', () => {
    const original = createGame(items);
    const saved = {
      ...original,
      activePlayerId: 'missing-player',
      poolIds: [1, 2, 3, 4, 5, 6, 7, 1, 9999, '2', null],
      boardIds: [1, 2, 3, 4, 5, 6, 1, 9999, -1, 2.5],
      boardSize: 999,
      columns: 1,
      showNames: 'yes',
      players: original.players.map((player, index) => ({
        ...player,
        name: index === 0 ? '    Очень длинное имя игрока больше лимита     ' : '',
        color: 'url(unsafe)',
        eliminated: [1, 1, 7, 9999, '2'],
        secretItemId: index === 0 ? 9999 : 7,
        secretRevealed: true,
      })),
    };
    const restored = normalizeGame(saved, items)!;
    expect(restored.poolIds).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(restored.boardIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(restored.boardSize).toBe(7);
    expect(restored.columns).toBe(4);
    expect(restored.showNames).toBe(true);
    expect(restored.activePlayerId).toBe(original.players[0].id);
    expect(restored.players[0].name).toHaveLength(24);
    expect(restored.players[1].name).toBe('Игрок 2');
    expect(restored.players[0].color).toMatch(/^#[\da-f]{6}$/i);
    expect(restored.players[0].eliminated).toEqual([1]);
    expect(restored.players[0].secretItemId).toBeNull();
    expect(restored.players[0].secretRevealed).toBe(false);
    expect(restored.players[1].secretItemId).toBe(7);
    expect(restored.players[1].secretRevealed).toBe(true);
  });

  it('supports small item sets, limits oversized boards, and clamps layout settings', () => {
    const original = createGame(items);
    const small = normalizeGame({ ...original, poolIds: [1, 2], boardIds: [1, 2], boardSize: -3 }, items)!;
    expect(small.boardSize).toBe(1);
    const large = normalizeGame({ ...original, boardIds: original.poolIds, boardSize: 120, columns: 90 }, items)!;
    expect(large.boardSize).toBe(120);
    expect(large.boardIds).toHaveLength(120);
    expect(large.columns).toBe(10);
    expect(normalizeGame({ ...original, boardSize: -3 }, items)!.boardSize).toBe(1);
    expect(normalizeGame({ ...original, boardSize: Number.NaN }, items)!.boardSize).toBe(30);
  });

  it('preserves intentionally small fields even when the selected pool is larger', () => {
    const original = createGame(items);
    const restored = normalizeGame({ ...original, boardIds: [1, 2, 3], boardSize: 3 }, items)!;
    expect(restored.boardSize).toBe(3);
    expect(restored.boardIds).toEqual([1, 2, 3]);
    expect(restored.poolIds).toHaveLength(120);
    expect(newBoard(restored).boardIds).toHaveLength(3);
  });

  it('rejects irrecoverable saves, duplicate player IDs, and unsupported versions', () => {
    const original = createGame(items);
    const invalid: unknown[] = [
      null, [], 'not a game', {}, { ...original, version: 2 },
      { ...original, players: [] }, { ...original, players: Array(9).fill(original.players[0]) },
      { ...original, players: [null] }, { ...original, players: [{ id: '' }] },
      { ...original, players: [original.players[0], original.players[0]] },
      { ...original, poolIds: [] }, { ...original, boardIds: [9999] },
    ];
    for (const saved of invalid) expect(normalizeGame(saved, items)).toBeNull();
  });
});
