/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { isEmpty } from "radashi";

import type { Device } from "~/model/system/dasd";

/**
 * Shared type for defining props used by all DASD format-related dialogs and
 * the main controller component.
 */
type CommonFormatDASDProps = {
  /** A single DASD device, used for single-device dialogs. */
  device: Device;
  /** An array of DASD devices selected for formatting. */
  devices: Device[];
  /**
   * Callback triggered when the user confirms the format operation.
   */
  onAccept?: () => void;
  /**
   * Callback triggered when the dialog is dismissed, either after confirming
   * or cancelling. Always called last, regardless of the outcome.
   */
  onClose?: () => void;
};

/**
 * Props for the {@link FormatActionHandler} controller component.
 */
type FormatActionHandlerProps = {
  /** Devices selected for formatting. */
  devices: Device[];
  /**
   * Callback triggered when the user confirms the format operation.
   * Called before onClose.
   */
  onFormat: () => void;
  /**
   * Callback triggered when the dialog is dismissed, either after confirming
   * or cancelling. Always called last, regardless of the outcome.
   */
  onClose: () => void;
};

/**
 * Renders ids of given DASD devices in a simple, unordered list
 */
const DevicesList = ({ devices }: Pick<CommonFormatDASDProps, "devices">) => (
  <List>
    {devices.map((d: Device) => (
      <ListItem key={d.channel}>
        {d.channel} {d.deviceName}
      </ListItem>
    ))}
  </List>
);

/**
 * Renders a popup indicating a specific device is offline.
 * Used when attempting to format a single device that is disabled.
 */
const DeviceOffline = ({ device, onClose }: Pick<CommonFormatDASDProps, "device" | "onClose">) => {
  return (
    <Popup isOpen title={sprintf(_("Cannot format %s"), device.channel)}>
      <Stack hasGutter>
        <Content>{_("It is offline and must be activated before formatting it.")}</Content>
      </Stack>
      <Popup.Actions>
        <Popup.Confirm onClick={onClose}>{_("Accept")}</Popup.Confirm>
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
  onClose,
}: Pick<CommonFormatDASDProps, "devices" | "onClose">) => {
  const offlineDevices = devices.filter((d) => d.status === "offline");
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
        <Popup.Confirm onClick={onClose}>{_("Accept")}</Popup.Confirm>
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
  onClose,
}: Pick<CommonFormatDASDProps, "device" | "onAccept" | "onClose">) => {
  return (
    <Popup isOpen title={sprintf(_("Format device %s"), device.channel)}>
      <Content>
        <Stack hasGutter>
          <Text isBold>{_("This action will destroy any data stored on the device.")}</Text>
          <Text>{_("Confirm that you really want to continue.")}</Text>
        </Stack>
      </Content>
      <Popup.Actions>
        <Popup.DangerousAction onClick={onAccept}>{_("Format now")}</Popup.DangerousAction>
        <Popup.Cancel onClick={onClose} autoFocus />
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
  onClose,
}: Pick<CommonFormatDASDProps, "devices" | "onAccept" | "onClose">) => {
  return (
    <Popup isOpen title={_("Format selected devices?")}>
      <Content isEditorial>
        <Stack hasGutter>
          <Text isBold>
            {_("This action will destroy any data stored on the devices listed below.")}
          </Text>
          <DevicesList devices={devices} />
          <Text>{_("Confirm that you really want to continue.")}</Text>
        </Stack>
      </Content>
      <Popup.Actions>
        <Popup.DangerousAction onClick={onAccept}>{_("Format now")}</Popup.DangerousAction>
        <Popup.Cancel onClick={onClose} autoFocus />
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
 * On user confirmation, the component triggers the `onFormat` callback.
 *
 * @remarks
 *
 * This component assumes the format operation succeeds and calls `onAccept()`
 * immediately after triggering the mutation. It does not handle or display
 * errors nor any kind of progresses, responsability of other components in the
 * UI.
 */
export default function FormatActionHandler({
  devices,
  onFormat,
  onClose,
}: FormatActionHandlerProps) {
  if (isEmpty(devices)) {
    console.error("FormatActionHandler called without devices");
    return;
  }

  const format = () => {
    onFormat();
    onClose();
  };

  if (devices.length === 1) {
    const device = devices[0];

    if (device.status === "active") {
      return <DeviceFormatConfirmation device={device} onAccept={format} onClose={onClose} />;
    } else {
      return <DeviceOffline device={device} onClose={onClose} />;
    }
  }

  if (devices.some((d) => d.status === "offline")) {
    return <SomeDevicesOffline devices={devices} onClose={onClose} />;
  } else {
    return (
      <MultipleDevicesFormatConfirmation devices={devices} onAccept={format} onClose={onClose} />
    );
  }
}
