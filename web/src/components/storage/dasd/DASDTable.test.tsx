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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { DASDDevice } from "~/types/dasd";
import DASDTable from "./DASDTable";

let mockDASDDevices: DASDDevice[] = [];

jest.mock("~/queries/storage/dasd", () => ({
  useDASDDevices: () => mockDASDDevices,
  useDASDMutation: () => jest.fn(),
  useFormatDASDMutation: () => jest.fn(),
}));

jest.mock("~/components/storage/dasd/FormatActionHandler", () => () => (
  <div>FormatActionHandler Mock</div>
));

describe("DASDTable", () => {
  describe("when there is some DASD devices available", () => {
    beforeEach(() => {
      mockDASDDevices = [
        {
          id: "0.0.0160",
          enabled: false,
          deviceName: "",
          deviceType: "",
          formatted: false,
          diag: false,
          status: "offline",
          accessType: "",
          partitionInfo: "",
          hexId: 0x160,
        },
        {
          id: "0.0.0200",
          enabled: true,
          deviceName: "dasda",
          deviceType: "eckd",
          formatted: false,
          diag: false,
          status: "active",
          accessType: "rw",
          partitionInfo: "1",
          hexId: 0x200,
        },
      ];
    });

    it("renders those devices", () => {
      installerRender(<DASDTable />);
      screen.getByText("active");
    });

    it("does not offer bulk actions until a device is selected", async () => {
      const { user } = installerRender(<DASDTable />);
      screen.getByText("Select devices to enable bulk actions.");
      expect(screen.queryByRole("button", { name: "Activate" })).toBeNull();
      const selection = screen.getByRole("checkbox", { name: "Select row 0" });
      await user.click(selection);
      expect(screen.queryByText("Select devices to enable bulk actions.")).toBeNull();
      screen.getByRole("button", { name: "Activate" });
    });

    it("mounts FormatActionHandler on format action request", async () => {
      const { user } = installerRender(<DASDTable />);
      const selection = screen.getByRole("checkbox", { name: "Select row 1" });
      await user.click(selection);
      const button = screen.getByRole("button", { name: "Format" });
      await user.click(button);
      screen.getByText("FormatActionHandler Mock");
    });
  });
});
