# URL as UI state

How a page is being looked at belongs in the address bar: which sections are
expanded, which tab is open, how a table is filtered or sorted.

The hooks that implement this live in `web/src/hooks/use-search-param-state.ts`.
This page is about when to reach for them, and how to keep the resulting URLs
sane.

## Core principle

A page has a state that describes its view. That state is not a private detail of
a component; it is part of what the user is looking at. Keeping it in the URL
gives three things for free:

- Reloading lands on the same view.
- Going back returns to it.
- The link someone copies shows what they were looking at.

None of those work when the same state sits in a component, a context or a
module store, however carefully written.

## What belongs there, and what does not

Ask what the value describes.

| The value describes | Where it lives | Why |
| --- | --- | --- |
| How the page is being viewed: expanded sections, active tab, filters, sort order | **URL search params** | Shareable, survives reload, restores on back |
| A transient interaction: an open menu, a hovered row, text being typed before it is applied | Component state | Nobody wants a link to a half-open dropdown, and every keystroke would be an update |
| Something the server knows: the proposal, the list of devices, whether the user is logged in | TanStack Query | It has to be fetched, cached and invalidated |
| One app-wide setting outside React: color scheme, terminal visibility | A module store | It belongs to no page, and applies before rendering |
| Which entity a page is about: a device index, a mount path | **Path** params (`useParams`) | It identifies the page, not the view of it |

The last row is the distinction worth being careful about. Both live in the URL,
but `/storage/drives/0` says *which* page and `?e=d0` says *how it looks*. Only
the second belongs to the hooks described here.

## Choosing a hook

```tsx
// One value: a tab, a sort column, a filter with a single answer.
const [tab, setTab] = useSearchParamState(SETTINGS_TAB, "0");

// A set of on/off values packed into one param: expanded sections,
// multi-select filters.
const { hasSearchParamToken, toggleSearchParamToken } = useSearchParamTokens(EXPANDED);

// Dropping several params at once, for a reset action.
const clearSearchParams = useClearSearchParams();
```

Prefer `useSearchParamTokens` over one param per item. Fifteen expandable
sections should produce `?e=d0,d2`, not fifteen params with most of them absent.

## Rules

### Each page owns its vocabulary

The hooks know nothing about any page. Param names and token derivations belong
to the area that uses them, gathered in one module so they are easy to find and
hard to mistype. The storage pages keep theirs in
`web/src/components/storage/ui-state-params.ts`.

Never spell a param name inline at a call site. Two components sharing a section
need the same string, and a typo produces a silently separate piece of state.

### Keep names short

Search params share the address bar with the path, which is the part people
actually look at. Short names take less room there, and that is the whole reason.

`?e=d0` is no clearer than `?expanded=drive0`. Neither is meant to be read: the
meaning lives in the code, in the constant sitting next to the call.

### Never clear several params one by one

Each setter starts from the params of the render that created it, so two calls in
the same handler fight and the second undoes the first. Use
`useClearSearchParams`, which performs a single update.

```tsx
// Wrong: only the last one survives.
setExpanded(undefined);
setTab(undefined);

// Right.
clearSearchParams(EXPANDED, SETTINGS_TAB);
```

### Debounce free text

Every write is a router update. Fine for a click on a section, wrong for a text
filter, where it would run on each keystroke. Keep the input on local state and
push the param when the user pauses or commits.

### Nothing sensitive, nothing large

The address is visible on screen, and it might end up shared or attached to a bug
report. It holds short identifiers of view state, not credentials and not
serialized objects.

## Why the function names are long

`hasSearchParamToken("d0")` rather than `has("d0")`, because a call site read on
its own should say where the state lives. It also removes a real ambiguity: a
shorter `hasSearchParam("d0")` reads as a question about a param *named* `d0`,
which is not what it answers.

"Search param" is the term used by the platform (`URLSearchParams`) and by React
Router (`useSearchParams`). It also keeps these apart from path params, which
this codebase reads with `useParams`.

## Writes never disturb the page

Every update replaces the current history entry and keeps the scroll position. So
back and forward step between pages rather than between individual clicks, and
expanding a section halfway down a long page leaves the reader where they were.

This is deliberate and load-bearing: an earlier attempt at URL-backed UI state
was abandoned because each update sent the content back to the top.

## Testing

Both hooks need router context, which `installerRender` already provides.
`mockRoutes` sets the starting URL, so a test can render a component as if
someone had arrived through a link:

```tsx
mockRoutes("/storage?e=d0");
installerRender(<PartitionsSection collection="drives" index={0} />);
```

This is the useful part for coverage: state in the URL makes deep links possible,
and deep links make that state reachable in a test without clicking through the
interface first. Prefer asserting what the user sees over asserting the URL,
except where the URL is the subject.

Reach for `createMemoryRouter` only if a test genuinely needs a data router. It
pulls in navigation machinery that expects `Request`, which jsdom does not
define.

## Known limits

These updates leave the scroll position alone, but nothing *restores* it when
returning to a page from somewhere else. That needs a separate mechanism, which
does not exist yet.
