/*
 * Copyright (c) [2026] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useAppForm } from "~/hooks/form";
import { defaultOptions, VlanProtocolMode } from "./fields";
import { DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import VlanFields from "./VlanFields";

const mockDevice1 = {
  name: "enp1s0",
  macAddress: "00:11:22:33:44:55",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.CONNECTED,
};

const mockDevice2 = {
  name: "enp2s0",
  macAddress: "AA:BB:CC:DD:EE:FF",
  type: CONNECTION_TYPE.ETHERNET,
  state: DeviceState.DISCONNECTED,
};

const mockDeviceLo = {
  name: "lo",
  macAddress: "00:00:00:00:00:00",
  type: CONNECTION_TYPE.LOOPBACK,
  state: DeviceState.CONNECTED,
};

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1, mockDevice2, mockDeviceLo],
}));

function TestForm({
  defaultValues = {},
  isEditing = false,
}: {
  defaultValues?: object;
  isEditing?: boolean;
}) {
  const form = useAppForm({
    ...defaultOptions,
    defaultValues: {
      ...defaultOptions.defaultValues,
      name: "test-vlan",
      type: CONNECTION_TYPE.VLAN,
      ...defaultValues,
    },
  });

  return (
    <form.AppForm>
      <VlanFields form={form} isEditing={isEditing} />
    </form.AppForm>
  );
}

describe("VlanFields", () => {
  it("renders vlan fields", async () => {
    installerRender(<TestForm />);

    expect(await screen.findByLabelText("Device name")).toBeInTheDocument();
    expect(await screen.findByLabelText("VLAN ID")).toBeInTheDocument();
    expect(await screen.findByLabelText("Parent device")).toBeInTheDocument();
    expect(await screen.findByLabelText("Encapsulation protocol")).toBeInTheDocument();

    expect(await screen.findByLabelText("Encapsulation protocol")).toHaveTextContent("Default");
  });

  it("allows setting the default protocol", async () => {
    installerRender(<TestForm defaultValues={{ vlanProtocol: VlanProtocolMode.DEFAULT }} />);

    expect(await screen.findByLabelText("Encapsulation protocol")).toHaveTextContent("Default");
  });

  it("allows defining the device name for a new vlan connection", async () => {
    installerRender(<TestForm />);

    const ifaceField = await screen.findByLabelText("Device name");
    expect(ifaceField).toBeInTheDocument();
  });

  it("allows defining the device name when editing", async () => {
    installerRender(<TestForm isEditing />);

    expect(await screen.findByLabelText("Device name")).toBeInTheDocument();
  });

  it("suggests the device name based on parent device and VLAN ID even when editing", async () => {
    const { user } = installerRender(<TestForm isEditing />);

    // Select parent device enp1s0
    await user.click(screen.getByLabelText("Parent device"));
    await user.click(screen.getByRole("option", { name: /enp1s0/ }));

    // Set VLAN ID to 100
    await user.type(screen.getByLabelText("VLAN ID"), "100");

    // Device name should be suggested as enp1s0.100
    expect(screen.getByLabelText("Device name")).toHaveValue("enp1s0.100");
  });

  it("filters parent device options to exclude the current device name and 'lo'", async () => {
    const { user } = installerRender(<TestForm defaultValues={{ vlanIface: "enp1s0" }} />);

    // Open the dropdown
    const parentToggle = await screen.findByLabelText("Parent device");
    await user.click(parentToggle);

    // enp1s0 should be filtered out
    expect(screen.queryByRole("option", { name: /enp1s0/ })).not.toBeInTheDocument();
    // lo should be filtered out
    expect(screen.queryByRole("option", { name: /lo/ })).not.toBeInTheDocument();
    // enp2s0 should be present
    expect(screen.getByRole("option", { name: /enp2s0/ })).toBeInTheDocument();
  });

  it("suggests the device name based on parent device and VLAN ID", async () => {
    const { user } = installerRender(<TestForm />);

    // Select parent device enp1s0
    await user.click(screen.getByLabelText("Parent device"));
    await user.click(screen.getByRole("option", { name: /enp1s0/ }));

    // Set VLAN ID to 100
    await user.type(screen.getByLabelText("VLAN ID"), "100");

    // Device name should be suggested as enp1s0.100
    expect(screen.getByLabelText("Device name")).toHaveValue("enp1s0.100");
  });

  it("does not suggest the device name if it has been manually edited", async () => {
    const { user } = installerRender(<TestForm />);

    // Manually set device name
    await user.type(screen.getByLabelText("Device name"), "custom-vlan");

    // Select parent device enp1s0
    await user.click(screen.getByLabelText("Parent device"));
    await user.click(screen.getByRole("option", { name: /enp1s0/ }));

    // Set VLAN ID to 100
    await user.type(screen.getByLabelText("VLAN ID"), "100");

    // Device name should remain as custom-vlan
    expect(screen.getByLabelText("Device name")).toHaveValue("custom-vlan");
  });
});
