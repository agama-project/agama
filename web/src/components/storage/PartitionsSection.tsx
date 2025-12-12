/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useId } from "react";
import {
  ExpandableSection,
  Content,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListAction,
  DataList,
  Flex,
  ExpandableSectionToggle,
  ExpandableSectionProps,
} from "@patternfly/react-core";
import { useStorageUiState } from "~/context/storage-ui-state";
import Text from "~/components/core/Text";
import MenuButton from "~/components/core/MenuButton";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDeletePartition } from "~/hooks/storage/partition";
import { useDevice } from "~/hooks/storage/model";
import * as driveUtils from "~/components/storage/utils/drive";
import { generateEncodedPath } from "~/utils";
import * as partitionUtils from "~/components/storage/utils/partition";
import { _, n_ } from "~/i18n";
import { Link, NestedContent } from "../core";
import { Icon } from "../layout";
import { IconProps } from "../layout/Icon";
import { sprintf } from "sprintf-js";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { toggle } from "radashi";
import { partitionableModel } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

type PartitionMenuItemProps = {
  device: ConfigModel.Drive | ConfigModel.MdRaid;
  mountPath: string;
  collection: "drives" | "mdRaids";
  index: number;
};

const PartitionMenuItem = ({ device, mountPath, collection, index }: PartitionMenuItemProps) => {
  const partition = partitionableModel.findPartition(device, mountPath);
  const editPath = generateEncodedPath(PATHS.editPartition, {
    collection,
    index,
    partitionId: mountPath,
  });
  const deletePartition = useDeletePartition();

  return (
    <MountPathMenuItem
      device={partition}
      editPath={editPath}
      deleteFn={() => deletePartition(collection, index, mountPath)}
    />
  );
};

const partitionsLabelText = (device) => {
  const { isBoot, isTargetDevice, isAddingPartitions, isReusingPartitions } = device;
  const num = device.partitions.filter((p) => p.mountPath).length;

  if (isBoot || isTargetDevice) {
    if (isAddingPartitions && isReusingPartitions)
      return _("Moreover, the following partitions will be created or mounted");

    if (isAddingPartitions)
      return n_(
        "Moreover, the following partition will be created.",
        "Moreover, the following partitions will be created.",
        num,
      );

    return n_(
      "Moreover, the following partition will be mounted.",
      "Moreover, the following partitions will be mounted.",
      num,
    );
  }

  if (isAddingPartitions && isReusingPartitions)
    return _("The following partitions will be created or mounted");

  if (isAddingPartitions)
    return n_(
      "The following partition will be created.",
      "The following partitions will be created.",
      num,
    );

  return n_(
    "The following partition will be mounted.",
    "The following partitions will be mounted.",
    num,
  );
};

const optionalPartitionsTexts = (device) => {
  const { isBoot, isTargetDevice } = device;

  const texts = [];
  if (isBoot) texts.push(_("Any partition needed to boot will be configured."));
  if (isTargetDevice) texts.push(_('Partitions to host "system" will be created if needed.'));

  return texts;
};

type PartitionRowProps = {
  partition: ConfigModel.Partition;
  collection: "drives" | "mdRaids";
  index: number;
};

const PartitionRow = ({ partition, collection, index }: PartitionRowProps) => {
  const editPath = generateEncodedPath(PATHS.editPartition, {
    collection,
    index,
    partitionId: partition.mountPath,
  });
  const deletePartition = useDeletePartition();
  const description = partitionUtils.typeWithSize(partition);

  return (
    <DataListItem>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key={`${partition.mountPath}-path`} width={1}>
              <Text isBold>{partition.mountPath}</Text>
            </DataListCell>,
            <DataListCell key={`${partition.mountPath}-description`} width={5} isFilled>
              {description}
            </DataListCell>,
          ]}
        />
        <DataListAction
          id={`actions-for-${partition.mountPath}`}
          aria-labelledby={`actions-for-${partition.mountPath}`}
          // TRANSLATORS: ARIA (accesibility) description of an UI element. %s is a mount path.
          aria-label={sprintf(_("Partition %s"), partition.mountPath)}
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
              // TRANSLATORS: ARIA (accesibility) description of an button. %s is a mount path.
              "aria-label": sprintf(_("Options for partition %s"), partition.mountPath),
            }}
            items={[
              <MenuButton.Item
                key={`edit-${partition.mountPath}`}
                aria-label={`Edit ${partition.mountPath}`}
                to={editPath}
                keepQuery
              >
                <Icon name="edit_square" /> {_("Edit")}
              </MenuButton.Item>,
              <MenuButton.Item
                key={`delete-${partition.mountPath}`}
                aria-label={`Delete ${partition.mountPath}`}
                onClick={() => deletePartition(collection, index, partition.mountPath)}
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

const PartitionsSectionHeader = ({ device }) => {
  const texts = optionalPartitionsTexts(device);
  const hasPartitions = device.partitions.some((p) => p.mountPath);
  if (hasPartitions) {
    texts.push(partitionsLabelText(device));
  }

  // FIXME: not really i18n friendly.
  const textsContent = texts.map((text, idx) => <span key={idx}>{text} </span>);
  return <Content component="p">{textsContent}</Content>;
};

type PartitionsSectionProps = {
  collection: "drives" | "mdRaids";
  index: number;
};

export default function PartitionsSection({ collection, index }: PartitionsSectionProps) {
  const { uiState, setUiState } = useStorageUiState();
  const toggleId = useId();
  const contentId = useId();
  const device = useDevice(collection, index);
  const uiIndex = `${collection[0]}${index}`;
  const expanded = uiState.get("expanded")?.split(",");
  const isExpanded = expanded?.includes(uiIndex);
  const newPartitionPath = generateEncodedPath(PATHS.addPartition, { collection, index });
  const hasPartitions = device.partitions.some((p) => p.mountPath);

  const onToggle = () => {
    setUiState((state) => {
      const nextExpanded = toggle(expanded, uiIndex);
      state.set("expanded", nextExpanded.join(","));
      return state;
    });
  };
  const iconName: IconProps["name"] = isExpanded ? "unfold_less" : "unfold_more";
  const commonProps: Pick<ExpandableSectionProps, "toggleId" | "contentId" | "isExpanded"> = {
    toggleId,
    contentId,
    isExpanded,
  };

  // FIXME: All strings and widgets are now calculated and assembled here. But we are actually
  // aiming for a different organization of the widgets (eg. using a MenuGroup with a label to
  // render the list of partition). At that point we will be able to better distribute the logic.

  const items = [];

  if (hasPartitions) {
    items.push(
      device.partitions
        .filter((p) => p.mountPath)
        .map((p) => {
          return (
            <PartitionMenuItem
              key={p.mountPath}
              device={device}
              mountPath={p.mountPath}
              collection={collection}
              index={index}
            />
          );
        }),
    );
  }

  return (
    <Flex direction={{ default: "column" }}>
      <ExpandableSectionToggle
        {...commonProps}
        onToggle={onToggle}
        className="no-default-icon"
        style={{ marginBlock: 0 }}
      >
        <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
          {driveUtils.contentDescription(device)}
          <Icon name={iconName} />
        </Flex>
      </ExpandableSectionToggle>
      <ExpandableSection isDetached {...commonProps}>
        <NestedContent margin="mxLg">
          <NestedContent margin="mySm">
            <PartitionsSectionHeader device={device} />
            <DataList
              isCompact
              aria-label={_("Partitions")}
              style={{ width: "fit-content", minWidth: "40dvw", maxWidth: "60dwh" }}
            >
              {device.partitions
                .filter((p) => p.mountPath)
                .map((p) => {
                  return (
                    <PartitionRow
                      key={p.mountPath}
                      partition={p}
                      collection={collection}
                      index={index}
                    />
                  );
                })}
            </DataList>
            <Content component="p" style={{ marginBlockStart: "1rem" }}>
              <Link variant="plain" key="add-partition" keepQuery to={newPartitionPath}>
                <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapXs" }}>
                  {/** TODO: choose one, "add" or "add_circle", and remove the other at Icon.tsx */}
                  <Icon name="add_circle" /> {_("Add or use partition")}
                </Flex>
              </Link>
            </Content>
          </NestedContent>
        </NestedContent>
      </ExpandableSection>
    </Flex>
  );
}
