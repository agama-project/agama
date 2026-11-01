/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { useState } from "react";
import { sift } from "radashi";
import Text from "~/components/core/Text";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { deviceLabel } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import { isDrive, isMd } from "~/model/storage/device";
import { withForm } from "~/hooks/form";
import { defaultOptions } from "./fields";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";

type TargetDevicesFieldProps = {
  /** Devices that can hold the physical volumes: drives and MD RAIDs. */
  devices: System.Device[];
};

/**
 * Field to choose the devices where the physical volumes of a volume group are
 * created.
 *
 * The devices offered are the only values the field takes: a disk the system
 * does not report cannot hold anything, so there is nothing to write out by
 * hand, unlike the ports of a network bond.
 *
 * The list tells the devices apart by their type and says no more: every word
 * of an option is read out with it, and the common case is better off simple.
 * What else helps to choose, the content of the disk, its filesystems or the
 * systems found on it, is shown by the dialog the foot of the list leads to,
 * in a table where it fits.
 *
 * Receives a typed form instance via `withForm`.
 */
const TargetDevicesField = withForm({
  ...defaultOptions,
  // Only carries the prop types: every caller passes them all.
  props: {} as TargetDevicesFieldProps,
  render: function Render({ form, devices }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const options = devices.map((device) => ({
      value: device.name,
      label: deviceLabel(device, { truncate: true }),
      description: (
        <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{typeDescription(device)}</Text>
      ),
      // Searchable by what the option shows, and by the name of the device.
      filterText: sift([device.name, deviceLabel(device), typeDescription(device)]).join(" "),
    }));

    return (
      <form.AppField name="targetDevices">
        {(field) => (
          <>
            <field.MultiSelectField
              label={_("Disks")}
              options={options}
              entriesThreshold={3}
              collapseInputOnBlur
              hideClearAllOnBlur
              helperText={_(
                "LVM physical volumes will be added as partitions on the chosen disks.",
              )}
              // Nothing to browse, nothing to lead to: a dialog opening on an
              // empty table is worse than no way in at all.
              footerEntry={
                devices.length > 0
                  ? {
                      // TRANSLATORS: entry at the end of the list of disks,
                      // leading to a dialog listing the same devices with more
                      // information about each of them. The trailing ellipsis
                      // hints that more follows instead of a device being
                      // picked right away.
                      label: _("Browse with details..."),
                      onSelect: () => setIsDialogOpen(true),
                      opensDialog: true,
                    }
                  : undefined
              }
            />
            {isDialogOpen && (
              <DeviceSelectorModal
                // TRANSLATORS: title of the dialog to choose the disks of a
                // volume group from a table with details about each of them.
                title={_("Select disks")}
                selectionMode="multiple"
                disks={devices.filter(isDrive)}
                mdRaids={devices.filter(isMd)}
                selected={devices.filter((d) => field.state.value.includes(d.name))}
                emptyStateBodies={{
                  volumeGroups: _(
                    "Only disks and software RAID devices can hold the physical volumes of a " +
                      "volume group.",
                  ),
                }}
                // Every device the field takes is among the ones offered, so
                // what the dialog answers is the new value as it is.
                onConfirm={(picked) => {
                  field.handleChange(picked.map((d) => d.name));
                  setIsDialogOpen(false);
                }}
                onCancel={() => setIsDialogOpen(false)}
              />
            )}
          </>
        )}
      </form.AppField>
    );
  },
});

export default TargetDevicesField;
