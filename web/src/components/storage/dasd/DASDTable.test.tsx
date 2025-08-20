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

import React, { act } from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { DASDDevice } from "~/types/dasd";
import DASDTable from "./DASDTable";

let mockDASDDevices: DASDDevice[] = [];
let eventCallback;
const mockClient = {
  onEvent: jest.fn().mockImplementation((cb) => {
    eventCallback = cb;
    return () => {};
  }),
};

jest.mock("~/context/installer", () => ({
  ...jest.requireActual("~/context/installer"),
  useInstallerClient: () => mockClient,
}));

jest.mock("~/queries/storage/dasd", () => ({
  useDASDDevices: () => mockDASDDevices,
  useDASDMutation: () => ({
    mutate: jest.fn(),
  }),
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

    describe("when an action is requested", () => {
      it("set component as busy", async () => {
        const { user } = installerRender(<DASDTable />);
        const selection = screen.getByRole("checkbox", { name: "Select row 0" });
        await user.click(selection);
        const button = screen.getByRole("button", { name: "Activate" });
        await user.click(button);
        screen.getByRole("dialog", { name: "Applying changes" });
        expect(screen.queryByRole("checkbox", { name: "Select row 1" })).toBeNull();
      });
    });

    describe("when all pending actions are done", () => {
      it("set component as idle", async () => {
        const { user } = installerRender(<DASDTable />);
        const selection = screen.getByRole("checkbox", { name: "Select row 0" });
        await user.click(selection);
        const button = screen.getByRole("button", { name: "Activate" });
        await user.click(button);
        screen.getByRole("dialog", { name: "Applying changes" });
        expect(screen.queryByRole("checkbox", { name: "Select row 0" })).toBeNull();

        // Simulate a DASDDeviceChanged event
        //
        act(() => {
          eventCallback({ type: "DASDDeviceChanged", device: mockDASDDevices[0] });
        });

        expect(screen.queryByRole("dialog", { name: "Applying changes" })).toBeNull();
        screen.getByRole("checkbox", { name: "Select row 0" });
      });
    });
  });

  describe("DASDTable/DASDTableEmptyState", () => {
    describe("when there are no devices in the system", () => {
      beforeEach(() => {
        mockDASDDevices = [];
      });

      it("renders informative empty state with no actions", () => {
        installerRender(<DASDTable />);
        screen.getByRole("heading", { name: "No devices available", level: 2 });
        screen.getByText("No DASD devices were found in this machine.");
      });
    });

    describe("when filters results in no matching device", () => {
      it.todo("renders empty state with clear all filters option");
      // it("renders empty state with clear all filters option", async () => {
      //   const { user } = installerRender(<DASDTable />);
      //   const statusFilterToggle = screen.getByRole("button", { name: "Status" });
      //   await user.click(statusFilterToggle);
      //   const readOnlyOption = screen.getByRole("option", { name: "read_only"});
      //   await user.click(readOnlyOption);
      //   screen.getByRole("heading", { name: "No devices found", level: 2 });
      //   screen.getByRole("button", { name: "Clear all filters" });
      // });
    });
  });
});
