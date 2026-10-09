import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Dices, Eye, EyeOff, Info, RotateCcw, Search, Shuffle, Sparkles, Undo2 } from 'lucide-react';
import type { BoardPreferences, GameState, Item, Player } from '../types';
import { groupBoard, itemLabel } from '../lib/board';
import IsaacFace from './IsaacFace';
import './PlayerBoard.css';

const iconUrl = (item: Item) => `${import.meta.env.BASE_URL}${item.icon}`;
const matches = (item: Item, query: string) => `${item.name} ${item.nameRu ?? ''} ${item.id} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

function ItemCard({ item, eliminated, showName, preferences, onClick, onDetails }: { item: Item; eliminated: boolean; showName: boolean; preferences: BoardPreferences; onClick: () => void; onDetails: (item: Item) => void }) {
  return <div className={`item-card-wrap ${eliminated ? 'is-flipped' : ''}`}><button className={`item-card ${eliminated && preferences.excludedStyle === 'flip' ? 'is-flipped' : ''} ${eliminated && preferences.excludedStyle === 'dim' ? 'is-dimmed' : ''} ${showName ? '' : 'no-name'}`} onClick={onClick} aria-label={`${eliminated ? 'Вернуть' : 'Исключить'} ${item.name}`} aria-pressed={eliminated} title={`${item.name}${item.nameRu ? ` · ${item.nameRu}` : ''}`} data-item-id={item.id}>
    <span className="item-card-inner">
      <span className="item-card-front">{preferences.showQuality && <span className={`quality-corner quality-${item.quality}`} aria-label={`Качество ${item.quality}`}>{item.quality}<Sparkles size={9} /></span>}{preferences.showIds && <span className="item-id-label">#{item.id}</span>}<img src={iconUrl(item)} alt="" draggable="false" /><span className="item-name">{itemLabel(item, preferences.nameLanguage)}</span></span>
      <span className="item-card-back"><IsaacFace /><span>не он</span></span>
    </span>
  </button><button className="item-info-button" aria-label={`Описание ${item.name}`} title="Описание предмета" onClick={() => onDetails(item)}><Info size={14} /></button></div>;
}


type Props = {
  game: GameState;
  player: Player;
  items: Item[];
  query: string;
  compact: boolean;
  controls?: ReactNode;
  canUndo: boolean;
  onToggle: (itemId: number) => void;
  onReset: () => void;
  onUndo: () => void;
  onDetails: (item: Item) => void;
  onNew: () => void;
  onSecret: () => void;
  onClearSearch: () => void;
};

export default function PlayerBoard({ game, player, items, query, compact, controls, canUndo, onToggle, onReset, onUndo, onDetails, onNew, onSecret, onClearSearch }: Props) {
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const eliminated = new Set(player.eliminated);
  const visible = items.filter(item => matches(item, query) && (!(onlyRemaining || game.preferences.excludedStyle === 'hide') || !eliminated.has(item.id)));
  const groups = groupBoard(visible, game.preferences);
  const showAll = () => {
    if (game.preferences.excludedStyle === 'hide') onReset();
    setOnlyRemaining(false);
    onClearSearch();
  };

  return <section className="board-panel" data-theme={game.preferences.theme} data-icon-grid={game.preferences.iconGrid} data-compact={compact} aria-label={`Игровое поле ${player.name}`} style={{ '--player-color': player.color } as CSSProperties}>
    <div className="board-heading"><div><div className="eyebrow">{compact ? 'СВОЁ ПОЛЕ. СВОЯ ДОГАДКА.' : 'У КАЖДОГО СВОЯ ДОГАДКА'}</div><h2>Поле <span>{player.name}</span><span className="live-dot" /></h2></div>{compact ? <button className="icon-button board-secret-button" onClick={onSecret} aria-label={`Выбрать секрет для ${player.name}`} title={player.secretItemId ? 'Посмотреть свой секрет в рулетке' : 'Выбрать секрет в рулетке'}><Dices size={18} /></button> : <button className="button button-primary" onClick={onNew}><Shuffle size={16} /> Новое поле</button>}</div>
    {compact && <div className="board-secret-status">{player.secretItemId ? 'Секрет выбран' : 'Загадай предмет в рулетке'}<span>Нажми на кубик ↑</span></div>}
    {controls}
    <div className="board-status"><div><span className="remaining-count">{items.length - player.eliminated.length}</span><span> / {items.length} осталось</span><span className="status-separator" /><span className="eliminated-label">{player.eliminated.length} исключено</span></div><button className={`remaining-toggle ${onlyRemaining ? 'selected' : ''}`} aria-pressed={onlyRemaining} onClick={() => setOnlyRemaining(value => !value)}>{onlyRemaining ? <Eye size={14} /> : <EyeOff size={14} />} Только оставшиеся</button></div>
    {groups.map(group => <div className="board-group" key={group.title}>{group.title && <h3 className="board-group-heading">{group.title}<span>{group.items.length}</span></h3>}<div className="items-grid" style={{ '--columns': compact ? Math.min(game.columns, 5) : game.columns } as CSSProperties}>{group.items.map(item => <ItemCard key={item.id} item={item} eliminated={eliminated.has(item.id)} showName={game.showNames} preferences={game.preferences} onDetails={onDetails} onClick={() => onToggle(item.id)} />)}</div></div>)}
    {!visible.length && <div className="empty-state"><Search size={28} /><h3>{query ? 'Ничего не нашлось' : 'Все предметы исключены'}</h3><p>{query ? 'Проверь название или попробуй поиск по ID.' : 'Верни карточки повторным нажатием или сбрось поле.'}</p><button className="button button-secondary" onClick={showAll}>{game.preferences.excludedStyle === 'hide' ? 'Вернуть карточки' : 'Показать всё поле'}</button></div>}
    <div className="board-footer"><span><span className="click-symbol">↻</span> Нажми на карточку, чтобы исключить</span><div>{!compact && <button className="text-button muted" disabled={!canUndo} onClick={onUndo} title="Отменить последнее действие"><Undo2 size={15} /><span>Назад</span></button>}<button className="text-button muted" disabled={!player.eliminated.length} onClick={onReset}><RotateCcw size={14} /> Сбросить</button></div></div>
  </section>;
}
