/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { screen, within } from "@testing-library/react";
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

jest.mock("~/hooks/model/proposal/hostname", () => ({
  ...jest.requireActual("~/hooks/model/proposal"),
  useHostname: () => ({ transient: "testing-node", static: staticHostnameMock }),
}));

it.todo("Adapt test to new hooks");
describe.skip("ProductRegistrationPage", () => {
  describe("when the selected product is not registrable", () => {
    beforeEach(() => {
      selectedProduct = tw;
      registrationInfoMock = { registered: false, key: "", email: "", url: "" };
    });

    it("renders nothing", () => {
      const { container } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("when the selected product is registrable and not yet registered", () => {
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

    it("allows registering the product without an email address", async () => {
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

    it("allows registering the product with an email address", async () => {
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

    it("renders an error when email input is enabled but left empty", async () => {
      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");

      // email input is optional, user has to explicitely activate it
      const provideEmailCheckbox = screen.getByRole("checkbox", { name: "Provide email address" });
      await user.click(provideEmailCheckbox);
      await user.click(submitButton);

      expect(registerMutationMock).not.toHaveBeenCalled();
      screen.getByText("Warning alert:");
      screen.getByText("Enter an email");
    });

    it("allows registering using a custom server", async () => {
      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      const registrationServerButton = screen.getByRole("button", { name: "Registration server" });
      await user.click(registrationServerButton);
      const customServer = screen.getByRole("option", { name: /^Custom/ });
      await user.click(customServer);
      const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
      await user.type(serverUrlInput, "https://custom-server.test");
      const submitButton = screen.getByRole("button", { name: "Register" });

      await user.click(submitButton);
      expect(registerMutationMock).toHaveBeenCalledWith(
        {
          url: "https://custom-server.test",
          key: "",
          email: "",
        },
        expect.anything(),
      );
    });

    describe("if registering with the default server", () => {
      it("shows an error when no registration code is provided", async () => {
        const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
        const submitButton = screen.getByRole("button", { name: "Register" });

        await user.click(submitButton);

        expect(registerMutationMock).not.toHaveBeenCalled();
        screen.getByText("Warning alert:");
        screen.getByText("Enter a registration code");
      });
    });

    describe("if registering with a custom server", () => {
      it("shows an error when no server URL is provided", async () => {
        const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
        const registrationServerButton = screen.getByRole("button", {
          name: "Registration server",
        });
        await user.click(registrationServerButton);
        const customServer = screen.getByRole("option", { name: /^Custom/ });
        await user.click(customServer);
        const submitButton = screen.getByRole("button", { name: "Register" });
        await user.click(submitButton);

        expect(registerMutationMock).not.toHaveBeenCalled();
        screen.getByText("Warning alert:");
        screen.getByText("Enter a server URL");
      });

      describe("and user enabled the registration code input", () => {
        it("does not renders an error if the code is provided", async () => {
          const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
          const registrationServerButton = screen.getByRole("button", {
            name: "Registration server",
          });
          await user.click(registrationServerButton);
          const customServer = screen.getByRole("option", { name: /^Custom/ });
          await user.click(customServer);
          const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
          await user.type(serverUrlInput, "https://custom-server.test");
          const provideRegistrationCode = screen.getByRole("checkbox", {
            name: "Provide registration code",
          });
          await user.click(provideRegistrationCode);
          const registrationCodeInput = screen.getByLabelText("Registration code");
          await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");
          const submitButton = screen.getByRole("button", { name: "Register" });
          await user.click(submitButton);

          expect(registerMutationMock).toHaveBeenCalledWith(
            {
              url: "https://custom-server.test",
              key: "INTERNAL-USE-ONLY-1234-5678",
              email: "",
            },
            expect.anything(),
          );
          expect(screen.queryByText("Enter a registration code")).toBeNull();
        });

        it("renders an error if the code is left empty", async () => {
          const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
          const registrationServerButton = screen.getByRole("button", {
            name: "Registration server",
          });
          await user.click(registrationServerButton);
          const customServer = screen.getByRole("option", { name: /^Custom/ });
          await user.click(customServer);
          const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
          await user.type(serverUrlInput, "https://custom-server.test");
          const provideRegistrationCode = screen.getByRole("checkbox", {
            name: "Provide registration code",
          });
          await user.click(provideRegistrationCode);
          const submitButton = screen.getByRole("button", { name: "Register" });
          await user.click(submitButton);

          expect(registerMutationMock).not.toHaveBeenCalled();
          screen.getByText("Warning alert:");
          screen.queryByText("Enter a registration code.");
        });
      });
    });

    // Marked as pending until know how to properly trigger the mutation#onError
    xit("handles and renders errors returned by the registration server", async () => {
      registerMutationMock.mockRejectedValue({
        response: { data: { message: "Unauthorized code" } },
      });

      const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
      const registrationCodeInput = screen.getByLabelText("Registration code");
      const submitButton = screen.getByRole("button", { name: "Register" });
      await user.type(registrationCodeInput, "INTERNAL-USE-ONLY-1234-5678");
      await user.click(submitButton);

      expect(registerMutationMock).toHaveBeenCalledWith(
        {
          url: "",
          email: "",
          key: "INTERNAL-USE-ONLY-1234-5678",
        },
        expect.anything(),
      );

      screen.getByText("Warning alert:");
      screen.getByText("Unauthorized code");
    });
  });

  describe("when selected product is registrable and already registered", () => {
    beforeEach(() => {
      selectedProduct = sle;
      registrationInfoMock = {
        registered: true,
        key: "INTERNAL-USE-ONLY-1234-5678",
        email: "example@company.test",
        url: "",
      };
    });

    it("does not render a custom alert about the hostname", () => {
      installerRender(<ProductRegistrationPage />, { withL10n: true });

      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText(/hostname/)).toBeNull();
      expect(screen.queryByRole("link", { name: "hostname" })).toBeNull();
    });

    describe("if registered with the default server", () => {
      it("does not render the registration server information", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });
        expect(screen.queryByText("Registration server")).toBeNull();
        expect(screen.queryByText("https://custom-server.test")).toBeNull();
      });
    });

    describe("if registered with a custom server", () => {
      beforeEach(() => {
        registrationInfoMock = {
          registered: true,
          key: "INTERNAL-USE-ONLY-1234-5678",
          email: "example@company.test",
          url: "https://custom-server.test",
        };
      });

      it("renders the registration server", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });
        screen.getByText("Registration server");
        screen.getByText("https://custom-server.test");
      });
    });

    describe("if using a resgistration code", () => {
      it("renders the code partially hidden", async () => {
        const { user } = installerRender(<ProductRegistrationPage />, { withL10n: true });
        screen.getByText("Registration code");
        const visibilityCodeToggler = screen.getByRole("button", { name: "Show" });
        screen.getByText(/\*?5678/);
        expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
        screen.getByText("example@company.test");
        await user.click(visibilityCodeToggler);
        screen.getByText("INTERNAL-USE-ONLY-1234-5678");
        await user.click(visibilityCodeToggler);
        expect(screen.queryByText("INTERNAL-USE-ONLY-1234-5678")).toBeNull();
        screen.getByText(/\*?5678/);
      });
    });

    describe("if not using a resgistration code", () => {
      beforeEach(() => {
        registrationInfoMock = {
          registered: true,
          key: "",
          email: "",
          url: "",
        };
      });

      it("does not render the code", async () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });
        expect(screen.queryByText("Registration code")).toBeNull();
      });
    });

    describe("if using an email", () => {
      it("renders the email", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });
        screen.getByText("Email");
        screen.getByText("example@company.test");
      });
    });

    describe("if no email address is provided", () => {
      beforeEach(() => {
        registrationInfoMock = {
          registered: true,
          key: "",
          email: "",
          url: "",
        };
      });

      it("does not render the email", () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });
        expect(screen.queryByText("Email")).toBeNull();
        expect(screen.queryByText("example@company.test")).toBeNull();
      });
    });

    describe("when extensions are available", () => {
      beforeEach(() => {
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

      it("renders them", async () => {
        installerRender(<ProductRegistrationPage />, { withL10n: true });

        // heading without "BETA"
        const title = screen.getByRole("heading", {
          name: /SUSE Linux Enterprise High Availability Extension 16.0 x86_64/,
          level: 4,
        });
        const extensionNode = title.parentElement;

        // description is displayed
        within(extensionNode).getByText(addonInfoMock[0].description);

        // registration input field is displayed
        within(extensionNode).getByLabelText("Registration code");

        // submit button is displayed
        within(extensionNode).getByRole("button", { name: "Register" });
      });

      describe("and they are registered", () => {
        beforeEach(() => {
          registeredAddonInfoMock = [
            {
              id: "sle-ha",
              version: "16.0",
              registrationCode: "INTERNAL-USE-ONLY-1234-ad42",
            },
          ];
        });

        it("renders them with its registration code partially hidden", async () => {
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
});
