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
import type { ValidationResult } from "~/components/form/validation-helpers";
import { requiredString, optionalValidString } from "~/components/form/validation-helpers";
import { requiredSize, sizeRange } from "~/components/storage/validation-helpers";
import { _ } from "~/i18n";

/** Form field types */

type FormFields = {
  mountPoint: string;

  // Partition source
  // Note: Normally "new" | "reuse", but when no partitions are available
  // to reuse, this field contains a display string for ReadOnlyField.
  partitionSource: string;
  selectedPartitionId: string;

  // Filesystem
  filesystem: string; // "auto" | concrete type like "xfs", "btrfs", "ext4"
  filesystemAction: "reuse" | "format";
  filesystemLabel: string;

  // Size
  sizeMode: "auto" | "fixed" | "range" | "expand";
  minSize: string;
  maxSize: string;
  fixedSize: string;
};

/** Constants */

export const PARTITION_SOURCE = {
  NEW: "new",
  REUSE: "reuse",
} as const;

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

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  partitionSource: PARTITION_SOURCE.NEW,
  selectedPartitionId: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  sizeMode: SIZE_MODE.AUTO,
  minSize: "",
  maxSize: "",
  fixedSize: "",
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

function validateMountPoint(fields: FormFields, usedMountPoints: string[]): string | undefined {
  const value = fields.mountPoint;

  if (value === "") {
    return _("Mount point is required");
  }

  if (!MOUNT_POINT_REGEXP.test(value)) {
    return _("Select or enter a valid mount point");
  }

  // Check if mount point is already used (not validated here, must be passed from form)
  if (usedMountPoints.includes(value)) {
    return _("Select or enter a mount point that is not already assigned to another device");
  }

  return undefined;
}

function validateSelectedPartition(fields: FormFields): string | undefined {
  if (fields.partitionSource !== PARTITION_SOURCE.REUSE) return undefined;
  return requiredString(fields.selectedPartitionId, _("Select a partition"));
}

function validateFilesystem(fields: FormFields): string | undefined {
  // AUTO is always valid — the installer will pick an appropriate type.
  if (fields.filesystem === FILESYSTEM_TYPE.AUTO) return undefined;

  // Reusing the existing filesystem requires no explicit type selection.
  if (
    fields.partitionSource === PARTITION_SOURCE.REUSE &&
    fields.filesystemAction === FILESYSTEM_ACTION.REUSE
  ) {
    return undefined;
  }

  return requiredString(fields.filesystem, _("Select a filesystem type"));
}

function validateFilesystemLabel(fields: FormFields): string | undefined {
  return optionalValidString(
    fields.filesystemLabel,
    (v) => FILESYSTEM_LABEL_REGEXP.test(v),
    _("Invalid label format"),
  );
}

function validateMinSize(fields: FormFields): string | undefined {
  if (fields.sizeMode !== SIZE_MODE.RANGE && fields.sizeMode !== SIZE_MODE.EXPAND) {
    return undefined;
  }
  return requiredSize(
    fields.minSize,
    _("Minimum size is required"),
    _("Invalid size format (e.g., 20 GiB, 100 MB)"),
  );
}

function validateMaxSize(fields: FormFields): string | undefined {
  if (fields.sizeMode !== SIZE_MODE.RANGE) return undefined;
  return requiredSize(
    fields.maxSize,
    _("Maximum size is required"),
    _("Invalid size format (e.g., 20 GiB, 100 MB)"),
  );
}

function validateFixedSize(fields: FormFields): string | undefined {
  if (fields.sizeMode !== SIZE_MODE.FIXED) return undefined;
  return requiredSize(
    fields.fixedSize,
    _("Size is required"),
    _("Invalid size format (e.g., 20 GiB, 100 MB)"),
  );
}

function validateSizeRange(fields: FormFields): string | undefined {
  if (fields.sizeMode !== SIZE_MODE.RANGE) return undefined;
  return sizeRange(
    fields.minSize,
    fields.maxSize,
    _("Minimum size cannot be greater than maximum size"),
  );
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
    mountPoint: validateMountPoint(fields, usedMountPoints),
    selectedPartitionId: validateSelectedPartition(fields),
    filesystem: validateFilesystem(fields),
    filesystemLabel: validateFilesystemLabel(fields),
    minSize: validateMinSize(fields),
    maxSize: validateMaxSize(fields),
    fixedSize: validateFixedSize(fields),
    // Cross-field validation
    sizeRange: validateSizeRange(fields),
  });

  if (Object.keys(fieldErrors).length > 0) return { fields: fieldErrors };
}
