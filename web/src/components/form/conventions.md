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

### Summary Table

| Pattern | Hook/Wrapper | Register Fields | Update Values | onBlur Support | Use Case | Example |
|---------|--------------|-----------------|---------------|----------------|----------|---------|
| Field component | `useFieldContext` | Via parent `form.AppField` | `field.handleChange()` | `field.handleBlur()` | Single field input | `TextField`, `DropdownField` |
| Field group | `withForm` | **Must use `form.AppField`** | `field.handleChange()` | N/A (delegates to fields) | Multiple related fields | `PasswordFields`, `IpFields` |
| Main form | `useAppForm` | Via `form.AppField` | `field.handleChange()` | N/A (delegates to fields) | Form orchestration | `ConnectionForm`, `SystemForm` |

**Key takeaways:**
- Always wrap fields in `form.AppField` to register them for validation. Using `form.setFieldValue()` alone won't register the field, and validation won't run.
- Field components must call `field.handleBlur()` to support forms that use onBlur listeners for field coordination.

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
    fields.ts             # Types, defaults, validation
    *Fields.tsx           # Field group components (if needed)
    *.test.tsx            # Tests
```

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
- Contains types, defaults, validation, and constants
- Single source of truth for all form concerns

**Field groups**: `*Fields.tsx`

- Components that group related form fields: `BondFields.tsx`, `IpFields.tsx`
- Use `*Fields` suffix, not `*Settings` (more accurate naming)

### The fields.ts Module

All form data concerns live in a single `fields.ts` file:

```typescript
import { formOptions } from "@tanstack/react-form";
import type {
  FieldsValidationResult,
  ValidationResult,
} from "~/components/form/validation-helpers";
import {
  requiredString,
  optionalIntRange,
} from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

/** Types */
type FormFields = {
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

/** Validation */
const validateGroup = (fields: FormFields): FieldsValidationResult<FormFields> => ({
  field1: requiredString(fields.field1, _("Field 1 is required")),
  field2: optionalIntRange(fields.field2, 0, 100, _("Must be 0-100")),
});

export function validate(fields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = {
    ...validateGroup(fields),
    // ...other validators
  };

  const errors: Record<string, string> = {};
  for (const [key, error] of Object.entries(fieldErrors)) {
    if (error !== undefined) errors[key] = error;
  }

  return Object.keys(errors).length > 0 ? { fields: errors } : undefined;
};
```

**Why everything in one file?**

1. **Single source of truth**: All form structure in one place
2. **Co-location**: Type, default, and validation visible together
3. **Easier maintenance**: Add/modify fields with full context
4. **Better discoverability**: Always check `fields.ts` first
5. **Reduced cognitive load**: One consistent pattern to learn

### Validation Approach

Forms use plain TypeScript validation functions rather than schema libraries.

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

Import from `fields.ts` in the form component:

```typescript
import { defaultOptions, validate, SOME_MODE } from "./fields";

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
- **Maintainability**: Single file for all form concerns
- **Simplicity**: Plain TypeScript, no library abstractions
- **Type safety**: Full TypeScript support throughout
- **Performance**: Zero runtime validation overhead
- **Developer experience**: Clear pattern, easy to learn and apply
