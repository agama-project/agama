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
import LabelText from "~/components/form/LabelText";
import { withForm } from "~/hooks/form";
import { sharedDefaultOptions } from "./fields";
import { _ } from "~/i18n";

/**
 * Filesystem label text input shared across the storage forms.
 *
 * Presentation only: it wraps a {@link TextField} bound to the
 * `filesystemLabel` field and has no validation logic. Validation (the allowed
 * label format) stays in each form's `fields.ts` and surfaces through the
 * TanStack Form field context.
 *
 * @example
 * <FilesystemLabelField form={form} />
 */
const FilesystemLabelField = withForm({
  ...sharedDefaultOptions,
  props: {} as {
    /** Optional override for the field label. */
    label?: React.ReactNode;
  },
  render: function Render({ form, label }) {
    return (
      <form.AppField name="filesystemLabel">
        {(field) => (
          <field.TextField
            label={label ?? <LabelText suffix={_("(optional)")}>{_("Label")}</LabelText>}
          />
        )}
      </form.AppField>
    );
  },
});

export default FilesystemLabelField;
