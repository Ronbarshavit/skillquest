export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Accessible on/off switch (role="switch"). The thumb moves with logical properties, so it works in RTL. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="sq-switch" onClick={() => onChange(!checked)}>
      <span className="sq-switch__thumb" />
    </button>
  );
}
