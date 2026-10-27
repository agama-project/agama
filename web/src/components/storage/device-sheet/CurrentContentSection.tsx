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
import { Button, Divider, Flex, FlexItem, Label } from "@patternfly/react-core";
import alignmentStyles from "@patternfly/react-styles/css/utilities/Alignment/alignment";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { sprintf } from "sprintf-js";
import { unique } from "radashi";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import SpaceDecision from "~/components/storage/device-sheet/SpaceDecision";
import contentSummary, {
  summaryParts,
  summarySentence,
} from "~/components/storage/device-sheet/content-summary";
import Interpolate from "~/components/core/Interpolate";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeletePartition } from "~/hooks/model/storage/config-model";
import { useAnnounce } from "~/context/announcer";
import {
  decisionOf,
  decisionUnder,
  recoverableBy,
  usePartitionSpaceItems,
} from "~/components/storage/device-sheet/partition-space";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize, formattedPath } from "~/components/storage/utils";
import { _ } from "~/i18n";
import type DevicesManager from "~/model/storage/devices-manager";
import type { Decision } from "~/components/storage/device-sheet/partition-space";
import type { ContentPart } from "~/components/storage/device-sheet/content-summary";
import type { ConfigModel, DeviceCollection, Partitionable } from "~/model/storage/config-model";
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

/**
 * Whether this entry has anything on it today, which is whether the view has
 * anything to say.
 *
 * Asked by whoever offers the view rather than answered inside it. A view whose
 * whole answer is that there is nothing costs a reader a click to learn
 * nothing, and an empty disk or a volume group being defined would carry one.
 */
export function hasCurrentContent(entry: Entry): boolean {
  return rowsOf(entry).length > 0;
}

/**
 * Everything that can be told to one thing already on the device, in one place.
 *
 * Two kinds of thing, and the reader has no reason to know they are two. What
 * the installation may do to a partition is a space decision, answered for the
 * whole device unless the reader asked to answer it part by part; whether the
 * new system takes the partition over is not a space decision at all, and stays
 * offered whatever the space answer is. They used to sit in different columns
 * for that reason, which left a row with two ways in and the reader to find out
 * which held what. A rule between them is enough to keep them apart.
 *
 * Nothing where there is nothing to offer: a volume group's logical volumes
 * cannot be reused, and a device following a rule of its own has no per-part
 * decision to make here.
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
  // TRANSLATORS: names the menu of things that can be done to one partition
  // already on a device. %s is its name, such as "vda2".
  const menuLabel = sprintf(_("Actions for %s"), name);
  const at = { collection, index: String(index) };
  /* Asked for on every row, since a hook cannot be asked for on some of them,
     and used only where the row is the one deciding. */
  const spaceItems = usePartitionSpaceItems({
    partition: part,
    governed,
    entries,
    collection,
    index,
    rule,
  });

  /* Only off a device whose partitions the new system can take over. A group's
     logical volumes are not among them. */
  const reuseItems =
    collection === "volumeGroups"
      ? []
      : reusedAs
        ? [
            <MenuButtonItem
              key="edit"
              to={generateEncodedPath(PATHS.editPartition, { ...at, partitionId: reusedAs })}
              keepQuery
            >
              {/* TRANSLATORS: offered on a partition the new system already
                  reuses: change how it is used. */}
              {_("Modify how the partition is used")}
            </MenuButtonItem>,
            <MenuButtonItem key="stop" onClick={() => deletePartition(collection, index, reusedAs)}>
              {/* TRANSLATORS: offered on a partition the new system reuses: stop
                  using it, which leaves it to the device's space decision again. */}
              {_("Stop using")}
            </MenuButtonItem>,
          ]
        : [
            <MenuButtonItem
              key="reuse"
              to={generateEncodedPath(PATHS.reusePartition, { ...at, deviceName: part.name })}
              keepQuery
              description={_("Used by the new system, keeping or deleting data.")}
            >
              {/* TRANSLATORS: offered on a partition already on a device: use it
                  for the new system. The ellipsis says a form follows. */}
              {_("Assign a mount point…")}
            </MenuButtonItem>,
          ];

  /* The space decision first: it is what the row's first column says about
     itself, so the menu opens on the thing the reader just read. */
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

/* The one report that costs the reader something, colored rather than marked.
   The words say what happens, and a mark beside them in a column of short
   phrases says it a second time while taking the width the phrases need. The
   color is the entries table's, so the same news reads the same in both. */
const DESTROYS_CLASS = "agm-entries-table__cost--destroys";
const PENDING_REMOVAL_CLASS = "agm-pending-removal";

/**
 * What is to become of one thing already on the device, and whether that costs
 * the reader anything.
 *
 * The words rather than a string: half the statuses are a loss and carry the
 * color saying so, and half are not. Some carry a note too, read under them
 * the way the final layout reads its notes under a value.
 */
type Status = { text: string; destroys: boolean; note?: string };

/**
 * What is to become of one thing already on the device, said beside its name.
 *
 * Two questions answered in one phrase, because a reader looking at a row wants
 * one answer about it. Where the new system takes the partition over, that is
 * the answer and no space decision reaches it: it is spoken for, and what it is
 * taken over for is the useful half of the news, so the phrase carries the
 * mount point rather than making the reader find it. Where the new system has
 * no use for it, the answer is what the reader has allowed to happen there.
 *
 * Lower case and tucked in after the name: it is the end of a phrase the name
 * begins, not a heading, and a column of them is read down.
 *
 * Taking a partition over still empties it more often than not, and "mount at"
 * where the installation means to format would have a reader believe their data
 * is safe. So the two are different phrases, and the one that loses something
 * says so and is colored.
 *
 * All of it off what was asked for, none of it off what the installer made of
 * it. The two part company whenever the request cannot be met, and a table that
 * answers one question with the other cannot be read at all.
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

    return formats
      ? // TRANSLATORS: what is to become of a partition already on the disk: it
        // is emptied and given to the new system. %s is where the new system
        // mounts it, such as "/home".
        { text: sprintf(_("Format for %s"), path), destroys: true }
      : // TRANSLATORS: what is to become of a partition already on the disk: the
        // new system takes it over as it is. %s is where the new system mounts
        // it, such as "/home".
        { text: sprintf(_("Mount at %s"), path), destroys: false };
  }

  switch (decision) {
    case "keep":
      // TRANSLATORS: what is to become of a partition already on the disk:
      // nothing.
      return { text: _("Keep"), destroys: false };
    case "resizeIfNeeded":
      if (!canShrink) {
        return {
          text: _("Keep"),
          destroys: false,
          // TRANSLATORS: read under "Keep" for a partition that was allowed to
          // be made smaller, but cannot be, so it stays as it is.
          note: _("Cannot be shrunk"),
        };
      }

      return {
        // TRANSLATORS: what is to become of a partition already on the disk: it
        // may be made smaller, keeping its data, if room is needed.
        text: _("Shrink if needed"),
        destroys: false,
        note: recoverable
          ? // TRANSLATORS: read under "Shrink if needed": how much room making
            // the partition smaller can give at most. %s is a size, such as
            // "17.50 GiB".
            sprintf(_("Up to %s may be freed"), deviceSize(recoverable))
          : undefined,
      };
    case "delete":
      // TRANSLATORS: what is to become of a partition already on the disk: it
      // is removed, and everything on it lost.
      return { text: _("Delete"), destroys: true };
    default:
      return undefined;
  }
}

/**
 * What is allowed to happen to one thing already on the device.
 *
 * The device's rule where it has one to give, and the thing's own where the
 * fourth answer leaves it to the parts. Nothing at all where the new system
 * mounts it: it is spoken for, and no space decision reaches it.
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
  manager,
  entries,
  decision,
  menu,
}: {
  part: System.Device;
  manager: DevicesManager;
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
  const staged = manager.stagingDevice(part.sid);
  const canShrink = part.block?.shrinking?.supported === true;
  /* Whether what is on the partition survives being taken over, read from the
     request rather than from the plan. The table is about what was asked for:
     a request to format is a request to format whether or not the installer
     got as far as a plan that does it, and a reader who asked for one and is
     shown the other has no way to tell which they are looking at. */
  const formats = isFormatted(request);
  /* What it is left holding. The request first, and the plan where the request
     left the choice to the installer, which it may. */
  const newFilesystem = formats ? request?.filesystem?.type || staged?.filesystem?.type : undefined;
  const currentContent =
    part.filesystem?.type ||
    part.description ||
    // TRANSLATORS: said of a partition whose content is not recognized.
    _("unrecognized");
  const status = statusFor(decision, reusedAs, formats, canShrink, recoverableBy(part));
  const keepsSize = decision !== "delete";

  /* A rule through what is on the partition today and how big it is, where
     the reader has allowed it to go: there now, gone once installed. Only a
     visual cue, styled to stay readable: not <s>, which would claim it is
     already untrue, and the Action column says it in words. Not through the
     status itself: crossing out "delete" says the opposite of what it means. */
  const struck = (content: React.ReactNode) => (
    <span className={PENDING_REMOVAL_CLASS}>{content}</span>
  );

  return (
    <Tr>
      <Th scope="row" modifier="nowrap">
        <Text>{baseName(part.name)}</Text>
        {part.block?.encrypted && (
          <>
            {" "}
            {/* TRANSLATORS: marks a partition whose content is encrypted. */}
            <Icon name="lock" size="xs" aria-label={_("encrypted")} />
          </>
        )}
      </Th>
      <Td>
        <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
          <FlexItem>
            {formats ? (
              /* Struck through rather than colored: what is there now gives
                 way to what follows it, and a word in the danger color would
                 make the loss louder than the thing the reader asked for. */
              <span className={PENDING_REMOVAL_CLASS}>{currentContent}</span>
            ) : decision === "delete" ? (
              struck(currentContent)
            ) : (
              currentContent
            )}
          </FlexItem>
          {/* Nothing where the request names no file system and the installer
              has not settled on one either: the rule through what is there now
              has already said it goes. */}
          {formats && newFilesystem && <FlexItem>{newFilesystem}</FlexItem>}
          {/* The system left standing on a row being deleted. It is a mark
              rather than a word in the sentence, so a rule through it would be
              a rule through a label; and it is the one thing on the row that
              makes the deletion mean something, which is not helped by being
              crossed out. */}
          {!formats &&
            systems.map((system) => (
              <FlexItem key={system}>
                <Label isCompact>{system}</Label>
              </FlexItem>
            ))}
        </Flex>
      </Td>
      <Td className={alignmentStyles.textAlignEnd}>
        {keepsSize ? <div>{deviceSize(size)}</div> : size !== undefined && struck(deviceSize(size))}
      </Td>
      <Td>
        {status && (
          <>
            <div className={status.destroys ? DESTROYS_CLASS : undefined}>{status.text}</div>
            {status.note && <div className="agm-row-note">{status.note}</div>}
          </>
        )}
      </Td>
      <Td isActionCell>{menu}</Td>
    </Tr>
  );
}

/** The name of the control showing or hiding the list of what is on a device. */
function disclosureLabel(isVolumeGroup: boolean, expanded: boolean): string {
  if (isVolumeGroup) {
    return expanded
      ? // TRANSLATORS: hides the list of logical volumes a volume group holds
        // today.
        _("Hide logical volumes")
      : // TRANSLATORS: shows the list of logical volumes a volume group holds
        // today, where what happens to each can be seen and changed.
        _("Show logical volumes");
  }

  return expanded
    ? // TRANSLATORS: hides the list of partitions a disk holds today.
      _("Hide partitions")
    : // TRANSLATORS: shows the list of partitions a disk holds today, where what
      // happens to each can be seen and changed.
      _("Show partitions");
}

export type CurrentContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the space decision acts on. */
  subject: SheetEntry;
  /**
   * Whether the table shades every other row, on top of the lines between
   * rows. Off by default.
   */
  isStriped?: boolean;
  /**
   * What happens to every partition, where it does not depend on a space
   * option: "keep" on a device the installation does not use, "delete" on one
   * given whole to a file system. Leaves out the option and the decisions in
   * the row menus.
   */
  fixedDecision?: Decision;
};

/**
 * What is on the device today, and what the installation will do to it.
 *
 * The one view where a reader can see the whole answer partition by partition
 * rather than as a summary. The decision reads above the table it governs,
 * since it is about the rows below it, and then again on every row it reaches,
 * since a rule set once above a list is not read again against each thing in
 * it. The same decision in both places: "delete" on the row is the device's
 * "Deleting everything" arriving here.
 *
 * Each row says it after the name of the thing it is about, so the three
 * columns left are three facts about the partition and the name carries the
 * verdict on it. A column of verdicts across the table had the reader reading
 * each row twice, once to find which partition and once to find what happens
 * to it, and left two of its five columns empty on most rows.
 *
 * Changing what happens to one partition is in the row's menu, with everything
 * else the row can be told to do. Giving every partition the same decision at
 * once is offered beside the toggle that opens the table, so it can be used
 * without opening it.
 *
 * It is a permission rather than a plan: "shrink if needed" is the whole truth
 * about a partition the installer did not have to shrink.
 *
 * A row allowed to go is struck through where it describes itself, so the loss
 * is read off the row rather than off one word in it. Not the verdict, which
 * is the thing the reader chose and the one part of the row still true
 * afterwards.
 *
 * A sentence comes before the list, saying what the decisions amount to. The
 * list behind it is there to be checked rather than read, so it starts away
 * behind a link.
 *
 * Shown only where there is something to show, which whoever offers the view
 * settles with {@link hasCurrentContent}. The view never has to say that it has
 * nothing to say.
 */
export default function CurrentContentSection({
  entry,
  subject,
  isStriped = false,
  fixedDecision,
}: CurrentContentSectionProps): React.ReactNode {
  const manager = useDevicesManager();
  const rows = rowsOf(entry);
  /* What the device's own rule allows each of its partitions, where it has one
     to give. Nothing when the partitions are given different decisions, and
     then each carries its own. An unset rule keeps everything. */
  const rule = fixedDecision || decisionUnder(entry.config.spacePolicy || "keep");
  const entries = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];
  /* Everything one per-partition decision is written back with. One the new
     system mounts is not among them: it is spoken for, and the configuration
     holds what it is used for rather than what may be done to it. */
  const governed = rows.filter(
    (row): row is System.Device =>
      !isFreeSpace(row) && !entries.find((e) => e.name === row.name)?.mountPath,
  );

  /* The decision every governed partition shares, which is the one reading
     pressed among the options giving them all the same. */
  const decisions = unique(
    governed.map((row) =>
      decisionFor(
        rule,
        entries.find((e) => e.name === row.name),
      ),
    ),
  );
  const sharedDecision = decisions.length === 1 ? decisions[0] : undefined;
  const someReused = entries.some((e) => e.name && e.mountPath);

  /* Closed at first, since the summary already says what happens to every part. */
  const [expanded, setExpanded] = React.useState(false);
  const contentId = React.useId();

  const parts: ContentPart[] = rows
    .filter((row): row is System.Device => !isFreeSpace(row))
    .map((row) => {
      const request = entries.find((e) => e.name === row.name);
      const reusedAs = request?.mountPath;
      return {
        name: baseName(row.name),
        systems: row.block?.systems || [],
        reusedAs: reusedAs && formattedPath(reusedAs),
        formats: isFormatted(request),
        recoverable: recoverableBy(row),
        decision: decisionFor(rule, request),
      };
    });
  const kind = entry.isVolumeGroup ? "logicalVolumes" : "partitions";
  const summary = contentSummary(kind, parts);
  const halves = summaryParts(kind, parts);
  const summaryId = React.useId();

  /* Said when the decisions change, so a screen reader user hears what their
     choice did to the device and not only that a button is now pressed. */
  const announce = useAnnounce();
  const announcedSummary = React.useRef(summary);
  React.useEffect(() => {
    if (announcedSummary.current === summary) return;
    announcedSummary.current = summary;
    if (summary) announce(summary);
  }, [summary, announce]);

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      {/* Only where there is something to sum up. */}
      {rows.some((row) => !isFreeSpace(row)) && (
        <>
          {/* The toggle starts its own line under the summary, so its caret sits
              right above what it opens. The summary says what that is about and
              is the toggle's description for whoever lands on it without
              reading the line. */}
          <FlexItem component="p">
            {/* How much there is in bold, as the answer to the heading; the
                rest says what becomes of it. */}
            <Text id={summaryId}>
              {halves && (
                <Interpolate sentence={summarySentence()}>
                  {[() => <Text isBold>{halves.amount}</Text>, () => halves.fates]}
                </Interpolate>
              )}
            </Text>
          </FlexItem>
          {/* The menu shares the toggle's line, at its far end: it acts on every
              row whether the table is open or not, and what it does reads in
              the summary right above it. */}
          <Flex
            justifyContent={{ default: "justifyContentSpaceBetween" }}
            alignItems={{ default: "alignItemsCenter" }}
            gap={{ default: "gapSm" }}
          >
            <FlexItem>
              <Button
                variant="link"
                isInline
                className="agm-sheet-disclosure"
                icon={
                  <Icon
                    name={expanded ? "keyboard_arrow_down" : "chevron_right"}
                    verticalAlign="middle"
                  />
                }
                aria-expanded={expanded}
                aria-controls={contentId}
                aria-describedby={summaryId}
                onClick={() => setExpanded(!expanded)}
              >
                <Text isBold>{disclosureLabel(entry.isVolumeGroup, expanded)}</Text>
              </Button>
            </FlexItem>
            {!fixedDecision && governed.length > 0 && (
              <FlexItem>
                <SpaceDecision
                  collection={subject.collection}
                  index={subject.index}
                  current={sharedDecision}
                  someReused={someReused}
                />
              </FlexItem>
            )}
          </Flex>
        </>
      )}
      {/* A bit more room above what the toggle opens than between the lines
          above it: neither the options nor a table's header are lines of text.
          Put away rather than taken down, so the toggle has something to name
          as the thing it opens; the wrapper carries the attribute, so closed it
          takes no room. */}
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
            // TRANSLATORS: names the list of what is on a device already.
            aria-label={_("Current content")}
          >
            {/* Read rather than hidden from sight: what a column holds is told
                by what it is called, and a reader left to work that out from
                the values is being asked to do the heading's job.

                Each heading kept whole. PatternFly cuts one down to whatever
                its column came out as, which shortens the one thing on the row
                whose whole job is to be read. */}
            <Thead>
              <Tr>
                <Th modifier="nowrap">{_("Partition")}</Th>
                <Th modifier="nowrap">{_("Content")}</Th>
                <Th className={alignmentStyles.textAlignEnd} modifier="nowrap">
                  {_("Size")}
                </Th>
                <Th modifier="nowrap">{_("Action")}</Th>
                <Th>
                  {/* The column of menus has nothing to head: a heading over it
                      names a column the reader can already see the point of.
                      Nothing but its name either, since what sits in a header
                      cell is read out with every cell under it. */}
                  <Text srOnly>
                    {/* TRANSLATORS: names, for screen readers only, the column
                        holding the menu of each partition. */}
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
                      <Th scope="row">
                        <Text textStyle="textColorSubtle">
                          {/* TRANSLATORS: a row for room on a device that no
                            partition takes. */}
                          {_("Free space")}
                        </Text>
                      </Th>
                      <Td />
                      <Td className={alignmentStyles.textAlignEnd}>{deviceSize(row.size)}</Td>
                      <Td>{_("Use if needed")}</Td>
                      <Td />
                    </Tr>
                  );
                }

                /* Worked out once and given to the row, which says it beside the
                 name, reads the rest of itself against it, and offers to have
                 it changed. */
                const decision = decisionFor(
                  rule,
                  entries.find((e) => e.name === row.name),
                );

                return (
                  <PartitionRow
                    key={row.sid}
                    part={row}
                    manager={manager}
                    entries={entries}
                    decision={decision}
                    menu={
                      /* Nothing to offer on a partition that goes with the
                         whole device. */
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
