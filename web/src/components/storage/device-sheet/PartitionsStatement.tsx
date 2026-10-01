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
import { Stack, StackItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import PlannedContentSection from "~/components/storage/device-sheet/PlannedContentSection";
import { usersOf } from "~/components/storage/shared/users";
import { filesystemType, formattedPath } from "~/components/storage/utils";
import Statement from "~/components/storage/device-sheet/Statement";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { PlannedContentSectionProps } from "~/components/storage/device-sheet/PlannedContentSection";

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

/**
 * What the new system will get on this entry.
 *
 * The plan rather than the outcome: what the reader asked the installer for
 * here, as against what it worked out, which the first view holds.
 *
 * What has no row to live in is said above the view rather than here, among the
 * note's statements: a fact about the device and a list of what is planned on
 * it are two kinds of thing, and a view that opens the second with the first
 * reads as content that starts twice.
 *
 * Where nothing is planned, the state says so and carries the one act that
 * changes it. An empty state and a lone button underneath it are the same offer
 * made twice. Moving the plan elsewhere is not offered here either: under a view
 * that has just said there is nothing here, moving nothing is not an act the
 * reader can want.
 */
export default function PartitionsStatement({
  entry,
  subject,
}: PlannedContentSectionProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();

  const isVolumeGroup = entry.isVolumeGroup;
  const device = entry.config as Partitionable.Device;

  const planned = plannedOn(entry);
  /* Read here for the empty state, which says where the device went rather than
     that nothing was asked of it. What is used by what reads above the view, in
     the note's run of statements, rather than as a section of the content. */
  const users = isVolumeGroup ? [] : usersOf(config, systemDevices, device.name);
  /* A device formatted as a whole has nowhere to put a partition, so the view
     drops the table and the offer with it. */
  const whole = isVolumeGroup ? undefined : device.filesystem;
  const isBoot = configModel.boot.hasDevice(config, entry.config.name);

  const addPath = generateEncodedPath(PATHS.addPartition, {
    collection: subject.collection,
    index: String(subject.index),
  });

  /* TRANSLATORS: adds one more thing for the new system to an entry of the
     installation. "Partition" rather than "volume": what this adds to a disk is
     a partition, and volume is the word the logical ones own. */
  const addLabel = isVolumeGroup ? _("Add logical volume") : _("Add partition");

  const add = (variant: "primary" | "secondary") => (
    <Link to={addPath} keepQuery variant={variant} icon={<Icon name="add" size="xs" />}>
      {addLabel}
    </Link>
  );

  /*
   * whole => directly formatted
   * planned => partitions
   * users => LVM including this at targetDevice
   * isBoot => used for booting
   *
   *
   * if whole
   *   Info about it
   * else
   *   if users || isBoot
   *     if planned
   *       Additionally, the following partitions
   *     else
   *       You can create additional [button]
   *   else
   *     if planned
   *       Following partitions
   *     else
   *       EmptyState can whole or partition
   *     end
   *   end
   * end
   *
   *
   *
   * if whole
   *   Info about it
   * else
   *   if !planned
   *     if users || isBoot
   *       You can create additional [button]
   *     else
   *       EmptyState can whole or partition
   *     end
   *   else
   *     if users || isBoot
   *       Additionally, the following partitions
   *     else
   *       Following partitions
   *     end
   *   end
   * end
   */

  return (
    <>
      {whole && (
        <Text textStyle="textColorSubtle">
          {device.mountPath
            ? sprintf(
                // TRANSLATORS: said of a device the installation formats as a
                // whole. %1$s is a file system type such as "Btrfs", %2$s is
                // where the new system mounts it, such as "/home".
                _("This device is formatted as %1$s and mounted at %2$s."),
                filesystemType(whole) || _("its default file system"),
                formattedPath(device.mountPath),
              )
            : sprintf(
                // TRANSLATORS: said of a device the installation formats as a
                // whole without mounting it. %s is a file system type.
                _("This device is formatted as %s and is not mounted."),
                filesystemType(whole) || _("its default file system"),
              )}
        </Text>
      )}
      {!whole && !planned.length && (users.length || isBoot) && (
        <Statement icon="list_alt" heading={_("No additional partitions defined")}>
          <Stack hasGutter>
            <StackItem>
              {_(
                "You can define additional partitions or reuse any of the partitions already on the disk.",
              )}
            </StackItem>
            <StackItem>{add("secondary")}</StackItem>
          </Stack>
        </Statement>
      )}
      {!whole && planned.length > 0 && (
        <Statement icon="list_alt" heading={_("Partitions from the following list")}>
          <PlannedContentSection entry={entry} subject={subject} />
        </Statement>
      )}
    </>
  );
}
