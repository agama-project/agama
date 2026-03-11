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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockParams } from "~/test-utils";
import IpSettingsForm from "~/components/network/IpSettingsForm";

const mockMutateAsync = jest.fn().mockResolvedValue({});
jest.mock("~/hooks/model/config/network", () => ({
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

const mockUseConnection = jest.fn();
jest.mock("~/hooks/model/proposal/network", () => ({
  useConnection: (id: string) => mockUseConnection(id),
}));

describe("IpSettingsForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with a generated ID when adding a new connection", async () => {
    mockParams({ id: "Connection #1" });
    mockUseConnection.mockReturnValue(undefined);

    installerRender(<IpSettingsForm />);

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveValue("Connection #1");
  });

  it("allows editing the connection ID", async () => {
    mockParams({ id: "Connection #1" });
    mockUseConnection.mockReturnValue(undefined);

    const { user } = installerRender(<IpSettingsForm />);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "My New Connection");
    expect(nameInput).toHaveValue("My New Connection");

    const saveButton = screen.getByRole("button", { name: /save|accept|ok/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "My New Connection",
        }),
      );
    });
  });
});
