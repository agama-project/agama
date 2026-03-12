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
import { screen } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import ZFCPControllersPage from "./ZFCPControllersPage";
import { STORAGE } from "~/routes/paths";
import { useSystem, useControllers, useCheckLunScan } from "~/hooks/model/system/zfcp";
import { useConfig, useSetControllers } from "~/hooks/model/config/zfcp";
import type { ZFCP as System } from "~/model/system";

const controller1: System.Controller = {
  channel: "0.0.1a10",
  active: true,
  wwpns: [],
  lunScan: false,
};

const controller2: System.Controller = {
  channel: "0.0.1a11",
  active: false,
  wwpns: [],
  lunScan: false,
};

const controller3: System.Controller = {
  channel: "0.0.1a12",
  active: false,
  wwpns: [],
  lunScan: false,
};

const mockUseSystem: jest.Mock<ReturnType<typeof useSystem>> = jest.fn();
const mockUseControllers: jest.Mock<ReturnType<typeof useControllers>> = jest.fn();
const mockUseCheckLunScan: jest.Mock<ReturnType<typeof useCheckLunScan>> = jest.fn();
const mockUseConfig: jest.Mock<ReturnType<typeof useConfig>> = jest.fn();
const mockUseSetControllers = jest.fn() as jest.MockedFunction<typeof useSetControllers>;

jest.mock("~/hooks/model/system/zfcp", () => ({
  useSystem: () => mockUseSystem(),
  useControllers: () => mockUseControllers(),
  useCheckLunScan: () => mockUseCheckLunScan(),
}));

jest.mock("~/hooks/model/config/zfcp", () => ({
  useConfig: () => mockUseConfig(),
  useSetControllers: () => mockUseSetControllers,
}));

describe("ZFCPControllersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSystem.mockReturnValue({ lunScan: true, controllers: [], devices: [] });
    mockUseControllers.mockReturnValue([]);
    mockUseConfig.mockReturnValue({ controllers: ["0.0.1a10"] });
    mockUseCheckLunScan.mockReturnValue(() => false);
  });

  it("shows an empty state if no controllers are available for activation", () => {
    mockUseControllers.mockReturnValue([controller1]);
    installerRender(<ZFCPControllersPage />);
    expect(screen.getByText("No controllers available")).toBeInTheDocument();
  });

  describe("when there are controllers to activate", () => {
    beforeEach(() => {
      mockUseControllers.mockReturnValue([controller1, controller2, controller3]);
    });

    it("renders the list of deactivated controllers", () => {
      installerRender(<ZFCPControllersPage />);
      expect(screen.getByLabelText("0.0.1a11")).toBeInTheDocument();
      expect(screen.getByLabelText("0.0.1a12")).toBeInTheDocument();
      expect(screen.queryByLabelText("0.0.1a10")).not.toBeInTheDocument();
    });

    it("shows LUN scan enabled info", () => {
      mockUseSystem.mockReturnValue({ lunScan: true, controllers: [], devices: [] });
      installerRender(<ZFCPControllersPage />);
      expect(screen.getByText("Automatic LUN scan is enabled")).toBeInTheDocument();
    });

    it("shows LUN scan disabled info", () => {
      mockUseSystem.mockReturnValue({ lunScan: false, controllers: [], devices: [] });
      installerRender(<ZFCPControllersPage />);
      expect(screen.getByText("Automatic LUN scan is disabled")).toBeInTheDocument();
    });

    it("allows selecting and deselecting controllers", async () => {
      const { user } = installerRender(<ZFCPControllersPage />);
      const controllerCheckbox = screen.getByLabelText("0.0.1a11");

      expect(controllerCheckbox).not.toBeChecked();
      await user.click(controllerCheckbox);
      expect(controllerCheckbox).toBeChecked();
      await user.click(controllerCheckbox);
      expect(controllerCheckbox).not.toBeChecked();
    });

    it("calls setControllers and navigates on submit", async () => {
      const { user } = installerRender(<ZFCPControllersPage />);
      const controllerCheckbox = screen.getByLabelText("0.0.1a11");
      await user.click(controllerCheckbox);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockUseSetControllers).toHaveBeenCalledWith(["0.0.1a10", "0.0.1a11"]);
      expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.zfcp.root });
    });

    it("submits if there are pre-selected controllers", async () => {
      mockUseConfig.mockReturnValue({ controllers: ["0.0.1a11"] });

      const { user } = installerRender(<ZFCPControllersPage />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockUseSetControllers).toHaveBeenCalledWith(["0.0.1a11"]);
      expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.zfcp.root });
    });

    it("submits if pre-selected controllers are unselected", async () => {
      mockUseConfig.mockReturnValue({ controllers: ["0.0.1a11"] });

      const { user } = installerRender(<ZFCPControllersPage />);
      const controllerCheckbox = screen.getByLabelText("0.0.1a11");
      await user.click(controllerCheckbox);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockUseSetControllers).toHaveBeenCalledWith([]);
      expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.zfcp.root });
    });

    it("shows an error if accepting without nothing to activate", async () => {
      mockUseConfig.mockReturnValue({ controllers: ["0.0.1a10"] });

      const { user } = installerRender(<ZFCPControllersPage />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockUseSetControllers).not.toHaveBeenCalled();
      expect(screen.getByText("Select the controllers to activate")).toBeInTheDocument();
    });
  });
});
