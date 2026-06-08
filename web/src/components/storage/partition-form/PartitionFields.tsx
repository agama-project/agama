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
import { defaultOptions, isReusingPartition, FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
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
 * - Partition name (e.g., "vdd2"): reuse the named partition
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
                // TRANSLATORS: %s is a disk name with its size (eg. "sda, 10 GiB")
                _("New partition. There are no available existing partitions on %s."),
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
        value: "",
        label: _("New partition"),
        // TRANSLATORS: %s is a disk name with its size (eg. "sda, 10 GiB")
        description: sprintf(_("Create a new partition on %s"), deviceLabel(device, true)),
      },
      { divider: true as const },
      ...availablePartitions.map((p) => {
        const fsLabel = p.filesystem?.label;
        const label = [deviceLabel(p, true), fsLabel].filter(Boolean).join(" - ");
        // TRANSLATORS: %s is a description like "XFS partition")
        const description = sprintf(_("Use current %s"), p.description);
        return {
          value: p.name,
          label,
          description,
        };
      }),
    ];

    return (
      <form.AppField
        name="name"
        listeners={{
          onChange: ({ value }) => {
            const isReuse = isReusingPartition(value);
            const selectedPartition = device.partitions?.find((p) => p.name === value);
            const currentFsType = selectedPartition?.filesystem?.type;
            const hasFilesystem = !!currentFsType;

            if (!isReuse) {
              // Switched to new partition - reset to AUTO
              form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
            } else if (hasFilesystem) {
              // Switched to existing partition with filesystem - default to REUSE
              // (compatibility check happens in FilesystemFields useEffect)
              form.setFieldValue("filesystem", FILESYSTEM_ACTION.REUSE);
            } else {
              // Switched to existing partition without filesystem - set to AUTO
              form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
            }
          },
        }}
      >
        {(field) => <field.DropdownField label={_("Partition")} options={options} />}
      </form.AppField>
    );
  },
});

export default PartitionFields;
