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
import { installerRender } from "~/test-utils";
import { Product } from "~/types/software";
import HostnamePage from "./HostnamePage";

let mockStaticHostname: string;
const mockPatchConfig = jest.fn();

const tw: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: false,
};

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: true,
};

let selectedProduct = tw;

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useProduct: () => selectedProduct,
  useConfig: () => ({
    product: selectedProduct.id,
  }),
}));

jest.mock("~/hooks/model/proposal", () => ({
  ...jest.requireActual("~/hooks/model/proposal"),
  useProposal: () => ({
    network: {
      connections: [],
      state: {
        connectivity: true,
        copyNetwork: true,
        networkingEnabled: false,
        wirelessEnabled: false,
      },
    },
    hostname: {
      hostname: "agama-node",
      static: mockStaticHostname,
    },
  }),
}));

describe("HostnamePage", () => {
  beforeEach(() => {
    selectedProduct = tw;
  });

  describe("when static hostname is set", () => {
    beforeEach(() => {
      mockStaticHostname = "agama-server";
      mockPatchConfig.mockResolvedValue(true);
    });

    it("does not render a custom alert with current value and mode", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText(/agama-server/)).toBeNull();
    });

    it("allows unsetting the static hostname", async () => {
      const { user } = installerRender(<HostnamePage />);

      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const hostnameInput = screen.getByRole("textbox", { name: "Static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      expect(setHostnameCheckbox).toBeChecked();
      expect(hostnameInput).toHaveValue("agama-server");

      await user.click(setHostnameCheckbox);
      expect(setHostnameCheckbox).not.toBeChecked();

      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
      });
      screen.getByText("Success alert:");
      screen.getByText("Hostname successfully updated");
    });
  });

  describe("when static hostname is not set", () => {
    beforeEach(() => {
      mockStaticHostname = "";
      mockPatchConfig.mockResolvedValue(true);
    });

    it("renders a custom alert with current value and mode", () => {
      installerRender(<HostnamePage />);
      screen.getByText("Custom alert:");
      screen.getByText(/agama-node/);
      screen.getByText(/is dynamic/);
    });

    it("allows setting the static hostname", async () => {
      const { user } = installerRender(<HostnamePage />);
      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(setHostnameCheckbox).not.toBeChecked();

      await user.click(setHostnameCheckbox);

      expect(setHostnameCheckbox).toBeChecked();
      const hostnameInput = screen.getByRole("textbox", { name: "Static hostname" });
      expect(hostnameInput).toHaveValue("");

      await user.type(hostnameInput, "testing-server");
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "testing-server" },
      });
      screen.getByText("Success alert:");
      screen.getByText("Hostname successfully updated");
    });

    it("renders an error when static hostname is selected but left empty", async () => {
      const { user } = installerRender(<HostnamePage />);
      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(setHostnameCheckbox);
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Warning alert:");
      screen.getByText("Enter a hostname.");
    });

    it("renders an error if the update request fails", async () => {
      mockPatchConfig.mockRejectedValue("Fail");

      const { user } = installerRender(<HostnamePage />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
      });

      screen.getByText("Warning alert:");
      screen.getByText(/Hostname could not be updated/);
    });
  });

  describe("when selected product is not registrable", () => {
    it("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Info alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when the selected product is registrable and registration code is not set", () => {
    beforeEach(() => {
      selectedProduct = sle;
    });

    xit("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Info alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when the selected product is registrable and registration code is set", () => {
    beforeEach(() => {
      selectedProduct = sle;
    });

    it("renders an alert to let user know that changes will not have effect in the registration", () => {
      installerRender(<HostnamePage />);
      screen.getByText("Info alert:");
      screen.getByText("Product is already registered");
      screen.getByText(/will not change the currently registered hostname/);
    });
  });
});
