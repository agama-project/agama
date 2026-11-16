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

import { shake } from "radashi";
import { requiredString } from "~/components/form/validation-helpers";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";

import type { ValidationResult } from "~/components/form/validation-helpers";
import type { FormFields } from "./fields";

/**
 * Validates the language and keyboard form. The keyboard is only checked on the
 * machine itself: from a remote connection it cannot be changed.
 */
export function validate(formValues: FormFields): ValidationResult<FormFields> {
  const fieldErrors = shake({
    keymap: localConnection()
      ? // TRANSLATORS: error shown when no keyboard layout is selected
        requiredString(formValues.keymap, _("Select a keyboard layout"))
      : undefined,
  });

  return Object.keys(fieldErrors).length > 0 ? { fields: fieldErrors } : undefined;
}
