import { gcd } from './rng';
import { F, ITEMS, M, NAMES, OPS, T, choice, numeric } from './content';
import type { ChoiceQuestion, Question, Rng, Seg } from './types';

/**
 * Math generators. Every generator takes (rng, level 1..5) and returns one question.
 * Difficulty ranges per level are documented next to each generator and asserted in tests.
 */
type Gen = (rng: Rng, level: number, id: string) => Question;

const CM = 'ס״מ';
const CM2 = 'סמ״ר';

// ---------------------------------------------------------------- times tables
/** Factor ranges per level: L1 1–5 × 1–10 · L2 2–10 × 1–10 · L3 2–12 × 2–12 · L4 3–12 (missing factor) · L5 6–15 (and division). */
export const TIMES_RANGES: Record<number, { a: [number, number]; b: [number, number] }> = {
  1: { a: [1, 5], b: [1, 10] },
  2: { a: [2, 10], b: [1, 10] },
  3: { a: [2, 12], b: [2, 12] },
  4: { a: [3, 12], b: [3, 12] },
  5: { a: [6, 15], b: [2, 12] },
};

export function timesTable(rng: Rng, level: number, id: string, table?: number): Question {
  const r = TIMES_RANGES[level];
  const a = table ?? rng.int(...r.a);
  const b = table ? rng.int(1, level <= 2 ? 10 : 12) : rng.int(...r.b);
  const p = a * b;
  const roll = rng.next();
  const form = level >= 5 && roll < 0.35 ? 'div' : level >= 4 && roll < 0.65 ? 'missing' : 'mul';
  if (form === 'div')
    return numeric(id, [T('כמה זה'), M(`${p} ÷ ${a} = ?`)], b, [M(`${p} ÷ ${a} = ${b}`)], { a, b, form, expr: `${p}/${a}` });
  if (form === 'missing')
    return numeric(id, [T('איזה מספר חסר?'), M(`${a} × ? = ${p}`)], b, [M(`${a} × ${b} = ${p}`)], { a, b, form, expr: `${p}/${a}` });
  // Show the table number first ("7 × 4") like a times-table chart.
  return numeric(id, [T('כמה זה'), M(`${a} × ${b} = ?`)], p, [M(`${a} × ${b} = ${p}`)], { a, b, form, expr: `${a}*${b}` });
}

// ---------------------------------------------------------------- mental math
/** L1 ± within 20 · L2 ± within 100 · L3 ± within 1000, 1-digit × · L4 2-digit × 1-digit, exact ÷ · L5 order of operations, 2-digit × 2-digit. */
export const MENTAL_MAX: Record<number, number> = { 1: 20, 2: 100, 3: 1000, 4: 1000, 5: 2000 };

export function mentalMath(rng: Rng, level: number, id: string): Question {
  const show = (expr: string) => expr.replace(/[-*/]/g, (o) => OPS[o]).replace(/\s+/g, ' ');
  const q = (expr: string, value: number, meta: Record<string, number | string> = {}) =>
    numeric(id, [T('חשבו בראש:'), M(`${show(expr)} = ?`)], value, [M(`${show(expr)} = ${value}`)], { expr, ...meta });
  const addSub = (max: number) => {
    if (rng.next() < 0.5) {
      const a = rng.int(1, max - 1);
      const b = rng.int(1, max - a);
      return q(`${a} + ${b}`, a + b, { op: '+' });
    }
    const a = rng.int(2, max);
    const b = rng.int(1, a - 1);
    return q(`${a} - ${b}`, a - b, { op: '-' });
  };
  switch (level) {
    case 1:
      return addSub(20);
    case 2:
      return addSub(100);
    case 3: {
      if (rng.next() < 0.35) {
        const a = rng.int(2, 9), b = rng.int(2, 9);
        return q(`${a} * ${b}`, a * b, { op: '*' });
      }
      return addSub(1000);
    }
    case 4: {
      const roll = rng.next();
      if (roll < 0.4) {
        const a = rng.int(12, 49), b = rng.int(2, 9);
        return q(`${a} * ${b}`, a * b, { op: '*' });
      }
      if (roll < 0.75) {
        const b = rng.int(2, 9), ans = rng.int(2, 12);
        return q(`${b * ans} / ${b}`, ans, { op: '/' });
      }
      return addSub(1000);
    }
    default: {
      const roll = rng.next();
      if (roll < 0.35) {
        const a = rng.int(11, 25), b = rng.int(11, 19);
        return q(`${a} * ${b}`, a * b, { op: '*' });
      }
      if (roll < 0.7) {
        const a = rng.int(2, 12), b = rng.int(2, 12), c = rng.int(1, 50);
        return rng.next() < 0.5 ? q(`${c} + ${a} * ${b}`, c + a * b, { op: 'order' }) : q(`${a} * ${b} - ${Math.min(c, a * b)}`, a * b - Math.min(c, a * b), { op: 'order' });
      }
      const a = rng.int(2, 9), b = rng.int(2, 9), c = rng.int(2, 9);
      return q(`(${a} + ${b}) * ${c}`, (a + b) * c, { op: 'order' });
    }
  }
}

// ---------------------------------------------------------------- fractions
const fracSeg = (n: number, d: number): Seg[] => [F(n, d)];
const simplify = (n: number, d: number): [number, number] => {
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
};
/** Denominator ranges: L1 2–6 · L2 2–10 · L3 2–12 · L4 2–12 · L5 2–12. */
export const FRACTION_MAX_DEN: Record<number, number> = { 1: 6, 2: 10, 3: 12, 4: 12, 5: 12 };

function compareQ(id: string, n1: number, d1: number, n2: number, d2: number): ChoiceQuestion {
  const diff = n1 * d2 - n2 * d1;
  const sign = diff > 0 ? '>' : diff < 0 ? '<' : '=';
  const choices: Seg[][] = [[M('>')], [M('<')], [M('=')]];
  return {
    id,
    type: 'choice',
    prompt: [T('איזה סימן מתאים?'), { t: 'expr', parts: [F(n1, d1), M('?'), F(n2, d2)] }],
    choices,
    answerIndex: ['>', '<', '='].indexOf(sign),
    solution: [{ t: 'expr', parts: [F(n1, d1), M(sign), F(n2, d2)] }],
    meta: { kind: 'compare', n1, d1, n2, d2, sign },
  };
}

export function fractions(rng: Rng, level: number, id: string): Question {
  const maxD = FRACTION_MAX_DEN[level];
  const kinds: Record<number, string[]> = {
    1: ['shaded', 'compare-same'],
    2: ['shaded', 'compare', 'simplify'],
    3: ['compare', 'simplify', 'add-same', 'of-number'],
    4: ['simplify', 'add-multiple', 'of-number', 'compare'],
    5: ['add-lcm', 'sub-lcm', 'of-number', 'compare', 'simplify'],
  };
  const kind = rng.pick(kinds[level]);
  switch (kind) {
    case 'shaded': {
      const d = rng.int(2, Math.min(8, maxD)), n = rng.int(1, d - 1);
      const ds: Seg[][] = [fracSeg(d - n, d), fracSeg(n, d + 1), fracSeg(Math.max(1, n - 1) === n ? n + 1 : n - 1, d), fracSeg(n, Math.max(2, d - 1))];
      return choice(rng, id, [T('איזה חלק צבוע?')], fracSeg(n, d), ds, [F(n, d), T(`– ${n} מתוך ${d} חלקים צבועים`)], { kind, n, d }, { figure: { shape: 'fraction-bar', n, d } });
    }
    case 'compare-same': {
      const d = rng.int(3, maxD);
      const n1 = rng.int(1, d - 1);
      let n2 = rng.int(1, d - 1);
      if (n2 === n1 && rng.next() < 0.7) n2 = n1 === 1 ? 2 : n1 - 1;
      return compareQ(id, n1, d, n2, d);
    }
    case 'compare': {
      const d1 = rng.int(2, maxD), d2 = rng.int(2, maxD);
      const n1 = rng.int(1, d1 - 1), n2 = rng.int(1, d2 - 1);
      return compareQ(id, n1, d1, n2, d2);
    }
    case 'simplify': {
      const [bn, bd] = (() => {
        for (;;) {
          const d = rng.int(2, Math.min(6, maxD)), n = rng.int(1, d - 1);
          if (gcd(n, d) === 1) return [n, d];
        }
      })();
      const k = rng.int(2, level >= 4 ? 6 : 4);
      const n = bn * k, d = bd * k;
      const ds: Seg[][] = [fracSeg(n / k + 1, d / k), fracSeg(bn, bd + 1), fracSeg(n, d / k), fracSeg(Math.max(1, bn * 2), bd * 3)];
      return choice(rng, id, [T('מהו השבר המצומצם של'), F(n, d), T('?')], fracSeg(bn, bd), ds, [{ t: 'expr', parts: [F(n, d), M('='), F(bn, bd)] }], { kind, n, d, an: bn, ad: bd });
    }
    case 'add-same': {
      const d = rng.int(3, maxD), n1 = rng.int(1, d - 2), n2 = rng.int(1, d - n1 - 1 || 1);
      const sn = n1 + n2;
      const ds: Seg[][] = [fracSeg(sn, d * 2), fracSeg(sn + 1, d), fracSeg(Math.max(1, sn - 1), d), fracSeg(n1 * n2, d)];
      return choice(rng, id, [T('כמה זה'), { t: 'expr', parts: [F(n1, d), M('+'), F(n2, d), M('= ?')] }], fracSeg(sn, d), ds, [{ t: 'expr', parts: [F(n1, d), M('+'), F(n2, d), M('='), F(sn, d)] }], { kind, n1, d1: d, n2, d2: d, an: sn, ad: d });
    }
    case 'add-multiple':
    case 'add-lcm':
    case 'sub-lcm': {
      const d1 = rng.int(2, 6);
      let d2: number;
      if (kind === 'add-multiple') d2 = d1 * rng.int(2, 3);
      else do d2 = rng.int(2, 8); while (d2 === d1);
      const n1 = rng.int(1, d1 - 1), n2 = rng.int(1, d2 - 1);
      const sub = kind === 'sub-lcm' && n1 * d2 !== n2 * d1;
      const L = (d1 * d2) / gcd(d1, d2);
      let a = n1 * (L / d1), b = n2 * (L / d2);
      let [pn1, pd1, pn2, pd2] = [n1, d1, n2, d2];
      if (sub && a < b) {
        [a, b] = [b, a];
        [pn1, pd1, pn2, pd2] = [n2, d2, n1, d1];
      }
      const rn = sub ? a - b : a + b;
      const [sn, sd] = simplify(rn, L);
      const op = sub ? '−' : '+';
      const ds: Seg[][] = [fracSeg(sub ? Math.abs(pn1 - pn2) || 1 : pn1 + pn2, pd1 + pd2), fracSeg(sn + 1, sd), fracSeg(sn, sd + 1), fracSeg(rn + 1, L)];
      return choice(
        rng,
        id,
        [T('כמה זה'), { t: 'expr', parts: [F(pn1, pd1), M(op), F(pn2, pd2), M('= ?')] }],
        fracSeg(sn, sd),
        ds,
        [{ t: 'expr', parts: [F(pn1, pd1), M(op), F(pn2, pd2), M('='), F(rn, L), ...(sn !== rn ? [M('='), F(sn, sd)] : [])] }],
        { kind, n1: pn1, d1: pd1, n2: pn2, d2: pd2, op: sub ? '-' : '+', an: sn, ad: sd },
      );
    }
    default: {
      // of-number: n/d of (d × k)
      const d = rng.int(2, level >= 4 ? 10 : 5), k = rng.int(2, level >= 4 ? 12 : 6);
      let n = rng.int(1, d - 1);
      while (gcd(n, d) !== 1) n--;
      const whole = d * k;
      const name = rng.pick(NAMES).name;
      const item = rng.pick(ITEMS);
      return numeric(
        id,
        [T(`ל${name} יש ${whole} ${item}. כמה זה`), F(n, d), T(`מה${item}?`)],
        n * k,
        [F(n, d), T(`מ־${whole}:`), M(`${whole} ÷ ${d} × ${n} = ${n * k}`)],
        { kind: 'of-number', n, d, whole },
      );
    }
  }
}

// ---------------------------------------------------------------- geometry
/** Side lengths: L1 ≤ 10 · L2 ≤ 12 · L3 ≤ 20 · L4–5 ≤ 30. */
export const GEO_MAX_SIDE: Record<number, number> = { 1: 10, 2: 12, 3: 20, 4: 30, 5: 30 };
const POLY_NAMES: Record<number, string> = { 3: 'משולש', 4: 'מרובע', 5: 'מחומש', 6: 'משושה', 8: 'מתומן' };

export function geometry(rng: Rng, level: number, id: string): Question {
  const max = GEO_MAX_SIDE[level];
  const kinds: Record<number, string[]> = {
    1: ['sides', 'rect-perimeter'],
    2: ['rect-perimeter', 'rect-area', 'angle-type'],
    3: ['rect-area', 'right-tri-area', 'angle-type', 'rect-perimeter'],
    4: ['tri-area', 'missing-angle', 'rect-area', 'side-from-area'],
    5: ['missing-angle', 'tri-area', 'side-from-area', 'side-from-perimeter'],
  };
  const kind = rng.pick(kinds[level]);
  const w = rng.int(2, max), h = rng.int(2, max);
  switch (kind) {
    case 'sides': {
      const sides = rng.pick([3, 4, 5, 6, 8]);
      return numeric(id, [T('כמה צלעות יש לצורה?')], sides, [T(`ל${POLY_NAMES[sides]} יש ${sides} צלעות`)], { kind, sides }, { figure: { shape: 'polygon', sides } });
    }
    case 'rect-perimeter':
      return numeric(id, [T('מה ההיקף של המלבן?')], 2 * (w + h), [T('היקף ='), M(`${w} + ${h} + ${w} + ${h} = ${2 * (w + h)}`)], { kind, w, h }, { unit: CM, figure: { shape: 'rect', w, h, unit: CM } });
    case 'rect-area':
      return numeric(id, [T('מה השטח של המלבן?')], w * h, [T('שטח ='), M(`${w} × ${h} = ${w * h}`)], { kind, w, h }, { unit: CM2, figure: { shape: 'rect', w, h, unit: CM } });
    case 'right-tri-area':
    case 'tri-area': {
      let a = rng.int(2, max), b = rng.int(2, max);
      if ((a * b) % 2) a += a < max ? 1 : -1;
      const area = (a * b) / 2;
      const figure = kind === 'right-tri-area' ? ({ shape: 'right-triangle', a, b, unit: CM } as const) : ({ shape: 'triangle', base: a, height: b, unit: CM } as const);
      return numeric(id, [T('מה השטח של המשולש?')], area, [T('שטח ='), M(`${a} × ${b} ÷ 2 = ${area}`)], { kind, base: a, height: b }, { unit: CM2, figure });
    }
    case 'angle-type': {
      const deg = rng.pick([rng.int(20, 80), 90, rng.int(100, 160)]);
      const answer = deg < 90 ? 'חדה' : deg === 90 ? 'ישרה' : 'קהה';
      const opts = ['חדה', 'ישרה', 'קהה'];
      return {
        id,
        type: 'choice',
        prompt: [T('איזו זווית זו?')],
        figure: { shape: 'angle', deg },
        choices: opts.map((o) => [T(`זווית ${o}`)]),
        answerIndex: opts.indexOf(answer),
        solution: [T(`זווית של`), M(`${deg}°`), T(`היא זווית ${answer}`)],
        meta: { kind, deg, answer },
      };
    }
    case 'missing-angle': {
      const a = rng.int(25, 100), b = rng.int(20, 155 - a);
      const c = 180 - a - b;
      return numeric(id, [T('מה גודל הזווית החסרה במשולש? (סכום הזוויות במשולש הוא'), M('180°'), T(')')], c, [M(`180° − ${a}° − ${b}° = ${c}°`)], { kind, a, b }, { unit: 'מעלות', figure: { shape: 'triangle-angles', a, b } });
    }
    case 'side-from-area':
      return numeric(id, [T(`שטח המלבן הוא ${w * h} ${CM2} ואחת הצלעות היא ${w} ${CM}. מה אורך הצלע השנייה?`)], h, [M(`${w * h} ÷ ${w} = ${h}`)], { kind, w, h }, { unit: CM });
    default:
      // side-from-perimeter
      return numeric(id, [T(`היקף המלבן הוא ${2 * (w + h)} ${CM} ואחת הצלעות היא ${w} ${CM}. מה אורך הצלע השנייה?`)], h, [M(`(${2 * (w + h)} − 2 × ${w}) ÷ 2 = ${h}`)], { kind, w, h }, { unit: CM });
  }
}

// ---------------------------------------------------------------- word problems
const v = (g: 'm' | 'f', m: string, f: string) => (g === 'm' ? m : f);

/** Templates by level. Each returns prompt text, answer, the worked solution and the arithmetic (for tests). */
export function wordProblem(rng: Rng, level: number, id: string): Question {
  const p = rng.pick(NAMES);
  let other = rng.pick(NAMES);
  if (other.name === p.name) other = NAMES[(NAMES.indexOf(p) + 1) % NAMES.length];
  const item = rng.pick(ITEMS);
  const n = p.name, g = p.g;
  const out = (text: string, answer: number, expr: string, unit?: string) =>
    numeric(id, [T(text)], answer, [M(`${expr.replace(/[-*/]/g, (o) => OPS[o])} = ${answer}`)], { expr, template: text.slice(0, 12) }, unit ? { unit } : {});

  const pool: Record<number, (() => Question)[]> = {
    1: [
      () => {
        const a = rng.int(2, 12), b = rng.int(1, 20 - a);
        return out(`ל${n} היו ${a} ${item}. ${n} ${v(g, 'קיבל', 'קיבלה')} עוד ${b}. כמה ${item} יש ל${n} עכשיו?`, a + b, `${a} + ${b}`);
      },
      () => {
        const a = rng.int(5, 20), b = rng.int(1, a - 1);
        return out(`ל${n} היו ${a} ${item}. ${n} ${v(g, 'נתן', 'נתנה')} ${b} ל${other.name}. כמה ${item} נשארו ל${n}?`, a - b, `${a} - ${b}`);
      },
    ],
    2: [
      () => {
        const a = rng.int(2, 9), b = rng.int(2, 10);
        return out(`${n} ${v(g, 'קנה', 'קנתה')} ${a} שקיות, ובכל שקית יש ${b} ${item}. כמה ${item} יש בסך הכול?`, a * b, `${a} * ${b}`);
      },
      () => {
        const a = rng.int(20, 40), b = rng.int(3, a - 5);
        return out(`בכיתה יש ${a} תלמידים. ${b} מהם יצאו לחצר. כמה תלמידים נשארו בכיתה?`, a - b, `${a} - ${b}`);
      },
      () => {
        const a = rng.int(15, 60), b = rng.int(10, 39);
        return out(`ביום ראשון ${n} ${v(g, 'קרא', 'קראה')} ${a} עמודים וביום שני ${b} עמודים. כמה עמודים ${v(g, 'קרא', 'קראה')} ${n} ביומיים?`, a + b, `${a} + ${b}`);
      },
    ],
    3: [
      () => {
        const b = rng.int(2, 6), each = rng.int(2, 9);
        return out(`${n} ${v(g, 'חילק', 'חילקה')} ${b * each} ${item} שווה בשווה בין ${b} חברים. כמה ${item} קיבל כל חבר?`, each, `${b * each} / ${b}`);
      },
      () => {
        const k = rng.int(2, 5), price = rng.int(3, 9), extra = rng.int(1, 20);
        const money = k * price + extra;
        return out(`ל${n} היו ${money} ₪. ${n} ${v(g, 'קנה', 'קנתה')} ${k} מחברות, כל אחת ב־${price} ₪. כמה כסף נשאר?`, extra, `${money} - ${k} * ${price}`, '₪');
      },
    ],
    4: [
      () => {
        const x = rng.int(8, 35), y = rng.int(5, 30), bill = x + y <= 50 ? 50 : 100;
        return out(`${n} ${v(g, 'שילם', 'שילמה')} בשטר של ${bill} ₪ על ספר שעולה ${x} ₪ ועל משחק שעולה ${y} ₪. כמה עודף ${v(g, 'קיבל', 'קיבלה')} ${n}?`, bill - x - y, `${bill} - ${x} - ${y}`, '₪');
      },
      () => {
        const a = rng.int(8, 25), b = rng.int(3, 9);
        return out(`${n} ${v(g, 'קורא', 'קוראת')} ${a} עמודים בכל יום. כמה עמודים ${v(g, 'יקרא', 'תקרא')} ${n} ב־${b} ימים?`, a * b, `${a} * ${b}`);
      },
      () => {
        const per = rng.int(6, 12), groups = rng.int(3, 8), left = rng.int(1, per - 1);
        const total = per * groups + left;
        return out(`למסיבה הכינו ${total} ${item}. מסדרים אותם בצלחות, ${per} בכל צלחת. כמה צלחות מלאות יהיו?`, groups, `(${total} - ${left}) / ${per}`);
      },
    ],
    5: [
      () => {
        const a = rng.int(5, 25), b = rng.int(3, 12);
        return out(`${n} ${v(g, 'חוסך', 'חוסכת')} ${a} ₪ בכל שבוע. כמה שבועות צריך כדי לחסוך ${a * b} ₪?`, b, `${a * b} / ${a}`);
      },
      () => {
        const cap = rng.pick([20, 25, 30, 40, 50]), kids = rng.int(cap + 1, cap * 5);
        const buses = Math.ceil(kids / cap);
        return {
          ...out(`לטיול יוצאים ${kids} ילדים. בכל אוטובוס יש ${cap} מקומות. כמה אוטובוסים צריך לפחות?`, buses, `ceil(${kids} / ${cap})`),
          solution: [M(`${kids} ÷ ${cap} ≈ ${(kids / cap).toFixed(1)}`), T(`→ צריך ${buses} אוטובוסים`)],
        };
      },
      () => {
        const d = rng.pick([2, 3, 4, 5]), k = rng.int(4, 15), whole = d * k;
        let nn = rng.int(1, d - 1);
        while (gcd(nn, d) !== 1) nn--;
        return numeric(id, [T(`בקופסה יש ${whole} ${item}. ${n} ${v(g, 'לקח', 'לקחה')}`), F(nn, d), T(`מה${item}. כמה ${item} נשארו בקופסה?`)], whole - nn * k, [M(`${whole} − ${whole} ÷ ${d} × ${nn} = ${whole - nn * k}`)], { expr: `${whole} - ${whole} / ${d} * ${nn}`, template: 'fraction-left' });
      },
    ],
  };
  // Lower-level templates stay in the mix for variety.
  const choices = [...pool[level], ...(level > 1 ? pool[level - 1] : [])];
  return rng.pick(choices)();
}

export const MATH_GENERATORS: Record<string, Gen> = {
  'times-tables': (rng, l, id) => timesTable(rng, l, id),
  'mental-math': mentalMath,
  fractions,
  geometry,
  'word-problems': wordProblem,
};
