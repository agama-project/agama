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
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { Flex, FlexItem, Stack, StackItem } from "@patternfly/react-core";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import { formattedPath, sizeDescription } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/partition";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeleteLogicalVolume, useDeletePartition } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

/** One thing the new system gets here, whatever the entry calls its parts. */
type Planned = ConfigModel.Partition | ConfigModel.LogicalVolume;

export type PlannedContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the acts on its parts need. */
  subject: SheetEntry;
};

/**
 * What the new system will get on this entry.
 *
 * The plan rather than the outcome: what the reader asked the installer for
 * here, as against what it worked out, which the first view holds. Only things
 * the new system mounts are listed; a partition that exists only to say what
 * may happen to what is already there belongs to what is here today.
 *
 * Where nothing is planned, the section says so and offers the one act that
 * changes it. "Use another device" is not offered here: under a view that has
 * just said nothing is planned, moving nothing somewhere else is not an act the
 * reader can want.
 */
export default function PlannedContentSection({
  entry,
  subject,
}: PlannedContentSectionProps): React.ReactNode {
  const deletePartition = useDeletePartition();
  const deleteLogicalVolume = useDeleteLogicalVolume();

  const isVolumeGroup = entry.isVolumeGroup;
  const group = entry.config as ConfigModel.VolumeGroup;
  const device = entry.config as Partitionable.Device;

  const planned: Planned[] = (
    isVolumeGroup ? group.logicalVolumes || [] : device.partitions || []
  ).filter((part) => part.mountPath);

  const addPath = isVolumeGroup
    ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: group.vgName })
    : generateEncodedPath(PATHS.addPartition, {
        collection: subject.collection,
        index: String(subject.index),
      });

  const editPath = (mountPath: string) =>
    isVolumeGroup
      ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
          id: group.vgName,
          logicalVolumeId: mountPath,
        })
      : generateEncodedPath(PATHS.editPartition, {
          collection: subject.collection,
          index: String(subject.index),
          partitionId: mountPath,
        });

  const remove = (mountPath: string) => {
    if (isVolumeGroup) {
      deleteLogicalVolume(group.vgName, mountPath);
      return;
    }

    if (subject.collection === "volumeGroups") return;

    deletePartition(subject.collection, subject.index, mountPath);
  };

  return (
    <Stack hasGutter>
      <StackItem>
        <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
          {/* TRANSLATORS: says what this view of a device holds: what the
              installation will put on it. */}
          {_("For the new system")}
        </Text>
      </StackItem>
      {planned.length > 0 && (
        <StackItem>
          <Table role="table" gridBreakPoint="" variant="compact" aria-label={_("Planned content")}>
            <Thead className={a11yStyles.screenReader}>
              <Tr>
                <Th>{_("Mount point")}</Th>
                <Th>{_("Details")}</Th>
                <Th>{_("Size")}</Th>
                <Th>{_("Options")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {planned.map((part) => (
                <Tr key={part.mountPath}>
                  <Th scope="row">{formattedPath(part.mountPath)}</Th>
                  <Td>{typeDescription(part)}</Td>
                  <Td>{sizeDescription(part.size)}</Td>
                  <Td isActionCell>
                    <MenuButton
                      menuProps={{
                        "aria-label": sprintf(
                          // TRANSLATORS: names the menu of things that can be
                          // done to one thing the installation will create.
                          // %s is where the new system mounts it, such as "/".
                          _("Actions for %s"),
                          formattedPath(part.mountPath),
                        ),
                        popperProps: { position: "end" },
                      }}
                      customToggle={
                        <RowMenuToggle
                          label={sprintf(_("Actions for %s"), formattedPath(part.mountPath))}
                        />
                      }
                      items={[
                        <MenuButtonItem key="edit" to={editPath(part.mountPath)} keepQuery>
                          {_("Edit")}
                        </MenuButtonItem>,
                        <MenuButtonItem
                          key="delete"
                          isDanger
                          onClick={() => remove(part.mountPath)}
                        >
                          {_("Delete")}
                        </MenuButtonItem>,
                      ]}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </StackItem>
      )}
      {planned.length === 0 && (
        <StackItem>
          <Text textStyle="textColorSubtle">
            {/* TRANSLATORS: said where the installation puts nothing of its own
                on a device it is nonetheless using. */}
            {_("The installation puts nothing of its own here.")}
          </Text>
        </StackItem>
      )}
      <StackItem>
        <Flex>
          <FlexItem>
            <Link to={addPath} keepQuery variant="secondary">
              {isVolumeGroup
                ? // TRANSLATORS: offered inside a volume group's panel: give the
                  // new system another logical volume on it.
                  _("Add logical volume")
                : // TRANSLATORS: offered inside a device's panel: give the new
                  // system another partition on it.
                  _("Add partition")}
            </Link>
          </FlexItem>
        </Flex>
      </StackItem>
    </Stack>
  );
}
