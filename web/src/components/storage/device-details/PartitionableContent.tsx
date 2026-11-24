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
import { Divider, Flex, FlexItem } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import Link from "~/components/core/Link";
import PlannedContentSection from "~/components/storage/device-details/PlannedContentSection";
import UsedByStatement from "~/components/storage/device-details/UsedByStatement";
import BootStatement from "~/components/storage/device-details/BootStatement";
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

/** A partition or logical volume planned for the new system. */
type Planned = ConfigModel.Partition | ConfigModel.LogicalVolume;

/**
 * Returns the partition id, if any: some partitions (a BIOS boot one, for
 * example) are requested by id instead of by mount point. Logical volumes
 * have none.
 */
function partitionId(part: Planned): ConfigModel.PartitionId | undefined {
  return "id" in part ? part.id : undefined;
}

/**
 * Returns what is planned on the entry, new or reused. Reused ones count too,
 * so a device that only mounts an existing partition does not look empty.
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
 * Explains how the new system uses a disk on which it creates or reuses
 * partitions: one paragraph per role (LVM, requested partitions, booting), in
 * that order, followed by one line of actions. Paragraphs rather than a list,
 * since the roles are different kinds of information.
 */
export default function PartitionableContent({
  entry,
  subject,
}: DeviceDetailsBodyProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();
  const device = entry.config as Partitionable.Device;
  const hasPlanned = plannedOn(entry).length > 0;
  const users = usersOf(config, systemDevices, device.name);
  const isBoot = configModel.boot.hasDevice(config, entry.config.name);
  // TRANSLATORS: introduces the table of partitions planned on a disk.
  const caption = _("Partitions from the following list will be configured during installation");

  if (!users.length && !isBoot)
    return <PlannedContentSection entry={entry} subject={subject} caption={caption} />;

  const addPath = generateEncodedPath(PATHS.addPartition, {
    collection: subject.collection,
    index: String(subject.index),
  });

  const changeBoot = isBoot && (
    <Link to={PATHS.editBootDevice} keepQuery variant="link" isInline>
      {/* TRANSLATORS: link to the settings of how the new system boots. */}
      {_("Change boot options")}
    </Link>
  );

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      {!!users.length && (
        <FlexItem className="agm-statement">
          <p>
            <UsedByStatement entry={entry} />
          </p>
        </FlexItem>
      )}
      {hasPlanned && (
        <FlexItem className="agm-statement">
          <PlannedContentSection
            entry={entry}
            subject={subject}
            caption={caption}
            footer={isBoot && <BootStatement entry={entry} />}
            extraActions={changeBoot}
          />
        </FlexItem>
      )}
      {!hasPlanned && isBoot && (
        <FlexItem className="agm-statement">
          <p>
            <BootStatement entry={entry} />
          </p>
        </FlexItem>
      )}
      {!hasPlanned && (
        <FlexItem className={spacingStyles.mtSm}>
          {/* A line where reading the plan ends and acting on it starts, as
              under a table of partitions, with the same room above it. */}
          <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
            <Divider />
            <Flex gap={{ default: "gapLg" }} alignItems={{ default: "alignItemsCenter" }}>
              <FlexItem>
                <Link to={addPath} keepQuery variant="link" isInline>
                  {_("Add partition")}
                </Link>
              </FlexItem>
              {changeBoot && <FlexItem>{changeBoot}</FlexItem>}
            </Flex>
          </Flex>
        </FlexItem>
      )}
    </Flex>
  );
}
