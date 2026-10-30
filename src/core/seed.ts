import type { AppState, Quest, SkillCategory } from './model/types';
import type { Ctx } from './services/context';
import { DEFAULT_LEVEL_CURVE } from './services/levels';
import { weekIdOf } from './services/week';

const DEFAULT_CATEGORIES: Omit<SkillCategory, 'order'>[] = [
  { id: 'cat-math', name: 'חשבון', icon: '🔢', colorKey: 'sky', enabled: true, builtIn: true },
  { id: 'cat-lang', name: 'שפות', icon: '📚', colorKey: 'grape', enabled: true, builtIn: true },
  { id: 'cat-soft', name: 'כישורים חברתיים', icon: '🤝', colorKey: 'mint', enabled: true, builtIn: true },
  { id: 'cat-sport', name: 'ספורט', icon: '⚽', colorKey: 'coral', enabled: true, builtIn: true },
  { id: 'cat-music', name: 'מוזיקה', icon: '🎵', colorKey: 'sun', enabled: true, builtIn: true },
];

const q = (id: string, categoryId: string, title: string, description: string, shekels: number, xp: number): Quest => ({
  id,
  categoryId,
  title,
  description,
  reward: shekels * 100,
  xp,
  active: true,
});

const DEMO_QUESTS: Quest[] = [
  q('q-math-1', 'cat-math', 'לוח הכפל של 7', 'לתרגל את לוח הכפל של 7 ולענות נכון על 10 שאלות ברצף.', 5, 20),
  q('q-math-2', 'cat-math', 'בעיות מילוליות', 'לפתור 5 בעיות מילוליות מחוברת העבודה.', 4, 15),
  q('q-math-3', 'cat-math', 'חשבון בסופר', 'לחשב בעל־פה את הסכום של 4 מוצרים בקנייה הבאה.', 3, 10),
  q('q-lang-1', 'cat-lang', '10 מילים באנגלית', 'ללמוד 10 מילים חדשות באנגלית ולהשתמש בכל אחת במשפט.', 5, 20),
  q('q-lang-2', 'cat-lang', 'קריאת פרק בספר', 'לקרוא פרק שלם בספר ולספר עליו בשלושה משפטים.', 4, 15),
  q('q-soft-1', 'cat-soft', 'לעזור בלי שביקשו', 'לעזור למישהו בבית בלי שביקשו ממך.', 3, 10),
  q('q-soft-2', 'cat-soft', 'שיחה עם סבא וסבתא', 'להתקשר לסבא או לסבתא ולשאול אותם שלוש שאלות.', 3, 10),
  q('q-sport-1', 'cat-sport', '20 דקות ריצה', 'לרוץ או לרכוב על אופניים 20 דקות ברצף.', 4, 15),
  q('q-sport-2', 'cat-sport', 'קפיצה בחבל', 'לקפוץ 50 קפיצות בחבל בלי לעצור.', 3, 10),
  q('q-music-1', 'cat-music', 'אימון נגינה', 'להתאמן על הכלי 15 דקות ביום, שלושה ימים השבוע.', 6, 25),
  q('q-music-2', 'cat-music', 'שיר חדש', 'ללמוד לשיר או לנגן שיר חדש מההתחלה עד הסוף.', 5, 20),
];

/**
 * Clean start for real use: no children yet, `onboarded: false` → the app shows the onboarding wizard
 * (family name, children, budgets, first deposit, PIN). Default categories + starter quests included.
 */
export function createFreshState(ctx: Ctx): AppState {
  const s = createEmptyState(ctx);
  return { ...s, family: { ...s.family, children: [], onboarded: false }, budgets: [] };
}

/** One-child blank family (used as a unit-test fixture). */
export function createEmptyState(ctx: Ctx): AppState {
  return {
    schemaVersion: 1,
    family: {
      id: 'family-1',
      name: 'המשפחה שלי',
      parents: [{ id: 'parent-1', name: 'הורה' }],
      children: [{ id: 'child-1', name: 'ילד/ה', avatar: '🧒' }],
      settings: { levelCurve: DEFAULT_LEVEL_CURVE, unspentPolicy: 'rollover', weekStartsOn: 0 },
    },
    categories: DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })),
    quests: DEMO_QUESTS,
    completions: [],
    budgets: [{ childId: 'child-1', amount: 3000 }],
    ledger: [],
    progress: [],
    currentWeekId: weekIdOf(ctx.now(), 0),
  };
}

/** Demo family with two children, a custom category, deposits and pending approvals. */
export function createDemoState(ctx: Ctx): AppState {
  const now = ctx.now();
  const weekId = weekIdOf(now, 0);
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString();
  return {
    schemaVersion: 1,
    family: {
      id: 'family-demo',
      name: 'משפחת דמו (בדיונית)',
      parents: [{ id: 'parent-1', name: 'הורה לדוגמה' }],
      children: [
        { id: 'child-star', name: 'כוכבית', avatar: '🌟' },
        { id: 'child-bear', name: 'דובון', avatar: '🐻' },
      ],
      settings: { levelCurve: DEFAULT_LEVEL_CURVE, unspentPolicy: 'rollover', weekStartsOn: 0 },
    },
    categories: [
      ...DEFAULT_CATEGORIES.map((c, i) => ({ ...c, order: i })),
      { id: 'cat-chess', name: 'שחמט', icon: '♟️', colorKey: 'slate', enabled: true, builtIn: false, order: 5 },
      { id: 'cat-cooking', name: 'בישול', icon: '🍳', colorKey: 'rose', enabled: false, builtIn: false, order: 6 },
    ],
    quests: [
      ...DEMO_QUESTS,
      q('q-chess-1', 'cat-chess', 'פתרון 3 חידות שחמט', 'לפתור 3 חידות "מט בשני מסעים".', 4, 20),
      q('q-cook-1', 'cat-cooking', 'להכין סלט', 'להכין סלט ירקות לארוחת ערב (בעזרת מבוגר).', 4, 15),
    ],
    completions: [
      { id: 'cmp-1', questId: 'q-math-1', childId: 'child-star', weekId, status: 'approved', submittedAt: at(300), decidedAt: at(240), reward: 500, xp: 20, celebrated: true },
      { id: 'cmp-2', questId: 'q-lang-1', childId: 'child-star', weekId, status: 'submitted', submittedAt: at(90), reward: 500, xp: 20 },
      { id: 'cmp-3', questId: 'q-music-1', childId: 'child-star', weekId, status: 'submitted', submittedAt: at(30), reward: 600, xp: 25 },
      { id: 'cmp-4', questId: 'q-sport-1', childId: 'child-bear', weekId, status: 'submitted', submittedAt: at(60), reward: 400, xp: 15 },
      { id: 'cmp-5', questId: 'q-soft-1', childId: 'child-bear', weekId, status: 'rejected', submittedAt: at(200), decidedAt: at(180), reward: 300, xp: 10, note: 'ננסה שוב מחר 🙂' },
    ],
    budgets: [
      { childId: 'child-star', amount: 5000 },
      { childId: 'child-bear', amount: 3000 },
    ],
    ledger: [
      { id: 'led-1', childId: 'child-star', type: 'deposit', amount: 5000, weekId, at: at(600), note: 'דמי כיס שבועיים' },
      { id: 'led-2', childId: 'child-star', type: 'unlock', amount: 500, weekId, at: at(240), ref: 'cmp-1' },
      { id: 'led-3', childId: 'child-bear', type: 'deposit', amount: 200, weekId, at: at(500), note: 'הפקדה חלקית' },
    ],
    progress: [
      { childId: 'child-star', categoryId: 'cat-math', startLevel: 3, xp: 50 },
      { childId: 'child-star', categoryId: 'cat-music', startLevel: 2, xp: 60 },
      { childId: 'child-star', categoryId: 'cat-lang', startLevel: 1, xp: 35 },
      { childId: 'child-bear', categoryId: 'cat-sport', startLevel: 2, xp: 20 },
    ],
    currentWeekId: weekId,
  };
}
