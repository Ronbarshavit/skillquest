// Headless screenshots of every screen at iPhone-ish 390x844 + RTL/offline/PWA checks.
// Usage: npm run build && npx vite preview --host 127.0.0.1 --port 4319 --strictPort &  then  npm run screenshots
// Sub-path (GitHub Pages) check: SQ_BASE=/skillquest/ npm run build, preview the same way, then
//   SQ_URL=http://127.0.0.1:4319/skillquest/ SQ_SHOTS=/tmp/sq-pages-shots npm run screenshots
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { closeCore, playDrill, playPlacement } from './drill-bot.mjs';

const BASE = process.env.SQ_URL ?? 'http://127.0.0.1:4319/';
const OUT = (process.env.SQ_SHOTS ?? new URL('../screenshots/', import.meta.url).pathname).replace(/\/?$/, '/');
const BASE_PATH = new URL(BASE).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL', hasTouch: true, isMobile: true });
const page = await context.newPage();
// Controllable clock (time still flows normally) so the 5-minute idle auto-lock can be fast-forwarded.
await page.clock.install();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

const go = async (hash) => {
  await page.goto(BASE + '#' + hash);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
};
const shot = async (name, opts = {}) => {
  // Toasts are position:fixed and would float over full-page captures; keep them only where they are the subject.
  const keepToast = /toast|submitted/.test(name);
  await page.evaluate((hide) => {
    let s = document.getElementById('shot-style');
    if (!s) { s = document.createElement('style'); s.id = 'shot-style'; document.head.append(s); }
    s.textContent = hide ? '.toast-region{display:none!important}' : '';
  }, !keepToast);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: opts.full ?? true });
  console.log('saved', name);
};

const enterPin = async (digits) => {
  for (const d of digits) await page.locator('.sq-pin__keys').getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(150);
};
const LOCK_BTN = { name: 'נעילה ומעבר למצב ילד' };

// Fresh demo data
await go('/reset');
await page.waitForURL(/#\/child$/);

// 1. Child home
await go('/child');
const rtl = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, font: getComputedStyle(document.body).fontFamily }));
check('html dir=rtl lang=he', rtl.dir === 'rtl' && rtl.lang === 'he', JSON.stringify(rtl));
const tiles = await page.locator('.category-tile').evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect().x));
check('first category tile is on the right (RTL grid)', tiles[0] > tiles[1], JSON.stringify(tiles));
const wallet = await page.locator('.wallet__cell').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
check('"earned" cell is right of "locked" cell', wallet[0] > wallet[1], JSON.stringify(wallet));
await shot('01-child-home');

// 2. Quest list
await page.locator('.category-tile', { hasText: 'חשבון' }).locator('a').click();
// First visit to Math → placement test intro ("not now" goes to the quest list)
await page.waitForURL(/category\/cat-math\/placement/);
await page.locator('.placement[data-phase="intro"]').waitFor();
check('first Math visit opens the placement intro', await page.getByText('בואו נגלה מאיפה מתחילים!').isVisible());
await page.getByRole('button', { name: 'אחר כך' }).click();
await page.waitForURL(/category\/cat-math$/);
check('"later" shows the quest list with a placement banner', await page.getByTestId('placement-banner').isVisible());
await page.waitForTimeout(200);
const hdr = await page.evaluate(() => {
  const b = document.querySelector('.sq-header__back').getBoundingClientRect();
  const t = document.querySelector('.sq-header__title').getBoundingClientRect();
  return { back: b.x, title: t.x };
});
check('back button at inline-start (right side)', hdr.back > hdr.title, JSON.stringify(hdr));
await shot('02-quest-list');

// 3. Quest detail (quiz info card)
await page.locator('.quest-row', { hasText: 'בעיות מילוליות' }).click();
await page.waitForURL(/quest\/q-math-2/);
await page.waitForTimeout(200);
check('quiz quest shows drill info + start button', (await page.locator('.drill-info').isVisible()) && (await page.getByRole('button', { name: /מתחילים לתרגל/ }).isVisible()));
await shot('03-quest-detail');

// 3b. Guided activity (sport: jump rope) → steps + timer → sent to the parent
await go('/child/quest/q-sport-2/activity');
check('guided activity lists steps', (await page.locator('.step').count()) >= 3);
await page.locator('.timer').first().getByRole('button', { name: 'התחלה' }).click();
await page.waitForTimeout(1200);
await shot('25-guided-activity', { full: false });
const stepBoxes = page.locator('.step__check');
for (let i = 0, n = await stepBoxes.count(); i < n; i++) if ((await stepBoxes.nth(i).getAttribute('aria-checked')) !== 'true') await stepBoxes.nth(i).click();
const reflect = page.locator('textarea');
if (await reflect.count()) await reflect.first().fill('הצלחתי 45 קפיצות בסבב השני');
await page.getByRole('button', { name: 'סיימתי! שליחה לאישור' }).click();
await page.waitForTimeout(400);
await shot('03b-quest-detail-submitted', { full: false });
check('guided submission shows as waiting for approval', await page.getByText(/מחכה לאישור/).first().isVisible().catch(() => false));

// 4. Parent dashboard
await page.goto(BASE + '#/child');
await page.getByRole('button', { name: 'מצב הורה' }).click();
await page.waitForTimeout(300);
// First parent entry: create the PIN (enter twice)
check('first parent entry opens PIN creation', /#\/unlock$/.test(page.url()) && (await page.getByText('בחרו קוד הורה').isVisible()), page.url());
check('PIN screen labelled "simple lock – not security"', await page.getByText('נעילה פשוטה – לא אמצעי אבטחה.').isVisible());
await shot('13-pin-create');
await enterPin('1234');
check('PIN asks for the code again', await page.getByText('הקלידו את הקוד שוב לאישור').isVisible());
await enterPin('12');
await shot('13b-pin-confirm');
await enterPin('34');
await page.waitForTimeout(300);
check('PIN created → parent dashboard', /#\/parent$/.test(page.url()), page.url());
const stored = await page.evaluate(() => localStorage.getItem('skillquest.state.v1'));
const lock = JSON.parse(stored).family.parentLock;
check('PIN stored as salted hash only', lock && lock.salt && /^[0-9a-f]{64}$/.test(lock.hash) && !JSON.stringify(lock).includes('1234'));
const bearCard = page.locator('.approval', { hasText: 'דובון' });
check('insufficient-funds approval is disabled', await bearCard.getByRole('button', { name: /אישור/ }).isDisabled());
check('pretend-money note visible in parent mode', await page.getByText('כסף דמיוני – ללא תשלומים אמיתיים.').isVisible());
await shot('04-parent-dashboard');

// Approve כוכבית's music quest → level-up (music start 2, 60xp + 25xp ≥ 65)
await page.locator('.approval', { hasText: 'אימון נגינה' }).getByRole('button', { name: /אישור/ }).click();
await page.waitForTimeout(400);
await shot('04b-parent-after-approve-toast', { full: false });

// Deposit for דובון so his quest can be approved
await page.locator('.chip', { hasText: 'דובון' }).click();
await page.waitForTimeout(200);
await page.getByLabel('סכום (₪)').fill('30');
await page.getByRole('button', { name: 'הפקדה' }).click();
await page.waitForTimeout(400);
check('דובון approval enabled after deposit', await page.locator('.approval', { hasText: 'דובון' }).getByRole('button', { name: /אישור/ }).isEnabled());
await page.locator('.sq-card', { hasText: 'הפקדת דמי כיס' }).scrollIntoViewIfNeeded();
await shot('05-parent-deposit-history');

// 6. Child sees the reward banner, then the celebration with level-up
await page.getByRole('button', LOCK_BTN).click();
await page.waitForURL(/#\/child$/);
await page.locator('.chip', { hasText: 'כוכבית' }).click();
await page.waitForTimeout(300);
await shot('06-child-home-reward-banner', { full: false });
await page.getByRole('button', { name: 'לחגוג' }).click();
await page.waitForURL(/celebrate/);
await page.waitForTimeout(1600);
check('celebration shows level-up', await page.locator('.levelup').isVisible());
await shot('07-celebration-level-up', { full: false });

// Reduced motion variant
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload();
await page.waitForTimeout(300);
const anim = await page.locator('.confetti__piece').first().evaluate((e) => getComputedStyle(e).animationName);
check('reduced motion disables confetti animation', anim === 'none', anim);
await shot('07b-celebration-reduced-motion', { full: false });
await page.emulateMedia({ reducedMotion: 'no-preference' });

// 8. Interest areas + category editor
// Child mode cannot open parent screens by URL
await go('/parent/interests');
check('parent routes redirect to the PIN screen in child mode', /#\/unlock$/.test(page.url()), page.url());
await enterPin('9999');
check('wrong PIN shows remaining attempts', await page.getByText('קוד שגוי. נותרו 4 ניסיונות.').isVisible());
await shot('14-pin-wrong', { full: false });
await enterPin('1234');
await page.waitForTimeout(300);
check('correct PIN returns to the requested parent screen', /#\/parent\/interests$/.test(page.url()), page.url());
await shot('08-interest-areas');
await go('/parent/interests/cat-chess');
await shot('09-category-editor');

// Add a custom category end-to-end, then check child visibility
await go('/parent/interests');
await page.getByLabel('שם התחום').fill('תכנות');
await page.getByRole('radio', { name: '💻' }).click();
await page.getByRole('radio', { name: 'תכלת' }).click();
await page.getByRole('button', { name: 'הוספת תחום' }).click();
await page.waitForURL(/interests\/.+/);
await page.getByLabel('כותרת').fill('לבנות משחק ב-Scratch');
await page.getByLabel('פרס (₪)').fill('6');
await page.getByRole('button', { name: 'הוספת משימה' }).click();
await page.waitForTimeout(200);
await go('/parent/interests');
await page.getByRole('switch', { name: 'הפעלת מוזיקה' }).click();
await go('/child');
const names = await page.locator('.category-tile__name').allTextContents();
check('custom category visible to child', names.includes('תכנות'), names.join(','));
check('disabled category hidden from child', !names.includes('מוזיקה') && !names.includes('בישול'), names.join(','));
await shot('10-child-home-custom-category');

// Lockout after 5 wrong tries, then forgot-PIN (resets the PIN only)
await page.getByRole('button', LOCK_BTN).click().catch(async () => { await go('/parent'); await page.getByRole('button', LOCK_BTN).click(); });
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'מצב הורה' }).click();
await page.waitForTimeout(200);
for (let i = 0; i < 5; i++) await enterPin('0000');
const lockedText = await page.getByTestId('pin-lockout').textContent().catch(() => '');
check('5 wrong tries → 30 s lockout', /בעוד (29|30) שניות/.test(lockedText), lockedText);
check('keypad disabled during lockout', await page.locator('.sq-pin__keys').getByRole('button', { name: '1', exact: true }).isDisabled());
await shot('15-pin-lockout', { full: false });
await page.clock.fastForward(31_000);
await page.waitForTimeout(400);
check('lockout ends after 30 s', !(await page.getByTestId('pin-lockout').isVisible().catch(() => false)));
await page.getByRole('button', { name: 'שכחתי את הקוד' }).click();
const resetBtn = page.getByRole('button', { name: 'איפוס הקוד בלבד' });
check('forgot-PIN needs typed confirmation', await resetBtn.isDisabled());
await page.getByLabel(/לאישור, הקלידו/).fill('איפוס');
await shot('16-pin-forgot-confirm');
const before = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('skillquest.state.v1')); delete s.family.parentLock; return JSON.stringify(s); });
await resetBtn.click();
await page.waitForTimeout(300);
const after = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('skillquest.state.v1')); return { hasLock: !!s.family.parentLock, rest: (delete s.family.parentLock, JSON.stringify(s)) }; });
check('forgot-PIN removes only the PIN (all other data unchanged)', !after.hasLock && after.rest === before);
check('after reset, a new PIN is created', await page.getByText('בחרו קוד הורה').isVisible());
await enterPin('2468');
await enterPin('2468');
await page.waitForTimeout(300);
check('new PIN works', /#\/parent$/.test(page.url()), page.url());

// Auto-lock: app goes to the background
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  delete document.visibilityState;
});
await page.waitForTimeout(300);
check('auto-lock when app goes to background', /#\/unlock$/.test(page.url()) && (await page.getByText('מצב הורה ננעל כשהאפליקציה עברה לרקע.').isVisible()), page.url());
await shot('17-auto-locked-background', { full: false });
// Auto-lock: 5 minutes idle
await enterPin('2468');
await page.waitForTimeout(300);
await page.clock.fastForward('04:50');
check('still unlocked before 5 min idle', /#\/parent$/.test(page.url()), page.url());
await page.clock.fastForward('00:15');
await page.waitForTimeout(300);
check('auto-lock after 5 min idle', /#\/unlock$/.test(page.url()) && (await page.getByText('מצב הורה ננעל אוטומטית אחרי 5 דקות ללא פעילות.').isVisible()), page.url());
await go('/child');

// Themes
for (const t of ['calm', 'dark']) {
  await page.evaluate((th) => localStorage.setItem('skillquest.theme', th), t);
  await page.reload();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  const attr = await page.evaluate(() => document.documentElement.dataset.theme);
  check(`theme ${t} applied via data-theme`, attr === t, attr);
  await shot(`11-child-home-theme-${t}`, { full: false });
}
await page.evaluate(() => localStorage.setItem('skillquest.theme', 'default'));

// PWA: manifest + offline
const manifest = await (await page.request.get(BASE + 'manifest.webmanifest')).json();
check('manifest lang he / dir rtl / icons', manifest.lang === 'he' && manifest.dir === 'rtl' && manifest.icons.length >= 3);
check(`manifest scope/start_url = ${BASE_PATH}`, manifest.scope === BASE_PATH && manifest.start_url === BASE_PATH, `${manifest.scope} ${manifest.start_url}`);
const iconOk = (await page.request.get(new URL(manifest.icons[0].src, BASE + 'manifest.webmanifest').href)).ok();
check('manifest icon resolves under base', iconOk);
await page.reload();
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(() => {});
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
check('service worker controls the page', controlled);
const swScope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? '');
check(`service worker scope ends with ${BASE_PATH}`, new URL(swScope || 'http://x/').pathname === BASE_PATH, swScope);
const assetPaths = await page.evaluate(() => [...document.querySelectorAll('script[src], link[href]')].map((e) => new URL(e.src || e.href).pathname));
check(`all asset URLs under ${BASE_PATH}`, assetPaths.length > 0 && assetPaths.every((p) => p.startsWith(BASE_PATH)), assetPaths.filter((p) => !p.startsWith(BASE_PATH)).join(' '));
await context.setOffline(true);
await page.reload();
await page.waitForTimeout(500);
const offlineTitle = await page.locator('.sq-header__title').first().textContent().catch(() => null);
check('app shell loads offline', !!offlineTitle, offlineTitle ?? '');
await context.setOffline(false);

// Clean start → onboarding wizard
await go('/reset-empty');
await page.waitForTimeout(300);
check('#/reset-empty leads to onboarding', /#\/onboarding$/.test(page.url()), page.url());
await go('/child');
check('child routes redirect to onboarding until finished', /#\/onboarding$/.test(page.url()), page.url());
await shot('18-onboarding-1-family');
await page.getByRole('button', { name: 'המשך' }).click();
check('onboarding validates the family name', await page.getByText('נא לכתוב שם למשפחה.').isVisible());
await page.getByRole('textbox', { name: 'שם המשפחה' }).fill('משפחת הכוכבים');
await page.getByRole('button', { name: 'המשך' }).click();
const kidName = (i) => page.locator('.onboarding__kids .sq-field__input').nth(i);
await kidName(0).fill('שועלי');
await page.getByRole('button', { name: 'הוספת ילד או ילדה' }).click();
await kidName(1).fill('פנדה');
const kidLabels = await page.locator('.onboarding__kids .sq-field__label').allTextContents();
check('child-name labels are neutral (no "/") and numbered', kidLabels.length === 2 && kidLabels.every((l) => !l.includes('/') && /^שם \(/.test(l)), kidLabels.join(' | '));
await page.getByRole('radio', { name: 'דמות 🐼' }).nth(1).click();
await shot('18b-onboarding-2-children');
await page.getByRole('button', { name: 'המשך' }).click();
await page.getByLabel(/פנדה – ₪ לשבוע/).fill('20');
await shot('18c-onboarding-3-budget');
await page.getByRole('button', { name: 'המשך' }).click();
check('pretend-money note on the deposit step', await page.getByText('כסף דמיוני – ללא תשלומים אמיתיים.').isVisible());
await page.getByLabel(/הפקדה ראשונה לפנדה/).fill('0');
await shot('18d-onboarding-4-deposit');
await page.getByRole('button', { name: 'המשך' }).click();
check('onboarding PIN step labelled simple lock', await page.getByText('נעילה פשוטה – לא אמצעי אבטחה.').isVisible());
await shot('18e-onboarding-5-pin');
await enterPin('1357');
await enterPin('1357');
await page.waitForTimeout(400);
check('onboarding finishes in parent mode', /#\/parent$/.test(page.url()), page.url());
check('family name saved', (await page.locator('.sq-header__subtitle').first().textContent()) === 'משפחת הכוכבים');
check('empty state: no pending approvals', await page.getByTestId('empty-pending').isVisible());
await shot('18f-onboarding-done-parent');
await page.locator('.chip', { hasText: 'פנדה' }).click();
await page.waitForTimeout(200);
check('empty state: ledger', await page.getByTestId('empty-ledger').isVisible());
await page.getByRole('button', LOCK_BTN).click();
await page.waitForTimeout(200);
const kidNames = await page.locator('.chip').allTextContents();
check('onboarded children visible to child mode', kidNames.some((n) => n.includes('שועלי')) && kidNames.some((n) => n.includes('פנדה')), kidNames.join(','));
await page.locator('.chip', { hasText: 'פנדה' }).click();
await page.waitForTimeout(200);
check('empty state: wallet', await page.getByTestId('empty-wallet').isVisible());
await shot('19-empty-wallet-child-home');
// Category without quests
await page.getByRole('button', { name: 'מצב הורה' }).click();
await page.waitForTimeout(200);
await enterPin('1357');
await page.waitForTimeout(300);
await go('/parent/interests');
await page.getByLabel('שם התחום').fill('ציור');
await page.getByRole('button', { name: 'הוספת תחום' }).click();
await page.waitForURL(/interests\/.+/);
const newCat = page.url().split('/').pop();
await go('/child/category/' + newCat);
check('empty state: category without quests', await page.getByTestId('empty-quests').isVisible());
await shot('19b-empty-quests');

// Manage children: add, rename + avatar, remove (with confirmation; deletes the child's data)
await go('/parent');
await page.getByTestId('nav-manage-children').click();
await page.waitForURL(/#\/parent\/children$/);
await page.waitForTimeout(200);
check('manage children lists the family', (await page.locator('[data-testid^="child-row-"]').count()) === 2);
await shot('20-manage-children');
await page.locator('form').last().getByLabel('שם').fill('ינשופי');
await page.locator('form').last().getByRole('radio', { name: 'דמות 🦉' }).click();
await page.getByLabel('דמי כיס שבועיים (₪)').fill('25');
await page.getByRole('button', { name: 'הוספה', exact: true }).click();
await page.waitForTimeout(200);
check('child added', await page.getByTestId('child-row-ינשופי').isVisible());
await page.locator('form').last().getByLabel('שם').fill('פנדה');
await page.getByRole('button', { name: 'הוספה', exact: true }).click();
await page.waitForTimeout(150);
check('duplicate name rejected', await page.getByText('כבר יש במשפחה מישהו בשם הזה').isVisible());
await page.locator('form').last().getByLabel('שם').fill('');
await page.getByRole('button', { name: 'עריכת שועלי' }).click();
const edit = page.getByTestId('edit-child');
await edit.getByLabel('שם', { exact: true }).fill('שועלון');
await edit.getByRole('radio', { name: 'דמות 🦁' }).click();
await shot('20b-manage-children-edit');
await edit.getByRole('button', { name: 'שמירה' }).click();
await page.waitForTimeout(200);
const renamed = page.getByTestId('child-row-שועלון');
check('child renamed + avatar changed', (await renamed.isVisible()) && (await renamed.textContent()).includes('🦁'));
const stBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('skillquest.state.v1')));
const foxId = stBefore.family.children.find((k) => k.name === 'שועלון').id;
check('removed child had wallet data before', stBefore.ledger.some((e) => e.childId === foxId));
await page.getByRole('button', { name: 'הסרת שועלון' }).click();
const confirmBox = page.getByTestId('confirm-remove');
check('removal asks for confirmation with a summary', (await confirmBox.isVisible()) && /נעולים/.test(await confirmBox.textContent()) && /אי אפשר לבטל/.test(await confirmBox.textContent()));
await shot('20c-manage-children-confirm-remove');
await confirmBox.getByRole('button', { name: 'ביטול' }).click();
check('cancel keeps the child', (await page.locator('[data-testid^="child-row-"]').count()) === 3);
await page.getByRole('button', { name: 'הסרת שועלון' }).click();
await page.getByTestId('confirm-remove').getByRole('button', { name: 'כן, להסיר ולמחוק' }).click();
await page.waitForTimeout(200);
const stAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('skillquest.state.v1')));
const left = (xs) => xs.filter((x) => x.childId === foxId).length;
check('removal deletes child + wallet/levels/completions/budget', !stAfter.family.children.some((k) => k.id === foxId) && left(stAfter.ledger) + left(stAfter.progress) + left(stAfter.completions) + left(stAfter.budgets) === 0);
check('other children untouched', stAfter.family.children.map((k) => k.name).join(',') === 'פנדה,ינשופי');
await shot('20d-manage-children-after-remove');
await page.getByRole('button', LOCK_BTN).click().catch(async () => { await go('/parent'); await page.getByRole('button', LOCK_BTN).click(); });
await go('/child');
const kidNames2 = await page.locator('.chip').allTextContents();
check('child mode reflects changes', !kidNames2.some((n) => n.includes('שועל')) && kidNames2.some((n) => n.includes('ינשופי')), kidNames2.join(','));

// Drills: math (mental math, auto-approve) fail → retry → pass → celebration; English vocab; geometry figure
await go('/reset');
await page.waitForURL(/#\/child$/);
const lockedBefore = await page.locator('.wallet__cell--locked').textContent();
await go('/child/quest/q-math-3/play');
await playDrill(page, () => false, async (i, phase) => {
  if (i === 0 && phase === 'question') { await page.waitForTimeout(500); await shot('21-drill-math-question', { full: false }); }
});
check('fail summary after 0/10', await page.locator('.summary--fail').isVisible());
await page.waitForTimeout(800);
await shot('23b-drill-fail-summary', { full: false });
await page.getByRole('button', { name: 'לנסות שוב' }).click();
await playDrill(page, (i) => i !== 1, async (i, phase) => {
  if (phase === 'feedback' && i < 2) await page.waitForTimeout(700);
  if (i === 0 && phase === 'feedback') await shot('22-drill-feedback-correct', { full: false });
  if (i === 1 && phase === 'feedback') await shot('22b-drill-feedback-wrong', { full: false });
});
check('pass summary after 9/10', (await page.locator('.summary--pass').isVisible()) && (await page.locator('.summary__num').textContent()).includes('9'));
await page.waitForTimeout(800);
await shot('23-drill-pass-summary', { full: false });
await page.getByRole('button', { name: 'לחגיגה!' }).click();
await page.waitForURL(/celebrate/);
await page.waitForTimeout(1600);
await shot('23c-drill-celebration', { full: false });
await go('/child');
const lockedAfter = await page.locator('.wallet__cell--locked').textContent();
check('auto-approved pass moved money out of "locked"', lockedBefore !== lockedAfter, `${lockedBefore} → ${lockedAfter}`);
await go('/child/quest/q-lang-1/play');
await page.locator('.drill[data-index="0"]').waitFor();
const enLang = await page.locator('.drill [lang="en"]').first().getAttribute('dir').catch(() => null);
check('English text is marked lang=en dir=ltr', enLang === 'ltr', String(enLang));
await page.waitForTimeout(500);
await shot('24-drill-english-vocab', { full: false });
await playDrill(page, () => true);
check('English vocab pass (manual approval) summary', await page.locator('.summary--pass').isVisible());
await go('/child/quest/q-math-5/play');
await page.locator('.drill[data-index="0"]').waitFor();
check('geometry question draws an SVG figure', await page.locator('.drill svg.fig').first().isVisible().catch(() => false));
await page.waitForTimeout(500);
await shot('24b-drill-geometry', { full: false });
await page.emulateMedia({ reducedMotion: 'reduce' });
const qAnim = await page.locator('.drill__q').evaluate((e) => getComputedStyle(e).animationName);
check('reduced motion disables drill animation', qAnim === 'none', qAnim);
await page.emulateMedia({ reducedMotion: 'no-preference' });

// Placement test (Math, then English) → result → adaptive level; parent sees + overrides it
await go('/reset');
await page.waitForURL(/#\/child$/);
const stateNow = () => page.evaluate(() => JSON.parse(localStorage.getItem('skillquest.state.v1')));
const st0 = await stateNow();
const kid0 = st0.family.children[0].id;
await go('/child/category/cat-math');
await page.waitForURL(/cat-math\/placement/);
await page.waitForTimeout(400);
await shot('26-placement-intro', { full: false });
await page.getByRole('button', { name: 'יוצאים לדרך!' }).click();
// A child who is solid up to level 3 and misses harder questions → placed at 3
const mathLevels = await playPlacement(page, (i, level) => level <= 3, async (i, phase) => {
  if (i === 1 && phase === 'question') { await page.waitForTimeout(500); await shot('27-placement-question', { full: false }); }
  if (i === 2 && phase === 'feedback') { await page.waitForTimeout(500); await shot('27b-placement-feedback', { full: false }); }
});
check('placement asks 6–8 questions', mathLevels.length >= 6 && mathLevels.length <= 8, mathLevels.join(','));
check('placement starts at level 3 and adapts', mathLevels[0] === 3 && new Set(mathLevels).size > 1, mathLevels.join(','));
await page.waitForTimeout(700);
const placed = Number(await page.locator('.placement[data-phase="result"]').getAttribute('data-level'));
check('Math placed at level 3', placed === 3, String(placed));
await shot('28-placement-result', { full: false });
const st1 = await stateNow();
const pMath = st1.progress.find((p) => p.childId === kid0 && p.categoryId === 'cat-math');
check('placement saved (difficulty + record)', pMath?.difficulty === 3 && pMath.placement?.level === 3 && pMath.difficultySource === 'placement');
check('placement awards no money or XP', JSON.stringify(st1.ledger) === JSON.stringify(st0.ledger) && JSON.stringify(st1.completions) === JSON.stringify(st0.completions) && (pMath.xp ?? 0) === (st0.progress.find((p) => p.childId === kid0 && p.categoryId === 'cat-math')?.xp ?? 0));
await page.getByRole('button', { name: 'למשימות!' }).click();
await page.waitForURL(/category\/cat-math$/);
check('quest list shows the practice level', (await page.getByTestId('difficulty-line').textContent()).includes('3 מתוך 5'));
await shot('28b-quest-list-difficulty', { full: false });
await go('/child/quest/q-math-3/play');
check('quiz plays at the placed level', (await page.locator('.drill').getAttribute('data-level')) === '3');
// English: starting a quiz first routes to the placement, then back to the quest
await go('/child/quest/q-lang-3');
await page.getByRole('button', { name: /מתחילים לתרגל/ }).click();
await page.waitForURL(/cat-lang\/placement/);
await page.getByRole('button', { name: 'יוצאים לדרך!' }).click();
await playPlacement(page, () => true);
check('English placement: all right → level 5', (await page.locator('.placement[data-phase="result"]').getAttribute('data-level')) === '5');
await shot('28c-placement-result-english', { full: false });
await page.getByRole('button', { name: 'לתרגול!' }).click();
await page.waitForURL(/quest\/q-lang-3$/);
// Parent view
await go('/child');
await page.getByRole('button', { name: 'מצב הורה' }).click();
await page.waitForTimeout(300);
if (await page.getByText('בחרו קוד הורה').isVisible().catch(() => false)) { await enterPin('1234'); await enterPin('1234'); }
else await enterPin('1234');
await page.waitForURL(/#\/parent$/);
const levels = page.getByTestId('parent-levels');
await levels.scrollIntoViewIfNeeded();
check('parent sees placed levels', (await levels.getByTestId('level-row-cat-math').textContent()).includes('בדיקת רמה: רמה 3'));
await page.waitForTimeout(300);
await levels.screenshot({ path: `${OUT}29-parent-levels.png` });
console.log('saved', '29-parent-levels');
await levels.getByRole('button', { name: 'רמת תרגול בחשבון: הקטנה' }).click();
await page.waitForTimeout(200);
const pOver = (await stateNow()).progress.find((p) => p.childId === kid0 && p.categoryId === 'cat-math');
check('parent override sets difficulty', pOver.difficulty === 2 && pOver.difficultySource === 'parent');
await levels.getByTestId('level-row-cat-lang').getByRole('button', { name: 'בדיקת רמה מחדש' }).click();
await page.waitForTimeout(200);
check('parent can ask for a new placement', !(await stateNow()).progress.find((p) => p.childId === kid0 && p.categoryId === 'cat-lang').placement);
await closeCore();

check('no page/console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log('\nCHECKS');
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  ' + c.detail : ''}`);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
