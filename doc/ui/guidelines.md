# Web UI guidelines

Index of the conventions the web interface follows. Each entry answers a
question that keeps coming back in reviews, so that the answer is agreed once and
looked up afterwards.

## Guidelines

| Topic | Answers |
| --- | --- |
| [URL as UI state](guidelines/url-state.md) | Where the state describing how a page is being looked at belongs: expanded sections, active tab, table filters and sort order |

## Guidelines still living next to their code

Some conventions were written before this index existed and sit in the directory
they describe. They are listed here so there is one place to look, and they move
under `doc/ui/guidelines/` as each is revisited.

| Topic | Where |
| --- | --- |
| Forms: field patterns, validation, TanStack Form usage | `web/src/components/form/conventions.md` |

## Adding a guideline

A topic earns a page here when it is a decision rather than a description: when
two reasonable people could do it differently and the codebase needs them to
agree. Documenting how a single component behaves belongs in that component's
TSDoc instead.

Keep each page about the decision and the reasoning behind it. Implementation
detail ages badly in prose and is better read from the code.
