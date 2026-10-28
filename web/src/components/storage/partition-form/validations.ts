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
 * Validation for the partition form.
 *
 * Builds on the field definitions from fields.ts and the reusable rules from
 * shared/validation-helpers.ts. The exported validate function is wired into
 * the form's onSubmitAsync validator, following the submit-only validation
 * convention.
 */

import { shake } from "radashi";
import { requiredString } from "~/components/form/validation-helpers";
import {
  requiredSize,
  sizeRange,
  validateMountPoint as validateMountPointValue,
  optionalFilesystemLabel,
} from "~/components/storage/shared/validation-helpers";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE, isReusingPartition } from "./fields";
import { _ } from "~/i18n";
import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";
import type { FormFields, MountPointFields, FilesystemFields, SizeFields } from "./fields";

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
  // Size only applies when creating a new partition.
  if (isReusingPartition(fields.name)) return {};

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
