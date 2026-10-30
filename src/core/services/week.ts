import type { WeekId } from '../model/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-date week id: the YYYY-MM-DD of the week's first day. */
export function weekIdOf(date: Date, weekStartsOn: 0 | 1 = 0): WeekId {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
