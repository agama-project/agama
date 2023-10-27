/*
 * Copyright (c) [2023] SUSE LLC
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
import { ProductSelectionForm } from "~/components/product";
import { createClient } from "~/client";

let mockProducts;
let mockSelectedProduct;

jest.mock("~/client");

jest.mock("~/context/product", () => ({
  ...jest.requireActual("~/context/product"),
  useProduct: () => {
    return {
      products: mockProducts,
      selectedProduct: mockSelectedProduct
    };
  }
}));

const products = [
  {
    id: "ALP-Dolomite",
    name: "ALP Dolomite",
    description: "ALP Dolomite description"
  },
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

beforeEach(() => {
  mockProducts = products;
  mockSelectedProduct = products[0];

  createClient.mockImplementation(() => ({}));
});

it("shows an option for each product", async () => {
  installerRender(<ProductSelectionForm />);
  await screen.findByRole("radio", { name: "ALP Dolomite" });
  await screen.findByRole("radio", { name: "openSUSE Tumbleweed" });
  await screen.findByRole("radio", { name: "openSUSE MicroOS" });
});

it("selects the current product by default", async () => {
  installerRender(<ProductSelectionForm />);
  await screen.findByRole("radio", { name: "ALP Dolomite", checked: true });
});

it("selects the clicked product", async () => {
  const { user } = installerRender(<ProductSelectionForm />);
  const radio = await screen.findByRole("radio", { name: "openSUSE Tumbleweed" });
  await user.click(radio);
  await screen.findByRole("radio", { name: "openSUSE Tumbleweed", clicked: true });
});

it("shows a message if there is no product for selection", async () => {
  mockProducts = [];
  installerRender(<ProductSelectionForm />);
  await screen.findByText(/no products found/i);
});
