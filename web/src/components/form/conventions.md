# Form conventions

This document captures the conventions for building forms across the
application. It was written alongside the reimplementation of `ConnectionForm`,
which serves as the running example throughout.

As more forms are reimplemented, this document should be updated with new
examples and refined patterns.

## Core principle

Show only what the user needs, when they need it. A form that shows fewer
fields is easier to fill, easier to understand, and less likely to confuse.
Every field that appears should have a clear reason to be there.

## Patterns

The patterns below are ordered from least to most intrusive on the user's
workflow. Prefer patterns near the top when possible.

### 1. Required field, no suffix

The field is always shown and always expected to have a value. If a sensible
default can be provided, pre-fill it. The user may change it or leave it as-is,
but it cannot be blank on submit.

Note: a pre-filled field is still required. Do not add an `(optional)` suffix
just because the field has a default value.

**Current example:** Name. It is always shown when creating a connection and
required on submit. A default is auto-generated from the selected binding mode
and device using a form-level `onChange` listener; the user may override it at
any time. Once the user edits the field manually, auto-generation stops:
`isDirty` is used rather than `isTouched` so that focusing and blurring without
changing the value does not disable the auto-generation.

In edit mode the field is not rendered at all: the connection id cannot be
changed after creation, so offering it would be misleading.

### 2. Always shown, optional or context-dependent

The field is always visible. Use this when omitting the field would hurt
discoverability or when its label needs to reflect the current state of the
form.

If the field is always optional, use the `(optional)` suffix.

If the requirement depends on the state of other fields, use a clarifying
suffix that describes what is currently expected. This is a special case and
should be used sparingly: if you find yourself reaching for it often, the form
likely needs restructuring.

**Not yet an example in `ConnectionForm`.** A future candidate might be a field
whose visibility is stable but whose requirement changes based on other
selections, and where omitting it would hurt discoverability.

### 3. Conditionally shown, required when shown

The field is not rendered until another field reaches a specific value. When it
appears, it is required. No suffix is needed: the user caused it to appear by
their own action, so its purpose is self-evident.

**Example:** Device name and MAC address selectors. They are not rendered when
the binding mode is "Any". When the user selects "Chosen by name" or "Chosen by
MAC", the corresponding selector appears and must be filled in. Both selectors
are pre-filled with the first available device, but the field is still required
because omitting it would produce an incomplete connection profile.

### 4. Conditionally shown, optional when shown

The field is not rendered until another field reaches a specific value. When it
appears it can legitimately be left blank, so it carries the `(optional)`
suffix. When context warrants more explanation, the suffix can be made more
descriptive. For example, a gateway that would be silently dropped on
submission without accompanying addresses might carry `(optional, ignored if no
addresses provided)` instead.

**Example:** IPv4 Gateway and IPv6 Gateway. They are not rendered when the
corresponding mode is Automatic. When the mode is Manual or Advanced, they
appear, but a gateway is not strictly required by NetworkManager even then.

Showing the field directly, rather than behind a checkbox, is the right choice
here because the user has already made a related decision: they chose a
configuration mode. Asking them to also check a box to reveal the gateway would
be an extra step with no benefit. The field appears naturally as part of the
consequence of their choice.

### 5. Choice selector (mode or behavior selection)

A selector allows the user to choose _how_ a feature should behave rather than
whether a single value should be provided. Each option represents a complete
configuration mode. Selecting an option may reveal additional fields that
refine that choice.

Unlike pattern 6, this is not an opt-in toggle. The user must always select one
option, and a sensible default should be preselected whenever possible.

Use this pattern when:

- multiple mutually exclusive configurations exist,
- the system already has a meaningful default behavior,
- omitting configuration entirely would make the form misleading or ambiguous.

The selector communicates that the feature is active regardless of whether the
user customizes it.

Revealed fields are a consequence of the selected option and follow earlier
patterns:

- required fields use pattern 3,
- optional fields use pattern 4.

Field values revealed by a choice must remain preserved in form state when the
user switches options. This allows experimentation without losing previously
entered data.

**Example:** IPv4 Settings selector.

- `Automatic`: address and gateway come from the network. No additional fields
  rendered.
- `Manual`: fixed addressing. Addresses (required, no suffix) and gateway
  (`(optional)`) are rendered. At least one address is required on submit.
- `Advanced`: automatic addressing with optional static overrides. Addresses
  carry `(optional)` and gateway carries `(optional, ignored if no addresses
provided)`, because a gateway without any addresses is meaningless and dropped
  on submission.

This avoids the confusion of a checkbox such as "Configure IPv4", which may
suggest that no IP configuration exists unless enabled.

**Example:** Device binding mode selector.

- `Any`: the connection is available on all devices. No additional fields.
- `Chosen by name`: a device name selector appears (pattern 3).
- `Chosen by MAC`: a MAC address selector appears (pattern 3).

#### Payload behavior

The submitted payload only includes values that are meaningful for the current
selections. Binding fields are excluded when the binding mode does not use
them. IP addresses and gateway are excluded when the corresponding mode is
Automatic, and a gateway is additionally excluded when no addresses are
present, since a gateway without addresses has no effect. DNS fields are
excluded when their respective checkboxes are unchecked.

The form keeps all values in state regardless, so switching modes never loses
what the user has already entered.

### 6. Revealed by a checkbox

A checkbox lets the user explicitly opt into providing a value. The field is
not rendered until the checkbox is checked. Once checked, the field is required
and validated on submit. No `(optional)` suffix: the user has signalled intent,
so leaving it blank is a mistake worth reporting.

The field value is preserved in form state when the checkbox is unchecked so
re-checking restores what the user previously typed.

Render the revealed content using `NestedContent` as a sibling after the
`Checkbox`, not via the `Checkbox` body prop. The body prop renders inside a
`<span>`, which is invalid HTML for block content like a form field.

Use this pattern for advanced or rarely needed options that most users should
never see. Do not use it when the field is likely to be needed by the majority
of users: that just adds an unnecessary click.

**Examples:** "Use custom DNS" checkbox reveals the DNS servers field. "Use
custom DNS search domains" checkbox reveals the DNS search domains field.

## Read-only information

Use `ReadOnlyField` to display contextual information alongside editable fields
without using disabled inputs.

Disabled inputs have accessibility limitations: they cannot receive focus, their
values cannot be selected or copied, and they signal to the user that a field
might become editable under different circumstances. When information should
never be edited in the current context, it is clearer and more accessible to
display it as read-only text rather than a disabled input.

**Example:** When editing an existing connection, the connection type is shown
with `ReadOnlyField` because the type cannot be changed after creation.
Displaying it as a disabled input would suggest it might become editable, which
is misleading.

The label and value are read sequentially by screen readers, which provides
clear context without requiring programmatic label association.

---

## Accessibility notes

### Fields without a visible label

Sometimes a field has no visible label because its purpose is clear from the
surrounding context. Even then, every field needs an accessible name for screen
readers, voice control software, and browser translation tools.

Ideally, a real `<label>` element would be kept in the DOM with its text
visually hidden. This is better than `aria-label` because it gets translated by
browser tools, works with voice control software, and does not depend on ARIA
support. However, PatternFly's `FormGroup` reserves visual space for the label
area whenever a label is provided, even when its content is hidden, leaving an
unwanted gap in the layout.

For this reason, `aria-label` is used as the fallback for fields without a
visible label when rendered inside `FormGroup`.

When a component accepts a `label` prop directly and does not reserve visual
space for it (e.g. `DropdownField`), pass `<Text srOnly>{label}</Text>` as the
label value instead. This preserves translation support and avoids the layout
side effect.

See:

- <https://www.w3.org/WAI/tutorials/forms/labels/>
- <https://adrianroselli.com/2020/01/my-priority-of-methods-for-labeling-a-control.html>
- <https://adrianroselli.com/2019/11/aria-label-does-not-translate.html>
- <https://vispero.com/resources/should-form-labels-be-wrapped-or-separate/>

---

## Validation

Validation runs on submit only. The form does not interrupt the user while they
are filling it in.

Several rules depend on the combination of field values. For example, whether a
gateway is valid depends on the current IP mode and on whether any addresses
have been entered. Splitting those rules across individual fields would spread
related logic apart and make the dependencies hard to follow. Instead, all
validation is handled in a single `onSubmitAsync` validator on the form, which
returns a map of field names to error messages. TanStack Form forwards each
message to the corresponding field's error display.

After a failed attempt the user may correct and resubmit. Because TanStack Form
only clears errors set by `onSubmitAsync` when a per-field `onSubmit` validator
also runs for the same field (which never happens here), `canSubmit` would stay
`false` indefinitely after a failure. The form works around this by calling
`setErrorMap` before each new attempt to reset the error state and restore
`canSubmit`.

Server errors follow the same path: a save failure returns `{ form: message }`,
which TanStack Form exposes via `state.errorMap.onSubmit.form`. The form
renders it as an inline alert at the top so the user knows what went wrong and
can try again.

---

## Combining patterns

Patterns can and should be combined within the same form when different fields
have different needs.

Patterns 3 and 4 commonly appear inside a choice selector (pattern 5), where
selecting a mode reveals required or optional refinements of that choice.

Patterns 2 and 6 also combine well when a form has one common optional field
alongside a group of rarely needed advanced options.

---

## Choosing the right pattern

Work through these questions in order:

1. Is the field needed by most users and always relevant? Use pattern 1.
2. Should the field always remain visible for clarity or discoverability? Use
   pattern 2.
3. Does the field become required only after another choice? Use pattern 3.
4. Does the field become optional only after another choice? Use pattern 4.
5. Does the user need to choose between different configuration behaviors or
   modes? Use pattern 5.
6. Is the field an advanced option that most users will never need? Use pattern
7.

---

## Summary

| Pattern                           | Visibility   | Label                             | Validated on submit |
| --------------------------------- | ------------ | --------------------------------- | ------------------- |
| Required                          | Always       | No suffix                         | Yes                 |
| Always optional/context-dependent | Always       | `(optional)` or clarifying suffix | No                  |
| Conditionally required            | On condition | No suffix                         | Yes                 |
| Conditionally optional            | On condition | `(optional)`                      | No                  |
| Choice selector                   | Always       | No suffix                         | Depends on choice   |
| Checkbox opt-in                   | On checkbox  | No suffix                         | Yes, when rendered  |
