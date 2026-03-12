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
import { sprintf } from "sprintf-js";
import { FormSelect, FormSelectOption, FormSelectProps } from "@patternfly/react-core";
import { Device } from "~/types/network";
import { useDevices } from "~/hooks/model/system/network";
import { _ } from "~/i18n";

type DevicesSelectorProps = Omit<FormSelectProps, "children" | "ref"> & {
  /**
   * The key from the device object whose value should be used for a select value
   */
  valueKey: keyof Device;
};

/**
 * A specialized `FormSelect` component for displaying and selecting network
 * devices.
 *
 * The options' labels are formatted as "Device Name - MAC Address" or "MAC
 * Address - Device Name" based on the `valueKey` prop, ensuring both key
 * identifiers are visible.
 */
export default function DevicesSelector({
  value,
  valueKey,
  ...formSelectProps
}: DevicesSelectorProps): React.ReactNode {
  const devices = useDevices();

  const labelAttrs = valueKey === "macAddress" ? ["macAddress", "name"] : ["name", "macAddress"];

  return (
    <FormSelect value={value} {...formSelectProps}>
      {devices.map((device, index) => {
        // TRANSLATORS: A label shown in a dropdown for selecting a network
        // device. It combines the device name and MAC address, with the order
        // determined by the component settings: some selectors will show the
        // name first, others the MAC address. I.e. "enp1s0 - CC-7F-C8-FC-7A-A1"
        // or "CC-7F-C8-FC-7A-A1 - enp1s0". You may change the separator, but
        // please keep both %s placeholders.
        const label = sprintf(_("%s - %s"), device[labelAttrs[0]], device[labelAttrs[1]]);
        return <FormSelectOption key={index} value={device[valueKey]} label={label} />;
      })}
    </FormSelect>
  );
}
