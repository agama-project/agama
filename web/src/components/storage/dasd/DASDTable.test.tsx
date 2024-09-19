/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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

let consoleErrorSpy;
jest.mock("~/queries/storage/dasd", () => ({
  useDASDDevices: () => mockDASDDevices,
  useDASDMutation: () => jest.fn(),
  useFormatDASDMutation: () => jest.fn(),
}));

describe("DASDTable", () => {
  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error");
    consoleErrorSpy.mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });
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
      installerRender(<DASDTable aria-label="DASDs table" />);
      screen.getByText("active");
    });

    it("does not allow to perform any action if not selected any device", () => {
      installerRender(<DASDTable aria-label="DASDs table" />);
      const button = screen.getByRole("button", { name: "Perform an action" });
      expect(button).toHaveAttribute("disabled");
    });

    describe("when there are some DASD selected", () => {
      it("allows to perform a set of actions over them", async () => {
        const { user } = installerRender(<DASDTable aria-label="DASDs table" />);
        const selection = screen.getByRole("checkbox", { name: "Select row 0" });
        await user.click(selection);
        const button = screen.getByRole("button", { name: "Perform an action" });
        expect(button).not.toHaveAttribute("disabled");
        await user.click(button);
        screen.getByRole("menuitem", { name: "Format" });
      });

      describe("and the user click on format", () => {
        it("shows a confirmation dialog if all the devices are online", async () => {
          const { user } = installerRender(<DASDTable aria-label="DASDs table" />);
          const selection = screen.getByRole("checkbox", { name: "Select row 1" });
          await user.click(selection);
          const button = screen.getByRole("button", { name: "Perform an action" });
          expect(button).not.toHaveAttribute("disabled");
          await user.click(button);
          const format = screen.getByRole("menuitem", { name: "Format" });
          await user.click(format);
          screen.getByRole("dialog", { name: "DASD format confirmation dialog" });
        });

        it("shows a warning dialog if some device is offline", async () => {
          const { user } = installerRender(<DASDTable aria-label="DASDs table" />);
          let selection = screen.getByRole("checkbox", { name: "Select row 0" });
          await user.click(selection);
          selection = screen.getByRole("checkbox", { name: "Select row 1" });
          await user.click(selection);
          const button = screen.getByRole("button", { name: "Perform an action" });
          expect(button).not.toHaveAttribute("disabled");
          await user.click(button);
          const format = screen.getByRole("menuitem", { name: "Format" });
          await user.click(format);
          screen.getByRole("dialog", { name: "DASD format offline warning dialog" });
        });
      });
    });
  });
});