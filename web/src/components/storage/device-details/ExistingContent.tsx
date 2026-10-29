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
import { Flex, FlexItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import DetailsItem from "~/components/storage/device-details/DetailsItem";
import { baseName, filesystemLabel } from "~/components/storage/utils";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";

export type ExistingContentProps = {
  entry: Entry;
  /** Whether the installation deletes what is on the device. */
  isDeleted?: boolean;
  /** Controls offered under the item, such as mounting the file system. */
  actions?: React.ReactNode;
};

/**
 * What a device without partitions holds today, as one item: a file system on
 * the whole device, its membership of an LVM volume group or a RAID, or a line
 * saying nothing was found.
 *
 * Where the installation deletes it, it is followed by "Delete", the way the
 * partitions table says it.
 *
 * @example
 * <ExistingContent entry={entry} isDeleted />
 * // Ext4 file system  Delete
 */
/* The same color as the partitions table, so a loss reads the same in both. */
const DESTROYS_CLASS = "agm-entries-table__cost--destroys";

/**
 * What is there now, followed by "Delete" where the installation removes it,
 * the way the partitions table says it.
 */
function Fact({ isDeleted, children }: React.PropsWithChildren<{ isDeleted: boolean }>) {
  if (!isDeleted) return children;

  return (
    <>
      {children}{" "}
      {/* TRANSLATORS: follows what is on the disk today, such as "Ext4 file
          system": it is removed, and everything on it lost. */}
      <span className={DESTROYS_CLASS}>{_("to be deleted")}</span>
    </>
  );
}

export default function ExistingContent({
  entry,
  isDeleted = false,
  actions,
}: ExistingContentProps) {
  const systemDevices = useSystemDevices();
  const device = entry.device;

  const controls = actions && <FlexItem>{actions}</FlexItem>;

  if (device?.filesystem) {
    const type = filesystemLabel(device.filesystem.type);

    /* The type first and in bold, since it is what tells one file system from
       another. One line, with what can be done to it right after: the
       section's icon already marks what the line is about. */
    return (
      <Flex gap={{ default: "gapSm" }} alignItems={{ default: "alignItemsBaseline" }}>
        <FlexItem>
          <Fact isDeleted={isDeleted}>
            <Interpolate
              // TRANSLATORS: a file system found on a whole device. %s is its
              // type, such as "Ext4", shown in bold.
              sentence={_("%s file system")}
            >
              {() => <Text isBold>{type}</Text>}
            </Interpolate>
          </Fact>
        </FlexItem>
        {controls}
      </Flex>
    );
  }

  const group =
    device && systemDevices.find((d) => d.volumeGroup?.physicalVolumes.includes(device.sid));
  if (group) {
    return (
      <DetailsItem
        icon="stacks"
        // TRANSLATORS: names the volume management a device takes part in.
        name={_("LVM")}
        value={
          <Fact isDeleted={isDeleted}>
            {
              // TRANSLATORS: what a device is today. %s is the name of the LVM
              // volume group it belongs to, such as "system".
              sprintf(_("physical volume of %s"), baseName(group.name))
            }
          </Fact>
        }
      >
        {controls}
      </DetailsItem>
    );
  }

  const raid = device && systemDevices.find((d) => d.md?.devices.includes(device.sid));
  if (raid) {
    return (
      <DetailsItem
        icon="dns"
        // TRANSLATORS: names the RAID a device takes part in.
        name={_("RAID")}
        value={
          <Fact isDeleted={isDeleted}>
            {
              // TRANSLATORS: what a device is today. %s is the name of the RAID
              // it belongs to, such as "md0".
              sprintf(_("member of %s"), baseName(raid.name))
            }
          </Fact>
        }
      >
        {controls}
      </DetailsItem>
    );
  }

  // TRANSLATORS: said of a device where nothing was found: no partitions, no
  // file system, no volume group or RAID.
  return <p>{_("No content detected.")}</p>;
}
