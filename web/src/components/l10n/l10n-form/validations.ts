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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import { isEmpty, shake } from "radashi";
import { requiredString } from "~/components/form/validation-helpers";
import { _ } from "~/i18n";

import type { ValidationResult } from "~/components/form/validation-helpers";
import type { FormFields } from "./fields";

// FIXME: a language, a keyboard and a time zone are all required, but there is
// no dedicated translated message for each yet (string freeze). Reuse the
// generic "Value is required" for now and replace it with a per-field message
// once new strings are allowed. Tracked in gh#agama-project/agama#NNNN.
//
// TRANSLATORS: validation error shown when a required selection is missing
const requiredMessage = () => _("Value is required");

/**
 * Validates the localization form. A language, a keyboard layout and a time
 * zone must each be selected; returns a per-field error for any that is empty.
 */
export function validate(formValues: FormFields): ValidationResult<FormFields> {
  const fields = shake({
    language: requiredString(formValues.language, requiredMessage()),
    keymap: requiredString(formValues.keymap, requiredMessage()),
    timezone: requiredString(formValues.timezone, requiredMessage()),
  });

  if (!isEmpty(fields)) return { fields };
}
