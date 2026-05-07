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
import { connectionFormOptions } from "~/components/network/ConnectionForm";
import { DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import BondSettings from "./BondSettings";

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
    ...connectionFormOptions,
    defaultValues: {
      ...connectionFormOptions.defaultValues,
      name: "test-bond",
      type: CONNECTION_TYPE.BOND,
      ...defaultValues,
    },
  });

  return (
    <form.AppForm>
      <BondSettings form={form} isEditing={isEditing} />
    </form.AppForm>
  );
}

describe("BondSettings", () => {
  it("renders bond fields", async () => {
    installerRender(<TestForm />);

    await screen.findByLabelText("Bond mode");
    await screen.findByLabelText("Bond options");
    await screen.findByText("Bond ports");
    screen.getByRole("textbox", { name: "Bond ports" });
    screen.getByText(/Available devices: enp1s0 and enp2s0/);
  });

  it("displays bond ports", async () => {
    const { user } = installerRender(<TestForm />);

    const input = await screen.findByRole("textbox", { name: "Bond ports" });
    await user.type(input, "enp1s0{enter}");
    await user.type(input, "br0{enter}");

    expect(await screen.findByText("enp1s0")).toBeInTheDocument();
    expect(await screen.findByText("br0")).toBeInTheDocument();
  });

  it("allows defining the device name for a new bond connection", async () => {
    installerRender(<TestForm />);

    const ifaceField = await screen.findByLabelText("Device name");
    expect(ifaceField).toBeInTheDocument();
  });

  it("does not allow defining the device name when editing", async () => {
    installerRender(<TestForm isEditing />);

    expect(screen.queryByLabelText("Device name")).not.toBeInTheDocument();
  });
});
