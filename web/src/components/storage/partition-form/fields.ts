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
import { shake } from "radashi";
import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";
import { requiredString, optionalValidString } from "~/components/form/validation-helpers";
import { requiredSize, sizeRange } from "~/components/storage/validation-helpers";
import { _ } from "~/i18n";

/** Constants and helpers */

export const FILESYSTEM_ACTION = {
  REUSE: "reuse",
  FORMAT: "format",
} as const;

/**
 * Sentinel value for the `filesystem` field meaning "let the installer choose
 * automatically". This is distinct from an empty string (no selection yet) and
 * is always valid regardless of mount point.
 *
 * Used as:
 *  - The default value when no filesystem has been explicitly chosen.
 *  - The reset target when the user changes the mount point to one that no
 *    longer supports the previously selected filesystem type (see
 *    FilesystemFields.tsx for the auto-reset behavior).
 */
export const FILESYSTEM_TYPE = {
  AUTO: "auto",
} as const;

export const SIZE_MODE = {
  AUTO: "auto",
  FIXED: "fixed",
  RANGE: "range",
  EXPAND: "expand",
} as const;

/**
 * Determines if the form is configured to reuse an existing partition.
 *
 * Returns `true` when the name field contains a partition name (e.g., "vdd2"),
 * `false` when creating a new partition (empty string).
 *
 * @param name - The partition name field value
 * @returns true if reusing an existing partition, false if creating new
 */
export function isReusingPartition(name: string): boolean {
  return name !== "";
}

/**
 * Checks if a filesystem value supports additional configuration.
 *
 * Returns false for "auto" and "reuse", true for all concrete filesystem types.
 */
export const supportsAdditionalConfig = (filesystem: string): boolean => {
  return filesystem !== FILESYSTEM_TYPE.AUTO && filesystem !== FILESYSTEM_ACTION.REUSE;
};

/** Form field types */

export type SizeMode = (typeof SIZE_MODE)[keyof typeof SIZE_MODE];

type MountPointFields = {
  mountPoint: string;
  /**
   * Committed mount point value that updates on blur or suggestion selection,
   * but NOT on every keystroke while typing.
   *
   * ## Why this exists
   *
   * The live `mountPoint` value is used for the text input field and validation.
   * However, we don't want to react to incomplete values on every keystroke because:
   *
   * 1. **UX**: Showing filesystem hints for "/ho" before user finishes typing "/home"
   *    would be confusing and disruptive. Same for size information based on partial input.
   * 2. **Performance**: Avoids expensive recalculations (useVolumeTemplate, filesystem
   *    options, size hints) on every keystroke.
   *
   * ## Update triggers
   *
   * This field updates in three scenarios:
   * 1. **onMount**: When the form loads (for editing existing partitions)
   * 2. **onSelect**: When user selects a suggestion from the dropdown (immediate)
   * 3. **onBlur**: When user finishes typing a custom value (deferred)
   *
   * ## Usage
   *
   * - FilesystemFields and SizeFields use `committedMountPoint` for `useVolumeTemplate()`
   * - This avoids showing misleading hints while typing "/ho..."
   * - Once the user completes typing or selects "/home", information updates
   *
   * @see Form.tsx mountPoint field listeners for sync logic
   */
  committedMountPoint: string;
};

type PartitionFields = {
  /**
   * Partition name for reusing an existing partition, or empty string for
   * creating a new partition.
   *
   * When empty: a new partition will be created.
   * When partition name (e.g., "vdd2"): the named partition will be reused.
   */
  name: string;
};

type FilesystemFields = {
  filesystem: string; // "auto" | concrete type like "xfs", "btrfs", "ext4"
  filesystemAction: string; // "reuse" | "format"
  filesystemLabel: string;
  showMoreFilesystemSettings: boolean;
};

type SizeFields = {
  sizeMode: SizeMode;
  // FIXED mode
  fixedSize: string;
  // RANGE mode
  rangeMinSize: string;
  rangeMaxSize: string;
  // EXPAND mode
  expandMinSize: string;
};

type FormFields = MountPointFields & PartitionFields & FilesystemFields & SizeFields;

export type PartitionFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  name: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  showMoreFilesystemSettings: false,
  sizeMode: SIZE_MODE.AUTO,
  fixedSize: "",
  rangeMinSize: "",
  rangeMaxSize: "",
  expandMinSize: "",
};

export const defaultOptions = formOptions({ defaultValues });

/** Validation functions */

/**
 * Mount point validation regex.
 *
 * Matches:
 * - "swap" (special case)
 * - "/" (root)
 * - Valid absolute paths like "/home", "/var/lib", etc.
 *
 * Does not match:
 * - Empty strings
 * - Relative paths
 * - Paths with spaces or invalid characters
 */
const MOUNT_POINT_REGEXP = /^swap$|^\/$|^(\/[^/\s]+)+$/;

/**
 * Filesystem label validation regex.
 *
 * Allows:
 * - Word characters (letters, digits, underscores)
 * - Hyphens, dots
 * - Empty string (label is optional)
 */
const FILESYSTEM_LABEL_REGEXP = /^[\w-_.]*$/;

function validateMountPoint(
  fields: FormFields,
  usedMountPoints: string[],
): FieldsValidationResult<MountPointFields> {
  const value = fields.mountPoint;

  if (value === "") {
    return { mountPoint: _("Mount point is required") };
  }

  if (!MOUNT_POINT_REGEXP.test(value)) {
    return { mountPoint: _("Select or enter a valid mount point") };
  }

  // Check if mount point is already used (not validated here, must be passed from form)
  if (usedMountPoints.includes(value)) {
    return {
      mountPoint: _("Select or enter a mount point that is not already assigned to another device"),
    };
  }

  return {};
}

function validateFilesystemFields(fields: FormFields): FieldsValidationResult<FilesystemFields> {
  // AUTO is always valid — the installer will pick an appropriate type.
  if (fields.filesystem === FILESYSTEM_TYPE.AUTO) {
    return {
      filesystemLabel: optionalValidString(
        fields.filesystemLabel,
        (v) => FILESYSTEM_LABEL_REGEXP.test(v),
        _("Invalid label format"),
      ),
    };
  }

  // Reusing the existing filesystem (filesystem field holds REUSE sentinel).
  if (fields.filesystem === FILESYSTEM_ACTION.REUSE) {
    return {
      filesystemLabel: optionalValidString(
        fields.filesystemLabel,
        (v) => FILESYSTEM_LABEL_REGEXP.test(v),
        _("Invalid label format"),
      ),
    };
  }

  return {
    filesystem: requiredString(fields.filesystem, _("Select a filesystem type")),
    filesystemLabel: optionalValidString(
      fields.filesystemLabel,
      (v) => FILESYSTEM_LABEL_REGEXP.test(v),
      _("Invalid label format"),
    ),
  };
}

function validateSizeFields(fields: FormFields): FieldsValidationResult<SizeFields> {
  if (fields.sizeMode === SIZE_MODE.FIXED) {
    return {
      fixedSize: requiredSize(
        fields.fixedSize,
        _("Size is required"),
        _("Invalid size format (e.g., 20 GiB, 100 MB)"),
      ),
    };
  }

  if (fields.sizeMode === SIZE_MODE.RANGE) {
    const minError = requiredSize(
      fields.rangeMinSize,
      _("Minimum size is required"),
      _("Invalid size format (e.g., 20 GiB, 100 MB)"),
    );

    const maxError = requiredSize(
      fields.rangeMaxSize,
      _("Maximum size is required"),
      _("Invalid size format (e.g., 20 GiB, 100 MB)"),
    );

    if (minError || maxError) {
      return { rangeMinSize: minError, rangeMaxSize: maxError };
    }

    const rangeError = sizeRange(
      fields.rangeMinSize,
      fields.rangeMaxSize,
      _("Minimum size cannot be greater than maximum size"),
    );

    return { rangeMaxSize: rangeError };
  }

  if (fields.sizeMode === SIZE_MODE.EXPAND) {
    return {
      expandMinSize: requiredSize(
        fields.expandMinSize,
        _("Minimum size is required"),
        _("Invalid size format (e.g., 20 GiB, 100 MB)"),
      ),
    };
  }

  return {};
}

/**
 * Top-level validation function.
 *
 * Validates all fields and returns field errors if any are found.
 *
 * @param fields - The form field values
 * @param usedMountPoints - Mount points already in use (excluding the current one when editing)
 * @returns Validation result with field errors, or undefined if valid
 */
export function validate(
  fields: FormFields,
  usedMountPoints: string[] = [],
): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateMountPoint(fields, usedMountPoints),
    ...validateFilesystemFields(fields),
    ...validateSizeFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
