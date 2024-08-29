/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

import React, { Dispatch, SetStateAction, useState } from "react";
import {
  Button,
  CardBody,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { Icon } from "~/components/layout";
import { CardField } from "~/components/core";
import { _ } from "~/i18n";
import { hex } from "~/utils";
import { sort } from "fast-sort";
import { DASDDevice } from "~/types/dasd";
import { disableDASD, disableDiag, enableDASD, enableDiag, formatDASD } from "~/api/dasd";
import { useDASDDevices, useFilterDASD, useFilterDASDChange, useSelectedDASD, useSelectedDASDChange } from "~/queries/dasd";

// FIXME: please, note that this file still requiring refinements until reach a
//   reasonable stable version
const columnData = (device: DASDDevice, column: { id: string, sortId?: string, label: string }) => {
  let data = device[column.id];

  switch (column.id) {
    case "formatted":
    case "diag":
      if (!device.enabled) data = "";
      break;
    case "partitionInfo":
      data = data.split(",").map((d) => <div key={d}>{d}</div>);
      break;
  }

  if (typeof data === "boolean") {
    return data ? _("Yes") : _("No");
  }

  return data;
};

const columns = [
  { id: "id", sortId: "hexId", label: _("Channel ID") },
  { id: "status", label: _("Status") },
  { id: "deviceName", label: _("Device") },
  { id: "deviceType", label: _("Type") },
  // TRANSLATORS: table header, the column contains "Yes"/"No" values
  // for the DIAG access mode (special disk access mode on IBM mainframes),
  // usually keep untranslated
  { id: "diag", label: _("DIAG") },
  { id: "formatted", label: _("Formatted") },
  { id: "partitionInfo", label: _("Partition Info") },
];

const Actions = ({ devices, isDisabled }: { devices: DASDDevice[], isDisabled: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => setIsOpen(!isOpen);
  const onSelect = () => setIsOpen(false);

  const deviceIds = devices.map((d) => d.id);
  const activate = () => enableDASD(deviceIds);
  const deactivate = () => disableDASD(deviceIds);
  const setDiagOn = () => enableDiag(deviceIds);
  const setDiagOff = () => disableDiag(deviceIds);
  const format = () => {
    const offline = devices.filter((d) => !d.enabled);

    if (offline.length > 0) {
      return false;
    }

    return formatDASD(devices.map((d) => d.id));
  };

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>
      {children}
    </DropdownItem>
  );

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={onSelect}
      toggle={(toggleRef) => (
        <MenuToggle ref={toggleRef} variant="primary" isDisabled={isDisabled} onClick={onToggle}>
          {/* TRANSLATORS: drop down menu label */}
          {_("Perform an action")}
        </MenuToggle>
      )}
    >
      <DropdownList>
        {/** TRANSLATORS: drop down menu action, activate the device */}
        <Action key="activate" onClick={activate}>
          {_("Activate")}
        </Action>
        {/** TRANSLATORS: drop down menu action, deactivate the device */}
        <Action key="deactivate" onClick={deactivate}>
          {_("Deactivate")}
        </Action>
        <Divider key="first-separator" />
        {/** TRANSLATORS: drop down menu action, enable DIAG access method */}
        <Action key="set_diag_on" onClick={setDiagOn}>
          {_("Set DIAG On")}
        </Action>
        {/** TRANSLATORS: drop down menu action, disable DIAG access method */}
        <Action key="set_diag_off" onClick={setDiagOff}>
          {_("Set DIAG Off")}
        </Action>
        <Divider key="second-separator" />
        {/** TRANSLATORS: drop down menu action, format the disk */}
        <Action key="format" onClick={format}>
          {_("Format")}
        </Action>
      </DropdownList>
    </Dropdown>
  );
};

const filterDevices = (devices: DASDDevice[], from: string, to: string): DASDDevice[] => {
  const allChannels: number[] = devices.map((d) => d.hexId);
  const min = hex(from) || Math.min(...allChannels);
  const max = hex(to) || Math.max(...allChannels);

  return devices.filter((d) => d.hexId >= min && d.hexId <= max);
};

export default function DASDTable() {
  const devices = useDASDDevices();
  const { mutate: changeFilter } = useFilterDASDChange();
  const { mutate: changeSelected } = useSelectedDASDChange();
  const { minChannel, maxChannel } = useFilterDASD();
  const selectedDevices = useSelectedDASD();

  const [sortingColumn, setSortingColumn] = useState(columns[0]);
  const [sortDirection, setSortDirection]: ["asc" | "desc", Dispatch<SetStateAction<"asc" | "desc">>] = useState("asc");

  const sortColumnIndex = () => columns.findIndex((c) => c.id === sortingColumn.id);
  const filteredDevices = filterDevices(devices, minChannel, maxChannel);
  const selectedDevicesIds = selectedDevices.map((d) => d.id);

  // Selecting
  const selectAll = (isSelecting = true) => {
    changeSelected({ unselect: !isSelecting, devices: filteredDevices })
  };

  const selectDevice = (device, isSelecting = true) => {
    changeSelected({ unselect: !isSelecting, device })
  };

  // Sorting
  // See https://github.com/snovakovic/fast-sort
  const sortBy = sortingColumn.sortId || sortingColumn.id;
  const sortedDevices = sort(filteredDevices)[sortDirection]((d) => d[sortBy]);

  // FIXME: this can be improved and even extracted to be used with other tables.
  const getSortParams = (columnIndex) => {
    return {
      sortBy: { index: sortColumnIndex(), direction: sortDirection },
      onSort: (_event, index, direction) => {
        setSortingColumn(columns[index]);
        setSortDirection(direction);
      },
      columnIndex,
    };
  };

  // Filtering
  const onMinChannelFilterChange = (_event, value) => {
    changeFilter({ minChannel: value });
  };

  const onMaxChannelFilterChange = (_event, value) => {
    changeFilter({ maxChannel: value });
  };

  const removeMinChannelFilter = () => {
    changeFilter({ minChannel: "" });
  };

  const removeMaxChannelFilter = () => {
    changeFilter({ maxChannel: "" });
  };

  const Content = () => {
    return (

      <Table variant="compact">
        <Thead>
          <Tr>
            <Th aria-label="dasd-select"
              select={{
                onSelect: (_event, isSelecting) => selectAll(isSelecting),
                isSelected: filteredDevices.length === selectedDevices.length,
              }}
            />
            {columns.map((column, index) => (
              <Th key={column.id} sort={getSortParams(index)}>
                {column.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {sortedDevices.map((device, rowIndex) => (
            <Tr key={device.id}>
              <Td dataLabel={device.id}
                select={{
                  rowIndex,
                  onSelect: (_event, isSelecting) => selectDevice(device, isSelecting),
                  isSelected: selectedDevicesIds.includes(device.id),
                  isDisabled: false,
                }}
              />
              {columns.map((column) => (
                <Td key={column.id} dataLabel={column.label}>
                  {columnData(device, column)}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    );
  };

  return (
    <CardField>
      <CardBody>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup align={{ default: "alignRight" }}>
              <ToolbarItem>
                <TextInputGroup>
                  <TextInputGroupMain
                    value={minChannel}
                    type="text"
                    aria-label={_("Filter by min channel")}
                    placeholder={_("Filter by min channel")}
                    onChange={onMinChannelFilterChange}
                  />
                  {minChannel !== "" && (
                    <TextInputGroupUtilities>
                      <Button
                        variant="plain"
                        aria-label={_("Remove min channel filter")}
                        onClick={removeMinChannelFilter}
                      >
                        <Icon name="backspace" size="s" />
                      </Button>
                    </TextInputGroupUtilities>
                  )}
                </TextInputGroup>
              </ToolbarItem>
              <ToolbarItem>
                <TextInputGroup>
                  <TextInputGroupMain
                    value={maxChannel}
                    type="text"
                    aria-label={_("Filter by max channel")}
                    placeholder={_("Filter by max channel")}
                    onChange={onMaxChannelFilterChange}
                  />
                  {maxChannel !== "" && (
                    <TextInputGroupUtilities>
                      <Button
                        variant="plain"
                        aria-label={_("Remove max channel filter")}
                        onClick={removeMaxChannelFilter}
                      >
                        <Icon name="backspace" size="s" />
                      </Button>
                    </TextInputGroupUtilities>
                  )}
                </TextInputGroup>
              </ToolbarItem>

              <ToolbarItem variant="separator" />

              <ToolbarItem>
                <Actions
                  devices={selectedDevices}
                  isDisabled={selectedDevices.length === 0}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>

        <Content />
      </CardBody >
    </CardField >
  );
}
