# Creating a product skin

A distributor can restyle the Agama web UI for their product without touching
application code: colors, logo, and a handful of other roles are set in a
single per-product file, loaded at runtime after Agama's own styles.

> **Important**: no matter whether an AI or a human wrote it, every line
> (color values, contrast numbers, SVG content, any role-API change) must be
> reviewed and manually tested in the running app, in both light and dark
> mode, before asking for the color schema to be included in the project. A
> report of "done" or "verified" is not a substitute for someone actually
> looking at it.

## What a skin can change

- **Colors and roles**: a curated set of `--agm-t--*` CSS custom properties
  (brand color, surface/text/border colors, status colors, focus ring, corner
  radius, product logo size/alignment, and a few typography/icon-size
  hooks). `web/src/assets/products/example.css` is the basic reference
  (colors only, covers most products); `example-advanced.css` documents every
  available role with a worked example. `web/src/assets/styles/tokens/_semantic.scss`'s
  header comment is the authoritative, up-to-date index of every role.
- **Logo**: `<product-id>.svg` (light theme) and `<product-id>-dark.svg`
  (dark theme), transparent background. Match the square-ish aspect ratio of
  the existing logos in that folder: `ProductLogo` renders it at a small
  fixed width per usage context (masthead, next to the product name, ...), so
  a very wide or tall logo will look cramped or oversized.

## Steps

1. Copy `example.css` (or `example-advanced.css` for the full role set) to
   `web/src/assets/products/<product-id>.css`. Set only the roles the brand
   actually needs; anything left unset keeps Agama's default look.
2. Add the logo files described above.
3. Verify WCAG contrast for every color you set, **in both light and dark
   theme separately** (a value that passes in one theme can fail in the
   other, and dark-theme "elevated" surfaces like tooltips/popovers need to
   read *lighter* than the page, not darker): run
   `npm run check-contrast -- <foreground> <background> [--target=4.5]`
   (`web/scripts/check-contrast.js`). Use `--target=3` for UI elements and
   focus rings, the default 4.5 for normal text. When a pair fails, the tool
   suggests a same-hue, same-saturation shade that passes.
4. If you hand-edit an SVG, validate it with `xmllint --noout <file>.svg`
   before considering it done: a stray `--` inside an XML comment silently
   breaks rendering in browsers.
5. If the brand needs something the current roles don't cover, that's a gap
   in the shared token layer (`_semantic.scss` / `_patternfly-overrides.scss`),
   not something to work around per product. See "Extending the role API"
   below.

## Extending the role API

Every role is documented and resolved in one place:
`web/src/assets/styles/tokens/_semantic.scss` maps each `--agm-t--*` role onto
the PatternFly tokens it affects, with the current Agama value as the
fallback default. A product file must only ever set `--agm-t--*` roles, never
a raw PatternFly or component-level variable directly.

Adding a role that's genuinely missing:

1. Add the role to `_semantic.scss`'s role-index comment and resolve it at
   its real consumption point (a PF global token in `_semantic.scss`, or a
   component-level override in `_patternfly-overrides.scss`), with the
   current Agama value as the fallback so leaving it unset changes nothing.
2. Document it with a worked example in `example-advanced.css`.
3. Before assuming one token covers a whole category (e.g. "corner radius"),
   check whether PatternFly actually splits that concern into several
   independent tiers under the hood; grep the component CSS for the relevant
   property and trace each occurrence back to its root token.

## Prompting an AI to do this

Fill in the placeholders and paste:

> Create a product skin for `<PRODUCT_ID>` (an existing product id in
> `web/src/assets/products/`) using this brand: `<paste colors, and/or a link
> to the brand's site or guidelines>`.
>
> First read `web/src/assets/products/example.css`, `example-advanced.css`,
> and the role-index comment at the top of
> `web/src/assets/styles/tokens/_semantic.scss`, so you know the current
> `--agm-t--*` role set rather than assuming it. A product file only ever
> sets these roles; never a raw PatternFly or component-level variable
> directly.
>
> For every color you set: compute WCAG contrast explicitly with
> `npm run check-contrast -- <foreground> <background> [--target=4.5]`
> (`--target=3` for UI elements/focus rings), in both light and dark theme
> separately, rather than eyeballing. Where a brand color fails, use the
> tool's suggested same-hue/saturation shade rather than an unrelated
> substitute. Dark-theme elevated surfaces (tooltips, popovers) need to read
> lighter than the page, not darker.
>
> For the logo: read `ProductLogo` and its callers first to find the actual
> rendered size/aspect ratio each usage needs, and match the square-ish shape
> of existing logos in that folder. Validate any hand-edited SVG with
> `xmllint --noout` and a rendered preview at the real consuming size, in
> both themes, before calling it done.
>
> **If something can't be done with the current `--agm-t--*` role set, don't
> get creative.** Do not set a raw PatternFly token or component-variable
> override from the product CSS file, and do not work around the "products
> only set `--agm-t--*` roles" contract. Stop and present a plan for
> extending the shared token API instead: the new role's name, where it gets
> documented (a role-index comment in `_semantic.scss`) and resolved (a PF
> global token in `_semantic.scss`, or a component-level override in
> `_patternfly-overrides.scss`, with the current Agama value as the fallback
> default so leaving it unset changes nothing), a worked example added to
> `example-advanced.css`, and whether PatternFly actually splits the
> underlying concern into several independent tokens under the hood (check
> before assuming one override reaches everywhere it should). Get that plan
> approved before writing any code.

### If you already know the API needs extending

When the brand needs something you already know isn't covered (not just an
unexpected gap found mid-task), say so upfront in the same prompt so the AI
plans for it from the start instead of discovering it partway through:

> This brand also needs `<describe the missing capability, e.g. "square
> corners on every control, not just buttons">`, which the current
> `--agm-t--*` role set doesn't cover. Present a plan for the new role before
> touching any file.
