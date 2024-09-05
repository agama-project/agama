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
import { Product, } from "~/types/software";
import { useProduct } from "~/queries/software";

const mockConfigMutation = jest.fn();
const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
};

const microOs: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  icon: "microos.svg",
  description: "MicroOS description",
};

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tumbleweed, microOs],
      selectedProduct: tumbleweed,
    };
  },
  useProductChanges: () => jest.fn(),
  useConfigMutation: () => ({ mutate: mockConfigMutation })
}));

describe("when the user chooses a product and hits the confirmation button", () => {
  it("triggers the product selection", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    const productOption = screen.getByRole("radio", { name: microOs.name });
    const selectButton = screen.getByRole("button", { name: "Select" });
    await user.click(productOption);
    await user.click(selectButton);
    expect(mockConfigMutation).toHaveBeenCalledWith({ product: microOs.id });
  });
});

describe("when the user chooses a product but hits the cancel button", () => {
  it("does not trigger the product selection and goes back", async () => {
    const { user } = installerRender(<ProductSelectionPage />);
    const productOption = screen.getByRole("radio", { name: microOs.name });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(productOption);
    await user.click(cancelButton);
    expect(mockConfigMutation).not.toHaveBeenCalled();
    expect(mockNavigateFn).toHaveBeenCalledWith("-1");
  });
});
