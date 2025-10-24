/*
 * Copyright (c) [2025] SUSE LLC
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
import { Content, List, ListItem, Stack } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import Popup from "~/components/core/Popup";
import { DASDDevice } from "~/types/dasd";
import { useFormatDASDMutation } from "~/queries/storage/dasd";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { isEmpty } from "radashi";

/**
 * Shared type for defining props used by all DASD format-related dialogs and
 * the main controller component.
 */
type CommonFormatDASDProps = {
  /** A single DASD device, used for single-device dialogs. */
  device: DASDDevice;
  /** An array of DASD devices selected for formatting. */
  devices: DASDDevice[];
  /** Callback triggered when the user confirms the format operation. */
  onCancel?: () => void;
  /** Callback triggered when the user cancels the operation. */
  onAccept?: () => void;
};

/**
 * Renders ids of given DASD devices in a simple, unordered list
 */
const DevicesList = ({ devices }: Pick<CommonFormatDASDProps, "devices">) => (
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
const DeviceOffline = ({
  device,
  onCancel,
}: Pick<CommonFormatDASDProps, "device" | "onCancel">) => {
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
const SomeDevicesOffline = ({
  devices,
  onCancel,
}: Pick<CommonFormatDASDProps, "devices" | "onCancel">) => {
  const offlineDevices = devices.filter((d) => !d.enabled);
  const totalOffline = offlineDevices.length;

  return (
    <Popup isOpen title={_("Cannot format all the selected devices")}>
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
const DeviceFormatConfirmation = ({
  device,
  onAccept,
  onCancel,
}: Pick<CommonFormatDASDProps, "device" | "onAccept" | "onCancel">) => {
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
const MultipleDevicesFormatConfirmation = ({
  devices,
  onAccept,
  onCancel,
}: Pick<CommonFormatDASDProps, "devices" | "onAccept" | "onCancel">) => {
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
 * Controller component responsible for rendering the appropriate format dialog
 * based on device status and proceeding with the action upon confirmation.
 *
 * It dynamically selects which dialog to show depending on:
 *   - Whether devices are online or offline.
 *   - Whether a single or multiple devices are selected.
 *
 * On user confirmation, the component triggers the `formatDASD` mutation with
 * all selected device IDs, then calls the `onAccept` callback.
 *
 * @remarks
 *
 * This component assumes the format operation succeeds and calls `onAccept()`
 * immediately after triggering the mutation. It does not handle or display
 * errors.
 */
export default function FormatActionHandler({
  devices,
  onAccept,
  onCancel,
}: Pick<CommonFormatDASDProps, "devices" | "onAccept" | "onCancel">) {
  const { mutate: formatDASD } = useFormatDASDMutation();
  const format = () => {
    formatDASD(devices.map((d) => d.id));
    onAccept();
  };

  if (isEmpty(devices)) {
    console.error("FormatActionHnalder called without devices");
    return;
  }

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
}
