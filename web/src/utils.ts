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

import { useEffect, useRef } from "react";

/**
 * Generates a new array without null and undefined values.
 */
const compact = <T>(collection: Array<T>) => {
  return collection.filter((e) => e !== null && e !== undefined);
};

/**
 * Debounce hook.
 *
 * Source {@link https://designtechworld.medium.com/create-a-custom-debounce-hook-in-react-114f3f245260}
 *
 * @param callback - Function to be called after some delay.
 * @param delay - Delay in milliseconds.
 *
 * @example
 *
 * const log = useDebounce(console.log, 1000);
 * log("test ", 1) // The message will be logged after at least 1 second.
 * log("test ", 2) // Subsequent calls cancels pending calls.
 */
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Cleanup the previous timeout on re-render
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = (...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };

  return debouncedCallback;
};

/**
 * Parses a "numeric dot string" as a hexadecimal number.
 *
 * Accepts only strings containing digits (`0–9`) and dots (`.`),
 * for example: `"0.0.0160"` or `"123"`. Dots are removed before parsing.
 *
 * If the cleaned string contains any non-digit characters (such as letters),
 * or is not a valid integer string, the function returns `0`.
 *
 * @example
 *
 * ```ts
 * hex("0.0.0.160"); // Returns 352
 * hex("1.2.3");     // Returns 291
 * hex("1.A.3");     // Returns 0 (letters are not allowed)
 * hex("..");        // Returns 0 (empty string before removing dots)
 * ```
 *
 * @param value - A string representing a dot-separated numeric value
 * @returns The number parsed as hexadecimal (base-16) integer, or `0` if invalid
 */
const hex = (value: string): number => {
  const sanitizedValued = value.replaceAll(".", "");
  return /^[0-9]+$/.test(sanitizedValued) ? parseInt(sanitizedValued, 16) : 0;
};

/**
 * Converts an issue to a validation error
 *
 * @todo This conversion will not be needed after adapting Section to directly work with issues.
 *
 * @param {import("~/types/issues").Issue} issue
 * @returns {import("~/types/issues").ValidationError}
 */
const toValidationError = (issue) => ({ message: issue.description });

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
 * WetherAgama server is running locally or not.
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

const agamaWidthBreakpoints = {
  sm: parseInt("36rem") * 16,
  md: parseInt("48rem") * 16,
  lg: parseInt("64rem") * 16,
  xl: parseInt("75rem") * 16,
  "2xl": parseInt("90rem") * 16,
};

const getBreakpoint = (width: number): "default" | "sm" | "md" | "lg" | "xl" | "2xl" => {
  if (width === null) {
    return null;
  }
  if (width >= agamaWidthBreakpoints["2xl"]) {
    return "2xl";
  }
  if (width >= agamaWidthBreakpoints.xl) {
    return "xl";
  }
  if (width >= agamaWidthBreakpoints.lg) {
    return "lg";
  }
  if (width >= agamaWidthBreakpoints.md) {
    return "md";
  }
  if (width >= agamaWidthBreakpoints.sm) {
    return "sm";
  }
  return "default";
};

export {
  compact,
  useDebounce,
  hex,
  toValidationError,
  locationReload,
  setLocationSearch,
  localConnection,
  timezoneTime,
  mask,
  getBreakpoint,
  agamaWidthBreakpoints,
};
