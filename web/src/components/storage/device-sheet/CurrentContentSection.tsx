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
import { Flex, FlexItem, Label, Stack, StackItem } from "@patternfly/react-core";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import { outcomeOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize, formattedPath } from "~/components/storage/utils";
import { _, TranslatedString } from "~/i18n";
import type DevicesManager from "~/model/storage/devices-manager";
import type { Outcome } from "~/components/storage/shared/consequences";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Storage as System } from "~/model/system";

type FreeSpace = System.UnusedSlot;
type Row = System.Device | FreeSpace;

const isFreeSpace = (row: Row): row is FreeSpace => !("sid" in row);

/**
 * What is on the device today, in the order it sits there, free space included.
 *
 * Free space is a row: "keep everything" is a choice with no visible evidence
 * behind it otherwise.
 */
function rowsOf(entry: Entry): Row[] {
  const device = entry.device;
  if (!device) return [];
  if (entry.isVolumeGroup) return device.logicalVolumes || [];

  const parts: [number, Row][] = (device.partitions || []).map((p) => [p.block?.start || 0, p]);
  const free: [number, Row][] = (device.partitionTable?.unusedSlots || []).map((s) => [s.start, s]);

  return [...parts, ...free].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/** How a planned action reads, and whether it loses anything. */
type Report = { text: TranslatedString; kind: "destroys" | "shrinks" | "keeps" };

/**
 * What the installer will do to one partition, in words a reader can check
 * against what they meant.
 *
 * In the future tense, because nothing has happened yet, and the column is the
 * last place to suggest otherwise. What it is kept or emptied for is named
 * where the configuration says, since "to be formatted" alone does not say for
 * what.
 */
function reportFor(outcome: Outcome, reusedAs?: string): Report {
  switch (outcome) {
    case "deleted":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: remove it and everything on it.
      return { kind: "destroys", text: _("To be deleted") };
    case "formatted":
      return {
        kind: "destroys",
        text: reusedAs
          ? sprintf(
              // TRANSLATORS: what the installation will do to a partition
              // already on the disk: empty it and mount it for the new system.
              // %s is where, such as "/home".
              _("To be formatted as %s"),
              reusedAs,
            )
          : // TRANSLATORS: what the installation will do to a partition already
            // on the disk: empty it.
            _("To be formatted"),
      };
    case "shrunk":
      // TRANSLATORS: what the installation will do to a partition already on
      // the disk: make it smaller, keeping what is on it.
      return { kind: "shrinks", text: _("To be shrunk") };
    case "kept":
      return {
        kind: "keeps",
        text: reusedAs
          ? sprintf(
              // TRANSLATORS: what the installation will do to a partition already
              // on the disk: keep it and its data, and mount it for the new
              // system. %s is where, such as "/home".
              _("To be reused as %s"),
              reusedAs,
            )
          : // TRANSLATORS: what the installation will do to a partition already
            // on the disk: nothing.
            _("Kept"),
      };
  }
}

const REPORT_ICON = { destroys: "error_fill", shrinks: "compress" } as const;
const REPORT_CLASS = {
  destroys: "agm-entries-table__cost--destroys",
  shrinks: "agm-entries-table__cost--shrinks",
} as const;

function PartitionRow({
  part,
  manager,
  entries,
}: {
  part: System.Device;
  manager: DevicesManager;
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
}) {
  const outcome = outcomeOf(manager, part);
  const reusedAs = entries.find((e) => e.name === part.name)?.mountPath;
  const report = reportFor(outcome, reusedAs && formattedPath(reusedAs));
  const systems = part.block?.systems || [];
  const size = part.block?.size;
  const shrunkTo = outcome === "shrunk" ? manager.stagingDevice(part.sid)?.block?.size : undefined;

  return (
    <Tr>
      <Th scope="row">
        <Text isBold>{baseName(part.name)}</Text>
        {part.block?.encrypted && (
          <>
            {" "}
            {/* TRANSLATORS: marks a partition whose content is encrypted. */}
            <Icon name="lock" size="xs" aria-label={_("encrypted")} />
          </>
        )}
      </Th>
      {/* What is on it. What becomes of it is two columns on, so it is not said
          here too. A system the machine reports sits beside the file system as
          a mark: naming Windows is what makes a deletion mean something. */}
      <Td>
        <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem>
            {part.filesystem?.type ||
              part.description ||
              // TRANSLATORS: said of a partition whose content is not recognized.
              _("unrecognized")}
          </FlexItem>
          {systems.map((system) => (
            <FlexItem key={system}>
              <Label isCompact>{system}</Label>
            </FlexItem>
          ))}
        </Flex>
      </Td>
      {/* The size it ends at where a shrink is planned, with the size it has
          today under it: the change beside the value it changes. */}
      <Td>
        {shrunkTo !== undefined ? (
          <>
            <div>{deviceSize(shrunkTo)}</div>
            {size !== undefined && (
              <div className="agm-row-note">
                {sprintf(
                  // TRANSLATORS: under the size a partition ends up with. %s is
                  // the size it has today, such as "3 GiB".
                  _("Shrunk from %s"),
                  deviceSize(size),
                )}
              </div>
            )}
          </>
        ) : (
          size !== undefined && deviceSize(size)
        )}
      </Td>
      <Td>
        {report.kind === "keeps" ? (
          report.text
        ) : (
          <Flex
            gap={{ default: "gapXs" }}
            alignItems={{ default: "alignItemsFlexStart" }}
            flexWrap={{ default: "nowrap" }}
            className={REPORT_CLASS[report.kind]}
          >
            <FlexItem>
              <Icon name={REPORT_ICON[report.kind]} size="xs" aria-hidden />
            </FlexItem>
            <FlexItem>{report.text}</FlexItem>
          </Flex>
        )}
      </Td>
    </Tr>
  );
}

export type CurrentContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the space decision acts on. */
  subject: SheetEntry;
};

/**
 * What is on the device today, and what the installation will do to it.
 *
 * The one view where a reader can see the whole answer partition by partition
 * rather than as a summary. The decision reads above the table it governs,
 * since it is about the rows below it; and it is a permission rather than an
 * instruction, which is why a column says what the installer will actually do.
 *
 * @fixme The playground also decides one partition at a time here, and offers
 *  to reuse a partition for the new system. Both wait on the design owner: the
 *  first writes to the configuration in ways the page has no hook for, and the
 *  second needs a route the partition form does not read.
 */
export default function CurrentContentSection({
  entry,
  subject,
}: CurrentContentSectionProps): React.ReactNode {
  const manager = useDevicesManager();
  const rows = rowsOf(entry);
  const entries = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];

  return (
    <Stack hasGutter>
      {subject.collection !== "volumeGroups" && rows.some((row) => !isFreeSpace(row)) && (
        <StackItem>
          <SpaceDecision collection={subject.collection} index={subject.index} />
        </StackItem>
      )}
      {rows.length === 0 ? (
        <StackItem>
          <Text textStyle="textColorSubtle">
            {/* TRANSLATORS: said of a device with nothing on it. */}
            {_("The device is empty.")}
          </Text>
        </StackItem>
      ) : (
        <StackItem>
          <Table
            role="table"
            gridBreakPoint=""
            variant="compact"
            // TRANSLATORS: names the list of what is on a device already.
            aria-label={_("Current content")}
          >
            <Thead className={a11yStyles.screenReader}>
              <Tr>
                <Th>{_("Partition")}</Th>
                <Th>{_("Content")}</Th>
                <Th>{_("Size")}</Th>
                {/* "Planned action" rather than "What happens": nothing has
                    happened yet. */}
                <Th>{_("Planned action")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row, at) =>
                isFreeSpace(row) ? (
                  <Tr key={`free-${at}`}>
                    <Th scope="row">
                      <Text textStyle="textColorSubtle">
                        {/* TRANSLATORS: a row for room on a device that no
                            partition takes. */}
                        {_("Free space")}
                      </Text>
                    </Th>
                    <Td />
                    <Td>{deviceSize(row.size)}</Td>
                    <Td />
                  </Tr>
                ) : (
                  <PartitionRow key={row.sid} part={row} manager={manager} entries={entries} />
                ),
              )}
            </Tbody>
          </Table>
        </StackItem>
      )}
    </Stack>
  );
}
