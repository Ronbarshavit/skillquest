import { Icon } from '@design/index';

/** Always-visible disclaimer wherever money is entered: the wallet is a simulation. */
export function PretendMoneyNote() {
  return (
    <p className="notice notice--pretend" role="note">
      <Icon name="coin" size="sm" />
      <span><strong>כסף דמיוני – ללא תשלומים אמיתיים.</strong> הארנק וההפקדות הם הדמיה בלבד: שום כסף לא עובר ושום אמצעי תשלום לא נשמר.</span>
    </p>
  );
}
