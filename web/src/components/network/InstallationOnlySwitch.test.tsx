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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import InstallationOnlySwitch from "./InstallationOnlySwitch";
import { Connection, ConnectionMethod, ConnectionOptions, ConnectionState } from "~/types/network";

const mockConnectionMutation = jest.fn();
const mockConnection = (options: Partial<ConnectionOptions> = {}) =>
  new Connection("Newtwork 2", {
    method4: ConnectionMethod.AUTO,
    method6: ConnectionMethod.AUTO,
    wireless: {
      security: "none",
      ssid: "Network 2",
      mode: "infrastructure",
    },
    state: ConnectionState.activating,
    ...options,
  });

jest.mock("~/hooks/network/config", () => ({
  ...jest.requireActual("~/hooks/network/config"),
  useConnectionMutation: () => ({
    mutateAsync: mockConnectionMutation,
  }),
}));

describe("InstallationOnlySwitch", () => {
  it("renders the switch with the correct label and description", () => {
    plainRender(<InstallationOnlySwitch connection={mockConnection()} />);
    const switchInput = screen.getByRole("switch", { name: "Use for installation only" });
    const switchDescription = screen.getByText(
      /The connection will be used only during installation/,
    );
    expect(switchInput).toHaveAttribute("aria-describedby", switchDescription.id);
  });

  it("renders as checked when connection is transient (`persistent` is false)", () => {
    plainRender(<InstallationOnlySwitch connection={mockConnection({ persistent: false })} />);
    const switchInput = screen.getByRole("switch", { name: "Use for installation only" });
    expect(switchInput).toBeChecked();
  });

  it("renders as not checked when connection is permanent (`persistent` is true)", () => {
    plainRender(<InstallationOnlySwitch connection={mockConnection({ persistent: true })} />);
    const switchInput = screen.getByRole("switch", { name: "Use for installation only" });
    expect(switchInput).not.toBeChecked();
  });

  it("triggers mutation for switching between transient and permanent", async () => {
    const connection = mockConnection({ persistent: true });
    const { user } = plainRender(<InstallationOnlySwitch connection={connection} />);
    const switchInput = screen.getByRole("switch", { name: "Use for installation only" });
    await user.click(switchInput);
    connection.persistent = false;
    expect(mockConnectionMutation).toHaveBeenCalledWith(connection);
  });
});
