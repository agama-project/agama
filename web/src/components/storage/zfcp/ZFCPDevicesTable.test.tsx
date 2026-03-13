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
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import ZFCPDevicesTable from "./ZFCPDevicesTable";
import type { ZFCP as System } from "~/model/system";
import type { Config } from "~/model/config/zfcp";

const mockAddDevices = jest.fn();
const mockRemoveDevices = jest.fn();
const mockUseConfig = jest.fn();
const mockCheckLunScan = jest.fn();

jest.mock("~/hooks/model/config/zfcp", () => ({
  useAddDevices: () => mockAddDevices,
  useRemoveDevices: () => mockRemoveDevices,
  useConfig: () => mockUseConfig(),
}));

jest.mock("~/hooks/model/system/zfcp", () => ({
  useCheckLunScan: () => mockCheckLunScan,
}));

let mockZFCPDevices: System.Device[] = [];
let mockConfig: Config = {};

describe("ZFCPDevicesTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockZFCPDevices = [
      {
        channel: "0.0.1a10",
        wwpn: "0x5005076305018611",
        lun: "0x0001000000000000",
        active: true,
        deviceName: "dasda",
      },
      {
        channel: "0.0.1a10",
        wwpn: "0x5005076305018612",
        lun: "0x0002000000000000",
        active: false,
        deviceName: "",
      },
      {
        channel: "0.0.2b20",
        wwpn: "0x5005076305018612",
        lun: "0x0003000000000000",
        active: false,
        deviceName: "",
      },
    ];

    mockConfig = { devices: [] };
    mockUseConfig.mockReturnValue(mockConfig);
    mockCheckLunScan.mockReturnValue(false);
  });

  describe("when there are some zFCP devices available", () => {
    it("renders those devices", () => {
      installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);

      // All LUNs appear as rows
      screen.getByText("0x0001000000000000");
      screen.getByText("0x0002000000000000");
      screen.getByText("0x0003000000000000");

      // Status values are rendered
      screen.getByText("Activated");
      expect(screen.queryAllByText("Deactivated").length).toBe(2);

      // Device name is shown for the active device
      screen.getByText("dasda");
    });
  });

  describe("filtering", () => {
    describe("status filter", () => {
      it("renders only devices matching the selected status", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));

        screen.getByText("0x0001000000000000");
        expect(screen.queryByText("0x0002000000000000")).toBeNull();
        expect(screen.queryByText("0x0003000000000000")).toBeNull();
      });
    });

    describe("channel filter", () => {
      it("renders only devices matching the selected channel", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Channel"));
        await user.click(screen.getByRole("option", { name: "0.0.1a10" }));

        screen.getByText("0x0001000000000000");
        screen.getByText("0x0002000000000000");
        expect(screen.queryByText("0x0003000000000000")).toBeNull();
      });
    });

    describe("wwpn filter", () => {
      it("renders only devices matching the selected wwpn", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("WWPN"));
        await user.click(screen.getByRole("option", { name: "0x5005076305018611" }));

        screen.getByText("0x0001000000000000");
        expect(screen.queryByText("0x0002000000000000")).toBeNull();
        expect(screen.queryByText("0x0003000000000000")).toBeNull();
      });
    });

    describe("device count", () => {
      it("renders the total device count when no filter is active", () => {
        installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        screen.getByText("3 devices available");
      });

      it("renders matching vs total count when a filter is active", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));
        screen.getByText("1 of 3 devices match filters");
      });

      it("renders 0 of total when no devices match filters", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));
        await user.click(screen.getByLabelText("Channel"));
        await user.click(screen.getByRole("option", { name: "0.0.2b20" }));
        screen.getByText("0 of 3 devices match filters");
      });
    });

    describe("empty state", () => {
      it("renders empty state with clear all filters option when no devices match", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));
        await user.click(screen.getByLabelText("Channel"));
        await user.click(screen.getByRole("option", { name: "0.0.2b20" }));
        const emptyState = screen
          .getByRole("heading", { name: "No devices match filters", level: 2 })
          .closest(".pf-v6-c-empty-state");
        within(emptyState as HTMLElement).getByRole("button", { name: "Clear all filters" });
      });
    });

    describe("clearing filters", () => {
      it("does not render 'Clear all filters' when no filter is active", () => {
        installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
      });

      it("renders 'Clear all filters' in the toolbar as soon as a filter is active", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));
        screen.getByRole("button", { name: "Clear all filters" });
      });

      it("restores all devices after clearing filters from the toolbar", async () => {
        const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Activated" }));
        expect(screen.queryByText("0x0002000000000000")).toBeNull();

        await user.click(screen.getByRole("button", { name: "Clear all filters" }));

        screen.getByText("0x0001000000000000");
        screen.getByText("0x0002000000000000");
        screen.getByText("0x0003000000000000");
      });
    });
  });

  describe("actions", () => {
    it("calls addDevices with correct config on activate", async () => {
      const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      await user.click(screen.getByRole("button", { name: "Actions for 0x0002000000000000" }));
      await user.click(screen.getByRole("menuitem", { name: "Activate" }));
      expect(mockAddDevices).toHaveBeenCalledWith([
        {
          channel: "0.0.1a10",
          wwpn: "0x5005076305018612",
          lun: "0x0002000000000000",
          active: true,
        },
      ]);
    });

    it("calls addDevices with correct config on deactivate", async () => {
      const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      await user.click(screen.getByRole("button", { name: "Actions for 0x0001000000000000" }));
      await user.click(screen.getByRole("menuitem", { name: "Deactivate" }));
      expect(mockAddDevices).toHaveBeenCalledWith([
        {
          channel: "0.0.1a10",
          wwpn: "0x5005076305018611",
          lun: "0x0001000000000000",
          active: false,
        },
      ]);
    });

    it("filters irrelevant actions for a single device", async () => {
      const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      // 0x0001000000000000 is already active — Activate should not appear
      await user.click(screen.getByRole("button", { name: "Actions for 0x0001000000000000" }));
      expect(screen.queryByRole("menuitem", { name: "Activate" })).toBeNull();
      screen.getByRole("menuitem", { name: "Deactivate" });
    });

    it("shows remove action for failed activation", async () => {
      mockConfig.devices = [
        { channel: "0.0.1a10", wwpn: "0x5005076305018612", lun: "0x0002000000000000" },
      ];
      const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      await user.click(screen.getByRole("button", { name: "Actions for 0x0002000000000000" }));
      screen.getByRole("menuitem", { name: "Do not activate" });
    });

    it("calls removeDevices with correct config on remove", async () => {
      mockConfig.devices = [
        { channel: "0.0.1a10", wwpn: "0x5005076305018612", lun: "0x0002000000000000" },
      ];
      const { user } = installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      await user.click(screen.getByRole("button", { name: "Actions for 0x0002000000000000" }));
      await user.click(screen.getByRole("menuitem", { name: "Do not activate" }));
      expect(mockRemoveDevices).toHaveBeenCalledWith([
        { channel: "0.0.1a10", wwpn: "0x5005076305018612", lun: "0x0002000000000000" },
      ]);
    });

    it("disables deactivate action when LUN is auto scanned", async () => {
      mockCheckLunScan.mockReturnValue(true);
      installerRender(<ZFCPDevicesTable devices={mockZFCPDevices} />);
      expect(screen.queryByRole("button", { name: "Actions for 0x0001000000000000" })).toBeNull();
    });
  });
});
