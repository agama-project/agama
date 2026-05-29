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
import { defaultOptions, PARTITION_SOURCE } from "./fields";
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
 * This is used as the dropdown value for the "New partition" option. When this
 * value is selected, the form's `selectedPartitionId` is cleared and
 * `partitionSource` is set to "new".
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
 * The dropdown value is derived from form state:
 * - When `partitionSource` is "new": dropdown shows NEW_PARTITION_VALUE
 * - When `partitionSource` is "reuse": dropdown shows `selectedPartitionId`
 *
 * Selecting a value updates both fields:
 * - NEW_PARTITION_VALUE → `partitionSource` = "new", `selectedPartitionId` = ""
 * - Partition name → `partitionSource` = "reuse", `selectedPartitionId` = name
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

    return (
      <form.Subscribe
        selector={(s) => ({
          partitionSource: s.values.partitionSource,
          selectedPartitionId: s.values.selectedPartitionId,
        })}
      >
        {({ partitionSource, selectedPartitionId }) => {
          if (!canReuse) {
            // No partitions available: show ReadOnlyField with explanation
            return (
              <form.AppField name="partitionSource">
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

          // Derive dropdown value from form state
          const dropdownValue =
            partitionSource === PARTITION_SOURCE.NEW ? NEW_PARTITION_VALUE : selectedPartitionId;

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
            <form.AppField
              name="selectedPartitionId"
              listeners={{
                // Sync dropdown value with form state on mount.
                // The field value comes from toFormValues in Form.tsx, which sets it correctly
                // for both new and reuse cases. We just need to map it to dropdown value.
                onMount: () => {
                  if (partitionSource === PARTITION_SOURCE.NEW) {
                    form.setFieldValue("selectedPartitionId", NEW_PARTITION_VALUE, {
                      dontUpdateMeta: true,
                    });
                  }
                },
                // Sync form fields when dropdown value changes
                onChange: ({ value }) => {
                  if (value === NEW_PARTITION_VALUE) {
                    // User selected "New partition"
                    form.setFieldValue("partitionSource", PARTITION_SOURCE.NEW);
                    // Clear selectedPartitionId (will be set back to NEW_PARTITION_VALUE in render)
                    form.setFieldValue("selectedPartitionId", "");
                  } else {
                    // User selected an existing partition
                    form.setFieldValue("partitionSource", PARTITION_SOURCE.REUSE);
                    // selectedPartitionId is already set by field.handleChange
                  }
                },
              }}
            >
              {(field) => (
                <field.DropdownField
                  label={_("Partition")}
                  options={options}
                  // Override the field value with the derived dropdown value
                  // because the field itself stores "" for new partition
                />
              )}
            </form.AppField>
          );
        }}
      </form.Subscribe>
    );
  },
});

export default PartitionFields;
