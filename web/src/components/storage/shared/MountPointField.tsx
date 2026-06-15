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
import { sharedDefaultOptions } from "./fields";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { formattedPath } from "~/components/storage/utils";

const DefaultHelperText = (): React.ReactNode => {
  return sprintf(
    // TRANSLATORS: each %s is replaced by a mount point (e.g., "/home").
    _("E.g., %s, %s, %s"),
    formattedPath("/home"),
    formattedPath("/var/lib"),
    formattedPath("swap"),
  );
};

/**
 * Mount point field shared across the storage forms.
 *
 * Renders a {@link SuggestionsTextField} wired to the `mountPoint` field and
 * keeps the companion `committedMountPoint` field in sync.
 *
 * ## Committed mount point pattern
 *
 * The live `mountPoint` value backs the text input and validation, but derived
 * UI (filesystem hints, size hints) reads `committedMountPoint` instead. This
 * field is a stable value that only updates when:
 *
 * - the form mounts (initial value, for editing existing devices),
 * - the user selects a suggestion (immediate), or
 * - the user finishes typing a custom value (on blur, deferred).
 *
 * This prevents showing misleading information while the user types "/ho..."
 * before completing "/home", and avoids expensive recalculations on every
 * keystroke.
 *
 * ## What this component does NOT do
 *
 * It contains no validation logic. Validation stays in each form's `fields.ts`
 * and surfaces through the TanStack Form field context.
 *
 * @example
 * <MountPointField form={form} suggestions={unusedMountPoints} />
 */
const MountPointField = withForm({
  ...sharedDefaultOptions,
  props: {
    /** Predefined mount points offered as suggestions. */
    suggestions: [] as string[],
  } as {
    suggestions: string[];
    /** Optional override for the field label. */
    label?: React.ReactNode;
    /** Optional override for the helper text. */
    helperText?: React.ReactNode;
  },
  render: function Render({ form, suggestions, label, helperText }) {
    return (
      <form.AppField
        name="mountPoint"
        listeners={{
          // Initialize committedMountPoint when the form loads (editing flow).
          onMount: ({ value }) => {
            form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
          },
          // Update committedMountPoint when the user finishes typing. Deferred to
          // avoid showing incomplete/misleading information while typing.
          onBlur: ({ value }) => {
            form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
          },
        }}
      >
        {(field) => (
          <field.SuggestionsTextField
            label={label ?? _("Mount point")}
            suggestions={suggestions}
            helperText={helperText ?? <DefaultHelperText />}
            onSelect={(value) => {
              // Update committedMountPoint immediately when the user selects a
              // suggestion (click or Enter): the value is complete and intentional.
              form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
            }}
          />
        )}
      </form.AppField>
    );
  },
});

export default MountPointField;
