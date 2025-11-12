/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { FormSelectProps, FormSelect, FormSelectOption } from "@patternfly/react-core";

import { deviceLabel } from "~/components/storage/utils";
import { storage } from "~/api/system";

type DevicesFormSelectBaseProps = {
  devices: storage.Device[];
  selectedDevice: storage.Device;
  onChange: (device: storage.Device) => void;
};

type DevicesFormSelectProps = DevicesFormSelectBaseProps &
  Omit<FormSelectProps, "value" | "onChange" | "children">;

export default function DevicesFormSelect({
  devices,
  selectedDevice,
  onChange,
  ...otherProps
}: DevicesFormSelectProps) {
  return (
    /** @ts-expect-error: for some reason using otherProps makes TS complain */
    <FormSelect
      {...otherProps}
      value={selectedDevice?.sid}
      onChange={(_, value) => onChange(devices.find((d) => d.sid === Number(value)))}
    >
      {devices.map((device) => (
        <FormSelectOption key={device.sid} value={device.sid} label={deviceLabel(device)} />
      ))}
    </FormSelect>
  );
}
