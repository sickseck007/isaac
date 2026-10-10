import type { Item } from '../types';
import { randomIndex } from './game';

export const DLE_STORAGE_KEY = 'isaac-guess-club:dle:v1';
export const DLE_MODES = ['classic', 'effects', 'icon', 'emoji'] as const;
export type DleMode = typeof DLE_MODES[number];
export type LostRule = 'tainted' | 'unlock' | 'birthright';
export type DleClue = {
  effects: string[];
  initiallyAvailable: boolean;
  stats: string[];
  lostUnlock: boolean;
  taintedLostPool: boolean;
  lostBirthrightPool: boolean;
};
export type ClueMap = Record<number, DleClue>;
export type EmojiMap = Record<number, string[]>;
export type DleRound = { targetId: number; guesses: number[]; revealed: boolean; hints: number; rotation: number };
export type DleStats = { solved: number; skipped: number; points: number };
export type DleState = {
  version: 1;
  mode: DleMode;
  rounds: Record<DleMode, DleRound>;
  stats: Record<DleMode, DleStats>;
  iconSettings: { grayscale: boolean; rotate: boolean };
  lostRule: LostRule;
};
export type Match = 'exact' | 'partial' | 'wrong';
export type Comparison = { key: string; label: string; value: string; match: Match; direction?: 'up' | 'down' };
export const TYPE_NAMES = { active: 'Активный', passive: 'Пассивный', familiar: 'Спутник' };

export function modePools(items: Item[], clues: ClueMap, emojis: EmojiMap): Record<DleMode, number[]> {
  const all = items.map(item => item.id);
  const seen = new Set<string>();
  const effects = items.filter(item => {
    const signature = clues[item.id]?.effects.join(' ').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    if (!signature || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).map(item => item.id);
  return { classic: all, icon: all, effects, emoji: all.filter(id => emojis[id]?.length >= 3) };
}

export function newDleRound(ids: number[], previous?: number): DleRound {
  const available = ids.filter(id => id !== previous);
  const pool = available.length ? available : ids;
  if (!pool.length) throw new Error('No items are available for this puzzle mode.');
  return { targetId: pool[randomIndex(pool.length)], guesses: [], revealed: false, hints: 0, rotation: (randomIndex(3) + 1) * 90 };
}

export function createDle(pools: Record<DleMode, number[]>): DleState {
  return {
    version: 1, mode: 'classic',
    rounds: Object.fromEntries(DLE_MODES.map(mode => [mode, newDleRound(pools[mode])])) as DleState['rounds'],
    stats: Object.fromEntries(DLE_MODES.map(mode => [mode, { solved: 0, skipped: 0, points: 0 }])) as DleState['stats'],
    iconSettings: { grayscale: true, rotate: true },
    lostRule: 'tainted',
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1_000_000_000) : 0;

export function normalizeDle(value: unknown, pools: Record<DleMode, number[]>): DleState {
  const fallback = createDle(pools);
  if (!isRecord(value) || value.version !== 1) return fallback;
  if (DLE_MODES.includes(value.mode as DleMode)) fallback.mode = value.mode as DleMode;
  if (['tainted', 'unlock', 'birthright'].includes(String(value.lostRule))) fallback.lostRule = value.lostRule as LostRule;
  for (const mode of DLE_MODES) {
    const round = isRecord(value.rounds) ? value.rounds[mode] : null;
    if (isRecord(round) && typeof round.targetId === 'number' && pools[mode].includes(round.targetId)) {
      const guesses = Array.isArray(round.guesses) ? [...new Set(round.guesses.filter((id): id is number => typeof id === 'number' && pools[mode].includes(id)))] : [];
      const winningIndex = guesses.indexOf(round.targetId);
      fallback.rounds[mode] = {
        targetId: round.targetId, guesses: winningIndex >= 0 ? guesses.slice(0, winningIndex + 1) : guesses,
        revealed: round.revealed === true, hints: Math.min(3, nonnegative(round.hints)),
        rotation: [90, 180, 270].includes(Number(round.rotation)) ? Number(round.rotation) : 90,
      };
    }
    const stats = isRecord(value.stats) ? value.stats[mode] : null;
    if (isRecord(stats)) fallback.stats[mode] = { solved: nonnegative(stats.solved), skipped: nonnegative(stats.skipped), points: nonnegative(stats.points) };
  }
  if (isRecord(value.iconSettings)) fallback.iconSettings = {
    grayscale: value.iconSettings.grayscale !== false, rotate: value.iconSettings.rotate !== false,
  };
  return fallback;
}

export const isSolved = (round: DleRound) => round.guesses.includes(round.targetId);
export const isFinished = (round: DleRound) => round.revealed || isSolved(round);
export const hintLevel = (round: DleRound) => Math.min(3, Math.floor(round.guesses.filter(id => id !== round.targetId).length / 2) + round.hints);
export const roundPoints = (round: DleRound) => Math.max(10, 100 - Math.max(0, round.guesses.filter(id => id !== round.targetId).length - 1) * 4 - round.hints * 10);
export const emojiVisibleCount = (round: DleRound, total: number) => isFinished(round) ? total : Math.min(total, 1 + round.guesses.length);

export function submitDleGuess(state: DleState, id: number, pools: Record<DleMode, number[]>): DleState {
  const round = state.rounds[state.mode];
  if (isFinished(round) || !pools[state.mode].includes(id) || round.guesses.includes(id)) return state;
  const next = { ...round, guesses: [...round.guesses, id] };
  const stats = state.stats[state.mode];
  return {
    ...state, rounds: { ...state.rounds, [state.mode]: next },
    stats: id === round.targetId ? { ...state.stats, [state.mode]: { ...stats, solved: stats.solved + 1, points: stats.points + roundPoints(next) } } : state.stats,
  };
}

export function revealDle(state: DleState): DleState {
  const round = state.rounds[state.mode];
  if (isFinished(round)) return state;
  const stats = state.stats[state.mode];
  return { ...state, rounds: { ...state.rounds, [state.mode]: { ...round, revealed: true } }, stats: { ...state.stats, [state.mode]: { ...stats, skipped: stats.skipped + 1 } } };
}

export function nextDle(state: DleState, pools: Record<DleMode, number[]>): DleState {
  const round = state.rounds[state.mode];
  const finished = !isFinished(round) && (round.guesses.length || round.hints) ? revealDle(state) : state;
  return { ...finished, rounds: { ...finished.rounds, [state.mode]: newDleRound(pools[state.mode], round.targetId) } };
}

export function compareSets(guess: string[], target: string[]): Match {
  const a = new Set(guess), b = new Set(target);
  if (a.size === b.size && [...a].every(value => b.has(value))) return 'exact';
  return [...a].some(value => b.has(value)) ? 'partial' : 'wrong';
}

export function compareItems(guess: Item, target: Item, clues: ClueMap, lostRule: LostRule): Comparison[] {
  const a = clues[guess.id], b = clues[target.id];
  const exact = (equal: boolean): Match => equal ? 'exact' : 'wrong';
  const set = (key: string, label: string, values: string[] = [], targetValues: string[] = []): Comparison => ({ key, label, value: values.join(', ') || 'Нет', match: compareSets(values, targetValues) });
  const lostField = { tainted: 'taintedLostPool', unlock: 'lostUnlock', birthright: 'lostBirthrightPool' } as const;
  const lostLabel = { tainted: 'Альт. Лост', unlock: 'Открывается за Лоста', birthright: 'Лост + Birthright' }[lostRule];
  return [
    { key: 'type', label: 'Тип', value: TYPE_NAMES[guess.type], match: exact(guess.type === target.type) },
    { key: 'quality', label: 'Качество', value: String(guess.quality), match: exact(guess.quality === target.quality), ...(guess.quality < target.quality ? { direction: 'up' as const } : guess.quality > target.quality ? { direction: 'down' as const } : {}) },
    set('collection', 'Добавлен в', guess.collections, target.collections),
    set('pools', 'Пулы', guess.pools, target.pools),
    set('transformation', 'Превращения', guess.transformations, target.transformations),
    { ...set('stats', 'Статы', a.stats, b.stats), value: a.stats.join(', ') || 'Не указаны' },
    { key: 'opening', label: 'Открытие', value: a.initiallyAvailable ? 'С начала' : 'Достижение', match: exact(a.initiallyAvailable === b.initiallyAvailable) },
    { key: 'lost', label: lostLabel, value: a[lostField[lostRule]] ? 'Да' : 'Нет', match: exact(a[lostField[lostRule]] === b[lostField[lostRule]]) },
  ];
}

export function searchDleItems(items: Item[], query: string, guesses: number[]): Item[] {
  const normalize = (text: string) => text.toLocaleLowerCase().normalize('NFKC').replaceAll('ё', 'е').trim();
  const needle = normalize(query);
  if (!needle) return [];
  const remaining = items.filter(item => !guesses.includes(item.id));
  const matches = remaining.filter(item => normalize(`${item.name} ${item.nameRu ?? ''} ${item.id}`).includes(needle));
  return matches.sort((a, b) => Number(normalize(b.name) === needle || normalize(b.nameRu ?? '') === needle || String(b.id) === needle) - Number(normalize(a.name) === needle || normalize(a.nameRu ?? '') === needle || String(a.id) === needle)).slice(0, 8);
}
