import { BLANK, E, EN, T, choice } from './content';
import { article, wordsForLevel, type Word } from './wordbank';
import type { BlankQuestion, MatchQuestion, Question, Rng, Seg } from './types';

/**
 * English for Hebrew speakers. All English text is an `en` segment, rendered dir="ltr" lang="en".
 */
function distractorWords(rng: Rng, w: Word, level: number, n = 3, samePos = true): Word[] {
  const pool = wordsForLevel(level).filter((x) => x.en !== w.en && x.he !== w.he && (!samePos || x.pos === w.pos || rng.next() < 0.3));
  const out: Word[] = [];
  for (const x of rng.shuffle(pool)) {
    if (out.some((o) => o.en === x.en)) continue;
    out.push(x);
    if (out.length >= n) break;
  }
  return out;
}

export function vocab(rng: Rng, level: number, id: string): Question {
  const w = rng.pick(wordsForLevel(level));
  const ds = distractorWords(rng, w, level);
  const form = rng.pick(level <= 1 ? ['pic-en', 'en-he', 'he-en'] : ['en-he', 'he-en', 'pic-en', 'he-en']);
  const meta = { form, en: w.en, he: w.he };
  if (form === 'en-he')
    return choice(rng, id, [T('מה פירוש המילה'), EN(w.en, true), T('?')], [T(w.he)], ds.map((d) => [T(d.he)]), [EN(w.en), T('='), T(w.he), E(w.emoji)], meta);
  if (form === 'he-en')
    return choice(rng, id, [T('איך אומרים באנגלית'), T(`״${w.he}״`), E(w.emoji), T('?')], [EN(w.en, true)], ds.map((d) => [EN(d.en, true)]), [T(w.he), T('='), EN(w.en)], meta);
  return choice(rng, id, [T('מה רואים בתמונה?'), E(w.emoji)], [EN(w.en, true)], ds.map((d) => [EN(d.en, true)]), [E(w.emoji), T('='), EN(w.en), T(`(${w.he})`)], meta);
}

/** Sentence pairs by level (English, Hebrew). */
export const SENTENCES: Record<number, [string, string][]> = {
  1: [
    ['I have a red ball.', 'יש לי כדור אדום.'],
    ['The cat is black.', 'החתול שחור.'],
    ['I see a big tree.', 'אני רואה עץ גדול.'],
    ['This is my house.', 'זה הבית שלי.'],
    ['The sun is yellow.', 'השמש צהובה.'],
    ['I like apples.', 'אני אוהב תפוחים.'],
  ],
  2: [
    ['My dog is happy.', 'הכלב שלי שמח.'],
    ['We go to school.', 'אנחנו הולכים לבית הספר.'],
    ['The book is on the table.', 'הספר על השולחן.'],
    ['I drink milk in the morning.', 'אני שותה חלב בבוקר.'],
    ['It is cold today.', 'קר היום.'],
  ],
  3: [
    ['She is reading a book.', 'היא קוראת ספר.'],
    ['He is playing football.', 'הוא משחק כדורגל.'],
    ['They are eating pizza.', 'הם אוכלים פיצה.'],
    ['The bird can fly.', 'הציפור יכולה לעוף.'],
    ['My sister has a new bicycle.', 'לאחותי יש אופניים חדשים.'],
  ],
  4: [
    ['We are going to the beach tomorrow.', 'אנחנו הולכים לחוף מחר.'],
    ['Can you help me, please?', 'אתה יכול לעזור לי, בבקשה?'],
    ['My brother is taller than me.', 'אחי גבוה ממני.'],
    ['I usually walk to school.', 'בדרך כלל אני הולך ברגל לבית הספר.'],
    ['There are three apples in the bag.', 'יש שלושה תפוחים בתיק.'],
  ],
  5: [
    ['Yesterday we went to the museum.', 'אתמול הלכנו למוזיאון.'],
    ['I have never seen a volcano.', 'אף פעם לא ראיתי הר געש.'],
    ['If it rains, we will stay home.', 'אם ירד גשם, נישאר בבית.'],
    ['She was tired, so she went to sleep.', 'היא הייתה עייפה, אז היא הלכה לישון.'],
  ],
};

const sentencesUpTo = (level: number) => Object.entries(SENTENCES).flatMap(([l, s]) => (Number(l) <= level ? s : []));

export function sentences(rng: Rng, level: number, id: string): Question {
  const pool = sentencesUpTo(level);
  const roll = rng.next();
  if (roll < 0.25) {
    // Picture sentence: "I see a/an …"
    const w = rng.pick(wordsForLevel(level).filter(countable));
    const ds = rng.shuffle(wordsForLevel(level).filter((d) => countable(d) && d.en !== w.en && d.emoji !== w.emoji)).filter((d, i, all) => all.findIndex((x) => x.en === d.en) === i).slice(0, 3);
    const s = (x: Word) => `I see ${article(x.en)} ${x.en}.`;
    return choice(rng, id, [T('איזה משפט מתאים לתמונה?'), E(w.emoji)], [EN(s(w), true)], ds.map((d) => [EN(s(d), true)]), [E(w.emoji), EN(s(w))], { form: 'picture', en: s(w) });
  }
  const [en, he] = rng.pick(pool);
  const others = rng.shuffle(pool.filter(([e]) => e !== en)).slice(0, 3);
  if (roll < 0.6)
    return choice(rng, id, [T('מה פירוש המשפט?'), EN(en, true)], [T(he)], others.map(([, h]) => [T(h)]), [EN(en), T('='), T(he)], { form: 'en-he', en });
  return choice(rng, id, [T('איך אומרים באנגלית:'), T(`״${he}״`)], [EN(en, true)], others.map(([e]) => [EN(e, true)]), [T(he), T('='), EN(en)], { form: 'he-en', en });
}

// ---------------------------------------------------------------- fill in the blank
interface FillItem {
  before: string;
  after: string;
  answer: string;
  options: string[];
  hint?: string;
  emoji?: string;
}

const SUBJECTS_BE: [string, string][] = [
  ['I', 'am'],
  ['You', 'are'],
  ['He', 'is'],
  ['She', 'is'],
  ['It', 'is'],
  ['We', 'are'],
  ['They', 'are'],
];
const ADJ_BE = ['happy', 'tired', 'hungry', 'at home', 'in the garden', 'ready'];

const PREPS: { before: string; after: string; answer: string }[] = [
  { before: 'The cat is', after: 'the box.', answer: 'in' },
  { before: 'The book is', after: 'the table.', answer: 'on' },
  { before: 'We go', after: 'school every day.', answer: 'to' },
  { before: 'The party is', after: '5 o’clock.', answer: 'at' },
  { before: 'My birthday is', after: 'May.', answer: 'in' },
  { before: 'The picture is', after: 'the wall.', answer: 'on' },
];
const ING: [string, string, string][] = [
  ['She is', 'swim', 'swimming'],
  ['They are', 'run', 'running'],
  ['He is', 'read', 'reading'],
  ['We are', 'dance', 'dancing'],
  ['I am', 'write', 'writing'],
  ['The baby is', 'sleep', 'sleeping'],
];
const PAST: [string, string, string, string, string[]][] = [
  ['Yesterday I', 'to the park.', 'go', 'went', ['goed', 'gone', 'go']],
  ['Last week we', 'a funny movie.', 'see', 'saw', ['seed', 'seen', 'see']],
  ['Yesterday she', 'a sandwich.', 'eat', 'ate', ['eated', 'eaten', 'eat']],
  ['Last night they', 'football.', 'play', 'played', ['plaied', 'play', 'plays']],
  ['This morning he', 'a glass of milk.', 'drink', 'drank', ['drinked', 'drunk', 'drink']],
  ['Yesterday I', 'a letter.', 'write', 'wrote', ['writed', 'written', 'write']],
];

/** Nouns that read oddly with "a/an" (mass nouns, unique things). */
const NOT_COUNTABLE = ['water', 'milk', 'bread', 'rice', 'cheese', 'snow', 'rain', 'weather', 'grapes', 'sea', 'sun', 'moon', 'foot'];
const countable = (w: Word) => w.pos === 'n' && !NOT_COUNTABLE.includes(w.en);

function fillItem(rng: Rng, level: number): FillItem {
  const kinds = ['article', 'vocab', ...(level >= 2 ? ['be', 'plural'] : []), ...(level >= 3 ? ['have', 'prep'] : []), ...(level >= 4 ? ['ing'] : []), ...(level >= 5 ? ['past'] : [])];
  const kind = rng.pick(kinds);
  switch (kind) {
    case 'article': {
      const w = rng.pick(wordsForLevel(level).filter(countable));
      return { before: 'This is', after: `${w.en}.`, answer: article(w.en), options: ['a', 'an'], emoji: w.emoji };
    }
    case 'vocab': {
      const w = rng.pick(wordsForLevel(level).filter((x) => x.pos === 'n'));
      const ds = rng.shuffle(wordsForLevel(level).filter((x) => x.pos === 'n' && x.en !== w.en)).slice(0, 2);
      return { before: 'I can see the', after: '.', answer: w.en, options: [w.en, ...ds.map((d) => d.en)], emoji: w.emoji, hint: w.he };
    }
    case 'be': {
      const [s, be] = rng.pick(SUBJECTS_BE);
      return { before: s, after: `${rng.pick(ADJ_BE)}.`, answer: be, options: ['am', 'is', 'are'] };
    }
    case 'plural': {
      const w = rng.pick(wordsForLevel(level).filter((x) => x.pos === 'n' && /^[a-z]+$/.test(x.en) && !/(s|sh|ch|x|y|o)$/.test(x.en) && !['foot', 'fish', 'water', 'milk', 'bread', 'rice', 'cheese', 'snow', 'rain', 'weather', 'grapes', 'teacher'].includes(x.en)));
      const n = rng.pick(['two', 'three', 'four', 'five']);
      return { before: `I have ${n}`, after: '.', answer: `${w.en}s`, options: [`${w.en}s`, w.en, `${w.en}es`], emoji: w.emoji };
    }
    case 'have': {
      const [s, form] = rng.pick<[string, string]>([
        ['I', 'have'],
        ['She', 'has'],
        ['We', 'have'],
        ['He', 'has'],
        ['They', 'have'],
        ['My dog', 'has'],
      ]);
      return { before: s, after: rng.pick(['a new bag.', 'two cats.', 'a big house.', 'a red pen.']), answer: form, options: ['have', 'has'] };
    }
    case 'prep': {
      const p = rng.pick(PREPS);
      return { ...p, options: ['in', 'on', 'at', 'to'] };
    }
    case 'ing': {
      const [b, base, ans] = rng.pick(ING);
      return { before: b, after: 'now.', answer: ans, options: [ans, `${base}s`, base], hint: base };
    }
    default: {
      const [b, after, base, ans, wrong] = rng.pick(PAST);
      return { before: b, after, answer: ans, options: [ans, ...wrong.filter((x) => x !== ans).slice(0, 2)], hint: base };
    }
  }
}

export function fill(rng: Rng, level: number, id: string): BlankQuestion {
  const it = fillItem(rng, level);
  const options = rng.shuffle([...new Set(it.options)]);
  const sentence = (gap: Seg): Seg[] => [EN(it.before), gap, EN(it.after)];
  const prompt: Seg[] = [T('השלימו את המשפט:'), ...(it.emoji ? [E(it.emoji)] : []), ...(it.hint ? [T(`(${it.hint})`)] : [])];
  const full = `${it.before} ${it.answer}${it.after.startsWith('.') ? '' : ' '}${it.after}`;
  return {
    id,
    type: 'blank',
    prompt: [...prompt, { t: 'expr', parts: sentence(BLANK) }],
    choices: options.map((o) => [EN(o)]),
    answerIndex: options.indexOf(it.answer),
    solution: [EN(full, true)],
    meta: { answer: it.answer, sentence: full },
  };
}

export function matchPairs(rng: Rng, level: number, id: string): MatchQuestion {
  const words: Word[] = [];
  for (const w of rng.shuffle(wordsForLevel(level))) {
    if (words.some((x) => x.en === w.en || x.he === w.he)) continue;
    words.push(w);
    if (words.length === 4) break;
  }
  const order = rng.shuffle([0, 1, 2, 3]);
  // left[i] (English) matches right[answer[i]] (Hebrew).
  const right = order.map((i) => [T(words[i].he)]);
  const answer = words.map((_, i) => order.indexOf(i));
  return {
    id,
    type: 'match',
    prompt: [T('התאימו כל מילה באנגלית לפירוש שלה')],
    left: words.map((w) => [EN(w.en, true)]),
    right,
    answer,
    solution: words.flatMap((w) => [EN(w.en), T(`= ${w.he}`)]),
    meta: { words: words.map((w) => w.en).join(',') },
  };
}

export const ENGLISH_GENERATORS = {
  'en-vocab': vocab,
  'en-sentences': sentences,
  'en-fill': fill,
};
