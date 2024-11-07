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

import React, {useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { baseName, deviceSize, deviceLabel, formattedPath, SPACE_POLICIES } from "~/components/storage/utils";
import { useAvailableDevices } from "~/queries/storage";
import { config as type } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import * as driveUtils from "~/components/storage/utils/drive";
import { typeDescription, contentDescription } from "~/components/storage/utils/device";
import { Icon } from "../layout";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Divider,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Flex,
  List,
  ListItem,
  Label,
  Split,
  SplitItem,
  Menu,
  MenuContainer,
  MenuContent,
  MenuFooter,
  MenuGroup,
  MenuItem,
  MenuItemAction,
  MenuList,
  MenuToggle,
  Dropdown,
  DropdownList,
  DropdownItem
} from "@patternfly/react-core";

type DriveEditorProps = { drive: type.DriveElement, driveDevice: StorageDevice };

// FIXME: Presentation is quite poor
const SpacePolicySelectorIntro = ({ device }) => {
  const Content = ({device}) => {
    const main = sprintf(_("Choose what to with current content: %s"), contentDescription(device));
    const systems = device.systems;

    if (systems.length > 0) {
      return (
        <>
          <span>{main}</span>
          <br />
          {systems.map((s) => <Label isCompact>{s}</Label>)}
        </>
      );
    }

    return <span>{main}</span>;
  }

  return (
    <div style={{ padding: "1em", fontWeight: "normal" }}>
      <Content device={device} />
    </div>
  );
};

const SpacePolicySelector = ({ drive, driveDevice }) => {
  const navigate = useNavigate();
  const menuRef = useRef();
  const toggleMenuRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const onToggle = () => setIsOpen(!isOpen);

  const currentPolicy = driveUtils.spacePolicyEntry(drive);

  const PolicyItem = ({policy}) => {
    return (
      <MenuItem
        key={policy.id}
        itemId={policy.id}
        isSelected={policy.id === currentPolicy.id}
        description={policy.description}
      >
        {policy.label}
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
          <span>{driveUtils.contentActionsDescription(drive)}<Icon name="keyboard_arrow_down" size="xs" /></span>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef}>
          <MenuContent>
            <MenuList>
              <SpacePolicySelectorIntro device={driveDevice} />
              {SPACE_POLICIES.map((policy) => <PolicyItem policy={policy} />)}
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
}

const SearchSelectorIntro = ({ drive }) => {
  const mainText = (drive: type.DriveElement): string => {
    if (driveUtils.hasReuse(drive)) {
      // The current device will be the only option to choose from
      return _("This uses existing partitions at the device");
    }

    const boot = driveUtils.explicitBoot(drive);

    if (!driveUtils.hasFilesystem(drive)) {
      // The current device will be the only option to choose from
      if (driveUtils.hasPv(drive)) {
        if (drive.volumeGroups.length > 1) {
          if (boot) {
            return _("This device will contain the configured LVM groups and any partition needed to boot");
          }
          return _("This device will contain the configured LVM groups");
        }
        if (boot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the LVM
            _("This device will contain the LVM group '%s' and any partition needed to boot"),
            drive.volumeGroups[0]
          );
        }

        // TRANSLATORS: %s is the name of the LVM
        return sprintf(_("This device will contain the LVM group '%s'"), drive.volumeGroups[0]);
      }

      // The current device will be the only option to choose from
      if (boot) {
        return _("This device will contain any partition needed for booting");
      }

      // I guess 'create new LVM' is not a reasonable option here
      return _("Select a device to configure");
    }

    if (driveUtils.hasRoot(drive)) {
      return _("Select a device to install the system");
    }

    const mountPaths = drive.partitions.filter((p) => !p.name).map((p) => formattedPath(p.mountPath));

    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      _(
        "Select a device to create %s",
        "Select a device to create %s",
        mountPaths.length,
      ),
      formatList(mountPaths),
    );
  };

  const extraText = (drive: type.DriveElement): string => {
    // Nothing to add in these cases
    if (driveUtils.hasReuse(drive)) return;
    if (!driveUtils.hasFilesystem(drive)) return;

    const name = baseName(drive.name);
    const boot = driveUtils.explicitBoot(drive);

    if (driveUtils.hasPv(drive)) {
      if (drive.volumeGroups.length > 1) {
        if (boot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the disk (eg. sda)
            _("%s will still contain the configured LVM groups and any partition needed to boot"),
            name
          );
        }

        // TRANSLATORS: %s is the name of the disk (eg. sda)
        return sprintf(_("The configured LVM groups will remain at %s"), name);
      }

      if (boot) {
        return sprintf(
          // TRANSLATORS: %1$s is the name of the disk (eg. sda) and %2$s the name of the LVM
          _("%1$s will still contain the LVM group '%2$s' and any partition needed to boot"),
          name,
          drive.volumeGroups[0]
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is the name of the LVM and %2$s the name of the disk (eg. sda)
        _("The LVM group '%1$s' will remain at %2$s"),
        name,
        drive.volumeGroups[0]
      );
    }

    if (boot) {
      // TRANSLATORS: %s is the name of the disk (eg. sda)
      return sprintf(_("Partitions needed for booting will remain at %s"), name);
    }

    if (drive.boot) {
      return _("Partitions needed for booting will also be adapted");
    }
  };

  const Content = ({drive}) => {
    const main = mainText(drive);
    const extra = extraText(drive);

    if (extra) {
      return (
        <>
          <span>{main}</span>
          <br />
          <em>{extra}</em>
        </>
      );
    }

    return <span>{main}</span>;
  }

  return (
    <div style={{ padding: "1em", fontWeight: "normal" }}>
      <Content drive={drive} />
    </div>
  );
};

const SearchSelectorOptions = ({ drive, selected }) => {
  if (driveUtils.hasReuse(drive)) return <SearchSelectorSingleOption selected={selected} />;

  if (!driveUtils.hasFilesystem(drive)) {
    if (driveUtils.hasPv(drive) || driveUtils.explicitBoot(drive)) {
      return <SearchSelectorSingleOption selected={selected} />;
    }

    return <SearchSelectorMultipleOptions selected={selected} />;
  }

  return <SearchSelectorMultipleOptions selected={selected} withNewVg />;
};


const SearchSelectorMultipleOptions = ({ selected, withNewVg }) => {
  const devices = useAvailableDevices();

  // FIXME: Presentation is quite poor
  const DeviceDescription = ({ device }) => {
    return (
      <>
        <span>{typeDescription(device)}</span>
        <span>{contentDescription(device)}</span>
        <br />
        {device.systems.map((s) => <Label isCompact>{s}</Label>)}
      </>
    );
  }

  const NewVgOption = () => {
    if (withNewVg) return (
      <MenuItem
        component="a"
        onClick={() => navigate("/storage/target-device")}
        itemId="lvm"
        description="The configured partitions will be created as logical volumes"
      >
        <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <span>New LVM volume group</span>
        </Flex>
      </MenuItem>
    );
  };

  return (
    <>
      {devices.map((device) => {
        const isSelected = device === selected;
        // FIXME: use PF/Content with #component prop instead when migrating to PF6
        const Name = () =>
          isSelected ? <b>{deviceLabel(device)}</b> : deviceLabel(device);

        return (
          <MenuItem
            key={device.sid}
            itemId={device.sid}
            isSelected={isSelected}
            description={<DeviceDescription device={device} />}
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

const SearchSelector = ({ drive, selected }) => {
  return (
    <>
      <SearchSelectorIntro drive={drive} />
      <SearchSelectorOptions drive={drive} selected={selected} />
    </>
  );
};

const RemoveDriveOption = ({ drive }) => {
  if (driveUtils.hasPv(drive)) return;
  if (driveUtils.explicitBoot(drive)) return;
  if (driveUtils.hasRoot(drive)) return;

  return (
    <>
      <Divider component="hr" />
      <MenuItem
        description={_("Remove the configuration for this device")}
      >
        {_("Do not use")}
      </MenuItem>
    </>
  );
};

const DriveSelector = ({ drive, selected }) => {
  const navigate = useNavigate();
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
          <b>{deviceLabel(selected)}<Icon name="keyboard_arrow_down" size="xs" /></b>
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu ref={menuRef} activeItemId={selected.sid}>
          <MenuContent>
            <MenuList>
              <SearchSelector drive={drive} selected={selected} />
              <RemoveDriveOption drive={drive} />
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const DriveHeader = ({ drive, driveDevice } : DriveEditorProps) => {
  const text = (drive: type.DriveElement): string => {
    if (driveUtils.hasRoot(drive)) {
      if (driveUtils.hasPv(drive)) {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install, host LVM and boot");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and host LVM");
      }

      if (drive.boot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to install");
    }

    if (driveUtils.hasFilesystem(drive)) {
      if (driveUtils.hasPv(drive)) {
        if (drive.boot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s for LVM, additional partitions and booting");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for LVM and additional partitions");
      }

      if (drive.boot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s for additional partitions");
    }

    if (driveUtils.hasPv(drive)) {
      if (drive.boot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to host LVM");
    }

    if (drive.boot) {
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


const PartitionsNoContentSelector = ({ drive }) => {
  const navigate = useNavigate();
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
          <span>{_("No additional partitions will be created")}<Icon name="keyboard_arrow_down" size="xs" /></span>
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
                description="Add another partition or mount an existing one"
                onClick={() => navigate("/storage/space-policy")}
              >
                <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
                  <span>Add or use partition</span>
                </Flex>
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
};

const PartitionsWithContentSelector = ({ drive }) => {
  const navigate = useNavigate();
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
          <span>{driveUtils.contentDescription(drive)}<Icon name="keyboard_arrow_down" size="xs" /></span>
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
                    <MenuItem
                      key={partition.mountPath}
                      itemId={partition.mountPath}
                      description="Btrfs with snapshots"
                      actions={
                        <>
                          <MenuItemAction
                            style={{ paddingInline: "4px", alignSelf: "center" }}
                            icon={<Icon name="edit_square" size="xs" aria-label={"Edit"} />}
                            actionId={`edit-${partition.mountPath}`}
                            aria-label={`Edit ${partition.mountPath}`}
                          />
                          <MenuItemAction
                            style={{ paddingInline: "4px", alignSelf: "center" }}
                            icon={<Icon name="delete" size="xs" aria-label={"Edit"} />}
                            actionId={`delete-${partition.mountPath}`}
                            aria-label={`Delete ${partition.mountPath}`}
                          />
                        </>
                      }
                    >
                      {partition.mountPath}
                    </MenuItem>
                  );
                })}
              <Divider component="li" />
              <MenuItem
                key="add-partition"
                itemId="add-partition"
                description="Add another partition or mount an existing one"
                onClick={() => navigate("/storage/space-policy")}
              >
                <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
                  <span>Add or use partition</span>
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

  return <PartitionsNoContentSelector drive={drive} />;
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  const menuRef = React.useRef();
  const toggleRef = React.useRef();
  const newContentMenuRef = React.useRef();
  const toggleNewContentMenuRef = React.useRef();
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [newContentMenuOpen, setNewContentMenuOpen] = React.useState<boolean>(false);
  const onToggleClick = () => setIsOpen(!isOpen);
  const onNewContentMenuToggleClick = () => setNewContentMenuOpen(!isOpen);

  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <SpacePolicySelector drive={drive} driveDevice={driveDevice} />
        <PartitionsSelector drive={drive} />
      </CardBody>
    </Card>
  );
}
