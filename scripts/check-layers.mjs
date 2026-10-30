// Architecture guard (runs before every build). Fails on:
//  1. Layer boundary violations:
//     - src/core   may not import react, react-dom, react-router, @design, @app, or anything outside src/core
//     - src/design may not import @core or @app (it is presentational and domain-agnostic)
//     - src/app    may only import core/design through their public index files
//  2. Hard-coded colours (hex/rgb/hsl) in src/design or src/app outside src/design/tokens/
//  3. Physical (non-RTL-safe) CSS: margin-left/right, padding-left/right, left:/right:, border-left/right,
//     text-align:left/right, float:left/right.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f));
const errors = [];
const importRe = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;

for (const f of files) {
  const rel = relative(root, f);
  const text = readFileSync(f, 'utf8');
  const layer = rel.split('/')[1];
  const imports = [...text.matchAll(importRe)].map((m) => m[1] ?? m[2]);
  for (const imp of imports) {
    if (layer === 'core') {
      if (/^(react|react-dom|react-router|react-router-dom)(\/|$)/.test(imp) || imp.startsWith('@design') || imp.startsWith('@app'))
        errors.push(`${rel}: core must not import "${imp}"`);
      if (imp.startsWith('.') && !join(f, '..', imp).startsWith(join(src, 'core')))
        errors.push(`${rel}: core must not import outside src/core ("${imp}")`);
    }
    if (layer === 'design' && (imp.startsWith('@core') || imp.startsWith('@app') || /\/(core|app)\//.test(imp)))
      errors.push(`${rel}: design must not import "${imp}"`);
    if (layer === 'app' && /^@(core|design)\//.test(imp) && !/^@(core|design)\/index$/.test(imp))
      errors.push(`${rel}: app must import "${imp.split('/')[0]}/index" (public API), not "${imp}"`);
  }
  if ((layer === 'design' || layer === 'app') && !rel.startsWith('src/design/tokens/')) {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(code.replace(/&#\d+;/g, '')) || /\b(rgba?|hsla?)\(/.test(code))
      errors.push(`${rel}: hard-coded colour – use a var(--sq-color-*) token`);
  }
  if (f.endsWith('.css') || f.endsWith('.tsx')) {
    const phys = text.match(/\b(margin|padding|border)-(left|right)\b|(?<![\w-])(left|right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)|\b(marginLeft|marginRight|paddingLeft|paddingRight)\b/);
    if (phys) errors.push(`${rel}: physical CSS "${phys[0]}" – use logical properties (inline-start/end)`);
  }
}

if (errors.length) {
  console.error('Layer check failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`Layer check OK (${files.length} files)`);
