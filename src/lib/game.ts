import type { GameState, Item, Player } from '../types';
import { DEFAULT_PREFERENCES, normalizePreferences } from './board';

export const PLAYER_COLORS = [
  '#c8f467', '#b89cff', '#ff9bc4', '#6fd7eb',
  '#ffb46a', '#ed8796', '#7fe0be', '#aebbe5',
];

const UINT32_RANGE = 2 ** 32;

/** Rejection sampling avoids modulo bias, including for non-power-of-two pools. */
export function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length < 1 || length > UINT32_RANGE) {
    throw new RangeError('The random pool must contain 1 to 2^32 entries.');
  }

  const limit = Math.floor(UINT32_RANGE / length) * length;
  let value: number;
  do {
    [value] = crypto.getRandomValues(new Uint32Array(1));
  } while (value >= limit);
  return value % length;
}

/** A partial Fisher–Yates shuffle gives a uniformly sampled, unique board. */
export function randomSample(ids: number[], size: number): number[] {
  const available = [...new Set(ids)];
  const count = Number.isFinite(size)
    ? Math.min(available.length, Math.max(0, Math.floor(size)))
    : 0;

  for (let index = 0; index < count; index += 1) {
    const selected = index + randomIndex(available.length - index);
    [available[index], available[selected]] = [available[selected], available[index]];
  }
  return available.slice(0, count);
}

export function balancedSample(ids: number[], size: number, items: Item[]): number[] {
  const qualities = new Map(items.map(i => [i.id, i.quality]));
  const unique = [...new Set(ids)];
  const count = Math.min(unique.length, Math.max(0, Math.floor(size)));
  const buckets = [0, 1, 2, 3, 4].map(q => randomSample(unique.filter(id => qualities.get(id) === q), count));
  const chosen: number[] = [];
  let cursor = randomIndex(5);
  while (chosen.length < count && buckets.some(bucket => bucket.length)) {
    const next = buckets[cursor % 5].pop();
    if (next !== undefined) chosen.push(next);
    cursor += 1;
  }
  if (chosen.length < count) chosen.push(...randomSample(unique.filter(id => !chosen.includes(id)), count - chosen.length));
  return randomSample(chosen, chosen.length);
}

export function createPlayer(index: number): Player {
  return {
    id: crypto.randomUUID(),
    name: `Игрок ${index + 1}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    eliminated: [],
    secretItemId: null,
    secretRevealed: false,
  };
}

function catalogueIds(items: Item[]): number[] {
  return [...new Set(items.map((item) => item.id).filter(isItemId))];
}

export function createGame(items: Item[]): GameState {
  const players = Array.from({ length: 3 }, (_, index) => createPlayer(index));
  const poolIds = catalogueIds(items);
  const boardSize = Math.min(30, poolIds.length);
  return {
    version: 1,
    players,
    activePlayerId: players[0].id,
    boardIds: randomSample(poolIds, boardSize),
    poolIds,
    boardSize,
    columns: 6,
    showNames: true,
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isItemId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validIds(value: unknown, available: Set<number>): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is number => isItemId(id) && available.has(id)))];
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(min, Math.min(max, number));
}

/** Restore only usable state; irrecoverable saves are replaced by the caller. */
export function normalizeGame(value: unknown, items: Item[]): GameState | null {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.players)) return null;
  if (value.players.length < 1 || value.players.length > 8) return null;

  const available = new Set(catalogueIds(items));
  const poolIds = validIds(value.poolIds, available);
  const boardIds = validIds(value.boardIds, available).slice(0, 1000);
  if (!poolIds.length || !boardIds.length) return null;

  const board = new Set(boardIds);
  const playerIds = new Set<string>();
  const players: Player[] = [];
  for (const [index, player] of value.players.entries()) {
    if (!isRecord(player) || typeof player.id !== 'string' || !player.id.trim()
      || player.id.length > 128 || /[\u0000-\u001f\u007f]/.test(player.id)
      || playerIds.has(player.id)) return null;
    playerIds.add(player.id);

    const name = typeof player.name === 'string'
      ? player.name.replace(/\s+/g, ' ').trim().slice(0, 24)
      : '';
    const secretItemId = isItemId(player.secretItemId) && available.has(player.secretItemId)
      ? player.secretItemId : null;

    players.push({
      id: player.id,
      name: name || `Игрок ${index + 1}`,
      color: typeof player.color === 'string' && /^#[\da-f]{6}$/i.test(player.color)
        ? player.color : PLAYER_COLORS[index],
      eliminated: validIds(player.eliminated, board),
      secretItemId,
      secretRevealed: secretItemId !== null && player.secretRevealed === true,
    });
  }

  const maxSize = Math.min(1000, poolIds.length);
  return {
    version: 1,
    players,
    activePlayerId: typeof value.activePlayerId === 'string' && playerIds.has(value.activePlayerId)
      ? value.activePlayerId : players[0].id,
    boardIds,
    poolIds,
    boardSize: clampInteger(value.boardSize, Math.min(30, maxSize), 1, maxSize),
    columns: clampInteger(value.columns, 6, 4, 10),
    showNames: typeof value.showNames === 'boolean' ? value.showNames : true,
    preferences: normalizePreferences(value.preferences),
  };
}

export function toggleItem(game: GameState, playerId: string, itemId: number): GameState {
  if (!game.boardIds.includes(itemId) || !game.players.some((player) => player.id === playerId)) return game;
  return {
    ...game,
    players: game.players.map((player) => player.id !== playerId ? player : {
      ...player,
      eliminated: player.eliminated.includes(itemId)
        ? player.eliminated.filter((id) => id !== itemId)
        : [...player.eliminated, itemId],
    }),
  };
}

export function resetPlayer(game: GameState, playerId: string): GameState {
  if (!game.players.some((player) => player.id === playerId)) return game;
  return {
    ...game,
    players: game.players.map((player) => player.id !== playerId ? player : { ...player, eliminated: [] }),
  };
}

export function newBoard(game: GameState, items: Item[] = []): GameState {
  const poolIds = [...new Set(game.poolIds.filter(isItemId))];
  const maxSize = Math.min(1000, poolIds.length);
  const boardSize = clampInteger(game.boardSize, Math.min(30, maxSize), Math.min(1, maxSize), maxSize);
  return {
    ...game,
    poolIds,
    boardSize,
    boardIds: game.preferences.sampling === 'balanced' ? balancedSample(poolIds, boardSize, items) : randomSample(poolIds, boardSize),
    players: game.players.map((player) => ({
      ...player,
      eliminated: [],
      secretItemId: null,
      secretRevealed: false,
    })),
  };
}
