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
import NestedContent from "~/components/core/NestedContent";
import { withForm } from "~/hooks/form";
import { defaultOptions, PARTITION_SOURCE } from "./fields";
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";

import type { Storage as System } from "~/model/system";

type PartitionFieldsProps = {
  device: System.Device;
  availablePartitions: System.Device[];
};

/**
 * Partition selection: new vs use existing partition.
 *
 * Shows a dropdown for choosing between creating a new partition or
 * using an existing one. "New partition" always appears first, followed by
 * a divider, then one entry per reusable partition.
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
      <form.AppField name="partitionSource">
        {(field) => {
          if (!canReuse) {
            return (
              <field.ReadOnlyField
                label={_("Partition source")}
                text={sprintf(
                  // TRANSLATORS: %s is device name like "/dev/vdd"
                  _("New partition (no partitions available on %s to reuse)"),
                  deviceLabel(device, true),
                )}
              />
            );
          }

          // When partitions are available, show radio group
          return (
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
                      <form.AppField
                        name="selectedPartitionId"
                        listeners={{
                          onMount: ({ value }) => {
                            if (!value && availablePartitions.length > 0) {
                              form.setFieldValue(
                                "selectedPartitionId",
                                availablePartitions[0].name,
                                {
                                  dontUpdateMeta: true,
                                },
                              );
                            }
                          },
                        }}
                      >
                        {(partField) => (
                          <partField.DropdownField
                            label={_("Partition")}
                            options={availablePartitions.map((p) => {
                              const fsLabel = p.filesystem?.label;
                              const description = [p.description, fsLabel]
                                .filter(Boolean)
                                .join(" - ");
                              return {
                                value: p.name,
                                label: deviceLabel(p, true),
                                description: description || undefined,
                              };
                            })}
                          />
                        )}
                      </form.AppField>
                    </NestedContent>
                  );
                }
                return null;
              }}
            </field.RadioGroupField>
          );
        }}
      </form.AppField>
    );
  },
});

export default PartitionFields;
