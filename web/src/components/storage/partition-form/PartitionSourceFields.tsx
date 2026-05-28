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
import { FormGroup } from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import { withForm } from "~/hooks/form";
import { defaultOptions, PARTITION_SOURCE } from "./fields";
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

import type { Storage as System } from "~/model/system";

type PartitionSourceFieldsProps = {
  device: System.Device;
  availablePartitions: System.Device[];
};

/**
 * Partition source selection: new vs use existing partition.
 *
 * Shows radio buttons for choosing between creating a new partition or
 * using an existing one. When "use existing" is selected, reveals a partition
 * picker dropdown.
 *
 * When no partitions are available, displays a ReadOnlyField explaining that
 * a new partition will be created (maintains consistent visual structure).
 */
const PartitionSourceFields = withForm({
  ...defaultOptions,
  props: {
    device: {} as System.Device,
    availablePartitions: [] as System.Device[],
  } as PartitionSourceFieldsProps,
  render: function Render({ form, device, availablePartitions }) {
    const canReuse = availablePartitions.length > 0;

    // When no partitions available, show informative text instead of a field
    if (!canReuse) {
      return (
        <FormGroup label={_("Partition source")}>
          <div>
            {sprintf(
              // TRANSLATORS: %s is device name like "/dev/vdd"
              _("New partition (no partitions available on %s to reuse)"),
              deviceLabel(device, true),
            )}
          </div>
        </FormGroup>
      );
    }

    // When partitions are available, show radio group
    return (
      <form.AppField name="partitionSource">
        {(field) => (
          <field.RadioGroupField
            label={_("Partition source")}
            options={[
              {
                value: PARTITION_SOURCE.NEW,
                label: _("New partition"),
                description: sprintf(
                  // TRANSLATORS: %s is device name like "/dev/vdd"
                  _("Create a new partition on %s"),
                  deviceLabel(device, true),
                ),
              },
              {
                value: PARTITION_SOURCE.REUSE,
                label: sprintf(
                  // TRANSLATORS: %d is count of available partitions
                  _("Use existing partition (%d available)"),
                  availablePartitions.length,
                ),
                description: sprintf(
                  // TRANSLATORS: %s is device name like "/dev/vdd"
                  _("Pick one of the existing partitions on %s"),
                  deviceLabel(device, true),
                ),
              },
            ]}
          >
            {(value) => {
              if (value === PARTITION_SOURCE.REUSE) {
                return (
                  <NestedContent margin="mxLg">
                    <form.AppField name="selectedPartitionId">
                      {(partField) => (
                        <partField.DropdownField
                          label={_("Partition")}
                          options={availablePartitions.map((p) => ({
                            value: p.name,
                            label: deviceLabel(p, true),
                          }))}
                        />
                      )}
                    </form.AppField>
                  </NestedContent>
                );
              }
              return null;
            }}
          </field.RadioGroupField>
        )}
      </form.AppField>
    );
  },
});

export default PartitionSourceFields;
