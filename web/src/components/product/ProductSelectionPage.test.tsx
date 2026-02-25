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

import React, { act } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { installerRender, mockNavigateFn, mockProduct, mockProductConfig } from "~/test-utils";
import { useSystem } from "~/hooks/model/system";
import { useSystem as useSystemSoftware } from "~/hooks/model/system/software";
import { ROOT } from "~/routes/paths";
import ProductSelectionPage from "./ProductSelectionPage";
import { Product } from "~/model/system";

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  icon: "tumbleweed.svg",
  description: "Tumbleweed description...",
  registration: false,
  modes: [],
};

const microOs: Product = {
  id: "MicroOS",
  name: "openSUSE MicroOS",
  icon: "microos.svg",
  description: "MicroOS description",
  registration: false,
  license: "fake.license",
  modes: [],
};

const productWithModes: Product = {
  id: "SLES",
  name: "SUSE Linux Enterprise Server",
  icon: "sles.svg",
  description: "Enterprise Linux",
  registration: false,
  modes: [
    { id: "standard", name: "Standard", description: "Standard system" },
    { id: "immutable", name: "Immutable", description: "Immutable system with atomic updates" },
  ],
};

const mockPutConfigFn = jest.fn();
const mockUseSystemFn: jest.Mock<ReturnType<typeof useSystem>> = jest.fn();
const mockUseSystemSoftwareFn: jest.Mock<ReturnType<typeof useSystemSoftware>> = jest.fn();

// FIXME: add ad use a mockSystem from test-utils instead
jest.mock("~/components/core/InstallerL10nOptions", () => () => (
  <div>InstallerL10nOptions Mock</div>
));

jest.mock("~/components/product/LicenseDialog", () => () => <div>LicenseDialog Mock</div>);

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  putConfig: (payload) => mockPutConfigFn(payload),
}));

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: () => mockUseSystemFn(),
}));

jest.mock("~/hooks/model/system/software", () => ({
  ...jest.requireActual("~/hooks/model/system/software"),
  useSystem: () => mockUseSystemSoftwareFn(),
}));

describe("ProductSelectionPage", () => {
  beforeEach(() => {
    mockUseSystemFn.mockReturnValue({
      products: [tumbleweed, microOs],
    });

    mockUseSystemSoftwareFn.mockReturnValue({
      addons: [],
      patterns: [],
      repositories: [],
    });
  });

  it("renders available products excluding the selected one unless it has modes", () => {
    mockUseSystemFn.mockReturnValue({
      products: [tumbleweed, microOs, productWithModes],
    });

    // No product selected yet
    mockProduct(undefined);
    const { rerender } = installerRender(<ProductSelectionPage />, { withL10n: true });
    screen.getByRole("radio", { name: tumbleweed.name });
    screen.getByRole("radio", { name: microOs.name });
    screen.getByRole("radio", { name: productWithModes.name });

    // Selected product without modes, excluded from the list
    mockProduct(tumbleweed);
    rerender(<ProductSelectionPage />);
    expect(screen.queryByRole("radio", { name: tumbleweed.name })).toBeNull();
    screen.getByRole("radio", { name: microOs.name });
    screen.getByRole("radio", { name: productWithModes.name });

    // Selected product with modes, included in the list
    mockProduct(productWithModes);
    rerender(<ProductSelectionPage />);
    screen.queryByRole("radio", { name: tumbleweed.name });
    screen.getByRole("radio", { name: microOs.name });
    screen.getByRole("radio", { name: productWithModes.name });
  });

  // Regression test:
  // On component re-renders (e.g. after clicking a header option), the selected
  // product radio became unchecked because selection logic compared object
  // references instead of stable identifiers. Even though the products had
  // identical data, new object instances caused the comparison to fail. This
  // test ensures the selected option remains checked across re-renders with new
  // object references.
  it("keeps product selection across re-renders", async () => {
    const { user, rerender } = installerRender(<ProductSelectionPage />, { withL10n: true });
    const microOsOption = screen.getByRole("radio", { name: microOs.name });
    expect(microOsOption).not.toBeChecked();
    await user.click(microOsOption);
    expect(microOsOption).toBeChecked();
    act(() => {
      mockUseSystemFn.mockReturnValue({
        // Same products, new objects
        products: [{ ...tumbleweed }, { ...microOs }],
      });
    });
    rerender(<ProductSelectionPage />);
    expect(microOsOption).toBeChecked();
    // Product must still checked.
    expect(microOsOption).toBeChecked();
  });

  it("force license acceptance for products with license", async () => {
    mockProduct(undefined);
    const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });
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

  it("resets license acceptance when switching between products with licenses", async () => {
    const productWithLicense1 = { ...microOs, id: "Product1", name: "Product 1" };
    const productWithLicense2 = { ...microOs, id: "Product2", name: "Product 2" };

    mockProduct(undefined);
    mockUseSystemFn.mockReturnValue({
      products: [productWithLicense1, productWithLicense2],
    });

    const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

    // Select first product and accept license
    const product1Option = screen.getByRole("radio", { name: "Product 1" });
    await user.click(product1Option);
    const licenseCheckbox = screen.getByRole("checkbox", { name: /I have read and accept/ });
    await user.click(licenseCheckbox);
    expect(licenseCheckbox).toBeChecked();

    // Switch to second product
    const product2Option = screen.getByRole("radio", { name: "Product 2" });
    await user.click(product2Option);

    // License checkbox should be unchecked
    expect(licenseCheckbox).not.toBeChecked();
  });

  it("navigates to root path when product is registered (registration exists)", async () => {
    mockUseSystemSoftwareFn.mockReturnValue({
      addons: [],
      patterns: [],
      repositories: [],
      registration: { code: "INTERNAL-USE-ONLY-1234-5678", addons: [] },
    });
    installerRender(<ProductSelectionPage />, { withL10n: true });
    await screen.findByText("Navigating to /");
  });

  it("renders the Cancel button when a product is already seelected ", () => {
    mockProduct(microOs);
    installerRender(<ProductSelectionPage />, { withL10n: true });
    screen.getByRole("link", { name: "Cancel" });
  });

  it("does not render the Cancel button if product no selected yet", () => {
    mockProduct(undefined);
    installerRender(<ProductSelectionPage />, { withL10n: true });
    expect(screen.queryByRole("link", { name: "Cancel" })).toBeNull();
  });

  it("triggers the product selection when user select a product and click submission button", async () => {
    mockProduct(undefined);
    const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });
    const productOption = screen.getByRole("radio", { name: tumbleweed.name });
    const selectButton = screen.getByRole("button", { name: "Select" });
    await user.click(productOption);
    await user.click(selectButton);
    expect(mockPutConfigFn).toHaveBeenCalledWith({ product: { id: tumbleweed.id } });
  });

  it("does not trigger the product selection if user selects a product but clicks o cancel button", async () => {
    mockProduct(microOs);
    const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });
    const productOption = screen.getByRole("radio", { name: tumbleweed.name });
    const cancel = screen.getByRole("link", { name: "Cancel" });
    expect(cancel).toHaveAttribute("href", ROOT.overview);
    await user.click(productOption);
    await user.click(cancel);
    expect(mockPutConfigFn).not.toHaveBeenCalled();
  });

  it.todo("make navigation test work");
  it.skip("navigates to root after successful product selection", async () => {
    mockProduct(undefined);
    const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

    const tumbleweedOption = screen.getByRole("radio", { name: tumbleweed.name });
    await user.click(tumbleweedOption);

    const selectButton = screen.getByRole("button", { name: /Select/ });
    await user.click(selectButton);

    // Mock the product as selected
    act(() => {
      mockProduct(tumbleweed);
    });

    expect(mockNavigateFn).toHaveBeenCalledWith(ROOT.root);
  });

  describe("when there are products with modes involved", () => {
    it("renders mode options when product has modes", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      screen.getByRole("radio", { name: "Standard" });
      screen.getByRole("radio", { name: "Immutable" });
    });

    it("excludes already selected mode", async () => {
      mockProduct(productWithModes);
      mockProductConfig({ id: productWithModes.id, mode: "standard" });
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      expect(screen.queryByRole("radio", { name: "Standard" })).toBeNull();
      screen.getByRole("radio", { name: "Immutable" });
    });

    it("allows selecting a mode", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      const standardMode = screen.getByRole("radio", { name: "Standard" });
      const immutableMode = screen.getByRole("radio", { name: "Immutable" });

      expect(standardMode).not.toBeChecked();
      await user.click(standardMode);
      expect(standardMode).toBeChecked();

      await user.click(immutableMode);
      expect(immutableMode).toBeChecked();
      expect(standardMode).not.toBeChecked();
    });

    it("submits product with selected mode", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      const standardMode = screen.getByRole("radio", { name: "Standard" });
      await user.click(standardMode);

      const selectButton = screen.getByRole("button", { name: /Select/ });
      await user.click(selectButton);

      expect(mockPutConfigFn).toHaveBeenCalledWith({
        product: { id: productWithModes.id, mode: "standard" },
      });
    });

    it("resets mode selection when switching to a product without modes", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes, tumbleweed] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      // Select product with modes and choose a mode
      const slesOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(slesOption);
      const standardMode = screen.getByRole("radio", { name: "Standard" });
      await user.click(standardMode);

      // Switch to product without modes
      const tumbleweedOption = screen.getByRole("radio", { name: tumbleweed.name });
      await user.click(tumbleweedOption);

      // Mode selection should not affect products without modes
      const selectButton = screen.getByRole("button", { name: /Select/ });
      expect(selectButton).not.toBeDisabled();
    });

    it("disables submit button when product with modes has no mode selected", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      const selectButton = screen.getByRole("button", { name: /Select/ });
      expect(selectButton).toBeDisabled();
    });

    it("enables submit button when mode is selected", async () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const productOption = screen.getByRole("radio", { name: productWithModes.name });
      await user.click(productOption);

      const standardMode = screen.getByRole("radio", { name: "Standard" });
      await user.click(standardMode);

      const selectButton = screen.getByRole("button", { name: /Select/ });
      expect(selectButton).not.toBeDisabled();
    });

    describe("ProductFormSubmitLabel", () => {
      it("includes mode name in submit button label", async () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

        const productOption = screen.getByRole("radio", { name: productWithModes.name });
        await user.click(productOption);

        const standardMode = screen.getByRole("radio", { name: "Standard" });
        await user.click(standardMode);

        screen.getByRole("button", { name: "Select Standard SUSE Linux Enterprise Server" });
      });

      it("shows only product name when no mode selected", async () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

        const productOption = screen.getByRole("radio", { name: productWithModes.name });
        await user.click(productOption);

        // Mode not selected yet
        screen.getByRole("button", { name: "Select SUSE Linux Enterprise Server" });
      });
    });

    describe("ProductFormSubmitLabelHelp", () => {
      it("shows warning when product with modes is selected but no mode chosen", async () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

        const productOption = screen.getByRole("radio", { name: productWithModes.name });
        await user.click(productOption);

        screen.getByText("Select a product mode to continue.");
      });

      it("hides warning when mode is selected", async () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

        const productOption = screen.getByRole("radio", { name: productWithModes.name });
        await user.click(productOption);

        screen.getByText("Select a product mode to continue.");

        const standardMode = screen.getByRole("radio", { name: "Standard" });
        await user.click(standardMode);

        expect(screen.queryByText("Select a product mode to continue.")).not.toBeInTheDocument();
      });

      it("does not show mode warning for products without modes", async () => {
        mockProduct(undefined);
        const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

        const productOption = screen.getByRole("radio", { name: tumbleweed.name });
        await user.click(productOption);

        expect(screen.queryByText("Select a product mode to continue.")).not.toBeInTheDocument();
      });
    });
  });

  describe("ProductSelectionTitle", () => {
    describe("when single product is available", () => {
      it("renders 'Select a mode' when product has modes and no product selected", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Select a mode" });
      });

      it("renders 'Change mode' when product with modes is already selected", () => {
        mockProduct(productWithModes);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Change mode" });
      });

      it("renders 'Select a product' when single product has no modes", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Select a product" });
      });
    });

    describe("when multiple products are available", () => {
      it("renders 'Select a product' when no product selected", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Select a product" });
      });

      it("renders 'Change product' when switching from product without modes", () => {
        mockProduct(tumbleweed);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Change product" });
      });

      it("renders 'Change product or mode' when switching from product with modes", () => {
        mockProduct(productWithModes);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes, tumbleweed] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByRole("heading", { name: "Change product or mode" });
      });
    });
  });

  describe("ProductSelectionIntro", () => {
    describe("when single product is available", () => {
      it("renders mode selection intro when product has modes", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Select a mode and confirm your choice.");
      });

      it("renders confirmation intro when product has no modes", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Confirm the product selection.");
      });
    });

    describe("when multiple products are available", () => {
      it("renders singular form with two products available but one already selected", () => {
        mockProduct(tumbleweed);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Select a product and confirm your choice.");
      });

      it("renders plural form when multiple products available for initial selection", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Select a product and confirm your choice at the end of the list.");
      });

      it("renders plural form when more than two products available", () => {
        mockProduct(tumbleweed);
        mockUseSystemFn.mockReturnValue({
          products: [tumbleweed, microOs, productWithModes],
        });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Select a product and confirm your choice at the end of the list.");
      });

      it("renders plural form for initial selection with three products", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({
          products: [tumbleweed, microOs, productWithModes],
        });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Select a product and confirm your choice at the end of the list.");
      });
    });
  });

  describe("ProductFormLabel", () => {
    describe("when single product is available", () => {
      it("renders 'Choose a mode' when product has modes and no product selected", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Choose a mode");
      });

      it("renders 'Switch to a different mode' when product is already selected", () => {
        mockProduct(productWithModes);
        mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Switch to a different mode");
      });

      // FIXME: This scenario shouldn't exist. When there's only one product
      // without modes, the selection screen should not be shown and the product
      // should be auto-selected.
      it("renders 'Choose a product' when single product has no modes", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Choose a product");
      });
    });

    describe("when no product is selected yet (initial selection)", () => {
      it("renders plural form when multiple products available", () => {
        mockProduct(undefined);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Choose from 2 available products");
      });
    });

    describe("when switching from a product without modes", () => {
      it("renders singular form when only one other product available", () => {
        mockProduct(tumbleweed);
        mockUseSystemFn.mockReturnValue({ products: [tumbleweed, microOs] });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Switch to another product");
      });

      it("renders plural form when multiple other products available", () => {
        mockProduct(tumbleweed);
        mockUseSystemFn.mockReturnValue({
          products: [tumbleweed, microOs, productWithModes],
        });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Switch to one of 2 available products");
      });
    });

    describe("when switching from a product with modes", () => {
      it("renders singular form when only one other product available", () => {
        mockProduct(productWithModes);
        mockUseSystemFn.mockReturnValue({
          products: [productWithModes, tumbleweed],
        });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Switch to a different mode or another product");
      });

      it("renders plural form when multiple other products available", () => {
        mockProduct(productWithModes);
        mockUseSystemFn.mockReturnValue({
          products: [productWithModes, tumbleweed, microOs],
        });
        installerRender(<ProductSelectionPage />, { withL10n: true });

        screen.getByText("Switch to a different mode or to one of 2 available products");
      });
    });
  });

  describe("ProductFormSubmitLabel", () => {
    it("renders 'Change' or  'Change to %product.name' when changing from one product to another", async () => {
      mockProduct(microOs);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      screen.getByRole("button", { name: "Change" });
      const tumbleweedOption = screen.getByRole("radio", { name: tumbleweed.name });
      await user.click(tumbleweedOption);
      screen.getByRole("button", { name: "Change to openSUSE Tumbleweed" });
    });

    it("renders 'Select' or 'Select %product.name' during initial selection", async () => {
      mockProduct(undefined);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      screen.getByRole("button", { name: "Select" });
      const tumbleweedOption = screen.getByRole("radio", { name: tumbleweed.name });
      await user.click(tumbleweedOption);
      screen.getByRole("button", { name: "Select openSUSE Tumbleweed" });
    });
  });

  describe("ProductFormSubmitLabelHelp", () => {
    it("renders warning when no product is selected", () => {
      mockProduct(undefined);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      screen.getByText("Select a product to continue.");
    });

    it("renders warning when license is not accepted", async () => {
      mockProduct(undefined);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const microOsOption = screen.getByRole("radio", { name: microOs.name });
      await user.click(microOsOption);
      screen.getByText("License acceptance is required to continue.");
    });

    it("hides helper text when product is selected and license is accepted", async () => {
      mockProduct(undefined);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const microOsOption = screen.getByRole("radio", { name: microOs.name });
      await user.click(microOsOption);
      const licenseCheckbox = screen.getByRole("checkbox", { name: /I have read and accept/ });
      await user.click(licenseCheckbox);
      expect(
        screen.queryByText("License acceptance is required to continue."),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Select a product to continue.")).not.toBeInTheDocument();
    });
  });

  describe("CurrentProductInfo", () => {
    it("renders nothing when no product has been set yet", () => {
      mockProduct(undefined);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      expect(screen.queryByRole("heading", { level: 2, name: "Current selection" })).toBeNull();
    });

    it("displays mode information when product has a selected mode", () => {
      mockProductConfig({ id: productWithModes.id, mode: "standard" });
      mockProduct(productWithModes);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      const sectionHeading = screen.getByRole("heading", { level: 2, name: "Current selection" });
      const section = sectionHeading.closest("section");

      // Product information
      within(section).getByRole("heading", { level: 3, name: productWithModes.name });
      within(section).getByText(productWithModes.description);

      // Mode information
      within(section).getByRole("heading", { level: 3, name: "Standard" });
      within(section).getByText("Standard system");
    });

    it("does not display mode information for products without modes", () => {
      mockProduct(tumbleweed);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      const sectionHeading = screen.getByRole("heading", { level: 2, name: "Current selection" });
      const section = sectionHeading.closest("section");

      within(section).getByRole("heading", { level: 3, name: tumbleweed.name });

      // Should only have one h3 heading (the product name)
      const h3Headings = within(section).getAllByRole("heading", { level: 3 });
      expect(h3Headings).toHaveLength(1);
    });

    // Test for ensuring that the section displaying information about the
    // currently configured product disappears immediately after the user
    // submits a new product request.
    //
    // Rationale:
    //   - Once a new product is selected, the previously configured product
    //     should no longer be shown, to provide clear and complete feedback
    //     that a new selection is in progress.
    //   - Keeping this section mounted or visible could cause a brief flicker
    //     during the initial selection, just before the app automatically
    //     navigates to the overview.
    it("renders nothing when new product is set (form was submitted)", async () => {
      mockProduct(microOs);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      screen.getByRole("heading", { level: 2, name: "Current selection" });
      const tumbleweedOption = screen.getByRole("radio", { name: tumbleweed.name });
      const submitButton = screen.getByRole("button", { name: /Change/ });
      await user.click(tumbleweedOption);
      await user.click(submitButton);
      await waitFor(() => {
        expect(screen.queryByRole("heading", { level: 2, name: "Current selection" })).toBeNull();
      });
    });

    it("renders current product information when changing products", () => {
      mockProduct(microOs);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      const sectionHeading = screen.getByRole("heading", { level: 2, name: "Current selection" });
      const section = sectionHeading.closest("section");
      within(section).getByRole("heading", { level: 3, name: microOs.name });
      within(section).getByText(microOs.description);
    });

    it("renders view license button for products with license", () => {
      mockProduct(microOs);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      const sectionHeading = screen.getByRole("heading", { level: 2, name: "Current selection" });
      const section = sectionHeading.closest("section");
      within(section).getByRole("button", { name: "View license" });
    });

    it("does not render view license button for products without license", () => {
      mockProduct(tumbleweed);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      const sectionHeading = screen.getByRole("heading", { level: 2, name: "Current selection" });
      const section = sectionHeading.closest("section");
      expect(
        within(section).queryByRole("button", { name: "View license" }),
      ).not.toBeInTheDocument();
    });

    it("does not render when no product is selected", () => {
      mockProduct(undefined);
      installerRender(<ProductSelectionPage />, { withL10n: true });

      expect(screen.queryByText("Current selection")).not.toBeInTheDocument();
    });
  });

  describe("LicenseButton", () => {
    it("opens license dialog", async () => {
      mockProduct(microOs);
      const { user } = installerRender(<ProductSelectionPage />, { withL10n: true });

      const viewLicenseButton = screen.getByRole("button", { name: "View license" });
      await user.click(viewLicenseButton);
      screen.getByText("LicenseDialog Mock");
    });
  });

  describe("ProductFormProductOption", () => {
    it("displays license requirement label for products with licenses", () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [microOs] });
      const { rerender } = installerRender(<ProductSelectionPage />, { withL10n: true });
      screen.getByText("License acceptance required");

      mockUseSystemFn.mockReturnValue({ products: [tumbleweed] });
      rerender(<ProductSelectionPage />);
      expect(screen.queryByText("License acceptance required")).toBeNull();
    });

    it("displays modes label for products with modes (none selected yet)", () => {
      mockProduct(undefined);
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      const { rerender } = installerRender(<ProductSelectionPage />, { withL10n: true });
      screen.getByText("2 modes available");

      mockUseSystemFn.mockReturnValue({ products: [tumbleweed] });
      rerender(<ProductSelectionPage />);
      expect(screen.queryByText("2 modes avaiable")).toBeNull();
    });

    it("displays modes label for products with modes (one selected)", () => {
      mockProduct(productWithModes);
      mockProductConfig({ id: productWithModes.id, mode: "standard" });
      mockUseSystemFn.mockReturnValue({ products: [productWithModes] });
      installerRender(<ProductSelectionPage />, { withL10n: true });

      screen.getByText("1 other mode available");
    });
  });
});
