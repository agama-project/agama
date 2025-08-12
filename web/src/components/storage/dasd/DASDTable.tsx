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

import React, { useReducer, useState } from "react";
import {
  Button,
  Content,
  Divider,
  List,
  ListItem,
  Stack,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { Popup, SelectableDataTable } from "~/components/core";
import { Icon } from "~/components/layout";
import { _, n_ } from "~/i18n";
import { hex } from "~/utils";
import { sort } from "fast-sort";
import { DASDDevice } from "~/types/dasd";
import { useDASDDevices, useDASDMutation, useFormatDASDMutation } from "~/queries/storage/dasd";
import type { SortedBy } from "~/components/core/SelectableDataTable";
import { sprintf } from "sprintf-js";
import Text from "~/components/core/Text";

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

/**
 * Renders a popup indicating a specific device is offline.
 * Used when attempting to format a single device that is disabled.
 */
const DeviceOffline = ({ device, onCancel }) => {
  return (
    <Popup isOpen title={sprintf(_("Cannot format %s"), device.id)}>
      <Stack hasGutter>
        <Content>{_("It is offline and must be activated before formatting it.")}</Content>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onCancel}>{_("Accept")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Shows a popup listing multiple offline devices,
 * preventing a format action on them.
 */
const SomeDevicesOffline = ({ devices, onCancel }) => {
  const offlineDevices = devices.filter((d) => !d.enabled);
  const totalOffline = offlineDevices.length;

  return (
    <Popup isOpen title={_("Cannot format all selected devices")}>
      <Stack hasGutter>
        <Content>
          {sprintf(_("Below %s devices are offline and cannot be formatted."), totalOffline)}
        </Content>
        <Content>{_("Unselect or activate them and try it again.")}</Content>
        <DevicesList devices={offlineDevices} />
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onCancel}>{_("Accept")}</Popup.Confirm>
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Renders a format confirmation dialog for formatting a single device.
 */
const DeviceFormatConfirmation = ({ device, onAccept, onCancel }) => {
  return (
    <Popup isOpen title={sprintf(_("Format device %s"), device.id)}>
      <Content>
        <Stack hasGutter>
          <Text isBold>{_("This action could destroy any data stored on the device.")}</Text>
          <Text>{_("Confirm that you really want to continue.")}</Text>
        </Stack>
      </Content>
      <Popup.Actions>
        <Popup.DangerousAction onClick={onAccept}>{_("Format now")}</Popup.DangerousAction>
        <Popup.Cancel onClick={onCancel} autoFocus />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Renders a confirmation dialog for formatting multiple selected devices.
 */
const MultipleDevicesFormatConfirmation = ({ devices, onAccept, onCancel }) => {
  return (
    <Popup isOpen title={_("Format selected devices?")}>
      <Content isEditorial>
        <Stack hasGutter>
          <Text isBold>
            {_("This action could destroy any data stored on the devices listed below.")}
          </Text>
          <DevicesList devices={devices} />
          <Text>{_("Confirm that you really want to continue.")}</Text>
        </Stack>
      </Content>
      <Popup.Actions>
        <Popup.DangerousAction onClick={onAccept}>{_("Format now")}</Popup.DangerousAction>
        <Popup.Cancel onClick={onCancel} autoFocus />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Central dispatcher component for rendering the appropriate format dialog,
 * based on whether the selected devices are online/offline and how many are
 * selected.
 */
const FormatRequestHandler = ({ devices, onAccept, onCancel }) => {
  const { mutate: formatDASD } = useFormatDASDMutation();
  const format = () => {
    formatDASD(devices.map((d) => d.id));
    onAccept();
  };

  if (devices.length === 1) {
    const device = devices[0];

    if (device.enabled) {
      return <DeviceFormatConfirmation device={device} onAccept={format} onCancel={onCancel} />;
    } else {
      return <DeviceOffline device={device} onCancel={onCancel} />;
    }
  }

  if (devices.some((d) => !d.enabled)) {
    return <SomeDevicesOffline devices={devices} onCancel={onCancel} />;
  } else {
    return (
      <MultipleDevicesFormatConfirmation devices={devices} onAccept={format} onCancel={onCancel} />
    );
  }
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

/**
 * Represents the component state.
 */
type DASDTableState = {
  formatRequested: boolean;
  selectedDevices: DASDDevice[];
};

/**
 * Supported actions.
 */
type DASDTableAction =
  | { type: "REQUEST_FORMAT"; devices: DASDTableState["selectedDevices"] }
  | { type: "CANCEL_FORMAT_REQUEST" };

/**
 * Reducer for triggering actions.
 */
const reducer = (state: DASDTableState, action: DASDTableAction): DASDTableState => {
  switch (action.type) {
    case "REQUEST_FORMAT": {
      return { ...state, formatRequested: true, selectedDevices: action.devices };
    }

    case "CANCEL_FORMAT_REQUEST": {
      return { ...state, formatRequested: false, selectedDevices: [] };
    }
  }
};

/**
 * Provides individual action buttons for a group of selected DASD devices.
 */
const BulkActions = ({ devices, onFormatRequest }) => {
  const { mutate: updateDASD } = useDASDMutation();

  const devicesIds = devices.map((d) => d.id);
  const actions = [
    {
      title: _("Activate"),
      onClick: () => updateDASD({ action: "enable", devices: devicesIds }),
    },
    {
      title: _("Deactivate"),
      onClick: () => updateDASD({ action: "disable", devices: devicesIds }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Set DIAG on"),
      onClick: () => updateDASD({ action: "diagOn", devices: devicesIds }),
    },
    {
      title: _("Set DIAG off"),
      onClick: () => updateDASD({ action: "diagOff", devices: devicesIds }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Format"),
      onClick: () => onFormatRequest(devices),
    },
  ];

  return actions
    .filter((a) => !a.isSeparator)
    .map(({ onClick, title }, i) => (
      <ToolbarItem key={i}>
        <Button size="sm" key={i} onClick={onClick} variant="control">
          {title}
        </Button>
      </ToolbarItem>
    ));
};
/**
 * Toolbar section displaying available bulk actions for selected devices.
 * Dynamically adjusted based on selection count.
 */
const ActionsToolbar = ({ devices, onFormatRequest }) => {
  const text = sprintf(
    n_(
      // TRANSLATORS: message shown in bulk action toolbar when just one device
      // is selected
      "Apply to the selected device",
      // TRANSLATORS: message shown in bulk action toolbar when some devices are
      // selected. %s is replaced with the amount of devices
      "Apply to the %s selected devices",
      devices.length,
    ),
    devices.length,
  );

  return (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup>
          {devices.length ? (
            <>
              {text} <BulkActions devices={devices} onFormatRequest={onFormatRequest} />
            </>
          ) : (
            _("Select devices to enable bulk actions.")
          )}
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

export default function DASDTable() {
  const devices = useDASDDevices();
  const { mutate: updateDASD } = useDASDMutation();
  const [state, dispatch] = useReducer(reducer, {
    formatRequested: false,
    selectedDevices: [],
  });
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

  return (
    <>
      <Content>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup>
              <ToolbarItem>
                <TextInputGroup label="">
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
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        <Divider />
        <ActionsToolbar
          devices={selectedDASD}
          onFormatRequest={() => dispatch({ type: "REQUEST_FORMAT", devices: selectedDASD })}
        />
        <Divider />
      </Content>

      {state.formatRequested && (
        <FormatRequestHandler
          devices={state.selectedDevices}
          onAccept={() => {
            dispatch({ type: "CANCEL_FORMAT_REQUEST" });
          }}
          onCancel={() => dispatch({ type: "CANCEL_FORMAT_REQUEST" })}
        />
      )}
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
        itemActions={(d) => [
          {
            title: _("Activate"),
            onClick: () => updateDASD({ action: "enable", devices: [d.id] }),
          },
          {
            title: _("Deactivate"),
            onClick: () => updateDASD({ action: "disable", devices: [d.id] }),
          },
          {
            isSeparator: true,
          },
          {
            title: _("Set DIAG on"),
            onClick: () => updateDASD({ action: "diagOn", devices: [d.id] }),
          },
          {
            title: _("Set DIAG off"),
            onClick: () => updateDASD({ action: "diagOff", devices: [d.id] }),
          },
          {
            isSeparator: true,
          },
          {
            title: _("Format"),
            isDanger: true,
            onClick: () => {
              dispatch({ type: "REQUEST_FORMAT", devices: [d] });
              // formatDASD([d.id]),
            },
          },
        ]}
        itemActionsLabel={(d) => `Actions for ${d.id}`}
      />
    </>
  );
}
