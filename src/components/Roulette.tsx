import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Check, ChevronRight, Dices, Eye, EyeOff, HelpCircle, Info, LockKeyhole, RotateCw, Sparkles } from 'lucide-react';
import type { Item, Player } from '../types';
import './Roulette.css';

type Props = {
  items: Item[];
  boardItems: Item[];
  player: Player;
  onPick: (id: number) => void;
  onToggleSecret: () => void;
  onDetails: (item: Item) => void;
};

type Spin = { playerId: string; cards: Item[]; winner: Item };
const WINNER_INDEX = 38;
const SPIN_DURATION = 3200;

// Rejection sampling keeps every item equally likely, even for uneven pool sizes.
function randomIndex(length: number): number {
  const values = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / length) * length;
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % length;
}

function imagePath(item: Item) {
  return `${import.meta.env.BASE_URL}${item.icon}`;
}

export default function Roulette({ items, boardItems, player, onPick, onToggleSecret, onDetails }: Props) {
  const [poolType, setPoolType] = useState<'all' | 'board'>('all');
  const [spin, setSpin] = useState<Spin | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState('');
  const onPickRef = useRef(onPick);
  const spinLock = useRef(false);
  onPickRef.current = onPick;

  const pool = poolType === 'all' ? items : boardItems;
  const secret = items.find(item => item.id === player.secretItemId);
  const concealed = Boolean(secret && !player.secretRevealed && !spinning);
  const currentSpin = spin?.playerId === player.id ? spin : null;
  const preview = useMemo(() => {
    if (!pool.length) return [];
    const cards = Array.from({ length: 11 }, (_, index) => pool[(index * 53 + 7) % pool.length]);
    if (secret) cards[5] = secret;
    return cards;
  }, [pool, secret]);
  const cards = currentSpin?.cards ?? preview;
  const reelPosition = currentSpin ? position : 5;

  useEffect(() => {
    setSpin(null);
    setSpinning(false);
    setError('');
    spinLock.current = false;
  }, [player.id]);

  useEffect(() => {
    if (!spin || spin.playerId !== player.id) return;
    let secondFrame = 0;
    let timer = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setPosition(WINNER_INDEX);
        timer = window.setTimeout(() => {
          onPickRef.current(spin.winner.id);
          setSpinning(false);
          spinLock.current = false;
        }, reducedMotion ? 0 : SPIN_DURATION + 80);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      clearTimeout(timer);
    };
  }, [spin, player.id]);

  function startSpin() {
    if (!pool.length || spinLock.current) return;
    spinLock.current = true;
    setError('');
    try {
      const winner = pool[randomIndex(pool.length)];
      const nextCards = Array.from({ length: WINNER_INDEX + 7 }, () => pool[randomIndex(pool.length)]);
      nextCards[WINNER_INDEX] = winner;
      setPosition(0);
      setSpinning(true);
      setSpin({ playerId: player.id, cards: nextCards, winner });
    } catch {
      spinLock.current = false;
      setError('Не удалось запустить случайный выбор. Обновите страницу и попробуйте ещё раз.');
    }
  }

  return (
    <section className="roulette" aria-labelledby="roulette-title">
      <div className="roulette-heading">
        <div>
          <span className="eyebrow roulette-eyebrow"><Sparkles size={13} /> ДОВЕРЬСЯ СЛУЧАЮ</span>
          <h2 id="roulette-title">Один предмет. <span>Твой секрет.</span></h2>
          <p>Крути рулетку, запоминай предмет и пусть друзья попробуют угадать.</p>
        </div>
        <div className="roulette-player"><span style={{ backgroundColor: player.color }} />Выбираем для <strong>{player.name}</strong></div>
      </div>

      <div className="roulette-machine">
        <div className="roulette-machine-top">
          <div className="roulette-pool-toggle" role="group" aria-label="Набор предметов для рулетки">
            <button type="button" className={poolType === 'all' ? 'is-active' : ''} aria-pressed={poolType === 'all'} disabled={spinning} onClick={() => setPoolType('all')}>Все предметы <span>{items.length}</span></button>
            <button type="button" className={poolType === 'board' ? 'is-active' : ''} aria-pressed={poolType === 'board'} disabled={spinning} onClick={() => setPoolType('board')}>С игрового поля <span>{boardItems.length}</span></button>
          </div>
          <span className="roulette-equal-chance"><span />Равный шанс у каждого</span>
        </div>

        <div className={`roulette-stage${spinning ? ' is-spinning' : ''}${concealed ? ' is-concealed' : ''}`} aria-busy={spinning}>
          {pool.length > 0 ? <>
            <div className="roulette-marker roulette-marker-top" aria-hidden="true"><ArrowDown size={21} strokeWidth={2.8} /></div>
            <div className="roulette-window" aria-hidden="true">
              <div className="roulette-center-frame" />
              <div
                className="roulette-track"
                style={{
                  transform: `translateX(calc(-${reelPosition} * (var(--roulette-card-width) + var(--roulette-gap)) - var(--roulette-card-width) / 2))`,
                  transition: currentSpin && position > 0 ? `transform ${SPIN_DURATION}ms cubic-bezier(.12,.7,.17,1)` : 'none',
                }}
              >
                {cards.map((item, index) => <div key={`${index}-${item.id}`} className={`roulette-item${currentSpin && index === WINNER_INDEX && !spinning ? ' is-winner' : ''}`}>
                  <span className="roulette-item-id">#{String(item.id).padStart(3, '0')}</span>
                  <img src={imagePath(item)} alt="" draggable="false" />
                  <span className="roulette-item-name">{item.name}</span>
                  <span className="roulette-item-quality">{'◆'.repeat(item.quality)}{'◇'.repeat(4 - item.quality)}</span>
                </div>)}
              </div>
            </div>
            <div className="roulette-marker roulette-marker-bottom" aria-hidden="true" />
            {concealed && <button type="button" className="roulette-secret-cover" onClick={onToggleSecret} aria-label={`Показать секретный предмет игрока ${player.name}`}>
              <span className="roulette-cover-symbol"><LockKeyhole size={33} strokeWidth={1.5} /></span>
              <strong>Секрет под замком</strong>
              <span><Eye size={14} />Нажми, когда никто не подглядывает</span>
            </button>}
          </> : <div className="roulette-empty"><HelpCircle size={38} /><strong>В этом наборе пока пусто</strong><p>Добавь предметы на игровое поле или выбери весь каталог.</p></div>}
        </div>

        <div className="roulette-spin-controls">
          <p>{spinning ? 'Предмет уже где-то рядом…' : secret ? 'Новая прокрутка заменит твой текущий предмет' : 'Какой предмет выпадет тебе сегодня?'}</p>
          <button type="button" className="button button-primary roulette-spin-button" onClick={startSpin} disabled={spinning || pool.length === 0}>
            {spinning ? <RotateCw className="roulette-spinning-icon" size={20} /> : <Dices size={20} />}
            {spinning ? 'Выбираем предмет…' : secret ? 'Крутить ещё раз' : 'Крутить рулетку'}
            {!spinning && <ChevronRight size={18} />}
          </button>
          <span className="roulette-pool-caption">{pool.length} предметов · {poolType === 'all' ? 'The Binding of Isaac: Repentance' : 'твой игровой набор'}</span>
          {error && <p className="roulette-error" role="alert">{error}</p>}
        </div>
      </div>

      <div className="roulette-bottom">
        <div className="roulette-result">
          <div className="roulette-result-heading"><span className="eyebrow">ТВОЙ ПРЕДМЕТ</span>{secret && !concealed && !spinning ? <button type="button" className="roulette-detail-button" onClick={() => onDetails(secret)} aria-label={`Описание ${secret.name}`}><Info size={12} /> О предмете</button> : <span>{player.name}</span>}</div>
          {secret && !spinning ? <button type="button" className={`roulette-result-card${concealed ? ' is-hidden' : ''}`} onClick={onToggleSecret} aria-label={concealed ? 'Показать выбранный предмет' : `Скрыть выбранный предмет: ${secret.name}`}>
            <span className="roulette-result-icon">{concealed ? <HelpCircle size={34} strokeWidth={1.6} /> : <img src={imagePath(secret)} alt="" />}</span>
            <span className="roulette-result-copy"><strong>{concealed ? 'Это наш маленький секрет' : secret.name}</strong><span>{concealed ? 'Нажми, чтобы посмотреть' : 'Запомни и нажми, чтобы скрыть'}</span></span>
            {concealed ? <Eye size={20} /> : <EyeOff size={20} />}
          </button> : <div className="roulette-result-placeholder"><span><Dices size={28} strokeWidth={1.4} /></span><div><strong>{spinning ? 'Судьба решает…' : 'Здесь будет твой предмет'}</strong><p>{spinning ? 'Осталось совсем немного' : 'Нажми на кнопку и испытай удачу'}</p></div></div>}
        </div>
        <div className="roulette-howto">
          <span className="eyebrow">КАК ИГРАТЬ</span>
          <ol><li><span>01</span>Выбери игрока и крути рулетку.</li><li><span>02</span>Запомни предмет и скрой его от друзей.</li><li><span>03</span>Задавайте вопросы и убирайте лишнее на поле.</li></ol>
          <p><Check size={13} />Предмет сохраняется отдельно у каждого игрока</p>
        </div>
      </div>
      <div className="roulette-announcement" role="status" aria-live="polite" aria-atomic="true">{spinning ? 'Рулетка запущена. Выбираем предмет.' : secret ? concealed ? 'Выбранный предмет скрыт.' : `Выбран предмет ${secret.name}. Нажмите на карточку, чтобы скрыть его.` : ''}</div>
    </section>
  );
}
