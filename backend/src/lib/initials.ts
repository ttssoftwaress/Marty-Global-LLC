/*
 * Initials for an avatar chip. Derived here rather than in the browser: every
 * admin list type documents `initials` as arriving from the backend so that a
 * two-word Latin name and a single-glyph script both render correctly — a naive
 * client-side `name.split(' ')` mangles the second case.
 *
 * `Intl.Segmenter` with granularity 'grapheme' is what makes that true: it takes
 * the first *user-perceived* character of a word, so an emoji, an accented
 * letter formed from two code points, or a CJK glyph each count as one.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function firstGrapheme(word: string): string {
  for (const { segment } of segmenter.segment(word)) return segment;
  return '';
}

export function toInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

  const first = words[0];
  if (!first) return '?';

  // One word gives one initial rather than two letters sliced out of it — "Wang"
  // reads as "W", not "WA".
  const last = words.length > 1 ? words[words.length - 1] : undefined;

  return [first, last]
    .filter((word): word is string => Boolean(word))
    .map((word) => firstGrapheme(word).toLocaleUpperCase())
    .join('');
}

/*
 * "Marcus T." — what the support inbox's narrow capsules and list rows print
 * when there is no room for a full name. A single-word name stays whole; there
 * is nothing to abbreviate.
 */
export function toShortName(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

  const first = words[0];
  if (!first) return '';

  const last = words.length > 1 ? words[words.length - 1] : undefined;
  if (!last) return first;

  return `${first} ${firstGrapheme(last).toLocaleUpperCase()}.`;
}

// The composer's "Type your reply to Sarah…" — the name the customer goes by.
export function toFirstName(name: string | null | undefined): string {
  const [first] = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return first ?? '';
}
