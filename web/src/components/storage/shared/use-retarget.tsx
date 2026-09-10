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
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { whyItCannotMove } from "~/components/storage/shared/retarget";
import { baseName } from "~/components/storage/utils";
import { isDrive, isMd, isVolumeGroup } from "~/model/storage/device";
import configModel from "~/model/storage/config-model";
import { useConfigModel, useConvertDevice } from "~/hooks/model/storage/config-model";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { _, TranslatedString } from "~/i18n";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

type Retarget = {
  /** Why the plan cannot move off this device, where it cannot. */
  cannotMove: TranslatedString | null;
  /** What the act costs, where there is anything here to carry. */
  note: TranslatedString | null;
  /** Offers the reader the choice of device. */
  open: () => void;
  /** The choice itself, rendered by whatever offered it. */
  selector: React.ReactNode;
};

/**
 * Moving everything planned for one device to another one.
 *
 * The page offers this act in more than one place, and the old interface let
 * two of them disagree about whether it was even possible: one refused it while
 * another opened a dialog holding a single device. Everything that offers it
 * asks here instead, so there is one answer to give.
 *
 * What is left to the caller is the control, because the two are genuinely
 * different: a button carries its reason in a line beside it, a menu item in
 * its own description.
 *
 * @example
 * const { cannotMove, open, selector } = useRetarget(entry, device);
 *
 * <Button isAriaDisabled={cannotMove !== null} onClick={open}>{_("Use another device")}</Button>
 * {selector}
 */
function useRetarget(entry: Partitionable.Device, device: Storage.Device | null): Retarget {
  const config = useConfigModel();
  const available = useAvailableDevices();
  const convertDevice = useConvertDevice();
  const [isOpen, setIsOpen] = React.useState(false);

  const name = baseName(entry.name);

  /* Whether the plan builds anything here, which is not the same question as
     whether this device has entries: a disk given whole to a volume group
     carries an entry per partition being cleared off it and builds nothing. */
  const plansContent =
    Boolean(entry.filesystem) ||
    configModel.partitionable.isAddingPartitions(entry) ||
    configModel.partitionable.isReusingPartitions(entry);

  /* Every device the configuration does not already hold, plus the one it is
     on, which is how the dialog shows what is currently chosen. */
  const taken = configModel
    .devices(config)
    .map((used) => used.name)
    .filter((used) => used !== entry.name);
  const targets = available.filter((candidate) => !taken.includes(candidate.name));

  return {
    cannotMove: whyItCannotMove(config, entry),
    note: plansContent
      ? sprintf(
          // TRANSLATORS: what happens to the plan when the reader picks a
          // different device for it. %s is a device name, such as "sda".
          _("Everything planned for %s moves to the device you pick."),
          name,
        )
      : null,
    open: () => setIsOpen(true),
    selector: isOpen && (
      <DeviceSelectorModal
        title={_("Use another device")}
        intro={
          plansContent
            ? sprintf(
                // TRANSLATORS: said above the list of devices to move the plan
                // to. %s is a device name, such as "sda".
                _("The plan stays as it is. Everything %s was going to hold moves."),
                name,
              )
            : // TRANSLATORS: said above the list of devices to move the plan to,
              // where the installer builds nothing on the current one.
              _("The plan stays as it is.")
        }
        selected={device}
        disks={targets.filter(isDrive)}
        mdRaids={targets.filter(isMd)}
        volumeGroups={targets.filter(isVolumeGroup)}
        onCancel={() => setIsOpen(false)}
        onConfirm={([target]: Storage.Device[]) => {
          setIsOpen(false);
          convertDevice(entry.name, target.name);
        }}
      />
    ),
  };
}

export { useRetarget };
