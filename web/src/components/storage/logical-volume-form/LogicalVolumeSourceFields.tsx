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
import { sprintf } from "sprintf-js";
import { withForm } from "~/hooks/form";
import type { DropdownOption } from "~/components/form/DropdownField";
import {
  defaultOptions,
  isReusingLogicalVolume,
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
} from "./fields";
import { deviceLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";

/**
 * The empty target value means "create a new logical volume". Kept local to
 * mirror the `target` field convention from fields.ts.
 */
const NEW_LOGICAL_VOLUME = "";

/**
 * Logical volume source selector.
 *
 * Lets the user choose between creating a new logical volume and reusing an
 * existing, unused one. The choice is stored in the `target` field: an empty
 * string for a new logical volume, or the device name of the one to reuse.
 *
 * When the volume group does not yet exist in the system (it is being created
 * as part of the same configuration), there is nothing to choose: every
 * logical volume is necessarily new, so the field is not rendered at all.
 *
 * When the volume group exists but has no logical volumes left to reuse, a
 * read-only field explains that a new logical volume will be created
 * (maintains consistent visual structure).
 *
 * Presentation only: it has no validation logic.
 */
const LogicalVolumeSourceFields = withForm({
  ...defaultOptions,
  props: {
    /** Unused logical volumes available to reuse. */
    availableLogicalVolumes: [] as System.Device[],
  } as {
    availableLogicalVolumes: System.Device[];
    /**
     * The volume group as it exists in the system, or `undefined` when the
     * volume group is new (not yet created).
     */
    volumeGroup?: System.Device;
  },
  render: function Render({ form, availableLogicalVolumes, volumeGroup }) {
    // The volume group does not exist yet: every logical volume is necessarily
    // new, so there is nothing to choose and the field is not rendered.
    if (!volumeGroup) return null;

    // No logical volumes left to reuse: only a new logical volume is possible.
    if (availableLogicalVolumes.length === 0) {
      return (
        <form.AppField name="target">
          {(field) => (
            <field.ReadOnlyField
              label={_("Logical volume")}
              text={sprintf(
                // TRANSLATORS: %s is a volume group name with its size (eg. "system (30 GiB)")
                _("New logical volume. There are no available existing logical volumes on %s."),
                deviceLabel(volumeGroup, true),
              )}
            />
          )}
        </form.AppField>
      );
    }

    const options: DropdownOption<string>[] = [
      {
        value: NEW_LOGICAL_VOLUME,
        label: _("New logical volume"),
        description: sprintf(
          // TRANSLATORS: %s is a volume group name with its size (eg. "system (30 GiB)")
          _("Create a new logical volume on %s"),
          deviceLabel(volumeGroup, true),
        ),
      },
      { divider: true },
      ...availableLogicalVolumes.map((lv) => {
        const fsLabel = lv.filesystem?.label;
        const label = [deviceLabel(lv, true), fsLabel].filter(Boolean).join(" - ");
        // TRANSLATORS: %s is a description like "Ext4 logical volume"
        const description = sprintf(_("Use current %s"), lv.description);
        return {
          value: lv.name,
          label,
          description,
        };
      }),
    ];

    return (
      <form.AppField
        name="target"
        listeners={{
          onChange: ({ value }) => {
            const isReuse = isReusingLogicalVolume(value);
            const selectedLogicalVolume = volumeGroup.logicalVolumes?.find(
              (lv) => lv.name === value,
            );
            const currentFsType = selectedLogicalVolume?.filesystem?.type;
            const hasFilesystem = !!currentFsType;

            if (!isReuse) {
              // Switched to new logical volume - reset to AUTO
              form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
            } else if (hasFilesystem) {
              // Switched to existing logical volume with filesystem - default to REUSE
              // (compatibility check happens in FilesystemFields useEffect)
              form.setFieldValue("filesystem", FILESYSTEM_ACTION.REUSE);
            } else {
              // Switched to existing logical volume without filesystem - set to AUTO
              form.setFieldValue("filesystem", FILESYSTEM_TYPE.AUTO);
            }
          },
        }}
      >
        {(field) => <field.DropdownField label={_("Logical volume")} options={options} />}
      </form.AppField>
    );
  },
});

export default LogicalVolumeSourceFields;
