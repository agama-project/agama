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
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import ProductSelector from "./ProductSelector";
import { createClient } from "./client";

jest.mock("./client");

const products = [
  { id: "openSUSE", name: "openSUSE Tumbleweed" },
  { id: "micro", name: "openSUSE MicroOS" }
];

const softwareMock = {
  getProducts: () => Promise.resolve(products),
  getSelectedProduct: () => Promise.resolve("micro")
};

const selectProductFn = jest.fn().mockResolvedValue();

beforeEach(() => {
  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      software: {
        ...softwareMock,
        selectProduct: selectProductFn
      }
    };
  });
});

it("displays the proposal", async () => {
  installerRender(<ProductSelector />);
  await screen.findByText("openSUSE MicroOS");
});

describe("when the user changes the product", () => {
  it("changes the selected product", async () => {
    installerRender(<ProductSelector />);
    const button = await screen.findByRole("button", {
      name: "openSUSE MicroOS"
    });
    userEvent.click(button);

    const dialog = await screen.findByRole("dialog");

    const productSelector = await within(dialog).findByLabelText(/Product/i);
    userEvent.selectOptions(productSelector, ["openSUSE Tumbleweed"]);
    userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "openSUSE Tumbleweed" });
    expect(selectProductFn).toHaveBeenCalledWith("openSUSE");
    expect(selectProductFn).toHaveBeenCalledTimes(1);
  });
});
