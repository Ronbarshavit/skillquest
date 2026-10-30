// Test helper: plays a drill in the browser by regenerating its questions from the seed shown on the
// `.drill` root (data-seed / data-level) with the real core engine, loaded through Vite's SSR loader.
import { createServer } from 'vite';

let server;
let core;
export async function loadCore() {
  if (core) return core;
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  core = await server.ssrLoadModule('/src/core/index.ts');
  return core;
}
export async function closeCore() {
  await server?.close();
  server = undefined;
  core = undefined;
}

/** Questions of the drill currently on screen. */
export async function currentQuestions(page) {
  const c = await loadCore();
  const root = page.locator('.drill');
  await root.waitFor();
  const questId = await root.getAttribute('data-quest');
  const seed = await root.getAttribute('data-seed');
  const level = Number(await root.getAttribute('data-level'));
  const quest = await page.evaluate((id) => JSON.parse(localStorage.getItem('skillquest.state.v1')).quests.find((q) => q.id === id), questId);
  return c.generateDrill(quest.drill, level, seed);
}

/** Answers the question at the current index; `right` chooses a correct or a wrong answer. */
export async function answer(page, q, right) {
  if (q.type === 'numeric') {
    const v = String(right ? q.answer : q.answer + 1);
    for (const ch of v) await page.keyboard.press(ch === '-' ? 'Minus' : ch === '.' ? 'Period' : ch);
    await page.keyboard.press('Enter');
  } else if (q.type === 'choice' || q.type === 'blank') {
    const i = right ? q.answerIndex : (q.answerIndex + 1) % q.choices.length;
    await page.locator('.choice').nth(i).click();
  } else {
    const cols = page.locator('.match__col');
    const n = q.answer.length;
    for (let i = 0; i < n; i++) {
      await cols.nth(0).locator('.match__item').nth(i).click();
      await cols.nth(1).locator('.match__item').nth(right ? q.answer[i] : q.answer[(i + 1) % n]).click();
    }
    await page.getByRole('button', { name: 'בדיקה' }).click();
  }
  await page.locator('.feedback').waitFor();
}

/** Plays every remaining question; `plan(i)` → true for a correct answer. Optional `onStep(i, phase)` hook for screenshots. */
export async function playDrill(page, plan, onStep) {
  const qs = await currentQuestions(page);
  for (let i = 0; i < qs.length; i++) {
    await page.locator(`.drill[data-index="${i}"]`).waitFor();
    if (onStep) await onStep(i, 'question', qs[i]);
    await answer(page, qs[i], plan(i));
    if (onStep) await onStep(i, 'feedback', qs[i]);
    await page.getByRole('button', { name: i === qs.length - 1 ? 'לסיכום' : 'הבא' }).click();
  }
  await page.locator('.drill[data-index="summary"]').waitFor();
  return qs;
}
