# Page and section conventions

This document captures the conventions for assembling a page: how its parts are
named, how its headings are ordered and how far a shared component should bend
before a page builds its own thing. It was written while reworking `Page`,
which serves as the running example throughout.

As more pages are revisited, this document should be updated with new examples
and refined patterns.

---

## Table of contents

- [Naming a section](#naming-a-section)
- [Heading levels](#heading-levels)
  - [Pages that show a message instead of their content](#pages-that-show-a-message-instead-of-their-content)
  - [Components rendered on more than one page](#components-rendered-on-more-than-one-page)
- [Sizing a title](#sizing-a-title)
- [Extending a shared component](#extending-a-shared-component)

## Naming a section

A named section is a landmark: it shows up in the list screen reader users
navigate by, so its name is what tells them whether to jump there. An unnamed
one is a plain visual grouping and stays out of that list.

How a section is named decides which of the two it becomes:

- **With a `title`.** The usual case. The heading names the section for
  everybody, sighted users included.
- **With an `aria-label` and no title.** Last resort, for a section with
  nothing that works as a visible heading. Prefer finding a title: a page
  where only screen reader users get the name is a page with a gap.
- **With neither.** No landmark, just a card. Right whenever the grouping is
  visual: a single block of content that the page around it already explains.

A section never takes both. An invisible label next to a visible heading means
the name announced and the name read no longer match, which is worse than
either alone.

```tsx
<Page.Section title={_("Encryption")}>
  <EncryptionSummary />
</Page.Section>
```

## Heading levels

Screen reader users navigate by headings, so the outline has to hold together:
one first level heading per page, and no gaps.

- The **page title** is the first level heading, rendered by the page header.
- A **section** placed directly on a page is a second level heading, which is
  the default and needs no prop.
- Anything with its own heading **inside** a section goes one level deeper, and
  so on downwards.

### Pages that show a message instead of their content

Some pages swap all their content for a single message: no devices were found,
the connection is gone, these settings cannot be edited here. The page title is
still there, in the header, so the message is not the top heading of the page.
It sits right below the title, at the same level a section would.

Empty state components make this easy to get wrong, because the heading level is
a prop and leaving it out does not mean "pick something sensible": PatternFly's
own default is the top level. A page that forgets it ends up with two first
level headings and nothing to say which one names the page. So pass the level:

```tsx
<EmptyState headingLevel="h2" titleText={_("No devices found")}>
  <EmptyStateBody>{description}</EmptyStateBody>
</EmptyState>
```

### Components rendered on more than one page

A component reused across pages cannot know how deep it sits, so it should not
choose its own heading level. Let it take one as a prop and have each page pass
what fits its outline. A default is fine as long as it fits the most common
placement, which is what sections do.

## Sizing a title

A heading is rendered at the size that goes with its level, so a second level
title looks like a heading for the whole page even when it names a small
section. That size and that level are separate decisions: the level has to
match the page outline, while the size only has to match the design. When the
level is right but the heading looks too loud, keep the level and lower the
size.

Wrap the title in `core/Text` with the size it should have:

```tsx
<Page.Section title={<Text textStyle="fontSizeMd">{_("Controllers")}</Text>}>
  <ControllersSummary />
</Page.Section>
```

Reach for this when a heading would otherwise shout: a small section inside a
busy page, or a summary that reads as a label. Do not reach for it to fake a
level, as in styling a second level heading to look like a third one because
the outline felt wrong. Fix the outline instead.

## Extending a shared component

Shared components like `Page.Section` expose only part of what they are built
on, on purpose. When a page needs something outside that part:

1. **Add a prop**, as long as it says what changes for a section rather than
   for whatever it is built on, and other pages could plausibly ask for the
   same. The decision then lives in one place and every page gets it.
2. **Or build that piece on the page**, rendering the underlying PatternFly
   component directly. `Page.Section` is not a replacement for a card, it is an
   opinionated container for the shape pages usually need, so a page that has
   to change much of it is better off with its own.

What not to do is pass the underlying component's props straight through. It
reads like a shortcut and costs later: one decision ends up spread across every
call site, defaults get undone page by page instead of being fixed once, and a
caller can quietly break the accessible naming above.
