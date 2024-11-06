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

import React, { useState } from "react";
import { _ } from "~/i18n";
import { useConfig, useSolvedConfig } from "~/queries/storage";
import { config as type } from "~/api/storage/types";
import {
  Toolbar,
  ToolbarItem,
  ToolbarContent,
  ToolbarGroup,
  Button,
  List,
  ListItem,
  Stack,
  StackItem,
  Split,
  SplitItem,
  ExpandableSection,
  Menu,
  MenuContainer,
  MenuToggle,
  MenuContent,
  MenuList,
  MenuItem
} from "@patternfly/react-core";
import { generateDevices } from "~/storage/model";

// Type guards.

// @todo Find a good place for the type guards.
function isFormattedDrive(drive: type.DriveElement): drive is type.FormattedDrive {
  return "filesystem" in drive;
}

function isSearchAll(search: type.Search): search is type.SearchAll {
  return search === "*";
}

function isSearchByName(search: type.Search): search is type.SearchByName {
  return !isSearchAll(search) && typeof search === "string";
}

function isAdvancedSearch(search: type.Search): search is type.AdvancedSearch {
  return !isSearchAll(search) && !isSearchByName(search);
}

function isPartitionToDelete(
  partition: type.PartitionElement,
): partition is type.PartitionToDelete {
  return "delete" in partition;
}

function isPartitionToDeleteIfNeeded(
  partition: type.PartitionElement,
): partition is type.PartitionToDeleteIfNeeded {
  return "deleteIfNeeded" in partition;
}

function isPartition(partition: type.PartitionElement): partition is type.Partition {
  if ("generate" in partition) return false;

  return !isPartitionToDelete(partition) && !isPartitionToDeleteIfNeeded(partition);
}

// Methods to get especific config data.

type Partition = type.Partition | type.PartitionToDelete | type.PartitionToDeleteIfNeeded;

function deviceName(device: type.DriveElement | Partition): string | undefined {
  const search = device.search;
  if (!isAdvancedSearch(search) || !search?.condition) return;

  return search.condition.name;
}

function sizeInfo(size: type.Size): string {
  if (typeof size === "string") {
    return size;
  } else if (typeof size === "number") {
    return "";
  } else if (Array.isArray(size)) {
    return `${size[0]} - ${size[1]}`;
  } else {
    return `${size.min} - ${size.max}`;
  }
}

function deviceSize(device: type.Partition | type.PartitionToDeleteIfNeeded): string | undefined {
  const size = device.size;
  if (!size) return;

  return sizeInfo(size);
}

function driveInfo(drive: type.DriveElement): string {
  if (isFormattedDrive(drive)) {
    return drive.filesystem.type.toString();
  } else {
    const numPartitions = drive.partitions.length;
    return `Partitioned (${numPartitions})`;
  }
}

function drivePartitions(drive: type.DriveElement): Partition[] {
  if (isFormattedDrive(drive)) return [];

  const partitions = drive.partitions || [];
  return partitions.filter(
    (p) => isPartition(p) || isPartitionToDelete(p) || isPartitionToDeleteIfNeeded(p),
  );
}

function partitionInfo(partition: Partition) {
  if (isPartitionToDelete(partition)) {
    return _("Delete");
  } else if (isPartitionToDeleteIfNeeded(partition)) {
    return `Size: ${deviceSize(partition)}`;
  } else {
    return `Size: ${deviceSize(partition)}, File system: `;
  }
}

type PartitionEditorProps = { partition: Partition };

function PartitionEditor({ partition }: PartitionEditorProps) {
  return (
    <DescriptionListGroup>
      <DescriptionListTerm>{deviceName(partition) || _("New partition")}</DescriptionListTerm>
      <DescriptionListDescription>{partitionInfo(partition)}</DescriptionListDescription>
    </DescriptionListGroup>
  );
}

type DriveEditorProps = { drive: type.DriveElement };
type PartitionsProps = { drive: type.DriveElement };

const DriveActions: React.FunctionComponent = () => {
  const menu = (
    <Menu>
      <MenuContent>
        <MenuList>
          <MenuItem itemId="whatever">{_("Whatever")}</MenuItem>
        </MenuList>
      </MenuContent>
    </Menu>
  );

  const toggle = (
    <MenuToggle>{_("Options")}</MenuToggle>
  );

  return (
    <MenuContainer
      menu={menu}
      toggle={toggle}
      isOpen={false}
    />
  );
};

function Partitions({ drive }: PartitionsProps) {
  return (
    <Stack>
      <StackItem>
        {_("New partitions will be created for root and swap")}
      </StackItem>
    </Stack>
  );
};

function DriveEditor({ drive }: DriveEditorProps) {
  return (
    <ListItem>
      <Split hasGutter>
        <SplitItem isFilled>
          <Stack hasGutter>
            <StackItem>
              <Split hasGutter>
                <SplitItem isFilled><b>{deviceName(drive) || _("unknown drive")}</b></SplitItem>
                <SplitItem isFilled>{_("Existing partitions will be kept")}</SplitItem>
              </Split>
            </StackItem>
            <StackItem>
              <Partitions drive={drive} />
            </StackItem>
          </Stack>
        </SplitItem>
        <SplitItem><DriveActions /></SplitItem>
      </Split>
    </ListItem>
  );
};

function DevicesToolbar () {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Stack>
      <div align="right">
        <ExpandableSection
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={_("More options")}
        >
          <ToolbarWidget />
        </ExpandableSection>
      </div>
    </Stack>
  );
};

function ToolbarWidget () {
  return (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup align={{ default: "alignRight" }}>
          <ToolbarItem>
            <Button variant="secondary">{_("Boot device")}</Button>
          </ToolbarItem>
          <ToolbarItem>
            <MenuToggle>{_("Additional devices")}</MenuToggle>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

export default function ConfigEditor() {
  const config: type.Config = useConfig();
  const solvedConfig = useSolvedConfig();

  console.log("config: ", config);
  console.log("solved config: ", solvedConfig);

  if (!solvedConfig) return null;

  const devices = generateDevices(config, solvedConfig);
  console.log("devices: ", devices);

  return (
    <Stack>
      <List isPlain isBordered>
        {solvedConfig.drives.map((d, i) => (
          <DriveEditor key={i} drive={d} />
        ))}
      </List>
      <DevicesToolbar />
    </Stack>
  );
}
