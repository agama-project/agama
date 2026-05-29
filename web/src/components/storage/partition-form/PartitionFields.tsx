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
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

import type { Storage as System } from "~/model/system";
import type { DropdownOption } from "~/components/form/DropdownField";

type PartitionFieldsProps = {
  device: System.Device;
  availablePartitions: System.Device[];
};

/**
 * Special value representing "create a new partition" in the partition dropdown.
 *
 * This constant is used as the dropdown value for the "New partition" option.
 * When selected, the form's `name` field is cleared (empty string), indicating
 * that a new partition should be created rather than reusing an existing one.
 */
const NEW_PARTITION_VALUE = "NEW";

/**
 * Partition selection: new vs use existing partition.
 *
 * Shows a single dropdown for choosing between creating a new partition or
 * using an existing one. "New partition" always appears first, followed by
 * a divider, then one entry per reusable partition on the device.
 *
 * ## Value mapping
 *
 * The `name` field determines whether to create new or reuse:
 * - Empty string: create a new partition
 * - Partition name: reuse the named partition
 *
 * The dropdown uses NEW_PARTITION_VALUE internally for the "New partition"
 * option, which maps to empty string in the form field.
 *
 * When no partitions are available, displays a ReadOnlyField explaining that
 * a new partition will be created (maintains consistent visual structure).
 */
const PartitionFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
    availablePartitions: [] as System.Device[],
  } as PartitionFieldsProps,
  render: function Render({ form, device, availablePartitions }) {
    const canReuse = availablePartitions.length > 0;

    if (!canReuse) {
      // No partitions available: show ReadOnlyField with explanation
      return (
        <form.AppField name="name">
          {(field) => (
            <field.ReadOnlyField
              label={_("Partition")}
              text={sprintf(
                // TRANSLATORS: %s is device name like "/dev/vdd"
                _("New partition (no partitions available on %s to reuse)."),
                deviceLabel(device, true),
              )}
            />
          )}
        </form.AppField>
      );
    }

    // Build dropdown options: "New partition" + divider + partition list
    const options: DropdownOption<string>[] = [
      {
        value: NEW_PARTITION_VALUE,
        label: _("New partition"),
      },
      { divider: true as const },
      ...availablePartitions.map((p) => {
        const fsLabel = p.filesystem?.label;
        const description = [p.description, fsLabel].filter(Boolean).join(" - ");
        return {
          value: p.name,
          label: sprintf(
            // TRANSLATORS: %1$s is partition name like "vdd2", %2$s is size like "18.00 GiB"
            _("Use %1$s (%2$s)"),
            deviceLabel(p, false),
            p.description || "",
          ),
          description: description || undefined,
        };
      }),
    ];

    return (
      <form.Subscribe selector={(s) => ({ name: s.values.name })}>
        {({ name }) => {
          // Derive dropdown value: NEW for empty, partition name for reuse
          const dropdownValue = name === "" ? NEW_PARTITION_VALUE : name;

          return (
            <form.AppField
              name="name"
              listeners={{
                // Initialize to NEW_PARTITION_VALUE for display when name is empty
                onMount: () => {
                  if (name === "") {
                    form.setFieldValue("name", NEW_PARTITION_VALUE, { dontUpdateMeta: true });
                  }
                },
                // Map dropdown value back to form field
                onChange: ({ value }) => {
                  if (value === NEW_PARTITION_VALUE) {
                    // User selected "New partition" - clear the name field
                    form.setFieldValue("name", "");
                  }
                  // Otherwise, value is already the partition name, set by field.handleChange
                },
              }}
            >
              {(field) => <field.DropdownField label={_("Partition")} options={options} />}
            </form.AppField>
          );
        }}
      </form.Subscribe>
    );
  },
});

export default PartitionFields;
