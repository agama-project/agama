/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import { isArray, isPlainObject, mapEntries } from "radashi";
import { generatePath } from "react-router";
import { ISortBy, sort } from "fast-sort";

/**
 * Generates a new array without null and undefined values.
 */
const compact = <T>(collection: Array<T>) => {
  return collection.filter((e) => e !== null && e !== undefined);
};

/**
 * Parses a "numeric dot string" as a hexadecimal number.
 *
 * Accepts only strings containing hexadecimal numbers (`0–9a-fA-F`) and dots (`.`),
 * for example: `"0.0.0160"` `"0.0.019d"` or `"123"`. Dots are removed before parsing.
 *
 * If the cleaned string contains any non-digit characters (such as letters),
 * or is not a valid integer string, the function returns `0`.
 *
 * @example
 *
 * ```ts
 * hex("0.0.0.160"); // Returns 352
 * hex("0.0.0.19d"); // Returns 352
 * hex("1.2.3");     // Returns 291
 * hex("..");        // Returns 0 (empty string before removing dots)
 * ```
 *
 * @param value - A string representing a dot-separated numeric value
 * @returns The number parsed as hexadecimal (base-16) integer, or `0` if invalid
 */
const hex = (value: string): number => {
  const sanitizedValued = value.replaceAll(".", "");
  return /^[0-9a-fA-F]+$/.test(sanitizedValued) ? parseInt(sanitizedValued, 16) : 0;
};

/**
 * Wrapper around window.location.reload
 *
 * It's needed mainly to ease testing because we can't override window in jest with jsdom anymore
 *
 * See below links
 *   - https://github.com/jsdom/jsdom/blob/master/Changelog.md#2100
 *   - https://github.com/jsdom/jsdom/issues/3492
 */
const locationReload = () => {
  window.location.reload();
};

/**
 * Wrapper around window.location.search setter
 *
 * It's needed mainly to ease testing as we can't override window in jest with jsdom anymore
 *
 * See below links
 *   - https://github.com/jsdom/jsdom/blob/master/Changelog.md#2100
 *   - https://github.com/jsdom/jsdom/issues/3492
 *
 * @param query
 */
const setLocationSearch = (query: string) => {
  window.location.search = query;
};

/**
 * Whether Agama server is running locally or not.
 *
 * This function should be used only in special cases, the Agama behavior should
 * be the same regardless of the user connection.
 *
 * The local connection can be forced by setting the `LOCAL_CONNECTION`
 * environment variable to `1`. This can be useful for debugging or for
 * development.
 *
 * @returns `true` if the connection is local, `false` otherwise
 */
const localConnection = (location: Location | URL = window.location) => {
  // forced local behavior
  if (process.env.LOCAL_CONNECTION === "1") return true;

  const hostname = location.hostname;

  // using the loopback device? (hostname or IP address)
  return hostname === "localhost" || hostname.startsWith("127.");
};

/**
 * Time for the given timezone.
 *
 * @param timezone - E.g., "Atlantic/Canary".
 * @param date - Date to take the time from.
 *
 * @returns Time in 24 hours format (e.g., "23:56"). Undefined for an unknown timezone.
 */
const timezoneTime = (timezone: string, date: Date = new Date()): string | undefined => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeStyle: "short",
      hour12: false,
    });

    return formatter.format(date);
  } catch (e) {
    if (e instanceof RangeError) return undefined;

    throw e;
  }
};

/**
 * Masks all but the last `visible` characters of a string.
 *
 * Replaces each character in the input string with `maskChar` ("*" by default),
 * except for the last `visible` (4 by default) characters, which are left
 * unchanged. If `visible` is greater than or equal to the string length, the
 * input is returned as-is.
 *
 * @example
 * ```ts
 * mask("123456789");          // "*****6789"
 * mask("secret", 2);          // "****et"
 * mask("secret", 6);          // "secret"
 * mask("secret", 3, "#");     // "###ret"
 * ```
 *
 * @param value - The input string to mask
 * @param visible - Number of trailing characters to leave unmasked (default: 4)
 * @param maskChar - The character to use for masking (default: "*")
 * @returns The masked string with only the last `visible` characters shown
 */
const mask = (value: string, visible: number = 4, maskChar: string = "*"): string => {
  const length = value.length;
  const safeVisible = Number.isFinite(visible) && visible > 0 ? visible : 0;
  const maskedLength = Math.max(0, length - safeVisible);
  const visiblePart = safeVisible === 0 ? "" : value.slice(-safeVisible);
  return maskChar.repeat(maskedLength) + visiblePart;
};

// list of sensitive object properties replaced by the maskSecrets() function
const defaultSensitiveKeys = [
  // storage
  "encryptionPassword",
  // users
  "password",
  // registration
  "registrationCode",
  // storage (iSCSI setting)
  "reverse_password",
];

/**
 * Recursively filters an object by replacing sensitive values with text
 * "[FILTERED]". Useful for logging possibly sensitive data.
 *
 * It returns a new object, the original input is unchanged.
 *
 * @example
 * ```ts
 * const data = { user: "John", password: "123" };
 * // logs '{ "user": "John", "password": "[FILTERED]" }'
 * console.log(maskSecrets(data));
 * ```
 *
 * @param obj - The object or array to sanitize
 * @param options - Options object { sensitiveKeys, stringify }
 * @returns Sanitized copy of the input
 */
const maskSecrets = (
  obj: unknown,
  {
    sensitiveKeys = defaultSensitiveKeys,
    stringify = true,
  }: { sensitiveKeys?: string[]; stringify?: boolean } = {},
): unknown => {
  const mask = (currentObj: unknown): unknown => {
    if (isArray(currentObj)) {
      return currentObj.map(mask);
    }

    return isPlainObject(currentObj)
      ? mapEntries(currentObj, (k, v) => [k, sensitiveKeys.includes(k) ? "[FILTERED]" : mask(v)])
      : currentObj;
  };

  const result = mask(obj);

  if (stringify) {
    return JSON.stringify(result, null, 2);
  }

  return result;
};

/**
 * A wrapper around React Router's `generatePath` that ensures all path parameters
 * are URI-encoded using `encodeURIComponent`. This prevents broken URLs caused by
 * special characters such as spaces, `#`, `$`, and others.
 *
 * @example
 * ```ts
 *   // Returns "/network/Wired%20%231"
 *   generateEncodedPath("/network/:id", { id: "Wired #1" });
 * ```
 */
const generateEncodedPath = (...args: Parameters<typeof generatePath>) => {
  const [path, params] = args;
  return generatePath(
    path,
    mapEntries(params, (key, value) => [key, encodeURIComponent(value)]),
  );
};

/**
 * A lightweight wrapper around `fast-sort`.
 *
 * Rather than using `fast-sort`'s method-chaining syntax, this function accepts
 * the sort direction (`"asc"` or `"desc"`) as a direct argument, resulting in a
 * cleaner and more declarative API for Agama components, where sorting is often
 * built dynamically.
 *
 * @example
 * ```ts
 * sortCollection(devices, 'asc', size');
 * sortCollection(devices, 'desc', d => d.sid + d.size);
 * sortCollection(devices, 'asc', [d => d.size, d => d.name]);
 * ```
 * @param collection - The array of items to be sorted.
 * @param direction - The direction of the sort. Use "asc" for ascending or
 *   "desc" for descending.
 * @param key - The key (as a string) to sort by, or a custom function
 *   compatible with `fast-sort`'s ISortBy.
 *
 * @returns A new array sorted based on the given key and direction.
 *
 */
const sortCollection = <T>(collection: T[], direction: "asc" | "desc", key: string | ISortBy<T>) =>
  sort(collection)[direction](key as ISortBy<T>);

export {
  compact,
  hex,
  locationReload,
  setLocationSearch,
  localConnection,
  timezoneTime,
  mask,
  generateEncodedPath,
  maskSecrets,
  sortCollection,
};
