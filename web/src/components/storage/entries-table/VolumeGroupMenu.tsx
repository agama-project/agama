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
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import SearchedVolumeGroupMenu from "~/components/storage/entries-table/SearchedVolumeGroupMenu";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { baseName, formattedPath } from "~/components/storage/utils";
import { useSheet } from "~/components/storage/shared/use-sheet";
import { useConfigModel, useDeleteVolumeGroup } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { _, n_, formatList } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";

export type VolumeGroupMenuProps = {
  /** The group as the configuration describes it. */
  group: ConfigModel.VolumeGroup;
  /**
   * Where it is written. Given on the group's row, where opening its panel and
   * its edit form are among the offers; left out in the panel itself.
   */
  subject?: SheetEntry;
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
export default function VolumeGroupMenu({ group, subject }: VolumeGroupMenuProps): React.ReactNode {
  const config = useConfigModel();
  const navigate = useNavigate();
  const location = useLocation();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const lvs = (group.logicalVolumes || []).map((lv) => formattedPath(lv.mountPath));
  const targetDevices = configModel.volumeGroup.filterTargetDevices(config, group);
  const convert = targetDevices.length === 1 && !!lvs.length;
  const { openSheet } = useSheet();
  // TRANSLATORS: names the menu of things that can be done to one LVM volume
  // group of the installation. %s is its name, such as "system".
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
          // TRANSLATORS: %1$s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
          // single mount point in the singular case). %2$s is a disk name like sda.
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
        /* First, because it is what clicking the row does. */
        ...(subject
          ? [
              <MenuButtonItem
                key="open"
                /* A group's name is a word the reader chose, so the name alone
                   does not say what is being configured: "Configure system"
                   reads as a thing to do to the system. Said in full where the
                   item is heard rather than seen, and left at the verb on
                   screen, where the row around it says which group this is. */
                aria-label={sprintf(
                  // TRANSLATORS: opens the panel where one LVM volume group of
                  // the installation is read and changed. %s is its name, such
                  // as "system".
                  _("Configure %s LVM volume group"),
                  group.vgName,
                )}
                onClick={() => openSheet(subject)}
                description={_("Configure how the volume group will be used")}
              >
                {/* TRANSLATORS: opens the panel where one entry of the
                    installation is read and changed. */}
                {_("Details")}
              </MenuButtonItem>,
            ]
          : []),
        /* Only on the row. The group's panel offers the same form as a link
           under its properties, after what the form changes. */
        ...(subject
          ? [
              <MenuButtonItem
                key="edit"
                description={_("Change how the volume group will be created")}
                onClick={() =>
                  navigate({
                    pathname: generateEncodedPath(PATHS.volumeGroup.edit, {
                      id: String(subject.index),
                    }),
                    /* The page keeps its state across the form, open panel
                       included. */
                    search: location.search,
                  })
                }
              >
                {/* TRANSLATORS: offered on an LVM volume group of the
                    installation: change which disks it is built on and what it
                    will hold. */}
                {_("Edit")}
              </MenuButtonItem>,
            ]
          : []),
        <Divider key="before-remove" />,
        <MenuButtonItem
          key="remove"
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
