/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
 * Validation for the volume group form.
 *
 * Builds on the field definitions from fields.ts and the reusable rules from
 * form/validation-helpers.ts. The exported validate function is wired into the
 * form's onSubmitAsync validator, following the submit-only validation
 * convention.
 */

import { shake } from "radashi";
import { sprintf } from "sprintf-js";
import { requiredString } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";
import type {
  ValidationResult,
  FieldsValidationResult,
} from "~/components/form/validation-helpers";
import type { FormFields, VolumeGroupNameFields, TargetDevicesFields } from "./fields";

/**
 * Characters LVM accepts in the name of a volume group.
 *
 * @see lvm(8)
 */
const VG_NAME_CHARACTERS = /^[a-zA-Z0-9+_.-]+$/;

function validateVolumeGroupName(
  fields: FormFields,
  usedNames: string[],
): FieldsValidationResult<VolumeGroupNameFields> {
  const { vgName } = fields;

  const required = requiredString(vgName, _("Enter a name for the volume group."));
  if (required) return { vgName: required };

  if (!VG_NAME_CHARACTERS.test(vgName)) {
    return {
      vgName: _(
        "The name can only contain letters, digits and the characters '+', '_', '.' and '-'.",
      ),
    };
  }

  // LVM does not allow these, even though their characters are valid.
  if (vgName.startsWith("-") || vgName === "." || vgName === "..") {
    return { vgName: _("The name cannot begin with a hyphen or be '.' or '..'.") };
  }

  if (usedNames.includes(vgName)) {
    return {
      vgName: sprintf(_("Volume group '%s' already exists. Enter a different name."), vgName),
    };
  }

  return {};
}

function validateTargetDevices(fields: FormFields): FieldsValidationResult<TargetDevicesFields> {
  return {
    targetDevices: fields.targetDevices.length ? undefined : _("Select at least one disk."),
  };
}

/**
 * Top-level validation function.
 *
 * Validates all fields and returns field errors if any are found.
 *
 * @param fields - The form field values.
 * @param usedNames - Names of the volume groups already configured (excluding
 *   the current one when editing).
 * @returns Validation result with field errors, or undefined if valid.
 */
export function validate(
  fields: FormFields,
  usedNames: string[] = [],
): ValidationResult<FormFields> {
  const fieldErrors = shake({
    ...validateVolumeGroupName(fields, usedNames),
    ...validateTargetDevices(fields),
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
