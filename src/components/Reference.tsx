import { useMemo, useState } from 'react';
import { BookOpen, Candy, Gem, Ghost, Heart, Layers3, Pill, Search, Sparkles, X } from 'lucide-react';
import type { ReferenceEntry } from '../types';
import reference from '../data/referenceIndex.json';
import { matchesItemSearch } from '../lib/search';
import './Reference.css';

export const REFERENCE_ENTRIES = reference as ReferenceEntry[];
const categories = [...new Map(REFERENCE_ENTRIES.map(entry => [entry.category, entry.categoryLabel])).entries()];

export function ReferenceIcon({ category, size = 25 }: { category: string; size?: number }) {
  const Icon = ({ item: Sparkles, trinket: Gem, cards_and_runes: Layers3, pills: Pill, transformation: Ghost, pickup: Heart, environment: Candy } as Record<string, typeof Sparkles>)[category] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.5} />;
}

export default function Reference({ onDetails }: { onDetails: (entry: ReferenceEntry) => void }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => REFERENCE_ENTRIES.filter(entry =>
    (category === 'all' || entry.category === category) && matchesItemSearch(entry, query)), [category, query]);
  const visible = filtered.slice(0, page * 72);
  return <section className="reference-panel" aria-labelledby="reference-title"><div className="reference-heading"><div className="eyebrow">ВСЕ ЗАПИСИ ИЗ DEAD-GOD.RU</div><h2 id="reference-title">Маленькая энциклопедия.<br /><span>Большой Айзек.</span></h2><p>Эффекты, синергии, баги, условия открытия и всё остальное из сохранённого справочника.</p></div>
    <div className="reference-tools"><label className="search-field"><Search size={17} /><input aria-label="Поиск в справочнике" placeholder="Название, перевод, ID или ключевое слово" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} />{query && <button onClick={() => { setQuery(''); setPage(1); }} aria-label="Очистить поиск в справочнике"><X size={16} /></button>}</label><span>{filtered.length} записей</span></div>
    <div className="reference-categories" role="group" aria-label="Категории справочника"><button className={category === 'all' ? 'selected' : ''} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setPage(1); }}><BookOpen size={13} />Всё<span>{REFERENCE_ENTRIES.length}</span></button>{categories.map(([key, label]) => <button key={key} className={category === key ? 'selected' : ''} aria-pressed={category === key} onClick={() => { setCategory(key); setPage(1); }}><ReferenceIcon category={key} size={13} />{label}<span>{REFERENCE_ENTRIES.filter(entry => entry.category === key).length}</span></button>)}</div>
    <div className="reference-grid">{visible.map(entry => <button key={entry.key} className="reference-entry" onClick={() => onDetails(entry)} aria-label={`Справочник: ${entry.name}`}><span className={`reference-entry-icon category-${entry.category}`}>{entry.icon ? <img src={`${import.meta.env.BASE_URL}${entry.icon}`} alt="" loading="lazy" /> : <ReferenceIcon category={entry.category} />}</span><span className="reference-entry-copy"><strong>{entry.name}</strong>{entry.nameRu !== entry.name && <span>{entry.nameRu}</span>}<small>{entry.categoryLabel} · #{entry.id}</small></span></button>)}</div>
    {!filtered.length && <div className="empty-state"><Search /><h3>Ничего не найдено</h3><p>Попробуйте другое название или переключите категорию.</p></div>}
    {visible.length < filtered.length && <button className="button button-secondary reference-more" onClick={() => setPage(p => p + 1)}>Показать ещё {Math.min(72, filtered.length - visible.length)}</button>}
    <div className="reference-source"><span>1185 записей из сохранённой страницы, предоставленной владельцем сайта.</span><a href={`${import.meta.env.BASE_URL}data/dead-god-all.json`} target="_blank" rel="noreferrer">Полный экспорт данных</a></div>
  </section>;
}
