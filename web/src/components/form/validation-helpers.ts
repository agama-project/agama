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
 * Validation helpers.
 *
 * Plain TypeScript functions that return error messages or undefined.
 * Each helper provides clear validation intent, keeping validation code readable.
 */

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
