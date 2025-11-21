/*
 * Copyright (c) [2025] SUSE LLC
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

import { _, n_, formatList } from "~/i18n";
import { model } from "~/storage";
import { formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";

const contentDescription = (vg: model.VolumeGroup): string => {
  if (vg.logicalVolumes.length === 0) return _("No logical volumes are defined yet");

  const mountPaths = vg.logicalVolumes.map((v) => formattedPath(v.mountPath));
  return sprintf(
    // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
    // single mount point in the singular case).
    n_(
      "A new volume will be created for %s",
      "New volumes will be created for %s",
      mountPaths.length,
    ),
    formatList(mountPaths),
  );
};

export { contentDescription };
