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

import React from "react";
import { withForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import { _ } from "~/i18n";

/**
 * Password and confirmation fields for the first user form.
 *
 * Renders two password fields with validation errors. The confirmation field
 * hides keyboard reminders for a cleaner UX.
 */
const PasswordFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="password">
          {(field) => <field.MaskedField label={_("Password")} />}
        </form.AppField>

        <form.AppField name="passwordConfirmation">
          {(field) => (
            <field.MaskedField
              label={_("Password confirmation")}
              hideReminders={["keymap", "capslock"]}
            />
          )}
        </form.AppField>
      </>
    );
  },
});

export default PasswordFields;
