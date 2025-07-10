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
import { AddonInfo, Product, RegisteredAddonInfo, RegistrationInfo } from "~/types/software";
import { useAddons, useProduct, useRegisteredAddons, useRegistration } from "~/queries/software";

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
let staticHostnameMock: string;
let registrationInfoMock: RegistrationInfo;
let addonInfoMock: AddonInfo[] = [];
let registeredAddonInfoMock: RegisteredAddonInfo[] = [];
const registerMutationMock = jest.fn();

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/software", () => ({
  ...jest.requireActual("~/queries/software"),
  useRegisterMutation: () => ({ mutate: registerMutationMock }),
  useRegistration: (): ReturnType<typeof useRegistration> => registrationInfoMock,
  useAddons: (): ReturnType<typeof useAddons> => addonInfoMock,
  useRegisteredAddons: (): ReturnType<typeof useRegisteredAddons> => registeredAddonInfoMock,
  useProduct: (): ReturnType<typeof useProduct> => {
    return {
      products: [tw, sle],
      selectedProduct,
    };
  },
}));

jest.mock("~/queries/system", () => ({
  ...jest.requireActual("~/queries/system"),
  useHostname: () => ({ transient: "testing-node", static: staticHostnameMock }),
}));

describe("ProductRegistrationPage", () => {
  describe("when selected product is not registrable", () => {
    beforeEach(() => {
      selectedProduct = tw;
      registrationInfoMock = { registered: false, key: "", email: "", url: "" };
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when selected product is registrable and registration code is not set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = { registered: false, key: "", email: "", url: "" };
    });

    describe("and the static hostname is not set", () => {
      it("renders a custom alert using the transient hostname", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });

        screen.getByText("Custom alert:");
        screen.getByText('The product will be registered with "testing-node" hostname');
        screen.getByRole("link", { name: "hostname" });
      });
    });

    describe("and the static hostname is set", () => {
      beforeEach(() => {
        staticHostnameMock = "testing-server";
      });

      it("renders a custom alert using the static hostname", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });

        screen.getByText("Custom alert:");
        screen.getByText('The product will be registered with "testing-server" hostname');
        screen.getByRole("link", { name: "hostname" });
      });
    });

    it("allows registering the product with email address", async () => {
      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
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
          url: "",
          email: "example@company.test",
          key: "INTERNAL-USE-ONLY-1234-5678",
        },
        expect.anything(),
      );
    });

    it("allows registering the product without email address", async () => {
      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");

      await user.click(submitButton);

      expect(registerMutationMock).toHaveBeenCalledWith(
        {
          url: "",
          key: "INTERNAL-USE-ONLY-1234-5678",
          email: "",
        },
        expect.anything(),
      );
    });

    it.todo("allows registering using a custom server");

    describe("if registering with the default server", () => {
      it.todo("shows an error if there is no registration code");

      describe("and 'provide email' was indicated", () => {
        it.todo("does not show an error if there is an email");
        it.todo("shows an error if there is no email");
      });
    });

    describe("if registering with a custom server", () => {
      it.todo("shows an error if there is no url");

      describe("and 'provide registration code' was indicated", () => {
        it.todo("does not show an error if there is a code");
        it.todo("shows an error if there is no code");
      });

      describe("and 'provide email' was indicated", () => {
        it.todo("does not show an error if there is an email");
        it.todo("shows an error if there is no email");
      });
    });

    it.todo("handles and renders errors from server, if any");
  });

  describe("when selected product is registrable and registration code is set", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = {
        registered: true,
        key: "INTERNAL-USE-ONLY-1234-5678",
        email: "example@company.test",
        url: "",
      };
      addonInfoMock = [
        {
          id: "sle-ha",
          version: "16.0",
          label: "SUSE Linux Enterprise High Availability Extension 16.0 x86_64 (BETA)",
          available: true,
          free: false,
          recommended: false,
          description: "SUSE Linux High Availability Extension provides ...",
          type: "extension",
          release: "beta",
        },
      ];
    });

    it.todo("renders the registration server if a custom server was used");

    it("does not render a custom alert about hostname", () => {
      installerRender(<ProductRegistrationPage />, { withL10n: true });

      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText(/hostname/)).toBeNull();
      expect(screen.queryByRole("link", { name: "hostname" })).toBeNull();
    });

    it("renders registration information with code partially hidden", async () => {
      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
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

    it.todo("renders the registration email");
    it.todo("does not render the registration server if the default server was used");
    it.todo("does not render the registration code if a code was not provided");
    it.todo("does not render the registration email if an email was not provided");

    it("renders available extensions", async () => {
      const { container } = installerRender(<ProductRegistrationPage />, { withL10n: true });

      // description is displayed
      screen.getByText(addonInfoMock[0].description);
      // label without "BETA"
      screen.getByText("SUSE Linux Enterprise High Availability Extension 16.0 x86_64");

      // registration input field is displayed
      const addonRegCode = container.querySelector('[id="input-reg-code-sle-ha-16.0"]');
      expect(addonRegCode).not.toBeNull();

      // submit button is displayed
      const addonRegButton = container.querySelector('[id="register-button-sle-ha-16.0"]');
      expect(addonRegButton).not.toBeNull();
    });

    describe("when the extension is registered", () => {
      beforeEach(() => {
        registeredAddonInfoMock = [
          {
            id: "sle-ha",
            version: "16.0",
            registrationCode: "INTERNAL-USE-ONLY-1234-ad42",
          },
        ];
      });

      it("renders registration information with code partially hidden", async () => {
        const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });

        // the second "Show" button, the first one belongs to the base product registration code
        const visibilityCodeToggler = screen.getAllByRole("button", { name: "Show" })[1];
        expect(visibilityCodeToggler).not.toBeNull();

        // only the end of the code is displayed
        screen.getByText(/\*+ad42/);
        // not the full code
        expect(screen.queryByText(registeredAddonInfoMock[0].registrationCode)).toBeNull();

        // after pressing the "Show" button
        await user.click(visibilityCodeToggler);
        // the full code is visible
        screen.getByText(registeredAddonInfoMock[0].registrationCode);
      });
    });
  });
});
