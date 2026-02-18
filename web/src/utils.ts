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

import { mapEntries } from "radashi";
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

/** Options for mergeSources */
export type MergeSourcesOptions<T, K extends keyof T> = {
  /** Object mapping source names to their arrays */
  collections: Record<string, T[]>;
  /** Order of precedence of where to take the object from if it is in more than
   * one collection */
  precedence: string[];
  /** The property name(s) to use as the unique identifier */
  primaryKey?: K | K[];
};

/** Item augmented with sources array */
type ItemWithSources<T> = Omit<T, "sources"> & {
  /** Array of source names where this item was found */
  sources: string[];
};

/**
 * Merges multiple collections of objects, tracking which sources each item
 * appears in.
 *
 * When the same item (identified by the specified primaryKey(s)) appears in multiple
 * collections, it will appear only once in the output with a `sources` array
 * listing all collections where it was found. The object data is taken from
 * the first source in the precedence order where it appears.
 *
 * @template T - The type of objects in the collections
 * @template K - The key type used for identifying unique items
 *
 * @param options - Configuration object
 * @param options.collections - Object mapping source names to arrays of items
 * @param options.precedence - Array of source names in priority order (first = highest)
 * @param options.primaryKey - Property name(s) to use as unique identifier (default: "id").
 *                              Can be a single key or array of keys for composite primary keys.
 *
 * @returns Array of merged items, each with a `sources` property
 *
 * @example
 * ```typescript
 * // Single primary key example - iSCSI targets identified by name only
 * const result = mergeSources({
 *   collections: {
 *     system: [
 *       {
 *         name: "iqn.2023-01.com.example:12ac588",
 *         address: "192.168.100.102",
 *         port: 3262,
 *         interface: "default",
 *         ibtf: false,
 *         startup: "onboot",
 *         connected: true,
 *         locked: false
 *       }
 *     ],
 *     config: [
 *       {
 *         name: "iqn.2023-01.com.example:12ac588",
 *         address: "192.168.100.102",
 *         port: 3262,
 *         interface: "default",
 *         startup: "onboot"
 *       },
 *       {
 *         name: "iqn.2023-01.com.example:12ac788",
 *         address: "192.168.100.106",
 *         port: 3264,
 *         interface: "default",
 *         startup: "onboot"
 *       }
 *     ]
 *   },
 *   precedence: ['system', 'config'],
 *   primaryKey: 'name'
 * });
 * // Returns:
 * // [
 * //   {
 * //     name: "iqn.2023-01.com.example:12ac588",
 * //     address: "192.168.100.102",
 * //     port: 3262,
 * //     interface: "default",
 * //     ibtf: false,
 * //     startup: "onboot",
 * //     connected: true,
 * //     locked: false,
 * //     sources: ['system', 'config']
 * //   },
 * //   {
 * //     name: "iqn.2023-01.com.example:12ac788",
 * //     address: "192.168.100.106",
 * //     port: 3264,
 * //     interface: "default",
 * //     startup: "onboot",
 * //     sources: ['config']
 * //   }
 * // ]
 *
 * // Multiple primary key example - iSCSI targets identified by name + address + port
 * // This is necessary because the same target name can have multiple portals
 * const result2 = mergeSources({
 *   collections: {
 *     system: [
 *       {
 *         name: "iqn.2023-01.com.example:storage",
 *         address: "192.168.100.102",
 *         port: 3260,
 *         interface: "default",
 *         ibtf: false,
 *         startup: "onboot",
 *         connected: true,
 *         locked: false
 *       },
 *       {
 *         name: "iqn.2023-01.com.example:storage",
 *         address: "192.168.100.102",
 *         port: 3261,
 *         interface: "default",
 *         ibtf: false,
 *         startup: "manual",
 *         connected: false,
 *         locked: false
 *       }
 *     ],
 *     config: [
 *       {
 *         name: "iqn.2023-01.com.example:storage",
 *         address: "192.168.100.102",
 *         port: 3260,
 *         interface: "default",
 *         startup: "onboot"
 *       },
 *       {
 *         name: "iqn.2023-01.com.example:storage",
 *         address: "192.168.100.102",
 *         port: 3261,
 *         interface: "default",
 *         startup: "manual"
 *       },
 *       {
 *         name: "iqn.2023-01.com.example:storage",
 *         address: "192.168.100.103",
 *         port: 3260,
 *         interface: "default",
 *         startup: "onboot"
 *       }
 *     ]
 *   },
 *   precedence: ['system', 'config'],
 *   primaryKey: ['name', 'address', 'port']
 * });
 * // Returns:
 * // [
 * //   {
 * //     name: "iqn.2023-01.com.example:storage",
 * //     address: "192.168.100.102",
 * //     port: 3260,
 * //     interface: "default",
 * //     ibtf: false,
 * //     startup: "onboot",
 * //     connected: true,
 * //     locked: false,
 * //     sources: ['system', 'config']
 * //   },
 * //   {
 * //     name: "iqn.2023-01.com.example:storage",
 * //     address: "192.168.100.102",
 * //     port: 3261,
 * //     interface: "default",
 * //     ibtf: false,
 * //     startup: "manual",
 * //     connected: false,
 * //     locked: false,
 * //     sources: ['system', 'config']
 * //   },
 * //   {
 * //     name: "iqn.2023-01.com.example:storage",
 * //     address: "192.168.100.103",
 * //     port: 3260,
 * //     interface: "default",
 * //     startup: "onboot",
 * //     sources: ['config']
 * //   }
 * // ]
 * ```
 */
function mergeSources<T, K extends keyof T>({
  collections,
  precedence,
  primaryKey = "id" as K,
}: MergeSourcesOptions<T, K>): ItemWithSources<T>[] {
  const map = new Map<string, ItemWithSources<T>>();

  for (const name of precedence) {
    const items = collections[name];
    for (const obj of items) {
      const key = Array.isArray(primaryKey)
        ? primaryKey.map((k) => String(obj[k])).join("|")
        : String(obj[primaryKey]);

      if (map.has(key)) {
        map.get(key)!.sources.push(name);
      } else {
        map.set(key, { ...obj, sources: [name] });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Options for extending a base collection with matching merge items.
 */
interface ExtendCollectionOptions<T, U> {
  /**
   * Collection providing merge data to enrich base items.
   *
   * Items in this collection will be matched against the base collection
   * according to the `matching` fields.
   */
  with: U[];

  /**
   * Field name or array of field names used to match items between the base
   * collection and the merge collection.
   *  - Single field: matches on that field.
   *  - Multiple fields: all fields are combined to determine a match.
   */
  matching: keyof T | (keyof T)[];

  /**
   * Determines which collection's properties take priority when merging:
   *  - `"baseWins"`: base item properties overwrite merge properties.
   *  - `"extensionWins"`: merge properties overwrite base item properties.
   * @default "baseWins"
   */
  precedence?: "baseWins" | "extensionWins";
}

/**
 * Extends a base collection of items by merging in matching items from a
 * secondary collection.
 *
 * For each item in the base collection:
 *   1. Find a matching item in the merge collection based on the specified
 *      fields.
 *   2. Merge the matched item's properties into the base item according to
 *      `precedence`.
 *
 * @returns A new array of items where each base item has been extended with
 * matching merge item properties.
 *
 * @example
 * // Single field matching with default precedence (initial wins)
 * const configDevices = [
 *   { channel: "0.0.0160", diag: false, format: true }
 * ];
 * const systemDevices = [
 *   { channel: "0.0.0160", deviceName: "dasda", type: "eckd", diag: true }
 * ];
 * const extendedConfigDevices = extendCollection(configDevices, {
 *   with: systemDevices,
 *   matching: 'channel'
 * });
 * // Result: [
 *     { channel: "0.0.0160", deviceName: "dasda", type: "eckd", diag: false, format: true }
 *   ]
 *
 * @example
 * // Multiple field matching with extensionWins precedence
 * const configDevices = [
 *   { channel: "0.0.0160", state: "offline", diag: false }
 * ];
 * const systemDevices = [
 *   { channel: "0.0.0160", state: "offline", deviceName: "dasda", type: "eckd", diag: true },
 *   { channel: "0.0.0160", state: "active", deviceName: "dasdb", type: "fba" }
 * ];
 * const extendedConfigDevices = extendCollection(configDevices, {
 *   with: systemDevices,
 *   matching: ['channel', 'state']
 *   precedence: "extensionWins"
 * });
 * // Result: [
 *    { channel: "0.0.0160", state: "offline", deviceName: "dasda", type: "eckd", diag: true,  }
 *   ]
 */
function extendCollection<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  collection: T[],
  options: ExtendCollectionOptions<T, U>,
): (T & U)[] {
  const { with: extension, matching, precedence = "baseWins" } = options;

  // Normalize matching field(s)
  const keys = Array.isArray(matching) ? matching : [matching];

  // Create a string key for each item for lookup
  const getKey = (item: T | U): string =>
    keys.map((k) => String((item as Record<string, unknown>)[k as string])).join("|");

  // Build a lookup map from merge items keyed by their matching fields
  const extensionLookup = new Map(extension.map((item) => [getKey(item), item]));

  // Extend each item in the base collection
  return collection.map((item) => {
    const match = extensionLookup.get(getKey(item));

    // No match found - return item unchanged
    if (!match) return item as T & U;

    // Merge matched items based on precedence
    return precedence === "baseWins"
      ? { ...match, ...item } // Base item properties take priority
      : { ...item, ...match }; // Merge item properties take priority
  });
}

export {
  compact,
  hex,
  locationReload,
  setLocationSearch,
  localConnection,
  timezoneTime,
  mask,
  generateEncodedPath,
  sortCollection,
  mergeSources,
  extendCollection,
};
