import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, CircleHelp, Eye, Image, Lightbulb, RotateCw, Search, Shuffle, Smile, Sparkles, Trophy, X } from 'lucide-react';
import type { Item } from '../types';
import clueData from '../data/dleClues.json';
import emojiData from '../data/emojiClues.json';
import { compareItems, createDle, DLE_MODES, DLE_STORAGE_KEY, emojiVisibleCount, hintLevel, isFinished, isSolved, modePools, nextDle, normalizeDle, revealDle, roundPoints, searchDleItems, submitDleGuess, TYPE_NAMES } from '../lib/dle';
import type { ClueMap, Comparison, DleState, EmojiMap, LostRule } from '../lib/dle';
import './IsaacDle.css';

const CLUES = clueData as ClueMap;
const EMOJIS = emojiData as EmojiMap;
const modes = {
  classic: { title: 'Классика', subtitle: 'Сравни характеристики', icon: Sparkles, intro: 'Назови предмет. Каждая попытка покажет, что совпало с загадкой.' },
  effects: { title: 'Эффект', subtitle: 'Узнай по описанию', icon: Lightbulb, intro: 'Только эффект предмета. Название, иконка и ссылки спрятаны.' },
  icon: { title: 'Иконка', subtitle: 'Посмотри под другим углом', icon: Image, intro: 'Знакомый спрайт — с непривычного ракурса. Узнаешь его?' },
  emoji: { title: 'Эмодзи', subtitle: 'Разгадай маленький ребус', icon: Smile, intro: 'Название и эффект предмета зашифрованы в эмодзи.' },
};
const lostLabels: Record<LostRule, string> = { tainted: 'Альт. Лост', unlock: 'Открывается за Лоста', birthright: 'Лост + Birthright' };
const iconUrl = (item: Item) => `${import.meta.env.BASE_URL}${item.icon}`;
const attemptWord = (count: number) => count % 100 >= 11 && count % 100 <= 14 ? 'попыток' : count % 10 === 1 ? 'попытку' : count % 10 >= 2 && count % 10 <= 4 ? 'попытки' : 'попыток';
const readState = (pools: ReturnType<typeof modePools>) => {
  try { const saved = localStorage.getItem(DLE_STORAGE_KEY); if (saved) return normalizeDle(JSON.parse(saved), pools); }
  catch { /* Play remains available without persistent browser storage. */ }
  return createDle(pools);
};

function MatchCell({ cell, index, flipping, onComplete }: { cell: Comparison; index: number; flipping: boolean; onComplete?: () => void }) {
  const label = { exact: 'Совпадает', partial: 'Частично совпадает', wrong: 'Не совпадает' }[cell.match];
  return <td role="cell" className={`dle-cell match-${cell.match}${flipping ? ' dle-flipping' : ''}`} style={{ '--flip-delay': `${index * 280}ms` } as CSSProperties} onAnimationEnd={event => { if (event.animationName === 'dle-flip' && event.target === event.currentTarget) onComplete?.(); }} data-label={cell.label} data-category={cell.key} data-match={cell.match} aria-label={`${cell.label}: ${cell.value}. ${label}${cell.direction === 'up' ? '. У загадки качество выше' : cell.direction === 'down' ? '. У загадки качество ниже' : ''}`}>
    <span>{cell.value}</span>
    <small>{cell.direction === 'up' ? <ArrowUp size={18} aria-label="Качество выше" /> : cell.direction === 'down' ? <ArrowDown size={18} aria-label="Качество ниже" /> : cell.match === 'exact' ? <Check size={13} /> : cell.match === 'partial' ? '≈' : <X size={12} />}</small>
  </td>;
}

function GuessSearch({ items, guesses, onGuess, busy = false }: { items: Item[]; guesses: number[]; onGuess: (id: number) => void; busy?: boolean }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchDleItems(items, query, guesses), [items, query, guesses]);
  const choose = (item: Item) => { if (busy) return; onGuess(item.id); setQuery(''); setActive(0); setOpen(false); input.current?.focus(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive(value => results.length ? (value + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0);
    }
    if (event.key === 'Enter' && results[active]) { event.preventDefault(); choose(results[active]); }
  };
  return <div className="dle-search" ref={root} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <div className="dle-search-input"><Search size={19} /><input ref={input} readOnly={busy} aria-disabled={busy} role="combobox" aria-label="Ваш ответ — предмет" aria-autocomplete="list" aria-expanded={open && !!query.trim()} aria-controls={listId} aria-activedescendant={open && results[active] ? `${listId}-${results[active].id}` : undefined} value={query} placeholder="Название на русском, английском или ID…" autoComplete="off" onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={keyDown} />{query && <button aria-label="Очистить ответ" onClick={() => { setQuery(''); input.current?.focus(); }}><X size={17} /></button>}<span>↵</span></div>
    {open && !!query.trim() && <div className="dle-search-results" id={listId} role="listbox" aria-label="Подходящие предметы">{results.map((item, index) => <button key={item.id} id={`${listId}-${item.id}`} role="option" aria-selected={index === active} aria-label={`Ответ: ${item.name}`} className={index === active ? 'selected' : ''} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><img src={iconUrl(item)} alt="" /><span><strong>{item.name}</strong><small>{item.nameRu ? `${item.nameRu} · ` : ''}#{item.id}</small></span><ChevronRight size={16} /></button>)}{!results.length && <p role="status">Нет совпадений. Уже названные предметы исключены из поиска.</p>}</div>}
  </div>;
}

export default function IsaacDle({ items, onDetails }: { items: Item[]; onDetails: (item: Item) => void }) {
  const pools = useMemo(() => modePools(items, CLUES, EMOJIS), [items]);
  const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const [state, setState] = useState<DleState>(() => readState(pools));
  const [storageFailed, setStorageFailed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flippingGuess, setFlippingGuess] = useState<number | null>(null);
  const mode = state.mode;
  const lostRule = state.lostRule;
  const round = state.rounds[mode];
  const target = itemMap.get(round.targetId)!;
  const level = hintLevel(round);
  const won = isSolved(round);
  const finished = isFinished(round);
  const meta = modes[mode];
  const Icon = meta.icon;
  const stats = state.stats[mode];
  const available = useMemo(() => items.filter(item => pools[mode].includes(item.id)), [items, pools, mode]);
  const comparisons = compareItems(target, target, CLUES, lostRule);
  const flipping = mode === 'classic' && flippingGuess !== null;
  const guess = (id: number) => {
    if (flipping || isFinished(round) || round.guesses.includes(id) || !pools[mode].includes(id)) return;
    if (mode === 'classic' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setFlippingGuess(id);
    setState(value => submitDleGuess(value, id, pools));
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finish = () => { if (media.matches) setFlippingGuess(null); };
    media.addEventListener('change', finish);
    return () => media.removeEventListener('change', finish);
  }, []);

  useEffect(() => { try { localStorage.setItem(DLE_STORAGE_KEY, JSON.stringify(state)); setStorageFailed(false); } catch { setStorageFailed(true); } }, [state]);

  return <section className="dle-page" aria-labelledby="dle-title">
    <div className="dle-heading"><div><div className="eyebrow">ISAACDLE · ЕЩЁ ОДНА ПОПЫТКА</div><h1 id="dle-title">Один предмет.<br /><span>Сколько догадок?</span></h1><p>Знаешь Айзека? Проверим. Четыре способа найти тот самый предмет.</p></div><div className="dle-heading-mark" aria-hidden="true"><span>?</span><Sparkles size={25} /></div></div>
    <div className="dle-modes" role="group" aria-label="Режим угадывания">{DLE_MODES.map(key => { const ModeIcon = modes[key].icon; return <button key={key} aria-pressed={mode === key} className={mode === key ? 'selected' : ''} onClick={() => { setFlippingGuess(null); setState(value => ({ ...value, mode: key })); }}><ModeIcon size={21} /><span><strong>{modes[key].title}</strong><small>{modes[key].subtitle}</small></span></button>; })}</div>
    <div className="dle-toolbar"><span><Icon size={17} /><strong>{meta.title}</strong><span className="dle-pool-count">{available.length} предметов</span></span><div><button className="text-button" aria-expanded={rulesOpen} onClick={() => setRulesOpen(value => !value)}><CircleHelp size={15} /> Как играть</button><button className="button button-secondary" disabled={flipping} onClick={() => setState(value => nextDle(value, pools))}><Shuffle size={15} /> Следующий предмет</button></div></div>
    {mode === 'classic' && <label className="dle-lost-rule">Колонка «Лост»<select aria-label="Что сравнивать для Лоста" value={lostRule} disabled={flipping} onChange={event => setState(value => ({ ...value, lostRule: event.target.value as LostRule }))}><option value="tainted">Выпадает Альтернативному Лосту</option><option value="unlock">Открывается за Лоста</option><option value="birthright">Допущен с Birthright обычного Лоста</option></select></label>}
    {rulesOpen && <div className="dle-rules"><p><strong>Вводи название и выбирай предмет из списка.</strong> Можно искать на русском, английском или по ID. Попытки и загадки не ограничены. У каждого режима свой раунд и счёт.</p><p>В классике зелёный означает точное совпадение, жёлтый — общие элементы в разных списках, красный — различие. Стрелка у качества показывает, выше или ниже качество загадки. Пустые списки совпадают: например, у обоих нет превращений либо не указаны числовые изменения статов.</p><p>Статы — числовые изменения, явно записанные в основном описании: урон, слёзы, скорость, дальность, скорость выстрела, удача и здоровье. Условие «{lostLabels[lostRule]}» берётся из справочника{lostRule === 'tainted' ? ' и означает, что предмет разрешён в пуле Альтернативного Лоста; это не гарантирует выпадение в каждом забеге' : lostRule === 'birthright' ? ' и означает, что предмет не отсекается Birthright обычного Лоста' : ' и учитывает открытия как за обычного, так и за Альтернативного Лоста'}.</p><p>В дополнительных режимах каждые две ошибки раскрывают подсказку. Можно открыть её раньше за 10 очков. Победа приносит до 100 очков, первая ошибка бесплатна, следующие уменьшают награду на 4. В режиме «Эффект» одинаковые описания объединены в одну загадку; в «Эмодзи» — 160 ручных ребусов. В начале виден один символ, каждая ошибка открывает следующий.</p></div>}
    {storageFailed && <p className="storage-warning" role="status">Не удалось сохранить этот раунд в браузере. Можно продолжать играть до закрытия страницы.</p>}
    <div className="dle-play-panel">
      <p className="dle-mode-intro">{meta.intro}</p>
      {mode === 'classic' ? !round.guesses.length && <div className="dle-classic-prompt"><span aria-hidden="true">?</span><div><strong>Предмет уже загадан</strong><p>Первая попытка даст первые зацепки.</p></div></div> : mode === 'effects' ? <div className="dle-effect-clue" aria-label="Описание загадки"><span className="eyebrow">ЧТО ДЕЛАЕТ ЭТОТ ПРЕДМЕТ?</span>{CLUES[target.id].effects.map((effect, index) => <p key={index}>{effect}</p>)}</div> : mode === 'icon' ? <>
        <div className="dle-icon-options" role="group" aria-label="Усложнения иконки"><label><input type="checkbox" checked={state.iconSettings.grayscale} onChange={event => setState(value => ({ ...value, iconSettings: { ...value.iconSettings, grayscale: event.target.checked } }))} /> Чёрно-белый вид</label><label><input type="checkbox" checked={state.iconSettings.rotate} onChange={event => setState(value => ({ ...value, iconSettings: { ...value.iconSettings, rotate: event.target.checked } }))} /><RotateCw size={14} /> Поворот</label></div>
        <div className="dle-mystery-icon" aria-label="Иконка загадки"><img src={iconUrl(target)} alt="Загаданный предмет" style={{ filter: `grayscale(${finished || !state.iconSettings.grayscale ? 0 : 1 - level / 3})`, transform: `rotate(${finished || !state.iconSettings.rotate ? 0 : round.rotation * (1 - level / 3)}deg)` }} /></div><p className="dle-clue-caption">{finished ? 'Вот как он выглядит на самом деле.' : level >= 3 ? 'Иконка раскрыта полностью. Осталось вспомнить название.' : 'После каждых двух ошибок возвращаются цвет и привычный ракурс.'}</p>
      </> : <div className="dle-emoji-clue" aria-label="Эмодзи загадки">{EMOJIS[target.id].map((emoji, index) => index < emojiVisibleCount(round, EMOJIS[target.id].length) ? <span key={index} className="dle-emoji-symbol">{emoji}</span> : <span key={index} className="dle-emoji-hidden" aria-label="Символ скрыт">?</span>)}<p>Собери название или эффект. Каждая ошибка открывает следующий символ.</p></div>}
      {mode !== 'classic' && !finished && <div className="dle-hints"><div><span className="dle-hint-pill">{level >= 1 ? `Тип: ${TYPE_NAMES[target.type]}` : 'Тип скрыт'}</span><span className="dle-hint-pill">{level >= 2 ? `Качество: ${target.quality}` : 'Качество скрыто'}</span><span className="dle-hint-pill">{level >= 3 ? `Название начинается с «${target.name.slice(0, 1)}»` : 'Первая буква скрыта'}</span></div><button className="text-button" disabled={level >= 3} onClick={() => setState(value => ({ ...value, rounds: { ...value.rounds, [value.mode]: { ...value.rounds[value.mode], hints: Math.min(3, value.rounds[value.mode].hints + 1) } } }))}><Lightbulb size={15} /> Открыть подсказку <small>−10 очков</small></button></div>}
      {finished && !flipping ? <div className={`dle-result ${won ? 'is-win' : ''}`} role="status"><img src={iconUrl(target)} alt="" /><div><span>{won ? `Угадано за ${round.guesses.length} ${attemptWord(round.guesses.length)} · +${roundPoints(round)} очков` : 'Ответ раскрыт · без очков'}</span><h2>{target.name}</h2><p>{target.nameRu ? `${target.nameRu} · ` : ''}#{target.id}</p></div><button className="text-button" onClick={() => onDetails(target)}><Eye size={16} /> Описание</button></div> : <GuessSearch key={`${mode}-${round.targetId}`} items={available} guesses={round.guesses} onGuess={guess} busy={flipping} />}
      {flipping && <p className="dle-reveal-status" role="status">Открываем сравнение…</p>}
      <div className="dle-round-meta"><span>Попыток: <strong>{round.guesses.length}</strong>{!finished && <> · За победу: <strong>{roundPoints(round)}</strong> очков</>}</span>{!finished && <button className="text-button" disabled={flipping} onClick={() => setState(revealDle)}><Eye size={14} /> Показать ответ</button>}{finished && !flipping && <button className="button button-primary" onClick={() => setState(value => nextDle(value, pools))}>Ещё загадка <ChevronRight size={16} /></button>}</div>
    </div>
    {mode === 'classic' && <>
      <div className="dle-legend"><span className="exact">✓ Совпадает</span><span className="partial">≈ Частично</span><span className="wrong">✕ Не совпадает</span><span>↑ ↓ Качество загадки</span></div>
      <div className="dle-table-scroll" tabIndex={0} role="region" aria-label="Сравнение попыток"><table className="dle-table" role="table"><caption className="sr-only">Сравнение названных предметов с загадкой. Новые попытки сверху.</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Предмет</th>{comparisons.map(cell => <th key={cell.key} scope="col" role="columnheader">{cell.label}</th>)}</tr></thead><tbody role="rowgroup">{[...round.guesses].reverse().map(id => { const item = itemMap.get(id)!; return <tr key={id} role="row" className={id === round.targetId ? 'dle-winning-row' : ''}><th scope="row" role="rowheader"><img src={iconUrl(item)} alt="" /><strong>{item.name}</strong><small>{item.nameRu ? `${item.nameRu} · ` : ''}#{item.id}</small></th>{compareItems(item, target, CLUES, lostRule).map((cell, index) => <MatchCell key={cell.key} cell={cell} index={index} flipping={flippingGuess === id} onComplete={index === comparisons.length - 1 ? () => setFlippingGuess(null) : undefined} />)}</tr>; })}</tbody></table>{!round.guesses.length && <p className="dle-empty-history">Здесь появятся сравнения после первой попытки.</p>}</div>
    </>}
    {mode !== 'classic' && !!round.guesses.length && <div className="dle-guess-history" aria-label="История ответов">{[...round.guesses].reverse().map(id => { const item = itemMap.get(id)!; return <div key={id} className={id === round.targetId ? 'is-correct' : ''}><img src={iconUrl(item)} alt="" /><span>{item.name}</span>{id === round.targetId ? <Check size={15} aria-label="Верно" /> : <X size={15} aria-label="Неверно" />}</div>; })}</div>}
    <div className="dle-scoreboard"><Trophy size={21} /><div><strong>{stats.solved}</strong><span>побед в режиме</span></div><div><strong>{stats.points}</strong><span>очков</span></div><div><strong>{stats.skipped}</strong><span>пропущено</span></div><span className="dle-score-note">Случайные предметы · без дневного лимита<br />Раунды и счёт сохраняются в этом браузере</span></div>
  </section>;
}
