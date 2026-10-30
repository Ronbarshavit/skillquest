import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Icon, ScreenHeader, Switch, TextField, categoryColorKeys, categoryColorVars } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useToast } from '../components/Toast';
import { describeError } from '../i18n/he';

const EMOJI_SUGGESTIONS = ['♟️', '🍳', '💻', '🎨', '🧩', '🌱', '🔬', '🏊'];
const COLOR_NAMES: Record<string, string> = { sky: 'תכלת', grape: 'סגול', mint: 'מנטה', coral: 'אלמוג', sun: 'שמש', rose: 'ורוד', teal: 'טורקיז', slate: 'אפור' };

export function InterestAreas() {
  const sel = useSelectors();
  const nav = useNavigate();
  const toast = useToast();
  const cats = sel.allCategories();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('♟️');
  const [color, setColor] = useState<string>('teal');

  const add = (e: FormEvent) => {
    e.preventDefault();
    try {
      const c = actions.addCategory({ name, icon, colorKey: color });
      setName('');
      toast(`התחום "${c.name}" נוסף – עכשיו אפשר להוסיף לו משימות`);
      nav(`/parent/interests/${c.id}`);
    } catch (err) {
      toast(describeError(err), 'danger');
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title="תחומי עניין" subtitle="הילדים רואים רק תחומים פעילים" onBack={() => nav('/parent')} />
      <main className="screen__body">
        <ul className="stack">
          {cats.map((c) => (
            <Card as="li" key={c.id} accent={c.colorKey} padding="sm" className={`interest-row ${c.enabled ? '' : 'interest-row--off'}`}>
              <span className="interest-row__icon" aria-hidden>{c.icon}</span>
              <Link to={`/parent/interests/${c.id}`} className="interest-row__text">
                <strong>{c.name}</strong>
                <span className="small muted">
                  {sel.questsIn(c.id).length} משימות · {c.builtIn ? 'ברירת מחדל' : 'מותאם אישית'}
                </span>
              </Link>
              {!c.enabled && <Badge>כבוי</Badge>}
              <Switch checked={c.enabled} label={`הפעלת ${c.name}`} onChange={(v) => actions.setCategoryEnabled(c.id, v)} />
            </Card>
          ))}
        </ul>

        <Card className="stack" padding="md">
          <h2><Icon name="plus" size="sm" /> תחום חדש</h2>
          <form className="stack" onSubmit={add}>
            <TextField label="שם התחום" placeholder="למשל: שחמט, בישול, תכנות, ציור" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
            <div className="stack stack--tight">
              <TextField label="אייקון (אימוג׳י)" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
              <div className="chip-row" role="radiogroup" aria-label="הצעות לאייקון">
                {EMOJI_SUGGESTIONS.map((em) => (
                  <button key={em} type="button" role="radio" aria-checked={icon === em} className="chip chip--emoji" onClick={() => setIcon(em)}>{em}</button>
                ))}
              </div>
            </div>
            <fieldset className="swatches">
              <legend className="sq-field__label">צבע</legend>
              {categoryColorKeys.map((k) => {
                const v = categoryColorVars(k);
                return (
                  <button key={k} type="button" role="radio" aria-checked={color === k} aria-label={COLOR_NAMES[k]} className="swatch" style={{ background: v.accent }} onClick={() => setColor(k)} />
                );
              })}
            </fieldset>
            <Button type="submit" icon="plus" block>הוספת תחום</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
