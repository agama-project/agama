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

import { sprintf } from "sprintf-js";
import configModel from "~/model/storage/config-model";
import { _, n_, TranslatedString } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

/**
 * Why the plan cannot be moved off this device, where it cannot.
 *
 * "Use another device" moves everything planned for one device to another one.
 * Some of what a device carries cannot travel: a file system that is being kept
 * is the disk it is on, and so are the partitions the plan reuses. Other things
 * can travel but are held here by a decision taken elsewhere, and the honest
 * answer names that decision rather than the act it forbids.
 *
 * So this is a reason and never a refusal on its own. What offers the act keeps
 * calling it what it is called and prints this beside it: a reader looking for
 * the act still finds it and learns what would have to change first, where an
 * offer renamed into its own refusal leaves them hunting for something that is
 * no longer there.
 *
 * Read by everything that offers the act, so that two places cannot disagree
 * about whether it is possible.
 */
function whyItCannotMove(
  config: ConfigModel.Config,
  device: Partitionable.Device,
): TranslatedString | null {
  if (device.filesystem?.reuse) {
    // TRANSLATORS: why the installation cannot be moved to a different device.
    return _("Its file system is being kept as it is, and a file system cannot be moved.");
  }

  if (configModel.partitionable.isReusingPartitions(device)) {
    // TRANSLATORS: why the installation cannot be moved to a different device.
    return _("Partitions already on this device are being reused, and they cannot be moved.");
  }

  /* A device carrying nothing of its own, chosen for something that lives on
     it. Where it also holds mount paths those can travel, so the act is offered
     and what is stuck here is not the whole of it. */
  if (configModel.partitionable.usedMountPaths(device).length) return null;

  const groups = configModel.partitionable.filterVolumeGroups(config, device);

  if (groups.length === 1) {
    return sprintf(
      // TRANSLATORS: why the installation cannot be moved to a different
      // device. %s is the name of an LVM volume group, such as "system".
      _("The LVM volume group '%s' is built on this device."),
      groups[0].vgName,
    );
  }

  if (groups.length > 1) {
    return sprintf(
      // TRANSLATORS: why the installation cannot be moved to a different
      // device. %d is how many LVM volume groups are built on it.
      n_(
        "%d LVM volume group is built on this device.",
        "%d LVM volume groups are built on this device.",
        groups.length,
      ),
      groups.length,
    );
  }

  if (configModel.boot.hasExplicitDevice(config, device.name)) {
    // TRANSLATORS: why the installation cannot be moved to a different device,
    // and where to change the decision that holds it here.
    return _("It was chosen for booting. Change that in Boot options first.");
  }

  return null;
}

export { whyItCannotMove };
