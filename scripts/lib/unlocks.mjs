const unlockableCategories = new Set(['item', 'trinket', 'cards_and_runes', 'pills']);
const conditionFields = ['data-opening-achievment', 'data-opening-character', 'data-opening-ending', 'other-opening'];
// The saved page calls Guardian Angel initially available despite also listing
// its real unlock (achievement 45, Magdalene / Satan).
const correctedOpenings = { 'item-112': 'Победить Сатану за Магдалину.' };

// An empty description alone is insufficient: some locked entries only carry
// an achievement or structured unlock condition in the saved source.
export function normalizeUnlockSections(record, sections) {
  const text = key => (record.fields[key] ?? []).map(value => value.text.trim()).filter(Boolean).join(' ');
  const opening = sections.find(section => section.title === 'Как открыть');
  if (opening) {
    if (/^Открыто со старта[.!]?$/i.test(text('data-opening'))) opening.html = `<p>${correctedOpenings[record.key] ?? 'Открыт с начала.'}</p>`;
  } else if (unlockableCategories.has(record.category) && !conditionFields.some(key => {
    const value = text(key);
    return value && value !== 'none';
  })) {
    sections.push({ title: 'Как открыть', html: '<p>Открыт с начала.</p>' });
  }
  return sections;
}
