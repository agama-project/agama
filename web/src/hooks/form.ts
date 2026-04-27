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

import { createFormHook } from "@tanstack/react-form";
import { fieldContext, formContext, useFieldContext, useFormContext } from "~/hooks/form-contexts";
import ArrayField from "~/components/form/ArrayField";
import CancelButton from "~/components/form/CancelButton";
import CheckboxField from "~/components/form/CheckboxField";
import DropdownField from "~/components/form/DropdownField";
import SubmitButton from "~/components/form/SubmitButton";
import TextField from "~/components/form/TextField";

/**
 * Application-wide TanStack Form hook.
 *
 * @see https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
 */
const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    ArrayField,
    CheckboxField,
    DropdownField,
    TextField,
  },
  formComponents: { CancelButton, SubmitButton },
});

/**
 * Options accepted by useAppForm, derived via `Parameters` to stay in sync with
 * TanStack Form's API automatically.
 */
type AppFormOptions = Parameters<typeof useAppForm>[0];

/**
 * Specific options for {@link usePristineSafeForm}, not part of useAppForm.
 */
type PristineSafeFormOwnOptions = {
  /** Called after every submission, whether the form was dirty or pristine. */
  onSubmitComplete?: () => void;
};

/**
 * Options accepted by {@link usePristineSafeForm}, built on top of
 * {@link AppFormOptions} and {@link PristineSafeFormOwnOptions}.
 */
type PristineSafeFormOptions = AppFormOptions & PristineSafeFormOwnOptions;

/**
 * Form hook built on top of useAppForm that skips business logic when pristine.
 *
 * Optimizes form submission by checking if the form has changes before executing
 * validation and business logic. Always executes onSubmitComplete regardless of
 * pristine state, making it ideal for forms that need guaranteed completion logic
 * (e.g., navigation, cleanup, modal dismissal).
 *
 * Behavior:
 * - When pristine: skips validators.onSubmitAsync and onSubmit business logic
 * - When dirty: executes all validators and handlers normally
 * - Always: executes onSubmitComplete
 *
 * Use this pattern to separate concerns:
 * - validators.onSubmitAsync: validation logic (skipped when pristine)
 * - onSubmit: business logic like data persistence (skipped when pristine)
 * - onSubmitComplete: completion logic like navigation (always executed)
 *
 * TypeScript does not support exact object types natively (see link below).
 * Because this hook destructures known keys and forwards the rest to useAppForm
 * via `...rest`, unknown properties would be silently passed through to
 * useAppForm without complaint, potentially causing subtle bugs. A plain `T
 * extends PristineSafeFormOptions` would not catch this: TypeScript infers T
 * from the call site and includes the extra keys in T's shape. The intersection
 * with `Record<Exclude<keyof T, keyof PristineSafeFormOptions>, never>` forces
 * any key in T not present in PristineSafeFormOptions to be typed as `never`.
 * Passing an unknown property then produces a type error ("Type X is not
 * assignable to type never"), while keeping T generic ensures the return type
 * is fully inferred from the options passed in.
 *
 * @see https://github.com/microsoft/TypeScript/issues/12936
 *
 * @example
 * const form = usePristineSafeForm({
 *   defaultValues: { patterns: {} },
 *   validators: {
 *     onSubmitAsync: async ({ value }) => validatePatterns(value),
 *   },
 *   onSubmit: async ({ value }) => {
 *     await patchConfig(value);
 *   },
 *   onSubmitComplete: () => navigate(SOFTWARE.root),
 * });
 */
function usePristineSafeForm<T extends PristineSafeFormOptions>(
  options: T & Record<Exclude<keyof T, keyof PristineSafeFormOptions>, never>,
) {
  const { onSubmitComplete, ...useAppFormOptions } = options as PristineSafeFormOptions;
  const { validators, onSubmit, ...rest } = useAppFormOptions as AppFormOptions;

  return useAppForm({
    ...rest,
    validators: {
      ...validators,
      onSubmitAsync: async (ctx) => {
        const { onSubmitAsync } = validators ?? {};
        if (ctx.formApi.state.isDirty && typeof onSubmitAsync === "function") {
          return onSubmitAsync(ctx);
        }
      },
    },
    onSubmit: async (ctx) => {
      if (ctx.formApi.state.isDirty) {
        await onSubmit?.(ctx);
      }
      onSubmitComplete?.();
    },
  });
}

/**
 * Merges runtime-derived values into a `formOptions` object's `defaultValues`.
 *
 * Use this when some defaults depend on runtime data (e.g. values from a hook)
 * that cannot be known when the shared options are defined statically.
 *
 * @example
 * const myFormOpts = formOptions({ defaultValues: { name: "", device: "" } });
 *
 * function MyForm() {
 *   const device = useCurrentDevice();
 *   const form = useAppForm({
 *     ...mergeFormDefaults(myFormOpts, { device: device.name }),
 *     onSubmit: ...,
 *   });
 * }
 */
function mergeFormDefaults<T extends { defaultValues: Record<string, unknown> }>(
  opts: T,
  runtimeDefaults: Partial<T["defaultValues"]>,
): T {
  return { ...opts, defaultValues: { ...opts.defaultValues, ...runtimeDefaults } };
}

export {
  useAppForm,
  usePristineSafeForm,
  withForm,
  mergeFormDefaults,
  useFieldContext,
  useFormContext,
};
