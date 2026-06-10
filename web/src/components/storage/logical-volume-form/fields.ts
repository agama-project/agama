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
  requiredSize,
  sizeRange,
  validateMountPoint as validateMountPointValue,
  optionalFilesystemLabel,
} from "~/components/storage/shared/validation-helpers";
import {
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  SIZE_MODE,
  type SizeMode,
  type MountPointFields,
  type FilesystemFields,
  type SizeFields,
} from "~/components/storage/shared/fields";
import { _ } from "~/i18n";

export { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE };
export type { SizeMode };

/**
 * Determines whether the form is configured to reuse an existing logical
 * volume.
 *
 * Returns `true` when the target holds a logical volume name (e.g.
 * "/dev/system/home"), and `false` when creating a new logical volume (empty
 * string).
 *
 * @param target - The logical volume source field value.
 */
export function isReusingLogicalVolume(target: string): boolean {
  return target !== "";
}

/** Form field types */

type LogicalVolumeSourceFields = {
  /**
   * Logical volume name for reusing an existing logical volume, or an empty
   * string for creating a new one.
   *
   * When empty: a new logical volume will be created.
   * When a logical volume name (e.g., "/dev/system/home"): that logical volume
   * is reused.
   */
  target: string;
};

type LogicalVolumeNameFields = {
  /**
   * Name for the new logical volume (e.g., "home", "var"). Only used when
   * creating a new logical volume (target === ""). Auto-filled from the mount
   * point until the user edits it.
   */
  lvName: string;
};

type FormFields = MountPointFields &
  LogicalVolumeSourceFields &
  LogicalVolumeNameFields &
  FilesystemFields &
  SizeFields;

export type LogicalVolumeFormData = FormFields;

/** Default values */

const defaultValues: FormFields = {
  mountPoint: "",
  committedMountPoint: "",
  target: "",
  lvName: "",
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

function validateLogicalVolumeName(
  fields: FormFields,
): FieldsValidationResult<LogicalVolumeNameFields> {
  // The name is only required (and only rendered) when creating a new logical
  // volume; reusing an existing one keeps its name.
  if (isReusingLogicalVolume(fields.target)) return {};

  return { lvName: requiredString(fields.lvName, _("Enter a name")) };
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
  // Size only applies when creating a new logical volume.
  if (isReusingLogicalVolume(fields.target)) return {};

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
    ...validateLogicalVolumeName(fields),
    ...validateFilesystemFields(fields),
    ...validateSizeFields(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
