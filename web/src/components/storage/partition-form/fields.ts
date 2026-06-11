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
import { requiredString } from "~/components/form/validation-helpers";
import {
  requiredSize,
  sizeRange,
  validateMountPoint as validateMountPointValue,
  optionalFilesystemLabel,
} from "~/components/storage/shared/validation-helpers";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE } from "~/components/storage/shared/fields";
import { _ } from "~/i18n";
import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";
import type {
  SizeMode,
  MountPointFields,
  FilesystemFields,
  SizeFields,
} from "~/components/storage/shared/fields";

/**
 * Re-exported so form-local code (components, transformations, tests) can get
 * everything describing the form fields from this module, without needing to
 * know which parts happen to be shared across storage forms.
 *
 * This also leaves room for divergence: if this form ever needs different
 * values, this module can stop re-exporting and define its own version
 * (possibly derived from the shared one) without touching any consumer.
 */
export { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE };
export type { SizeMode };

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

/** Form field types */

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

export type FormFields = MountPointFields & PartitionFields & FilesystemFields & SizeFields;

export type PartitionFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  name: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsOptions: [],
  mountOptions: [],
  showMoreFilesystemSettings: false,
  sizeMode: SIZE_MODE.AUTO,
  fixedSize: "",
  rangeMinSize: "",
  rangeMaxSize: "",
  expandMinSize: "",
};

export const defaultOptions = formOptions({ defaultValues });

/** Validation functions */

function validateMountPoint(
  fields: FormFields,
  usedMountPoints: string[],
): FieldsValidationResult<MountPointFields> {
  return { mountPoint: validateMountPointValue(fields.mountPoint, usedMountPoints) };
}

function validateFilesystemFields(fields: FormFields): FieldsValidationResult<FilesystemFields> {
  // AUTO and REUSE are always valid filesystem selections; only the optional
  // label needs checking. A concrete type additionally requires a selection.
  if (fields.filesystem === FILESYSTEM_TYPE.AUTO || fields.filesystem === FILESYSTEM_ACTION.REUSE) {
    return { filesystemLabel: optionalFilesystemLabel(fields.filesystemLabel) };
  }

  return {
    filesystem: requiredString(fields.filesystem, _("Select a filesystem type")),
    filesystemLabel: optionalFilesystemLabel(fields.filesystemLabel),
  };
}

function validateSizeFields(fields: FormFields): FieldsValidationResult<SizeFields> {
  if (fields.sizeMode === SIZE_MODE.FIXED) {
    return {
      fixedSize: requiredSize(
        fields.fixedSize,
        _("Value is required"),
        _("Invalid format (e.g. 20 GiB)"),
      ),
    };
  }

  if (fields.sizeMode === SIZE_MODE.RANGE) {
    const minError = requiredSize(
      fields.rangeMinSize,
      _("Minimum is required"),
      _("Invalid format (e.g. 20 GiB)"),
    );

    const maxError = requiredSize(
      fields.rangeMaxSize,
      _("Maximum is required"),
      _("Invalid format (e.g. 20 GiB)"),
    );

    if (minError || maxError) {
      return { rangeMinSize: minError, rangeMaxSize: maxError };
    }

    const hasRangeError = sizeRange(fields.rangeMinSize, fields.rangeMaxSize, "error");

    if (hasRangeError) {
      return {
        rangeMinSize: _("Must be smaller than maximum size"),
        rangeMaxSize: _("Must be larger than minimum size"),
      };
    }

    return {};
  }

  if (fields.sizeMode === SIZE_MODE.EXPAND) {
    return {
      expandMinSize: requiredSize(
        fields.expandMinSize,
        _("Minimum is required"),
        _("Invalid format (e.g. 20 GiB)"),
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
