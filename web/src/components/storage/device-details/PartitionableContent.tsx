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
import { Flex, FlexItem, List, ListItem } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import SummaryWithActions from "~/components/storage/device-details/SummaryWithActions";
import Icon from "~/components/layout/Icon";
import PlannedContentSection from "~/components/storage/device-details/PlannedContentSection";
import UsedByStatement from "~/components/storage/device-details/UsedByStatement";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { usersOf } from "~/components/storage/shared/users";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { DeviceDetailsBodyProps } from "~/components/storage/device-details/DeviceDetailsBody";

/** One thing the new system gets here, whatever the entry calls its parts. */
type Planned = ConfigModel.Partition | ConfigModel.LogicalVolume;

/**
 * The partition id, where the thing planned is a partition asked for by id.
 *
 * A logical volume has none: only a partition can be asked for by what it is
 * for rather than by where it is mounted.
 */
function partitionId(part: Planned): ConfigModel.PartitionId | undefined {
  return "id" in part ? part.id : undefined;
}

/**
 * Everything the new system will have here, created or taken over.
 *
 * A device whose only plan is to mount a partition it already has is planning
 * something, and counting only what the installer creates said it was not.
 */
function plannedOn(entry: Entry): Planned[] {
  const parts = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];

  return parts.filter((part) => {
    /* A partition asked for by id and nothing else, a BIOS boot or a PReP
       partition, is planned content too: it takes room and was asked for. */
    if (configModel.volume.isNew(part)) return Boolean(part.mountPath || partitionId(part));
    return Boolean(part.mountPath);
  });
}

export default function PartitionableContent({
  entry,
  subject,
}: DeviceDetailsBodyProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();
  const device = entry.config as Partitionable.Device;
  const planned = plannedOn(entry).filter((p) => !p.name);
  const users = usersOf(config, systemDevices, device.name);
  const isBoot = configModel.boot.hasDevice(config, entry.config.name);

  const addPath = generateEncodedPath(PATHS.addPartition, {
    collection: subject.collection,
    index: String(subject.index),
  });

  /* A link, since it leads to a form. */
  const add = (
    <Link to={addPath} keepQuery variant="link" isInline icon={<Icon name="add_circle" />}>
      {_("Add partition")}
    </Link>
  );

  /* Nothing listed yet: what the disk gets so far, then the way to add to it.
     A volume group's partitions, or booting's, come first where the disk
     gets them, since they are all it gets yet. */
  if (!planned.length) {
    if (users.length) {
      return (
        <SummaryWithActions
          summary={<UsedByStatement entry={entry} />}
          // TRANSLATORS: follows what a disk already gets, such as the partitions
          // a volume group needs, above a button to add partitions.
          detail={_("Add partitions to use the rest of the disk.")}
          actions={add}
        />
      );
    }

    if (isBoot) {
      return (
        <SummaryWithActions
          // TRANSLATORS: said of a disk the system boots from where nothing else
          // is planned yet, above a button to add partitions.
          summary={_("Used for booting only, no other partitions planned yet")}
          actions={add}
        />
      );
    }

    return (
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        {/* TRANSLATORS: offered on a disk that gets no partitions yet. */}
        <FlexItem>{_("You can define partitions.")}</FlexItem>
        <FlexItem>{add}</FlexItem>
      </Flex>
    );
  }

  /* Without a volume group to give room to, the list is all there is. */
  const listed = <PlannedContentSection entry={entry} subject={subject} />;
  if (!users.length) return listed;

  /* Two kinds of partitions to create, said side by side: those a volume
     group needs, first, and those listed. */
  return (
    <List>
      <ListItem>
        <UsedByStatement entry={entry} />
      </ListItem>
      <ListItem>
        <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
          <FlexItem>
            {/* TRANSLATORS: introduces the table of partitions the user asked
                to create on a disk, next to those a volume group needs. */}
            {_("Partitions from the following list")}
          </FlexItem>
          <FlexItem>{listed}</FlexItem>
        </Flex>
      </ListItem>
    </List>
  );
}
