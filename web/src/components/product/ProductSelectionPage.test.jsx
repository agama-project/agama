/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { installerRender, mockNavigateFn } from "~/test-utils";
import { ProductSelectionPage } from "~/components/product";
import { createClient } from "~/client";

const products = [
  {
    id: "Tumbleweed",
    name: "openSUSE Tumbleweed",
    description: "Tumbleweed description...",
  },
  {
    id: "MicroOS",
    name: "openSUSE MicroOS",
    description: "MicroOS description",
  },
];

jest.mock("~/client");
jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: () => {
    return {
      products,
      selectedProduct: products[0],
    };
  },
  useProductChanges: () => jest.fn(),
}));

const managerMock = {
  startProbing: jest.fn(),
};

const productMock = {
  getAll: () => Promise.resolve(products),
  getSelected: jest.fn(() => Promise.resolve(products[0])),
  select: jest.fn().mockResolvedValue(),
  onChange: jest.fn(),
};

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      manager: managerMock,
      product: productMock,
    };
  });
});

describe.skip("when the user chooses a product", () => {
  it("selects the product and redirects to the main page", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    const productOption = screen.getByRole("row", { name: /openSUSE MicroOS/ });
    const selectButton = screen.getByRole("button", { name: "Select" });
    await user.click(productOption);
    await user.click(selectButton);
    expect(productMock.select).toHaveBeenCalledWith("MicroOS");
    expect(managerMock.startProbing).toHaveBeenCalled();
    expect(mockNavigateFn).toHaveBeenCalledWith("/");
  });
});

describe.skip("when the user chooses does not change the product", () => {
  it("redirects to the main page", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    screen.getByText("openSUSE Tumbleweed");
    const selectButton = await screen.findByRole("button", { name: "Select" });
    await user.click(selectButton);
    expect(productMock.select).not.toHaveBeenCalled();
    expect(managerMock.startProbing).not.toHaveBeenCalled();
    expect(mockNavigateFn).toHaveBeenCalledWith("/");
  });
});
