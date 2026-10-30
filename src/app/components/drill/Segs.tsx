import { Fragment, useEffect, useState } from 'react';
import type { Seg } from '@core/index';

/** Stacked fraction (numerator over denominator), read as "n/d" by screen readers. */
export function Frac({ n, d }: { n: number; d: number }) {
  return (
    <span className="frac" role="math" aria-label={`${n}/${d}`}>
      <span className="frac__n" aria-hidden>{n}</span>
      <span className="frac__d" aria-hidden>{d}</span>
    </span>
  );
}

/**
 * Renders generated text segments with the right direction per part:
 * Hebrew flows RTL, math/expressions are isolated LTR (bdi dir=ltr), English gets lang=en.
 */
export function Segs({ segs, blank }: { segs: Seg[]; blank?: Seg[] | null }) {
  return (
    <>
      {segs.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && needsSpace(segs[i - 1], s) && ' '}
          <SegView seg={s} blank={blank} />
        </Fragment>
      ))}
    </>
  );
}

const needsSpace = (a: Seg, b: Seg) => !(b.t === 'text' && /^[.,:;!?)]/.test(b.v)) && !(a.t === 'text' && /[(]$/.test(a.v));

function SegView({ seg, blank }: { seg: Seg; blank?: Seg[] | null }) {
  switch (seg.t) {
    case 'text':
      return <span>{seg.v}</span>;
    case 'math':
      return <bdi dir="ltr" className="math">{seg.v}</bdi>;
    case 'frac':
      return <bdi dir="ltr" className="math"><Frac n={seg.n} d={seg.d} /></bdi>;
    case 'en':
      return <bdi dir="ltr" lang="en" className="en">{seg.v}</bdi>;
    case 'emoji':
      return <span className="emoji" aria-hidden>{seg.v}</span>;
    case 'blank':
      return blank ? <span className="blank blank--filled"><Segs segs={blank} /></span> : <span className="blank" aria-label="מקום ריק">&nbsp;</span>;
    case 'expr':
      return <bdi dir="ltr" className="expr"><Segs segs={seg.parts} blank={blank} /></bdi>;
  }
}

/** All English text a question may read aloud (segments marked `say`). */
export function speakable(segs: Seg[]): string {
  const out: string[] = [];
  const walk = (xs: Seg[]) => xs.forEach((s) => (s.t === 'en' && s.say ? out.push(s.v) : s.t === 'expr' ? walk(s.parts) : undefined));
  walk(segs);
  return out.join(' ');
}

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

/** "Listen" button using the browser's English voice. Hidden when the device can't speak. */
export function ListenButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(canSpeak()), []);
  if (!ok || !text) return null;
  const say = () => {
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.85;
      const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('en'));
      if (voice) u.voice = voice;
      synth.speak(u);
    } catch {
      setOk(false);
    }
  };
  return (
    <button type="button" className="listen-btn" onClick={say} aria-label="השמעה באנגלית">
      <span aria-hidden>🔊</span>
    </button>
  );
}
