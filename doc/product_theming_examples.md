# Worked examples

A companion to [product_theming.md](product_theming.md): that document has the
rules, this one has two whole skins, each from the prompt that started it to the
problems it ran into. Both dress products that do not exist, and neither ships
with Agama: what is worth keeping is the account, not the color values.

They are deliberately different cases. Blue Sombrero starts from a published
brand with a palette and a typography pairing. Phosphor 86 starts from two
pictures and a mood, which is the harder case and the one that fights more.

Neither was written in one pass. Each section below ends with what came back from
looking at the running installer, which is the part no checklist produces.

Both prompts sit on top of the template and add only what their brief needs, with
one exception: each opens the rule about not working around the role set, quoted
from the template rather than reworded, since it is what decides the outcome when
a brief meets a limit. Anything else the template says applies to both and is not
repeated here, so a change to the template does not leave this chapter stale.

## Example 1: a published brand

**The brief.** Dress a fictional enterprise product in the official Fedora
Project brand, borrowed as a nod to the project whose PatternFly design system
Agama builds on. Use the palette as published wherever the checklist allows it,
and do not invent brand colors.

**The prompt**, on top of the template in
[product_theming.md](product_theming.md#prompting-an-ai-to-do-this):

> Create a product skin for `BlueSombrero` using the official Fedora brand
> palette and typography: main colors Dark Fedora Blue `#294172`, Fedora Blue
> `#3c6eb4`, New Fedora Blue `#51a2da`, Freedom Purple `#a07cbc`, Friends
> Magenta `#db3279`, Features Orange `#e59728`, First Green `#79db32`, plus the
> published tints, the neutrals, and the color-blind safe values. Open Sans for
> body text, Montserrat for titling.
>
> Use the product's own colors verbatim wherever the checklist allows it. Where a
> published color is too light for a white button label, keep the color and make
> the label dark instead of inventing a darker brand. Where neither label passes,
> use the tool's same-hue darkened shade and say so.
>
> Prefer the published color-blind safe values whenever two statuses would
> converge under protanopia or deuteranopia.
>
> Montserrat is not bundled by Agama, so the skin carries it: declare an
> `@font-face` pointing next to the stylesheet, and note in a comment that a real
> product ships the file from its own package.
>
> Leave corner radius, sizes and spacing unset: this skin shows what a product
> gets for free.
>
> **If something can't be done with the current `--agm-t--*` role set, don't
> get creative.** Do not set a raw PatternFly token or component-variable
> override from the product CSS file, and do not work around the "products
> only set `--agm-t--*` roles" contract. Stop and present a plan for
> extending the shared token API instead, and get that plan approved before
> writing any code.

**What fought back.**

- **The lighter blue is unreadable as text.** `#51a2da` measures 2.79:1 on white.
  It stays in the palette as a dark-theme status, while the light theme uses the
  same hue taken down until it clears AA. Same treatment for the other statuses,
  each darkened or lightened along its own hue, with the source brand color named
  in a comment next to it.
- **The dark theme had to be invented.** The brand publishes tints and shades,
  not dark-theme surfaces. Inverting the light theme turned the blues gray, so
  the dark theme is a night-blue page (the Dark Fedora Blue hue taken down to
  page darkness) with the published light tints as ink.
- **The tooltip is inverted rather than elevated.** On a page that dark, a
  slightly lighter tooltip leans on its shadow to be seen at all. It is near
  white with dark text instead.

**What it left alone**, which is the point of this example: corner radius, the
size scale, spacing, icon sizes. A product that sets colors, a logo and a font
family gets a coherent installer, and that is most products.

## Example 2: a mood, not a brand

**The brief.** A retro terminal look for a fictional product, drawn from two
reference images rather than a brand guideline.

**The prompt**, again on top of the template:

> Create a product skin for `Phosphor86` using this brand: a retro terminal look,
> drawn from these two references:
> `https://www.scummvm.org/data/screenshots/dreamweb/dreamweb/dreamweb_dos_en_1_10_full.png`
> (a DOS-era phosphor-green terminal: green text and a thin green frame on a dark
> casing) and
> `https://png.pngtree.com/background/20210712/original/pngtree-retro-cyberpunk-style-80s-sci-fi-futuristic-with-laser-grid-background-picture-image_1177895.jpg`
> (an 80s neon grid: deep indigo fading to maroon, magenta and yellow neon
> lines). Read the images themselves rather than working from their descriptions,
> and decide what role each one plays before picking values.
>
> This look is natively dark, so give each theme its own premise rather than
> inverting one into the other, and say what the premises are.
>
> The look is monospace and square-cornered, so it also touches the typography,
> radius and logo roles. If it needs a typeface Agama does not bundle, the skin
> carries it.
>
> **If something can't be done with the current `--agm-t--*` role set, don't
> get creative.** Do not set a raw PatternFly token or component-variable
> override from the product CSS file, and do not work around the "products
> only set `--agm-t--*` roles" contract. Stop and present a plan for
> extending the shared token API instead, and get that plan approved before
> writing any code.

The last paragraph earned its place immediately: it turned "make the buttons
bigger" into a plan for a new role rather than a PatternFly token set behind the
contract's back. That plan is still pending, so control labels in this skin read
smaller than the text around them.

### The decisions the images do not make

- **Premises.** Dark is the screen: phosphor green on deep indigo, a green border
  as the CRT frame, magenta as the accent. Light is the printout of that session:
  dark green ink on warm paper, a printed rule as the border, the same magenta,
  so the two are recognizably one product.
- **Elevation.** The indigo needs lighter steps above the page, not the darker
  ones a "terminal" instinct suggests.
- **Statuses.** The reference indicator lights are decorative; the status roles
  are functional. They keep conventional hues tuned to the palette, so a danger
  alert still reads as danger.
- **Disabled text.** In dark it drops the green entirely: a dimmer green reads as
  "quieter text" rather than as disabled.

### What fought back

**Borders taken from a photograph.** Two measured 1.69:1 and 1.51:1 against their
backgrounds, which is roughly invisible: a picture has no idea how faint its own
lines are. A third passed against the page (3.20:1) and failed against the raised
surface behind the masthead (2.82:1), which is why the checklist measures a border
against every surface it can land on.

**A tooltip that passed and could not be seen.** Darker than the page, as a
tooltip in a terminal wants to be, on a page already close to black: nothing but
its shadow separated it from what it covered. It is inverted now, phosphor green
with indigo text. No WCAG criterion covers surface-to-surface separation, so this
is a design call a checklist cannot make.

**Two status pairs that merge for some readers.** Simulating deuteranopia put the
neon pink danger on the phosphor green success; under protanopia the light
theme's red and green collapsed onto the same hue with nearly the same lightness.
Danger moved to vermilion (`#ff8f66`), light success went darker (`#07502c`). One
weak pair is left on purpose: the info blue and the success green sit close under
tritanopia, and every attempt to spread them pushed the info blue into the magenta
accent under deuteranopia, which is commoner and more confusing.

**A status color that collided with the link color.** Links were the neon yellow
of the reference, which is also the caution color, and headings in the overview
are links: the icon signalling an issue rendered in exactly the color of the
heading beside it and read as decoration. Links moved to the magenta accent, and
the icon color role followed them, so an icon and the heading it labels read as
one item while status icons keep their own color.

**A dark theme that measured elevated and looked flat.** Raised and floating were
lighter than the page and still read as one field. The ratios said the two themes
were comparable (light 1.13 and 1.08, dark 1.10 and 1.18); absolute luminance
said the light theme separated its surfaces by 0.113 and 0.078 against 0.006 and
0.010 in dark. The dark steps went up to `#241b4d` and `#32285f`, which pushed the
custom status onto a lighter magenta to keep 4.5:1 on a floating surface.

**A pixel typeface that had to be talked down to headings.** An authentic CRT face
everywhere is the temptation, and for running text in a translated installer it
breaks down: one weight, so emphasis has nothing to render with; strokes that
fall apart at fractional sizes; coverage that stops around Latin, so a screen
switches faces mid-sentence. Headings are short, large and few, which is the
budget such a face fits. So headings are
[Sixtyfour](https://fonts.google.com/specimen/Sixtyfour) and running text is
[Cutive Mono](https://fonts.google.com/specimen/CutiveMono), both shipped with
the skin under the SIL Open Font License, with ordinary screen monospaces behind
them in the fallback chain and for data such as device names and addresses.

**Font sizes, which took the longest.** Two faces at the same nominal size are
not the same size: the pixel face fills most of its em, the typewriter face has a
small x-height. The skin first raised the whole size scale to compensate, which
is wrong twice over. It moves every text in the UI to accommodate one font, and
it brings width along: the typewriter face has the same advance as any monospace,
so scaling it up 25% widens every line by 25%, and the summary columns run out
before the text gets comfortable. The scale went back to Agama's values and each
face carries its own `size-adjust`, set from cap heights and then checked against
the longest sentence in the UI.

Nothing in the prompt above warned about any of that, which is why it took so
long. The template asks for `size-adjust`, for measured cap heights and for
advance widths because this is where it learned to, and the prompt quoted here is
left as it was sent rather than backfilled with the answer.

### What was Agama's fault, not the skin's

A skin that pairs two visibly different families and moves the icon color off the
body text color makes assumptions visible that a default skin hides. This one
turned up several, all fixed in Agama rather than worked around in the file: a
breadcrumb trail rendering in two typefaces because only its last item is a
heading, a summary icon stranded on its own line when a long title wrapped, and
two icons in the same row coming from different components at different sizes.

Worth knowing when writing a skin: if something looks wrong and no role explains
it, the markup may be the reason. Report it rather than bending the skin around
it.

## Verifying either of them

Contrast first, with the checker rather than the eye:

```
web/scripts/check-contrast.js <foreground> <background> [--target=4.5]
```

Every row of the checklist in [product_theming.md](product_theming.md), in light
and dark separately. Then the running installer, because that is where the
remaining half lives: see the iteration loop in
[product_theming_packaging.md](product_theming_packaging.md), which needs no
rebuild between changes.

What to look at, in light, dark and high contrast:

- the product selection page and the masthead, where the logo sizes show,
- a form with an invalid field, for the danger color and the focus ring,
- a long storage table, for text size and truncation,
- a modal dialog, a menu and a tooltip, for the floating surfaces,
- toast and inline alerts, for all five statuses next to each other,
- a progress screen, for the accent on large surfaces.

Contrast numbers are necessary and not sufficient. A skin is done when someone
has looked at it.
