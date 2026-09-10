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
import FinalLayoutSection from "~/components/storage/device-sheet/FinalLayoutSection";
import DriveMenu from "~/components/storage/entries-table/DriveMenu";
import VolumeGroupMenu from "~/components/storage/entries-table/VolumeGroupMenu";
import { useEntry } from "~/components/storage/device-sheet/entry";
import { useSheet, SHEET_ID } from "~/components/storage/shared/use-sheet";
import { useMediaQuery } from "~/hooks/use-media-query";
import { _ } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

/** PatternFly's `lg`, where a panel over the page stops covering all of it. */
const LG = "(min-width: 62rem)";
/** PatternFly's `xl`, from where there is room for the page and a panel both. */
const XL = "(min-width: 75rem)";

/**
 * How much of the window the sheet takes, and what that leaves the page.
 *
 * Three bands rather than two. Below `lg` a panel drawn over the page covers
 * all of it anyway, so it takes its place instead. From there to `xl` it comes
 * over the page. At `xl` and above the two share the width and the page keeps
 * working.
 *
 * `xl` rather than a number of our own: 1024 falls between the two, and the
 * difference between a 1024 window and a 1199 one is not one this page behaves
 * differently at.
 */
function usePlacement(): SheetPlacement {
  const fitsBoth = useMediaQuery(XL);
  const fitsOverlay = useMediaQuery(LG);

  if (fitsBoth) return "share";
  if (fitsOverlay) return "overlay";
  return "replace";
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
 * @fixme An entry shows what it becomes and nothing else yet. What the plan
 *  asks of it and what is on it today join it, and the three become tabs.
 */
export default function StorageSheet({ page }: StorageSheetProps): React.ReactNode {
  const { subject, close } = useSheet();
  const placement = usePlacement();
  const selection = subject === "result" ? null : subject;
  const entry = useEntry(selection);

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
          : entry?.device?.block?.udevPaths?.[0]
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
    >
      {isResult && <ResultSheet />}
      {entry && <FinalLayoutSection entry={entry} />}
    </Sheet>
  );
}
