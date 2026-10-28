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
 * Validation helpers for storage forms.
 *
 * These helpers encapsulate storage-specific validation logic: size values
 * (e.g., "20 GiB", "100 MB"), mount points, and filesystem labels. They follow
 * the same pattern as the general form validation helpers (return an error
 * message string, or `undefined` when valid) but are specialized for the
 * storage domain and shared across the partition, logical volume, and
 * formattable device forms.
 *
 * All size comparisons use {@link parseToBytes} from storage utils to handle
 * unit conversion.
 */

import { parseToBytes } from "~/components/storage/utils";
import { _ } from "~/i18n";

/**
 * Mount point validation regex.
 *
 * Matches:
 * - "swap" (special case)
 * - "/" (root)
 * - Valid absolute paths like "/home", "/var/lib", etc.
 *
 * Does not match empty strings, relative paths, or paths with spaces or invalid
 * characters.
 */
export const MOUNT_POINT_REGEXP = /^swap$|^\/$|^(\/[^/\s]+)+$/;

/**
 * Filesystem label validation regex.
 *
 * Allows word characters (letters, digits, underscores), hyphens, and dots.
 * The empty string is allowed because the label is optional.
 */
export const FILESYSTEM_LABEL_REGEXP = /^[\w-_.]*$/;

/**
 * Mount point field validation.
 *
 * The value must be non-empty, match the mount point format, and not collide
 * with a mount point already assigned to another device.
 *
 * @example
 * validateMountPoint("", []) // "Mount point is required"
 * validateMountPoint("relative", []) // "Select or enter a valid mount point"
 * validateMountPoint("/home", ["/home"]) // already-assigned message
 * validateMountPoint("/home", []) // undefined
 */
export function validateMountPoint(value: string, usedMountPoints: string[]): string | undefined {
  if (value === "") return _("Mount point is required");
  if (!MOUNT_POINT_REGEXP.test(value)) return _("Select or enter a valid mount point");
  if (usedMountPoints.includes(value)) {
    return _("Select or enter a mount point that is not already assigned to another device");
  }
  return undefined;
}

/**
 * Optional filesystem label validation.
 *
 * The empty string passes (the label is optional). Any non-empty value must
 * match {@link FILESYSTEM_LABEL_REGEXP}.
 *
 * @example
 * optionalFilesystemLabel("") // undefined
 * optionalFilesystemLabel("data") // undefined
 * optionalFilesystemLabel("bad label") // "Invalid label format"
 */
export function optionalFilesystemLabel(value: string): string | undefined {
  if (value === "") return undefined;
  return FILESYSTEM_LABEL_REGEXP.test(value) ? undefined : _("Invalid label format");
}

/**
 * Size format regex.
 *
 * Matches size strings like:
 * - "20 GiB"
 * - "100 MB"
 * - "1.5 TB"
 *
 * Supports decimal values and both binary (KiB, MiB, GiB) and decimal (KB, MB, GB) units.
 */
export const SIZE_FORMAT_REGEXP = /^[0-9]+(\.[0-9]+)?(\s*([KkMmGgTtPpEeZzYy][iI]?)?[Bb])$/;

/**
 * Validates size string format.
 *
 * @example
 * isValidSize("20 GiB") // true
 * isValidSize("100 MB") // true
 * isValidSize("invalid") // false
 * isValidSize("") // false
 */
export function isValidSize(value: string): boolean {
  return SIZE_FORMAT_REGEXP.test(value);
}

/**
 * Required size field validation.
 *
 * The field must be non-empty and match the size format.
 *
 * @example
 * requiredSize("", "Required", "Invalid") // "Required"
 * requiredSize("invalid", "Required", "Invalid") // "Invalid"
 * requiredSize("20 GiB", "Required", "Invalid") // undefined
 */
export function requiredSize(
  value: string,
  emptyMessage: string,
  invalidMessage: string,
): string | undefined {
  if (value === "") return emptyMessage;
  return isValidSize(value) ? undefined : invalidMessage;
}

/**
 * Optional size field validation.
 *
 * Empty string passes. Non-empty must match the size format.
 *
 * @example
 * optionalSize("", "Invalid") // undefined
 * optionalSize("20 GiB", "Invalid") // undefined
 * optionalSize("invalid", "Invalid") // "Invalid"
 */
export function optionalSize(value: string, invalidMessage: string): string | undefined {
  if (value === "") return undefined;
  return isValidSize(value) ? undefined : invalidMessage;
}

/**
 * Size range validation.
 *
 * Validates that minValue <= maxValue when both are present and valid.
 * If either value is empty or invalid, returns undefined (those should be
 * caught by field-level validation).
 *
 * @example
 * sizeRange("10 GiB", "20 GiB", "Min > Max") // undefined
 * sizeRange("20 GiB", "10 GiB", "Min > Max") // "Min > Max"
 * sizeRange("10 GiB", "", "Min > Max") // undefined (max is optional)
 * sizeRange("invalid", "20 GiB", "Min > Max") // undefined (invalid caught elsewhere)
 */
export function sizeRange(minValue: string, maxValue: string, message: string): string | undefined {
  // Skip if either is missing or invalid (caught by field validators)
  if (!minValue || !maxValue) return undefined;
  if (!isValidSize(minValue) || !isValidSize(maxValue)) return undefined;

  const minBytes = parseToBytes(minValue);
  const maxBytes = parseToBytes(maxValue);

  return minBytes <= maxBytes ? undefined : message;
}

/**
 * Minimum size threshold validation.
 *
 * Validates that the size meets a minimum threshold in bytes.
 * Returns undefined if value is empty or invalid (caught by field validators).
 *
 * @example
 * sizeAtLeast("20 GiB", parseToBytes("10 GiB"), "Too small") // undefined
 * sizeAtLeast("5 GiB", parseToBytes("10 GiB"), "Too small") // "Too small"
 * sizeAtLeast("", parseToBytes("10 GiB"), "Too small") // undefined
 */
export function sizeAtLeast(value: string, minBytes: number, message: string): string | undefined {
  if (!value || !isValidSize(value)) return undefined;

  const bytes = parseToBytes(value);
  return bytes >= minBytes ? undefined : message;
}

/**
 * Maximum size threshold validation.
 *
 * Validates that the size does not exceed a maximum threshold in bytes.
 * Returns undefined if value is empty or invalid (caught by field validators).
 *
 * @example
 * sizeAtMost("10 GiB", parseToBytes("20 GiB"), "Too large") // undefined
 * sizeAtMost("30 GiB", parseToBytes("20 GiB"), "Too large") // "Too large"
 * sizeAtMost("", parseToBytes("20 GiB"), "Too large") // undefined
 */
export function sizeAtMost(value: string, maxBytes: number, message: string): string | undefined {
  if (!value || !isValidSize(value)) return undefined;

  const bytes = parseToBytes(value);
  return bytes <= maxBytes ? undefined : message;
}
