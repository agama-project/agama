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
import { installerRender } from "./test-utils";
import ProductSelectionPage from "./ProductSelectionPage";
import { createClient } from "./client";

const products = [
  {
    id: "Tumbleweed",
    name: "openSUSE Tumbleweed",
    description: "Tumbleweed description..."
  },
  {
    id: "MicroOS",
    name: "openSUSE MicroOS",
    description: "MicroOS description"
  }
];
jest.mock("./client");
jest.mock("./TargetIpsPopup", () => () => "Target IPs Mock");

const mockUseNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockUseNavigate
}));

jest.mock("./context/software", () => ({
  ...jest.requireActual("./context/software"),
  useSoftware: () => {
    return {
      products: products,
      selectedProduct: products[0]
    };
  }
}));

const softwareMock = {
  getProducts: () => Promise.resolve(products),
  getSelectedProduct: jest.fn(() => Promise.resolve(products[0])),
  selectProduct: jest.fn().mockResolvedValue(),
  onProductChange: jest.fn()
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return { software: softwareMock };
  });
});

describe("when the user chooses a product", () => {
  it("selects the product and redirects to the main page", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    const radio = await screen.findByRole("radio", { name: "openSUSE MicroOS" });
    await user.click(radio);
    const button = await screen.findByRole("button", { name: "Select" });
    await user.click(button);
    expect(softwareMock.selectProduct).toHaveBeenCalledWith("MicroOS");
    expect(mockUseNavigate).toHaveBeenCalledWith("/");
  });
});

describe("when the user chooses does not change the product", () => {
  it("redirects to the main page", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    await screen.findByText("openSUSE Tumbleweed");
    const button = await screen.findByRole("button", { name: "Select" });
    await user.click(button);
    expect(softwareMock.selectProduct).not.toHaveBeenCalled();
    expect(mockUseNavigate).toHaveBeenCalledWith("/");
  });
});
