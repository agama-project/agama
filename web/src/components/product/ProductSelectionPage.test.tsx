/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { installerRender, mockNavigateFn } from "~/test-utils";
import { ProductSelectionPage } from "~/components/product";
import { Product, RegistrationInfo } from "~/types/software";
import { useProduct, useRegistration } from "~/queries/software";

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

const mockConfigMutation = jest.fn();

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
};

const microOs: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  icon: "microos.svg",
  description: "MicroOS description",
  registration: false,
  license: "fake.license",
};

let mockSelectedProduct: Product;
let registrationInfoMock: RegistrationInfo;

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tumbleweed, microOs],
      selectedProduct: mockSelectedProduct,
    };
  },
  useProductChanges: () => jest.fn(),
  useConfigMutation: () => ({ mutate: mockConfigMutation }),
  useRegistration: (): ReturnType<typeof useRegistration> => registrationInfoMock,
}));

describe("ProductSelectionPage", () => {
  beforeEach(() => {
    mockSelectedProduct = microOs;
    registrationInfoMock = { key: "", email: "" };
  });

  describe("when user select a product with license", () => {
    beforeEach(() => {
      mockSelectedProduct = undefined;
    });

    it("force license acceptance for allowing product selection", async () => {
      const { user } = installerRender(<ProductSelectionPage />);
      expect(screen.queryByRole("checkbox", { name: /I have read and accept/ })).toBeNull();
      const selectButton = screen.getByRole("button", { name: "Select" });
      const microOsOption = screen.getByRole("radio", { name: microOs.name });
      await user.click(microOsOption);
      const licenseCheckbox = screen.getByRole("checkbox", { name: /I have read and accept/ });
      expect(licenseCheckbox).not.toBeChecked();
      expect(selectButton).toBeDisabled();
      await user.click(licenseCheckbox);
      expect(licenseCheckbox).toBeChecked();
      expect(selectButton).not.toBeDisabled();
    });
  });

  describe("when there is a product with license previouly selected", () => {
    beforeEach(() => {
      mockSelectedProduct = microOs;
    });

    it("does not allow revoking license acceptance", () => {
      installerRender(<ProductSelectionPage />);
      const licenseCheckbox = screen.getByRole("checkbox", { name: /I have read and accept/ });
      expect(licenseCheckbox).toBeChecked();
      expect(licenseCheckbox).toBeDisabled();
    });
  });

  describe("when there is a registration code set", () => {
    beforeEach(() => {
      registrationInfoMock = { key: "INTERNAL-USE-ONLY-1234-5678", email: "" };
    });

    it("navigates to root path", async () => {
      installerRender(<ProductSelectionPage />);
      await screen.findByText("Navigating to /");
    });
  });

  describe("when there is a product already selected", () => {
    it("renders the Cancel button", () => {
      installerRender(<ProductSelectionPage />);
      screen.getByRole("button", { name: "Cancel" });
    });
  });

  describe("when there is not a product selected yet", () => {
    beforeEach(() => {
      mockSelectedProduct = undefined;
    });

    it("does not render the Cancel button", () => {
      installerRender(<ProductSelectionPage />);
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });
  });

  describe("when the user chooses a product and hits the confirmation button", () => {
    it("triggers the product selection", async () => {
      const { user } = installerRender(<ProductSelectionPage />);
      const productOption = screen.getByRole("radio", { name: tumbleweed.name });
      const selectButton = screen.getByRole("button", { name: "Select" });
      await user.click(productOption);
      await user.click(selectButton);
      expect(mockConfigMutation).toHaveBeenCalledWith({ product: tumbleweed.id });
    });
  });

  describe("when the user chooses a product but hits the cancel button", () => {
    it("does not trigger the product selection and goes back", async () => {
      const { user } = installerRender(<ProductSelectionPage />);
      const productOption = screen.getByRole("radio", { name: tumbleweed.name });
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(productOption);
      await user.click(cancelButton);
      expect(mockConfigMutation).not.toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/");
    });
  });
});
