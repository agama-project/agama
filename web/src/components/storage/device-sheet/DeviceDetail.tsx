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
import { Flex } from "@patternfly/react-core";
import SheetSection from "~/components/storage/device-sheet/SheetSection";
import BootStatement from "~/components/storage/device-sheet/BootStatement";
import UsedPartitionableCurrent from "~/components/storage/device-sheet/UsedPartitionableCurrent";
import UnusedPartitionableCurrent from "~/components/storage/device-sheet/UnusedPartitionableCurrent";
import VolumeGroupCurrent from "~/components/storage/device-sheet/VolumeGroupCurrent";
import PropertiesSection from "~/components/storage/device-sheet/PropertiesSection";
import PartitionableContent from "~/components/storage/device-sheet/PartitionableContent";
import PartitionableNoContent from "~/components/storage/device-sheet/PartitionableNoContent";
import PartitionableMountContent from "~/components/storage/device-sheet/PartitionableMountContent";
import VolumeGroupContent from "~/components/storage/device-sheet/VolumeGroupContent";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

export type DeviceDetailProps = {
  entry: Entry;
  /** Where the entry is written, which is what the acts on its parts need. */
  subject: SheetEntry;
};

/**
 * What one entry of the plan holds, read top to bottom as time moving forwards.
 */
export default function DeviceDetail({ entry, subject }: DeviceDetailProps): React.ReactNode {
  const config = useConfigModel();
  const part = entry.isVolumeGroup ? null : (entry.config as Partitionable.Device);
  const isUsedPartitionable = part && configModel.partitionable.isUsed(config, part.name);
  const isMountedPartitionable = part && !!part.mountPath;

  /* A volume group the system does not have yet has nothing on it today: what
     it starts from is the disks it takes its room from. */
  const isNewVolumeGroup = entry.isVolumeGroup && !(entry.config as ConfigModel.VolumeGroup).name;

  /* A file system the new system takes as it is changes nothing on the device:
     what is there now is what will be there, so it is said once. */
  if (isMountedPartitionable && part.filesystem?.reuse === true) {
    return (
      // TRANSLATORS: heading of a device's panel where the new system uses what
      // is on the device as it is.
      <SheetSection title={_("Content")} icon="inventory_2">
        <PartitionableMountContent entry={entry} subject={subject} />
      </SheetSection>
    );
  }

  /* Named after what it holds rather than after when, since not everything a
     device takes part in is new content. */
  let newContentTitle: string;
  if (entry.isVolumeGroup) {
    // TRANSLATORS: heading of the part of a volume group's panel listing the
    // logical volumes the installation creates in it.
    newContentTitle = _("Logical volumes to create");
  } else if (isMountedPartitionable) {
    // TRANSLATORS: heading of the part of a device's panel about a file system
    // that takes the whole device.
    newContentTitle = _("File system");
  } else if (isUsedPartitionable) {
    // TRANSLATORS: heading of the part of a device's panel listing the
    // partitions the installation creates on it.
    newContentTitle = _("Partitions to create");
  } else {
    // TRANSLATORS: heading of the part of a device's panel about how the
    // installation uses the device, where it does not use it yet.
    newContentTitle = _("Usage");
  }

  /* Booting is a concern of its own: the partitions it needs may be created
     or already there, so it is not part of what the device gets created. */
  const isBootDevice = !!part && configModel.boot.hasDevice(config, part.name);

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      {/* A group being created has nothing on it today: what defines it comes
          first instead. */}
      {isNewVolumeGroup ? (
        // TRANSLATORS: heading of the part of a volume group's panel saying
        // what defines it: the disks it takes its room from, its name and how
        // it uses those disks.
        <SheetSection title={_("Properties")} icon="schema">
          <PropertiesSection entry={entry} subject={subject} />
        </SheetSection>
      ) : (
        // TRANSLATORS: heading of the part of a device's panel saying what is
        // on the device now, before installing.
        <SheetSection title={_("Current content")} icon="inventory_2">
          {!entry.isVolumeGroup && isUsedPartitionable && (
            <UsedPartitionableCurrent entry={entry} subject={subject} />
          )}
          {!entry.isVolumeGroup && !isUsedPartitionable && (
            <UnusedPartitionableCurrent entry={entry} subject={subject} />
          )}
          {entry.isVolumeGroup && <VolumeGroupCurrent entry={entry} subject={subject} />}
        </SheetSection>
      )}
      <SheetSection title={newContentTitle} icon="pending_actions">
        {!entry.isVolumeGroup && isMountedPartitionable && (
          <PartitionableMountContent entry={entry} subject={subject} showName={false} />
        )}
        {!entry.isVolumeGroup && !isMountedPartitionable && isUsedPartitionable && (
          <PartitionableContent entry={entry} subject={subject} />
        )}
        {!entry.isVolumeGroup && !isMountedPartitionable && !isUsedPartitionable && (
          <PartitionableNoContent entry={entry} subject={subject} />
        )}
        {entry.isVolumeGroup && <VolumeGroupContent entry={entry} subject={subject} />}
      </SheetSection>
      {isBootDevice && (
        // TRANSLATORS: heading of the part of a disk's panel shown when the
        // machine starts from that disk.
        <SheetSection title={_("Boot device")} icon="settings_backup_restore">
          <BootStatement entry={entry} />
        </SheetSection>
      )}
    </Flex>
  );
}
