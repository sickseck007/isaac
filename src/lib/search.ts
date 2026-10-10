type SearchableItem = { name: string; nameRu?: string; id: number; keywords?: string };

export function normalizeSearch(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
    .replaceAll('ё', 'е').replace(/['’‘ʼ`´]/g, '')
    .replace(/[‐‑‒–—−-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const compact = (text: string) => text.replace(/[\s\p{P}]/gu, '');

export function matchesSearch(text: string, query: string): boolean {
  const needle = normalizeSearch(query), source = normalizeSearch(text);
  if (!needle) return !query.trim();
  const shorthand = compact(needle);
  return source.includes(needle) || Boolean(shorthand && compact(source).includes(shorthand));
}

export function exactSearch(text: string, query: string): boolean {
  const needle = normalizeSearch(query), source = normalizeSearch(text);
  if (!needle) return false;
  return source === needle || Boolean(compact(needle) && compact(source) === compact(needle));
}

export function matchesItemSearch(item: SearchableItem, query: string): boolean {
  return matchesSearch(`${item.name} ${item.nameRu ?? ''} ${item.id} ${item.keywords ?? ''}`, query);
}
