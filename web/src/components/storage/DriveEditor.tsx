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

import React from "react";
import { useNavigate, generatePath } from "react-router-dom";
import { _ } from "~/i18n";
import { baseName, SPACE_POLICIES } from "~/components/storage/utils";
import { apiModel } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDrive } from "~/queries/storage/config-model";
import * as driveUtils from "~/components/storage/utils/drive";
import { contentDescription } from "~/components/storage/utils/device";
import DriveDeviceMenu from "~/components/storage/DriveDeviceMenu";
import DeviceMenu from "~/components/storage/DeviceMenu";
import DeviceHeader from "~/components/storage/DeviceHeader";
import MountPathMenuItem from "~/components/storage/MountPathMenuItem";
import { MenuHeader } from "~/components/core";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Divider,
  Flex,
  Label,
  Split,
  MenuItem,
  MenuList,
  MenuGroup,
} from "@patternfly/react-core";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export type DriveEditorProps = { drive: apiModel.Drive; driveDevice: StorageDevice };

// FIXME: Presentation is quite poor
const SpacePolicySelectorIntro = ({ device }) => {
  const main = _("Choose what to with current content");
  const description = contentDescription(device);
  const systems = device.systems;

  return (
    <MenuHeader
      title={main}
      description={
        <Split hasGutter>
          <span className="pf-v5-c-menu__item-description">{description}</span>
          {systems.map((s, i) => (
            <Label key={i} isCompact>
              {s}
            </Label>
          ))}
        </Split>
      }
    />
  );
};

const SpacePolicySelector = ({ drive, driveDevice }: DriveEditorProps) => {
  const navigate = useNavigate();
  const { setSpacePolicy } = useDrive(drive.name);
  const onSpacePolicyChange = (spacePolicy: apiModel.SpacePolicy) => {
    if (spacePolicy === "custom") {
      return navigate(generatePath(PATHS.drive.editSpacePolicy, { id: baseName(drive.name) }));
    } else {
      setSpacePolicy(spacePolicy);
    }
  };

  const currentPolicy = driveUtils.spacePolicyEntry(drive);

  const PolicyItem = ({ policy }) => {
    const isSelected = policy.id === currentPolicy.id;
    // FIXME: use PF/Content with #component prop instead when migrating to PF6
    const Name = () => (isSelected ? <b>{policy.label}</b> : policy.label);

    return (
      <MenuItem
        itemId={policy.id}
        isSelected={isSelected}
        description={policy.description}
        onClick={() => onSpacePolicyChange(policy.id)}
      >
        <Name />
      </MenuItem>
    );
  };

  return (
    <DeviceMenu
      title={<span>{driveUtils.contentActionsDescription(drive)}</span>}
      activeItemId={currentPolicy.id}
    >
      <MenuGroup label={<SpacePolicySelectorIntro device={driveDevice} />}>
        <MenuList>
          <Divider />
          {SPACE_POLICIES.map((policy) => (
            <PolicyItem key={policy.id} policy={policy} />
          ))}
        </MenuList>
      </MenuGroup>
    </DeviceMenu>
  );
};

const DriveHeader = ({ drive, driveDevice }: DriveEditorProps) => {
  const { isBoot, hasPv } = useDrive(drive.name);

  const text = (drive: apiModel.Drive): string => {
    if (driveUtils.hasRoot(drive)) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install, host LVM and boot");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and host LVM");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to install");
    }

    if (driveUtils.hasFilesystem(drive)) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s for LVM, additional partitions and booting");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for LVM and additional partitions");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s for additional partitions");
    }

    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to configure boot partitions");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
    return _("Use %s");
  };

  return (
    <DeviceHeader title={text(drive)}>
      <DriveDeviceMenu drive={drive} selected={driveDevice} />
    </DeviceHeader>
  );
};

const PartitionsNoContentSelector = ({ drive, toggleAriaLabel }) => {
  const navigate = useNavigate();

  return (
    <DeviceMenu
      title={<span aria-hidden>{_("No additional partitions will be created")}</span>}
      ariaLabel={toggleAriaLabel}
    >
      <MenuList>
        <MenuItem
          key="add-partition"
          itemId="add-partition"
          description={_("Add another partition or mount an existing one")}
          role="menuitem"
          onClick={() =>
            navigate(generatePath(PATHS.drive.partition.add, { id: baseName(drive.name) }))
          }
        >
          <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <span>{_("Add or use partition")}</span>
          </Flex>
        </MenuItem>
      </MenuList>
    </DeviceMenu>
  );
};

const PartitionMenuItem = ({ driveName, mountPath }) => {
  const drive = useDrive(driveName);
  const partition = drive.getPartition(mountPath);
  const editPath = generatePath(PATHS.drive.partition.edit, {
    id: baseName(driveName),
    partitionId: encodeURIComponent(mountPath),
  });
  const deletePartition = () => drive.deletePartition(mountPath);

  return <MountPathMenuItem device={partition} editPath={editPath} deleteFn={deletePartition} />;
};

const PartitionsWithContentSelector = ({ drive, toggleAriaLabel }) => {
  const navigate = useNavigate();

  return (
    <DeviceMenu
      title={<span aria-hidden>{driveUtils.contentDescription(drive)}</span>}
      ariaLabel={toggleAriaLabel}
    >
      <MenuList>
        {drive.partitions
          .filter((p) => p.mountPath)
          .map((partition) => {
            return (
              <PartitionMenuItem
                key={partition.mountPath}
                driveName={drive.name}
                mountPath={partition.mountPath}
              />
            );
          })}
        <Divider component="li" />
        <MenuItem
          key="add-partition"
          itemId="add-partition"
          description={_("Add another partition or mount an existing one")}
          onClick={() =>
            navigate(generatePath(PATHS.drive.partition.add, { id: baseName(drive.name) }))
          }
        >
          <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <span>{_("Add or use partition")}</span>
          </Flex>
        </MenuItem>
      </MenuList>
    </DeviceMenu>
  );
};

const PartitionsSelector = ({ drive }) => {
  if (drive.partitions.some((p) => p.mountPath)) {
    return <PartitionsWithContentSelector drive={drive} toggleAriaLabel={_("Partitions")} />;
  }

  return <PartitionsNoContentSelector drive={drive} toggleAriaLabel={_("Partitions")} />;
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody className={spacingStyles.plLg}>
        <Flex direction={{ default: "column" }}>
          <SpacePolicySelector drive={drive} driveDevice={driveDevice} />
          <PartitionsSelector drive={drive} />
        </Flex>
      </CardBody>
    </Card>
  );
}
