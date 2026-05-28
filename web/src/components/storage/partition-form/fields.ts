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

/** Form field types */

type MountPointFields = {
  mountPoint: string;
};

type PartitionSourceFields = {
  // Note: Normally "new" | "reuse", but when no partitions are available
  // to reuse, this field contains a display string for ReadOnlyField.
  partitionSource: string;
  selectedPartitionId: string;
};

type FilesystemFields = {
  filesystem: string; // "auto" | concrete type like "xfs", "btrfs", "ext4"
  // Note: Normally "reuse" | "format", but when partition has no filesystem,
  // this field contains a display string for ReadOnlyField.
  filesystemAction: string;
  filesystemLabel: string;
};

type SizeFields = {
  sizeMode: "auto" | "fixed" | "range" | "expand";
  minSize: string;
  maxSize: string;
  fixedSize: string;
};

type FormFields = MountPointFields & PartitionSourceFields & FilesystemFields & SizeFields;

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

function validatePartitionSource(
  fields: FormFields,
): FieldsValidationResult<PartitionSourceFields> {
  if (fields.partitionSource !== PARTITION_SOURCE.REUSE) return {};
  return {
    selectedPartitionId: requiredString(fields.selectedPartitionId, _("Select a partition")),
  };
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

  // Reusing the existing filesystem requires no explicit type selection.
  if (
    fields.partitionSource === PARTITION_SOURCE.REUSE &&
    fields.filesystemAction === FILESYSTEM_ACTION.REUSE
  ) {
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
      fields.minSize,
      _("Minimum size is required"),
      _("Invalid size format (e.g., 20 GiB, 100 MB)"),
    );

    const maxError = requiredSize(
      fields.maxSize,
      _("Maximum size is required"),
      _("Invalid size format (e.g., 20 GiB, 100 MB)"),
    );

    if (minError || maxError) {
      return { minSize: minError, maxSize: maxError };
    }

    const rangeError = sizeRange(
      fields.minSize,
      fields.maxSize,
      _("Minimum size cannot be greater than maximum size"),
    );

    return { maxSize: rangeError };
  }

  if (fields.sizeMode === SIZE_MODE.EXPAND) {
    return {
      minSize: requiredSize(
        fields.minSize,
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
    ...validatePartitionSource(fields),
    ...validateFilesystemFields(fields),
    ...validateSizeFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
