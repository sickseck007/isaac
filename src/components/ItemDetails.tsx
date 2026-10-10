import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { ExternalLink, Info, RotateCcw, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import type { Item, ReferenceEntry } from '../types';
import Modal from './Modal';
import { ReferenceIcon } from './Reference';
import './ItemDetails.css';

export type ItemDescription = {
  sourceUrl: string;
  nameRu?: string;
  tagline?: string;
  taglineOriginal?: string;
  metadata?: { label: string; value: string }[];
  sections: { title: string; html: string }[];
};

const typeNames = { active: 'Активный', passive: 'Пассивный', familiar: 'Спутник' };
const descriptionCache = new Map<string, Promise<ItemDescription>>();

function description(key: string) {
  let request = descriptionCache.get(key);
  if (!request) {
    request = fetch(`${import.meta.env.BASE_URL}data/descriptions/${encodeURIComponent(key)}.json`)
      .then(response => { if (!response.ok) throw new Error('Description could not be loaded'); return response.json() as Promise<ItemDescription>; })
      .catch(error => { descriptionCache.delete(key); throw error; });
    descriptionCache.set(key, request);
  }
  return request;
}

function safeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'h3', 'h4', 'a', 'code', 'sub', 'sup', 'span', 'img', 'div', 'blockquote'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'class'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'button'],
  });
}

export default function ItemDetails({ item, onClose, onNavigate }: { item: Item | ReferenceEntry; onClose: () => void; onNavigate: (key: string) => void }) {
  const [detail, setDetail] = useState<ItemDescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setDetail(null);
    const key = 'key' in item ? item.key : `item-${item.id}`;
    description(key).then(data => { if (active) setDetail(data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item]);

  return <Modal title={detail?.nameRu || item.nameRu || item.name} onClose={onClose} wide>
    <div className="item-details-zoom" role="group" aria-label="Масштаб описания">
      <span>Масштаб</span>
      <button className="icon-button" aria-label="Уменьшить масштаб описания" onClick={() => setZoom(value => Math.max(100, value - 25))} disabled={zoom === 100}><ZoomOut size={18} /></button>
      <output aria-live="polite" aria-label="Текущий масштаб">{zoom}%</output>
      <button className="icon-button" aria-label="Увеличить масштаб описания" onClick={() => setZoom(value => Math.min(200, value + 25))} disabled={zoom === 200}><ZoomIn size={18} /></button>
      <button className="icon-button" aria-label="Сбросить масштаб описания" title="Вернуть 100%" onClick={() => setZoom(100)} disabled={zoom === 100}><RotateCcw size={16} /></button>
    </div>
    <div className="item-details-content" style={{ zoom: `${zoom}%` }}>
    <div className="item-details-top"><div className="item-details-icon">{item.icon ? <img src={`${import.meta.env.BASE_URL}${item.icon}`} alt={item.name} /> : <ReferenceIcon category={'category' in item ? item.category : 'item'} size={46} />}</div><div className="item-details-intro"><h3>{item.name}</h3>{detail?.tagline && <p>{detail.tagline}</p>}{detail?.taglineOriginal && detail.taglineOriginal !== detail.tagline && <p className="item-original-tagline">{detail.taglineOriginal}</p>}<div className="item-detail-badges"><span>#{item.id}</span><span>{'type' in item ? typeNames[item.type] : item.typeLabel || item.categoryLabel}</span>{(!('category' in item) || item.category === 'item') && item.quality !== null && item.quality >= 0 && item.quality <= 4 && <span className="detail-quality"><Sparkles size={13} /> Качество {item.quality}</span>}</div></div></div>
    {detail?.metadata?.length ? <dl className="item-detail-metadata">{detail.metadata.map((entry, i) => <div key={`${entry.label}-${i}`}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl> : null}
    {loading ? <p className="item-details-status" role="status">Загружаем описание…</p> : detail ? <div className="item-detail-sections">{detail.sections.map((section, i) => <section key={`${section.title}-${i}`}><h3>{section.title}</h3><div className="item-rich-text" onClick={event => { const link = (event.target as HTMLElement).closest('a'); const href = link?.getAttribute('href'); if (href?.startsWith('#entry=')) { event.preventDefault(); onNavigate(decodeURIComponent(href.slice(7))); } }} dangerouslySetInnerHTML={{ __html: safeHtml(section.html.replaceAll('src="items/', `src="${import.meta.env.BASE_URL}items/`)) }} /></section>)}</div> : <div className="item-details-status"><Info size={22} /><p>{error ? 'Не удалось загрузить описание. Закройте окно и попробуйте ещё раз.' : 'Подробное описание этого предмета ещё не импортировано.'}</p></div>}
    <div className="item-details-source"><span>Данные The Binding of Isaac: Repentance</span>{detail && <a href={detail.sourceUrl} target="_blank" rel="noreferrer">Источник: dead-god.ru <ExternalLink size={12} /></a>}</div>
    </div>
  </Modal>;
}
