import { describe, expect, it } from 'vitest';
import { weekIdOf } from '../services/week';

describe('weekIdOf', () => {
  it('uses Sunday as week start by default (Israel)', () => {
    // Wed 28 Oct 2026 → Sun 25 Oct 2026
    expect(weekIdOf(new Date(2026, 9, 28))).toBe('2026-10-25');
    expect(weekIdOf(new Date(2026, 9, 25))).toBe('2026-10-25');
    expect(weekIdOf(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-25');
    expect(weekIdOf(new Date(2026, 10, 1))).toBe('2026-11-01');
  });
  it('supports Monday weeks', () => {
    expect(weekIdOf(new Date(2026, 9, 25), 1)).toBe('2026-10-19');
  });
});
