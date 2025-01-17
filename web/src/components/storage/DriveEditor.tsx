/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useRef, useState } from "react";
import { useNavigate, generatePath } from "react-router-dom";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { baseName, deviceLabel, formattedPath, SPACE_POLICIES } from "~/components/storage/utils";
import { useAvailableDevices } from "~/queries/storage";
import { configModel } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import { STORAGE as PATHS } from "~/routes/paths";
import { useDrive, usePartition } from "~/queries/storage/config-model";
import * as driveUtils from "~/components/storage/utils/drive";
import { typeDescription, contentDescription } from "~/components/storage/utils/device";
import { Icon } from "../layout";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Divider,
  Flex,
  Label,
  Split,
  Stack,
  Menu,
  MenuContainer,
  MenuContent,
  MenuItem,
  MenuItemAction,
  MenuList,
  MenuToggle,
} from "@patternfly/react-core";

type DriveEditorProps = { drive: configModel.Drive; driveDevice: StorageDevice };

// FIXME: Presentation is quite poor
const SpacePolicySelectorIntro = ({ device }) => {
  const Content = ({ device }) => {
    const main = _("Choose what to with current content");
    const description = contentDescription(device);
    const systems = device.systems;

    return (
      <>
        <b>{main}</b>
        <br />
        <Split hasGutter>
          <span className="pf-v5-c-menu__item-description">{description}</span>
          {systems.map((s, i) => (
            <Label key={i} isCompact>
              {s}
            </Label>
          ))}
        </Split>
      </>
    );
  };

  return (
    <li style={{ padding: "0.7em" }}>
      <Content device={device} />
    </li>
  );
};

const SpacePolicySelector = ({ drive, driveDevice }: DriveEditorProps) => {
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { setSpacePolicy } = useDrive(drive.name);
  const onToggle = () => setIsOpen(!isOpen);
  const onSpacePolicyChange = (spacePolicy: configModel.SpacePolicy) => {
    if (spacePolicy === "custom") {
      return navigate(generatePath(PATHS.spacePolicy, { id: baseName(drive.name) }));
    } else {
      setSpacePolicy(spacePolicy);
      setIsOpen(false);
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
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <span>
            {driveUtils.contentActionsDescription(drive)}
            <Icon name="keyboard_arrow_down" size="xs" />
          </span>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef} activeItemId={currentPolicy.id}>
          <MenuContent>
            <MenuList>
              <SpacePolicySelectorIntro device={driveDevice} />
              {SPACE_POLICIES.map((policy) => (
                <PolicyItem key={policy.id} policy={policy} />
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const SearchSelectorIntro = ({ drive }: { drive: configModel.Drive }) => {
  const { isBoot, isExplicitBoot } = useDrive(drive.name);
  // TODO: Get volume groups associated to the drive.
  const volumeGroups = [];

  const mainText = (): string => {
    if (driveUtils.hasReuse(drive)) {
      // The current device will be the only option to choose from
      return _("This uses existing partitions at the device");
    }

    if (!driveUtils.hasFilesystem(drive)) {
      // The current device will be the only option to choose from
      if (driveUtils.hasPv(drive)) {
        if (volumeGroups.length > 1) {
          if (isExplicitBoot) {
            return _(
              "This device will contain the configured LVM groups and any partition needed to boot",
            );
          }
          return _("This device will contain the configured LVM groups");
        }
        if (isExplicitBoot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the LVM
            _("This device will contain the LVM group '%s' and any partition needed to boot"),
            volumeGroups[0],
          );
        }

        // TRANSLATORS: %s is the name of the LVM
        return sprintf(_("This device will contain the LVM group '%s'"), volumeGroups[0]);
      }

      // The current device will be the only option to choose from
      if (isExplicitBoot) {
        return _("This device will contain any partition needed for booting");
      }

      // I guess 'create new LVM' is not a reasonable option here
      return _("Select a device to configure");
    }

    if (driveUtils.hasRoot(drive)) {
      return _("Select a device to install the system");
    }

    const mountPaths = drive.partitions
      .filter((p) => !p.name)
      .map((p) => formattedPath(p.mountPath));

    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      _("Select a device to create %s"),
      formatList(mountPaths),
    );
  };

  const extraText = (): string => {
    // Nothing to add in these cases
    if (driveUtils.hasReuse(drive)) return;
    if (!driveUtils.hasFilesystem(drive)) return;

    const name = baseName(drive.name);

    if (driveUtils.hasPv(drive)) {
      if (volumeGroups.length > 1) {
        if (isExplicitBoot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the disk (eg. sda)
            _("%s will still contain the configured LVM groups and any partition needed to boot"),
            name,
          );
        }

        // TRANSLATORS: %s is the name of the disk (eg. sda)
        return sprintf(_("The configured LVM groups will remain at %s"), name);
      }

      if (isExplicitBoot) {
        return sprintf(
          // TRANSLATORS: %1$s is the name of the disk (eg. sda) and %2$s the name of the LVM
          _("%1$s will still contain the LVM group '%2$s' and any partition needed to boot"),
          name,
          volumeGroups[0],
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is the name of the LVM and %2$s the name of the disk (eg. sda)
        _("The LVM group '%1$s' will remain at %2$s"),
        name,
        volumeGroups[0],
      );
    }

    if (isExplicitBoot) {
      // TRANSLATORS: %s is the name of the disk (eg. sda)
      return sprintf(_("Partitions needed for booting will remain at %s"), name);
    }

    if (isBoot) {
      return _("Partitions needed for booting will also be adapted");
    }
  };

  const Content = () => {
    const main = mainText();
    const extra = extraText();

    if (extra) {
      return (
        <>
          <b>{main}</b>
          <br />
          <span className="pf-v5-c-menu__item-description">{extra}</span>
        </>
      );
    }

    return <b>{main}</b>;
  };

  return (
    <li style={{ padding: "0.7em" }}>
      <Content />
    </li>
  );
};

const SearchSelectorMultipleOptions = ({ selected, withNewVg = false, onChange }) => {
  const navigate = useNavigate();
  const devices = useAvailableDevices();

  // FIXME: Presentation is quite poor
  const DeviceDescription = ({ device }) => {
    return (
      <Stack>
        <Split hasGutter>
          <span>{typeDescription(device)}</span>
          <span>{contentDescription(device)}</span>
        </Split>
        <Split hasGutter>
          {device.systems.map((s, i) => (
            <Label key={i} isCompact>
              {s}
            </Label>
          ))}
        </Split>
      </Stack>
    );
  };

  const NewVgOption = () => {
    if (withNewVg)
      return (
        <MenuItem
          component="a"
          onClick={() => navigate(PATHS.targetDevice)}
          itemId="lvm"
          description={_("The configured partitions will be created as logical volumes")}
        >
          <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
            <span>{_("New LVM volume group")}</span>
          </Flex>
        </MenuItem>
      );
  };

  return (
    <>
      {devices.map((device) => {
        const isSelected = device === selected;
        // FIXME: use PF/Content with #component prop instead when migrating to PF6
        const Name = () => (isSelected ? <b>{deviceLabel(device)}</b> : deviceLabel(device));

        return (
          <MenuItem
            key={device.sid}
            itemId={device.sid}
            isSelected={isSelected}
            description={<DeviceDescription device={device} />}
            onClick={() => onChange(device.name)}
          >
            <Name />
          </MenuItem>
        );
      })}
      <NewVgOption />
    </>
  );
};

const SearchSelectorSingleOption = ({ selected }) => {
  return (
    <MenuItem
      isSelected
      key={selected.sid}
      itemId={selected.sid}
      description={<>{typeDescription(selected)}</>}
    >
      <b>{deviceLabel(selected)}</b>
    </MenuItem>
  );
};

const SearchSelectorOptions = ({ drive, selected, onChange }) => {
  const { isExplicitBoot } = useDrive(drive.name);
  // const boot = isExplicitBoot(drive.name);

  if (driveUtils.hasReuse(drive)) return <SearchSelectorSingleOption selected={selected} />;

  if (!driveUtils.hasFilesystem(drive)) {
    if (driveUtils.hasPv(drive) || isExplicitBoot) {
      return <SearchSelectorSingleOption selected={selected} />;
    }

    return <SearchSelectorMultipleOptions selected={selected} onChange={onChange} />;
  }

  // TODO: use withNewVg prop once LVM is added.
  return <SearchSelectorMultipleOptions selected={selected} onChange={onChange} />;
};

const SearchSelector = ({ drive, selected, onChange }) => {
  return (
    <>
      <SearchSelectorIntro drive={drive} />
      <SearchSelectorOptions drive={drive} selected={selected} onChange={onChange} />
    </>
  );
};

const RemoveDriveOption = ({ drive }) => {
  const { isExplicitBoot } = useDrive(drive.name);

  if (driveUtils.hasPv(drive)) return;
  if (isExplicitBoot) return;
  if (driveUtils.hasRoot(drive)) return;

  return (
    <>
      <Divider component="hr" />
      <MenuItem description={_("Remove the configuration for this device")}>
        {_("Do not use")}
      </MenuItem>
    </>
  );
};

const DriveSelector = ({ drive, selected }) => {
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const driveHandler = useDrive(drive.name);
  const onDriveChange = (newDriveName: string) => {
    driveHandler.switch(newDriveName);
    setIsOpen(false);
  };
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <b>
            {deviceLabel(selected)} <Icon name="keyboard_arrow_down" size="xs" />
          </b>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef} activeItemId={selected.sid}>
          <MenuContent>
            <MenuList>
              <SearchSelector drive={drive} selected={selected} onChange={onDriveChange} />
              <RemoveDriveOption drive={drive} />
            </MenuList>
          </MenuContent>
        </Menu>
      }
      // @ts-expect-error
      popperProps={{ appendTo: document.body }}
    />
  );
};

const DriveHeader = ({ drive, driveDevice }: DriveEditorProps) => {
  const { isBoot } = useDrive(drive.name);

  const text = (drive: configModel.Drive): string => {
    if (driveUtils.hasRoot(drive)) {
      if (driveUtils.hasPv(drive)) {
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
      if (driveUtils.hasPv(drive)) {
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

    if (driveUtils.hasPv(drive)) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to boot");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
    return _("Use %s");
  };

  const [txt1, txt2] = text(drive).split("%s");

  return (
    <h4>
      <span>{txt1}</span>
      <DriveSelector drive={drive} selected={driveDevice} />
      <span>{txt2}</span>
    </h4>
  );
};

const PartitionsNoContentSelector = () => {
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <span>
            {_("No additional partitions will be created")}
            <Icon name="keyboard_arrow_down" size="xs" />
          </span>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef}>
          <MenuContent>
            <MenuList>
              <MenuItem
                key="add-partition"
                itemId="add-partition"
                description={_("Add another partition or mount an existing one")}
              >
                <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
                  <span>{_("Add or use partition")}</span>
                </Flex>
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const PartitionMenuItem = ({ driveName, mountPath }) => {
  const { onDelete } = usePartition(driveName, mountPath);

  return (
    <MenuItem
      itemId={mountPath}
      description="Btrfs with snapshots"
      actions={
        <>
          <MenuItemAction
            style={{ paddingInline: "4px", alignSelf: "center" }}
            icon={<Icon name="edit_square" size="xs" aria-label={"Edit"} />}
            actionId={`edit-${mountPath}`}
            aria-label={`Edit ${mountPath}`}
          />
          <MenuItemAction
            style={{ paddingInline: "4px", alignSelf: "center" }}
            icon={<Icon name="delete" size="xs" aria-label={"Edit"} />}
            actionId={`delete-${mountPath}`}
            aria-label={`Delete ${mountPath}`}
            onClick={onDelete}
          />
        </>
      }
    >
      {mountPath}
    </MenuItem>
  );
};

const PartitionsWithContentSelector = ({ drive }) => {
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      toggleRef={toggleMenuRef}
      toggle={
        <MenuToggle
          variant="plain"
          ref={toggleMenuRef}
          onClick={onToggle}
          isExpanded={isOpen}
          className="menu-toggle-inline"
        >
          <span>
            {driveUtils.contentDescription(drive)}
            <Icon name="keyboard_arrow_down" size="xs" />
          </span>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef}>
          <MenuContent>
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
              >
                <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
                  <span>{_("Add or use partition")}</span>
                </Flex>
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const PartitionsSelector = ({ drive }) => {
  if (drive.partitions.some((p) => p.mountPath)) {
    return <PartitionsWithContentSelector drive={drive} />;
  }

  return <PartitionsNoContentSelector />;
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <SpacePolicySelector drive={drive} driveDevice={driveDevice} />
        <br />
        <PartitionsSelector drive={drive} />
      </CardBody>
    </Card>
  );
}
