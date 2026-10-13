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
import { List, ListItem, Flex, FlexItem } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SheetSection from "~/components/storage/device-sheet/SheetSection";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import UsedByStatement from "~/components/storage/device-sheet/UsedByStatement";
import BootStatement from "~/components/storage/device-sheet/BootStatement";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { usersOf } from "~/components/storage/shared/users";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { DeviceDetailProps } from "~/components/storage/device-sheet/DeviceDetail";

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
}: DeviceDetailProps): React.ReactNode {
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

  const add = (variant: "primary" | "secondary") => (
    <Link to={addPath} keepQuery variant={variant} icon={<Icon name="add" size="xs" />}>
      {_("Add Partition")}
    </Link>
  );

  return (
    <SheetSection
      // TRANSLATORS: heading over the partitions the installer will create in
      // a disk.
      title={_("New partitions to create in the disk")}
    >
      {!!planned.length && !users.length && (
        <PlannedContentSection entry={entry} subject={subject} />
      )}
      {!!users.length && (
        <List>
          <UsedByStatement entry={entry} />
          <ListItem>
            {!!planned.length && (
              <>
                <Text>{_("Partitions from the following list")}</Text>
                <PlannedContentSection entry={entry} subject={subject} />
              </>
            )}
            {!planned.length && (
              <Flex>
                <FlexItem>
                  {users.length || isBoot
                    ? _("You can define additional partitions.")
                    : _("You can define partitions.")}
                </FlexItem>
                <FlexItem>{add("secondary")}</FlexItem>
              </Flex>
            )}
          </ListItem>
        </List>
      )}
      {/* Inside the section: the partitions for booting are new partitions
          too, only ones the reader did not ask for by name. */}
      <BootStatement entry={entry} />
    </SheetSection>
  );
}
