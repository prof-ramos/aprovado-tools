import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// WCAG 2.1 contrast of the secondary text tokens against the surfaces they sit on.
const luminance = hex => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (css, name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];

for (const surface of ['popup', 'sidepanel']) {
  test(`${surface} secondary text tokens reach 4.5:1 on every surface`, () => {
    const css = readFileSync(new URL(`../${surface}/${surface}.css`, import.meta.url), 'utf8');
    const backgrounds = ['bg-color', 'surface-bg', 'surface-hover', 'surface-raised'].map(n => token(css, n));
    for (const text of ['text-main', 'text-muted', 'text-faint']) {
      for (const bg of backgrounds) {
        const value = ratio(token(css, text), bg);
        assert.ok(value >= 4.5, `${surface} --${text} ${token(css, text)} on ${bg}: ${value.toFixed(2)}:1`);
      }
    }
  });

  test(`${surface} accent text and primary button keep 4.5:1`, () => {
    const css = readFileSync(new URL(`../${surface}/${surface}.css`, import.meta.url), 'utf8');
    for (const bg of ['bg-color', 'surface-bg', 'surface-raised']) {
      const value = ratio(token(css, 'accent'), token(css, bg));
      assert.ok(value >= 4.5, `${surface} --accent on --${bg}: ${value.toFixed(2)}:1`);
    }
    const label = css.match(/\.btn-primary\s*\{[^}]*?color:\s*(#[0-9a-f]{6})/i)[1];
    for (const bg of ['accent', 'accent-hover']) {
      if (!css.includes(`--${bg}:`)) continue;
      const value = ratio(label, token(css, bg));
      assert.ok(value >= 4.5, `${surface} primary label ${label} on --${bg}: ${value.toFixed(2)}:1`);
    }
  });
}
