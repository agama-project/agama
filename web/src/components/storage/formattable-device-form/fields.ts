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
import { requiredString } from "~/components/form/validation-helpers";
import {
  validateMountPoint as validateMountPointValue,
  optionalFilesystemLabel,
} from "~/components/storage/shared/validation-helpers";
import {
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  type MountPointFields,
  type FilesystemFields,
} from "~/components/storage/shared/fields";
import { _ } from "~/i18n";

export { FILESYSTEM_TYPE, FILESYSTEM_ACTION };

/** Form field types */

export type FormFields = MountPointFields & FilesystemFields;

export type FormattableDeviceFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  filesystem: FILESYSTEM_TYPE.AUTO,
  filesystemAction: FILESYSTEM_ACTION.REUSE,
  filesystemLabel: "",
  mkfsOptions: [],
  mountOptions: [],
  showMoreFilesystemSettings: false,
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

/**
 * Top-level validation function.
 *
 * Validates all fields and returns field errors if any are found.
 *
 * @param fields - The form field values.
 * @param usedMountPoints - Mount points already in use (excluding the current
 *   one when editing).
 * @returns Validation result with field errors, or undefined if valid.
 */
export function validate(
  fields: FormFields,
  usedMountPoints: string[] = [],
): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateMountPoint(fields, usedMountPoints),
    ...validateFilesystemFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
