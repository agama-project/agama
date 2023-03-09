/*
 * Copyright (c) [2022] SUSE LLC
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
import { installerRender, mockComponent, mockLayout } from "~/test-utils";
import Overview from "./Overview";
import { createClient } from "~/client";

let mockProduct;
let mockProducts = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "Leap Micro", name: "openSUSE Micro" }
];
const startInstallationFn = jest.fn();

jest.mock("~/client");

jest.mock("~/context/software", () => ({
  ...jest.requireActual("~/context/software"),
  useSoftware: () => {
    return {
      products: mockProducts,
      selectedProduct: mockProduct
    };
  }
}));

jest.mock("~/components/layout/Layout", () => mockLayout());
jest.mock("~/components/overview/L10nSection", () => mockComponent("Localization Section"));
jest.mock("~/components/overview/StorageSection", () => mockComponent("Storage Section"));
jest.mock("~/components/overview/NetworkSection", () => mockComponent("Network Section"));
jest.mock("~/components/overview/UsersSection", () => mockComponent("Users Section"));
jest.mock("~/components/overview/SoftwareSection", () => mockComponent("Software Section"));
jest.mock("~/components/core/InstallButton", () => mockComponent("Install Button"));

it("renders the Overview and the Install button", async () => {
  installerRender(<Overview />);
  const title = screen.getByText(/openSUSE Tumbleweed/i);
  expect(title).toBeInTheDocument();

  await screen.findByText("Localization Section");
  await screen.findByText("Network Section");
  await screen.findByText("Storage Section");
  await screen.findByText("Users Section");
  await screen.findByText("Software Section");
  await screen.findByText("Install Button");
});

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

describe("if there is only one product", () => {
  beforeEach(() => {
    mockProducts = [mockProduct];
  });

  it("does not show the action for changing the selected product", async () => {
    installerRender(<Overview />);

    await screen.findByText("openSUSE Tumbleweed");
    expect(screen.queryByLabelText("Change selected product")).not.toBeInTheDocument();
  });
});
