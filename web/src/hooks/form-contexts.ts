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

/**
 * Shared TanStack Form contexts.
 *
 * Lives in its own module to break a circular dependency:
 *   - `hooks/form.ts` imports field components to register them.
 *   - Field components import `useFieldContext` to read the current field.
 *
 * If both lived in `hooks/form.ts`, each side would import the other.
 * Field components import from here instead, keeping the dependency graph
 * acyclic.
 *
 * ## Field component conventions
 *
 * All field components (TextField, NumberField, CheckboxField, DropdownField, ArrayField)
 * follow the same contract:
 *
 * - `onChange` is wired internally. No value or change handler props are
 *   needed or accepted.
 * - DOM events like `onBlur` and `onFocus` are intentionally not wired.
 *   This project validates on submit only and does not currently rely on
 *   blur or focus feedback. If a use case arises, the relevant component
 *   can be updated and consumers can react via `form.AppField` listeners.
 * - TanStack Form lifecycle events (`onMount`, `onUnmount`) are not DOM
 *   events and never belong on field components. Use `form.AppField`
 *   listeners for those.
 * - Side effects and validators belong on `form.AppField`, not on the field
 *   component itself:
 *
 * @example
 * // Validator and listener on form.AppField, not on the field component.
 * <form.AppField
 *   name="gateway"
 *   validators={{ onSubmit: ({ value }) => !value ? "Required" : undefined }}
 *   listeners={{ onChange: ({ fieldApi }) => console.log(fieldApi.state.meta.isDirty) }}
 * >
 *   {(field) => <field.TextField label={_("Gateway")} />}
 * </form.AppField>
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/validation
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/listeners
 */
import { createFormHookContexts } from "@tanstack/react-form";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();
