/**
 * Built-in English word bank for Hebrew speakers (~160 words, levels 1–5).
 * Format per line: english|hebrew|emoji|part-of-speech (n = noun, v = verb, a = adjective, c = colour, num = number).
 */
export type WordPos = 'n' | 'v' | 'a' | 'c' | 'num';
export interface Word {
  en: string;
  he: string;
  emoji: string;
  pos: WordPos;
  level: number;
}

const RAW: Record<number, string> = {
  1: `cat|חתול|🐱|n
dog|כלב|🐶|n
fish|דג|🐟|n
bird|ציפור|🐦|n
apple|תפוח|🍎|n
banana|בננה|🍌|n
milk|חלב|🥛|n
bread|לחם|🍞|n
egg|ביצה|🥚|n
water|מים|💧|n
sun|שמש|☀️|n
moon|ירח|🌙|n
star|כוכב|⭐|n
tree|עץ|🌳|n
flower|פרח|🌸|n
house|בית|🏠|n
car|מכונית|🚗|n
bus|אוטובוס|🚌|n
ball|כדור|⚽|n
book|ספר|📖|n
pen|עט|🖊️|n
bag|תיק|🎒|n
hat|כובע|🧢|n
shoe|נעל|👟|n
red|אדום|🔴|c
blue|כחול|🔵|c
green|ירוק|🟢|c
yellow|צהוב|🟡|c
black|שחור|⚫|c
white|לבן|⚪|c
one|אחת|1️⃣|num
two|שתיים|2️⃣|num
three|שלוש|3️⃣|num
four|ארבע|4️⃣|num
five|חמש|5️⃣|num
mother|אמא|👩|n
father|אבא|👨|n
baby|תינוק|👶|n
boy|ילד|👦|n
girl|ילדה|👧|n`,
  2: `horse|סוס|🐴|n
cow|פרה|🐄|n
lion|אריה|🦁|n
monkey|קוף|🐒|n
rabbit|ארנב|🐰|n
chicken|תרנגולת|🐔|n
orange|תפוז|🍊|n
cake|עוגה|🍰|n
cheese|גבינה|🧀|n
pizza|פיצה|🍕|n
rice|אורז|🍚|n
chair|כיסא|🪑|n
door|דלת|🚪|n
bed|מיטה|🛏️|n
window|חלון|🪟|n
clock|שעון|🕰️|n
phone|טלפון|📱|n
key|מפתח|🔑|n
hand|יד|✋|n
eye|עין|👁️|n
ear|אוזן|👂|n
nose|אף|👃|n
mouth|פה|👄|n
foot|כף רגל|🦶|n
school|בית ספר|🏫|n
teacher|מורה|🧑‍🏫|n
grandma|סבתא|👵|n
grandpa|סבא|👴|n
rain|גשם|🌧️|n
snow|שלג|❄️|n
sea|ים|🌊|n
cloud|ענן|☁️|n
pink|ורוד|🩷|c
purple|סגול|🟣|c
six|שש|6️⃣|num
seven|שבע|7️⃣|num
eight|שמונה|8️⃣|num
nine|תשע|9️⃣|num
ten|עשר|🔟|num`,
  3: `elephant|פיל|🐘|n
giraffe|ג׳ירפה|🦒|n
snake|נחש|🐍|n
turtle|צב|🐢|n
bee|דבורה|🐝|n
butterfly|פרפר|🦋|n
carrot|גזר|🥕|n
tomato|עגבנייה|🍅|n
grapes|ענבים|🍇|n
strawberry|תות|🍓|n
lemon|לימון|🍋|n
sandwich|כריך|🥪|n
kitchen|מטבח|🍳|n
garden|גינה|🏡|n
computer|מחשב|💻|n
bicycle|אופניים|🚲|n
train|רכבת|🚆|n
airplane|מטוס|✈️|n
ship|ספינה|🚢|n
mountain|הר|⛰️|n
river|נהר|🏞️|n
forest|יער|🌲|n
rainbow|קשת בענן|🌈|n
doctor|רופא|🧑‍⚕️|n
farmer|חקלאי|🧑‍🌾|n
happy|שמח|😀|a
sad|עצוב|😢|a
angry|כועס|😠|a
tired|עייף|😴|a
hungry|רעב|🤤|a`,
  4: `run|לרוץ|🏃|v
swim|לשחות|🏊|v
jump|לקפוץ|🦘|v
read|לקרוא|📚|v
write|לכתוב|✍️|v
sing|לשיר|🎤|v
dance|לרקוד|💃|v
sleep|לישון|🛌|v
eat|לאכול|🍴|v
drink|לשתות|🥤|v
cook|לבשל|🧑‍🍳|v
play|לשחק|🎮|v
draw|לצייר|🎨|v
listen|להקשיב|🎧|v
climb|לטפס|🧗|v
fly|לעוף|🕊️|v
hot|חם|🔥|a
cold|קר|🧊|a
big|גדול|🐋|a
small|קטן|🐜|a
fast|מהיר|🏎️|a
slow|איטי|🐌|a
strong|חזק|💪|a
beautiful|יפה|🌺|a
new|חדש|🆕|a`,
  5: `weather|מזג אוויר|🌦️|n
holiday|חג|🎉|n
birthday|יום הולדת|🎂|n
library|ספרייה|🏛️|n
museum|מוזיאון|🖼️|n
hospital|בית חולים|🏥|n
island|אי|🏝️|n
desert|מדבר|🏜️|n
volcano|הר געש|🌋|n
planet|כוכב לכת|🪐|n
astronaut|אסטרונאוט|🧑‍🚀|n
rocket|טיל|🚀|n
dinosaur|דינוזאור|🦖|n
treasure|אוצר|💎|n
castle|טירה|🏰|n
bridge|גשר|🌉|n
camera|מצלמה|📷|n
guitar|גיטרה|🎸|n
piano|פסנתר|🎹|n
drum|תוף|🥁|n
basketball|כדורסל|🏀|n
medal|מדליה|🏅|n
brave|אמיץ|🦸|a
curious|סקרן|🧐|a
quiet|שקט|🤫|a
dangerous|מסוכן|⚠️|a
delicious|טעים|😋|a`,
};

export const WORD_BANK: readonly Word[] = Object.entries(RAW).flatMap(([level, block]) =>
  block.split('\n').map((line) => {
    const [en, he, emoji, pos] = line.trim().split('|');
    return { en, he, emoji, pos: pos as WordPos, level: Number(level) };
  }),
);

/** Words up to `level`, the current level weighted double so new words come up more. */
export function wordsForLevel(level: number): Word[] {
  const upTo = WORD_BANK.filter((w) => w.level <= level);
  return [...upTo, ...upTo.filter((w) => w.level === level)];
}

export const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
