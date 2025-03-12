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

describe("HostnamePage", () => {
  beforeEach(() => {
    selectedProduct = tw;
  });

  it("allows setting the hostname", () => {
    installerRender(<HostnamePage />);
    screen.getByRole("textbox", { name: "Hostname" });

    throw new Error(
      "Please complete the test once the reals hook for retrieving and mutation current data is implemented and used",
    );

    // expect(hostnameMutationMock).not.toHaveBeenCalledWith({
    //   hostname: hostname
    // });
  });

  it("renders error when hostname missing", async () => {
    const { user } = installerRender(<HostnamePage />);
    screen.getByRole("textbox", { name: "Hostname" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);

    screen.getByText("Warning alert:");
    screen.getByText("Please provide a hostname");

    throw new Error(
      "Please complete the test once the reals hook for mutation current data is implemented and used",
    );

    // expect(hostnameMutationMock).not.toHaveBeenCalled();
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
