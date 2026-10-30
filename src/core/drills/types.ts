/**
 * Generated drill content. Pure data so the UI can render it and tests can check it.
 * Text is split into segments so the app can apply the right direction/language to each part
 * (Hebrew RTL text, LTR math expressions, English words, stacked fractions).
 */
export type Seg =
  | { t: 'text'; v: string }
  /** LTR math expression, e.g. "7 × 8". */
  | { t: 'math'; v: string }
  | { t: 'frac'; n: number; d: number }
  /** English (LTR, lang=en). `say` marks text the app may read aloud. */
  | { t: 'en'; v: string; say?: boolean }
  | { t: 'emoji'; v: string }
  /** The gap in a fill-in-the-blank sentence. */
  | { t: 'blank' }
  /** A left-to-right group (e.g. "¾ ? ⅔") kept in order inside RTL text. */
  | { t: 'expr'; parts: Seg[] };

export type Figure =
  | { shape: 'rect'; w: number; h: number; unit: string }
  | { shape: 'triangle'; base: number; height: number; unit: string }
  | { shape: 'right-triangle'; a: number; b: number; unit: string }
  | { shape: 'angle'; deg: number }
  | { shape: 'triangle-angles'; a: number; b: number }
  | { shape: 'fraction-bar'; n: number; d: number }
  | { shape: 'polygon'; sides: number };

interface QuestionBase {
  id: string;
  prompt: Seg[];
  figure?: Figure;
  /** Full worked answer shown after answering ("7 × 8 = 56"). */
  solution: Seg[];
  /** Generator inputs, used by tests to re-check the answer independently. */
  meta: Record<string, number | string>;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'choice';
  choices: Seg[][];
  answerIndex: number;
}

export interface NumericQuestion extends QuestionBase {
  type: 'numeric';
  answer: number;
  /** Shown next to the input, e.g. "ס״מ". */
  unit?: string;
}

/** Fill-in-the-blank: the prompt has one { t: 'blank' } segment; pick the word that fits. */
export interface BlankQuestion extends QuestionBase {
  type: 'blank';
  choices: Seg[][];
  answerIndex: number;
}

/** Match pairs: left[i] belongs with right[answer[i]]. */
export interface MatchQuestion extends QuestionBase {
  type: 'match';
  left: Seg[][];
  right: Seg[][];
  answer: number[];
}

export type Question = ChoiceQuestion | NumericQuestion | BlankQuestion | MatchQuestion;

export type DrillResponse =
  | { choice: number }
  | { value: string }
  /** pairs[i] = index into `right` chosen for left[i]. */
  | { pairs: number[] }
  /** Skipped / no answer. */
  | { skipped: true };

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
}
