import { createRng, hashSeed } from './rng';
import { MATH_GENERATORS, timesTable } from './math';
import { ENGLISH_GENERATORS, matchPairs } from './english';
import type { Question, DrillResponse, Rng } from './types';
import type { QuizDrillSpec, QuizTopic } from '../model/types';

export const MATH_TOPICS: readonly QuizTopic[] = ['times-tables', 'mental-math', 'fractions', 'geometry', 'word-problems', 'math-mix'];
export const ENGLISH_TOPICS: readonly QuizTopic[] = ['en-vocab', 'en-sentences', 'en-fill', 'en-mix'];
export const QUIZ_TOPICS: readonly QuizTopic[] = [...MATH_TOPICS, ...ENGLISH_TOPICS];

export const DRILL_LIMITS = { minLength: 3, maxLength: 20, minLevel: 1, maxLevel: 5 } as const;

export const clampLevel = (level: number) => Math.min(DRILL_LIMITS.maxLevel, Math.max(DRILL_LIMITS.minLevel, Math.floor(level) || 1));

/** Seed string for one attempt: same child + quest + week + attempt → same questions. */
export const drillSeed = (childId: string, questId: string, weekId: string, attempt: number) => `${childId}|${questId}|${weekId}|${attempt}`;

function oneQuestion(rng: Rng, spec: Pick<QuizDrillSpec, 'topic' | 'table'>, level: number, id: string, index: number): Question {
  switch (spec.topic) {
    case 'times-tables':
      return timesTable(rng, level, id, spec.table);
    case 'math-mix':
      return rng.pick([MATH_GENERATORS['mental-math'], MATH_GENERATORS['times-tables'], MATH_GENERATORS.fractions, MATH_GENERATORS.geometry, MATH_GENERATORS['word-problems']])(rng, level, id);
    case 'en-mix':
      // One matching round per mixed English drill (the 3rd question), the rest mixed.
      if (index === 2) return matchPairs(rng, level, id);
      return rng.pick([ENGLISH_GENERATORS['en-vocab'], ENGLISH_GENERATORS['en-sentences'], ENGLISH_GENERATORS['en-fill']])(rng, level, id);
    case 'en-vocab':
    case 'en-sentences':
    case 'en-fill':
      return ENGLISH_GENERATORS[spec.topic](rng, level, id);
    default:
      return MATH_GENERATORS[spec.topic](rng, level, id);
  }
}

/** Identity used to avoid repeating the same question inside one drill. */
const questionKey = (q: Question) => JSON.stringify([q.prompt, q.figure ?? null]);

/** Deterministically generate a drill. */
export function generateDrill(spec: Pick<QuizDrillSpec, 'topic' | 'length' | 'table'>, level: number, seed: string): Question[] {
  const lvl = clampLevel(level);
  const rng = createRng(hashSeed(seed));
  const out: Question[] = [];
  const seen = new Set<string>();
  const length = Math.min(DRILL_LIMITS.maxLength, Math.max(DRILL_LIMITS.minLength, spec.length));
  for (let i = 0; i < length; i++) {
    let q = oneQuestion(rng, spec, lvl, `q${i + 1}`, i);
    for (let tries = 0; seen.has(questionKey(q)) && tries < 12; tries++) q = oneQuestion(rng, spec, lvl, `q${i + 1}`, i);
    seen.add(questionKey(q));
    out.push(q);
  }
  return out;
}

/** Parse a typed numeric answer: accepts spaces, a leading minus, and a decimal comma. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/\s+/g, '').replace(',', '.').replace('−', '-');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function checkAnswer(q: Question, r: DrillResponse | undefined): boolean {
  if (!r || 'skipped' in r) return false;
  switch (q.type) {
    case 'choice':
    case 'blank':
      return 'choice' in r && r.choice === q.answerIndex;
    case 'numeric': {
      if (!('value' in r)) return false;
      const v = parseNumber(r.value);
      return v !== null && Math.abs(v - q.answer) < 1e-9;
    }
    case 'match':
      return 'pairs' in r && r.pairs.length === q.answer.length && r.pairs.every((p, i) => p === q.answer[i]);
  }
}

export interface DrillScore {
  correct: number;
  total: number;
  results: boolean[];
}

export function scoreDrill(questions: readonly Question[], responses: readonly (DrillResponse | undefined)[]): DrillScore {
  const results = questions.map((q, i) => checkAnswer(q, responses[i]));
  return { correct: results.filter(Boolean).length, total: questions.length, results };
}

export const isPass = (score: Pick<DrillScore, 'correct'>, passScore: number) => score.correct >= passScore;

/** Default pass threshold: 80% rounded up (10 → 8, 5 → 4, 8 → 7). */
export const defaultPassScore = (length: number) => Math.max(1, Math.ceil(length * 0.8));
