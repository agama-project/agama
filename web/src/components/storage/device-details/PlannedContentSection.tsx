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
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/core/RowMenuToggle";
import {
  baseName,
  filesystemType,
  partitionIdLabel,
  formattedPath,
  sizeDescription,
} from "~/components/storage/utils";
import { useDetailsSectionTitleId } from "~/components/storage/device-details/DetailsSection";
import { partitionId, plannedOn } from "~/components/storage/device-details/planned";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { columnProps, tableProps } from "~/components/storage/shared/table-columns";
import { useDeleteLogicalVolume, useDeletePartition } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { ColumnLook } from "~/components/storage/shared/table-columns";
import type { Planned } from "~/components/storage/device-details/planned";
import Icon from "~/components/layout/Icon";

/* Sizes are end-aligned, so they compare at a glance. */
const COLUMNS = {
  path: {},
  filesystem: {},
  action: {},
  size: { isEndAligned: true },
} satisfies Record<string, ColumnLook>;

/**
 * Returns the text that names a planned item in the table: its mount point, or
 * what it is for when requested by id (see {@link partitionIdLabel}). Paths go
 * without quotes, since a column of them has no text around to set them apart.
 */
function label(part: Planned): string {
  if (part.mountPath) return part.mountPath;

  const id = partitionId(part);
  return id ? partitionIdLabel(id) : "";
}

export type PlannedContentSectionProps = {
  entry: Entry;
  /** Where the entry is in the storage configuration, used to edit or delete its parts. */
  subject: DetailsSubject;
  /** Whether every other row of the table is shaded. Off by default. */
  isStriped?: boolean;
};

/**
 * Table of what the user planned for the new system on a device: partitions on
 * a disk, or logical volumes in a volume group.
 *
 * It shows the plan as requested, not the final layout the installer computes
 * from it.
 *
 * Screen readers name the table after the title of the section it is in. If
 * that title stops describing the table, give the table a visually hidden
 * caption instead.
 */
export default function PlannedContentSection({
  entry,
  subject,
  isStriped = false,
}: PlannedContentSectionProps): React.ReactNode {
  const deletePartition = useDeletePartition();
  const deleteLogicalVolume = useDeleteLogicalVolume();

  const titleId = useDetailsSectionTitleId();

  const isVolumeGroup = entry.isVolumeGroup;
  const group = entry.config as ConfigModel.VolumeGroup;

  const planned = plannedOn(entry);

  const editPath = (part: Planned) =>
    isVolumeGroup
      ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
          id: String(subject.index),
          logicalVolumeId: part.mountPath,
        })
      : generateEncodedPath(PATHS.editPartition, {
          collection: subject.collection,
          index: String(subject.index),
          partitionId: part.mountPath,
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
    <Table
      role="table"
      gridBreakPoint=""
      variant="compact"
      isStriped={isStriped}
      {...tableProps({ hasVerticallyCenteredRows: true })}
      aria-labelledby={titleId}
      // TRANSLATORS: name of a table of partitions or logical volumes for the new system
      aria-label={titleId ? undefined : _("Planned content")}
    >
      {/* nowrap keeps headings whole: PatternFly would truncate them. */}
      <Thead>
        <Tr>
          <Th {...columnProps(COLUMNS.path)} modifier="nowrap">
            {_("Path")}
          </Th>
          <Th {...columnProps(COLUMNS.filesystem)} modifier="nowrap">
            {_("File system")}
          </Th>
          <Th {...columnProps(COLUMNS.action)} modifier="nowrap">
            {_("Action")}
          </Th>
          <Th {...columnProps(COLUMNS.size)} modifier="nowrap">
            {_("Size")}
          </Th>
          <Th>
            {/* Hidden from sight, to leave its width to the sizes. */}
            <Text srOnly>{_("Options")}</Text>
          </Th>
        </Tr>
      </Thead>
      <Tbody>
        {planned.map((part) => {
          /* A reused partition shows its current file system and size. */
          const source = part.name
            ? entry.device?.partitions?.find((p) => p.name === part.name)
            : undefined;
          const keepsData = Boolean(part.name) && part.filesystem?.reuse === true;

          return (
            <Tr key={label(part)}>
              <Th scope="row" {...columnProps(COLUMNS.path)}>
                {label(part)}
              </Th>
              <Td {...columnProps(COLUMNS.filesystem)}>
                {keepsData
                  ? source?.filesystem?.type
                  : part.filesystem && filesystemType(part.filesystem)}
              </Td>
              <Td {...columnProps(COLUMNS.action)}>
                {source
                  ? sprintf(
                      // TRANSLATORS: %s is the short-name of a partition, like sda3
                      keepsData ? _("Mount %s") : _("Format %s"),
                      baseName(source.name, { truncate: true }),
                    )
                  : isVolumeGroup
                    ? sprintf(
                        // TRANSLATORS: refers to an LVM logical volume, %s is its name
                        _("Create volume %s"),
                        formattedPath((part as ConfigModel.LogicalVolume).lvName),
                      )
                    : _("Create partition")}
              </Td>
              <Td {...columnProps(COLUMNS.size)}>{sizeDescription(part.size)}</Td>
              <Td isActionCell>
                {/* Edit and delete need a mount point: items requested by id get no menu. */}
                {part.mountPath && (
                  <MenuButton
                    menuProps={{
                      "aria-label": sprintf(
                        // TRANSLATORS: %s is a mount point, like /home
                        _("Actions for %s"),
                        label(part),
                      ),
                      popperProps: { position: "end" },
                    }}
                    customToggle={
                      <RowMenuToggle label={sprintf(_("Actions for %s"), label(part))} size="sm" />
                    }
                    items={[
                      <MenuButtonItem
                        key="edit"
                        icon={<Icon size="md" name="edit_square" />}
                        to={editPath(part)}
                        keepQuery
                      >
                        {_("Edit")}
                      </MenuButtonItem>,
                      <MenuButtonItem
                        key="delete"
                        icon={<Icon size="md" name={source ? "link_off" : "delete"} />}
                        /* For a reused partition, only the plan goes away. */
                        isDanger={!source}
                        onClick={() => remove(part.mountPath)}
                      >
                        {source ? _("Stop reusing") : _("Delete")}
                      </MenuButtonItem>,
                    ]}
                  />
                )}
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
