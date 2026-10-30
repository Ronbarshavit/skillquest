import type { LevelInfo } from '@core/index';
import { Badge, ProgressBar } from '@design/index';
import { levelLabel } from '../i18n/he';

/** Level badge + progress bar to the next level. Expects a parent that sets --sq-accent (Card accent). */
export function LevelMeter({ info, compact }: { info: LevelInfo; compact?: boolean }) {
  const label = info.isMax ? 'שלב מקסימלי!' : `${info.xpIntoLevel}/${info.xpForNext} XP לשלב ${info.level + 1}`;
  return (
    <div className={`level-meter ${compact ? 'level-meter--compact' : ''}`}>
      <div className="level-meter__row">
        <Badge tone="accent" icon="star">{levelLabel(info.level)}</Badge>
        {!compact && <span className="muted small">{label}</span>}
      </div>
      <ProgressBar value={info.progress} tone="accent" size={compact ? 'sm' : 'md'} label={label} />
    </div>
  );
}
