/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { ProductSelector } from "~/components/product";
import { createClient } from "~/client";

jest.mock("~/client");

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
  createClient.mockImplementation(() => ({}));
});

it("shows an option for each product", async () => {
  installerRender(<ProductSelector products={products} />);

  await screen.findByRole("grid", { name: "Available products" });
  screen.getByRole("row", { name: /ALP Dolomite/ });
  screen.getByRole("row", { name: /openSUSE Tumbleweed/ });
  screen.getByRole("row", { name: /openSUSE MicroOS/ });
});

it("selects the given value", async () => {
  installerRender(<ProductSelector value="Tumbleweed" products={products} />);
  await screen.findByRole("row", { name: /openSUSE Tumbleweed/, selected: true });
});

it("calls onChange if a new option is clicked", async () => {
  const onChangeFn = jest.fn();
  const { user } = installerRender(<ProductSelector products={products} onChange={onChangeFn} />);
  const productOption = await screen.findByRole("row", { name: /openSUSE Tumbleweed/ });
  await user.click(productOption);
  expect(onChangeFn).toHaveBeenCalledWith("Tumbleweed");
});

it("shows a message if there is no product for selection", async () => {
  installerRender(<ProductSelector />);
  await screen.findByText(/no products available/i);
});
