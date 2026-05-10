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

import {
  array,
  check,
  literal,
  minLength,
  minValue,
  maxValue,
  number,
  optional,
  pipe,
  string,
  trim,
  union,
} from "valibot";

/**
 * Validation schema helpers.
 *
 * Named imports (not `import * as v`) preserve tree-shaking.
 * Each helper provides clear validation intent, keeping schema files readable.
 *
 * Library-agnostic naming: these wrap Valibot today, but could wrap a
 * different validation library tomorrow without changing call sites.
 */

// Re-export basic primitives for direct use in schemas
export { string, boolean, object, pipe, check, safeParse, flatten } from "valibot";

/**
 * Array of strings with no validation on individual items.
 */
export const stringArray = () => array(string());

/**
 * Non-empty array of strings.
 * Reports the absence of items with a clear message.
 */
export const requiredStringArray = (emptyMessage: string) =>
  pipe(array(string()), minLength(1, emptyMessage));

/**
 * Non-empty string after trimming whitespace.
 */
export const requiredString = (message: string) => pipe(string(), trim(), minLength(1, message));

/**
 * Inclusive integer range check.
 *
 * Uses minValue/maxValue for inclusive bounds on both ends, avoiding the
 * off-by-one errors that come from exclusive-end range checks.
 */
export const intRange = (min: number, max: number, message: string) =>
  pipe(number(), minValue(min, message), maxValue(max, message));

/**
 * Optional inclusive integer range — undefined passes, present values are range-checked.
 */
export const optionalIntRange = (min: number, max: number, message: string) =>
  optional(intRange(min, max, message));

/**
 * Non-empty array where every item passes the predicate.
 *
 * Reports empty and invalid as separate messages so the user knows
 * whether to add an entry or fix an existing one.
 */
export const requiredValidArray = (
  predicate: (item: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
) =>
  pipe(
    array(string()),
    minLength(1, emptyMessage),
    check((items) => items.every(predicate), invalidMessage),
  );

/**
 * Array that may be empty, but any present items must pass the predicate.
 */
export const optionalValidArray = (predicate: (item: string) => boolean, invalidMessage: string) =>
  pipe(
    array(string()),
    check((items) => items.every(predicate), invalidMessage),
  );

/**
 * Required non-empty string that must also pass the predicate.
 */
export const requiredValidString = (
  predicate: (s: string) => boolean,
  emptyMessage: string,
  invalidMessage: string,
) => pipe(string(), minLength(1, emptyMessage), check(predicate, invalidMessage));

/**
 * Empty string passes; non-empty must satisfy the predicate.
 */
export const optionalValidString = (predicate: (s: string) => boolean, invalidMessage: string) =>
  union([literal(""), pipe(string(), check(predicate, invalidMessage))]);
