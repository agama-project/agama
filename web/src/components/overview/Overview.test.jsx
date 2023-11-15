/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import Overview from "./Overview";
import { createClient } from "~/client";

let mockProduct;
const mockProducts = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "Leap Micro", name: "openSUSE Micro" }
];
const startInstallationFn = jest.fn();

jest.mock("~/client");

jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => {
    return {
      products: mockProducts,
      selectedProduct: mockProduct
    };
  }
}));

jest.mock("~/components/overview/ProductSection", () => () => <div>Product Section</div>);
jest.mock("~/components/overview/L10nSection", () => () => <div>Localization Section</div>);
jest.mock("~/components/overview/StorageSection", () => () => <div>Storage Section</div>);
jest.mock("~/components/overview/NetworkSection", () => () => <div>Network Section</div>);
jest.mock("~/components/overview/UsersSection", () => () => <div>Users Section</div>);
jest.mock("~/components/overview/SoftwareSection", () => () => <div>Software Section</div>);
jest.mock("~/components/core/InstallButton", () => () => <div>Install Button</div>);

beforeEach(() => {
  mockProduct = { id: "openSUSE", name: "openSUSE Tumbleweed" };
  createClient.mockImplementation(() => {
    return {
      software: {
        onProductChange: jest.fn()
      },
      manager: {
        startInstallation: startInstallationFn,
      }
    };
  });
});

describe("when product is selected", () => {
  it("renders the Overview and the Install button", async () => {
    installerRender(<Overview />);
    const title = screen.getByText(/installation summary/i);
    expect(title).toBeInTheDocument();

    await screen.findByText("Product Section");
    await screen.findByText("Localization Section");
    await screen.findByText("Network Section");
    await screen.findByText("Storage Section");
    await screen.findByText("Users Section");
    await screen.findByText("Software Section");
    await screen.findByText("Install Button");
  });
});

describe("when no product is selected", () => {
  beforeEach(() => {
    mockProduct = null;
  });

  it("redirects to the product selection page", async () => {
    installerRender(<Overview />);

    // react-router-dom Navigate is mocked. See test-utils for more details.
    await screen.findByText("Navigating to /products");
  });
});
