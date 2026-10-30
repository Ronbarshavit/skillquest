import { DomainError } from '../model/errors';
import type { DrillSpec } from '../model/types';
import { DRILL_LIMITS, QUIZ_TOPICS } from './engine';
import { findTemplate } from './guided';

/** Validates and normalises a drill spec from the quest editor. */
export function validateDrillSpec(spec: DrillSpec): DrillSpec {
  if (spec.kind === 'guided') {
    if (!findTemplate(spec.templateId)) throw new DomainError('INVALID_INPUT');
    return { kind: 'guided', templateId: spec.templateId };
  }
  if (spec.kind !== 'quiz' || !QUIZ_TOPICS.includes(spec.topic)) throw new DomainError('INVALID_INPUT');
  const { length, passScore } = spec;
  if (!Number.isInteger(length) || length < DRILL_LIMITS.minLength || length > DRILL_LIMITS.maxLength) throw new DomainError('INVALID_INPUT');
  if (!Number.isInteger(passScore) || passScore < 1 || passScore > length) throw new DomainError('INVALID_INPUT');
  if (spec.table !== undefined && (spec.topic !== 'times-tables' || !Number.isInteger(spec.table) || spec.table < 2 || spec.table > 15)) throw new DomainError('INVALID_INPUT');
  return { kind: 'quiz', topic: spec.topic, length, passScore, autoApprove: !!spec.autoApprove, ...(spec.table !== undefined ? { table: spec.table } : {}) };
}
