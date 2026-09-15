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
import Sheet, { SheetPlacement } from "~/components/core/Sheet";
import ResultSheet from "~/components/storage/storage-page/ResultSheet";
import DeviceSheetHeading from "~/components/storage/device-sheet/DeviceSheetHeading";
import DeviceDetail from "~/components/storage/device-sheet/DeviceDetail";
import DriveMenu from "~/components/storage/entries-table/DriveMenu";
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";
import { useEntry } from "~/components/storage/device-sheet/entry";
import { useSingleDevice } from "~/components/storage/storage-page/queries";
import { useSheet, SHEET_ID } from "~/components/storage/shared/use-sheet";
import { useMediaQuery } from "~/hooks/use-media-query";
import { EmptyState, EmptyStateBody } from "@patternfly/react-core";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-sheet/entry";

/** PatternFly's `2xl`, from where there is room for the page and a panel both. */
const WIDE = "(min-width: 90.625rem)";

/**
 * How much of the window the sheet takes, and what that leaves the page.
 *
 * Two bands. Wide enough for both, the two share the width and the page keeps
 * working; otherwise the sheet comes over the page, which is where most readers
 * are.
 *
 * `2xl` rather than `xl`, which was tried first: a page sharing its width from
 * 1200px keeps the list of entries but crushes it, wrapping a row's every line
 * into three. Sharing has to leave the page usable, or it is an overlay that
 * also makes the page hard to read.
 */
function usePlacement(): SheetPlacement {
  return useMediaQuery(WIDE) ? "share" : "overlay";
}

/**
 * Where the system keeps the entry, under the name it answers to.
 *
 * For a disk that is the one identifier a reboot renaming sda to sdb does not
 * change, which is the reason to print it at all. For a volume group it is the
 * name the group answers to once it exists, worked out rather than read: a
 * group being defined is not on the machine yet, and the name it will take
 * follows from what it is called.
 */
function systemPath(entry: Entry): string | undefined {
  if (entry.isVolumeGroup) return entry.device?.name || `/dev/${entry.name}`;
  return entry.device?.block?.udevPaths?.[0];
}

export type StorageSheetProps = {
  /** The page the sheet opens over. */
  page: React.ReactNode;
};

/**
 * The one panel the storage page opens, whatever it was opened on.
 *
 * One sheet and not several, because the reader only ever has one open and the
 * address only ever names one thing. What changes with the subject is what the
 * panel says it is about and what it holds; how it behaves does not, which is
 * why that part is settled once in `core/Sheet`.
 *
 * An address naming an entry the configuration no longer has reads as a shut
 * sheet. Addresses outlive plans: one can be written down, shared, or reloaded
 * after the entry it named has gone.
 *
 * @fixme What is on an entry today, and what a volume group is made of, are the
 *  two views still to join the strip.
 */
export default function StorageSheet({ page }: StorageSheetProps): React.ReactNode {
  const { subject, close } = useSheet();
  const placement = usePlacement();
  const selection = subject === "result" ? null : subject;
  const entry = useEntry(selection);
  const singleDevice = useSingleDevice();

  const isResult = subject === "result";
  const isOpen = isResult || entry !== null;

  return (
    <Sheet
      id={SHEET_ID}
      isOpen={isOpen}
      placement={placement}
      onClose={close}
      title={
        isResult
          ? // TRANSLATORS: names the panel holding everything the installer will
            // do and what the machine will look like afterwards.
            _("Result")
          : entry && <DeviceSheetHeading entry={entry} />
      }
      description={
        isResult
          ? // TRANSLATORS: says what the panel holding the whole picture is for.
            _("What the installer will do, and what the machine will look like")
          : entry && systemPath(entry)
      }
      /* The same acts the entry's row offers, so a reader meets one menu per
         entry wherever they open it from. */
      actions={
        entry &&
        (entry.isVolumeGroup ? (
          <VolumeGroupMenu group={entry.config as ConfigModel.VolumeGroup} />
        ) : (
          <DriveMenu entry={entry.config as Partitionable.Device} device={entry.device} />
        ))
      }
      page={page}
      /* Only where there is a list to pick from. On a plan of one device there
         is nothing to select, and a third of a wide screen saying so reports an
         absence the reader did not cause. */
      placeholder={
        singleDevice ? undefined : (
          <EmptyState
            headingLevel="h2"
            variant="sm"
            // TRANSLATORS: said in the empty column beside the list, where no
            // entry of the installation has been opened yet.
            titleText={_("Nothing selected")}
          >
            <EmptyStateBody>
              {/* TRANSLATORS: says what the empty column beside the list is
                  for. */}
              {_("Pick an entry in the list to see and change what happens to it.")}
            </EmptyStateBody>
          </EmptyState>
        )
      }
    >
      {isResult && <ResultSheet />}
      {entry && selection && <DeviceDetail entry={entry} subject={selection} />}
    </Sheet>
  );
}
