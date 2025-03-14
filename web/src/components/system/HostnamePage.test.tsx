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
import { useProduct, useRegistration } from "~/queries/software";
import { Product, RegistrationInfo } from "~/types/software";
import HostnamePage from "./HostnamePage";

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

let selectedProduct: Product;
let registrationInfoMock: RegistrationInfo;

const mockHostnameMutation = jest.fn().mockResolvedValue(true);

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useRegistration: (): ReturnType<typeof useRegistration> => registrationInfoMock,
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tw, sle],
      selectedProduct,
    };
  },
}));

jest.mock("~/queries/system", () => ({
  ...jest.requireActual("~/queries/system"),
  useHostname: () => ({ transient: "testing-node", static: "" }),
  useHostnameMutation: () => ({ mutateAsync: mockHostnameMutation }),
}));

describe("HostnamePage", () => {
  beforeEach(() => {
    selectedProduct = tw;
  });

  it("allows setting the hostname", async () => {
    const { user } = installerRender(<HostnamePage />);
    const hostnameInput = screen.getByRole("textbox", { name: "Hostname" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    expect(hostnameInput).toHaveValue("testing-node");

    await user.clear(hostnameInput);
    await user.type(hostnameInput, "testing-server");
    await user.click(acceptButton);

    expect(mockHostnameMutation).toHaveBeenCalledWith({
      static: "testing-server",
    });

    screen.getByText("Success alert:");
    screen.getByText("Hostname successfully updated.");
  });

  it("renders an error if update request fails", async () => {
    mockHostnameMutation.mockRejectedValue("Not valid");
    const { user } = installerRender(<HostnamePage />);
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(acceptButton);

    expect(mockHostnameMutation).toHaveBeenCalledWith({
      static: "testing-node",
    });

    screen.getByText("Warning alert:");
    screen.getByText(/Something went wrong/);
  });

  it("renders an error when hostname missing", async () => {
    const { user } = installerRender(<HostnamePage />);
    const hostnameInput = screen.getByRole("textbox", { name: "Hostname" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.clear(hostnameInput);
    await user.click(acceptButton);

    expect(mockHostnameMutation).not.toHaveBeenCalled();

    screen.getByText("Warning alert:");
    screen.getByText("Please provide a hostname");
  });

  describe("when selected product is not registrable", () => {
    it("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when selected product is registrable and registration code is not set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "", email: "" };
    });

    it("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when selected product is registrable and registration code is set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "INTERNAL-USE-ONLY-1234-5678", email: "example@company.test" };
    });

    it("renders an alert to let user know that changes will not have effect in registration", () => {
      installerRender(<HostnamePage />);
      screen.getByText("Custom alert:");
      screen.getByText("Product is already registered");
      screen.getByText(/will not take effect on registered value/);
    });
  });
});
