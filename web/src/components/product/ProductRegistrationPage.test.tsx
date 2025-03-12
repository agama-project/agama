/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { installerRender } from "~/test-utils";
import ProductRegistrationPage from "./ProductRegistrationPage";
import { Product, RegistrationInfo } from "~/types/software";
import { useProduct, useRegistration } from "~/queries/software";

const tw: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  registration: false,
};

const sle: Product = {
  id: "sle",
  name: "SLE",
  registration: true,
};

let selectedProduct: Product;
let registrationInfoMock: RegistrationInfo;
const registerMutationMock = jest.fn();

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useRegisterMutation: () => ({ mutate: registerMutationMock }),
  useRegistration: (): ReturnType<typeof useRegistration> => registrationInfoMock,
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tw, sle],
      selectedProduct,
    };
  },
}));

describe("ProductRegistrationPage", () => {
  describe("when selected product is not registrable", () => {
    beforeEach(() => {
      selectedProduct = tw;
      registrationInfoMock = { key: "", email: "" };
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationPage />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when selected product is registrable and registration code is not set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "", email: "" };
    });

    it("renders a custom alert about hostname", () => {
      installerRender(<ProductRegistrationPage />);

      screen.getByText("Custom alert:");
      screen.getByText(/Product will be registered with .* hostname/);
      screen.getByRole("link", { name: "hostname" });

      throw new Error(
        "Please update the test once the real hook for retrieving hostname is implemented and used",
      );
    });

    it("renders a form to allow user registering the product", async () => {
      const { user } = installerRender(<ProductRegistrationPage />);
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");

      // email input is optional, user has to explicitely activate it
      const provideEmailCheckbox = screen.getByRole("checkbox", { name: "Provide email address" });
      expect(provideEmailCheckbox).not.toBeChecked();
      await user.click(provideEmailCheckbox);
      expect(provideEmailCheckbox).toBeChecked();
      const emailInput = screen.getByRole("textbox", { name: /Email/ });
      await user.type(emailInput, "example@company.test");

      await user.click(submitButton);

      expect(registerMutationMock).toHaveBeenCalledWith(
        {
          email: "example@company.test",
          key: "INTERNAL-USE-ONLY-1234-5678",
        },
        expect.anything(),
      );
    });

    it.todo("check client validations");
    it.todo("handles and renders errors from server, if any");
  });

  describe("when selected product is registrable and registration code is set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { key: "INTERNAL-USE-ONLY-1234-5678", email: "example@company.test" };
    });

    it("renders registration information with code partially hidden", async () => {
      const { user } = installerRender(<ProductRegistrationPage />);
      const visibilityCodeToggler = screen.getByRole("button", { name: "Show" });
      screen.getByText(/\*?5678/);
      expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
      expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
      screen.getByText("example@company.test");
      await user.click(visibilityCodeToggler);
      screen.getByText("INTERNAL-USE-ONLY-1234-5678");
      await user.click(visibilityCodeToggler);
      expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
      screen.getByText(/\*?5678/);
    });
  });
});
