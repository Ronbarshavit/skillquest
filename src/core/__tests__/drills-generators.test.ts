import { describe, expect, it } from 'vitest';
import { checkAnswer, generateDrill, parseNumber, scoreDrill, QUIZ_TOPICS, defaultPassScore } from '../drills/engine';
import { createRng, gcd, hashSeed } from '../drills/rng';
import { fractions, geometry, mentalMath, timesTable, wordProblem, TIMES_RANGES, MENTAL_MAX, GEO_MAX_SIDE, FRACTION_MAX_DEN } from '../drills/math';
import { fill, matchPairs, sentences, vocab } from '../drills/english';
import { WORD_BANK } from '../drills/wordbank';
import { GUIDED_TEMPLATES, templatesForGroup } from '../drills/guided';
import type { DrillResponse, Question, Seg } from '../drills/types';

/** The correct response for a question (what a perfect player would enter). */
export const correctResponse = (q: Question): DrillResponse =>
  q.type === 'numeric' ? { value: String(q.answer) } : q.type === 'match' ? { pairs: q.answer } : { choice: q.answerIndex };

/** Independent evaluation of the stored arithmetic ("12 + 7 * 3", "ceil(45 / 20)"). */
const evalExpr = (expr: string) => {
  if (!/^[\d\s+\-*/().ceil]+$/.test(expr)) throw new Error(`unsafe expr ${expr}`);
  return Function(`"use strict"; const ceil = Math.ceil; return (${expr});`)() as number;
};
const segText = (segs: Seg[]): string => segs.map((s) => ('v' in s ? s.v : s.t === 'frac' ? `${s.n}/${s.d}` : s.t === 'expr' ? segText(s.parts) : '_')).join(' ');
const LEVELS = [1, 2, 3, 4, 5];
const many = (fn: (seed: number, level: number) => void, n = 120) => {
  for (const level of LEVELS) for (let i = 0; i < n; i++) fn(i * 7919 + level, level);
};
const rngOf = (seed: number) => createRng(seed);

describe('rng', () => {
  it('is deterministic and in range', () => {
    const a = createRng(hashSeed('x')), b = createRng(hashSeed('x'));
    for (let i = 0; i < 50; i++) {
      const v = a.int(3, 9);
      expect(v).toBe(b.int(3, 9));
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(gcd(12, 18)).toBe(6);
  });
});

describe('math generators', () => {
  it('times tables: correct answers and factors within the level range', () => {
    many((seed, level) => {
      const q = timesTable(rngOf(seed), level, 'q');
      if (q.type !== 'numeric') throw new Error('numeric expected');
      expect(evalExpr(String(q.meta.expr))).toBe(q.answer);
      const { a, b } = q.meta as { a: number; b: number };
      const r = TIMES_RANGES[level];
      expect(a).toBeGreaterThanOrEqual(r.a[0]);
      expect(a).toBeLessThanOrEqual(r.a[1]);
      expect(b).toBeGreaterThanOrEqual(r.b[0]);
      expect(b).toBeLessThanOrEqual(r.b[1]);
      if (level < 4) expect(q.meta.form).toBe('mul');
      if (level < 5) expect(q.meta.form).not.toBe('div');
    });
  });
  it('times tables: a focused table always uses that table', () => {
    for (let i = 0; i < 50; i++) {
      const q = timesTable(rngOf(i), 3, 'q', 7);
      expect(q.meta.a).toBe(7);
    }
  });
  it('mental math: answers match the expression and stay within level limits', () => {
    many((seed, level) => {
      const q = mentalMath(rngOf(seed), level, 'q');
      if (q.type !== 'numeric') throw new Error('numeric expected');
      expect(evalExpr(String(q.meta.expr))).toBe(q.answer);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      if (level <= 2) {
        expect(['+', '-']).toContain(q.meta.op);
        expect(q.answer).toBeLessThanOrEqual(MENTAL_MAX[level]);
        const nums = String(q.meta.expr).match(/\d+/g)!.map(Number);
        nums.forEach((n) => expect(n).toBeLessThanOrEqual(MENTAL_MAX[level]));
      }
      if (level < 5) expect(q.meta.op).not.toBe('order');
    });
  });
  it('fractions: re-checked from the inputs; denominators within the level range', () => {
    many((seed, level) => {
      const q = fractions(rngOf(seed), level, 'q');
      const m = q.meta as Record<string, number & string>;
      const dens = ['d', 'd1', 'd2'].map((k) => m[k]).filter((x) => typeof x === 'number');
      if (m.kind !== 'add-multiple' && m.kind !== 'add-lcm' && m.kind !== 'sub-lcm' && m.kind !== 'simplify') dens.forEach((d) => expect(d).toBeLessThanOrEqual(FRACTION_MAX_DEN[level]));
      if (q.type === 'numeric') {
        expect(q.answer).toBe((m.whole / m.d) * m.n);
        return;
      }
      if (q.type !== 'choice') throw new Error('choice expected');
      const pick = q.choices[q.answerIndex];
      switch (m.kind) {
        case 'compare':
        case 'compare-same': {
          const diff = m.n1 / m.d1 - m.n2 / m.d2;
          expect(segText(pick)).toBe(Math.abs(diff) < 1e-12 ? '=' : diff > 0 ? '>' : '<');
          break;
        }
        case 'shaded':
          expect(pick).toEqual([{ t: 'frac', n: m.n, d: m.d }]);
          break;
        case 'simplify':
          expect(m.an / m.ad).toBeCloseTo(m.n / m.d, 12);
          expect(gcd(m.an, m.ad)).toBe(1);
          expect(pick).toEqual([{ t: 'frac', n: m.an, d: m.ad }]);
          break;
        default: {
          // add-same / add-multiple / add-lcm / sub-lcm
          const v = m.op === '-' ? m.n1 / m.d1 - m.n2 / m.d2 : m.n1 / m.d1 + m.n2 / m.d2;
          expect(m.an / m.ad).toBeCloseTo(v, 12);
          expect(v).toBeGreaterThan(0);
          expect(pick).toEqual([{ t: 'frac', n: m.an, d: m.ad }]);
        }
      }
      // Exactly one correct option.
      const keys = q.choices.map((c) => JSON.stringify(c));
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
  it('geometry: answers re-computed from the figure; sides within the level range', () => {
    many((seed, level) => {
      const q = geometry(rngOf(seed), level, 'q');
      const m = q.meta as Record<string, number & string>;
      const answer = q.type === 'numeric' ? q.answer : undefined;
      switch (m.kind) {
        case 'sides':
          expect(answer).toBe(m.sides);
          break;
        case 'rect-perimeter':
          expect(answer).toBe(2 * (m.w + m.h));
          break;
        case 'rect-area':
          expect(answer).toBe(m.w * m.h);
          break;
        case 'right-tri-area':
        case 'tri-area':
          expect(answer).toBe((m.base * m.height) / 2);
          expect(Number.isInteger(answer)).toBe(true);
          break;
        case 'missing-angle':
          expect(answer).toBe(180 - m.a - m.b);
          expect(answer).toBeGreaterThan(0);
          break;
        case 'side-from-area':
        case 'side-from-perimeter':
          expect(answer).toBe(m.h);
          break;
        case 'angle-type': {
          if (q.type !== 'choice') throw new Error();
          const want = m.deg < 90 ? 'חדה' : m.deg === 90 ? 'ישרה' : 'קהה';
          expect(segText(q.choices[q.answerIndex])).toContain(want);
          break;
        }
      }
      for (const k of ['w', 'h', 'base', 'height']) if (typeof m[k] === 'number') expect(m[k]).toBeLessThanOrEqual(GEO_MAX_SIDE[level]);
    });
  });
  it('word problems: natural Hebrew text with a correct whole-number answer', () => {
    many((seed, level) => {
      const q = wordProblem(rngOf(seed), level, 'q');
      if (q.type !== 'numeric') throw new Error('numeric expected');
      expect(evalExpr(String(q.meta.expr))).toBe(q.answer);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(segText(q.prompt)).toMatch(/[א-ת]/);
      expect(segText(q.prompt)).not.toMatch(/undefined|NaN/);
    });
  });
});

describe('english generators', () => {
  it('word bank has ≥150 unique words across levels 1–5, each with Hebrew + emoji', () => {
    expect(WORD_BANK.length).toBeGreaterThanOrEqual(150);
    expect(new Set(WORD_BANK.map((w) => w.en)).size).toBe(WORD_BANK.length);
    for (const l of LEVELS) expect(WORD_BANK.filter((w) => w.level === l).length).toBeGreaterThanOrEqual(20);
    WORD_BANK.forEach((w) => {
      expect(w.en).toMatch(/^[a-z ]+$/);
      expect(w.he).toMatch(/[א-ת]/);
      expect(w.emoji.length).toBeGreaterThan(0);
    });
  });
  it('vocab: the answer matches the word; distractors are different; words only up to the level', () => {
    many((seed, level) => {
      const q = vocab(rngOf(seed), level, 'q');
      if (q.type !== 'choice') throw new Error();
      const word = WORD_BANK.find((w) => w.en === q.meta.en)!;
      expect(word.level).toBeLessThanOrEqual(level);
      const pick = segText(q.choices[q.answerIndex]);
      expect(pick === word.he || pick === word.en).toBe(true);
      expect(new Set(q.choices.map((c) => segText(c))).size).toBe(q.choices.length);
      expect(q.choices.length).toBe(4);
      // English text is always an `en` segment (rendered dir=ltr lang=en).
      const ens = [...q.prompt, ...q.choices.flat()].filter((s) => s.t === 'text' && /[a-z]/i.test(s.v));
      expect(ens).toHaveLength(0);
    });
  });
  it('sentences and fill-in-the-blank: one correct option, gap present', () => {
    many((seed, level) => {
      const s = sentences(rngOf(seed), level, 'q');
      if (s.type !== 'choice') throw new Error();
      expect(s.choices.length).toBeGreaterThanOrEqual(2);
      const f = fill(rngOf(seed), level, 'q');
      expect(segText(f.choices[f.answerIndex])).toBe(f.meta.answer);
      expect(JSON.stringify(f.prompt)).toContain('"blank"');
      expect(new Set(f.choices.map((c) => segText(c))).size).toBe(f.choices.length);
    });
  });
  it('fill: grammar rules are right (a/an, am/is/are)', () => {
    many((seed, level) => {
      const f = fill(rngOf(seed), level, 'q');
      const sentence = String(f.meta.sentence);
      const m = sentence.match(/^This is (a|an) (\w+)/);
      if (m) expect(m[1]).toBe(/^[aeiou]/.test(m[2]) ? 'an' : 'a');
      const be = sentence.match(/^(I|You|He|She|It|We|They) (am|is|are) /);
      if (be) expect(be[2]).toBe({ I: 'am', You: 'are', He: 'is', She: 'is', It: 'is', We: 'are', They: 'are' }[be[1]]);
    });
  });
  it('match pairs: answer maps each English word to its Hebrew meaning', () => {
    many((seed, level) => {
      const q = matchPairs(rngOf(seed), level, 'q');
      q.left.forEach((l, i) => {
        const w = WORD_BANK.find((x) => x.en === segText(l))!;
        expect(segText(q.right[q.answer[i]])).toBe(w.he);
      });
      expect(new Set(q.answer).size).toBe(4);
    }, 30);
  });
});

describe('drill engine', () => {
  it('generateDrill is deterministic per seed and differs across seeds', () => {
    for (const topic of QUIZ_TOPICS) {
      const a = generateDrill({ topic, length: 10 }, 3, 'child|quest|2026-W44|1');
      const b = generateDrill({ topic, length: 10 }, 3, 'child|quest|2026-W44|1');
      const c = generateDrill({ topic, length: 10 }, 3, 'child|quest|2026-W44|2');
      expect(a).toEqual(b);
      expect(a).toHaveLength(10);
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    }
  });
  it('avoids repeating a question within one drill', () => {
    for (let i = 0; i < 20; i++) {
      const qs = generateDrill({ topic: 'times-tables', length: 10 }, 3, `s${i}`);
      expect(new Set(qs.map((q) => JSON.stringify(q.prompt))).size).toBe(10);
    }
  });
  it('en-mix includes a match round', () => {
    const qs = generateDrill({ topic: 'en-mix', length: 10 }, 2, 'x');
    expect(qs.some((q) => q.type === 'match')).toBe(true);
  });
  it('checkAnswer / scoreDrill', () => {
    const qs = generateDrill({ topic: 'math-mix', length: 10 }, 4, 'seed');
    const perfect = qs.map(correctResponse);
    expect(scoreDrill(qs, perfect)).toMatchObject({ correct: 10, total: 10 });
    const someWrong = perfect.map((r, i) => (i < 3 ? ({ skipped: true } as const) : r));
    const s = scoreDrill(qs, someWrong);
    expect(s.correct).toBe(7);
    expect(s.results.slice(0, 3)).toEqual([false, false, false]);
    expect(scoreDrill(qs, [])).toMatchObject({ correct: 0 });
    const num = qs.find((q) => q.type === 'numeric');
    if (num && num.type === 'numeric') {
      expect(checkAnswer(num, { value: ` ${num.answer} ` })).toBe(true);
      expect(checkAnswer(num, { value: String(num.answer + 1) })).toBe(false);
      expect(checkAnswer(num, { value: '' })).toBe(false);
      expect(checkAnswer(num, { choice: 0 })).toBe(false);
    }
    expect(parseNumber('3,5')).toBe(3.5);
    expect(parseNumber('−4')).toBe(-4);
    expect(parseNumber('abc')).toBeNull();
    expect(defaultPassScore(10)).toBe(8);
  });
});

describe('guided templates', () => {
  it('≈5 templates per group with clear criteria and unique ids', () => {
    for (const g of ['sport', 'music', 'soft', 'any'] as const) expect(GUIDED_TEMPLATES.filter((t) => t.group === g).length).toBeGreaterThanOrEqual(5);
    expect(new Set(GUIDED_TEMPLATES.map((t) => t.id)).size).toBe(GUIDED_TEMPLATES.length);
    GUIDED_TEMPLATES.forEach((t) => {
      expect(t.steps.length).toBeGreaterThanOrEqual(2);
      expect(t.criteria.length).toBeGreaterThan(5);
      expect(new Set(t.steps.map((s) => s.id)).size).toBe(t.steps.length);
    });
    const jr = GUIDED_TEMPLATES.find((t) => t.id === 'sport-jump-rope')!;
    expect(jr.steps.filter((s) => s.timerSec === 30)).toHaveLength(3);
    expect(templatesForGroup('music')[0].group).toBe('music');
    expect(templatesForGroup('any').every((t) => t.group === 'any')).toBe(true);
  });
});
