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
import { Stack, StackItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { formattedPath } from "~/components/storage/utils";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { Partitionable, ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

type Volume = ConfigModel.Partition | ConfigModel.LogicalVolume;

/* ---- Used for ------------------------------------------------------------- */

/** The mount points of the volumes the installation creates or reuses. */
function mountPathsOf(volumes: Volume[]): string[] {
  return volumes.filter((v) => v.mountPath).map((v) => v.mountPath);
}

function isNew(volume: Volume): boolean {
  return !volume.name && !!volume.mountPath;
}

function isUsed(volume: Volume): boolean {
  return volume.name && !!volume.mountPath;
}

/**
 * Names such as mount points or volume groups, joined the way the language
 * joins a list.
 */
function Names({ names }: { names: string[] }) {
  return <>{formatList(names.map((n) => formattedPath(n)))}</>;
}

/** A sentence with one `%s`, filled with names. */
function withNames(sentence: string, names: string[]): React.ReactNode {
  return <Interpolate sentence={sentence}>{() => <Names names={names} />}</Interpolate>;
}

/** What a disk or a RAID is used for, one value per line. */
function driveUsedFor(
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  groups: string[],
  boots: boolean,
  isIdle: boolean,
): React.ReactNode[] {
  if (isIdle) {
    // TRANSLATORS: what a disk added to the installation is used for, when
    // nothing is planned on it yet; the installer leaves it untouched.
    return [_("Nothing yet (skipped)")];
  }

  if (device.filesystem) {
    return device.filesystem.reuse
      ? // TRANSLATORS: what a disk is used for: a single file system over
        // all of it, mounted at %s, such as "/home".
        [withNames(_("Mounting it at %s"), [device.mountPath])]
      : // TRANSLATORS: what a disk is used for: a single file system over
        // all of it, formatted and mounted at %s, such as "/home".
        [withNames(_("Formating it for %s"), [device.mountPath])];
  }

  const lines: React.ReactNode[] = [];

  const partitions = device.partitions || [];
  const paths = mountPathsOf(partitions);

  if (paths.includes("/")) {
    if (boots) {
      lines.push(_("Installing and booting the system"));
    } else {
      lines.push(_("Installing the system"));
    }
  } else if (boots) {
    lines.push(_("Booting the system"));
  }

  if (groups.length && groups.length <= NAMES_PER_LINE) {
    lines.push(
      withNames(
        // TRANSLATORS: what a disk is used for: it holds the LVM volume
        // group(s) named by %s, such as "system" or "system and data".
        n_("Hosting the volume group %s", "Hosting the volume groups %s", groups.length),
        groups,
      ),
    );
  } else if (groups.length) {
    lines.push(
      sprintf(
        // TRANSLATORS: what a disk is used for: it holds %d LVM volume groups.
        n_("Hosting %d LVM volume group", "Hosting %d LVM volume groups", groups.length),
        groups.length,
      ),
    );
  }

  const usedPartitions = partitions.filter((p) => isUsed(p) && p.mountPath !== "/");
  if (usedPartitions.length) {
    const usedPaths = mountPathsOf(usedPartitions);

    if (usedPaths.length <= NAMES_PER_LINE) {
      lines.push(
        withNames(
          n_("%s on an existing partition", "%s on existing partitions", usedPaths.length),
          usedPaths,
        ),
      );
    } else {
      lines.push(
        sprintf(
          n_("%d existing partition", "%d existing partitions", usedPartitions.length),
          usedPartitions.length,
        ),
      );
    }
  }

  const newPartitions = partitions.filter((p) => isNew(p));
  if (!paths.includes("/") && newPartitions.length) {
    const newPartPaths = mountPathsOf(newPartitions);
    if (groups.length) {
      if (newPartPaths.length <= NAMES_PER_LINE) {
        lines.push(
          withNames(
            n_("%s as an additional partition", "%s as additional partitions", newPartPaths.length),
            newPartPaths,
          ),
        );
      } else {
        lines.push(
          sprintf(
            n_("%d additional partition", "%d additional partitions", newPartitions.length),
            newPartitions.length,
          ),
        );
      }
    } else {
      if (newPartPaths.length <= NAMES_PER_LINE) {
        lines.push(withNames(_("%s"), newPartPaths));
      } else {
        lines.push(
          sprintf(
            n_("%d new partition", "%d new partitions", newPartitions.length),
            newPartitions.length,
          ),
        );
      }
    }
  }

  return lines;
}

/** What a volume group is used for. */
function volumeGroupUsedFor(group: ConfigModel.VolumeGroup): React.ReactNode[] {
  const logicalVols = group.logicalVolumes || [];
  const newVols = logicalVols.filter((v) => isNew(v));
  const usedVols = logicalVols.filter((v) => isUsed(v));

  // TRANSLATORS: what a volume group is used for, when no logical volume is
  // planned in it yet.
  if (!newVols.length && !usedVols.length) return [_("Nothing yet")];

  const lines: React.ReactNode[] = [];
  const newPaths = mountPathsOf(newVols);
  const usedPaths = mountPathsOf(usedVols);
  const isSystem = newPaths.includes("/") || usedPaths.includes("/");

  if (isSystem) {
    lines.push(_("Installing the system"));
  }

  const relevantUsedPaths = usedPaths.filter((p) => p !== "/");
  if (relevantUsedPaths.length) {
    if (relevantUsedPaths.length <= NAMES_PER_LINE) {
      lines.push(
        withNames(
          n_(
            "%s on an existing logical volume",
            "%s on existing logical volumes",
            relevantUsedPaths.length,
          ),
          relevantUsedPaths,
        ),
      );
    } else {
      lines.push(
        sprintf(
          n_("%d existing logical volume", "%d existing logical volumes", relevantUsedPaths.length),
          relevantUsedPaths.length,
        ),
      );
    }
  }

  if (!isSystem && newVols.length) {
    if (newPaths.length <= NAMES_PER_LINE) {
      lines.push(withNames(_("%s"), newPaths));
    } else {
      lines.push(
        sprintf(
          n_("%d new logical volume", "%d new logical volumes", newVols.length),
          newVols.length,
        ),
      );
    }
  }

  return lines;
}

function isFormatted(partition: ConfigModel.Partition): boolean {
  return partition.name && partition.mountPath && !partition.filesystem?.reuse;
}

function mayShrink(partition: ConfigModel.Partition, device): boolean {
  const devPart = device.partitions.find((p) => p.name === partition.name);
  return devPart.block?.shrinking?.supported;
}

/**
 * TODO: just a sketch
 */
const existingVgActions = (group: ConfigModel.VolumeGroup, device): TranslatedString[] => {
  /* Nothing on the drive today, nothing to say about what happens to it. */
  if (!device?.logicalVolumes?.length) return [];

  return [_("TODO: what happens to existing LVs")];
};

/**
 * This considers only the case in which the drive contains partitions initially and will contain
 * partitions after installation.
 */
const existingDriveActions = (drive: Partitionable.Device, device): TranslatedString[] => {
  /* Nothing on the drive today, nothing to say about what happens to it. */
  if (!device?.partitions?.length) return [];

  const parts = drive?.partitions || [];
  const formatParts = parts.filter((p) => isFormatted(p));
  const toShrink = parts.filter((p) => p.resizeIfNeeded);
  const canShrink = toShrink.filter((p) => mayShrink(p, device)).length;
  const deleted = parts.filter((p) => p.delete).length;
  const total = device.partitions.length;

  const lines: TranslatedString[] = [];

  if (formatParts.length) {
    lines.push(
      n_(
        "An existing partition will be formatted",
        "%d existing partitions will be formatted",
        formatParts.length,
      ),
    );
  }

  if (canShrink === 1) {
    lines.push(_("An existing partition may be shrunk"));
  }

  if (canShrink > 1) {
    lines.push(_("Some existing partitions may be shrunk"));
  }

  if (deleted + formatParts.length === total) {
    lines.push(_("All disk content will be deleted"));
  } else if (!deleted && !formatParts.length) {
    if (canShrink) {
      lines.push(_("The current data will be kept"));
    } else {
      lines.push(_("The current data and partitions will be kept"));
    }
  } else if (deleted > 0) {
    lines.push(
      sprintf(
        n_("%d partition will be deleted", "%d partitions will be deleted", deleted),
        deleted,
      ),
    );
  }

  return lines;
};

/**
 * The "Existing data" cell. A device with nothing on it yet shows nothing, and
 * tells screen readers so, rather than leaving them on a cell read as "blank".
 */
function ExistingDataCell({
  config,
  device,
}: {
  config: Partitionable.Device | ConfigModel.VolumeGroup;
  device: System.Device | null;
}) {
  const isVolumeGroup = "vgName" in config;
  const lines = isVolumeGroup
    ? existingVgActions(config, device)
    : existingDriveActions(config, device);

  if (lines.length) {
    return (
      <Stack>
        {lines.map((line) => (
          <StackItem key={line}>{line}</StackItem>
        ))}
      </Stack>
    );
  }

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

export { driveUsedFor, volumeGroupUsedFor, ExistingDataCell };
