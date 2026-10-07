import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { ArrowRight, Check, ChevronRight, CircleHelp, Dices, Eye, EyeOff, Grid2X2, Heart, Info, BookOpen, Layers3, LockKeyhole, Minus, Plus, RotateCcw, Search, Settings2, Shuffle, SlidersHorizontal, Sparkles, Undo2, Users, X } from 'lucide-react';
import type { BoardPreferences, GameState, Item, Player, ReferenceEntry } from './types';
import catalogue from './data/items.json';
import { createGame, createPlayer, newBoard, normalizeGame, resetPlayer, toggleItem } from './lib/game';
import Modal from './components/Modal';
import Roulette from './components/Roulette';
import ItemDetails from './components/ItemDetails';
import BoardBuilder from './components/BoardBuilder';
import AppearanceSettings from './components/AppearanceSettings';
import { groupBoard, itemLabel } from './lib/board';
import Reference, { REFERENCE_ENTRIES } from './components/Reference';

const ITEMS = catalogue as Item[];
const ITEM_MAP = new Map(ITEMS.map(item => [item.id, item]));
const STORAGE_KEY = 'isaac-guess-club:v1';
const iconUrl = (item: Item) => `${import.meta.env.BASE_URL}${item.icon}`;
const matches = (item: Item, query: string) => `${item.name} ${item.nameRu ?? ''} ${item.id} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
function readGame() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeGame(JSON.parse(stored), ITEMS) ?? createGame(ITEMS);
  } catch { /* A fresh game remains available if browser storage is blocked. */ }
  return createGame(ITEMS);
}

function IsaacFace({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M14 32C14 17 21 8 32 8s18 9 18 24c0 14-7 23-18 23S14 46 14 32Z" fill="currentColor" /><ellipse cx="25" cy="29" rx="3.5" ry="5" fill="#242126"/><ellipse cx="40" cy="29" rx="3.5" ry="5" fill="#242126"/><path d="m25 35-4 12m19-12 4 12" stroke="#85b6c2" strokeWidth="5"/><path d="M28 43q4-5 9 0" stroke="#242126" strokeWidth="2.5" strokeLinecap="round"/></svg>;
}

function ItemCard({ item, eliminated, showName, preferences, onClick, onDetails }: { item: Item; eliminated: boolean; showName: boolean; preferences: BoardPreferences; onClick: () => void; onDetails: (item: Item) => void }) {
  return <div className={`item-card-wrap ${eliminated ? 'is-flipped' : ''}`}><button className={`item-card ${eliminated && preferences.excludedStyle === 'flip' ? 'is-flipped' : ''} ${eliminated && preferences.excludedStyle === 'dim' ? 'is-dimmed' : ''} ${showName ? '' : 'no-name'}`} onClick={onClick} aria-label={`${eliminated ? 'Вернуть' : 'Исключить'} ${item.name}`} aria-pressed={eliminated} title={`${item.name}${item.nameRu ? ` · ${item.nameRu}` : ''}`} data-item-id={item.id}>
    <span className="item-card-inner">
      <span className="item-card-front">{preferences.showQuality && <span className={`quality-corner quality-${item.quality}`} aria-label={`Качество ${item.quality}`}>{item.quality}<Sparkles size={9} /></span>}{preferences.showIds && <span className="item-id-label">#{item.id}</span>}<img src={iconUrl(item)} alt="" draggable="false" /><span className="item-name">{itemLabel(item, preferences.nameLanguage)}</span></span>
      <span className="item-card-back"><IsaacFace /><span>не он</span></span>
    </span>
  </button><button className="item-info-button" aria-label={`Описание ${item.name}`} title="Описание предмета" onClick={() => onDetails(item)}><Info size={14} /></button></div>;
}

function Settings({ game, onSave, onClose }: { game: GameState; onSave: (game: GameState) => void; onClose: () => void }) {
  const [players, setPlayers] = useState<Player[]>(game.players.map(p => ({ ...p })));
  const [size, setSize] = useState(game.boardSize);
  const [columns, setColumns] = useState(game.columns);
  const [showNames, setShowNames] = useState(game.showNames);
  const [preferences, setPreferences] = useState(game.preferences);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const next = { ...game, players: players.map((p, i) => ({ ...p, name: p.name.trim() || `Игрок ${i + 1}` })), boardSize: Math.max(1, Math.min(1000, size, game.poolIds.length)), columns, showNames, preferences, activePlayerId: players.some(p => p.id === game.activePlayerId) ? game.activePlayerId : players[0].id };
    onSave(next.boardSize !== game.boardSize ? newBoard(next, ITEMS) : next);
  };
  return <Modal title="Ваша игра, ваши правила" onClose={onClose}>
    <form onSubmit={save} className="settings-form">
      <div className="section-heading"><h3><Users size={17} /> Игроки</h3><span>{players.length} / 8</span></div>
      <div className="player-inputs">{players.map((player, i) => <div className="player-input" key={player.id}><span className="small-avatar" style={{ '--player-color': player.color } as CSSProperties}><IsaacFace /></span><input aria-label={`Имя игрока ${i + 1}`} value={player.name} maxLength={24} onChange={e => setPlayers(ps => ps.map(p => p.id === player.id ? { ...p, name: e.target.value } : p))} placeholder={`Игрок ${i + 1}`} /><button type="button" className="icon-button" disabled={players.length === 1} aria-label={`Удалить игрока ${i + 1}`} onClick={() => setPlayers(ps => ps.filter(p => p.id !== player.id))}><Minus size={17} /></button></div>)}</div>
      <button type="button" className="text-button" disabled={players.length >= 8} onClick={() => setPlayers(ps => [...ps, createPlayer(ps.length)])}><Plus size={16} /> Добавить игрока</button>
      <div className="form-divider" />
      <div className="section-heading"><h3><Grid2X2 size={17} /> Игровое поле</h3></div>
      <div className="settings-grid"><label>Предметов на поле<input type="number" aria-label="Предметов на поле" min={1} max={Math.min(1000, game.poolIds.length)} value={size} onChange={e => setSize(Number(e.target.value))} required /></label><label>Столбцов на компьютере<select aria-label="Столбцов на компьютере" value={columns} onChange={e => setColumns(Number(e.target.value))}>{[4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} столбцов</option>)}</select></label></div>
      <label className="checkbox-row"><input type="checkbox" checked={showNames} onChange={e => setShowNames(e.target.checked)} /><span>Показывать названия предметов</span></label>
      <AppearanceSettings preferences={preferences} onChange={setPreferences} items={ITEMS} />
      <p className="form-note">У всех игроков одинаковый набор, но свои исключённые карточки. Изменение размера создаст новое поле для всех.</p>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Отмена</button><button className="button button-primary" type="submit"><Check size={17} /> Сохранить</button></div>
    </form>
  </Modal>;
}

export default function App() {
  const [game, setGame] = useState<GameState>(readGame);
  const [page, setPage] = useState<'board' | 'roulette' | 'reference'>(() => window.location.hash === '#reference' ? 'reference' : window.location.hash === '#roulette' ? 'roulette' : 'board');
  const [modal, setModal] = useState<'settings' | 'catalogue' | 'help' | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [onlyRemaining, setOnlyRemaining] = useState(false);
  const [history, setHistory] = useState<GameState[]>([]);
  const [toast, setToast] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const [detailItem, setDetailItem] = useState<Item | ReferenceEntry | null>(null);
  const player = game.players.find(p => p.id === game.activePlayerId) ?? game.players[0];
  const boardItems = useMemo(() => game.boardIds.map(id => ITEM_MAP.get(id)).filter((i): i is Item => !!i), [game.boardIds]);
  const eliminated = new Set(player.eliminated);
  const visibleItems = boardItems.filter(item => matches(item, query) && (!(onlyRemaining || game.preferences.excludedStyle === 'hide') || !eliminated.has(item.id)));
  const boardGroups = groupBoard(visibleItems, game.preferences);
  const remaining = boardItems.length - player.eliminated.length;
  const featured = [118, 331, 182].map(id => ITEM_MAP.get(id)).filter((i): i is Item => !!i);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); setStorageFailed(false); } catch { setStorageFailed(true); } }, [game]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { const update = () => setPage(window.location.hash === '#reference' ? 'reference' : window.location.hash === '#roulette' ? 'roulette' : 'board'); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  const navigate = (next: 'board' | 'roulette' | 'reference') => { setPage(next); window.location.hash = next; };
  const record = (next: GameState) => { setHistory(h => [...h.slice(-19), game]); setGame(next); };
  const undo = () => { const previous = history.at(-1); if (previous) { setGame(previous); setHistory(h => h.slice(0, -1)); setToast('Последнее действие отменено'); } };
  const selectPlayer = (id: string) => { if (id !== game.activePlayerId) setHistory([]); setGame(g => ({ ...g, activePlayerId: id })); setQuery(''); };
  const updatePlayer = (update: Partial<Player>) => {
    // Old full-game undo snapshots must never overwrite a newly chosen or hidden secret.
    setHistory([]);
    setGame(g => ({ ...g, players: g.players.map(p => p.id === g.activePlayerId ? { ...p, ...update } : p) }));
  };

  return <>
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#board" aria-label="Isaac Guess Club — игровое поле"><span className="brand-icon"><IsaacFace /></span><span className="brand-type">ISAAC<span>GUESS CLUB<span className="brand-dot">✦</span></span></span></a>
      <nav className="main-nav" aria-label="Страницы игры"><button className={page === 'board' ? 'active' : ''} onClick={() => navigate('board')} aria-current={page === 'board' ? 'page' : undefined}><Grid2X2 size={17} /> Игровое поле</button><button className={page === 'roulette' ? 'active' : ''} onClick={() => navigate('roulette')} aria-current={page === 'roulette' ? 'page' : undefined}><Dices size={19} /> Рулетка</button><button className={page === 'reference' ? 'active' : ''} onClick={() => navigate('reference')} aria-current={page === 'reference' ? 'page' : undefined}><BookOpen size={17} /> Справочник</button></nav>
      <button className="help-button" onClick={() => setModal('help')}><CircleHelp size={18} /><span>Как играть</span></button>
    </div></header>
    <main className="page-shell">
      <section className="hero"><div><div className="eyebrow hero-eyebrow"><span /> THE BINDING OF ISAAC · REPENTANCE</div><h1>Знакомый предмет.<br /><span>Неочевидный ответ.</span></h1><p>Хорошие вопросы. Смелые догадки. И немного удачи.</p></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><span className="hero-star star-one">✦</span><span className="hero-star star-two">✧</span><div className="hero-item-stack">{featured.map((item, i) => <div key={item.id} className={`hero-item hero-item-${i}`}><img src={iconUrl(item)} alt="" /><span>?</span></div>)}</div><span className="hero-art-caption">{ITEMS.length} предметов. Тот самый — один.</span></div></section>
      {storageFailed && <div className="storage-warning" role="status">Браузер не разрешает сохранять игру. До закрытия страницы всё работает, но прогресс может потеряться.</div>}
      <div className="game-layout">
        <aside className="players-panel"><div className="panel-label"><span>ЗА СТОЛОМ</span><span className="count-badge">{game.players.length}</span></div>
          <div className="player-list">{game.players.map((p, index) => <button className={`player-button ${p.id === player.id ? 'active' : ''}`} key={p.id} onClick={() => selectPlayer(p.id)} aria-pressed={p.id === player.id} aria-label={`Поле: ${p.name}`} style={{ '--player-color': p.color } as CSSProperties}><span className="player-avatar"><IsaacFace /></span><span className="player-info"><strong>{p.name}</strong><span>{boardItems.length - p.eliminated.length} из {boardItems.length} осталось</span></span><span className="player-index">0{index + 1}</span>{p.id === player.id && <ChevronRight className="player-chevron" size={16} />}</button>)}</div>
          <button className="manage-players" onClick={() => setModal('settings')}><Settings2 size={16} /> Настроить игроков</button>
          <div className="sidebar-divider" />
          <div className="secret-teaser"><span className="secret-teaser-icon"><LockKeyhole size={18} /></span><div><strong>Твой секрет</strong><p>{player.secretItemId ? 'Предмет уже выбран. Не выдавай себя!' : 'Выбери предмет, который будут угадывать друзья.'}</p></div><button onClick={() => navigate('roulette')} aria-label="Перейти к выбору секретного предмета"><ArrowRight size={18} /></button></div>
          <div className="how-card"><div className="how-card-doodle"><span>?</span><IsaacFace /><span>!</span></div><h3>Это пассивный?<br />А качество — четыре?</h3><p>Задавай вопросы, на которые можно ответить «да» или «нет».</p><button className="text-button" onClick={() => setModal('help')}>Правила игры <ArrowRight size={13} /></button></div>
          <div className="local-status"><span /> Свои люди. Один браузер.</div>
        </aside>

        <div className="main-panel">{page === 'board' ? <section className="board-panel" data-theme={game.preferences.theme} data-icon-grid={game.preferences.iconGrid} aria-label={`Игровое поле ${player.name}`}>
          <div className="board-heading"><div><div className="eyebrow">У КАЖДОГО СВОЯ ДОГАДКА</div><h2>Поле <span>{player.name}</span><span className="live-dot" /></h2></div><button className="button button-primary" onClick={() => setModal('new')}><Shuffle size={16} /> Новое поле</button></div>
          <div className="board-controls"><div className="control-left"><label className="search-field"><Search size={16} /><input placeholder="Найти предмет…" aria-label="Поиск на поле" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={14} /></button>}</label><button className="button button-secondary pool-button" onClick={() => setModal('catalogue')}><Layers3 size={16} /> Набор предметов<span>{game.poolIds.length}</span></button></div><button className="icon-button settings-button" onClick={() => setModal('settings')} aria-label="Настроить поле" title="Настроить поле"><SlidersHorizontal size={19} /></button></div>
          <div className="board-status"><div><span className="remaining-count">{remaining}</span><span> / {boardItems.length} осталось</span><span className="status-separator" /><span className="eliminated-label">{player.eliminated.length} исключено</span></div><button className={`remaining-toggle ${onlyRemaining ? 'selected' : ''}`} aria-pressed={onlyRemaining} onClick={() => setOnlyRemaining(v => !v)}>{onlyRemaining ? <Eye size={14} /> : <EyeOff size={14} />} Только оставшиеся</button></div>
          {boardGroups.map(group => <div className="board-group" key={group.title}>{group.title && <h3 className="board-group-heading">{group.title}<span>{group.items.length}</span></h3>}<div className="items-grid" style={{ '--columns': game.columns } as CSSProperties}>{group.items.map(item => <ItemCard key={item.id} item={item} eliminated={eliminated.has(item.id)} showName={game.showNames} preferences={game.preferences} onDetails={setDetailItem} onClick={() => record(toggleItem(game, player.id, item.id))} />)}</div></div>)}
          {!visibleItems.length && <div className="empty-state"><Search size={28} /><h3>{query ? 'Ничего не нашлось' : 'Все предметы исключены'}</h3><p>{query ? 'Проверь название или попробуй поиск по ID.' : 'Верни карточки повторным нажатием или сбрось поле.'}</p><button className="button button-secondary" onClick={() => { if (game.preferences.excludedStyle === 'hide') record(resetPlayer(game, player.id)); setQuery(''); setOnlyRemaining(false); }}>{game.preferences.excludedStyle === 'hide' ? 'Вернуть карточки' : 'Показать всё поле'}</button></div>}
          <div className="board-footer"><span><span className="click-symbol">↻</span> Нажми на карточку, чтобы исключить</span><div><button className="text-button muted" disabled={!history.length} onClick={undo} title="Отменить последнее действие"><Undo2 size={15} /><span>Назад</span></button><button className="text-button muted" disabled={!player.eliminated.length} onClick={() => { record(resetPlayer(game, player.id)); setToast(`Карточки ${player.name} возвращены`); }}><RotateCcw size={14} /> Сбросить</button></div></div>
        </section> : page === 'reference' ? <Reference onDetails={setDetailItem} /> : <Roulette key={player.id} items={ITEMS} boardItems={boardItems} player={player} onDetails={setDetailItem} onPick={id => { updatePlayer({ secretItemId: id, secretRevealed: true }); setToast('Предмет выбран. Теперь пусть друзья угадывают!'); }} onToggleSecret={() => updatePlayer({ secretRevealed: !player.secretRevealed })} />}</div>
      </div>
      <footer className="site-footer"><span><Heart size={13} /> Сделано для друзей и ещё одного рана.</span><span>Фан-проект · The Binding of Isaac <span className="footer-dot">·</span> <a href={`${import.meta.env.BASE_URL}items/SOURCES.md`} target="_blank" rel="noreferrer">Источники иконок</a></span></footer>
    </main>
    {modal === 'settings' && <Settings game={game} onClose={() => setModal(null)} onSave={next => { record(next); setModal(null); setToast('Настройки сохранены'); }} />}
    {modal === 'catalogue' && <BoardBuilder game={game} items={ITEMS} onClose={() => setModal(null)} onDetails={setDetailItem} onApply={next => { record(next); setQuery(''); setOnlyRemaining(false); setModal(null); setToast('Новое поле готово для всех игроков'); }} />}
    {modal === 'new' && <Modal title="Начнём новую догадку?" onClose={() => setModal(null)}><p className="modal-description">Для всех игроков появится одинаковое новое поле из {Math.min(game.boardSize, game.poolIds.length)} случайных предметов. Исключения и секретные предметы сбросятся.</p><div className="new-game-illustration"><Dices size={56} /><Sparkles size={23} /></div><div className="modal-actions"><button className="button button-secondary" onClick={() => setModal(null)}>Продолжить игру</button><button className="button button-primary" onClick={() => { record(newBoard(game, ITEMS)); setQuery(''); setOnlyRemaining(false); setModal(null); setToast('Новое поле готово. Удачи!'); }}><Shuffle size={16} /> Начать заново</button></div></Modal>}
    {modal === 'help' && <Modal title="Загадай. Спроси. Угадай." onClose={() => setModal(null)}><div className="help-steps"><div><span>01</span><div><h3>Соберите друзей</h3><p>Настройте имена и количество игроков. На поле у всех одинаковые предметы, а перевёрнутые карточки у каждого свои.</p></div></div><div><span>02</span><div><h3>Выберите секрет</h3><p>Перейдите в рулетку и выберите «С текущего поля», чтобы секрет можно было угадать по карточкам. Режим «Все предметы» подходит для игры со всем каталогом. Каждый игрок крутит рулетку за себя и скрывает результат нажатием.</p></div></div><div><span>03</span><div><h3>Задавайте вопросы по очереди</h3><p>«Он активный?», «У него качество 4?». По ответу друга переворачивайте неподходящие предметы на своём поле. Повторное нажатие возвращает карточку.</p></div></div><div><span>04</span><div><h3>Назовите тот самый предмет</h3><p>Когда уверены в догадке — проверьте секрет друга в рулетке. Договоритесь заранее, сколько попыток даёте друг другу.</p></div></div></div><p className="form-note">Игра сохраняется только в этом браузере. Общих комнат и синхронизации между устройствами пока нет.</p><div className="modal-actions"><button className="button button-primary" onClick={() => setModal(null)}>Всё понятно <ArrowRight size={16} /></button></div></Modal>}
    {detailItem && <ItemDetails key={'key' in detailItem ? detailItem.key : `item-${detailItem.id}`} item={detailItem} onClose={() => setDetailItem(null)} onNavigate={key => { const entry = REFERENCE_ENTRIES.find(e => e.key === key); if (entry) setDetailItem(entry); }} />}
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </>;
}
