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
import { sprintf } from "sprintf-js";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/core/RowMenuToggle";
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { baseName } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import SpacePolicyMenuItem from "~/components/storage/entries-table/SpacePolicyMenuItem";
import { useConfigModel, useDeleteVolumeGroup } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { ConfigModel } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

type RemoveVolumeGroupMenuItemProps = {
  deviceConfig: ConfigModel.VolumeGroup;
};

const RemoveVolumeGroupMenuItem = ({
  deviceConfig,
}: RemoveVolumeGroupMenuItemProps): React.ReactNode => {
  const deleteVolumeGroup = useDeleteVolumeGroup();

  const deleteFn = () => deleteVolumeGroup(deviceConfig.vgName, false);
  const description = _("Remove the configuration for this volume group");

  return (
    <MenuButtonItem
      key="delete"
      icon={<Icon size="md" name="do_not_disturb_on" />}
      isDanger
      description={description}
      onClick={deleteFn}
    >
      {_("Do not use")}
    </MenuButtonItem>
  );
};

export type SearchedVolumeGroupMenuProps = {
  /** The volume group in the configuration. */
  entry: ConfigModel.VolumeGroup;
  /** Where it is in the configuration. Without it, the menu offers no way to open its panel. */
  subject?: DetailsSubject;
};

/** The menu of an LVM volume group that already exists on the system. */
export default function SearchedVolumeGroupMenu({
  entry,
  subject,
}: SearchedVolumeGroupMenuProps): React.ReactNode {
  const config = useConfigModel();
  const { openDetails } = useDeviceDetails();

  const name = baseName(entry.name);
  // TRANSLATORS: %s is a volume group name, such as "system"
  const label = sprintf(_("Actions for %s"), name);

  const items = [
    /* First, as the main action of the row. Not in the panel itself. */
    ...(subject
      ? [
          <MenuButtonItem
            key="open"
            icon={<Icon size="md" name="article" />}
            description={_("Customize how the volume group will be used")}
            onClick={() => openDetails(subject)}
          >
            {/* TRANSLATORS: opens the details panel of a volume group */}
            {_("Details")}
          </MenuButtonItem>,
        ]
      : []),
  ];

  if (subject) {
    items.push(<SpacePolicyMenuItem key="space-policy" subject={subject} />);
  }

  // "Do not use" is offered only when there is another device to install on.
  if (configModel.hasAdditionalDevices(config)) {
    items.push(
      <Divider key="before-remove" />,
      <RemoveVolumeGroupMenuItem key="remove" deviceConfig={entry} />,
    );
  }

  return (
    <MenuButton
      menuProps={{
        "aria-label": label,
        popperProps: { position: "end", minWidth: "26rem" },
        hasFlyouts: true,
      }}
      customToggle={<RowMenuToggle label={label} />}
      items={items}
    />
  );
}
