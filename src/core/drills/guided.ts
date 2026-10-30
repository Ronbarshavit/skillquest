/**
 * Guided activities: real-world tasks (sport, music, soft skills…) broken into steps the child ticks off,
 * with optional timers and a short "tell what you did" note. The parent approves the result.
 */
export type GuidedGroup = 'sport' | 'music' | 'soft' | 'lang' | 'any';

export interface GuidedStep {
  id: string;
  text: string;
  /** Optional countdown for this step, in seconds. */
  timerSec?: number;
}

export interface GuidedTemplate {
  id: string;
  group: GuidedGroup;
  title: string;
  emoji: string;
  intro: string;
  steps: GuidedStep[];
  /** What counts as done — shown to child and parent. */
  criteria: string;
  /** When set, the child must write a short note before sending. */
  reflect?: string;
  /** What the parent should check before approving. */
  parentCheck: string;
}

const steps = (...xs: (string | [string, number])[]): GuidedStep[] =>
  xs.map((x, i) => (typeof x === 'string' ? { id: `s${i + 1}`, text: x } : { id: `s${i + 1}`, text: x[0], timerSec: x[1] }));

export const GUIDED_TEMPLATES: readonly GuidedTemplate[] = [
  // ---------------------------------------------------------------- sport
  {
    id: 'sport-jump-rope',
    group: 'sport',
    title: 'קפיצה בחבל',
    emoji: '🪢',
    intro: 'שלושה סבבים של 30 שניות, עם מנוחה קצרה ביניהם.',
    steps: steps('חימום: 10 קפיצות במקום', ['סבב 1 – קופצים 30 שניות', 30], ['מנוחה', 20], ['סבב 2 – קופצים 30 שניות', 30], ['מנוחה', 20], ['סבב 3 – קופצים 30 שניות', 30]),
    criteria: '3 סבבים של 30 שניות קפיצה',
    reflect: 'כמה קפיצות הצלחת בסבב הכי טוב?',
    parentCheck: 'ראיתם לפחות סבב אחד, או שהספירה נשמעת הגיונית',
  },
  {
    id: 'sport-run-20',
    group: 'sport',
    title: 'ריצה של 20 דקות',
    emoji: '🏃',
    intro: 'ריצה קלה בקצב שאפשר לדבר בו. מותר ללכת קצת באמצע.',
    steps: steps('שותים מים ונועלים נעלי ספורט', ['חימום – הליכה מהירה 3 דקות', 180], ['ריצה קלה – 20 דקות', 1200], ['מתיחות – 2 דקות', 120]),
    criteria: '20 דקות של ריצה קלה (מותר הפסקות הליכה)',
    parentCheck: 'הריצה הייתה עם מבוגר או במקום מוסכם',
  },
  {
    id: 'sport-plank',
    group: 'sport',
    title: 'פלאנק',
    emoji: '💪',
    intro: 'גוף ישר כמו קרש, על האמות ועל קצות האצבעות.',
    steps: steps(['פלאנק 1 – 20 שניות', 20], ['מנוחה', 30], ['פלאנק 2 – 20 שניות', 20], ['מנוחה', 30], ['פלאנק 3 – 20 שניות', 20]),
    criteria: '3 החזקות של 20 שניות בגוף ישר',
    parentCheck: 'הגב נשאר ישר',
  },
  {
    id: 'sport-ball-skills',
    group: 'sport',
    title: 'שליטה בכדור',
    emoji: '⚽',
    intro: 'מתרגלים כדרור והקפצות.',
    steps: steps(['כדרור במקום – דקה', 60], ['כדרור בהליכה הלוך וחזור', 60], 'ניסיון: כמה הקפצות ברצף?', 'עוד ניסיון – לנסות לשבור את השיא'),
    criteria: 'השלמת כל התרגילים',
    reflect: 'מה השיא שלך בהקפצות?',
    parentCheck: 'השיא נשמע הגיוני',
  },
  {
    id: 'sport-stretch',
    group: 'sport',
    title: 'מתיחות לכל הגוף',
    emoji: '🧘',
    intro: 'מתיחות רגועות, בלי כאב.',
    steps: steps(['צוואר וכתפיים', 60], ['ידיים וגב', 60], ['רגליים – שרירים אחוריים', 60], ['נשימות עמוקות', 30]),
    criteria: '4 תרגילי מתיחה',
    parentCheck: 'המתיחות נעשו בעדינות',
  },
  // ---------------------------------------------------------------- music
  {
    id: 'music-scale',
    group: 'music',
    title: 'תרגול סולם 10 דקות',
    emoji: '🎼',
    intro: 'בוחרים סולם ומנגנים אותו לאט, ואז קצת יותר מהר.',
    steps: steps('בוחרים סולם (למשל דו מז׳ור)', ['מנגנים לאט, עולה ויורד', 240], ['מנגנים בקצב בינוני', 240], ['מנגנים פעם אחת בלי טעויות', 120]),
    criteria: '10 דקות תרגול וסולם אחד נקי',
    reflect: 'איזה סולם ניגנת?',
    parentCheck: 'שמעתם את הסולם בסוף',
  },
  {
    id: 'music-practice-15',
    group: 'music',
    title: 'אימון נגינה 15 דקות',
    emoji: '🎹',
    intro: 'אימון מסודר: חימום, קטע, ונגינה לסיום.',
    steps: steps(['חימום – 3 דקות', 180], ['עבודה על קטע קשה – 8 דקות', 480], ['מנגנים את כל השיר – 4 דקות', 240]),
    criteria: '15 דקות אימון',
    reflect: 'על מה עבדת היום?',
    parentCheck: 'שמעתם נגינה',
  },
  {
    id: 'music-new-song',
    group: 'music',
    title: 'לומדים שיר חדש',
    emoji: '🎵',
    intro: 'לומדים שיר בחלקים קטנים.',
    steps: steps('בוחרים שיר ומקשיבים לו', 'לומדים את השורה הראשונה', 'לומדים את הפזמון', 'מנגנים או שרים את כל השיר להורה'),
    criteria: 'ביצוע השיר מההתחלה עד הסוף',
    reflect: 'איזה שיר למדת?',
    parentCheck: 'שמעתם את השיר',
  },
  {
    id: 'music-rhythm',
    group: 'music',
    title: 'משחק קצב',
    emoji: '🥁',
    intro: 'מוחאים כפיים בקצבים שונים.',
    steps: steps(['מוחאים בקצב איטי וקבוע', 60], ['מוחאים פעמיים בכל פעימה', 60], 'ממציאים קצב משלך', 'ההורה מחקה את הקצב שלך'),
    criteria: 'ביצוע 4 התרגילים',
    parentCheck: 'ניסיתם לחקות את הקצב',
  },
  {
    id: 'music-listen',
    group: 'music',
    title: 'הקשבה פעילה',
    emoji: '🎧',
    intro: 'מקשיבים לקטע מוזיקה ומנסים לשמוע פרטים.',
    steps: steps('בוחרים יצירה או שיר', ['מקשיבים בעיניים עצומות', 180], 'מזהים לפחות 2 כלים', 'מספרים איזה רגש עלה'),
    criteria: 'הקשבה עד הסוף ותיאור קצר',
    reflect: 'אילו כלים שמעת ומה הרגשת?',
    parentCheck: 'התיאור הגיוני',
  },
  // ---------------------------------------------------------------- soft skills
  {
    id: 'soft-set-table',
    group: 'soft',
    title: 'עריכת שולחן לארוחה',
    emoji: '🍽️',
    intro: 'עוזרים לערוך את השולחן ומספרים מה עשיתם.',
    steps: steps('סופרים כמה סועדים יש', 'מניחים צלחות וכוסות', 'מניחים סכו״ם ומפיות', 'בסוף הארוחה מפנים את הצלחת שלך'),
    criteria: 'השולחן ערוך לכולם',
    reflect: 'ספר/י במשפט מה עשית',
    parentCheck: 'השולחן היה ערוך',
  },
  {
    id: 'soft-help-unasked',
    group: 'soft',
    title: 'עזרה בלי שביקשו',
    emoji: '🤝',
    intro: 'מחפשים משהו שאפשר לעזור בו – בלי שמישהו יבקש.',
    steps: steps('מסתכלים מסביב: מה צריך עזרה?', 'עוזרים עד הסוף', 'מספרים למי עזרת'),
    criteria: 'עזרה אחת אמיתית ביוזמה אישית',
    reflect: 'במה עזרת?',
    parentCheck: 'העזרה קרתה באמת',
  },
  {
    id: 'soft-call-family',
    group: 'soft',
    title: 'שיחה עם סבא או סבתא',
    emoji: '📞',
    intro: 'מתקשרים ושואלים 3 שאלות מעניינות.',
    steps: steps('מכינים 3 שאלות (למשל: איך היה בבית הספר שלך?)', 'מתקשרים ושואלים', 'מקשיבים עד הסוף בלי להפריע', 'מספרים בבית דבר אחד שלמדת'),
    criteria: 'שיחה עם 3 שאלות',
    reflect: 'מה הדבר הכי מעניין ששמעת?',
    parentCheck: 'השיחה התקיימה',
  },
  {
    id: 'soft-compliment',
    group: 'soft',
    title: 'מחמאה אמיתית',
    emoji: '💬',
    intro: 'נותנים מחמאה כנה למישהו – חבר, אח או מורה.',
    steps: steps('חושבים על מישהו ועל משהו טוב שהוא עשה', 'אומרים לו את זה במילים שלך', 'שמים לב איך הוא הגיב'),
    criteria: 'מחמאה אחת אמיתית',
    reflect: 'למי נתת מחמאה ועל מה?',
    parentCheck: 'המחמאה כנה',
  },
  {
    id: 'soft-tidy',
    group: 'soft',
    title: 'מסדרים את החדר',
    emoji: '🧹',
    intro: 'סידור מהיר ב־15 דקות.',
    steps: steps(['מרימים דברים מהרצפה', 300], ['מחזירים בגדים למקום', 300], ['מסדרים שולחן ומדף', 300]),
    criteria: 'רצפה פנויה ושולחן מסודר',
    parentCheck: 'החדר מסודר',
  },
  // ---------------------------------------------------------------- languages (non-quiz)
  {
    id: 'lang-read-chapter',
    group: 'lang',
    title: 'קריאת פרק בספר',
    emoji: '📚',
    intro: 'קוראים פרק ומספרים עליו.',
    steps: steps('בוחרים מקום שקט', ['קוראים פרק אחד', 900], 'מספרים להורה מה קרה בפרק'),
    criteria: 'פרק שלם וסיכום בעל פה',
    reflect: 'כתבו 3 משפטים על מה שקראתם',
    parentCheck: 'הסיכום מראה שהפרק נקרא',
  },
  // ---------------------------------------------------------------- any category
  {
    id: 'any-practice-15',
    group: 'any',
    title: 'אימון ממוקד 15 דקות',
    emoji: '⏱️',
    intro: 'מתאמנים 15 דקות במשהו שרוצים להשתפר בו.',
    steps: steps('בוחרים מטרה קטנה לאימון', ['מתאמנים 15 דקות', 900], 'מראים להורה מה השתפר'),
    criteria: '15 דקות אימון ממוקד',
    reflect: 'מה הייתה המטרה ואיך הלך?',
    parentCheck: 'ראיתם את התוצאה',
  },
  {
    id: 'any-learn-teach',
    group: 'any',
    title: 'לומדים ומלמדים',
    emoji: '🧑‍🏫',
    intro: 'לומדים משהו חדש ומלמדים אותו מישהו אחר.',
    steps: steps('לומדים משהו קטן וחדש', 'מתרגלים אותו 3 פעמים', 'מלמדים את ההורה או אח/ות'),
    criteria: 'מישהו אחר למד ממך',
    reflect: 'מה לימדת?',
    parentCheck: 'למדתם משהו מהילד/ה',
  },
  {
    id: 'any-puzzles',
    group: 'any',
    title: '3 חידות או תרגילים',
    emoji: '🧩',
    intro: 'פותרים 3 חידות או תרגילים (למשל שחמט, מבוך או חידת היגיון).',
    steps: steps('חידה 1', 'חידה 2', 'חידה 3', 'מסבירים להורה איך פתרת אחת מהן'),
    criteria: '3 חידות פתורות',
    reflect: 'איזו חידה הייתה הכי קשה?',
    parentCheck: 'ההסבר ברור',
  },
  {
    id: 'any-create-show',
    group: 'any',
    title: 'יוצרים ומציגים',
    emoji: '🎨',
    intro: 'יוצרים משהו קטן ומציגים אותו.',
    steps: steps('מתכננים מה ליצור', ['יוצרים', 900], 'מציגים להורה ומספרים על התהליך'),
    criteria: 'יצירה גמורה שהוצגה',
    reflect: 'מה יצרת?',
    parentCheck: 'ראיתם את היצירה',
  },
  {
    id: 'any-cook',
    group: 'any',
    title: 'מבשלים עם מבוגר',
    emoji: '🍳',
    intro: 'מכינים מתכון פשוט יחד עם מבוגר.',
    steps: steps('קוראים את המתכון ואוספים מצרכים', 'שוטפים ידיים', 'מכינים יחד עם מבוגר', 'מנקים את המטבח'),
    criteria: 'מתכון מוכן ומטבח נקי',
    reflect: 'מה הכנתם?',
    parentCheck: 'המטבח נקי',
  },
];

export const findTemplate = (id: string) => GUIDED_TEMPLATES.find((t) => t.id === id);

/** Templates suggested for a category group (group templates first, then the general ones). */
export function templatesForGroup(group: GuidedGroup): GuidedTemplate[] {
  return [...GUIDED_TEMPLATES.filter((t) => t.group === group && group !== 'any'), ...GUIDED_TEMPLATES.filter((t) => t.group === 'any')];
}
