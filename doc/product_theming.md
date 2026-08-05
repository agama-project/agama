# Creating a product skin

The Agama web UI can be restyled for a product without touching application
code: colors, logo, and a handful of other roles are set in a single
per-product file, loaded at runtime after Agama's own styles.

This document is about designing and writing that file.
[product_theming_packaging.md](product_theming_packaging.md) covers getting it
onto a medium, which a product can do from its own package without contributing
anything to Agama.

**The short version.** Copy `example.css`, set only the roles the brand needs,
add a light and a dark logo. Measure every contrast pair the checklist lists, in
both themes, with the script rather than the eye. Then look at the result in a
running installer, because half of what goes wrong has no number attached. If the
brand needs something no role covers, propose the role instead of reaching past
it: that contract is the whole reason a skin survives an Agama upgrade.

- [What a skin can change](#what-a-skin-can-change) and
  [what it cannot](#what-a-skin-cannot-change)
- [The roles](#the-roles), and [the steps](#steps) in order
- [Contrast checklist](#contrast-checklist), plus
  [brand colors that cannot be a fill](#when-the-brand-color-cannot-be-a-fill)
  and [elevation in dark mode](#elevation-in-dark-mode-and-why-tooltips-differ)
- [Accessibility rules](#accessibility-rules)
- [Using a font of your own](#using-a-font-of-your-own)
- [Manual checks](#manual-checks), the half that no number reports
- [Extending the role API](#extending-the-role-api), when the roles fall short

## What a skin can change

- **Colors and roles**: a curated set of `--agm-t--*` CSS custom properties, see
  "The roles" below.
- **Logo**: a light and a dark SVG with a transparent background. Match the
  square-ish aspect ratio of Agama's own logos: each usage context (masthead,
  next to the product name, ...) renders the logo at a small fixed width, so a
  very wide or tall logo looks cramped or oversized. Center the drawing inside
  the viewBox too, offsetting the viewBox when it helps: the UI aligns the image
  box and not the ink, so artwork sitting low in an otherwise square box looks
  dropped next to the product name while every other logo looks fine.

## What a skin cannot change

Naming these upfront saves an afternoon of trying:

- **Anything outside the `--agm-t--*` roles.** No raw PatternFly tokens, no
  component-level variables, no selectors of your own. If the brand needs
  something the roles don't cover, that is a gap in the shared token layer: see
  "Extending the role API".
- **The high contrast theme.** It is an accessibility mode, fully governed by
  PatternFly. A skin may brand the accent there and nothing else.
- **The font family in some locales.** Cyrillic, Georgian, Chinese, Japanese and
  Korean get their family assigned per language for script coverage, and that
  takes precedence over the product roles. A skin's typeface does not apply to
  those languages.
- **Line height.** Fixed in the shared layer, with no role. A large jump in the
  font size scale tightens the text block with nothing to compensate with, so
  keep the jump modest or propose a role.
- **The JSON config editor.** It follows the light/dark theme only, so it keeps
  its own colors next to a skinned UI. Expected, not a bug to work around.

## The roles

Two files in the Agama sources define the role set, and both stay current because
the code reads them. `web/src/assets/styles/tokens/_semantic.scss` indexes every
`--agm-t--*` role and maps it onto the PatternFly tokens it drives.
`web/src/assets/products/example-advanced.css` sets every one of them against a
worked example, with `example.css` as the colors-only starting point that covers
most products. Read one of them before writing a skin: a list repeated here would
drift from both, and it is the drift that costs an afternoon.

Between them they cover the brand and link colors, the three surfaces and the
hover background, text and icon colors, borders and the focus ring, the disabled
and tooltip pairs, the five status colors, and then typography, font and icon
sizes, corner radius, and the logo's size and alignment.

Two rules those files demonstrate without stating. Color roles are theme-scoped,
so each goes inside the matching theme block, while everything else goes in a
plain `:root`. And an unset role keeps Agama's own value, so a skin only needs to
be as long as the brand actually requires.

## Steps

1. Start from `example.css`, or `example-advanced.css` for the full role set, and
   add the logo files.
2. Give each theme its own premise. A brand that is natively dark still needs a
   light theme designed as its own thing: an inverted dark palette rarely
   convinces.
3. Measure the checklist below in both themes separately, since a value that
   passes in one can fail in the other, and work through the rows rather than the
   pairs that come to mind.
4. Walk the manual checks in a running installer.

## Contrast checklist

The Agama sources ship a helper for this,
`web/scripts/check-contrast.js <foreground> <background> [--target=4.5]` (run
from the repo root). It reports the ratio against the 3:1, 4.5:1 and 7:1
thresholds and, when a pair fails, suggests a same-hue, same-saturation shade
that passes, which keeps a brand color recognizable instead of drifting to an
unrelated one.

Every row, in light and in dark. Report the measured numbers: they are what a
reviewer can spot-check, and "verified" on its own is not reviewable.

| Foreground | Background | Target |
| --- | --- | --- |
| body text, subtle text | page, raised, floating, hover backgrounds | 4.5 |
| disabled text | page and the disabled background | 4.5 |
| link color | page, raised, hover background | 4.5 |
| each status color | page, raised **and** floating surfaces (inline alerts take the page background, toast alerts the floating one, and status text also lands on cards and other raised surfaces) | 4.5 |
| brand text color | the brand fill **and** its hover shade | 4.5 |
| tooltip text | tooltip background | 4.5 |
| border color | page, raised, floating | 3 |
| focus ring | the surface around it, **and** the ring plus its separator against the fill it sits on | 3 |
| icon color | every surface the icons appear on | 3 |

Two things a palette drawn from an image gets wrong most often: borders (the
reference has no idea how faint its own lines are) and dark-theme elevation
(next section).

The focus ring row reads like a contradiction: a ring in the brand color on a
brand-colored button cannot clear 3:1 against it, and no light ring clears a
light fill. `--agm-t--focus--separator--color` is the way out. The hairline
between ring and fill carries the separation, so what has to pass is the ring
against the surrounding surface, and the separator against both.

### When the brand color cannot be a fill

When a published brand color turns out too light to carry a white label, try a
dark label before inventing a darker brand nobody would recognize, and let the
checklist say which of the two passes. If neither does, take the tool's same-hue
shade for the fill and keep the published color where 3:1 is the bar, such as the
focus ring and the icons, so the brand still appears somewhere verbatim.

### Elevation in dark mode, and why tooltips differ

Containers above the page (cards, menus, popovers, modal dialogs) read *lighter*
than the page in dark mode: raising a surface adds light. PatternFly's dark theme
does it, as do Material and Apple's Dark Mode, so raised or floating going darker
reads as a mistake.

Tooltips are the exception. Transient and small, they want maximum separation
from what they cover, so PatternFly and Material both treat them as an *inverted*
surface rather than an elevated one: near-white with dark text in dark mode.
Light, dark and inverted are all defensible here. What decides it is the
tooltip's own text contrast, in the checklist, plus whether it separates from
what is behind it: on a very dark page, a darker tooltip leaves the shadow and
the arrow carrying the whole edge. That can be deliberate, so look at it on a
busy screen. No WCAG criterion covers surface-to-surface separation, which is why
this is a design call rather than a number.

**Judge separation on absolute luminance, not on a ratio.** The same ratio means
far less separation near black than near white. One skin separated its light
surfaces by 0.113 and 0.078 of relative luminance and its dark ones by 0.006 and
0.010, at comparable ratios: the dark theme cleared "lighter than the page" and
still read as a single flat field, leaving borders and shadows to carry every
edge. If dark looks flat next to light, the fix is more light, not a better
ratio.

## Accessibility rules

- **Color is never the only channel.** The five status roles have to stay
  distinguishable from each other, not just from their background. Check the
  red/green pairs (danger against success, caution against danger) as they would
  read with a color vision deficiency, and resist collapsing several statuses
  into the brand color.
- **And distinguishable from the brand, link and focus colors.** A status color
  that matches the link color disappears the moment the two meet: an icon
  signalling an issue next to a heading that is also a link reads as decoration.
  Where they collide, move the brand side rather than the status, since the
  status meaning is conventional and the brand is not.
- **Text has to survive resizing.** Keep the size roles in relative units and
  check the UI at 200% zoom. Also check 1024x768: some install screens run at
  that size, and Agama deliberately gives them the wide layout.
- **A font family has to cover the translated UI.** A face that stops at Latin
  makes a translated screen switch faces mid-sentence, and a single-weight face
  leaves headings and emphasis with nothing to render with. Check a verbose
  locale (German, Russian) too: long strings plus a wide face is where text
  starts to truncate.
- **Disabled has to look disabled and stay readable.** Both at once, which is
  why the disabled pair is in the checklist.
- **Do not fight the operating system.** Forced-colors mode is not a place to
  reassert a palette, any more than the high contrast theme is.

## Using a font of your own

A skin can bring its own typeface: a stylesheet may carry its own `@font-face`
declaration, so this needs no change in Agama.

```css
@font-face {
  font-family: "My Product Mono";
  font-weight: 100 900; /* claim only what the file provides: claiming more gets
                           bold synthesized or ignored */
  font-style: normal;
  src: url("./fonts/MyProductMono.woff2") format("woff2");
}

:root {
  --agm-t--font--family--mono: "My Product Mono", "SUSE Mono", monospace;
}
```

Two faces at the same nominal size rarely look the same size: a pixel display
face fills most of its em, a typewriter face has a small x-height. When the
mismatch is the face rather than the scale, `size-adjust` is the lever, since it
corrects the face alone:

```css
@font-face {
  font-family: "My Display Face";
  src: url("./fonts/MyDisplayFace.woff2") format("woff2");
  size-adjust: 90%; /* its capitals fill 0.875em, a text face's fill 0.66em */
}
```

Set it from the ratio of cap heights, then look at it. Advance width scales along
with it, so a body face 25% larger needs 25% more width and the summary columns
run out first; a display face is bounded by the longest heading, which shows up
in the breadcrumb trail.

The size roles stay available for a brand that genuinely wants larger or smaller
text than Agama's. Choose between the two deliberately: the scale moves every
text in the UI, so reaching for it to rescue a single font also makes the skin
hard to compare with any other.

Always leave fallbacks after the new family, so a font that fails to load
degrades to a bundled one rather than to the browser default. Agama bundles
"SUSE Text", "SUSE Display", "SUSE Mono", "Roboto Mono" and the Noto Sans
families. A family installed on the machine running the browser also works while
designing, but the official ISO ships only the curated set Agama's own defaults
need, so a typeface of your own has to travel with the skin.

Where the font file itself lives, its license, and its size are packaging
concerns: see
[product_theming_packaging.md](product_theming_packaging.md).

## Manual checks

Contrast numbers are necessary and not sufficient: a skin is done when someone
has looked at it, in light, dark and high contrast. Drive the real installer
rather than a single static page.

Where the roles actually surface:

- product selection page and masthead (logo sizes and alignment),
- a form with an invalid field (danger color, focus ring, disabled controls),
- a long storage table (text size, truncation, borders),
- a modal dialog, a menu, a popover, a tooltip (floating surfaces),
- toast and inline alerts, all five statuses,
- a progress screen (accent on large surfaces),
- an empty state and a breadcrumb (subtle text).

The quickest way to iterate is to write the skin straight into the served
directory of a running installer, described in
[product_theming_packaging.md](product_theming_packaging.md): the reload picks it
up, with no rebuild in between.

## Extending the role API

Every role is documented and resolved in one place:
`web/src/assets/styles/tokens/_semantic.scss` maps each `--agm-t--*` role onto
the PatternFly tokens it affects, with the current Agama value as the fallback
default. A product file must only ever set `--agm-t--*` roles, never a raw
PatternFly or component-level variable directly.

Adding a role that's genuinely missing:

1. Add the role to `_semantic.scss`'s role-index comment and resolve it at its
   real consumption point (a PF global token in `_semantic.scss`, or a
   component-level override in `_patternfly-overrides.scss`), with the current
   Agama value as the fallback so leaving it unset changes nothing.
2. Document it with a worked example in `example-advanced.css`.
3. Before assuming one token covers a whole category (e.g. "corner radius"),
   check whether PatternFly actually splits that concern into several independent
   tiers under the hood; grep the component CSS for the relevant property and
   trace each occurrence back to its root token.

This one does go through Agama: it changes the shared layer that every product
depends on.
