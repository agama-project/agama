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
import {
  DataListAction,
  DataListCell,
  DataListItemCells,
  DataListItemRow,
  Divider,
  Flex,
} from "@patternfly/react-core";
import { useNavigate, generatePath } from "react-router-dom";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import MenuButton from "~/components/core/MenuButton";
import NestedContent from "~/components/core/NestedContent";
import DeviceHeader from "~/components/storage/DeviceHeader";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import Icon from "~/components/layout/Icon";
import { STORAGE as PATHS } from "~/routes/paths";
import { model } from "~/types/storage";
import { baseName, formattedPath } from "~/components/storage/utils";
import { contentDescription } from "~/components/storage/utils/volume-group";
import { useDeleteVolumeGroup } from "~/hooks/storage/volume-group";
import { useDeleteLogicalVolume } from "~/hooks/storage/logical-volume";
import { _, n_, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { isEmpty } from "radashi";

const DeleteVgOption = ({ vg }: { vg: model.VolumeGroup }) => {
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const lvs = vg.logicalVolumes.map((lv) => formattedPath(lv.mountPath));
  const targetDevices = vg.getTargetDevices();
  const convert = targetDevices.length === 1 && !!lvs.length;
  let description;

  if (lvs.length) {
    if (convert) {
      const diskName = baseName(targetDevices[0].name, true);
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
    <MenuButton.Item
      isDanger
      key="delete-volume-group"
      itemId="delete-volume-group"
      description={description}
      onClick={() => deleteVolumeGroup(vg.vgName, convert)}
    >
      {_("Delete volume group")}
    </MenuButton.Item>
  );
};

const EditVgOption = ({ vg }: { vg: model.VolumeGroup }) => {
  const navigate = useNavigate();

  return (
    <MenuButton.Item
      key="edit-volume-group"
      itemId="edit-volume-group"
      description={_("Modify settings and physical volumes")}
      role="menuitem"
      onClick={() => navigate(generatePath(PATHS.volumeGroup.edit, { id: vg.vgName }))}
    >
      {_("Edit volume group")}
    </MenuButton.Item>
  );
};

const VgMenu = ({ vg }: { vg: model.VolumeGroup }) => {
  return (
    <MenuButton
      toggleProps={{ variant: "plain" }}
      items={[<EditVgOption key="edit" vg={vg} />, <DeleteVgOption key="delete" vg={vg} />]}
    >
      <Text className="action-text">{_("Change")}</Text>{" "}
      <Icon name="more_horiz" className="agm-strong-icon" />
    </MenuButton>
  );
};

const VgHeader = ({ vg }: { vg: model.VolumeGroup }) => {
  const title = vg.logicalVolumes.length
    ? _("Create LVM volume group %s")
    : _("Empty LVM volume group %s");

  return <DeviceHeader title={title}>{vg.vgName}</DeviceHeader>;
};

const LogicalVolumes = ({ vg }: { vg: model.VolumeGroup }) => {
  const navigate = useNavigate();
  const deleteLogicalVolume = useDeleteLogicalVolume();

  const editPath = (lv: model.LogicalVolume): string => {
    return generatePath(PATHS.volumeGroup.logicalVolume.edit, {
      id: vg.vgName,
      logicalVolumeId: encodeURIComponent(lv.mountPath),
    });
  };
  const deleteLv = (lv: model.LogicalVolume) => deleteLogicalVolume(vg.vgName, lv.mountPath);

  const pathToNewLv = generatePath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName });

  if (isEmpty(vg.logicalVolumes)) {
    return (
      <Link to={pathToNewLv} variant="link" isInline>
        {_("Add logical volume")}
      </Link>
    );
  }

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Text isBold>{_("Logical volumes")}</Text>
      <MenuButton
        menuProps={{
          "aria-label": _("Logical volumes"),
        }}
        toggleProps={{
          variant: "plainText",
        }}
        items={[
          vg.logicalVolumes
            .map((lv) => {
              return (
                <MountPathMenuItem
                  key={lv.mountPath}
                  device={lv}
                  editPath={editPath(lv)}
                  deleteFn={() => deleteLv(lv)}
                />
              );
            })
            .concat(
              <Divider component="li" />,
              <MenuButton.Item
                key="add-logical-volume"
                itemId="add-logical-volume"
                onClick={() =>
                  navigate(generatePath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName }))
                }
              >
                {_("Add logical volume")}
              </MenuButton.Item>,
            ),
        ]}
      >
        {contentDescription(vg)}
      </MenuButton>
    </Flex>
  );
};

export type VolumeGroupEditorProps = { vg: model.VolumeGroup };

export default function VolumeGroupEditor({ vg }: VolumeGroupEditorProps) {
  return (
    <DataListItemRow>
      <DataListItemCells
        dataListCells={[
          <DataListCell key="content">
            <Flex direction={{ default: "column" }}>
              <VgHeader vg={vg} />
              <NestedContent>
                <LogicalVolumes vg={vg} />
              </NestedContent>
            </Flex>
          </DataListCell>,
        ]}
      />
      {/** @ts-expect-error: props required but not used, see https://github.com/patternfly/patternfly-react/issues/9823 **/}
      <DataListAction>
        <VgMenu vg={vg} />
      </DataListAction>
    </DataListItemRow>
  );
}
