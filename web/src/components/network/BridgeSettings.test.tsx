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
import { connectionFormOptions, BridgeStpMode } from "~/components/network/ConnectionForm";
import { DeviceState } from "~/types/network";
import { CONNECTION_TYPE } from "~/utils/network";
import BridgeSettings from "./BridgeSettings";

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
      name: "test-bridge",
      type: CONNECTION_TYPE.BRIDGE,
      ...defaultValues,
    },
  });

  return (
    <form.AppForm>
      <BridgeSettings form={form} isEditing={isEditing} />
    </form.AppForm>
  );
}

describe("BridgeSettings", () => {
  it("renders bridge fields", async () => {
    installerRender(<TestForm />);

    await screen.findByText("Bridge ports");
    screen.getByRole("textbox", { name: "Bridge ports" });
    screen.getByText(/Available devices: enp1s0 and enp2s0/);
    const stpSelector = await screen.findByLabelText("Spanning Tree Protocol (STP)");
    expect(stpSelector).toHaveTextContent("Default");
  });

  it("displays bridge ports", async () => {
    const { user } = installerRender(<TestForm />);

    const input = await screen.findByRole("textbox", { name: "Bridge ports" });
    await user.type(input, "enp1s0{enter}");
    await user.type(input, "enp2s0{enter}");

    expect(await screen.findByText("enp1s0")).toBeInTheDocument();
    expect(await screen.findByText("enp2s0")).toBeInTheDocument();
  });

  it("allows defining the device name for a new bridge connection", async () => {
    installerRender(<TestForm />);

    const ifaceField = await screen.findByLabelText("Device name");
    expect(ifaceField).toBeInTheDocument();
  });

  it("does not allow defining the device name when editing", async () => {
    installerRender(<TestForm isEditing />);

    expect(screen.queryByLabelText("Device name")).not.toBeInTheDocument();
  });

  it("shows STP options when STP is enabled with manual settings", async () => {
    const { user } = installerRender(<TestForm />);

    const stpSelector = await screen.findByLabelText("Spanning Tree Protocol (STP)");
    await user.click(stpSelector);
    await user.click(screen.getByRole("option", { name: /^Custom/ }));

    expect(await screen.findByLabelText(/Priority/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Forward delay/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Hello time/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Max message age/)).toBeInTheDocument();
  });

  it("hides STP options when STP is default", async () => {
    installerRender(<TestForm />);

    expect(screen.queryByLabelText(/Priority/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Forward delay/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hello time/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max message age/)).not.toBeInTheDocument();
  });

  it("hides STP options when STP is disabled", async () => {
    installerRender(<TestForm defaultValues={{ bridgeStp: BridgeStpMode.DISABLED }} />);

    expect(screen.queryByLabelText(/Priority/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Forward delay/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hello time/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max message age/)).not.toBeInTheDocument();
  });
});
