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

import React, { useState } from "react";
import {
  Button,
  Divider,
  Dropdown, DropdownItem, DropdownList,
  MenuToggle,
  TextInputGroup, TextInputGroupMain, TextInputGroupUtilities,
  Toolbar, ToolbarContent, ToolbarGroup, ToolbarItem
} from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { sort } from 'fast-sort';

import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { If, SectionSkeleton } from "~/components/core";
import { hex } from "~/utils";
import { useInstallerClient } from "~/context/installer";

// FIXME: please, note that this file still requiring refinements until reach a
//   reasonable stable version
const columnData = (device, column) => {
  let data = device[column.id];

  switch (column.id) {
    case 'formatted':
    case 'diag':
      if (!device.enabled)
        data = "";
      break;
    case 'partitionInfo':
      data = data.split(",").map(d => <div key={d}>{d}</div>);
      break;
  }

  if (typeof data === "boolean") {
    return data ? _("Yes") : _("No");
  }

  return data;
};

const columns = [
  { id: "channelId", sortId: "hexId", label: _("Channel ID") },
  { id: "status", label: _("Status") },
  { id: "name", label: _("Device") },
  { id: "type", label: _("Type") },
  { id: "diag", label: _("Diag") },
  { id: "formatted", label: _("Formatted") },
  { id: "partitionInfo", label: _("Partition Info") }
];

const Actions = ({ devices, isDisabled }) => {
  const { storage: client } = useInstallerClient();
  const [isOpen, setIsOpen] = useState(false);

  const onToggle = () => setIsOpen(!isOpen);
  const onSelect = () => setIsOpen(false);

  const activate = () => client.dasd.enableDevices(devices);
  const deactivate = () => client.dasd.disableDevices(devices);
  const setDiagOn = () => client.dasd.setDIAG(devices, true);
  const setDiagOff = () => client.dasd.setDIAG(devices, false);
  const format = () => {
    const offline = devices.filter(d => !d.enabled);

    if (offline.length > 0) {
      return false;
    }

    return client.dasd.format(devices);
  };

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>{children}</DropdownItem>
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
        { /** TRANSLATORS: drop down menu action, activate the device */ }
        <Action key="activate" onClick={activate}>{_("Activate")}</Action>
        { /** TRANSLATORS: drop down menu action, deactivate the device */ }
        <Action key="deactivate" onClick={deactivate}>{_("Deactivate")}</Action>
        <Divider key="first-separator" />
        { /** TRANSLATORS: drop down menu action, enable DIAG access method */ }
        <Action key="set_diag_on" onClick={setDiagOn}>{_("Set DIAG On")}</Action>
        { /** TRANSLATORS: drop down menu action, disable DIAG access method */ }
        <Action key="set_diag_off" onClick={setDiagOff}>{_("Set DIAG Off")}</Action>
        <Divider key="second-separator" />
        { /** TRANSLATORS: drop down menu action, format the disk */ }
        <Action key="format" onClick={format}>{_("Format")}</Action>
      </DropdownList>
    </Dropdown>
  );
};

const filterDevices = (devices, from, to) => {
  const allChannels = devices.map(d => d.hexId);
  const min = hex(from) || Math.min(...allChannels);
  const max = hex(to) || Math.max(...allChannels);

  return devices.filter(d => d.hexId >= min && d.hexId <= max);
};

export default function DASDTable({ state, dispatch }) {
  const [sortingColumn, setSortingColumn] = useState(columns[0]);
  const [sortDirection, setSortDirection] = useState('asc');

  const sortColumnIndex = () => columns.findIndex(c => c.id === sortingColumn.id);
  const filteredDevices = filterDevices(state.devices, state.minChannel, state.maxChannel);
  const selectedDevicesIds = state.selectedDevices.map(d => d.id);

  // Selecting
  const selectAll = (isSelecting = true) => {
    const type = isSelecting ? "SELECT_ALL_DEVICES" : "UNSELECT_ALL_DEVICES";
    dispatch({ type, payload: { devices: filteredDevices } });
  };

  const selectDevice = (device, isSelecting = true) => {
    const type = isSelecting ? "SELECT_DEVICE" : "UNSELECT_DEVICE";
    dispatch({ type, payload: { device } });
  };

  // Sorting
  // See https://github.com/snovakovic/fast-sort
  const sortBy = sortingColumn.sortBy || sortingColumn.id;
  const sortedDevices = sort(filteredDevices)[sortDirection](d => d[sortBy]);

  // FIXME: this can be improved and even extracted to be used with other tables.
  const getSortParams = (columnIndex) => {
    return {
      sortBy: { index: sortColumnIndex(), direction: sortDirection },
      onSort: (_event, index, direction) => {
        setSortingColumn(columns[index]);
        setSortDirection(direction);
      },
      columnIndex
    };
  };

  // Filtering
  const onMinChannelFilterChange = (_event, value) => {
    dispatch({ type: "SET_MIN_CHANNEL", payload: { minChannel: value } });
  };

  const onMaxChannelFilterChange = (_event, value) => {
    dispatch({ type: "SET_MAX_CHANNEL", payload: { maxChannel: value } });
  };

  const removeMinChannelFilter = () => {
    dispatch({ type: "SET_MIN_CHANNEL", payload: { minChannel: "" } });
  };

  const removeMaxChannelFilter = () => {
    dispatch({ type: "SET_MAX_CHANNEL", payload: { maxChannel: "" } });
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarGroup align={{ default: "alignRight" }}>
            <ToolbarItem>
              <TextInputGroup>
                <TextInputGroupMain
                  value={state.minChannel}
                  type="text"
                  aria-label={_("Filter by min channel")}
                  placeholder={_("Filter by min channel")}
                  onChange={onMinChannelFilterChange}
                />
                { state.minChannel !== "" &&
                  <TextInputGroupUtilities>
                    <Button
                      variant="plain"
                      aria-label={_("Remove min channel filter")}
                      onClick={removeMinChannelFilter}
                    >
                      <Icon name="backspace" size="24" />
                    </Button>
                  </TextInputGroupUtilities> }
              </TextInputGroup>
            </ToolbarItem>
            <ToolbarItem>
              <TextInputGroup>
                <TextInputGroupMain
                  value={state.maxChannel}
                  type="text"
                  aria-label={_("Filter by max channel")}
                  placeholder={_("Filter by max channel")}
                  onChange={onMaxChannelFilterChange}
                />
                { state.maxChannel !== "" &&
                  <TextInputGroupUtilities>
                    <Button
                      variant="plain"
                      aria-label={_("Remove max channel filter")}
                      onClick={removeMaxChannelFilter}
                    >
                      <Icon name="backspace" size="24" />
                    </Button>
                  </TextInputGroupUtilities> }
              </TextInputGroup>
            </ToolbarItem>

            <ToolbarItem variant="separator" />

            <ToolbarItem>
              <Actions devices={state.selectedDevices} isDisabled={state.selectedDevices.length === 0} />
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>

      <If
        condition={state.isLoading}
        then={<SectionSkeleton />}
        else={
          <Table variant="compact">
            <Thead>
              <Tr>
                <Th select={{ onSelect: (_event, isSelecting) => selectAll(isSelecting), isSelected: filteredDevices.length === state.selectedDevices.length }} />
                { columns.map((column, index) => <Th key={column.id} sort={getSortParams(index)}>{column.label}</Th>) }
              </Tr>
            </Thead>
            <Tbody>
              { sortedDevices.map((device, rowIndex) => (
                <Tr key={device.id}>
                  <Td select={{ rowIndex, onSelect: (_event, isSelecting) => selectDevice(device, isSelecting), isSelected: selectedDevicesIds.includes(device.id), isDisabled: false }} />
                  { columns.map(column => <Td key={column.id} dataLabel={column.label}>{columnData(device, column)}</Td>) }
                </Tr>
              ))}
            </Tbody>
          </Table>
        }
      />
    </>
  );
}
