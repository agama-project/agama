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
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  FlexItem,
  Stack,
  StackItem,
} from "@patternfly/react-core";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import RelatedNames from "~/components/storage/shared/RelatedNames";
import RetargetOffer from "~/components/storage/shared/RetargetOffer";
import { usersOf } from "~/components/storage/shared/users";
import {
  filesystemType,
  formattedPath,
  partitionIdLabel,
  sizeDescription,
} from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import configModel from "~/model/storage/config-model";
import {
  useConfigModel,
  useDeleteLogicalVolume,
  useDeletePartition,
} from "~/hooks/model/storage/config-model";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

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
 * What the reader calls one planned thing, which is where it will be mounted.
 *
 * The path bare rather than quoted: quotation marks hold a path apart from the
 * words around it, and a column of paths has no words around it to be held
 * apart from.
 *
 * One asked for by id has no path to be called by, so it is called what it is
 * for. See {@link partitionIdLabel} for the words and for changing them.
 */
function label(part: Planned): string {
  if (part.mountPath) return part.mountPath;

  const id = partitionId(part);
  return id ? partitionIdLabel(id) : "";
}

export type PlannedContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the acts on its parts need. */
  subject: SheetEntry;
};

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
export default function PlannedContentSection({
  entry,
  subject,
}: PlannedContentSectionProps): React.ReactNode {
  const config = useConfigModel();
  const systemDevices = useSystemDevices();
  const deletePartition = useDeletePartition();
  const deleteLogicalVolume = useDeleteLogicalVolume();

  const isVolumeGroup = entry.isVolumeGroup;
  const group = entry.config as ConfigModel.VolumeGroup;
  const device = entry.config as Partitionable.Device;

  const planned = plannedOn(entry);
  /* Read here for the empty state, which says where the device went rather than
     that nothing was asked of it. What is used by what reads above the view, in
     the note's run of statements, rather than as a section of the content. */
  const users = isVolumeGroup ? [] : usersOf(config, systemDevices, device.name);
  /* A device formatted as a whole has nowhere to put a partition, so the view
     drops the table and the offer with it. */
  const whole = isVolumeGroup ? undefined : device.filesystem;

  const addPath = isVolumeGroup
    ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: group.vgName })
    : generateEncodedPath(PATHS.addPartition, {
        collection: subject.collection,
        index: String(subject.index),
      });

  const editPath = (part: Planned) =>
    isVolumeGroup
      ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
          id: group.vgName,
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

  /* TRANSLATORS: adds one more thing for the new system to an entry of the
     installation. "Partition" rather than "volume": what this adds to a disk is
     a partition, and volume is the word the logical ones own. */
  const addLabel = isVolumeGroup ? _("Add logical volume") : _("Add partition");

  const add = (variant: "primary" | "secondary") => (
    <Link to={addPath} keepQuery variant={variant} icon={<Icon name="add" size="xs" />}>
      {addLabel}
    </Link>
  );

  return (
    <Stack hasGutter>
      {whole && (
        <StackItem>
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
        </StackItem>
      )}
      {!whole && planned.length === 0 && (
        <StackItem>
          <EmptyState
            headingLevel="h3"
            variant="sm"
            titleText={
              users.length
                ? // TRANSLATORS: said of a device the installation puts nothing
                  // of its own on because something else is built on it.
                  _("No partitions are planned here")
                : // TRANSLATORS: said of a device of the installation that has
                  // nothing planned on it yet.
                  _("Nothing planned for this device yet")
            }
          >
            <EmptyStateBody>
              {users.length ? (
                <>
                  {/* TRANSLATORS: followed by the names of the entries the whole
                      device is given to. */}
                  {_("The whole device goes to")} <RelatedNames items={users} />
                </>
              ) : (
                // TRANSLATORS: what a reader can do about a device with nothing
                // planned on it.
                _("Add a volume, or reuse one of the partitions already on it.")
              )}
            </EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>{add("primary")}</EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </StackItem>
      )}
      {!whole && planned.length > 0 && (
        <>
          <StackItem>
            <Table
              role="table"
              gridBreakPoint=""
              variant="compact"
              // TRANSLATORS: names the list of what the installation will put on
              // one of its entries.
              aria-label={_("Planned content")}
            >
              {/* Read rather than hidden from sight: a column of sizes and a
                  column of file systems are told apart by what they are called,
                  and a reader who has to work that out from the values is being
                  asked to do the heading's job.

                  Each heading kept whole. PatternFly cuts one down to whatever
                  its column came out as, which shortens the one thing on the
                  row whose whole job is to be read. */}
              <Thead>
                <Tr>
                  <Th modifier="nowrap">{_("Mount point")}</Th>
                  <Th modifier="nowrap">{_("File system")}</Th>
                  <Th className={alignmentStyles.textAlignEnd} modifier="nowrap">
                    {_("Size")}
                  </Th>
                  <Th>
                    {/* The column of menus has nothing to head: a heading over
                        it names a column the reader can already see the point
                        of, and takes the width the sizes beside it need. */}
                    <Text srOnly>{_("Options")}</Text>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {planned.map((part) => {
                  /* A partition already there brings its own file system and
                     size, so they are read from the machine rather than from a
                     request the installer never has to satisfy. */
                  const source = part.name
                    ? entry.device?.partitions?.find((p) => p.name === part.name)
                    : undefined;
                  const keepsData = Boolean(part.name) && part.filesystem?.reuse === true;

                  return (
                    <Tr key={label(part)}>
                      <Th scope="row">{label(part)}</Th>
                      <Td>
                        {(keepsData
                          ? source?.filesystem?.type
                          : part.filesystem && filesystemType(part.filesystem)) ||
                          // TRANSLATORS: said where the installer has not been
                          // told which file system to use.
                          _("default")}
                      </Td>
                      {/* On the same edge as every other size, so a column of
                          them is compared by looking down rather than by
                          reading each one. */}
                      <Td className={alignmentStyles.textAlignEnd}>
                        {part.size
                          ? sizeDescription(part.size)
                          : // TRANSLATORS: said where the size of something the
                            // installer creates is left to it.
                            _("decided by the installer")}
                      </Td>
                      <Td isActionCell>
                        {/* Both acts name the thing by where it is mounted, so
                            one asked for by id alone has neither until the form
                            and the model calls learn to take an id. */}
                        {part.mountPath && (
                          <MenuButton
                            menuProps={{
                              "aria-label": sprintf(
                                // TRANSLATORS: names the menu of things that can
                                // be done to one thing the installation creates.
                                // %s is where the new system mounts it.
                                _("Actions for %s"),
                                label(part),
                              ),
                              popperProps: { position: "end" },
                            }}
                            customToggle={
                              <RowMenuToggle label={sprintf(_("Actions for %s"), label(part))} />
                            }
                            items={[
                              <MenuButtonItem key="edit" to={editPath(part)} keepQuery>
                                {_("Edit")}
                              </MenuButtonItem>,
                              <MenuButtonItem
                                key="delete"
                                /* Dropping the plan for a partition that is
                                   already there removes the plan, not the
                                   partition, so it is not offered as a danger
                                   and is not called a deletion. */
                                isDanger={!source}
                                onClick={() => remove(part.mountPath)}
                              >
                                {source
                                  ? // TRANSLATORS: offered on a partition the
                                    // installation takes over: leave it where
                                    // it is and stop giving it to the new
                                    // system.
                                    _("Stop reusing")
                                  : // TRANSLATORS: offered on something the
                                    // installation would create: take it out of
                                    // the plan.
                                    _("Delete")}
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
          </StackItem>
          <StackItem>
            {/* After the table rather than in the header: these are what the
                reader does about the device rather than about any one row, and
                neither is urgent enough to sit beside its name.

                Beside a table that already lists what is planned, adding is one
                option among several rather than the point of the view. And
                moving the plan is offered only here, where there is something
                to move: under a view that has just said nothing is planned, it
                would promise the move of nothing. */}
            <Flex gap={{ default: "gapSm" }} flexWrap={{ default: "wrap" }}>
              <FlexItem>{add("secondary")}</FlexItem>
              {!isVolumeGroup && (
                <FlexItem>
                  <RetargetOffer entry={device} device={entry.device} variant="secondary" />
                </FlexItem>
              )}
            </Flex>
          </StackItem>
        </>
      )}
    </Stack>
  );
}
