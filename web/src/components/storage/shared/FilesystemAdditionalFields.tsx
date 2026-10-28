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
import FilesystemLabelField from "./FilesystemLabelField";
import { sharedDefaultOptions, FILESYSTEM_ACTION } from "./fields";
import { _ } from "~/i18n";
import Interpolate from "~/components/core/Interpolate";

/**
 * Whether options for a new filesystem should be displayed.
 */
const isNewFilesystem = (filesystem: string): boolean => {
  return filesystem !== FILESYSTEM_ACTION.REUSE;
};

/**
 * Additional filesystem settings fields.
 *
 * Displayed when user checks "Define more file system settings" checkbox.
 */
const FilesystemAdditionalFields = withForm({
  ...sharedDefaultOptions,
  render: function Render({ form }) {
    return (
      <form.Subscribe selector={(s) => ({ filesystem: s.values.filesystem })}>
        {({ filesystem }) => (
          <>
            {isNewFilesystem(filesystem) && <FilesystemLabelField form={form} />}
            <form.AppField name="mountOptions">
              {(field) => (
                <field.ArrayField
                  label={<LabelText suffix={_("(optional)")}>{_("Mount options")}</LabelText>}
                  helperText={_("E.g. rw, noatime, umask=0666")}
                />
              )}
            </form.AppField>
            {isNewFilesystem(filesystem) && (
              <form.AppField name="mkfsExtraArguments">
                {(field) => (
                  <field.TextField
                    label={
                      <LabelText suffix={_("(optional)")}>
                        {_("Additional format arguments")}
                      </LabelText>
                    }
                    helperText={
                      <Interpolate
                        sentence={
                          // TRANSLATORS: %s is replaced by "mkfs" (command used to format devices)
                          _("This will be injected to the command to create the file system (%s).")
                        }
                      >
                        {() => <code>{"mkfs"}</code>}
                      </Interpolate>
                    }
                  />
                )}
              </form.AppField>
            )}
          </>
        )}
      </form.Subscribe>
    );
  },
});

export default FilesystemAdditionalFields;
