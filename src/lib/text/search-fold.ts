/**
 * Search text in a comparable form: lower case, without accents and umlaut dots (Unicode-aware,
 * so every script keeps its letters), ß as ss. "Ägypten", "ägypten" and "Agypten" fold alike,
 * as do "Zürich" and "Zurich".
 */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The folded forms a label can be searched by: the plain one and the German transcription of
 * its umlauts (München -> muenchen), which people type without an umlaut key.
 */
export function searchForms(label: string): string[] {
  const plain = foldForSearch(label);
  const transcribed = foldForSearch(
    label.replace(/[äÄ]/g, (c) => (c === 'Ä' ? 'Ae' : 'ae')).replace(/[öÖ]/g, (c) => (c === 'Ö' ? 'Oe' : 'oe')).replace(/[üÜ]/g, (c) => (c === 'Ü' ? 'Ue' : 'ue'))
  );
  return transcribed === plain ? [plain] : [plain, transcribed];
}
