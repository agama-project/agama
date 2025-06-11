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

import React from "react";
import MenuButton from "~/components/core/MenuButton";
import NewVgMenuOption from "./NewVgMenuOption";
import { useLongestDiskTitle } from "~/hooks/storage/system";
import { deviceLabel } from "~/components/storage/utils";
import * as model from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export type MdRaidDeviceMenuProps = { raid: model.MdRaid; selected: StorageDevice };

/**
 * Menu with options to configure an MdRaid entry for an existing RAID.
 */
export default function MdRaidDeviceMenu({
  raid,
  selected,
}: MdRaidDeviceMenuProps): React.ReactNode {
  const longestTitle = useLongestDiskTitle();

  return (
    <MenuButton
      menuProps={{
        "aria-label": sprintf(_("Device %s menu"), raid.name),
        popperProps: { minWidth: `min(${longestTitle * 0.75}em, 75vw)`, width: "max-content" },
      }}
      toggleProps={{
        className: "agm-inline-toggle",
      }}
      items={[<NewVgMenuOption key="add-vg-option" device={raid} />]}
    >
      {<b>{deviceLabel(selected)}</b>}
    </MenuButton>
  );
}
