import { useMemo, useState } from 'react';
import { Check, Copy, Dices, Grid2X2, Info, Search, Sparkles, X } from 'lucide-react';
import type { GameState, Item } from '../types';
import { decodeBoard, encodeBoard, itemLabel, sortBoard } from '../lib/board';
import { newBoard } from '../lib/game';
import Modal from './Modal';
import AppearanceSettings from './AppearanceSettings';
import './BoardBuilder.css';

type Props = { game: GameState; items: Item[]; onApply: (game: GameState) => void; onClose: () => void; onDetails: (item: Item) => void };

export default function BoardBuilder({ game, items, onApply, onClose, onDetails }: Props) {
  const [selected, setSelected] = useState(new Set(game.poolIds));
  const [query, setQuery] = useState('');
  const [qualities, setQualities] = useState(new Set([0, 1, 2, 3, 4]));
  const [type, setType] = useState('all');
  const [pool, setPool] = useState('all');
  const [tag, setTag] = useState('all');
  const [greed, setGreed] = useState(false);
  const [size, setSize] = useState(game.boardSize);
  const [preferences, setPreferences] = useState(game.preferences);
  const [advanced, setAdvanced] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState(false);
  const pools = useMemo(() => [...new Set(items.flatMap(i => (greed ? i.greedPools : i.pools) ?? []))].sort(), [items, greed]);
  const tags = useMemo(() => [...new Set(items.flatMap(i => i.tags ?? []))].sort(), [items]);
  const eligible = useMemo(() => items.filter(item =>
    qualities.has(item.quality) && (type === 'all' || item.type === type)
    && (!greed || Boolean(item.greedPools?.length))
    && (pool === 'all' || ((greed ? item.greedPools : item.pools) ?? []).includes(pool))
    && (tag === 'all' || item.tags?.includes(tag))), [items, qualities, type, pool, greed, tag]);
  const visible = useMemo(() => sortBoard(eligible.filter(item =>
    `${item.name} ${item.nameRu ?? ''} ${item.id} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), preferences), [eligible, query, preferences]);
  const effectiveIds = eligible.filter(item => selected.has(item.id)).map(item => item.id);
  const effectiveCount = effectiveIds.length;

  const toggle = (id: number) => setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const preset = (mode: 'mix' | 'quality4' | 'active' | 'familiars') => {
    const subset = items.filter(i => mode === 'mix' || (mode === 'quality4' && i.quality === 4) || (mode === 'active' && i.type === 'active') || (mode === 'familiars' && i.type === 'familiar'));
    setSelected(new Set(subset.map(i => i.id)));
    setSize(Math.min(mode === 'mix' ? 30 : 24, subset.length));
    setPreferences(p => ({ ...p, sampling: 'random', groupBy: 'none' }));
    setQuery(''); setQualities(new Set([0, 1, 2, 3, 4])); setType('all'); setPool('all'); setTag('all'); setGreed(false);
  };
  const create = () => onApply(newBoard({ ...game, poolIds: effectiveIds, boardSize: Math.min(Math.max(1, size), effectiveCount), preferences }, items));
  const importCode = () => {
    const ids = decodeBoard(code, new Set(items.map(i => i.id)));
    if (!ids) { setCodeError('Код не распознан: проверьте его целиком. Повторы и неизвестные предметы недопустимы.'); return; }
    const next = newBoard({ ...game, poolIds: ids, boardSize: ids.length, preferences }, items);
    onApply({ ...next, boardIds: ids });
  };
  const copy = async () => {
    const current = encodeBoard(game.boardIds);
    try { await navigator.clipboard.writeText(current); setCopied(true); } catch { setCode(current); }
  };

  return <Modal title="Соберите свой набор" onClose={onClose} wide>
    <p className="modal-description">Не просто случайные карточки. Выбери настроение игры, собери набор и сделай поле своим.</p>
    <div className="board-presets"><button onClick={() => preset('mix')}><Dices size={19} /><strong>Случайный микс</strong><span>Всего понемногу</span></button><button onClick={() => preset('quality4')}><Sparkles size={19} /><strong>Только легенды</strong><span>Предметы качества 4</span></button><button onClick={() => preset('active')}><span className="preset-glyph">⚡</span><strong>Нажми пробел</strong><span>Только активные</span></button><button onClick={() => preset('familiars')}><span className="preset-glyph">♟</span><strong>Маленькая армия</strong><span>Спутники и орбитали</span></button></div>
    <div className="catalogue-filters"><label className="search-field"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Название или ID предмета" aria-label="Поиск в каталоге" />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск в каталоге"><X size={15} /></button>}</label><select value={type} onChange={e => setType(e.target.value)} aria-label="Тип предметов"><option value="all">Любой тип</option><option value="passive">Пассивные</option><option value="active">Активные</option><option value="familiar">Спутники</option></select>{pools.length > 0 && <select aria-label="Пул предметов" value={pool} onChange={e => setPool(e.target.value)}><option value="all">Все пулы</option>{pools.map(p => <option value={p} key={p}>{p}</option>)}</select>}{tags.length > 0 && <select aria-label="Теги предметов" value={tag} onChange={e => setTag(e.target.value)}><option value="all">Все теги</option>{tags.map(t => <option key={t} value={t}>{t}</option>)}</select>}</div>
    <div className="quality-filter"><span>Качество</span><div>{[0, 1, 2, 3, 4].map(q => <button key={q} className={qualities.has(q) ? 'selected' : ''} aria-pressed={qualities.has(q)} aria-label={`Качество ${q}`} onClick={() => setQualities(prev => { const next = new Set(prev); if (next.has(q)) next.delete(q); else next.add(q); return next; })}>{q}</button>)}</div>{items.some(i => i.greedPools?.length) && <label className="checkbox-row"><input type="checkbox" checked={greed} onChange={e => { setGreed(e.target.checked); setPool('all'); }} /> Greed mode</label>}<button className="text-button muted" onClick={() => { setQuery(''); setType('all'); setPool('all'); setTag('all'); setGreed(false); setQualities(new Set([0, 1, 2, 3, 4])); }}>Сбросить фильтры</button></div>
    <div className="catalogue-selection"><span>Выбрано <strong>{effectiveCount}</strong> из {eligible.length} · найдено {visible.length}</span><div><button className="text-button" onClick={() => setSelected(prev => new Set([...prev, ...visible.map(i => i.id)]))}>Выбрать найденные</button><button className="text-button muted" onClick={() => setSelected(prev => new Set([...prev].filter(id => !visible.some(i => i.id === id))))}>Снять выбор</button></div></div>
    <div className={`catalogue-grid ${preferences.iconGrid ? '' : 'catalogue-list'}`}>{visible.map(item => <div key={item.id} className="catalogue-item-wrap"><button className={`catalogue-item ${selected.has(item.id) ? 'selected' : ''}`} onClick={() => toggle(item.id)} aria-pressed={selected.has(item.id)} aria-label={`${selected.has(item.id) ? 'Убрать' : 'Добавить'} ${item.name}`} title={item.nameRu ?? item.name}><span className="catalogue-check">{selected.has(item.id) && <Check size={11} />}</span><img src={`${import.meta.env.BASE_URL}${item.icon}`} alt="" loading="lazy" /><span>{itemLabel(item, preferences.nameLanguage)}</span><small>#{item.id} · Q{item.quality}</small></button><button className="item-info-button catalogue-info-button" aria-label={`Описание ${item.name}`} onClick={() => onDetails(item)}><Info size={12} /></button></div>)}{!visible.length && <div className="empty-state"><Search /><h3>Таких предметов не нашлось</h3><p>Попробуйте другое название или измените фильтры.</p></div>}</div>
    <div className="builder-options"><label>Предметов на поле<input type="number" aria-label="Размер создаваемого поля" min={1} max={Math.max(1, effectiveCount)} value={size} onChange={e => setSize(Number(e.target.value))} /></label><button className="text-button" disabled={!effectiveCount} onClick={() => setSize(effectiveCount)}>Весь выбранный набор</button><label className="checkbox-row"><input type="checkbox" checked={preferences.sampling === 'balanced'} onChange={e => setPreferences(p => ({ ...p, sampling: e.target.checked ? 'balanced' : 'random' }))} /><span>Баланс по качеству<small>Поровну разных качеств, пока предметы есть в наборе.</small></span></label></div>
    <button className="builder-advanced-toggle text-button" aria-expanded={advanced} onClick={() => setAdvanced(v => !v)}>{advanced ? '−' : '+'} Оформление и код поля</button>
    {advanced && <div className="builder-advanced"><AppearanceSettings items={items} preferences={preferences} onChange={setPreferences} /><div className="board-code"><div className="section-heading"><h3>То же поле у друга</h3><button className="text-button" onClick={copy}><Copy size={13} />{copied ? 'Скопировано' : 'Копировать текущий код'}</button></div><p>Передайте код — он восстановит точно такой же набор и порядок. Секреты и прогресс игроков в код не попадают.</p><div><input value={code} aria-label="Код поля" placeholder="IGC1:…" onChange={e => { setCode(e.target.value); setCodeError(''); }} /><button className="button button-secondary" disabled={!code.trim()} onClick={importCode}>Открыть поле</button></div>{codeError && <p className="builder-error" role="alert">{codeError}</p>}</div></div>}
    <div className="modal-actions catalogue-footer"><span className="form-note">На новом поле: {Math.min(Math.max(1, size), effectiveCount)} предметов. Прогресс игроков сбросится.</span><button className="button button-primary" disabled={!effectiveCount || !Number.isFinite(size) || size < 1} onClick={create}><Grid2X2 size={17} /> Создать поле</button></div>
  </Modal>;
}
