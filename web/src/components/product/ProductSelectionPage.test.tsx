/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { installerRender, mockNavigateFn, mockProduct } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { Product } from "~/types/software";
import ProductSelectionPage from "./ProductSelectionPage";

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

const mockPatchConfigFn = jest.fn();

// FIXME: add ad use a mockSystem from test-utils instead
jest.mock("~/components/core/InstallerOptions", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (payload) => mockPatchConfigFn(payload),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: (): ReturnType<typeof useSystem> => ({
    products: [tumbleweed, microOs],
  }),
}));

describe("ProductSelectionPage", () => {
  describe("when user select a product with license", () => {
    beforeEach(() => {
      mockProduct(undefined);
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
      mockProduct(microOs);
    });

    it("does not allow revoking license acceptance", () => {
      installerRender(<ProductSelectionPage />);
      const licenseCheckbox = screen.getByRole("checkbox", { name: /I have read and accept/ });
      expect(licenseCheckbox).toBeChecked();
      expect(licenseCheckbox).toBeDisabled();
    });
  });

  // FIXME: re-enable it when registration is ready in v2
  describe.skip("when product is registered", () => {
    beforeEach(() => {
      // registrationInfoMock = {
      //   registered: true,
      //   key: "INTERNAL-USE-ONLY-1234-5678",
      //   email: "",
      //   url: "",
      // };
    });

    it("navigates to root path", async () => {
      installerRender(<ProductSelectionPage />);
      await screen.findByText("Navigating to /");
    });
  });

  describe("when there is a product already selected", () => {
    beforeEach(() => {
      mockProduct(microOs);
    });

    it("renders the Cancel button", () => {
      installerRender(<ProductSelectionPage />);
      screen.getByRole("button", { name: "Cancel" });
    });
  });

  describe("when there is not a product selected yet", () => {
    beforeEach(() => {
      mockProduct(undefined);
    });

    it("does not render the Cancel button", () => {
      installerRender(<ProductSelectionPage />);
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });
  });

  describe("when the user chooses a product and hits the confirmation button", () => {
    beforeEach(() => {
      mockProduct(undefined);
    });

    it("triggers the product selection", async () => {
      const { user } = installerRender(<ProductSelectionPage />);
      const productOption = screen.getByRole("radio", { name: tumbleweed.name });
      const selectButton = screen.getByRole("button", { name: "Select" });
      await user.click(productOption);
      await user.click(selectButton);
      expect(mockPatchConfigFn).toHaveBeenCalledWith({ product: { id: tumbleweed.id } });
    });
  });

  describe("when the user chooses a product but hits the cancel button", () => {
    beforeEach(() => {
      mockProduct(microOs);
    });

    it("does not trigger the product selection and goes back", async () => {
      const { user } = installerRender(<ProductSelectionPage />);
      const productOption = screen.getByRole("radio", { name: tumbleweed.name });
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(productOption);
      await user.click(cancelButton);
      expect(mockPatchConfigFn).not.toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/");
    });
  });
});
