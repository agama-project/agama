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
import { NestedContent, Stack } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { withForm } from "~/hooks/form";
import { defaultOptions, SIZE_MODE } from "./fields";
import { _ } from "~/i18n";

/**
 * Size mode selection and size inputs.
 *
 * Uses DropdownField for size mode selection and reveals appropriate size
 * input fields based on the selected mode:
 * - Automatic: Info text explaining automatic sizing
 * - Fixed: Single TextField for exact size
 * - Range: Two TextFields for minimum and maximum
 * - Expand if possible: TextField for minimum with helper text
 */
const SizeFields = withForm({
  ...defaultOptions,
  render: function Render({ form }) {
    return (
      <form.AppField name="sizeMode">
        {(field) => (
          <field.DropdownField
            label={_("Size")}
            options={[
              {
                value: SIZE_MODE.AUTO,
                label: _("Automatic"),
              },
              {
                value: SIZE_MODE.FIXED,
                label: _("Fixed"),
              },
              {
                value: SIZE_MODE.RANGE,
                label: _("Range"),
              },
              {
                value: SIZE_MODE.EXPAND,
                label: _("Expand if possible"),
              },
            ]}
          >
            {(mode) => {
              if (mode === SIZE_MODE.AUTO) {
                return (
                  <NestedContent>
                    <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
                      {_(
                        "Installer will propose a suitable value based on available disk space and mount point role",
                      )}
                    </Text>
                  </NestedContent>
                );
              }

              if (mode === SIZE_MODE.FIXED) {
                return (
                  <NestedContent>
                    <form.AppField name="fixedSize">
                      {(sizeField) => (
                        <sizeField.TextField
                          label={_("Value")}
                          helperText={_("e.g., 20 GiB, 100 MB")}
                        />
                      )}
                    </form.AppField>
                  </NestedContent>
                );
              }

              if (mode === SIZE_MODE.RANGE) {
                return (
                  <NestedContent>
                    <Stack hasGutter>
                      <form.AppField name="minSize">
                        {(sizeField) => (
                          <sizeField.TextField
                            label={_("Minimum")}
                            helperText={_("e.g., 10 GiB")}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="maxSize">
                        {(sizeField) => (
                          <sizeField.TextField
                            label={_("Maximum")}
                            helperText={_("e.g., 40 GiB")}
                          />
                        )}
                      </form.AppField>
                    </Stack>
                  </NestedContent>
                );
              }

              if (mode === SIZE_MODE.EXPAND) {
                return (
                  <NestedContent>
                    <form.AppField name="minSize">
                      {(sizeField) => (
                        <sizeField.TextField
                          label={_("Minimum")}
                          helperText={_(
                            "Minimum space guaranteed. Remaining disk space is shared among expandable partitions.",
                          )}
                        />
                      )}
                    </form.AppField>
                  </NestedContent>
                );
              }

              return null;
            }}
          </field.DropdownField>
        )}
      </form.AppField>
    );
  },
});

export default SizeFields;
