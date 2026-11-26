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
import { sprintf } from "sprintf-js";
import { formattedPath } from "~/components/storage/utils";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import Interpolate from "~/components/core/Interpolate";
import Text from "~/components/core/Text";
import CellValues from "~/components/storage/entries-table/CellValues";
import { NAMES_PER_LINE } from "~/components/storage/shared/naming";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { Partitionable, ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

type Volume = ConfigModel.Partition | ConfigModel.LogicalVolume;

/** The mount points of the given volumes. */
function mountPathsOf(volumes: Volume[]): string[] {
  return volumes.filter((v) => v.mountPath).map((v) => v.mountPath);
}

function isNew(volume: Volume): boolean {
  return !volume.name && !!volume.mountPath;
}

function isUsed(volume: Volume): boolean {
  return !!volume.name && !!volume.mountPath;
}

/** Names such as mount points, joined as a list in the current language. */
function Names({ names }: { names: string[] }) {
  return <>{formatList(names.map((n) => formattedPath(n)))}</>;
}

/** A sentence with one `%s`, filled with names. */
function withNames(sentence: string, names: string[]): React.ReactNode {
  return <Interpolate sentence={sentence}>{() => <Names names={names} />}</Interpolate>;
}

/** What a disk or a RAID is used for. */
function driveUsedFor(
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  groups: string[],
  boots: boolean,
  isIdle: boolean,
): React.ReactNode[] {
  if (isIdle) {
    // TRANSLATORS: a disk with nothing planned on it, which the installer leaves untouched
    return [_("Nothing yet (skipped)")];
  }

  if (device.filesystem) {
    return device.filesystem.reuse
      ? // TRANSLATORS: %s is a mount point, such as "/home"
        [withNames(_("Mounting it at %s"), [device.mountPath])]
      : // TRANSLATORS: %s is a mount point, such as "/home"
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
        // TRANSLATORS: %s is a list of volume group names, such as "system and data"
        n_("Hosting the volume group %s", "Hosting the volume groups %s", groups.length),
        groups,
      ),
    );
  } else if (groups.length) {
    lines.push(
      sprintf(
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

function isFormatted(vol: Volume): boolean {
  return !!vol.name && !!vol.mountPath && !vol.filesystem?.reuse;
}

function mayShrink(vol: Volume, device: System.Device): boolean {
  const devVols = device.logicalVolumes || device.partitions || [];
  const devVol = devVols.find((v) => v.name === vol.name);
  return !!devVol?.block?.shrinking?.supported;
}

const existingVgActions = (
  group: ConfigModel.VolumeGroup,
  device: System.Device | null,
): TranslatedString[] => {
  if (!device?.logicalVolumes?.length) return [];

  const lvs = group?.logicalVolumes || [];
  const formatLvs = lvs.filter((v) => isFormatted(v));
  const toShrink = lvs.filter((v) => v.resizeIfNeeded);
  const canShrink = toShrink.filter((v) => mayShrink(v, device)).length;
  const deleted = lvs.filter((v) => v.delete).length;
  const total = device.logicalVolumes.length;

  const lines: TranslatedString[] = [];

  if (formatLvs.length) {
    lines.push(
      n_(
        "An existing logical volume will be formatted",
        "%d existing logical volumes will be formatted",
        formatLvs.length,
      ),
    );
  }

  if (canShrink === 1) {
    lines.push(_("An existing logical volume may be shrunk"));
  }

  if (canShrink > 1) {
    lines.push(_("Some existing logical volumes may be shrunk"));
  }

  if (deleted + formatLvs.length === total) {
    lines.push(_("All volume group content will be deleted"));
  } else if (!deleted && !formatLvs.length) {
    if (canShrink) {
      lines.push(_("The current data will be kept"));
    } else {
      lines.push(_("The current data and logical volumes will be kept"));
    }
  } else if (deleted > 0) {
    lines.push(
      sprintf(
        n_("%d logical volume will be deleted", "%d logical volumes will be deleted", deleted),
        deleted,
      ),
    );
  }

  return lines;
};

/** What happens to the existing data of a disk or a RAID. */
const existingDriveActions = (
  drive: Partitionable.Device,
  device: System.Device | null,
  systemDevices: System.Device[],
): TranslatedString[] => {
  if (!device?.partitions?.length) {
    if (drive.filesystem?.reuse) return [_("The current data will be kept")];

    if (!device) return [];

    const withFs = !!device.filesystem;
    const withLvm = systemDevices.some((d) => d.volumeGroup?.physicalVolumes.includes(device.sid));
    const withRaid = systemDevices.some((d) => d.md?.devices.includes(device.sid));

    if (withFs || withLvm || withRaid) {
      return [_("All disk content will be deleted")];
    }

    return [];
  }

  const parts = drive?.partitions || [];
  const formatParts = parts.filter((p) => isFormatted(p));
  const toShrink = parts.filter((p) => p.resizeIfNeeded);
  const canShrink = toShrink.filter((p) => mayShrink(p, device)).length;
  const total = device.partitions.length;
  const deleted = drive.filesystem ? total : parts.filter((p) => p.delete).length;

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

  if (deleted === total) {
    lines.push(_("All disk content will be deleted"));
  } else if (deleted + formatParts.length === total) {
    lines.push(_("All data will be deleted"));
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
 * The "Existing data" cell. When there is nothing to say, only screen readers
 * get a text, so the cell is not read as blank.
 */
function ExistingDataCell({
  config,
  device,
  isIdle = false,
}: {
  config: Partitionable.Device | ConfigModel.VolumeGroup;
  device: System.Device | null;
  isIdle?: boolean;
}) {
  const systemDevices = useSystemDevices();
  const isVolumeGroup = "vgName" in config;
  const lines = isVolumeGroup
    ? existingVgActions(config, device)
    : existingDriveActions(config, device, systemDevices);

  if (isIdle) {
    return (
      <Text srOnly>
        {
          // TRANSLATORS: read by screen readers for a device with nothing planned yet
          _("No actions planned yet.")
        }
      </Text>
    );
  }

  if (lines.length) return <CellValues values={lines} />;

  return (
    <Text srOnly>
      {
        // TRANSLATORS: read by screen readers for a device holding nothing yet
        _("No existing data")
      }
    </Text>
  );
}

export { driveUsedFor, volumeGroupUsedFor, ExistingDataCell };
