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
import UsedPartitionableCurrent from "~/components/storage/device-sheet/UsedPartitionableCurrent";
import UnusedPartitionableCurrent from "~/components/storage/device-sheet/UnusedPartitionableCurrent";
import VolumeGroupCurrent from "~/components/storage/device-sheet/VolumeGroupCurrent";
import PartitionableContent from "~/components/storage/device-sheet/PartitionableContent";
import PartitionableNoContent from "~/components/storage/device-sheet/PartitionableNoContent";
import PartitionableMountContent from "~/components/storage/device-sheet/PartitionableMountContent";
import VolumeGroupContent from "~/components/storage/device-sheet/VolumeGroupContent";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import type { Partitionable } from "~/model/storage/config-model";
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

  return (
    /* Wider apart than anything inside a section, so the two read as parts
       rather than as one run of lines. */
    <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
      {!entry.isVolumeGroup && isUsedPartitionable && (
        <UsedPartitionableCurrent entry={entry} subject={subject} />
      )}
      {!entry.isVolumeGroup && !isUsedPartitionable && (
        <UnusedPartitionableCurrent entry={entry} subject={subject} />
      )}
      {entry.isVolumeGroup && <VolumeGroupCurrent entry={entry} subject={subject} />}
      {!entry.isVolumeGroup && isMountedPartitionable && (
        <PartitionableMountContent entry={entry} subject={subject} />
      )}
      {!entry.isVolumeGroup && !isMountedPartitionable && isUsedPartitionable && (
        <PartitionableContent entry={entry} subject={subject} />
      )}
      {!entry.isVolumeGroup && !isMountedPartitionable && !isUsedPartitionable && (
        <PartitionableNoContent entry={entry} subject={subject} />
      )}
      {entry.isVolumeGroup && <VolumeGroupContent entry={entry} subject={subject} />}
    </Flex>
  );
}
