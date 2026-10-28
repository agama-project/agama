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

import { formOptions } from "@tanstack/react-form";

/**
 * Field shapes shared by the storage forms (partition, logical volume, and
 * formattable device).
 *
 * Each storage form declares its own `defaultOptions` with the full set of
 * fields it needs. The shared presentation components in this directory are
 * bound (via `withForm`) to the minimal subset below so they can be reused
 * across every form whose values include these fields.
 *
 * Validation never lives here: it stays in each form's own `validations.ts`,
 * which can reuse the helpers in `shared/validation-helpers.ts`.
 */

/**
 * Constants and helpers
 */

/**
 * Sentinel value for the `filesystem` field meaning "let the installer choose
 * automatically". This is distinct from an empty string (no selection yet) and
 * is always valid regardless of mount point.
 */
export const FILESYSTEM_TYPE = {
  AUTO: "auto",
} as const;

/**
 * Sentinel values for the `filesystem` field that are not concrete filesystem
 * types: keep the existing filesystem (REUSE) or replace it (FORMAT).
 */
export const FILESYSTEM_ACTION = {
  REUSE: "reuse",
  FORMAT: "format",
} as const;

export const SIZE_MODE = {
  AUTO: "auto",
  FIXED: "fixed",
  RANGE: "range",
  EXPAND: "expand",
} as const;

export type SizeMode = (typeof SIZE_MODE)[keyof typeof SIZE_MODE];

/**
 * Form field types
 */

export type MountPointFields = {
  mountPoint: string;
  /**
   * Committed mount point value that updates on blur or suggestion selection,
   * but NOT on every keystroke while typing.
   *
   * ## Why this exists
   *
   * The live `mountPoint` value backs the text input and validation. We do not
   * want to react to incomplete values on every keystroke because:
   *
   * 1. **UX**: Showing filesystem hints for "/ho" before the user finishes
   *    typing "/home" would be confusing. Same for size information based on
   *    partial input.
   * 2. **Performance**: Avoids expensive recalculations (volume templates,
   *    filesystem options, size hints) on every keystroke.
   *
   * ## Update triggers
   *
   * 1. **onMount**: when the form loads (for editing existing devices)
   * 2. **onSelect**: when the user selects a suggestion (immediate)
   * 3. **onBlur**: when the user finishes typing a custom value (deferred)
   *
   * This is a control field, not part of the payload.
   */
  committedMountPoint: string;
};

export type FilesystemFields = {
  filesystem: string; // "auto" | "reuse" | concrete type like "xfs", "btrfs", "ext4"
  /**
   * The reuse-vs-format intent ("reuse" | "format") behind the filesystem
   * selection. Updated by the user's own selections only, so it survives the
   * automatic downgrade of "Current" to "Default" when a mount point change
   * makes the current filesystem incompatible, and allows restoring "Current"
   * when a later change makes it compatible again.
   *
   * This is a control field, not part of the payload.
   */
  filesystemAction: string;
  filesystemLabel: string;
  mkfsExtraArguments: string;
  mountOptions: string[];
  /**
   * Whether the optional filesystem settings (label, mkfs and mount options)
   * are revealed.
   *
   * This is a control field: it never appears in the payload, but
   * buildFilesystemConfig reads it to decide whether those settings are
   * included.
   */
  showMoreFilesystemSettings: boolean;
};

export type SizeFields = {
  /**
   * Which size strategy applies (automatic, fixed, range, expand).
   *
   * This is a control field: it never appears in the payload, but
   * buildSizeConfig reads it to decide which size fields produce the size
   * configuration.
   */
  sizeMode: SizeMode;
  // FIXED mode
  fixedSize: string;
  // RANGE mode
  rangeMinSize: string;
  rangeMaxSize: string;
  // EXPAND mode
  expandMinSize: string;
};

/**
 * Minimal default values used to bind the shared presentation components to a
 * form shape. Storage forms spread their own super-set of fields on top of
 * these in their `defaultValues`.
 */
export const sharedDefaultValues: MountPointFields & FilesystemFields & SizeFields = {
  mountPoint: "",
  committedMountPoint: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsExtraArguments: "",
  mountOptions: [],
  showMoreFilesystemSettings: false,
  sizeMode: SIZE_MODE.AUTO,
  fixedSize: "",
  rangeMinSize: "",
  rangeMaxSize: "",
  expandMinSize: "",
};

export const sharedDefaultOptions = formOptions({ defaultValues: sharedDefaultValues });
