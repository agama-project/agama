/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { clearMockedQueries } from "~/test-utils/tanstack-query";
import ZFCPPage from "./ZFCPPage";
import type { Issue } from "~/model/issue";
import type { ZFCP as System } from "~/model/system";

const issue: Issue = {
  description: "zFCP error",
  class: "something",
  scope: "zfcp",
};

const controller1: System.Controller = {
  channel: "0.0.7000",
  wwpns: ["0x500507630303c5f9"],
  lunScan: true,
  active: true,
};

const controller2: System.Controller = {
  channel: "0.0.8000",
  wwpns: ["0x500507630303c5f9"],
  lunScan: true,
  active: false,
};

const device1: System.Device = {
  channel: "0.0.7000",
  wwpn: "0x500507630303c5f9",
  lun: "0x5022000000000000",
  active: true,
  deviceName: "/dev/sda",
};

const mockUseControllers = jest.fn();
const mockUseDevices = jest.fn();
const mockUseIssues = jest.fn();

jest.mock("~/hooks/model/system/zfcp", () => ({
  ...jest.requireActual("~/hooks/model/system/zfcp"),
  useControllers: () => mockUseControllers(),
  useDevices: () => mockUseDevices(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockUseIssues(),
}));

jest.mock("./ZFCPDevicesTable", () => () => <div>devices table</div>);

describe("ZFCPPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockedQueries();
    mockUseControllers.mockReturnValue([]);
    mockUseDevices.mockReturnValue([]);
    mockUseIssues.mockReturnValue([]);
  });

  describe("if there are issues", () => {
    beforeEach(() => {
      mockUseIssues.mockReturnValue([issue]);
    });

    it("renders the issues", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText(/zFCP error/)).toBeInTheDocument();
    });
  });

  describe("if there are not controllers", () => {
    beforeEach(() => {
      mockUseControllers.mockReturnValue([]);
    });

    it("renders a text explaining zFCP is not available", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText(/zFCP is not available/)).toBeInTheDocument();
      expect(screen.queryByText("devices table")).not.toBeInTheDocument();
    });
  });

  describe("if there are not devices", () => {
    beforeEach(() => {
      mockUseControllers.mockReturnValue([controller1]);
      mockUseDevices.mockReturnValue([]);
    });

    it("renders the controllers section", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText("zFCP controllers")).toBeInTheDocument();
    });

    it("renders a text explaining devices are not available", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText(/No devices available/)).toBeInTheDocument();
      expect(screen.queryByText("devices table")).not.toBeInTheDocument();
    });
  });

  describe("if there are devices", () => {
    beforeEach(() => {
      mockUseControllers.mockReturnValue([controller1]);
      mockUseDevices.mockReturnValue([device1]);
    });

    it("renders the controllers section", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText("zFCP controllers")).toBeInTheDocument();
    });

    it("renders the table of devices", () => {
      installerRender(<ZFCPPage />);
      expect(screen.queryByText("devices table")).toBeInTheDocument();
    });

    describe("if there are deactivated controllers", () => {
      beforeEach(() => {
        mockUseControllers.mockReturnValue([controller2]);
      });

      it("renders an option for activating controllers", () => {
        installerRender(<ZFCPPage />);
        expect(screen.queryByText(/There is a deactivated zFCP controller/)).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Activate controllers" })).toBeInTheDocument();
      });
    });

    describe("if there are not deactivated controllers", () => {
      beforeEach(() => {
        mockUseControllers.mockReturnValue([controller1]);
      });

      it("does not render an option for activating controllers", () => {
        installerRender(<ZFCPPage />);
        expect(screen.queryByText(/zFCP controllers are already activated/)).toBeInTheDocument();
        expect(
          screen.queryByRole("link", { name: "Activate controllers" }),
        ).not.toBeInTheDocument();
      });
    });
  });
});
