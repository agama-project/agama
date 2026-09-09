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
import { Divider } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { sprintf } from "sprintf-js";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import SearchedVolumeGroupMenu from "~/components/storage/SearchedVolumeGroupMenu";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { useDeleteVolumeGroup } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";

export type VolumeGroupMenuProps = {
  /** The group as the configuration describes it. */
  group: ConfigModel.VolumeGroup;
};

/**
 * What can be done to an LVM volume group, from its row.
 *
 * A group the machine already has and a group this configuration is defining
 * are offered different things. The first can be swapped for another group that
 * exists, which is what the menu the rest of the interface uses is for. The
 * second exists only here, so what there is to do with it is change how it is
 * defined, or stop defining it.
 */
export default function VolumeGroupMenu({ group }: VolumeGroupMenuProps): React.ReactNode {
  const navigate = useNavigate();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const device = useDevice(group.name || "");
  // TRANSLATORS: names the menu of things that can be done to one LVM volume
  // group of the installation. %s is its name, such as "system".
  const label = sprintf(_("Actions for %s"), group.vgName);

  if (group.name) {
    return (
      <SearchedVolumeGroupMenu
        deviceConfig={group}
        device={device}
        toggle={<RowMenuToggle label={label} />}
      />
    );
  }

  return (
    <MenuButton
      menuProps={{ "aria-label": label, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={label} />}
      items={[
        <MenuButtonItem
          key="edit"
          onClick={() =>
            navigate(generateEncodedPath(PATHS.volumeGroup.edit, { id: group.vgName }))
          }
        >
          {/* TRANSLATORS: offered on an LVM volume group of the installation:
              change which disks it is built on and what it will hold. */}
          {_("Edit the volume group")}
        </MenuButtonItem>,
        <Divider key="before-remove" />,
        <MenuButtonItem
          key="remove"
          isDanger
          onClick={() => deleteVolumeGroup(group.vgName, false)}
        >
          {/* TRANSLATORS: offered on an LVM volume group of the installation:
              take it out of the plan altogether. */}
          {_("Do not use")}
        </MenuButtonItem>,
      ]}
    />
  );
}
