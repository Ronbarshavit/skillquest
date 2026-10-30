import type { Figure as FigureSpec } from '@core/index';

const W = 240;
const H = 170;
const PAD = 30;

/** Fits a w×h shape into the viewBox, keeping proportions (but never too thin to read). */
function fit(w: number, h: number) {
  const ratio = Math.min(3, Math.max(1 / 3, w / h));
  const maxW = W - PAD * 2, maxH = H - PAD * 2;
  let pw = maxW, ph = maxW / ratio;
  if (ph > maxH) { ph = maxH; pw = maxH * ratio; }
  return { pw, ph, x: (W - pw) / 2, y: (H - ph) / 2 };
}

const Label = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fig__label" direction="ltr">{children}</text>
);

function poly(points: [number, number][]) {
  return points.map((p) => p.join(',')).join(' ');
}

/** Inline SVG figures for geometry/fraction questions. Colours come from token-based classes. */
export function Figure({ figure }: { figure: FigureSpec }) {
  return (
    <svg className="fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(figure)}>
      {draw(figure)}
    </svg>
  );
}

function describe(f: FigureSpec): string {
  switch (f.shape) {
    case 'rect': return `מלבן ${f.w} על ${f.h} ${f.unit}`;
    case 'triangle': return `משולש, בסיס ${f.base} וגובה ${f.height} ${f.unit}`;
    case 'right-triangle': return `משולש ישר־זווית, ניצבים ${f.a} ו־${f.b} ${f.unit}`;
    case 'angle': return 'זווית';
    case 'triangle-angles': return `משולש עם זוויות ${f.a}° ו־${f.b}°`;
    case 'fraction-bar': return `פס מחולק ל־${f.d} חלקים, ${f.n} צבועים`;
    case 'polygon': return 'מצולע';
  }
}

function draw(f: FigureSpec) {
  switch (f.shape) {
    case 'rect': {
      const { pw, ph, x, y } = fit(f.w, f.h);
      return (
        <>
          <rect x={x} y={y} width={pw} height={ph} className="fig__shape" rx={2} />
          <Label x={x + pw / 2} y={y + ph + 15}>{`${f.w} ${f.unit}`}</Label>
          <Label x={x + pw + 6} y={y + ph / 2} anchor="start">{`${f.h}`}</Label>
        </>
      );
    }
    case 'right-triangle': {
      const { pw, ph, x, y } = fit(f.a, f.b);
      const p: [number, number][] = [[x, y + ph], [x + pw, y + ph], [x, y]];
      const m = 12;
      return (
        <>
          <polygon points={poly(p)} className="fig__shape" />
          <polyline points={poly([[x, y + ph - m], [x + m, y + ph - m], [x + m, y + ph]])} className="fig__mark" />
          <Label x={x + pw / 2} y={y + ph + 15}>{`${f.a} ${f.unit}`}</Label>
          <Label x={x - 6} y={y + ph / 2} anchor="end">{`${f.b}`}</Label>
        </>
      );
    }
    case 'triangle': {
      const { pw, ph, x, y } = fit(f.base, f.height);
      const apexX = x + pw * 0.35;
      return (
        <>
          <polygon points={poly([[x, y + ph], [x + pw, y + ph], [apexX, y]])} className="fig__shape" />
          <line x1={apexX} y1={y} x2={apexX} y2={y + ph} className="fig__dash" />
          <Label x={x + pw / 2} y={y + ph + 15}>{`${f.base} ${f.unit}`}</Label>
          <Label x={apexX + 6} y={y + ph / 2} anchor="start">{`h = ${f.height}`}</Label>
        </>
      );
    }
    case 'angle': {
      const vx = 70, vy = 130, len = 120;
      const rad = (f.deg * Math.PI) / 180;
      const ex = vx + len * Math.cos(rad), ey = vy - len * Math.sin(rad);
      const r = 28;
      const ax = vx + r * Math.cos(rad), ay = vy - r * Math.sin(rad);
      return (
        <>
          <path d={`M ${vx + r} ${vy} A ${r} ${r} 0 0 0 ${ax} ${ay}`} className="fig__arc" />
          <line x1={vx} y1={vy} x2={vx + len + 30} y2={vy} className="fig__ray" />
          <line x1={vx} y1={vy} x2={ex} y2={ey} className="fig__ray" />
          <circle cx={vx} cy={vy} r={4} className="fig__dot" />
        </>
      );
    }
    case 'triangle-angles': {
      // Base along the bottom; angles a (left) and b (right); third angle unknown.
      const A = (f.a * Math.PI) / 180, B = (f.b * Math.PI) / 180;
      const base = 1;
      const left = (base * Math.sin(B)) / Math.sin(A + B); // side from left vertex to apex
      const apex: [number, number] = [left * Math.cos(A), left * Math.sin(A)];
      const xs = [0, base, apex[0]], ys = [0, 0, apex[1]];
      const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
      const s = Math.min((W - PAD * 2) / (maxX - minX), (H - PAD * 2) / maxY);
      const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = H - PAD + 5;
      const P = (px: number, py: number): [number, number] => [ox + px * s, oy - py * s];
      const p0 = P(0, 0), p1 = P(base, 0), p2 = P(apex[0], apex[1]);
      return (
        <>
          <polygon points={poly([p0, p1, p2])} className="fig__shape" />
          <Label x={p0[0] + 26} y={p0[1] - 10}>{`${f.a}°`}</Label>
          <Label x={p1[0] - 26} y={p1[1] - 10}>{`${f.b}°`}</Label>
          <Label x={p2[0]} y={p2[1] + 22}>?</Label>
        </>
      );
    }
    case 'fraction-bar': {
      const x = 20, y = 55, w = W - 40, h = 60, cw = w / f.d;
      return (
        <>
          {Array.from({ length: f.d }, (_, i) => (
            <rect key={i} x={x + i * cw} y={y} width={cw} height={h} className={i < f.n ? 'fig__part fig__part--on' : 'fig__part'} />
          ))}
        </>
      );
    }
    case 'polygon': {
      const cx = W / 2, cy = H / 2, r = 65;
      const pts: [number, number][] = Array.from({ length: f.sides }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / f.sides;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
      return <polygon points={poly(pts)} className="fig__shape" />;
    }
  }
}
