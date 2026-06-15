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

/**
 * Presentation helpers shared across the storage forms (partition, logical
 * volume, and formattable device). These build view data (e.g. dropdown
 * options); they contain no validation logic.
 */

import React from "react";
import { sprintf } from "sprintf-js";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION } from "./fields";
import { deviceLabel, filesystemLabel } from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { Storage as System } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

export type FilesystemOption =
  | { value: string; label: React.ReactNode; description?: React.ReactNode }
  | { divider: true };

/**
 * Builds the filesystem dropdown options for a storage form.
 *
 * Always offers the "Default" (automatic) option followed by each compatible
 * filesystem type. When the device being reused can keep its current
 * filesystem, a "Current" option is prepended, separated by a divider.
 *
 * @param usableFilesystems - Filesystem types compatible with the mount point.
 * @param options.device - The device whose name labels the "Current" option.
 * @param options.canKeepCurrentFilesystem - Whether keeping the device's
 *   current filesystem is allowed (compatible with the mount point). The caller
 *   computes this, since the current filesystem may live on the device itself
 *   or on a child (e.g. a selected partition).
 */
export function buildFilesystemOptions(
  usableFilesystems: ConfigModel.FilesystemType[],
  options: { device?: System.Device; canKeepCurrentFilesystem?: boolean } = {},
): FilesystemOption[] {
  const formatOptions: FilesystemOption[] = [
    { value: FILESYSTEM_TYPE.AUTO, label: _("Default") },
    ...usableFilesystems.map((fs) => ({ value: fs, label: filesystemLabel(fs) })),
  ];

  const { device, canKeepCurrentFilesystem } = options;

  if (canKeepCurrentFilesystem && device) {
    return [
      {
        value: FILESYSTEM_ACTION.REUSE,
        label: _("Current"),
        description: sprintf(
          // TRANSLATORS: %s is a device name like "/dev/vdd2"
          _("Do not format %s and keep data"),
          deviceLabel(device),
        ),
      },
      { divider: true },
      ...formatOptions,
    ];
  }

  return formatOptions;
}
