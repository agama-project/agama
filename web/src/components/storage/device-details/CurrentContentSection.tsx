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

import React, { useEffect, useId, useRef } from "react";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { Button, Divider, Flex, FlexItem, Label } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import DataLoss from "~/components/storage/shared/DataLoss";
import SpaceDecision from "~/components/storage/device-details/SpaceDecision";
import { buildCurrentContentSummary } from "~/components/storage/device-details/current-content-summary";
import Interpolate, { markerText } from "~/components/core/Interpolate";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/core/RowMenuToggle";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeletePartition } from "~/hooks/model/storage/config-model";
import { useAnnounce } from "~/context/announcer";
import {
  decisionOf,
  decisionUnder,
  recoverableBy,
  usePartitionSpaceItems,
} from "~/components/storage/device-details/partition-space";
import { baseName, deviceSize, formattedPath } from "~/components/storage/utils";
import { useSearchParamTokens } from "~/hooks/use-search-param-state";
import { columnProps, tableProps } from "~/components/storage/shared/table-columns";
import { CURRENT_CONTENT, EXPANDED } from "~/components/storage/ui-state-params";
import { _, n_ } from "~/i18n";
import type { Decision } from "~/components/storage/device-details/partition-space";
import type { ContentPart } from "~/components/storage/device-details/current-content-summary";
import type { ConfigModel, DeviceCollection, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { Storage as System } from "~/model/system";
import type { ColumnLook } from "~/components/storage/shared/table-columns";
import type { TranslatedString } from "~/i18n";

type FreeSpace = System.UnusedSlot;
type Row = System.Device | FreeSpace;

const isFreeSpace = (row: Row): row is FreeSpace => !("sid" in row);

/**
 * What is on the device today, in disk order. Free space is a row too, so
 * "keep everything" has something visible behind it.
 */
function rowsOf(entry: Entry): Row[] {
  const device = entry.device;
  if (!device) return [];
  if (entry.isVolumeGroup) return device.logicalVolumes || [];

  const parts: [number, Row][] = (device.partitions || []).map((p) => [p.block?.start || 0, p]);
  const free: [number, Row][] = (device.partitionTable?.unusedSlots || []).map((s) => [s.start, s]);

  return [...parts, ...free].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/**
 * Whether the device will contain partitions or logical volumes.
 *
 * TODO: this is COMPLETELY misplaced here.
 */
export function hasCurrentContent(entry: Entry): boolean {
  return rowsOf(entry).length > 0;
}

/**
 * Everything that can be done to one partition already on the device: its
 * space decision and, on disks, whether the new system reuses it, with a
 * divider between the two. Empty when there is nothing to offer.
 */
function PartitionMenu({
  part,
  reusedAs,
  governed,
  entries,
  collection,
  index,
  canDecide = true,
  rule,
}: {
  part: System.Device;
  /** Whether what happens to it can be decided here, or is fixed for it. */
  canDecide?: boolean;
  /** What the device's own rule allows every partition, where it has one. */
  rule?: Decision;
  /** Where the new system mounts it already, where it does. */
  reusedAs?: string;
  /** Every partition that decision governs, which it is written back with. */
  governed: System.Device[];
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  collection: DeviceCollection;
  index: number;
}) {
  const deletePartition = useDeletePartition();
  const name = baseName(part.name);
  // TRANSLATORS: %s is a partition name, like "vda2"
  const menuLabel = sprintf(_("Actions for %s"), name);
  const at = { collection, index: String(index) };
  /* Called on every row, since hooks cannot be conditional, but used only
     where the row decides. */
  const spaceItems = usePartitionSpaceItems({
    partition: part,
    governed,
    entries,
    collection,
    index,
    rule,
  });

  let reuseItems: React.ReactNode[] = [];
  /* Only on disks: logical volumes cannot be reused. */
  if (collection !== "volumeGroups") {
    reuseItems = reusedAs
      ? [
          <MenuButtonItem
            key="edit"
            icon={<Icon size="md" name="edit_square" />}
            to={generateEncodedPath(PATHS.editPartition, { ...at, partitionId: reusedAs })}
            keepQuery
          >
            {_("Modify how the partition is used")}
          </MenuButtonItem>,
          <MenuButtonItem
            key="stop"
            icon={<Icon size="md" name="link_off" />}
            onClick={() => deletePartition(collection, index, reusedAs)}
          >
            {/* TRANSLATORS: on a partition the new system reuses: stop reusing it */}
            {_("Stop using")}
          </MenuButtonItem>,
        ]
      : [
          <MenuButtonItem
            key="reuse"
            icon={<Icon size="md" name="create_new_folder" />}
            to={generateEncodedPath(PATHS.reusePartition, { ...at, deviceName: part.name })}
            keepQuery
            description={_("Used by the new system, keeping or deleting data.")}
          >
            {/* TRANSLATORS: keep the ellipsis: it says a form follows */}
            {_("Assign a mount point…")}
          </MenuButtonItem>,
        ];
  }

  /* The space decision first, as the row says it. */
  const decisions = reusedAs || !canDecide ? [] : spaceItems;
  const items = [
    ...decisions,
    ...(decisions.length && reuseItems.length ? [<Divider key="rule" component="li" />] : []),
    ...reuseItems,
  ];

  if (!items.length) return null;

  return (
    <MenuButton
      menuProps={{ "aria-label": menuLabel, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={menuLabel} size="sm" />}
      items={items}
    />
  );
}

/* Content and size stay on one line; the action takes the rest and may wrap.
   A rule sets the action apart from what is there today. */
const COLUMNS = {
  partition: { modifier: "nowrap" },
  content: { modifier: "fitContent" },
  size: { modifier: "fitContent", isEndAligned: true },
  action: { hasBorderBefore: true },
} satisfies Record<string, ColumnLook>;

/**
 * What becomes of one partition, whether that loses data, and an optional
 * note shown under it.
 */
type Status = { text: string; destroys: boolean; note?: string };

/**
 * What becomes of one partition already on the device, for its Action column:
 * - reused by the new system: mounted as is, or formatted, at its mount point;
 * - otherwise: what its space decision allows (keep, shrink if needed, delete).
 *
 * Formatting and deleting lose data, so they are flagged to be set apart. Based
 * on the request, not on what the installer made of it.
 */
function statusFor(
  decision: Decision | undefined,
  reusedAs: string | undefined,
  formats: boolean,
  canShrink: boolean,
  recoverable: number | undefined,
): Status | undefined {
  if (reusedAs) {
    const path = formattedPath(reusedAs);

    if (!formats) {
      // TRANSLATORS: %s is a mount point, like "/home"
      return { text: sprintf(_("Mount at %s"), path), destroys: false };
    }

    return {
      // TRANSLATORS: %s is a mount point, like "/home"
      text: sprintf(_("Format for %s"), path),
      destroys: true,
    };
  }

  switch (decision) {
    case "keep":
      // TRANSLATORS: action to leave an existing partition untouched
      return { text: _("None"), destroys: false };
    case "resizeIfNeeded":
      if (!canShrink) {
        return {
          text: _("None"),
          destroys: false,
          note: _("Cannot be shrunk"),
        };
      }

      return {
        // TRANSLATORS: action for an existing partition: make it smaller if room is
        // needed, keeping its data
        text: _("Shrink if needed"),
        destroys: false,
        note: recoverable
          ? // TRANSLATORS: %s is a size, like "17.50 GiB"
            sprintf(_("Up to %s may be freed"), deviceSize(recoverable))
          : undefined,
      };
    case "delete":
      return {
        // TRANSLATORS: action for an existing partition: remove it and its data
        text: _("Delete"),
        destroys: true,
      };
    default:
      return undefined;
  }
}

/**
 * What may happen to one partition: the device rule, or the partition's own
 * decision when the rule leaves it to each one. Undefined when the new system
 * uses it.
 */
function decisionFor(
  rule: Decision | undefined,
  entry?: ConfigModel.Partition | ConfigModel.LogicalVolume,
): Decision | undefined {
  if (entry?.mountPath) return undefined;
  return rule || decisionOf(entry);
}

/**
 * Whether the new system formats a partition it uses, losing what is on it,
 * rather than mounting it as it is.
 */
function isFormatted(request?: ConfigModel.Partition | ConfigModel.LogicalVolume): boolean {
  return request?.mountPath !== undefined && request.filesystem?.reuse !== true;
}

function PartitionRow({
  part,
  entries,
  decision,
  menu,
}: {
  part: System.Device;
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** What is allowed to happen here, however it came to be allowed. */
  decision?: Decision;
  /** The row's menu, where there is anything to offer on this row. */
  menu?: React.ReactNode;
}) {
  const request = entries.find((e) => e.name === part.name);
  const reusedAs = request?.mountPath;
  const systems = part.block?.systems || [];
  const size = part.block?.size;
  const canShrink = part.block?.shrinking?.supported === true;
  /* Read from the request, not the plan: the table shows what was asked for. */
  const formats = isFormatted(request);
  const currentContent =
    part.filesystem?.type ||
    part.description ||
    // TRANSLATORS: said of a partition whose content is not recognized.
    _("unrecognized");
  const status = statusFor(decision, reusedAs, formats, canShrink, recoverableBy(part));

  return (
    <Tr>
      <Th scope="row" {...columnProps(COLUMNS.partition)}>
        <Text>{baseName(part.name)}</Text>
        {part.block?.encrypted && (
          <>
            {" "}
            {/* TRANSLATORS: marks a partition whose content is encrypted. */}
            <Icon name="lock" size="xs" aria-label={_("encrypted")} />
          </>
        )}
      </Th>
      <Td {...columnProps(COLUMNS.content)}>
        <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem>{currentContent}</FlexItem>
          {/* The systems found on it, as icons: they say what a loss means. */}
          {systems.map((system) => (
            <FlexItem key={system}>
              <Label isCompact>{system}</Label>
            </FlexItem>
          ))}
        </Flex>
      </Td>
      <Td {...columnProps(COLUMNS.size)}>
        <div>{deviceSize(size)}</div>
      </Td>
      <Td {...columnProps(COLUMNS.action)}>
        {status && (
          <>
            {status.destroys ? <DataLoss>{status.text}</DataLoss> : status.text}
            {status.note && <div className="agm-row-note">{status.note}</div>}
          </>
        )}
      </Td>
      <Td isActionCell>{menu}</Td>
    </Tr>
  );
}

/** The name of the control showing or hiding the list of what is on a device. */
/** The toggle's words, in the singular or the plural by how many there are. */
function disclosureLabel(isVolumeGroup: boolean, expanded: boolean, count: number): string {
  if (isVolumeGroup) {
    return expanded
      ? n_(
          "Hide details of the existing logical volume",
          "Hide details of the existing logical volumes",
          count,
        )
      : n_(
          "Show details of the existing logical volume",
          "Show details of the existing logical volumes",
          count,
        );
  }

  return expanded
    ? n_("Hide details of the existing partition", "Hide details of the existing partitions", count)
    : n_(
        "Show details of the existing partition",
        "Show details of the existing partitions",
        count,
      );
}

export type CurrentContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the space decision acts on. */
  subject: DetailsSubject;
  /** Whether every other row is shaded. Off by default. */
  isStriped?: boolean;
  /** Whether a summary sentence comes before the table. */
  withSummary?: boolean;
  /**
   * What happens to every partition, where it does not depend on a space
   * option: "keep" on a device the installation does not use, "delete" on one
   * given whole to a file system. Leaves out the option and the decisions in
   * the row menus.
   */
  fixedDecision?: Decision;
};

/**
 * What is on the device today and what the installation will do to each part.
 *
 * A summary sentence comes first, then a menu to give every partition the same
 * decision, then a toggle showing the table. Each row has the content, size and
 * action of a partition or logical volume, and a menu to change that action.
 * Actions are permissions, not results: "Shrink if needed" stays true when the
 * installer does not need to shrink.
 *
 * Render it only when {@link hasCurrentContent} says there is something to show.
 */
export default function CurrentContentSection({
  entry,
  subject,
  isStriped = false,
  withSummary = true,
  fixedDecision,
}: CurrentContentSectionProps): React.ReactNode {
  const rows = rowsOf(entry);
  /* The device rule for every partition. Undefined when each one has its own
     decision; an unset rule keeps everything. */
  const rule = fixedDecision || decisionUnder(entry.config.spacePolicy || "keep");
  const entries = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];
  /* What a per-partition decision is written back with. Reused partitions are
     left out: the configuration stores their use, not a decision. */
  const governed = rows.filter(
    (row): row is System.Device =>
      !isFreeSpace(row) && !entries.find((e) => e.name === row.name)?.mountPath,
  );

  const someReused = entries.some((e) => e.name && e.mountPath);
  /* Only where the partitions are the reader's to decide. */
  const isDecidable = !fixedDecision && governed.length > 0;

  /* Kept in the URL, so reload, Back and shared links keep it. Closed by
     default; the panel clears it on close or when moving to another device. */
  const { hasSearchParamToken, toggleSearchParamToken } = useSearchParamTokens(EXPANDED);
  const expanded = hasSearchParamToken(CURRENT_CONTENT);
  const contentId = useId();

  const parts: ContentPart[] = rows
    .filter((row): row is System.Device => !isFreeSpace(row))
    .map((row) => {
      const request = entries.find((e) => e.name === row.name);
      const reusedAs = request?.mountPath;
      return {
        name: baseName(row.name),
        reusedAs: reusedAs && formattedPath(reusedAs),
        formats: isFormatted(request),
        recoverable: recoverableBy(row),
        decision: decisionFor(rule, request),
      };
    });
  const kind = entry.isVolumeGroup ? "logicalVolumes" : "partitions";
  const built = buildCurrentContentSummary({ kind, parts });
  const summary = built && built.sentence;
  const summaryId = useId();

  /* Announced on change, so screen reader users hear what their choice did. */
  const announce = useAnnounce();
  const announcedSummary = useRef(summary);
  useEffect(() => {
    if (announcedSummary.current === summary) return;
    announcedSummary.current = summary;
    /* Dropping the markers leaves the text translated. */
    if (summary) announce(markerText(summary) as TranslatedString);
  }, [summary, announce]);

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapXs" }}>
      {rows.some((row) => !isFreeSpace(row)) && (
        <>
          {withSummary && (
            <FlexItem>
              <Text id={summaryId}>
                {built && (
                  <Interpolate sentence={summary}>
                    {(amount) => <Text isBold>{amount}</Text>}
                  </Interpolate>
                )}
              </Text>
              {isDecidable && (
                <SpaceDecision
                  collection={subject.collection}
                  index={subject.index}
                  policy={entry.config.spacePolicy || "keep"}
                  someReused={someReused}
                  describedBy={summaryId}
                />
              )}
            </FlexItem>
          )}
          <FlexItem>
            <Button
              variant="link"
              className="agm-details-disclosure"
              icon={
                <Icon
                  name={expanded ? "keyboard_arrow_down" : "chevron_right"}
                  verticalAlign="middle"
                />
              }
              aria-expanded={expanded}
              aria-controls={contentId}
              aria-describedby={summaryId}
              onClick={() => toggleSearchParamToken(CURRENT_CONTENT)}
            >
              {disclosureLabel(entry.isVolumeGroup, expanded, parts.length)}
            </Button>
          </FlexItem>
        </>
      )}
      {/* Hidden rather than unmounted, so the toggle can point at what it opens. */}
      <FlexItem hidden={!expanded} className={spacingStyles.mtSm}>
        <Flex
          id={contentId}
          direction={{ default: "column" }}
          gap={{ default: "gapSm" }}
          className={spacingStyles.plMd}
        >
          <Table
            role="table"
            gridBreakPoint=""
            variant="compact"
            isStriped={isStriped}
            /* Header and Action column ruled off from the rest. */
            {...tableProps({ hasHeaderRule: true, hasVerticallyCenteredRows: true })}
            // TRANSLATORS: name of a table of what a device holds today
            aria-label={_("Current content")}
          >
            {/* nowrap keeps headings whole: PatternFly would truncate them. */}
            <Thead>
              <Tr>
                <Th {...columnProps(COLUMNS.partition)}>
                  {entry.isVolumeGroup
                    ? // TRANSLATORS: column header
                      _("Logical volume")
                    : // TRANSLATORS: column header
                      _("Partition")}
                </Th>
                <Th {...columnProps(COLUMNS.content)}>{_("Content")}</Th>
                <Th {...columnProps(COLUMNS.size)}>{_("Size")}</Th>
                <Th {...columnProps(COLUMNS.action)}>{_("Action")}</Th>
                <Th>
                  {/* Hidden from sight: the menus need no visible heading. */}
                  <Text srOnly>
                    {/* TRANSLATORS: column header, read by screen readers only */}
                    {_("Options")}
                  </Text>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row, at) => {
                if (isFreeSpace(row)) {
                  return (
                    <Tr key={`free-${at}`}>
                      <Th scope="row" {...columnProps(COLUMNS.partition)}>
                        <Text textStyle="textColorSubtle">{_("Free space")}</Text>
                      </Th>
                      <Td {...columnProps(COLUMNS.content)} />
                      <Td {...columnProps(COLUMNS.size)}>{deviceSize(row.size)}</Td>
                      <Td {...columnProps(COLUMNS.action)}>
                        {fixedDecision === "delete" && (
                          <Text srOnly>{_("All the content of the device will be deleted")}</Text>
                        )}
                        {fixedDecision !== "delete" && _("Use if needed")}
                      </Td>
                      <Td />
                    </Tr>
                  );
                }

                /* Computed once and passed to the row. */
                const decision = decisionFor(
                  rule,
                  entries.find((e) => e.name === row.name),
                );

                return (
                  <PartitionRow
                    key={row.sid}
                    part={row}
                    entries={entries}
                    decision={decision}
                    menu={
                      /* No menu on partitions that go with the whole device. */
                      fixedDecision !== "delete" && (
                        <PartitionMenu
                          part={row}
                          reusedAs={entries.find((e) => e.name === row.name)?.mountPath}
                          governed={governed}
                          entries={entries}
                          collection={subject.collection}
                          index={subject.index}
                          canDecide={!fixedDecision}
                          rule={rule}
                        />
                      )
                    }
                  />
                );
              })}
            </Tbody>
          </Table>
        </Flex>
      </FlexItem>
    </Flex>
  );
}
