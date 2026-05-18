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
import { isEmpty, shake } from "radashi";
import { _ } from "~/i18n";

/** Types */

type ServerOption = "default" | "custom";

type FormFields = {
  server: ServerOption;
  url: string;
  code: string;
  email: string;
};

type FormFieldErrors = Partial<Record<keyof FormFields, string>>;

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
export function validate(formFields: FormFields): { fields?: FormFieldErrors } | undefined {
  const errors: FormFieldErrors = {};

  if (formFields.server === "custom" && isEmpty(formFields.url)) {
    // TRANSLATORS: validation error for the registration server URL field.
    errors.url = _("Enter a server URL");
  }

  if (formFields.server === "default" && isEmpty(formFields.code)) {
    // TRANSLATORS: validation error for the registration code field.
    errors.code = _("Enter a registration code");
  }

  const fieldErrors = shake(errors);

  if (!isEmpty(fieldErrors)) return { fields: fieldErrors };
}
