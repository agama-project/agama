/*
 * Copyright (c) [2023-2026] SUSE LLC
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
 * Product registration form fields: types, defaults, and validation.
 */

import { formOptions } from "@tanstack/react-form";
import { shake } from "radashi";
import { requiredString, ValidationResult } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

/** Types */

type ServerOption = "default" | "custom";

type FormFields = {
  server: ServerOption;
  url: string;
  code: string;
  email: string;
};

/** Defaults */

const defaultValues: FormFields = {
  server: "default" as ServerOption,
  url: "",
  code: "",
  email: "",
};

/**
 * Form options for product registration.
 *
 * Type casts widen literal defaults to their union types, allowing fields
 * to accept any value from the union.
 */
export const defaultOptions = formOptions({
  defaultValues,
});

/** Validation */

/**
 * Validates the registration form fields.
 *
 * Returns a map of field errors when validation fails, or undefined when all
 * values are valid.
 */
export function validate(formFields: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    url:
      formFields.server === "custom"
        ? // TRANSLATORS: validation error for the registration server URL field.
          requiredString(formFields.url, _("Enter a server URL"))
        : undefined,
    code:
      formFields.server === "default"
        ? // TRANSLATORS: validation error for the registration code field.
          requiredString(formFields.code, _("Enter a registration code"))
        : undefined,
  });

  if (Object.keys(fieldErrors).length > 0) return { fields: fieldErrors };
}
