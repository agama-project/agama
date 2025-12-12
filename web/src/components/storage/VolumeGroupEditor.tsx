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

import React, { forwardRef, useId, useState } from "react";
import {
  Button,
  Content,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListAction,
  ExpandableSection,
  ExpandableSectionToggle,
  ExpandableSectionProps,
  Flex,
  FlexItem,
  Title,
} from "@patternfly/react-core";
import { useNavigate } from "react-router";
import * as partitionUtils from "~/components/storage/utils/partition";
import { NestedContent } from "../core";
import Text from "~/components/core/Text";
import MenuButton, { CustomToggleProps } from "~/components/core/MenuButton";
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import Icon, { IconProps } from "~/components/layout/Icon";
import { STORAGE as PATHS } from "~/routes/paths";
import { baseName, formattedPath } from "~/components/storage/utils";
import { contentDescription } from "~/components/storage/utils/volume-group";
import { useDeleteVolumeGroup } from "~/hooks/storage/volume-group";
import { useDeleteLogicalVolume } from "~/hooks/storage/logical-volume";
import { generateEncodedPath } from "~/utils";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { useConfigModel } from "~/hooks/model/storage";
import { volumeGroupModel } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

const DeleteVgOption = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
  const config = useConfigModel();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const lvs = vg.logicalVolumes.map((lv) => formattedPath(lv.mountPath));
  const targetDevices = volumeGroupModel.selectTargetDevices(vg, config);
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

const EditVgOption = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
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

const LvRow = ({ lv, vg }) => {
  const navigate = useNavigate();
  const editPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
    id: vg.vgName,
    logicalVolumeId: lv.mountPath,
  });
  const deleteLogicalVolume = useDeleteLogicalVolume();
  const description = partitionUtils.typeWithSize(lv);

  return (
    <DataListItem>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`${lv.mountPath}-path`} width={1}>
              <Text isBold>{lv.mountPath}</Text>
            </DataListCell>,
            <DataListCell key={`${lv.mountPath}-description`} width={5} isFilled>
              {description}
            </DataListCell>,
          ]}
        />
        <DataListAction
          id={`actions-for-${lv.mountPath}`}
          aria-labelledby={`actions-for-${lv.mountPath}`}
          // TRANSLATORS: ARIA (accesibility) description of an UI element. %s is a mount path.
          aria-label={sprintf(_("Volume group %s"), lv.mountPath)}
        >
          <MenuButton
            menuProps={{
              popperProps: {
                position: "end",
              },
            }}
            toggleProps={{
              variant: "plain",
              className: spacingStyles.pXs,
            }}
            items={[
              <MenuButton.Item
                key={`edit-${lv.mountPath}`}
                aria-label={`Edit ${lv.mountPath}`}
                onClick={() => editPath && navigate(editPath)}
              >
                <Icon name="edit_square" /> {_("Edit")}
              </MenuButton.Item>,
              <MenuButton.Item
                key={`delete-${lv.mountPath}`}
                aria-label={`Delete ${lv.mountPath}`}
                onClick={() => deleteLogicalVolume(vg.vgName, lv.mountPath)}
                isDanger
              >
                <Icon name="delete" /> {_("Delete")}
              </MenuButton.Item>,
            ]}
          >
            <Icon name="more_horiz" className="agm-three-dots-icon" />
          </MenuButton>
        </DataListAction>
      </DataListItemRow>
    </DataListItem>
  );
};

const VgHeader = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
  const title = vg.logicalVolumes.length
    ? _("Create LVM volume group %s")
    : _("Empty LVM volume group %s");

  return <Title headingLevel="h4">{sprintf(title, vg.vgName)}</Title>;
};

type VgMenuToggleProps = CustomToggleProps & {
  vg: ConfigModel.VolumeGroup;
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

const VgMenu = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
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

const AddLvButton = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
  const navigate = useNavigate();
  const newLvPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: vg.vgName });

  return (
    <Button variant="plain" key="add-logical-volume" onClick={() => navigate(newLvPath)}>
      <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
        {/** TODO: choose one, "add" or "add_circle", and remove the other at Icon.tsx */}
        <Icon name="add_circle" /> {_("Add logical volume")}
      </Flex>
    </Button>
  );
};

const LogicalVolumes = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
  const toggleId = useId();
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const menuAriaLabel = sprintf(_("Logical volumes for %s"), vg.vgName);

  const toggle = () => setIsExpanded(!isExpanded);
  const iconName: IconProps["name"] = isExpanded ? "unfold_less" : "unfold_more";
  const commonProps: Pick<ExpandableSectionProps, "toggleId" | "contentId" | "isExpanded"> = {
    toggleId,
    contentId,
    isExpanded,
  };

  if (isEmpty(vg.logicalVolumes)) {
    return <AddLvButton vg={vg} />;
  }

  const description = n_(
    "The following logical volume will be created",
    "The following logical volumes will be created",
    vg.logicalVolumes.length,
  );

  return (
    <Flex direction={{ default: "column" }}>
      <ExpandableSectionToggle
        {...commonProps}
        onToggle={toggle}
        className="no-default-icon"
        style={{ marginBlock: 0 }}
      >
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          {contentDescription(vg)}
          <Icon name={iconName} />
        </Flex>
      </ExpandableSectionToggle>
      <ExpandableSection isDetached {...commonProps} style={{ maxWidth: "fit-content" }}>
        <NestedContent margin="mxLg">
          <NestedContent margin="mySm">
            <Content component="p">{description}</Content>
            <DataList
              aria-label={menuAriaLabel}
              isCompact
              style={{ width: "fit-content", minWidth: "40dvw", maxWidth: "60dwh" }}
            >
              {vg.logicalVolumes.map((lv) => {
                return <LvRow key={lv.mountPath} lv={lv} vg={vg} />;
              })}
            </DataList>
            <Content component="p" style={{ marginBlockStart: "1rem" }}>
              <AddLvButton vg={vg} />
            </Content>
          </NestedContent>
        </NestedContent>
      </ExpandableSection>
    </Flex>
  );
};

export type VolumeGroupEditorProps = { vg: ConfigModel.VolumeGroup };

export default function VolumeGroupEditor({ vg }: VolumeGroupEditorProps) {
  return (
    <ConfigEditorItem header={<VgMenu vg={vg} />}>
      <LogicalVolumes vg={vg} />
    </ConfigEditorItem>
  );
}
