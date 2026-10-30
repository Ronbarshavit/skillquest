import type { ChoiceQuestion, NumericQuestion, Rng, Seg } from './types';

/** Small builders shared by the generators. */
export const T = (v: string): Seg => ({ t: 'text', v });
export const M = (v: string): Seg => ({ t: 'math', v });
export const F = (n: number, d: number): Seg => ({ t: 'frac', n, d });
export const EN = (v: string, say = false): Seg => ({ t: 'en', v, say: say || undefined });
export const E = (v: string): Seg => ({ t: 'emoji', v });
export const BLANK: Seg = { t: 'blank' };

/** Typographic operators for display (the meta keeps ASCII). */
export const OPS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export const segKey = (segs: Seg[]) => JSON.stringify(segs);

export function numeric(
  id: string,
  prompt: Seg[],
  answer: number,
  solution: Seg[],
  meta: NumericQuestion['meta'],
  extra: Partial<NumericQuestion> = {},
): NumericQuestion {
  return { id, type: 'numeric', prompt, answer, solution, meta, ...extra };
}

/** Multiple choice: shuffles `correct` in among the distractors (deduplicated). */
export function choice(
  rng: Rng,
  id: string,
  prompt: Seg[],
  correct: Seg[],
  distractors: Seg[][],
  solution: Seg[],
  meta: ChoiceQuestion['meta'],
  extra: Partial<ChoiceQuestion> = {},
  count = 4,
): ChoiceQuestion {
  const seen = new Set([segKey(correct)]);
  const ds: Seg[][] = [];
  for (const d of distractors) {
    const k = segKey(d);
    if (seen.has(k)) continue;
    seen.add(k);
    ds.push(d);
    if (ds.length >= count - 1) break;
  }
  const choices = rng.shuffle([correct, ...ds]);
  return { id, type: 'choice', prompt, choices, answerIndex: choices.findIndex((c) => segKey(c) === segKey(correct)), solution, meta, ...extra };
}

/** Plausible wrong numbers near `answer` (positive, distinct). */
export function nearNumbers(rng: Rng, answer: number, n = 3): number[] {
  const out = new Set<number>();
  const deltas = [1, 2, 10, -1, -2, -10, 3, 5, -5];
  let guard = 0;
  while (out.size < n && guard++ < 50) {
    const v = answer + rng.pick(deltas);
    if (v >= 0 && v !== answer) out.add(v);
  }
  return [...out];
}

/** Children's names for word problems: varied, with grammatical gender for verb agreement. */
export const NAMES: readonly { name: string; g: 'm' | 'f' }[] = [
  { name: 'דנה', g: 'f' },
  { name: 'יואב', g: 'm' },
  { name: 'מאיה', g: 'f' },
  { name: 'עומר', g: 'm' },
  { name: 'תמר', g: 'f' },
  { name: 'אריאל', g: 'm' },
  { name: 'שירה', g: 'f' },
  { name: 'גיל', g: 'm' },
  { name: 'הילה', g: 'f' },
  { name: 'אלון', g: 'm' },
  { name: 'יעל', g: 'f' },
  { name: 'נדב', g: 'm' },
];

/** Countable items (Hebrew plural) for word problems. */
export const ITEMS: readonly string[] = ['מדבקות', 'גולות', 'עפרונות', 'קלפים', 'תפוחים', 'בלונים', 'עוגיות', 'צדפים', 'כדורים', 'פרחים'];
