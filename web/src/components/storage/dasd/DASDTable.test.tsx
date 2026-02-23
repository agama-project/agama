/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import DASDTable from "./DASDTable";

import type { Device } from "~/model/system/dasd";

let mockDASDDevices: Device[] = [];

jest.mock("~/components/storage/dasd/FormatActionHandler", () => () => (
  <div>FormatActionHandler Mock</div>
));

describe("DASDTable", () => {
  beforeEach(() => {
    mockDASDDevices = [
      {
        channel: "0.0.0160",
        active: false,
        deviceName: "",
        type: "",
        formatted: false,
        diag: false,
        status: "offline",
        accessType: "",
        partitionInfo: "",
      },
      {
        channel: "0.0.0200",
        active: true,
        deviceName: "dasda",
        type: "eckd",
        formatted: true,
        diag: false,
        status: "active",
        accessType: "rw",
        partitionInfo: "1",
      },
      {
        channel: "0.0.0300",
        active: false,
        deviceName: "dasdb",
        type: "eckd",
        formatted: false,
        diag: false,
        status: "offline",
        accessType: "ro",
        partitionInfo: "",
      },
    ];
  });

  describe("when there is some DASD devices available", () => {
    it("renders those devices", () => {
      installerRender(<DASDTable devices={mockDASDDevices} />);

      // Both channel IDs appear as rows
      screen.getByText("0.0.0160");
      screen.getByText("0.0.0200");
      screen.getByText("0.0.0300");

      // Status values are rendered
      expect(screen.queryAllByText("offline").length).toBe(2);
      screen.getByText("active");

      // Device name is shown for the active device
      screen.getByText("dasda");
      screen.getByText("dasdb");
    });

    it("does not offer bulk actions until a device is selected", async () => {
      const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
      screen.getByText("Select devices to perform bulk actions");
      expect(screen.queryByRole("button", { name: "Activate" })).toBeNull();
      const selection = screen.getByRole("checkbox", { name: "Select row 0" });
      await user.click(selection);
      expect(screen.queryByText("Select devices to perform bulk actions")).toBeNull();
      screen.getByRole("button", { name: "Activate" });
    });

    it("mounts FormatActionHandler on format action request", async () => {
      const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
      const selection = screen.getByRole("checkbox", { name: "Select row 1" });
      await user.click(selection);
      const button = screen.getByRole("button", { name: "Format" });
      await user.click(button);
      screen.getByText("FormatActionHandler Mock");
    });
  });

  describe("filtering", () => {
    beforeEach(() => {});

    describe("status filter", () => {
      it("renders only devices matching the selected status", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Active" }));

        screen.getByText("0.0.0200");
        expect(screen.queryByText("0.0.0160")).toBeNull();
        expect(screen.queryByText("0.0.0300")).toBeNull();
      });
    });

    describe("formatted filter", () => {
      it("renders only formatted devices when 'yes' is selected", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Formatted"));
        await user.click(screen.getByRole("option", { name: "Yes" }));

        screen.getByText("0.0.0200");
        expect(screen.queryByText("0.0.0160")).toBeNull();
        expect(screen.queryByText("0.0.0300")).toBeNull();
      });

      it("renders only unformatted devices when 'no' is selected", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Formatted"));
        await user.click(screen.getByRole("option", { name: "No" }));

        screen.getByText("0.0.0160");
        screen.getByText("0.0.0300");
        expect(screen.queryByText("0.0.0200")).toBeNull();
      });
    });

    describe("channel range filter", () => {
      it("renders only devices within the given channel range", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.type(screen.getByLabelText("Min channel"), "0.0.0200");
        await user.type(screen.getByLabelText("Max channel"), "0.0.0200");

        screen.getByText("0.0.0200");
        expect(screen.queryByText("0.0.0160")).toBeNull();
        expect(screen.queryByText("0.0.0300")).toBeNull();
      });
    });

    describe("device count", () => {
      it("renders the total device count when no filter is active", () => {
        installerRender(<DASDTable devices={mockDASDDevices} />);
        screen.getByText("3 devices available");
      });

      it("renders matching vs total count when a filter is active", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Active" }));
        screen.getByText("1 of 3 devices match filters");
      });

      it("renders 0 of total when no devices match filters", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Formatted"));
        await user.click(screen.getByRole("option", { name: "Yes" }));
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Offline" }));
        screen.getByText("0 of 3 devices match filters");
      });
    });

    describe("empty state", () => {
      it("renders empty state with clear all filters option when no devices match", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Formatted"));
        await user.click(screen.getByRole("option", { name: "Yes" }));
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Offline" }));
        const emptyState = screen
          .getByRole("heading", { name: "No devices match filters", level: 2 })
          .closest(".pf-v6-c-empty-state");
        within(emptyState as HTMLElement).getByRole("button", { name: "Clear all filters" });
      });
    });

    describe("clearing filters", () => {
      it("does not render 'Clear all filters' when no filter is active", () => {
        installerRender(<DASDTable devices={mockDASDDevices} />);
        expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
      });

      it("renders 'Clear all filters' in the toolbar as soon as a filter is active", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Active" }));

        // Results are non-empty (0.0.0200 matches) but the toolbar link appears anyway
        screen.getByText("0.0.0200");
        screen.getByRole("button", { name: "Clear all filters" });
      });

      it("restores all devices after clearing filters from the toolbar", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Active" }));
        expect(screen.queryByText("0.0.0160")).toBeNull();

        await user.click(screen.getByRole("button", { name: "Clear all filters" }));

        screen.getByText("0.0.0160");
        screen.getByText("0.0.0200");
        screen.getByText("0.0.0300");
      });

      it("hides 'Clear all filters' when filters are manually restored to defaults", async () => {
        const { user } = installerRender(<DASDTable devices={mockDASDDevices} />);
        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "Active" }));
        screen.getByRole("button", { name: "Clear all filters" });

        await user.click(screen.getByLabelText("Status"));
        await user.click(screen.getByRole("option", { name: "All" }));
        expect(screen.queryByRole("button", { name: "Clear all filters" })).toBeNull();
      });
    });
  });
});
