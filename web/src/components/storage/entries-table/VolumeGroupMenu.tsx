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
import { useLocation, useNavigate } from "react-router";
import { sprintf } from "sprintf-js";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/core/RowMenuToggle";
import SearchedVolumeGroupMenu from "~/components/storage/entries-table/SearchedVolumeGroupMenu";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { baseName, formattedPath } from "~/components/storage/utils";
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { useConfigModel, useDeleteVolumeGroup } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { _, n_, formatList } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { ConfigModel } from "~/model/storage/config-model";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type VolumeGroupMenuProps = {
  /** The volume group in the configuration. */
  group: ConfigModel.VolumeGroup;
  /** Where it is in the configuration. Given on the row, not in the panel. */
  subject?: DetailsSubject;
};

/**
 * The menu of an LVM volume group. A group that already exists on the system
 * gets the menu of existing groups; one this configuration creates can be
 * edited or dropped.
 */
export default function VolumeGroupMenu({ group, subject }: VolumeGroupMenuProps): React.ReactNode {
  const config = useConfigModel();
  const navigate = useNavigate();
  const location = useLocation();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const lvs = (group.logicalVolumes || []).map((lv) => formattedPath(lv.mountPath));
  const targetDevices = configModel.volumeGroup.filterTargetDevices(config, group);
  const convert = targetDevices.length === 1 && !!lvs.length;
  const { openDetails } = useDeviceDetails();
  // TRANSLATORS: %s is a volume group name, such as "system"
  const label = sprintf(_("Actions for %s"), group.vgName);
  let description: string;

  if (group.name) {
    return <SearchedVolumeGroupMenu entry={group} subject={subject} />;
  }

  if (lvs.length) {
    if (convert) {
      const diskName = baseName(targetDevices[0].name, { truncate: true });
      description = sprintf(
        n_(
          // TRANSLATORS: %1$s is a list of formatted mount points like '"/", "/var" and "swap"' (or
          // a single mount point in the singular case). %2$s is a disk name like sda.
          "%1$s will be created as a partition at %2$s",
          "%1$s will be created as partitions at %2$s",
          lvs.length,
        ),
        formatList(lvs),
        diskName,
      );
    } else {
      description = n_(
        "The logical volume will also be deleted",
        "The logical volumes will also be deleted",
        lvs.length,
      );
    }
  }

  return (
    <MenuButton
      menuProps={{ "aria-label": label, popperProps: { position: "end" } }}
      customToggle={<RowMenuToggle label={label} />}
      items={[
        /* First, as the main action of the row. */
        ...(subject
          ? [
              <MenuButtonItem
                key="open"
                icon={<Icon size="md" name="article" />}
                /* Screen readers get the full name, since a group name alone, as in
                   "Configure system", is ambiguous; on screen, the row says which
                   group. */
                aria-label={sprintf(
                  // TRANSLATORS: opens a volume group panel. %s is its name, such as "system"
                  _("Configure %s LVM volume group"),
                  group.vgName,
                )}
                onClick={() => openDetails(subject)}
                description={_("Customize how the volume group will be used")}
              >
                {/* TRANSLATORS: opens the details panel of a volume group */}
                {_("Details")}
              </MenuButtonItem>,
            ]
          : []),
        /* Only on the row: the panel links to the same form. */
        ...(subject
          ? [
              <MenuButtonItem
                key="edit"
                icon={<Icon size="md" name="edit_square" />}
                description={_("Change how the volume group will be created")}
                onClick={() =>
                  navigate({
                    pathname: generateEncodedPath(PATHS.volumeGroup.edit, {
                      id: String(subject.index),
                    }),
                    search: location.search,
                  })
                }
              >
                {/* TRANSLATORS: changes which disks a volume group is built on and
                    what it holds */}
                {_("Edit")}
              </MenuButtonItem>,
            ]
          : []),
        <Divider key="before-remove" />,
        <MenuButtonItem
          key="remove"
          icon={<Icon size="md" name="delete" />}
          isDanger
          description={description}
          onClick={() => deleteVolumeGroup(group.vgName, convert)}
        >
          {_("Delete volume group")}
        </MenuButtonItem>,
      ]}
    />
  );
}
