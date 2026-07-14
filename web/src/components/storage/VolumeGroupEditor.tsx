/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import {
  useStorageUiState,
  isExpandedInState,
  toggleExpandedInState,
} from "~/context/storage-ui-state";
import * as partitionUtils from "~/components/storage/utils/partition";
import { NestedContent } from "../core";
import Text from "~/components/core/Text";
import MenuButton, { CustomToggleProps } from "~/components/core/MenuButton";
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import Icon, { IconProps } from "~/components/layout/Icon";
import { STORAGE as PATHS } from "~/routes/paths";
import { baseName, deviceLabel, formattedPath } from "~/components/storage/utils";
import { contentDescription } from "~/components/storage/utils/volume-group";
import { generateEncodedPath } from "~/utils";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import SearchedVolumeGroupMenu from "~/components/storage/SearchedVolumeGroupMenu";
import {
  useConfigModel,
  useVolumeGroup,
  useDeleteVolumeGroup,
  useDeleteLogicalVolume,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

const DeleteVgOption = ({ vg }: { vg: ConfigModel.VolumeGroup }) => {
  const config = useConfigModel();
  const deleteVolumeGroup = useDeleteVolumeGroup();
  const lvs = vg.logicalVolumes.map((lv) => formattedPath(lv.mountPath));
  const targetDevices = configModel.volumeGroup.filterTargetDevices(config, vg);
  const convert = targetDevices.length === 1 && !!lvs.length;
  let description: string;

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

const EditVgOption = ({ index }: { index: number }) => {
  const navigate = useNavigate();

  return (
    <MenuButton.Item
      key="edit-volume-group"
      itemId="edit-volume-group"
      description={_("Modify settings and physical volumes")}
      role="menuitem"
      onClick={() => navigate(generateEncodedPath(PATHS.volumeGroup.edit, { id: String(index) }))}
    >
      {_("Edit volume group")}
    </MenuButton.Item>
  );
};

const LvRow = ({ index, lv }) => {
  const navigate = useNavigate();
  const vg = useVolumeGroup(index);
  const editPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.edit, {
    id: index,
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

type VgHeaderProps = {
  deviceConfig: ConfigModel.VolumeGroup;
  device: System.Device;
};

const VgHeader = ({ deviceConfig, device }: VgHeaderProps) => {
  let title: string;

  if (device) {
    title = sprintf(_("Use LVM volume group %s"), deviceLabel(device, true));
  } else {
    title = deviceConfig.logicalVolumes.length
      ? _("Create LVM volume group %s")
      : _("Empty LVM volume group %s");
  }

  return <Title headingLevel="h4">{sprintf(title, deviceConfig.vgName)}</Title>;
};

type VgMenuToggleProps = CustomToggleProps & {
  deviceConfig: ConfigModel.VolumeGroup;
  device?: System.Device;
};

const VgMenuToggle = forwardRef(({ deviceConfig, device, ...props }: VgMenuToggleProps, ref) => {
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
          <VgHeader deviceConfig={deviceConfig} device={device} {...props} />
        </FlexItem>
        <FlexItem>
          <Icon name="keyboard_arrow_down" style={{ verticalAlign: "middle" }} />
        </FlexItem>
      </Flex>
    </Button>
  );
});

const NewVgMenu = ({ index }: { index: number }) => {
  const deviceConfig = useVolumeGroup(index);

  return (
    <MenuButton
      menuProps={{
        popperProps: { position: "end", maxWidth: "fit-content", minWidth: "fit-content" },
      }}
      customToggle={<VgMenuToggle deviceConfig={deviceConfig} />}
      items={[
        <EditVgOption key="edit" index={index} />,
        <DeleteVgOption key="delete" vg={deviceConfig} />,
      ]}
    />
  );
};

const ReusedVgMenu = ({ index }: { index: number }) => {
  const deviceConfig = useVolumeGroup(index);
  const device = useDevice(deviceConfig.name);

  return (
    <SearchedVolumeGroupMenu
      deviceConfig={deviceConfig}
      device={device}
      toggle={<VgMenuToggle device={device} deviceConfig={deviceConfig} />}
    />
  );
};

const VgMenu = ({ index }: { index: number }) => {
  const vg = useVolumeGroup(index);

  return vg.name ? <ReusedVgMenu index={index} /> : <NewVgMenu index={index} />;
};

const AddLvButton = ({ index }: { index: number }) => {
  const navigate = useNavigate();
  const volumeGroupConfig = useVolumeGroup(index);

  const newLvPath = generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: String(index) });

  return (
    <Button variant="plain" key="add-logical-volume" onClick={() => navigate(newLvPath)}>
      <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
        {/** TODO: choose one, "add" or "add_circle", and remove the other at Icon.tsx */}
        <Icon name="add_circle" />
        {volumeGroupConfig.name ? _("Add or use logical volume") : _("Add logical volume")}
      </Flex>
    </Button>
  );
};

const LogicalVolumes = ({ index }: { index: number }) => {
  const toggleId = useId();
  const contentId = useId();
  const { uiState, setUiState } = useStorageUiState();
  const vg = useVolumeGroup(index);
  const uiIndex = `vg${vg.vgName}`;
  const isExpanded = isExpandedInState(uiState, uiIndex);
  const menuAriaLabel = sprintf(_("Logical volumes for %s"), vg.vgName);

  const onToggle = () => {
    setUiState((state) => toggleExpandedInState(state, uiIndex));
  };

  const iconName: IconProps["name"] = isExpanded ? "unfold_less" : "unfold_more";
  const commonProps: Pick<ExpandableSectionProps, "toggleId" | "contentId" | "isExpanded"> = {
    toggleId,
    contentId,
    isExpanded,
  };

  if (isEmpty(vg.logicalVolumes)) {
    return (
      <Flex>
        <AddLvButton index={index} />
      </Flex>
    );
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
        onToggle={onToggle}
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
              {vg.logicalVolumes
                .filter((l) => l.mountPath)
                .map((lv) => {
                  return <LvRow key={lv.mountPath} index={index} lv={lv} />;
                })}
            </DataList>
            <Content component="p" style={{ marginBlockStart: "1rem" }}>
              <AddLvButton index={index} />
            </Content>
          </NestedContent>
        </NestedContent>
      </ExpandableSection>
    </Flex>
  );
};

export type VolumeGroupEditorProps = { index: number };

export default function VolumeGroupEditor({ index }: VolumeGroupEditorProps) {
  return (
    <ConfigEditorItem header={<VgMenu index={index} />}>
      <LogicalVolumes index={index} />
      <SpacePolicyMenu collection={"volumeGroups"} index={index} />
    </ConfigEditorItem>
  );
}
