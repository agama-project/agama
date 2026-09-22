#!/usr/bin/env node
/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

/*
 * Computes the WCAG contrast ratio between pairs of colors, e.g. when
 * picking --agm-t--* role values for a product override
 * (web/src/assets/products/<id>.css). Usage:
 *
 *   check-contrast.js <hex1> <hex2> [<hex3> <hex4> ...] [--target=4.5]
 *
 * Each pair prints its ratio and whether it clears the common WCAG 2.x
 * thresholds: 3:1 (UI components / focus rings / large text, SC 1.4.11 and
 * 1.4.3), 4.5:1 (normal text, SC 1.4.3 AA), 7:1 (normal text, SC 1.4.6 AAA).
 * When a pair fails --target (default 4.5), it also recommends a same-hue,
 * same-saturation shade of the first color (lighter or darker, whichever is
 * the smaller adjustment) that clears it against the fixed second color.
 *
 * Formula: WCAG 2.x relative luminance and contrast ratio, as specified at
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance and
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio. The sRGB-to-linear
 * coefficients (0.2126 / 0.7152 / 0.0722) and the two-part linearization
 * threshold (0.03928 / 12.92) come directly from that definition.
 *
 * Existing libraries such as https://www.npmjs.com/package/wcag-contrast and
 * https://colorjs.io/ already implement this formula and could have been
 * reused, with the same-hue/saturation shade suggestion added on top; this
 * script reimplements it standalone instead, to avoid adding a dependency
 * used only by this one theming script.
 */

function hexToRgb(hex) {
  const clean = hex.replace(/^#/, "");
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

function relativeLuminance([r, g, b]) {
  const linearize = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(rgbA, rgbB) {
  const [lighter, darker] = [relativeLuminance(rgbA), relativeLuminance(rgbB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Standard RGB <-> HSL conversions (each channel 0-255 in, 0-255 out; h/s/l
// internally 0-1), used to hold hue and saturation fixed while scanning
// lightness for a passing shade.
function rgbToHsl([r, g, b]) {
  [r, g, b] = [r, g, b].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

// Scans lightness (same hue/saturation as rgbA) in both directions from its
// current value, returning the closest shade that clears `target` against
// the fixed rgbB, or null if neither direction reaches it even at the
// extremes (0 or 1).
function recommendShade(rgbA, rgbB, target) {
  const [h, s, l0] = rgbToHsl(rgbA);
  const step = 0.005;
  const passes = (l) => contrastRatio(hslToRgb([h, s, l]), rgbB) >= target;

  let darker = null;
  for (let l = l0; l >= 0; l -= step) {
    if (passes(l)) {
      darker = l;
      break;
    }
  }
  let lighter = null;
  for (let l = l0; l <= 1; l += step) {
    if (passes(l)) {
      lighter = l;
      break;
    }
  }
  if (darker === null && lighter === null) return null;
  const chosen =
    darker === null ? lighter : lighter === null ? darker : Math.abs(darker - l0) <= Math.abs(lighter - l0) ? darker : lighter;
  const rgb = hslToRgb([h, s, chosen]);
  return { hex: rgbToHex(rgb), ratio: contrastRatio(rgb, rgbB) };
}

function report(hexA, hexB, target) {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  const ratio = contrastRatio(rgbA, rgbB);
  const verdict = (threshold, label) => `${ratio >= threshold ? "PASS" : "fail"} ${label}`;
  console.log(
    `${hexA} vs ${hexB}: ${ratio.toFixed(2)}:1  ` +
      `[${verdict(3, "3:1 UI/large-text")}]  ` +
      `[${verdict(4.5, "4.5:1 text AA")}]  ` +
      `[${verdict(7, "7:1 text AAA")}]`,
  );
  if (ratio < target) {
    const suggestion = recommendShade(rgbA, rgbB, target);
    if (suggestion) {
      console.log(
        `  suggestion: #${suggestion.hex} instead of #${hexA} reaches ` +
          `${suggestion.ratio.toFixed(2)}:1 against #${hexB} (same hue/saturation, ${target}:1 target)`,
      );
    } else {
      console.log(`  no same-hue/saturation shade of #${hexA} reaches ${target}:1 against #${hexB}`);
    }
  }
}

const rawArgs = process.argv.slice(2);
const targetArg = rawArgs.find((a) => a.startsWith("--target="));
const target = targetArg ? parseFloat(targetArg.slice("--target=".length)) : 4.5;
const args = rawArgs.filter((a) => !a.startsWith("--target="));

if (args.length < 2 || args.length % 2 !== 0) {
  console.error(
    "Usage: check-contrast.js <hex1> <hex2> [<hex3> <hex4> ...] [--target=4.5]",
  );
  process.exit(1);
}
for (let i = 0; i < args.length; i += 2) report(args[i], args[i + 1], target);
