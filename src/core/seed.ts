import type { AppState, DrillSpec, Quest, QuizTopic, SkillCategory } from './model/types';
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

const q = (id: string, categoryId: string, title: string, description: string, shekels: number, xp: number, drill?: DrillSpec): Quest => ({
  id,
  categoryId,
  title,
  description,
  reward: shekels * 100,
  xp,
  active: true,
  ...(drill ? { drill } : {}),
});

const quiz = (topic: QuizTopic, length: number, passScore: number, autoApprove = true, table?: number): DrillSpec => ({
  kind: 'quiz',
  topic,
  length,
  passScore,
  autoApprove,
  ...(table ? { table } : {}),
});
const guided = (templateId: string): DrillSpec => ({ kind: 'guided', templateId });

/** Starter quests. Ids are stable: `migrateState` uses them to upgrade data saved by older versions. */
export const DEMO_QUESTS: Quest[] = [
  q('q-math-1', 'cat-math', 'לוח הכפל של 7', '10 שאלות בלוח הכפל של 7. עוברים עם 8 תשובות נכונות – והכסף משתחרר מיד.', 5, 20, quiz('times-tables', 10, 8, true, 7)),
  q('q-math-2', 'cat-math', 'בעיות מילוליות', '5 בעיות מילוליות מחיי היום־יום. צריך 4 נכונות כדי לעבור.', 4, 15, quiz('word-problems', 5, 4)),
  q('q-math-3', 'cat-math', 'חשבון בראש', '10 תרגילי חשבון בעל־פה: חיבור, חיסור, כפל וחילוק. צריך 8 נכונות.', 3, 10, quiz('mental-math', 10, 8)),
  q('q-math-4', 'cat-math', 'שברים', 'משווים, מצמצמים ומחברים שברים. 8 שאלות, צריך 6 נכונות.', 4, 15, quiz('fractions', 8, 6)),
  q('q-math-5', 'cat-math', 'גאומטריה: היקף, שטח וזוויות', '8 שאלות עם צורות: היקף, שטח וזוויות. צריך 6 נכונות.', 4, 15, quiz('geometry', 8, 6)),
  q('q-lang-1', 'cat-lang', '10 מילים באנגלית', '10 שאלות אוצר מילים באנגלית עם תמונות. צריך 8 נכונות, ואז ההורה מאשר.', 5, 20, quiz('en-vocab', 10, 8, false)),
  q('q-lang-2', 'cat-lang', 'קריאת פרק בספר', 'לקרוא פרק שלם בספר ולספר עליו בשלושה משפטים.', 4, 15, guided('lang-read-chapter')),
  q('q-lang-3', 'cat-lang', 'משפטים באנגלית', '8 משפטים פשוטים באנגלית – מה הם אומרים? צריך 6 נכונות.', 4, 15, quiz('en-sentences', 8, 6)),
  q('q-lang-4', 'cat-lang', 'השלמת משפטים באנגלית', 'בוחרים את המילה החסרה במשפט. 8 שאלות, צריך 6 נכונות.', 4, 15, quiz('en-fill', 8, 6)),
  q('q-lang-5', 'cat-lang', 'אתגר אנגלית', 'מילים, משפטים והתאמת זוגות. 10 שאלות, צריך 8 נכונות.', 5, 20, quiz('en-mix', 10, 8)),
  q('q-soft-1', 'cat-soft', 'לעזור בלי שביקשו', 'לעזור למישהו בבית בלי שביקשו ממך, ולספר במה עזרת.', 3, 10, guided('soft-help-unasked')),
  q('q-soft-2', 'cat-soft', 'שיחה עם סבא או סבתא', 'להתקשר לסבא או לסבתא ולשאול אותם שלוש שאלות.', 3, 10, guided('soft-call-family')),
  q('q-soft-3', 'cat-soft', 'עריכת שולחן לארוחה', 'לעזור לערוך את השולחן ולספר מה עשית.', 3, 10, guided('soft-set-table')),
  q('q-sport-1', 'cat-sport', '20 דקות ריצה', 'ריצה קלה של 20 דקות עם חימום ומתיחות. יש טיימר.', 4, 15, guided('sport-run-20')),
  q('q-sport-2', 'cat-sport', 'קפיצה בחבל', '3 סבבים של 30 שניות קפיצה בחבל, עם טיימר.', 3, 10, guided('sport-jump-rope')),
  q('q-sport-3', 'cat-sport', 'פלאנק', '3 החזקות פלאנק של 20 שניות.', 3, 10, guided('sport-plank')),
  q('q-music-1', 'cat-music', 'אימון נגינה', 'אימון של 15 דקות: חימום, קטע קשה ונגינה לסיום.', 6, 25, guided('music-practice-15')),
  q('q-music-2', 'cat-music', 'שיר חדש', 'ללמוד לשיר או לנגן שיר חדש מההתחלה עד הסוף.', 5, 20, guided('music-new-song')),
  q('q-music-3', 'cat-music', 'תרגול סולם', '10 דקות תרגול סולם עם טיימר, ובסוף סולם אחד נקי.', 4, 15, guided('music-scale')),
];

/** Drills for the demo's custom categories. */
export const DEMO_CUSTOM_QUESTS: Quest[] = [
  q('q-chess-1', 'cat-chess', 'פתרון 3 חידות שחמט', 'לפתור 3 חידות "מט בשני מסעים" ולהסביר אחת מהן.', 4, 20, guided('any-puzzles')),
  q('q-cook-1', 'cat-cooking', 'להכין סלט', 'להכין סלט ירקות לארוחת ערב (בעזרת מבוגר).', 4, 15, guided('any-cook')),
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
    drillAttempts: [],
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
      ...DEMO_CUSTOM_QUESTS,
    ],
    completions: [
      { id: 'cmp-1', questId: 'q-math-1', childId: 'child-star', weekId, status: 'approved', submittedAt: at(300), decidedAt: at(240), reward: 500, xp: 20, celebrated: true },
      { id: 'cmp-2', questId: 'q-lang-1', childId: 'child-star', weekId, status: 'submitted', submittedAt: at(90), reward: 500, xp: 20, drill: { attemptId: 'att-demo-2', correct: 9, total: 10 } },
      { id: 'cmp-3', questId: 'q-music-1', childId: 'child-star', weekId, status: 'submitted', submittedAt: at(30), reward: 600, xp: 25, guided: { templateId: 'music-practice-15', stepsDone: 3, stepsTotal: 3, note: 'עבדתי על הפזמון עד שיצא בלי טעויות' } },
      { id: 'cmp-4', questId: 'q-sport-1', childId: 'child-bear', weekId, status: 'submitted', submittedAt: at(60), reward: 400, xp: 15, guided: { templateId: 'sport-run-20', stepsDone: 4, stepsTotal: 4 } },
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
    drillAttempts: [
      { id: 'att-demo-1', childId: 'child-star', questId: 'q-lang-1', weekId, attempt: 1, seed: `child-star|q-lang-1|${weekId}|1`, level: 1, topic: 'en-vocab', total: 10, correct: 6, passScore: 8, passed: false, finishedAt: at(110), results: [true, true, false, true, false, true, true, false, true, false] },
      { id: 'att-demo-2', childId: 'child-star', questId: 'q-lang-1', weekId, attempt: 2, seed: `child-star|q-lang-1|${weekId}|2`, level: 1, topic: 'en-vocab', total: 10, correct: 9, passScore: 8, passed: true, finishedAt: at(90), results: [true, true, true, true, true, false, true, true, true, true], completionId: 'cmp-2' },
    ],
    currentWeekId: weekId,
  };
}
