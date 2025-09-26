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

import React, { forwardRef, useId } from "react";
import { Button, Divider, Flex, FlexItem, Title } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import MenuButton from "~/components/core/MenuButton";
import MenuHeader from "~/components/core/MenuHeader";
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import Icon from "~/components/layout/Icon";
import { STORAGE as PATHS } from "~/routes/paths";
import { model } from "~/types/storage";
import { baseName, formattedPath } from "~/components/storage/utils";
import { contentDescription } from "~/components/storage/utils/volume-group";
import { useDeleteVolumeGroup } from "~/hooks/storage/volume-group";
import { useDeleteLogicalVolume } from "~/hooks/storage/logical-volume";
import { generateEncodedPath } from "~/utils";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

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
      onClick={() => navigate(generateEncodedPath(PATHS.volumeGroup.edit, { id: vg.vgName }))}
    >
      {_("Edit volume group")}
    </MenuButton.Item>
  );
};

const VgHeader = ({ vg }: { vg: model.VolumeGroup }) => {
  const title = vg.logicalVolumes.length
    ? _("Create LVM volume group %s")
    : _("Empty LVM volume group %s");

  return <Title headingLevel="h4">{sprintf(title, vg.vgName)}</Title>;
};

type VgMenuToggleProps = CustomToggleProps & {
  vg: model.VolumeGroup;
};

const VgMenuToggle = forwardRef(({ vg, ...props }: VgMenuToggleProps, ref) => {
  return (
    <Button
      variant="link"
      ref={ref}
      style={{ display: "inline", width: "fit-content" }}
      className={[textStyles.fontFamilyHeading, textStyles.fontSizeMd].join(" ")}
      {...props}
    >
      <Flex
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapSm" }}
        flexWrap={{ default: "nowrap" }}
        style={{ whiteSpace: "normal", textAlign: "start" }}
      >
        <FlexItem>
          <VgHeader vg={vg} {...props} />
        </FlexItem>
        <FlexItem>
          <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
        </FlexItem>
      </Flex>
    </Button>
  );
});

const VgMenu = ({ vg }: { vg: model.VolumeGroup }) => {
  return (
    <MenuButton
      menuProps={{
        popperProps: { position: "end", maxWidth: "fit-content", minWidth: "fit-content" },
      }}
      customToggle={<VgMenuToggle vg={vg} />}
      items={[<EditVgOption key="edit" vg={vg} />, <DeleteVgOption key="delete" vg={vg} />]}
    />
  );
};

const LogicalVolumes = ({ vg }: { vg: model.VolumeGroup }) => {
  const navigate = useNavigate();
  const deleteLogicalVolume = useDeleteLogicalVolume();
  const ariaLabelId = useId();
  const toggleTextId = useId();
  const newLvPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName });
  const menuAriaLabel = sprintf(_("Logical volumes for %s"), vg.vgName);

  if (isEmpty(vg.logicalVolumes)) {
    return (
      <Link to={newLvPath} variant="link" isInline>
        {_("Add logical volume")}
      </Link>
    );
  }

  // FIXME: The markup is strange just for consistency with PartitionsMenu. See FIXME there.
  // The markup should be fixed in both places (eg. to use MenuGroup) in a consistent way.

  const description = n_(
    "The following logical volume will be created",
    "The following logical volumes will be created",
    vg.logicalVolumes.length,
  );

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Text isBold aria-hidden>
        {_("Details")}
      </Text>
      <Text id={ariaLabelId} srOnly>
        {menuAriaLabel}
      </Text>
      <MenuButton
        menuProps={{
          "aria-labelledby": ariaLabelId,
        }}
        toggleProps={{
          variant: "plainText",
          "aria-labelledby": `${ariaLabelId} ${toggleTextId}`,
        }}
        items={[
          <MenuHeader key="head" description={description} />,
          <Divider key="divider" component="li" />,
        ]
          .concat(
            vg.logicalVolumes.map((lv) => {
              return (
                <MountPathMenuItem
                  key={lv.mountPath}
                  device={lv}
                  editPath={generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
                    id: vg.vgName,
                    logicalVolumeId: lv.mountPath,
                  })}
                  deleteFn={() => deleteLogicalVolume(vg.vgName, lv.mountPath)}
                />
              );
            }),
          )
          .concat(
            <MenuButton.Item
              key="add-logical-volume"
              itemId="add-logical-volume"
              onClick={() => navigate(newLvPath)}
            >
              {_("Add logical volume")}
            </MenuButton.Item>,
          )}
      >
        <Text id={toggleTextId}>{contentDescription(vg)}</Text>
      </MenuButton>
    </Flex>
  );
};

export type VolumeGroupEditorProps = { vg: model.VolumeGroup };

export default function VolumeGroupEditor({ vg }: VolumeGroupEditorProps) {
  return (
    <ConfigEditorItem header={<VgMenu vg={vg} />}>
      <LogicalVolumes vg={vg} />
    </ConfigEditorItem>
  );
}
