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
 * Name input for a new logical volume.
 *
 * Wraps a {@link TextField} bound to the `lvName` field. It is only meaningful
 * when creating a new logical volume; the parent form renders it only in that
 * case, and Form.tsx auto-fills the value from the mount point until the user
 * edits it.
 *
 * Presentation only: the "name is required" rule lives in fields.ts.
 */
const LogicalVolumeNameField = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <form.AppField name="lvName">
        {(field) => (
          <field.TextField
            label={_("Name")}
            // TRANSLATORS: hint below the name input, with example logical volume names
            helperText={_("Name for the logical volume. E.g., root, home, lv0")}
          />
        )}
      </form.AppField>
    );
  },
});

export default LogicalVolumeNameField;
