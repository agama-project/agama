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
 *
 * Validation helpers for TanStack Form.
 *
 * Plain TypeScript functions that return an error message string when
 * validation fails, or `undefined` when the value is valid. Each helper encodes
 * a single, named validation rule, keeping `fields.ts` validation functions
 * readable and intent-revealing.
 *
 * Also exports {@link ValidationResult} and {@link FieldsValidationResult}, the
 * shared return types for form validation. {@link ValidationResult} is the
 * final type returned by top-level `validate` functions used with TanStack
 * Form's `onSubmitAsync` validator. {@link FieldsValidationResult} is the
 * intermediate type returned by field group validators before they are merged
 * and stripped of `undefined` values by `validate`.
 *
 */

/** Types */

/**
 * Return type for form validation functions used with TanStack Form's
 * `onSubmitAsync` validator.
 *
 * - `undefined` — all fields are valid, submission may proceed.
 * - `{ fields }` — one or more field-level errors; keyed by field name.
 * - `{ form }` — a form-level error not tied to any specific field (e.g. a
 *   server error or network failure caught in the submit handler).
 * - `{ fields, form }` — both simultaneously.
 *
 * `T` is the form's field type (e.g. `FormFields`), which constrains the
 * `fields` keys to actual field names, catching typos at compile time.
 *
 * @example
 * export function validate(fields: FormFields): ValidationResult<FormFields> {
 *   const errors = shake({
 *     name: requiredString(fields.name, _("Name is required")),
 *   });
 *   if (!isEmpty(errors)) return { fields: errors };
 * }
 *
 * @example
 * // In onSubmitAsync, validate() and catch() both produce a ValidationResult:
 * onSubmitAsync: async ({ value: formValues }) => {
 *   const result = validate(formValues);
 *   if (result) return result;
 *
 *   return await apiCall(formValues)
 *     .then(() => undefined)
 *     .catch(() => ({ form: _("The request failed") }));
 * },
 */
export type ValidationResult<T extends Record<string, unknown>> =
  | {
      fields?: Partial<Record<keyof T, string>>;
      form?: string;
    }
  | undefined;

/**
 * Return type for individual field group validators — the intermediate shape
 * before {@link ValidationResult} is assembled by the top-level `validate`
 * function.
 *
 * Each key maps to either an error string or `undefined` (no error). The
 * top-level `validate` merges multiple `FieldsValidationResult` objects and
 * strips `undefined` values before returning a {@link ValidationResult}.
 *
 * `T` should be the specific field group type (e.g. `IpFormFields`), which
 * constrains the keys to actual field names.
 *
 * @example
 * const validateIpFields = (fields: IpFormFields): FieldsValidationResult<IpFormFields> => ({
 *   addresses4: requiredValidList(fields.addresses4, isValidIPv4Address, ...),
 *   gateway4: optionalValidString(fields.gateway4, isValidIPv4, ...),
 * });
 */
export type FieldsValidationResult<T extends Record<string, unknown>> = Partial<
  Record<keyof T, string | undefined>
>;

/** Helpers */

/**
 * Non-empty string after trimming whitespace.
 *
 * @example
 * requiredString("", "Name is required") // "Name is required"
 * requiredString("  ", "Name is required") // "Name is required"
 * requiredString("foo", "Name is required") // undefined
 */
export const requiredString = (value: string, message: string): string | undefined => {
  return value.trim().length === 0 ? message : undefined;
};

/**
 * Inclusive integer range check.
 *
 * Bounds are inclusive on both ends, avoiding off-by-one errors.
 *
 * @example
 * intRange(5, 0, 10, "Must be 0-10") // undefined
 * intRange(15, 0, 10, "Must be 0-10") // "Must be 0-10"
 * intRange(undefined, 0, 10, "Must be 0-10") // undefined
 */
export const intRange = (
  value: number | undefined,
  min: number,
  max: number,
  message: string,
): string | undefined => {
  if (value === undefined) return undefined;
  return value >= min && value <= max ? undefined : message;
};

/**
 * Required inclusive integer range — undefined/null fails, present values are range-checked.
 *
 * @example
 * requiredIntRange(undefined, 0, 10, "Required", "Must be 0-10") // "Required"
 * requiredIntRange(5, 0, 10, "Required", "Must be 0-10") // undefined
 * requiredIntRange(15, 0, 10, "Required", "Must be 0-10") // "Must be 0-10"
 */
export const requiredIntRange = (
  value: number | undefined,
  min: number,
  max: number,
  emptyMessage: string,
  invalidMessage: string,
): string | undefined => {
  if (value === undefined || value === null) return emptyMessage;
  return intRange(value, min, max, invalidMessage);
};

/**
 * Optional inclusive integer range — undefined passes, present values are range-checked.
 *
 * @example
 * optionalIntRange(undefined, 0, 10, "Must be 0-10") // undefined
 * optionalIntRange(5, 0, 10, "Must be 0-10") // undefined
 * optionalIntRange(15, 0, 10, "Must be 0-10") // "Must be 0-10"
 */
export const optionalIntRange = (
  value: number | undefined,
  min: number,
  max: number,
  message: string,
): string | undefined => {
  return intRange(value, min, max, message);
};

/**
 * Non-empty array where every item passes the predicate.
 *
 * Reports empty and invalid as separate messages so the user knows
 * whether to add an entry or fix an existing one.
 *
 * @example
 * requiredValidList([], isValid, "Required", "Invalid") // "Required"
 * requiredValidList(["valid"], isValid, "Required", "Invalid") // undefined
 * requiredValidList(["invalid"], isValid, "Required", "Invalid") // "Invalid"
 */
export const requiredValidList = (
  value: string[],
  predicate: (item: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
): string | undefined => {
  if (value.length === 0) return emptyMessage;
  return value.every(predicate) ? undefined : invalidMessage;
};

/**
 * Array that may be empty, but any present items must pass the predicate.
 *
 * @example
 * optionalValidList([], isValid, "Invalid") // undefined
 * optionalValidList(["valid"], isValid, "Invalid") // undefined
 * optionalValidList(["invalid"], isValid, "Invalid") // "Invalid"
 */
export const optionalValidList = (
  value: string[],
  predicate: (item: string) => boolean,
  invalidMessage: string,
): string | undefined => {
  return value.every(predicate) ? undefined : invalidMessage;
};

/**
 * Required non-empty string that must also pass the predicate.
 *
 * @example
 * requiredValidString("", isValid, "Required", "Invalid") // "Required"
 * requiredValidString("valid", isValid, "Required", "Invalid") // undefined
 * requiredValidString("invalid", isValid, "Required", "Invalid") // "Invalid"
 */
export const requiredValidString = (
  value: string,
  predicate: (s: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
): string | undefined => {
  if (value.length === 0) return emptyMessage;
  return predicate(value) ? undefined : invalidMessage;
};

/**
 * Empty string passes; non-empty must satisfy the predicate.
 *
 * @example
 * optionalValidString("", isValid, "Invalid") // undefined
 * optionalValidString("valid", isValid, "Invalid") // undefined
 * optionalValidString("invalid", isValid, "Invalid") // "Invalid"
 */
export const optionalValidString = (
  value: string,
  predicate: (s: string) => boolean,
  invalidMessage: string,
): string | undefined => {
  if (value === "") return undefined;
  return predicate(value) ? undefined : invalidMessage;
};
