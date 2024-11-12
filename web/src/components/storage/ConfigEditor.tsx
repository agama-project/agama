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

import React, {useState} from "react";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useDevices, useConfigDevices } from "~/queries/storage";
import { config as type } from "~/api/storage/types";
import { StorageDevice } from "~/types/storage";
import { deviceSize, SPACE_POLICIES } from "~/components/storage/utils";
import * as driveUI from "~/components/storage/utils/drive";
import { typeDescription, contentDescription } from "~/components/storage/utils/device";
import {
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  List,
  ListItem,
  Label,
  Stack,
  StackItem,
  Split,
  SplitItem,
  MenuToggle,
  Dropdown,
  DropdownList,
  DropdownItem
} from "@patternfly/react-core";
import { generate as generateDevices } from "~/storage/model/config";

type DriveEditorProps = { drive: type.DriveElement, driveDevice: StorageDevice };
type PartitionsProps = { drive: type.DriveElement };

function Partitions({ drive }: PartitionsProps) {
  return driveUI.contentDescription(drive);
};

function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  const DriveHeader = () => {
    // TRANSLATORS: Header a so-called drive at the storage configuration. %s is the drive identifier
    // like 'vdb' or any alias set by the user
    const text = sprintf(_("Disk %s"), driveUI.label(drive));

    return <h4>{text}</h4>;
  };

  // FIXME: do this i18n friendly, responsive and all that
  const DeviceDescription = () => {
    const data = [
      driveDevice.name,
      deviceSize(driveDevice.size),
      typeDescription(driveDevice),
      driveDevice.model
    ];
    const usefulData = [...new Set(data)].filter((d) => d && d !== "");

    return <span>{usefulData.join(" ")}</span>;
  };

  const ContentDescription = () => {
    const content = contentDescription(driveDevice);

    return content && <span>{content}</span>;
    // <FilesystemLabel item={driveDevice} />
  };

  const SpacePolicy = () => {
    const currentPolicy = driveUI.spacePolicyEntry(drive);
    const [isOpen, setIsOpen] = useState(false);
    const onToggleClick = () => {
      setIsOpen(!isOpen);
    };

    const PolicyItem = ({policy}) => {
      return (
        <DropdownItem
          isSelected={policy.id === currentPolicy.id}
          description={policy.description}
        >
          {policy.label}
        </DropdownItem>
      );
    };

    return (
      <span>
        {driveUI.oldContentActionsDescription(drive)}
        <Dropdown
          shouldFocusToggleOnSelect
          isOpen={isOpen}
          onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
          toggle={(toggleRef: React.Ref<MenuToggleElemet>) => (
            <MenuToggle
              ref={toggleRef}
              onClick={onToggleClick}
              isExpanded={isOpen}
              variant="plain"
            >
              {_("Change")}
            </MenuToggle>
          )}
        >
          <DropdownList>
            {SPACE_POLICIES.map((policy) => <PolicyItem policy={policy} />)}
          </DropdownList>
        </Dropdown>
      </span>
    );
  };

  return (
    <ListItem>
      <Stack>
        <StackItem>
          <DriveHeader />
        </StackItem>
        <StackItem>
          <DescriptionList isHorizontal isCompact horizontalTermWidthModifier={{ default: '14ch'}}>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("Device")}</DescriptionListTerm>
              <DescriptionListDescription>
                <DeviceDescription />
                <Button variant="link">Change device</Button>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("Current Content")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Stack>
                  <StackItem>
                    <ContentDescription />
                    {driveDevice.systems.map((s) => <Label isCompact>{s}</Label>)}
                  </StackItem>
                  <StackItem>
                    <SpacePolicy />
                  </StackItem>
                </Stack>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>{_("New content")}</DescriptionListTerm>
              <DescriptionListDescription>
                <Partitions drive={drive} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </StackItem>
      </Stack>
    </ListItem>
  );
};

export default function ConfigEditor() {
  const drives = useConfigDevices();
  const devices = useDevices("system", { suspense: true });

  return (
    <List isPlain isBordered>
      {drives.map((drive, i) => {
        const device = devices.find((d) => d.name === drive.name);

        return <DriveEditor key={i} drive={drive} driveDevice={device} />
      })}
    </List>
  );
}
