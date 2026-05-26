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

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => [mockDevice1, mockDevice2],
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

    expect(screen.getByText(/Available devices: enp1s0 and enp2s0/)).toBeInTheDocument();
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

  it("does not allow defining the device name when editing", async () => {
    installerRender(<TestForm isEditing />);

    expect(screen.queryByLabelText("Device name")).not.toBeInTheDocument();
    expect(screen.getByText("Device name")).toBeInTheDocument(); // ReadOnlyField label
  });
});
