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

/*
 * PLAYGROUND: what the "Used for" and "Existing data" cells of the devices
 * table say. Short values with the same shape on every row, so a column can be
 * scanned rather than read. The full story of each device stays in its panel.
 *
 * Every wording here, the discarded ones included, is listed in WORDING.md at
 * the root of the repository.
 */

import React from "react";
import { sprintf } from "sprintf-js";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import configModel from "~/model/storage/config-model";
import { _, n_, formatList, formatListToParts } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type {
  ExistingDataWording,
  NamesStyle,
} from "~/components/storage/storage-page/playground-switches";

type Volume = ConfigModel.Partition | ConfigModel.LogicalVolume;

/* ---- Used for ------------------------------------------------------------- */

/** The mount points of the volumes the installation creates or reuses. */
function mountPathsOf(volumes: Volume[]): string[] {
  return volumes.filter((v) => v.mountPath).map((v) => v.mountPath);
}

/**
 * Names such as mount points or volume groups, joined the way the language
 * joins a list. PLAYGROUND: set in monospace or not, from the console, so a
 * name like "/" is not lost among the words around it.
 */
function Names({ names, style }: { names: string[]; style: NamesStyle }) {
  if (style === "plain") return <>{formatList(names)}</>;

  return (
    <>
      {formatListToParts(names).map((part, index) =>
        part.type === "element" ? (
          <span key={index} className="agm-device-name">
            {part.value}
          </span>
        ) : (
          part.value
        ),
      )}
    </>
  );
}

/** A sentence with one `%s`, filled with names. */
function withNames(sentence: string, names: string[], style: NamesStyle): React.ReactNode {
  return (
    <Interpolate sentence={sentence}>{() => <Names names={names} style={style} />}</Interpolate>
  );
}

/** What a disk or a RAID is used for, one value per line. */
function driveUsedFor(
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  groups: string[],
  boots: boolean,
  isIdle: boolean,
  style: NamesStyle,
): React.ReactNode[] {
  if (isIdle) {
    // TRANSLATORS: what a disk added to the installation is used for, when
    // nothing is planned on it yet; the installer leaves it untouched.
    return [_("Nothing yet (skipped)")];
  }

  const lines: React.ReactNode[] = [];

  if (groups.length && groups.length <= NAMES_PER_LINE) {
    lines.push(
      withNames(
        // TRANSLATORS: what a disk is used for: it holds the LVM volume
        // group(s) named by %s, such as "system" or "system and data".
        n_("Volume group %s", "Volume groups %s", groups.length),
        groups,
        style,
      ),
    );
  } else if (groups.length) {
    lines.push(
      sprintf(
        // TRANSLATORS: what a disk is used for: it holds %d LVM volume groups.
        n_("%d volume group", "%d volume groups", groups.length),
        groups.length,
      ),
    );
  }

  if (device.filesystem) {
    lines.push(
      device.mountPath
        ? withNames(
            // TRANSLATORS: what a disk is used for: a single file system over
            // all of it, mounted at %s, such as "/home".
            _("%s (whole device)"),
            [device.mountPath],
            style,
          )
        : // TRANSLATORS: what a disk is used for: a single file system over all
          // of it, not mounted anywhere.
          _("File system (whole device)"),
    );
  } else {
    const paths = mountPathsOf(device.partitions || []);
    if (paths.length) lines.push(<Names names={paths} style={style} />);
  }

  if (boots) {
    // TRANSLATORS: what a disk is used for: it holds the partitions the
    // machine needs to start, such as the EFI system partition.
    lines.push(_("Boot partitions"));
  }

  return lines;
}

/** What a volume group is used for. */
function volumeGroupUsedFor(group: ConfigModel.VolumeGroup, style: NamesStyle): React.ReactNode[] {
  const paths = mountPathsOf(group.logicalVolumes || []);
  if (paths.length) return [<Names key="paths" names={paths} style={style} />];

  // TRANSLATORS: what a volume group is used for, when no logical volume is
  // planned in it yet.
  return [_("Nothing yet")];
}

/* ---- Existing data -------------------------------------------------------- */

/** What happens to what a device holds today, counted. */
type ExistingData = {
  /** Partitions or logical volumes: what the counts are of. */
  unit: "partition" | "logicalVolume";
  /** How many the device holds today. */
  total: number;
  /** Deleted for sure. */
  deleted: number;
  /** Formatted for the new system, which erases what they hold. */
  formatted: number;
  /** Deleted only if the space is needed. */
  mayDelete: number;
  /** Shrunk only if the space is needed. */
  mayShrink: number;
  /** Mounted as they are by the new system. */
  reused: number;
  /**
   * Whether everything not reused is to be deleted, as a whole-device choice
   * rather than one by one: said as "all except reused" instead of counted.
   */
  isDeleteAll: boolean;
};

/**
 * What happens to what a disk, a RAID or a volume group holds today, or
 * nothing where there is nothing on it yet.
 */
function existingDataOf(
  volumes: Volume[],
  current: System.Device[],
  unit: ExistingData["unit"],
  spacePolicy: ConfigModel.SpacePolicy | undefined,
): ExistingData | null {
  if (!current.length) return null;

  const existing = volumes.filter((v) => !configModel.volume.isNew(v));
  const count = (test: (v: Volume) => boolean) => existing.filter(test).length;

  return {
    unit,
    total: current.length,
    deleted: count((v) => !!v.delete),
    formatted: count((v) => !v.delete && !!v.mountPath && !v.filesystem?.reuse),
    mayDelete: count((v) => !v.delete && !!v.deleteIfNeeded),
    mayShrink: count((v) => !v.delete && !!v.resizeIfNeeded),
    reused: count((v) => !v.delete && !!v.mountPath && !!v.filesystem?.reuse),
    isDeleteAll: spacePolicy === "delete",
  };
}

function existingDataOfDrive(
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  current: System.Device | undefined,
): ExistingData | null {
  return existingDataOf(
    device.partitions || [],
    current?.partitions || [],
    "partition",
    device.spacePolicy,
  );
}

function existingDataOfVolumeGroup(
  group: ConfigModel.VolumeGroup,
  current: System.Device | undefined,
): ExistingData | null {
  if (!group.name) return null;
  return existingDataOf(
    group.logicalVolumes || [],
    current?.logicalVolumes || [],
    "logicalVolume",
    group.spacePolicy,
  );
}

/** Whether the device loses, or may lose, data. Shown in bold. */
function losesData(data: ExistingData): boolean {
  return data.deleted + data.formatted + data.mayDelete > 0;
}

/* The pieces each wording set is built from. Sentences composed from pieces
   do not translate well; acceptable while the wording is being decided. */

function shortWording(data: ExistingData): string {
  const isPartition = data.unit === "partition";
  const erased = data.deleted + data.formatted;

  if (erased && erased === data.total) return _("All deleted");
  if (data.isDeleteAll && data.reused) return _("All deleted except reused");

  if (erased) {
    if (data.mayShrink || data.mayDelete) {
      return sprintf(
        data.mayDelete
          ? // TRANSLATORS: what happens to the existing data of a device: %d
            // partitions or logical volumes are deleted, and others may be.
            _("%d deleted, others may be deleted")
          : // TRANSLATORS: what happens to the existing data of a device: %d
            // partitions or logical volumes are deleted, and others may be
            // made smaller.
            _("%d deleted, others may be shrunk"),
        erased,
      );
    }
    return sprintf(
      isPartition
        ? n_("%d partition deleted", "%d partitions deleted", erased)
        : n_("%d logical volume deleted", "%d logical volumes deleted", erased),
      erased,
    );
  }

  if (data.mayDelete && data.mayShrink) return _("May be deleted or shrunk");
  if (data.mayDelete) return _("May be deleted");
  if (data.mayShrink) return _("May be shrunk");
  return _("Kept");
}

function verboseWording(data: ExistingData): string {
  const isPartition = data.unit === "partition";
  const erased = data.deleted + data.formatted;

  if (erased && erased === data.total) return _("All content deleted");
  if (data.isDeleteAll && data.reused) {
    return isPartition
      ? _("All content deleted except reused partitions")
      : _("All content deleted except reused logical volumes");
  }

  if (erased) {
    const done = sprintf(
      isPartition
        ? n_("%d partition deleted", "%d partitions deleted", erased)
        : n_("%d logical volume deleted", "%d logical volumes deleted", erased),
      erased,
    );
    if (data.mayDelete) {
      return `${done}, ${isPartition ? _("other partitions may be deleted") : _("other logical volumes may be deleted")}`;
    }
    if (data.mayShrink) {
      return `${done}, ${isPartition ? _("other partitions may be shrunk") : _("other logical volumes may be shrunk")}`;
    }
    return done;
  }

  if (data.mayDelete) {
    return isPartition ? _("Partitions may be deleted") : _("Logical volumes may be deleted");
  }
  if (data.mayShrink) {
    return isPartition ? _("Partitions may be shrunk") : _("Logical volumes may be shrunk");
  }
  return isPartition ? _("Current partitions kept") : _("Current logical volumes kept");
}

function bluntWording(data: ExistingData): string {
  const erased = data.deleted + data.formatted;

  if (erased && erased === data.total) return _("Wiped");
  if (data.isDeleteAll && data.reused) return _("Wiped except reused");
  if (erased) {
    const done = sprintf(_("%d deleted"), erased);
    if (data.mayDelete) return `${done}, ${_("may delete more")}`;
    if (data.mayShrink) return `${done}, ${_("may shrink")}`;
    return done;
  }
  if (data.mayDelete && data.mayShrink) return _("May delete or shrink");
  if (data.mayDelete) return _("May delete");
  if (data.mayShrink) return _("May shrink");
  return _("No changes");
}

function lossWording(data: ExistingData): string {
  if (data.deleted + data.formatted) return _("Data loss");
  if (data.mayDelete) return _("Possible data loss");
  if (data.mayShrink) return _("All kept, may be shrunk");
  return _("All kept");
}

const WORDINGS: Record<ExistingDataWording, (data: ExistingData) => string> = {
  short: shortWording,
  verbose: verboseWording,
  blunt: bluntWording,
  loss: lossWording,
};

/**
 * The "Existing data" cell. A device with nothing on it yet shows nothing, and
 * tells screen readers so, rather than leaving them on a cell read as "blank".
 */
function ExistingDataCell({
  data,
  wording,
}: {
  data: ExistingData | null;
  wording: ExistingDataWording;
}) {
  if (!data) {
    return (
      <Text srOnly>
        {
          // TRANSLATORS: read by screen readers in the "Existing data" column
          // for a device that holds nothing yet, such as a volume group the
          // installation creates.
          _("No existing data")
        }
      </Text>
    );
  }

  const text = WORDINGS[wording](data);
  return losesData(data) ? <Text isBold>{text}</Text> : <>{text}</>;
}

export {
  driveUsedFor,
  volumeGroupUsedFor,
  existingDataOfDrive,
  existingDataOfVolumeGroup,
  ExistingDataCell,
};
export type { ExistingData };
