export const CHILD_AVATARS = ['🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🦉', '🚀', '⚽', '🎨', '🌟', '🐻'];

/** Emoji avatar chips (radio group). */
export function AvatarPicker({ value, onChange, label = 'דמות' }: { value: string; onChange: (a: string) => void; label?: string }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={label}>
      {CHILD_AVATARS.map((a) => (
        <button key={a} type="button" role="radio" aria-checked={value === a} aria-label={`דמות ${a}`} className="chip chip--emoji" onClick={() => onChange(a)}>
          {a}
        </button>
      ))}
    </div>
  );
}
