import type { Child } from '@core/index';

export function ChildPicker({ kids, value, onChange }: { kids: Child[]; value: string; onChange: (id: string) => void }) {
  if (kids.length < 2) return null;
  return (
    <div className="chip-row" role="radiogroup" aria-label="בחירת ילד או ילדה">
      {kids.map((k) => (
        <button key={k.id} type="button" role="radio" aria-checked={k.id === value} className="chip" onClick={() => onChange(k.id)}>
          <span aria-hidden>{k.avatar}</span> {k.name}
        </button>
      ))}
    </div>
  );
}
