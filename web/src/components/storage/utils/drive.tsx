/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import { _, n_, formatList, TranslatedString } from "~/i18n";
import { baseName, formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * String to identify the drive.
 */
const label = (drive: ConfigModel.Drive): string => {
  return baseName(drive.name);
};

function isFormatted(partition: ConfigModel.Partition): boolean {
  return partition.name && partition.mountPath && !partition.filesystem?.reuse;
}

function isMounted(partition: ConfigModel.Partition): boolean {
  return partition.name && partition.mountPath && partition.filesystem?.reuse;
}

function mayShrink(partition: ConfigModel.Partition, device): boolean {
  const devPart = device.partitions.find((p) => p.name === partition.name);
  return devPart.block?.shrinking?.supported;
}

/**
 * This considers only the case in which the drive contains partitions initially and will contain
 * partitions after installation.
 */
const contentActionsSummary = (drive: ConfigModel.Drive, device): TranslatedString[] => {
  /* Nothing on the drive today, nothing to say about what happens to it. */
  if (!device?.partitions?.length) return [];

  const parts = drive?.partitions || [];
  const mountPaths = parts.filter((p) => isMounted(p)).map((p) => formattedPath(p.mountPath));
  const formatPaths = parts.filter((p) => isFormatted(p)).map((p) => formattedPath(p.mountPath));
  const toShrink = parts.filter((p) => p.resizeIfNeeded);
  const canShrink = toShrink.filter((p) => mayShrink(p, device)).length;
  const deleted = parts.filter((p) => p.delete).length;
  const total = device.partitions.length;

  const lines: TranslatedString[] = [];

  if (mountPaths.length && formatPaths.length) {
    lines.push(
      sprintf(_("Use existing partitions for %s"), formatList(mountPaths.concat(formatPaths))),
    );
  } else if (mountPaths.length) {
    lines.push(
      sprintf(
        n_(
          "Mount an existing partition at %s",
          "Mount existing partitions at %s",
          mountPaths.length,
        ),
        formatList(mountPaths),
      ),
    );
  } else if (formatPaths.length) {
    lines.push(
      sprintf(
        n_(
          "Format an existing partition for %s",
          "Format existing partitions for %s",
          formatPaths.length,
        ),
        formatList(formatPaths),
      ),
    );
  }

  if (canShrink === 1) {
    lines.push(_("An existing partition may be shrunk"));
  }

  if (canShrink > 1) {
    lines.push(_("Some existing partitions may be shrunk"));
  }

  if (deleted + formatPaths.length === total) {
    lines.push(_("All disk content will be deleted"));
  } else if (!deleted && !formatPaths.length) {
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

const contentDescription = (drive: ConfigModel.Drive): TranslatedString[] => {
  const newPartitions = drive.partitions.filter((p) => !p.name);
  const lines: TranslatedString[] = [];

  if (drive.filesystem) {
    if (drive.mountPath) {
      lines.push(sprintf(_("Use the whole device %s"), formattedPath(drive.mountPath)));
    }

    // I don't think this can happen, maybe when loading a configuration not created with the UI
    lines.push(_("Use the whole device for a file system"));
  }

  if (newPartitions.length) {
    const mountPaths = newPartitions.map((p) => formattedPath(p.mountPath));
    lines.push(
      sprintf(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        n_("Create a partition for %s", "Create new partitions for %s", mountPaths.length),
        formatList(mountPaths),
      ),
    );
  }

  return lines;
};

export { label, contentActionsSummary, contentDescription };
