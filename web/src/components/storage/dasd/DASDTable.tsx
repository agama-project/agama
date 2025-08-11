/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import {
  Button,
  Content,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  List,
  ListItem,
  MenuToggle,
  Stack,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Page, Popup, SelectableDataTable } from "~/components/core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import { hex } from "~/utils";
import { sort } from "fast-sort";
import { DASDDevice } from "~/types/dasd";
import { useDASDDevices, useDASDMutation, useFormatDASDMutation } from "~/queries/storage/dasd";
import { SortedBy } from "~/components/core/SelectableDataTable";

const columns = [
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Channel ID"),
    sortingKey: "hexId",
    value: (d: DASDDevice) => d.id,
  },

  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Status"),
    value: (d: DASDDevice) => d.status,
    sortingKey: "status",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Device"),
    value: (d: DASDDevice) => d.deviceName,
    sortingKey: "deviceName",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Type"),
    value: (d: DASDDevice) => d.deviceType,
    sortingKey: "deviceType",
  },
  {
    // TRANSLATORS: table header for `DIAG access mode` on DASD devices table.
    // It refers to an special disk access mode on IBM mainframes. Keep
    // untranslated.
    name: _("DIAG"),
    value: (d: DASDDevice) => {
      if (!d.enabled) return "";
      d.diag ? _("Yes") : _("No");
    },
    sortingKey: "diag",
  },
  {
    // TRANSLATORS: table header for a column in a DASD devices table that
    // usually contents Yes or No values
    name: _("Formatted"),
    value: (d: DASDDevice) => (d.formatted ? _("Yes") : _("No")),
    sortingKey: "formatted",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Partition Info"),
    value: (d: DASDDevice) => d.partitionInfo.split(",").map((d: string) => <div key={d}>{d}</div>),
    sortingKey: "partitionInfo",
  },
];

const DevicesList = ({ devices }) => (
  <List>
    {devices.map((d: DASDDevice) => (
      <ListItem key={d.id}>{d.id}</ListItem>
    ))}
  </List>
);
const FormatNotPossible = ({ devices, onAccept }) => (
  <Popup isOpen title={_("Cannot format all selected devices")}>
    <Stack hasGutter>
      <Content>
        {_(
          "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again",
        )}
      </Content>
      <DevicesList devices={devices} />
    </Stack>
    <Popup.Actions>
      <Popup.Confirm onClick={onAccept}>{_("Accept")}</Popup.Confirm>
    </Popup.Actions>
  </Popup>
);

const FormatConfirmation = ({ devices, onCancel, onConfirm }) => (
  <Popup isOpen title={_("Format selected devices?")}>
    <Stack hasGutter>
      <Content>
        {_(
          "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.",
        )}
      </Content>
      <DevicesList devices={devices} />
    </Stack>
    <Popup.Actions>
      <Popup.Confirm onClick={onConfirm} />
      <Popup.Cancel onClick={onCancel} autoFocus />
    </Popup.Actions>
  </Popup>
);

const Actions = ({ devices, isDisabled }: { devices: DASDDevice[]; isDisabled: boolean }) => {
  const { mutate: updateDASD } = useDASDMutation();
  const { mutate: formatDASD } = useFormatDASDMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [requestFormat, setRequestFormat] = useState(false);

  const onToggle = () => setIsOpen(!isOpen);
  const onSelect = () => setIsOpen(false);
  const cancelFormatRequest = () => setRequestFormat(false);

  const deviceIds = devices.map((d) => d.id);
  const offlineDevices = devices.filter((d) => !d.enabled);
  const offlineDevicesSelected = offlineDevices.length > 0;
  const activate = () => updateDASD({ action: "enable", devices: deviceIds });
  const deactivate = () => updateDASD({ action: "disable", devices: deviceIds });
  const setDiagOn = () => updateDASD({ action: "diagOn", devices: deviceIds });
  const setDiagOff = () => updateDASD({ action: "diagOff", devices: deviceIds });
  const format = () => formatDASD(devices.map((d) => d.id));

  const Action = ({ children, ...props }) => (
    <DropdownItem component="button" {...props}>
      {children}
    </DropdownItem>
  );

  return (
    <>
      {requestFormat && offlineDevicesSelected && (
        <FormatNotPossible devices={offlineDevices} onAccept={cancelFormatRequest} />
      )}

      {requestFormat && !offlineDevicesSelected && (
        <FormatConfirmation
          devices={devices}
          onCancel={cancelFormatRequest}
          onConfirm={() => {
            cancelFormatRequest();
            format();
          }}
        />
      )}
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
          <Action key="format" onClick={() => setRequestFormat(true)}>
            {_("Format")}
          </Action>
        </DropdownList>
      </Dropdown>
    </>
  );
};

const filterDevices = (devices: DASDDevice[], from: string, to: string): DASDDevice[] => {
  const allChannels = devices.map((d) => d.hexId);
  const min = hex(from) || Math.min(...allChannels);
  const max = hex(to) || Math.max(...allChannels);

  return devices.filter((d) => d.hexId >= min && d.hexId <= max);
};

type FilterOptions = {
  minChannel?: string;
  maxChannel?: string;
};

export default function DASDTable() {
  const devices = useDASDDevices();
  const [sortedBy, updateSortedBy] = useState<SortedBy>({ index: 0, direction: "asc" });

  const [selectedDASD, setSelectedDASD] = useState<DASDDevice[]>([]);
  const [{ minChannel, maxChannel }, setFilters] = useState<FilterOptions>({
    minChannel: "",
    maxChannel: "",
  });

  const filteredDevices = filterDevices(devices, minChannel, maxChannel);

  // Sorting
  // See https://github.com/snovakovic/fast-sort
  const sortedDevices = sort(filteredDevices)[sortedBy.direction](
    (d) => d[columns[sortedBy.index].sortingKey],
  );

  const updateFilter = (newFilters: FilterOptions) => {
    setFilters((currentFilters) => ({ ...currentFilters, ...newFilters }));
  };

  const PageContent = () => {
    return (
      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        selectionMode="multiple"
        itemsSelected={selectedDASD}
        variant="compact"
        onSelectionChange={setSelectedDASD}
        sortedBy={sortedBy}
        updateSorting={updateSortedBy}
        allowSelectAll
      />
    );
  };

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarItem>
              <TextInputGroup>
                <TextInputGroupMain
                  value={minChannel}
                  type="text"
                  aria-label={_("Filter by min channel")}
                  placeholder={_("Filter by min channel")}
                  onChange={(_, minChannel) => updateFilter({ minChannel })}
                />
                {minChannel !== "" && (
                  <TextInputGroupUtilities>
                    <Button
                      variant="plain"
                      aria-label={_("Remove min channel filter")}
                      onClick={() => updateFilter({ minChannel: "" })}
                      icon={<Icon name="backspace" />}
                    />
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
                  onChange={(_, maxChannel) => updateFilter({ maxChannel })}
                />
                {maxChannel !== "" && (
                  <TextInputGroupUtilities>
                    <Button
                      variant="plain"
                      aria-label={_("Remove max channel filter")}
                      onClick={() => updateFilter({ maxChannel: "" })}
                      icon={<Icon name="backspace" />}
                    />
                  </TextInputGroupUtilities>
                )}
              </TextInputGroup>
            </ToolbarItem>

            <ToolbarItem variant="separator" />

            <ToolbarItem>
              <Actions devices={selectedDASD} isDisabled={selectedDASD.length === 0} />
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>

      <Page.Section aria-label={_("DASDs table section")}>
        <PageContent />
      </Page.Section>
    </>
  );
}
