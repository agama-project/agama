# Form conventions

This document captures the conventions for building forms across the
application. It was written alongside the reimplementation of `ConnectionForm`,
which serves as the running example throughout.

As more forms are reimplemented, this document should be updated with new
examples and refined patterns.

---

## Table of Contents

- [Core principle](#core-principle)
- [Patterns](#patterns)
  - [1. Required field, no suffix](#1-required-field-no-suffix)
  - [2. Always shown, optional or context-dependent](#2-always-shown-optional-or-context-dependent)
  - [3. Conditionally shown, required when shown](#3-conditionally-shown-required-when-shown)
  - [4. Conditionally shown, optional when shown](#4-conditionally-shown-optional-when-shown)
  - [5. Choice selector (mode or behavior selection)](#5-choice-selector-mode-or-behavior-selection)
  - [6. Revealed by a checkbox](#6-revealed-by-a-checkbox)
- [Read-only information](#read-only-information)
- [Accessibility notes](#accessibility-notes)
- [Validation](#validation)
- [Combining patterns](#combining-patterns)
- [Choosing the right pattern](#choosing-the-right-pattern)
- [Summary](#summary)
- [TanStack Form Patterns](#tanstack-form-patterns)
  - [Accessing Form State](#accessing-form-state)
  - [Component Patterns](#component-patterns)
  - [Pattern Selection Guide](#pattern-selection-guide)
  - [Common Mistakes and Solutions](#common-mistakes-and-solutions)
  - [Summary Table](#summary-table)
- [Persistent Forms (forms that stay mounted)](#persistent-forms-forms-that-stay-mounted)
  - [The Problem](#the-problem)
  - [The Solution: Three Focused Abstractions](#the-solution-three-focused-abstractions)
  - [withFrozenQuery](#withfrozenquery)
  - [useFormSubmit](#useformsubmit)
  - [useUpdateConfig](#useupdateconfig)
  - [Why fetchQuery Instead of useSuspenseQuery](#why-fetchquery-instead-of-usesuspensequery)
  - [Why shake Lives in useUpdateConfig, Not the Caller](#why-shake-lives-in-useupdateconfig-not-the-caller)
  - [Putting It Together](#putting-it-together)
  - [Trade-offs and When Not to Use This Pattern](#trade-offs-and-when-not-to-use-this-pattern)
- [Code Organization](#code-organization)
  - [Directory Structure](#directory-structure)
  - [File Naming](#file-naming)
  - [The fields.ts Module](#the-fieldsts-module)
  - [Sharing fields across forms](#sharing-fields-across-forms)
  - [Control fields (not part of the payload)](#control-fields-not-part-of-the-payload)
  - [Validation Approach](#validation-approach)
  - [Form Component Integration](#form-component-integration)
  - [Naming Consistency](#naming-consistency)
  - [Benefits Summary](#benefits-summary)

---

## Core principle

Show only what the user needs, when they need it. A form that shows fewer
fields is easier to fill, easier to understand, and less likely to confuse.
Every field that appears should have a clear reason to be there.

---

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

**Auto-fill pattern using TanStack Form listeners:**

```typescript
// Sync function checks isDirty before auto-filling
const syncFieldName = (formApi) => {
  // Only auto-fill if user hasn't manually edited the field
  if (formApi.getFieldMeta("targetField")?.isDirty) return;

  const sourceValue = formApi.getFieldValue("sourceField");
  const computedValue = computeFromSource(sourceValue);

  formApi.setFieldValue("targetField", computedValue, {
    dontUpdateMeta: true,      // Don't mark form dirty
    dontRunListeners: true,    // Don't re-trigger listeners
  });
};

// Wire in form and field listeners
const form = useAppForm({
  ...defaultOptions,
  listeners: {
    onMount: ({ formApi }) => syncFieldName(formApi), // Initial fill
  },
});

// Update when source field changes
<form.AppField
  name="sourceField"
  listeners={{
    onChange: () => syncFieldName(form),
  }}
>
```

**Why `isDirty` instead of `isTouched`:** A user could focus and blur the field
without changing it, which would set `isTouched` but not `isDirty`. Using
`isDirty` ensures auto-fill continues until the user actually modifies the value.

**Example:** Logical volume name auto-fills from mount point ("/home" → "home"),
but stops once the user types a custom name.

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

---

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

### Clearing validation errors between submit attempts

**CRITICAL**: When using `onSubmitAsync` validation, you **must** call
`form.setErrorMap({ onSubmit: { fields: {} } })` before `form.handleSubmit()`.

After a failed validation attempt, the user may correct the errors and resubmit.
However, TanStack Form only clears errors set by `onSubmitAsync` when a
per-field `onSubmit` validator also runs for the same field. Since we use
centralized validation in `onSubmitAsync` without per-field validators,
`canSubmit` would stay `false` indefinitely after a failure, preventing
resubmission even after corrections.

The form works around this by calling `setErrorMap` before each new attempt to
reset the error state and restore `canSubmit`.

**Required pattern:**

```tsx
<Form
  onSubmit={(e) => {
    e.preventDefault();
    // REQUIRED: Clear previous validation errors before resubmitting
    form.setErrorMap({ onSubmit: { fields: {} } });
    form.handleSubmit();
  }}
>
```

Note: when using `useFormSubmit` (see [Persistent Forms](#persistent-forms-forms-that-stay-mounted)),
the `formSubmitHandler` factory handles this automatically. You do not need to
call `setErrorMap` manually.

**Why this matters:**

- Without this call, validation errors from a previous submit attempt persist
- The form's `canSubmit` state remains `false` even after the user fixes errors
- Users cannot resubmit the form without refreshing the page

**Reference:** [TanStack Form setErrorMap documentation](https://tanstack.com/form/latest/docs/reference/formApi#seterrormap)

### Server errors

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
6. Is the field an advanced option that most users will never need? Use pattern 6.

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

---

## TanStack Form Patterns

This section documents the correct patterns for accessing form state and building
components with TanStack Form. Following these patterns avoids type errors and
ensures components work correctly.

### Accessing Form State

**Use `form.Subscribe`, NOT `form.useStore()`**

TanStack Form does not expose a `useStore()` method. To access form state, always
use `form.Subscribe`:

```typescript
// ✅ CORRECT
<form.Subscribe selector={(s) => s.values.fieldName}>
  {(value) => <div>{value}</div>}
</form.Subscribe>

// ❌ WRONG - useStore does not exist
const value = form.useStore((s) => s.values.fieldName);
```

**Why Subscribe?**

- `Subscribe` is a React component that re-renders only when the selected state changes
- It provides proper TypeScript inference for the selected state
- It's the only supported way to access form state in TanStack Form

**Selecting multiple values:**

```typescript
<form.Subscribe
  selector={(s) => ({
    fieldA: s.values.fieldA,
    fieldB: s.values.fieldB,
    errorA: s.fieldMeta.fieldA?.errors?.[0],
  })}
>
  {({ fieldA, fieldB, errorA }) => (
    // render using selected values
  )}
</form.Subscribe>
```

### Component Patterns

TanStack Form components fall into three categories, each with its own pattern for
accessing form state:

#### 1. Field Components (use `useFieldContext`)

**What**: Individual input components tied to a single form field.

**Pattern**: Use `useFieldContext<T>()` to access the current field's state.

**When to use**: Building reusable input components like `TextField`,
`DropdownField`, `CheckboxField`.

**How they're used**: Inside `form.AppField` render props.

```typescript
// Component definition
import { useFieldContext } from "~/hooks/form-contexts";

export default function TextField({ label, helperText }: TextFieldProps) {
  const field = useFieldContext<string>();
  const error = field.state.meta.errors[0];

  return (
    <FormGroup fieldId={field.name} label={label}>
      <TextInput
        id={field.name}
        name={field.name}
        value={field.state.value}
        validated={error ? "error" : "default"}
        onChange={(_, value) => field.handleChange(value)}
        onBlur={() => field.handleBlur()}
      />
      {/* helper text and error display */}
    </FormGroup>
  );
}

// Usage in forms
<form.AppField name="username">
  {(field) => <field.TextField label={_("Username")} />}
</form.AppField>
```

**Key points:**

- Field component receives field state from context
- No form prop needed
- Works with any form that has a field with the expected type
- Must be used inside `form.AppField`
- Must call `field.handleBlur()` to support forms using onBlur listeners

#### 2. Field Group Components (use `withForm`)

**What**: Components that render multiple related fields from the same form.

**Pattern**: Use `withForm` wrapper with typed form options. **Always wrap each field
in `form.AppField`** to register it for validation.

**When to use**: Grouping related fields like IP settings, bond configuration, or
password + confirmation pairs.

**How they're used**: Passed the form instance as a prop.

```typescript
// Component definition
import { withForm } from "~/hooks/form";
import { defaultOptions } from "./fields";

const PasswordFields = withForm({
  ...defaultOptions, // Provides type information
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="password">
          {(field) => {
            const error = field.state.meta.errors[0] as string | undefined;
            return (
              <FormGroup fieldId="password" label={_("Password")}>
                <PasswordInput
                  value={field.state.value}
                  onChange={(_, value) => field.handleChange(value)}
                />
                {error && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant="error">{error}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            );
          }}
        </form.AppField>

        <form.AppField name="passwordConfirmation">
          {(field) => {
            const error = field.state.meta.errors[0] as string | undefined;
            return (
              <FormGroup fieldId="passwordConfirmation" label={_("Confirmation")}>
                <PasswordInput
                  value={field.state.value}
                  onChange={(_, value) => field.handleChange(value)}
                />
                {/* error display */}
              </FormGroup>
            );
          }}
        </form.AppField>
      </>
    );
  },
});

// Usage in forms
<PasswordFields form={form} />
```

**Key points:**

- `withForm` provides proper TypeScript types from `defaultOptions`
- **CRITICAL**: Always wrap fields in `form.AppField` to register them for validation
- Use `field.handleChange()` for value updates, not `form.setFieldValue()`
- Access field errors from `field.state.meta.errors`
- Component receives `form` prop with full type safety

**Why not `useFormContext`?**

`useFormContext()` returns a form instance with generic types that don't know about
specific field names. This causes TypeScript errors when trying to use field names
as strings:

```typescript
// ❌ WRONG - TypeScript error: string not assignable to never
const form = useFormContext();
form.setFieldValue("password", value); // Error!

// ✅ CORRECT - withForm provides proper types
const MyFields = withForm({
  ...defaultOptions, // defaultOptions knows about "password" field
  render: ({ form }) => {
    form.setFieldValue("password", value); // Works!
  },
});
```

#### 3. Form Components

**What**: The main form component that orchestrates everything.

**Pattern**: Use `useAppForm` hook directly.

**When to use**: The top-level form component.

```typescript
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { defaultOptions, validate } from "./fields";

export default function MyForm() {
  const data = useDataFromAPI(); // May contain undefined values

  const form = useAppForm({
    // mergeFormDefaults automatically shakes undefined values
    ...mergeFormDefaults(defaultOptions, {
      field1: data?.field1,        // undefined won't override default
      field2: data?.field2,
      field3: data?.field3,
    }),
    validators: {
      onSubmitAsync: async ({ value }) => validate(value),
    },
    onSubmit: async ({ value }) => {
      await saveData(value);
    },
  });

  return (
    <form.AppForm>
      <Form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
        {/* fields */}
      </Form>
    </form.AppForm>
  );
}
```

**Using `mergeFormDefaults`:**

`mergeFormDefaults` automatically removes undefined values before merging (using
`shake` from radashi). This means you can safely pass objects with undefined
properties without worrying about overriding the defaults from `defaultOptions`:

```typescript
// ✅ CORRECT - undefined values are automatically removed
...mergeFormDefaults(defaultOptions, {
  fullName: user?.fullName,      // May be undefined
  userName: user?.userName,      // May be undefined
  email: user?.email,            // May be undefined
})

// ❌ WRONG - Manual nullish coalescing is redundant
...mergeFormDefaults(defaultOptions, {
  fullName: user?.fullName ?? "",
  userName: user?.userName ?? "",
  email: user?.email ?? "",
})

// ❌ WRONG - Manual shake is redundant
...mergeFormDefaults(defaultOptions, shake({
  fullName: user?.fullName,
  userName: user?.userName,
}))
```

This keeps the initialization code clean and follows the same pattern across all forms.

### Pattern Selection Guide

**Building a new component?** Ask:

1. **Does it render exactly one form field?**
   - Yes → Use `useFieldContext` (field component pattern)
   - No → Continue

2. **Does it need to access multiple fields from a specific form?**
   - Yes → Use `withForm` (field group pattern)
   - No → Continue

3. **Is it the main form orchestrator?**
   - Yes → Use `useAppForm` (form component pattern)

### Common Mistakes and Solutions

#### Mistake 1: Trying to use `form.useStore()`

```typescript
// ❌ WRONG
const value = form.useStore((s) => s.values.fieldName);

// ✅ CORRECT
<form.Subscribe selector={(s) => s.values.fieldName}>
  {(value) => /* use value */}
</form.Subscribe>
```

#### Mistake 2: Using `useFormContext` for field groups

```typescript
// ❌ WRONG - Type errors with field names
import { useFormContext } from "~/hooks/form-contexts";

function MyFields() {
  const form = useFormContext();
  form.setFieldValue("password", value); // ERROR: string not assignable to never
}

// ✅ CORRECT - Use withForm for proper types
import { withForm } from "~/hooks/form";
import { defaultOptions } from "./fields";

const MyFields = withForm({
  ...defaultOptions,
  render: ({ form }) => {
    form.setFieldValue("password", value); // Works!
  },
});
```

#### Mistake 3: Accessing `formApi` in listeners

```typescript
// ❌ WRONG - formApi doesn't exist in listener context
<form.AppField
  name="fullName"
  listeners={{
    onBlur: ({ fieldApi, formApi }) => { // formApi doesn't exist here
      formApi.setFieldValue("suggestions", getSuggestions(fieldApi.state.value));
    },
  }}
>

// ✅ CORRECT - Use form instance from closure, access value directly
<form.AppField
  name="fullName"
  listeners={{
    onBlur: ({ value }) => {
      form.setFieldValue("suggestions", getSuggestions(value));
    },
  }}
>
```

**Available in listener context:**

- `value`: Current field value
- `fieldApi`: Field API instance (includes `fieldApi.state.value`, same as `value`)

**Not available:**

- `formApi`: Use form instance from closure instead

#### Mistake 4: Using `form.setFieldValue` without `form.AppField`

```typescript
// ❌ WRONG - Field not registered, validation won't run
const PasswordFields = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <form.Subscribe selector={(s) => ({ password: s.values.password })}>
      {({ password }) => (
        <PasswordInput
          value={password}
          onChange={(_, value) => form.setFieldValue("password", value)}
        />
      )}
    </form.Subscribe>
  ),
});

// ✅ CORRECT - Always wrap fields in form.AppField
const PasswordFields = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <form.AppField name="password">
      {(field) => (
        <PasswordInput
          value={field.state.value}
          onChange={(_, value) => field.handleChange(value)}
        />
      )}
    </form.AppField>
  ),
});
```

**Why this matters:** Using `form.setFieldValue` directly updates the value but doesn't
register the field with TanStack Form's validation system. When validation runs,
TanStack Form doesn't know the field exists, so validators are never called for it and
errors are never captured. Always use `form.AppField` to properly register fields.

#### Mistake 5: Passing dynamic field names without proper typing

```typescript
// ❌ WRONG - Can't use dynamic field names with useFormContext
function PasswordField({ passwordName, confirmationName }: Props) {
  const form = useFormContext();
  // Type error: string not assignable to never
  onChange={(_, value) => form.setFieldValue(passwordName, value)}
}

// ✅ CORRECT - Use withForm or make it form-specific
const PasswordFields = withForm({
  ...defaultOptions,
  render: ({ form }) => {
    // Field names are known at compile time
    <form.AppField name="password">
      {(field) => onChange={(_, value) => field.handleChange(value)}}
    </form.AppField>
  },
});
```

#### Mistake 6: Not calling `field.handleBlur()` in field components

```typescript
// ❌ WRONG - onBlur listeners won't fire
export default function TextField({ label }: TextFieldProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      value={field.state.value}
      onChange={(_, value) => field.handleChange(value)}
      // Missing onBlur!
    />
  );
}

// ✅ CORRECT - Field components must call handleBlur()
export default function TextField({ label }: TextFieldProps) {
  const field = useFieldContext<string>();

  return (
    <TextInput
      value={field.state.value}
      onChange={(_, value) => field.handleChange(value)}
      onBlur={() => field.handleBlur()}
    />
  );
}
```

**Why this matters:** TanStack Form's `onBlur` listeners in `form.AppField` only fire
when the field component explicitly calls `field.handleBlur()`. Without this call,
blur-based field synchronization won't work (e.g., username suggestions triggered when
blurring the full name field).

All reusable field components (`TextField`, `SuggestionsTextField`, `PasswordField`,
etc.) must wire `onBlur={() => field.handleBlur()}` to support forms that use blur
listeners for field coordination.

#### Mistake 7: Using `as any` for type mismatches

```typescript
// ❌ WRONG - Using 'as any' to bypass type safety
form.setFieldValue("partitionSource", displayString as any);

// ❌ WRONG - Using 'as any' with type assertions
const label = filesystemLabel(filesystem as any);

// ✅ CORRECT - Use proper type assertions with specific types
import type { ConfigModel } from "~/model/storage/config-model";
const label = filesystemLabel(filesystem as ConfigModel.FilesystemType);

// ✅ CORRECT - Restructure to avoid type mismatch
// Instead of forcing a display string into a typed field,
// render informative text outside the field:
if (!canReuse) {
  return (
    <FormGroup label={_("Partition source")}>
      <div>{explanationText}</div>
    </FormGroup>
  );
}
```

**Why this matters:** The project does not allow `as any`. If you encounter a type
mismatch, it's usually a sign that the code structure needs adjustment. Use specific
type assertions (e.g., `as ConfigModel.FilesystemType`) when you know the type is
correct but TypeScript can't infer it, or restructure the code to avoid the type issue
entirely.

#### Mistake 8: Forgetting `margin="mxLg"` on `NestedContent`

```typescript
// ❌ WRONG - Missing margin creates cramped nested fields
{value === "reuse" && (
  <NestedContent>
    <form.AppField name="partition">
      {(field) => <field.DropdownField label={_("Partition")} options={options} />}
    </form.AppField>
  </NestedContent>
)}

// ✅ CORRECT - Always add margin="mxLg" for proper air gap
{value === "reuse" && (
  <NestedContent margin="mxLg">
    <form.AppField name="partition">
      {(field) => <field.DropdownField label={_("Partition")} options={options} />}
    </form.AppField>
  </NestedContent>
)}
```

**Why this matters:** `NestedContent` provides visual indentation for revealed fields,
but without `margin="mxLg"` the nested content appears cramped against the parent
field. This pattern is used consistently in `connection-form` and other forms to
maintain proper spacing ("air gap") between form elements.

#### Mistake 9: Using `isDisabled` on form fields

```typescript
// ❌ WRONG - Disabling fields instead of conditional rendering
<field.DropdownField
  label={_("File system type")}
  isDisabled={!mountPoint}
  options={filesystemOptions}
/>

// ✅ CORRECT - Don't render fields that can't be edited
{mountPoint && (
  <form.AppField name="filesystem">
    {(field) => (
      <field.DropdownField
        label={_("File system type")}
        options={filesystemOptions}
      />
    )}
  </form.AppField>
)}

// ✅ ALSO CORRECT - Or let validation handle it
// If the field is always relevant but requires another field first,
// remove isDisabled and let form validation ensure proper order
<field.DropdownField
  label={_("File system type")}
  options={filesystemOptions}
/>
```

**Why this matters:** Per conventions, if a field cannot be edited, don't render it at
all (or render informative text instead). Disabled fields create poor UX and
accessibility issues. Validation should handle dependencies between fields, not UI
state. Exception: fields may be conditionally rendered but should not use `isDisabled`.

#### Mistake 10: Adding component dependencies without verification

```typescript
// ❌ WRONG - Adding RadioEnhanced without checking if it's used elsewhere
import RadioEnhanced from "~/components/core/RadioEnhanced";

export default function RadioGroupField({ options }) {
  return options.map((opt) => (
    <RadioEnhanced label={opt.label} /> // Unused elsewhere, adds unnecessary dependency
  ));
}

// ✅ CORRECT - Use standard PatternFly components
import { Radio } from "@patternfly/react-core";

export default function RadioGroupField({ options }) {
  return options.map((opt) => (
    <Radio label={opt.label} /> // Standard component
  ));
}
```

**Why this matters:** Before importing a component, especially from `~/components/core`,
verify it's actually used elsewhere in the codebase. If it's unused or was created
speculatively, prefer using standard PatternFly components directly. This keeps the
codebase simpler and reduces maintenance burden. Check usage with:
`git grep "import.*RadioEnhanced"` or similar.

### Summary Table

| Pattern         | Hook/Wrapper      | Register Fields              | Update Values          | onBlur Support            | Use Case                | Example                        |
| --------------- | ----------------- | ---------------------------- | ---------------------- | ------------------------- | ----------------------- | ------------------------------ |
| Field component | `useFieldContext` | Via parent `form.AppField`   | `field.handleChange()` | `field.handleBlur()`      | Single field input      | `TextField`, `DropdownField`   |
| Field group     | `withForm`        | **Must use `form.AppField`** | `field.handleChange()` | N/A (delegates to fields) | Multiple related fields | `PasswordFields`, `IpFields`   |
| Main form       | `useAppForm`      | Via `form.AppField`          | `field.handleChange()` | N/A (delegates to fields) | Form orchestration      | `ConnectionForm`, `SystemForm` |

**Key takeaways:**

- Always wrap fields in `form.AppField` to register them for validation. Using `form.setFieldValue()` alone won't register the field, and validation won't run.
- Field components must call `field.handleBlur()` to support forms that use onBlur listeners for field coordination.

---

## Persistent Forms (forms that stay mounted)

Most forms in the application navigate away after a successful submit, which
naturally resets all form state. Some forms — typically settings screens — stay
mounted. The user can submit, see a success message, then edit and submit again
without any navigation.

These forms require extra care because:

1. **Query refetches can flicker or overwrite edits.** Background refetches
   change the data reference. If the form reacts to every update, fields may
   flash or reset while the user is editing.
2. **`form.reset()` has a race condition bug.** Calling `form.reset()` directly
   inside `onSubmit` ignores the new default values (TanStack Form issue
   [#1681](https://github.com/TanStack/form/issues/1681)).
3. **Success alerts need careful state management.** Using React `useState` for
   a success flag inside a `Subscribe` callback causes re-render loops. Refs
   are required.
4. **The frozen base config can become stale.** If the form freezes config on
   mount and uses it as the base for `putConfig`, background changes (from
   websocket events, concurrent operations, or background probes) will be
   silently overwritten at submit time.

### The Solution: Three Focused Abstractions

Three hooks/HOCs cover all persistent-form concerns. Each has a single
responsibility:

| Abstraction       | File                             | Responsibility                                             |
| ----------------- | -------------------------------- | ---------------------------------------------------------- |
| `withFrozenQuery` | `hooks/form/withFrozenQuery.tsx` | Freeze initial data; protect from refetch re-renders       |
| `useFormSubmit`   | `hooks/form/useFormSubmit.tsx`   | Submit lifecycle: reset, success alert, error surfacing    |
| `useUpdateConfig` | `hooks/form/useUpdateConfig.ts`  | Safe write: fetch fresh config at submit time, merge patch |

### withFrozenQuery

A HOC that freezes the initial query data on mount and passes it as props to a
memoized form component. Query refetches update the wrapper but never reach the
inner form.

**Architecture:**

```
withFrozenQuery(useHook, FormComponent)
  └─> FrozenQueryWrapper     (subscribes to query, freezes data on mount)
        └─> MemoizedForm     (receives frozen props, protected from refetches)
              └─> TanStack Form (stable defaultValues, no flickering)
```

**How it works:**

1. The wrapper calls the query hook and freezes the result in a `useState`
   lazy initializer (runs exactly once).
2. The inner form is wrapped with `React.memo`, so it only re-renders when its
   props change.
3. Because frozen props never change, the form never re-renders due to refetches.

**Usage:**

```tsx
// Before: manual wrapper + memo + useState freeze (~20 lines)
const MemoizedAuthenticationForm = React.memo(AuthenticationForm);
export default function AuthenticationFormWrapper() {
  const currentConfig = useConfig();
  const [frozenProps] = useState(() => ({
    firstUser: currentConfig.user,
    rootUser: currentConfig.root,
  }));
  return <MemoizedAuthenticationForm {...frozenProps} />;
}

// After: one line
export default withFrozenQuery(useConfig, AuthenticationForm);
```

**Type contract:** The query hook must return an object assignable to (at least
a subset of) the form component's props.

### useFormSubmit

A hook that encapsulates the entire submit lifecycle for forms that stay
mounted. The caller provides business logic only; the hook owns everything else.

**What it handles:**

- Deferred `form.reset()` after every submit (success or no-op), using
  `setTimeout(..., 0)` to work around TanStack Form bug
  [#1681](https://github.com/TanStack/form/issues/1681)
- Success/info alert rendered via refs + `Subscribe` (avoids re-render loops
  and works around TanStack Form bug
  [#1798](https://github.com/TanStack/form/issues/1798))
- Clean→dirty transition tracking so the alert disappears only when the user
  starts editing after a successful submit
- Clearing previous server errors before each new submit attempt

**Why `useFormSubmit` is initialized before `useAppForm`:**

`onSubmitAsync` (returned by the hook) needs to be composed directly into
`useAppForm`'s `validators` option. If the hook were initialized after
`useAppForm`, the validator would need to be wired in after the fact, which
requires mutating `form.options` — fragile and non-obvious. Initializing the
hook first allows clean composition:

```tsx
// ✅ CORRECT order
const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit({
  onSubmit: async (values, fieldMeta) => { ... },
});

const form = useAppForm({
  validators: {
    onSubmitAsync: async (ctx) => {
      const fieldErrors = validate(ctx.value); // field validation first
      if (fieldErrors) return fieldErrors;
      return onSubmitAsync(ctx, form);         // business logic second
    },
  },
});
```

**`AlertSubscribe` and `formSubmitHandler` receive `form` at use time**, not at
hook init time, for the same reason — the form doesn't exist yet when the hook
runs.

**`SubmitResult` type:**

```ts
type SubmitResult =
  | { patched: true } // config was updated
  | { noChanges: true } // submit succeeded, nothing to change
  | { error: string }; // API/server error
```

**Full usage:**

```tsx
function MySettingsForm({ someData }: Props) {
  const updateConfig = useUpdateConfig();

  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit({
    successTitle: _("Settings successfully updated"),
    noChangesTitle: _("No changes detected"),
    onSubmit: async (values, fieldMeta) => {
      const patch = buildPatch(values, fieldMeta);
      if (!patch) return { noChanges: true };

      return updateConfig(patch)
        .then(() => ({ patched: true as const }))
        .catch(({ message }) => ({ error: message }));
    },
  });

  const form = useAppForm({
    ...defaultOptions,
    defaultValues: buildFormValues(someData),
    validators: {
      onSubmitAsync: async (ctx) => {
        const fieldErrors = validate(ctx.value);
        if (fieldErrors) return fieldErrors;
        return onSubmitAsync(ctx, form);
      },
    },
  });

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Could not save settings")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        <AlertSubscribe form={form} />

        {/* fields */}

        <ActionGroup>
          <form.SubmitButton label={_("Accept")} />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

export default withFrozenQuery(useConfig, MySettingsForm);
```

### useUpdateConfig

A hook that safely applies a partial config patch on top of a **fresh** config
fetched at submit time, preventing accidental overrides of unrelated settings.

**The problem it solves:**

Forms freeze their initial config (via `withFrozenQuery`) to prevent flickering.
But if that frozen config were used as the base for `putConfig`, any backend
changes that occurred while the user was editing would be silently lost.

```
t=0s   Form opens. Config frozen: { user: A, storage: X }
t=30s  Background probe updates storage: { user: A, storage: Y }
t=60s  User submits auth changes.
       Without useUpdateConfig: putConfig({ user: B, storage: X }) ← X overwrites Y
       With useUpdateConfig:    putConfig({ user: B, storage: Y }) ← Y preserved
```

**Usage:**

```tsx
const updateConfig = useUpdateConfig();

// Update specific fields
await updateConfig({ user: newUser, root: newRoot });

// Delete first user (undefined is intentional — see shake note below)
await updateConfig({ user: undefined });
```

### Why fetchQuery Instead of useSuspenseQuery

The natural instinct when writing `useUpdateConfig` is to use `useSuspenseQuery`
at the top of the hook:

```ts
// ❌ DO NOT DO THIS — stale closure problem
function useUpdateConfig() {
  const { data: freshConfig } = useSuspenseQuery(configQuery);
  return (patch) => putConfig(shake({ ...freshConfig, ...patch }));
}
```

This has a stale closure problem. The returned function closes over
`freshConfig` at **render time**. Because `withFrozenQuery` + `React.memo`
intentionally prevent the form from re-rendering on refetches, `freshConfig`
inside that closure is the value from the last render — which may be minutes
old by submit time. This is exactly the staleness problem we were trying to
solve.

`queryClient.fetchQuery` fixes this by resolving data at **call time**:

```ts
// ✅ CORRECT — data resolved at submit time
function useUpdateConfig() {
  const queryClient = useQueryClient();
  return async (patch) => {
    const freshConfig = await queryClient.fetchQuery(configQuery);
    return putConfig(shake({ ...freshConfig, ...patch }));
  };
}
```

`fetchQuery` respects `staleTime`: it returns cached data immediately if fresh,
and only hits the network if the cache is stale. It is not a blind network call
on every submit.

This is the pattern TkDodo (TanStack Query's main maintainer) explicitly
recommends for event handlers:

> "You can always call `queryClient.fetchQuery(...)` in your event handler.
> It respects staleTime so it won't fetch if you have fresh data."
>
> — TkDodo, [TanStack Query discussion #3754](https://github.com/TanStack/query/discussions/3754)

A submit handler is an event handler. `useSuspenseQuery` is the right tool for
subscribing a component to reactive data for rendering; `fetchQuery` is the
right tool for imperatively reading data inside an event handler to build a
write payload.

Note: `useQueryClient()` is still called at the top level of the hook, fully
respecting the rules of hooks. `fetchQuery` is called inside the returned async
callback, which is a regular async function, not a hook.

### Why shake Lives in useUpdateConfig, Not the Caller

Callers express "delete this field" by passing `undefined` in the patch:

```ts
await updateConfig({ user: undefined }); // delete the first user
```

The spread `{ ...freshConfig, ...patch }` correctly propagates that `undefined`
into the merged object. However, the API rejects payloads containing `undefined`
values. `shake()` strips them before the request is sent.

This is a **transport-layer concern**, not a domain concern. If `shake` were
moved to the caller, `{ user: undefined }` would be removed before reaching the
hook, and the spread would leave the `user` key untouched from `freshConfig` —
silently breaking deletes.

```ts
// ❌ shake in caller — deletes are silently broken
const patch = shake({ user: undefined }); // => {}
await updateConfig(patch); // user not removed!

// ✅ shake in hook — caller intent preserved
await updateConfig({ user: undefined }); // hook shakes after merge
```

### Putting It Together

The complete pattern for a persistent settings form:

```
withFrozenQuery(useConfig, MyForm)
  ├── withFrozenQuery: freezes config on mount, blocks refetch re-renders
  ├── useFormSubmit:   reset lifecycle, success alert, error surfacing
  └── useUpdateConfig: fresh config at submit time, patch merge, shake
```

Each abstraction is independently usable. A form that navigates away after
submit only needs `useUpdateConfig`. A form with a custom data source uses
`withFrozenQuery` with a different query hook. None of them require the others.

### Trade-offs and When Not to Use This Pattern

This is the **single-user pattern**: the form owns its state after
initialization, and background updates do not interrupt editing.

**Do not use this pattern** when:

- Multiple users may edit the same data simultaneously and you need to show
  live updates from other users (use a controlled fields + derived state
  pattern instead).
- The form is expected to navigate away after submit — standard `useAppForm`
  with `onSubmit` is sufficient.

**References:**

- TkDodo: [React Query and Forms](https://tkdodo.eu/blog/react-query-and-forms)
- TanStack Form issue [#1681](https://github.com/TanStack/form/issues/1681): `form.reset` during `onSubmit` ignores new values
- TanStack Form issue [#1798](https://github.com/TanStack/form/issues/1798): reset + `useStore` subscription bug
- TanStack Query discussion [#3754](https://github.com/TanStack/query/discussions/3754): `fetchQuery` in event handlers

---

## Code Organization

The following conventions apply to all forms using TanStack Form across the
application. They ensure forms are discoverable, maintainable, and follow
consistent patterns.

### Directory Structure

Each form lives in its own subdirectory:

```
components/
  <namespace>/<form-name>-form/
    Form.tsx              # Main form component
    fields.ts             # Field types, constants, defaults
    validations.ts        # Submit validation
    transformations.ts    # Mapping between form values and API payloads
    queries.ts            # Data hooks backing the form
    *Fields.tsx           # Field group components (if needed)
    *.test.tsx            # Tests
```

`Form.tsx` and `fields.ts` are always present. The other modules appear as the
form needs them: `validations.ts` when the form validates on submit,
`transformations.ts` when form values need non-trivial mapping to and from
backend structures, and `queries.ts` when the form needs its own data hooks.

Examples:

- `network/connection-form/`
- `system/system-form/`
- `product/registration-form/`
- `software/patterns-form/`

### File Naming

**Form component**: `Form.tsx`

- Always named `Form.tsx` inside the form directory
- The directory name provides context, making prefixes redundant
- Export the actual component with its descriptive name: `export default ConnectionForm`

**Fields module**: `fields.ts`

- Always named `fields.ts` (not `<formName>Fields.ts`)
- Contains field types, constants, and default values
- Single source of truth for the form's field vocabulary

**Validations module**: `validations.ts`

- Exports the `validate` function wired into the form's submit validator
- Composes per-group validators and the reusable helpers from
  `validation-helpers.ts`
- Imports types and constants from `fields.ts`, never the reverse

**Transformations module**: `transformations.ts`

- Converts between form values and backend structures: typically `buildPayload`
  (form values to config) and `toFormValues` (config to initial form values)

**Queries module**: `queries.ts`

- TanStack Query hooks that provide the data the form needs
- Named `queries.ts` (not `data.ts`)

**Field groups**: `*Fields.tsx`

- Components that group related form fields: `BondFields.tsx`, `IpFields.tsx`
- Use `*Fields` suffix, not `*Settings` (more accurate naming)

### The fields.ts Module

The form's field vocabulary lives in `fields.ts`: types, constants, and
defaults. It is the module every other form-local file builds on:

```typescript
import { formOptions } from "@tanstack/react-form";

/** Types */
export type FormFields = {
  field1: string;
  field2: number;
  // ...
};

/** Exported constants (if any) */
export const SOME_MODE = {
  OPTION_A: "a",
  OPTION_B: "b",
} as const;

/** Defaults */
const defaultValues: FormFields = {
  field1: "",
  field2: 0,
};

export const defaultOptions = formOptions({ defaultValues });
```

Validation lives in its own `validations.ts`, which imports the vocabulary
from `fields.ts` and exports a single `validate` function:

```typescript
import { shake } from "radashi";
import { requiredString, optionalIntRange } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";
import type {
  FieldsValidationResult,
  ValidationResult,
} from "~/components/form/validation-helpers";
import type { FormFields } from "./fields";

const validateGroup = (fields: FormFields): FieldsValidationResult<FormFields> => ({
  field1: requiredString(fields.field1, _("Field 1 is required")),
  field2: optionalIntRange(fields.field2, 0, 100, _("Must be 0-100")),
});

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateGroup(fields),
    // ...other validators
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
```

**Why this split?**

1. **Single source of truth**: the field vocabulary is defined once, in
   `fields.ts`, and every other module builds on it
2. **One reason to change per module**: adding a field touches `fields.ts`;
   tightening a rule touches `validations.ts`
3. **Clean dependency direction**: `validations.ts`, `transformations.ts`, and
   components import from `fields.ts`, never the reverse
4. **Better discoverability**: each concern has a predictable home across all
   forms
5. **Reduced cognitive load**: one consistent pattern to learn

Note: forms migrated before this split may still keep `validate` inside
`fields.ts`. Move it to `validations.ts` when touching them.

### Sharing fields across forms

When several sibling forms share part of their vocabulary (the storage forms
share filesystem and size fields, for example), the shared constants, types,
and defaults live once in a `shared/fields.ts` next to the form directories.

Form-specific `fields.ts` modules then **import and re-export** what they use:

```typescript
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE } from "~/components/storage/shared/fields";
import type { FilesystemFields, SizeFields } from "~/components/storage/shared/fields";

export { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE };
export type { FilesystemFields, SizeFields };
```

Do not re-declare shared constants locally, even with identical values: copies
kept in sync "by convention" drift eventually, and a single concept ends up
imported from different modules within the same file.

The re-export (rather than having consumers import from `shared/fields.ts`
directly) keeps form-local code importing its whole field vocabulary from one
module, without knowing which parts happen to be shared. It also leaves room
for divergence: if a form ever needs different values, its `fields.ts` can
stop re-exporting and define its own version (possibly derived from the shared
one) without touching any consumer.

### Control fields (not part of the payload)

Not every form field maps to a value the user is entering. Some fields exist
only to coordinate the form's own behavior: they act as flags or stable copies
that other fields, effects, and derived UI react to. They are declared in
`fields.ts` like any other field because TanStack Form state is the natural
place for values that components subscribe to, but `buildPayload` never reads
them directly.

Current examples in the storage forms:

- **`committedMountPoint`**: a deferred copy of `mountPoint` that only updates
  on blur, suggestion selection, or mount. Derived UI (filesystem options,
  size hints) reads this instead of the live value to avoid reacting to
  incomplete input while the user types.
- **`filesystemAction`**: the reuse-vs-format intent ("reuse" | "format")
  behind the `filesystem` selection. Only the user's own selections update it,
  so it survives automatic downgrades of the `filesystem` value and lets the
  form restore "Current" when a mount point change makes keeping the current
  filesystem possible again.

Some fields sit in between: they never appear in the payload either, but
`buildPayload` reads them to decide how to assemble it. `sizeMode` selects
which size fields produce the size config, and `showMoreFilesystemSettings`
gates whether the optional filesystem settings are included at all.

Conventions for control fields:

- **Document them as control fields** in `fields.ts` (or `shared/fields.ts`),
  stating what updates them and who reads them. Their purpose is invisible
  from the rendered form, so the comment is the only discoverable explanation.
- **Keep them out of payload building.** Transformation helpers can make this
  explicit in types, e.g. `Omit<FilesystemFields, "filesystemAction">` in
  `shared/transformations.ts`.
- **They are not validated**: validation messages point users at inputs, and
  control fields have none.
- **Update them via listeners or effects**, usually with `dontUpdateMeta`
  (the user did not edit anything, so the form should not become dirty) and,
  when the update must not trigger the field's own listeners,
  `dontRunListeners` (e.g. an automatic downgrade of `filesystem` must not
  overwrite the intent stored in `filesystemAction`).

TODO: evaluate marking control fields in their names so they are identifiable
at every use site, either with an underscore prefix (`_filesystemAction`) or a
suffix. A nested `control.*` group was considered and discarded: TanStack
supports dot-path field names, but partial value objects (`toFormValues`,
`mergeFormDefaults`, test overrides) are merged shallowly, so any partial
nested object would silently clobber sibling control fields.

### Validation Approach

Forms use plain TypeScript validation functions, living in the form's
`validations.ts`, rather than schema libraries.

**Validation helpers** are available in `~/components/form/validation-helpers.ts`.

Example:

```typescript
const validateIpFields = (fields): Record<string, string | undefined> => ({
  addresses4: requiredValidList(
    fields.addresses4,
    isValidIPv4,
    _("At least one IPv4 address is required"),
    _("Some IPv4 addresses are invalid"),
  ),
  gateway4: optionalValidString(fields.gateway4, isValidIPv4, _("Enter a valid IPv4 gateway")),
});
```

#### Validation Return Pattern

Individual validation functions return objects with `undefined` values directly.
**Do not use `shake()` in individual validators** - only use it at the top level:

```typescript
function validateUserFields(fields: FormFields): FieldsValidationResult<UserFormFields> {
  if (!fields.defineUser) return {};

  return {
    userFullName: requiredString(fields.userFullName, _("Full name is required")),
    userName: requiredString(fields.userName, _("Username is required")),
    userPassword: !fields.userUsingHashedPassword
      ? requiredString(fields.userPassword, _("Password is required"))
      : undefined, // ← undefined values are fine
    userPasswordConfirmation: passwordMismatch
      ? _("Passwords do not match")
      : !fields.userUsingHashedPassword
        ? requiredString(fields.userPasswordConfirmation, _("Password confirmation is required"))
        : undefined, // ← undefined values are fine
  };
  // No shake() here - just return the plain object
}
```

**Critical: `shake()` only at the top level**

The top-level `validate()` function uses `shake()` **once** to remove all undefined
values when merging results from individual validators:

```typescript
export function validate(formFields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateUserFields(formFields),
    ...validateRootFields(formFields),
  });
  // ^^^^^ Single shake() here removes all undefined values

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
```

**Why this pattern:**

- ✅ **Single shake()**: Better performance, no redundant filtering
- ✅ **Aligned with type system**: `FieldsValidationResult<T>` explicitly allows `undefined`
- ✅ **Cleaner validators**: Direct object returns, conditional logic clear
- ✅ **Centralized cleanup**: All undefined removal happens in one place

**Anti-pattern (don't do this):**

```typescript
// ❌ WRONG - redundant shake()
function validateUserFields(fields: FormFields): FieldsValidationResult<UserFormFields> {
  return shake({  // ← Don't shake here
    userFullName: requiredString(...),
    userPassword: condition ? requiredString(...) : undefined,
  });
}

export function validate(formFields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({  // ← And also shake here (double shake!)
    ...validateUserFields(formFields),
  });
}
```

#### Plain TypeScript vs Schema Libraries

The codebase initially experimented with Valibot, a Standard Schema validation
library (~1.5kb), using declarative schemas in separate files:

```typescript
// Initial Valibot approach (rolled back)
import * as v from "valibot";

const ipFieldsSchema = v.object({
  addresses4: v.pipe(
    v.array(v.string()),
    v.check((arr) => arr.every(isValidIPv4)),
  ),
  gateway4: v.optional(v.pipe(v.string(), v.check(isValidIPv4))),
});
```

This approach was rolled back in favor of plain TypeScript functions for several
reasons:

**Why plain TypeScript was chosen**:

1. **Simpler mental model**: Direct validation logic is more straightforward than
   schema composition
2. **No abstraction tax**: No library-specific API to learn (`v.object()`,
   `v.pipe()`, `v.check()`, etc.)
3. **Better readability**: Imperative functions are clearer when validation
   depends on combinations of field values (e.g., gateway validity depends on
   mode and presence of addresses)
4. **Co-location benefits**: Types, defaults, and validation all in one file
   without mixing declarative and imperative styles
5. **Zero dependencies**: Eliminates external validation library from bundle
6. **Lower value in this context**: Form validation is relatively simple;
   complex interdependencies between fields don't map well to declarative schemas

**What Valibot would have provided**:

1. **Standardized validation**: Standard Schema means potential compatibility with
   other tools and libraries
2. **Runtime type safety**: Schema doubles as both validator and type definition
3. **Composability**: Schemas can be composed and extended declaratively
4. **Error messages**: Built-in i18n support for validation messages

**Why these benefits add low value here**:

- **Standard Schema compatibility**: No other tools in the codebase use Standard
  Schema, so interoperability benefits don't apply
- **Runtime type safety**: TypeScript already provides compile-time type safety,
  and form values come from controlled inputs (not external APIs)
- **Composability**: Form validation often requires checking field combinations
  (`if (mode === 'manual' && addresses.length === 0)`), which is more natural in
  imperative code than composed schemas
- **Error messages**: The `i18n` function `_()` already handles translation;
  Valibot's message system adds another layer without clear benefit

The imperative approach using reusable helpers provides sufficient structure
without the learning curve and complexity of a schema system. For forms with
truly independent field validations, schemas might offer value. For forms where
validation logic frequently crosses field boundaries (as is common in network
configuration), plain TypeScript functions are more maintainable.

### Form Component Integration

Import from the form-local modules in the form component:

```typescript
import { validate } from "./validations";
import { defaultOptions, SOME_MODE } from "./fields";

function MyForm() {
  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, initialValues),
    validators: {
      onSubmitAsync: async ({ value: formValues }) => {
        return validate(formValues);
      },
    },
    onSubmit: async ({ value }) => {
      await apiCall(value);
      navigate(-1);
    },
  });

  return (
    <form.AppForm>
      {/* form fields */}
    </form.AppForm>
  );
}
```

Field group components (like `BondFields.tsx`) also import directly from `./fields.ts`:

```typescript
import { defaultOptions } from "./fields";
import { withForm } from "~/hooks/form";

const BondFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    // field components
  },
});
```

External components (like routes) only import the form component itself, not the
field configuration.

### Naming Consistency

All forms use consistent generic names for key exports and internal identifiers:

**Form options**: `defaultOptions`

```typescript
export const defaultOptions = formOptions({ defaultValues });
```

**Default values**: `defaultValues`

```typescript
const defaultValues: FormFields = {
  // ...
};
```

**Validation function**: `validate`

```typescript
export function validate(
  fields: FormFields,
): { fields?: Partial<Record<keyof FormFields, string>> } | undefined {
  // ...
}
```

Form-specific prefixes (like `connectionFormOptions` or `validateConnectionForm`)
are avoided. The directory structure and module imports already provide the
necessary context, making prefixes redundant. This generic naming makes the
pattern immediately recognizable across all forms.

### Benefits Summary

The unified approach provides:

- **Discoverability**: Consistent structure across all forms
- **Maintainability**: Each form concern has a predictable home
- **Simplicity**: Plain TypeScript, no library abstractions
- **Type safety**: Full TypeScript support throughout
- **Performance**: Zero runtime validation overhead
- **Developer experience**: Clear pattern, easy to learn and apply

---

## Common Migration Mistakes

This section documents mistakes encountered during form migrations to help avoid repeating them in future work.

### Mistake 1: Using hooks inside `form.Subscribe` children

**❌ WRONG:**

```typescript
const MyFields = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <form.Subscribe selector={(s) => ({ value: s.values.someField })}>
      {({ value }) => {
        const data = useHook(value); // ❌ Hook inside Subscribe children
        return <div>{data}</div>;
      }}
    </form.Subscribe>
  ),
});
```

**✅ CORRECT:**

```typescript
// Extract to separate withForm component
const InnerContent = withForm({
  ...defaultOptions,
  props: { value: "" },
  render: ({ form, value }) => {
    const data = useHook(value); // ✅ Hook at component top level
    return <div>{data}</div>;
  },
});

const MyFields = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <form.Subscribe selector={(s) => ({ value: s.values.someField })}>
      {({ value }) => <InnerContent form={form} value={value} />}
    </form.Subscribe>
  ),
});
```

**Why:** Hooks must be called at component top level, not inside render prop children. The Subscribe render prop is a function, not a component.

**Reference:** Partition form - FilesystemFields initially had hooks inside Subscribe, fixed by extracting FilesystemFieldsContent as a proper withForm component.

### Mistake 2: Wrapping field groups in Stack when Form expects direct FormGroup children

**❌ WRONG:**

```typescript
const MyFieldsContent = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <Stack hasGutter>
      {/* ❌ Stack wrapper prevents Form from seeing FormGroup children */}
      <form.AppField name="field1">
        {(field) => <field.TextField label="Field 1" />}
      </form.AppField>
      <form.AppField name="field2">
        {(field) => <field.TextField label="Field 2" />}
      </form.AppField>
    </Stack>
  ),
});
```

**Problem:** PatternFly Form adds spacing between FormGroup elements. When you return Subscribe → Stack → FormGroups, the Form component sees Subscribe (not FormGroup children), breaking the spacing hierarchy.

**✅ CORRECT:**

```typescript
const MyFieldsContent = withForm({
  ...defaultOptions,
  render: ({ form }) => (
    <>
      {/* ✅ Fragment lets Form see FormGroup children directly */}
      <form.AppField name="field1">
        {(field) => <field.TextField label="Field 1" />}
      </form.AppField>
      <form.AppField name="field2">
        {(field) => <field.TextField label="Field 2" />}
      </form.AppField>
    </>
  ),
});
```

**Why:** PatternFly Form manages spacing between FormGroup elements. Return a fragment with form.AppField children (which render FormGroups), not wrapped in Stack. Only use Stack when you need explicit vertical spacing within a single field's content (like spacing between radio buttons).

**Reference:** Partition form - FilesystemFieldsContent initially wrapped everything in Stack, causing layout overlap.

### Mistake 3: Rendering nested content outside the parent Stack in RadioGroupField

**Understanding the structure:**

RadioGroupField needs Stack to space radio buttons vertically:

```typescript
<FormGroup>
  <Stack hasGutter> {/* ← Spaces Radio buttons within the field */}
    <Radio label="Option 1" />
    <Radio label="Option 2" />
  </Stack>
</FormGroup>
```

PatternFly Form spaces FormGroups (different fields), but doesn't space elements within a single field. The Stack provides that internal spacing.

**❌ WRONG:**

```typescript
<FormGroup>
  <Stack hasGutter>
    {options.map(opt => <Radio {...opt} />)}
  </Stack>
  {children?.(field.state.value)} {/* ❌ Outside Stack */}
</FormGroup>
```

**Problem:** Children rendered outside Stack are direct FormGroup children. FormGroup adds extra spacing between its direct children, so nested content appears too far below.

**✅ CORRECT:**

```typescript
<FormGroup>
  <Stack hasGutter>
    {options.map(opt => <Radio {...opt} />)}
    {children?.(field.state.value)} {/* ✅ Inside Stack */}
  </Stack>
</FormGroup>
```

**Why:** Children are part of the radio group's vertical flow. Rendering them inside Stack keeps them in the natural flow with proper gutter spacing.

**Reference:** Partition form - Fixed RadioGroupField to render children inside Stack.

### Mistake 4: Cross-field validation returning errors for non-existent fields

**❌ WRONG:**

```typescript
function validateSizeRange(fields: FormFields): string | undefined {
  return sizeRange(fields.minSize, fields.maxSize, "Error message");
}

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    minSize: validateMinSize(fields),
    maxSize: validateMaxSize(fields),
    sizeRange: validateSizeRange(fields), // ❌ "sizeRange" not in FormFields
  });

  if (Object.keys(fieldErrors).length > 0) return { fields: fieldErrors };
}
```

**Problem:** Returns error for "sizeRange" field which doesn't exist.

**✅ CORRECT:**

```typescript
function validateMaxSize(fields: FormFields): string | undefined {
  if (fields.sizeMode !== SIZE_MODE.RANGE) return undefined;

  const requiredError = requiredSize(fields.maxSize, "Required", "Invalid");
  if (requiredError) return requiredError;

  // Cross-field validation incorporated
  return sizeRange(fields.minSize, fields.maxSize, "Min > Max error");
}

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    minSize: validateMinSize(fields),
    maxSize: validateMaxSize(fields), // ✅ Shows error on maxSize
  });

  if (Object.keys(fieldErrors).length > 0) return { fields: fieldErrors };
}
```

**Why:** Cross-field errors must attach to actual fields. Pick which field should show the error (typically "max" or "end").

**Reference:** Partition form - Incorporated validateSizeRange into validateMaxSize.

### Mistake 5: Not pre-selecting first option in dependent dropdowns

**❌ WRONG:**

```typescript
<form.AppField name="selectedItem">
  {(field) => (
    <field.DropdownField
      label="Item"
      options={items.map(i => ({ value: i.id, label: i.name }))}
    />
  )}
</form.AppField>
```

**Problem:** Dropdown appears with no selection when items are available.

**✅ CORRECT:**

```typescript
<form.AppField
  name="selectedItem"
  listeners={{
    onMount: ({ value }) => {
      if (!value && items.length > 0) {
        form.setFieldValue("selectedItem", items[0].id, {
          dontUpdateMeta: true,
        });
      }
    },
  }}
>
  {(field) => (
    <field.DropdownField
      label="Item"
      options={items.map(i => ({ value: i.id, label: i.name }))}
    />
  )}
</form.AppField>
```

**Why:** Conditional dropdowns should pre-select first option. `listeners.onMount` fires when field mounts. `dontUpdateMeta: true` prevents marking form dirty.

**Reference:** Partition form - Added onMount to pre-select first partition. Pattern from DeviceSelector.

### Mistake 6: Missing dropdown option descriptions

**❌ WRONG:**

```typescript
options={partitions.map(p => ({
  value: p.name,
  label: deviceLabel(p, true),
}))}
```

**Problem:** Users see "vdd1", "vdd2", "vdd3" without context.

**✅ CORRECT:**

```typescript
options={partitions.map(p => {
  const fsLabel = p.filesystem?.label;
  const description = [p.description, fsLabel].filter(Boolean).join(" - ");
  return {
    value: p.name,
    label: deviceLabel(p, true),
    description: description || undefined,
  };
})}
```

**Why:** Descriptions provide essential context (size, type, label, etc.).

**Reference:** Partition form - Added partition.description + filesystem label.

### Mistake 7: Using FormGroup + Text instead of ReadOnlyField

**❌ WRONG:**

```typescript
<FormGroup label="File system">
  <Text>
    Partition is not formatted. It will be formatted with selected type.
  </Text>
</FormGroup>
```

**Problem:** Creates orphan `<label>` without associated form control - invalid HTML and accessibility issue.

**✅ CORRECT:**

```typescript
<form.AppField name="myField">
  {(field) => <field.ReadOnlyField label="Label" />}
</form.AppField>
```

**Why:** A `<label>` element requires an associated form control ([HTML spec](https://html.spec.whatwg.org/multipage/forms.html#the-label-element)). ReadOnlyField provides proper semantic structure without accessibility issues.

**Note:** The field must be typed as `string` in FormFields to accept display text. Add a comment explaining it can contain display strings for ReadOnlyField (see `partitionSource` and `filesystemAction` fields in partition form).

**Reference:** Partition form - Initially used FormGroup + Text, corrected to ReadOnlyField following PartitionSourceFields pattern.

### Summary Checklist for Form Migrations

- ✅ No hooks inside `form.Subscribe` children (extract to withForm components)
- ✅ Field group components return fragments, not wrapped in Stack
- ✅ RadioGroupField children rendered inside Stack
- ✅ Cross-field validation errors attached to actual form fields
- ✅ Conditional dropdowns pre-select first option via `listeners.onMount`
- ✅ Dropdown options include descriptions with identifying information
- ✅ Use ReadOnlyField (not FormGroup + Text) for non-editable informational text
- ✅ All XFields components use `withForm` pattern
- ✅ TRANSLATORS comments above all translatable strings
- ✅ Follow mockup specifications exactly (ask before being creative)
